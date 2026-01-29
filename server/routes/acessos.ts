import type { Express } from "express";
import { sql } from "drizzle-orm";
import type { IStorage } from "../storage";
import { pool } from "../db";

const mapClient = (row: any) => ({
  id: row.id,
  name: row.name,
  cnpj: row.cnpj,
  status: row.status || 'ativo',
  additionalInfo: row.additional_info,
  linkedClientCnpj: row.linked_client_cnpj,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  credential_count: parseInt(row.credential_count) || 0,
});

const mapCredential = (row: any) => ({
  id: row.id,
  clientId: row.client_id,
  platform: row.platform,
  username: row.username,
  password: row.password,
  accessUrl: row.access_url,
  observations: row.observations,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function registerAcessosRoutes(app: Express, db: any, storage: IStorage) {
  try {
    await db.execute(sql`ALTER TABLE cortex_core.clients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo'`);
  } catch (e) {
  }

  app.get("/api/acessos/clients", async (req, res) => {
    try {
      const search = req.query.search as string;
      
      const turboToolsCount = await db.execute(sql`SELECT COUNT(*) as count FROM cortex_core.turbo_tools`);
      const turboCount = parseInt((turboToolsCount.rows[0] as any)?.count) || 0;
      
      const cazStatusResult = await db.execute(sql`SELECT cnpj, ativo, id FROM "Conta Azul".caz_clientes WHERE cnpj IS NOT NULL`);
      const cazStatusMap = new Map<string, { ativo: string; id: number }>();
      for (const row of cazStatusResult.rows as any[]) {
        if (row.cnpj) {
          cazStatusMap.set(row.cnpj.toLowerCase().replace(/[^\d]/g, ''), { ativo: row.ativo, id: row.id });
        }
      }
      
      const cupStatusResult = await db.execute(sql`SELECT cnpj, status FROM "Clickup".cup_clientes WHERE cnpj IS NOT NULL`);
      const cupStatusMap = new Map<string, string>();
      for (const row of cupStatusResult.rows as any[]) {
        if (row.cnpj) {
          cupStatusMap.set(row.cnpj.toLowerCase().replace(/[^\d]/g, ''), row.status);
        }
      }
      
      const credentialsPlatformsResult = await db.execute(sql`
        SELECT client_id, array_agg(DISTINCT platform) as platforms 
        FROM cortex_core.credentials 
        GROUP BY client_id
      `);
      const clientPlatformsMap = new Map<string, string[]>();
      for (const row of credentialsPlatformsResult.rows as any[]) {
        clientPlatformsMap.set(row.client_id, row.platforms || []);
      }
      
      let result;
      if (search) {
        const searchPattern = `%${search}%`;
        result = await db.execute(sql`
          SELECT c.*, 
            CASE 
              WHEN LOWER(TRIM(c.name)) = 'turbo partners' THEN ${turboCount}
              ELSE (SELECT COUNT(*) FROM cortex_core.credentials cr WHERE cr.client_id = c.id)
            END as credential_count
          FROM cortex_core.clients c 
          WHERE LOWER(c.name) LIKE LOWER(${searchPattern}) OR LOWER(c.cnpj) LIKE LOWER(${searchPattern})
          ORDER BY c.created_at DESC
        `);
      } else {
        result = await db.execute(sql`
          SELECT c.*, 
            CASE 
              WHEN LOWER(TRIM(c.name)) = 'turbo partners' THEN ${turboCount}
              ELSE (SELECT COUNT(*) FROM cortex_core.credentials cr WHERE cr.client_id = c.id)
            END as credential_count
          FROM cortex_core.clients c 
          ORDER BY c.created_at DESC
        `);
      }
      
      const mapped = result.rows.map((row: any) => {
        let status = row.status || null;
        let cazClienteId: number | null = null;
        
        const cnpjToLookup = row.linked_client_cnpj || row.cnpj;
        if (cnpjToLookup) {
          const normalizedCnpj = cnpjToLookup.toLowerCase().replace(/[^\d]/g, '');
          
          const cupStatus = cupStatusMap.get(normalizedCnpj);
          if (cupStatus) {
            status = cupStatus;
          }
          
          const cazData = cazStatusMap.get(normalizedCnpj);
          if (cazData) {
            cazClienteId = cazData.id;
            if (!status) {
              const ativoValue = String(cazData.ativo || '').toLowerCase().trim();
              status = (ativoValue === 'ativo' || ativoValue === 'sim' || ativoValue === 'true' || ativoValue === '1') ? 'Ativo' : 'Cancelado/Inativo';
            }
          }
        }
        
        const platforms = clientPlatformsMap.get(row.id) || [];
        
        return {
          ...mapClient(row),
          status,
          cazClienteId,
          platforms,
        };
      });
      
      res.json(mapped);
    } catch (error) {
      console.error("[api] Error fetching clients:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.get("/api/acessos/caz-clientes", async (req, res) => {
    try {
      const search = req.query.search as string;
      
      let result;
      if (search) {
        const searchPattern = `%${search}%`;
        result = await db.execute(sql`
          SELECT 
            caz.id, 
            caz.nome, 
            caz.cnpj, 
            caz.ativo,
            CASE WHEN cl.id IS NOT NULL THEN true ELSE false END as has_credentials
          FROM "Conta Azul".caz_clientes caz
          LEFT JOIN cortex_core.clients cl ON LOWER(caz.nome) = LOWER(cl.name)
          WHERE LOWER(caz.nome) LIKE LOWER(${searchPattern}) OR LOWER(caz.cnpj) LIKE LOWER(${searchPattern})
          ORDER BY caz.nome ASC
          LIMIT 50
        `);
      } else {
        result = await db.execute(sql`
          SELECT 
            caz.id, 
            caz.nome, 
            caz.cnpj, 
            caz.ativo,
            CASE WHEN cl.id IS NOT NULL THEN true ELSE false END as has_credentials
          FROM "Conta Azul".caz_clientes caz
          LEFT JOIN cortex_core.clients cl ON LOWER(caz.nome) = LOWER(cl.name)
          ORDER BY caz.nome ASC
          LIMIT 50
        `);
      }
      
      const mapped = result.rows.map((row: any) => ({
        id: row.id,
        name: row.nome,
        cnpj: row.cnpj,
        status: row.ativo === 'Ativo' ? 'ativo' : 'cancelado',
        hasCredentials: row.has_credentials === true || row.has_credentials === 't' || row.has_credentials === 'true',
      }));
      
      res.json(mapped);
    } catch (error) {
      console.error("[api] Error fetching caz_clientes:", error);
      res.status(500).json({ error: "Failed to fetch caz_clientes" });
    }
  });

  app.get("/api/acessos/clients/batch", async (req, res) => {
    try {
      const idsParam = req.query.ids as string;
      if (!idsParam) {
        return res.status(400).json({ error: "ids parameter is required" });
      }
      
      const ids = idsParam.split(',').filter(id => id.trim());
      if (ids.length === 0) {
        return res.json([]);
      }
      
      const idsArray = `{${ids.join(',')}}`;
      
      const clientsResult = await db.execute(sql`
        SELECT * FROM cortex_core.clients WHERE id::text = ANY(${idsArray}::text[])
      `);
      
      if (clientsResult.rows.length === 0) {
        return res.json([]);
      }
      
      const credentialsResult = await db.execute(sql`
        SELECT * FROM cortex_core.credentials WHERE client_id::text = ANY(${idsArray}::text[]) ORDER BY platform
      `);
      
      const credentialsByClientId = new Map<string, any[]>();
      for (const cred of credentialsResult.rows) {
        const clientId = String((cred as any).client_id);
        if (!credentialsByClientId.has(clientId)) {
          credentialsByClientId.set(clientId, []);
        }
        credentialsByClientId.get(clientId)!.push(mapCredential(cred));
      }
      
      const result = clientsResult.rows.map((client: any) => ({
        ...mapClient(client),
        credentials: credentialsByClientId.get(String(client.id)) || []
      }));
      
      res.json(result);
    } catch (error) {
      console.error("[api] Error fetching batch clients:", error);
      res.status(500).json({ error: "Failed to fetch batch clients" });
    }
  });

  app.post("/api/acessos/clients/bulk-update-cnpj", async (req, res) => {
    try {
      const { mappings } = req.body;
      
      if (!mappings || !Array.isArray(mappings)) {
        return res.status(400).json({ error: "mappings array is required" });
      }
      
      if (mappings.length === 0) {
        return res.json({ updated: 0, notFound: [], message: "No mappings provided" });
      }
      
      for (const mapping of mappings) {
        if (!mapping.name || typeof mapping.name !== 'string') {
          return res.status(400).json({ error: "Each mapping must have a 'name' string" });
        }
        if (!mapping.cnpj || typeof mapping.cnpj !== 'string') {
          return res.status(400).json({ error: "Each mapping must have a 'cnpj' string" });
        }
      }
      
      const result = await storage.bulkUpdateClientCnpj(mappings);
      
      res.json({
        ...result,
        total: mappings.length,
        message: `Updated ${result.updated} client(s), ${result.notFound.length} not found`
      });
    } catch (error) {
      console.error("[api] Error bulk updating client CNPJs:", error);
      res.status(500).json({ error: "Failed to bulk update client CNPJs" });
    }
  });

  app.get("/api/acessos/clients/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verificar se o id é um UUID válido antes de fazer a query
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ error: "Invalid client ID format" });
      }
      
      const clientResult = await db.execute(sql`SELECT * FROM cortex_core.clients WHERE id::text = ${id}`);
      
      if (clientResult.rows.length === 0) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      const credentialsResult = await db.execute(sql`
        SELECT * FROM cortex_core.credentials WHERE client_id::text = ${id} ORDER BY platform
      `);
      
      const client = clientResult.rows[0] as any;
      res.json({
        ...mapClient(client),
        credentials: credentialsResult.rows.map(mapCredential)
      });
    } catch (error) {
      console.error("[api] Error fetching client:", error);
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  app.post("/api/acessos/clients", async (req, res) => {
    try {
      const { name, cnpj, status, additionalInfo } = req.body;
      const createdBy = (req as any).user?.email || null;
      
      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }
      
      // Usando pool diretamente para evitar problemas de tipo com drizzle
      // Forçar tipos TEXT para evitar inferência incorreta de UUID
      const result = await pool.query(
        `INSERT INTO cortex_core.clients (name, cnpj, status, additional_info, created_by)
         VALUES ($1::text, $2::text, $3::text, $4::text, $5::text)
         RETURNING *`,
        [name, cnpj || null, status || 'ativo', additionalInfo || null, createdBy]
      );
      
      res.status(201).json(mapClient(result.rows[0]));
    } catch (error) {
      console.error("[api] Error creating client:", error);
      res.status(500).json({ error: "Failed to create client" });
    }
  });

  app.get("/api/acessos/turbo-tools", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, name, login, password, site, observations
        FROM cortex_core.turbo_tools
        ORDER BY name ASC
      `);
      
      const tools = result.rows.map((row: any) => ({
        id: row.id,
        platform: row.name,
        username: row.login,
        password: row.password,
        accessUrl: row.site,
        observations: row.observations,
      }));
      
      res.json(tools);
    } catch (error) {
      console.error("[api] Error fetching turbo_tools:", error);
      res.status(500).json({ error: "Failed to fetch turbo_tools" });
    }
  });

  app.post("/api/acessos/turbo-tools", async (req, res) => {
    try {
      const { platform, username, password, accessUrl, observations } = req.body;
      
      if (!platform || !username || !password) {
        return res.status(400).json({ error: "Platform, username and password are required" });
      }
      
      const result = await db.execute(sql`
        INSERT INTO cortex_core.turbo_tools (name, login, password, site, observations)
        VALUES (${platform}, ${username}, ${password}, ${accessUrl || null}, ${observations || null})
        RETURNING id, name, login, password, site, observations
      `);
      
      const row = result.rows[0] as any;
      res.status(201).json({
        id: row.id,
        platform: row.name,
        username: row.login,
        password: row.password,
        accessUrl: row.site,
        observations: row.observations,
      });
    } catch (error) {
      console.error("[api] Error creating turbo_tool:", error);
      res.status(500).json({ error: "Failed to create turbo_tool" });
    }
  });

  app.patch("/api/acessos/turbo-tools/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { platform, username, password, accessUrl, observations } = req.body;
      
      const result = await db.execute(sql`
        UPDATE cortex_core.turbo_tools 
        SET name = COALESCE(${platform}, name),
            login = COALESCE(${username}, login),
            password = COALESCE(${password}, password),
            site = COALESCE(${accessUrl}, site),
            observations = COALESCE(${observations}, observations)
        WHERE id = ${parseInt(id)}
        RETURNING id, name, login, password, site, observations
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Turbo tool not found" });
      }
      
      const row = result.rows[0] as any;
      res.json({
        id: row.id,
        platform: row.name,
        username: row.login,
        password: row.password,
        accessUrl: row.site,
        observations: row.observations,
      });
    } catch (error) {
      console.error("[api] Error updating turbo_tool:", error);
      res.status(500).json({ error: "Failed to update turbo_tool" });
    }
  });

  app.delete("/api/acessos/turbo-tools/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const result = await db.execute(sql`
        DELETE FROM cortex_core.turbo_tools WHERE id = ${parseInt(id)} RETURNING id
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Turbo tool not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error deleting turbo_tool:", error);
      res.status(500).json({ error: "Failed to delete turbo_tool" });
    }
  });

  app.patch("/api/acessos/clients/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, cnpj, status, additionalInfo, linkedClientCnpj } = req.body;
      
      // Verificar se o id é um UUID válido
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ error: "Invalid client ID format" });
      }
      
      const result = await db.execute(sql`
        UPDATE cortex_core.clients 
        SET name = COALESCE(${name}, name),
            cnpj = COALESCE(${cnpj}, cnpj),
            status = COALESCE(${status}, status),
            additional_info = COALESCE(${additionalInfo}, additional_info),
            linked_client_cnpj = ${linkedClientCnpj ?? null},
            updated_at = NOW()
        WHERE id::text = ${id}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      res.json(mapClient(result.rows[0]));
    } catch (error) {
      console.error("[api] Error updating client:", error);
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  app.get("/api/acessos/cup-clientes", async (req, res) => {
    try {
      const search = req.query.search as string;
      
      let result;
      if (search) {
        const searchPattern = `%${search}%`;
        result = await db.execute(sql`
          SELECT nome, cnpj, status 
          FROM "Clickup".cup_clientes 
          WHERE (nome ILIKE ${searchPattern} OR cnpj ILIKE ${searchPattern})
          AND LOWER(status) = 'ativo'
          ORDER BY nome
          LIMIT 50
        `);
      } else {
        result = await db.execute(sql`
          SELECT nome, cnpj, status 
          FROM "Clickup".cup_clientes 
          WHERE LOWER(status) = 'ativo'
          ORDER BY nome
          LIMIT 100
        `);
      }
      
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching cup_clientes:", error);
      res.status(500).json({ error: "Failed to fetch cup_clientes" });
    }
  });

  app.post("/api/clientes/update-clickup-links", async (req, res) => {
    try {
      const { data } = req.body;
      
      if (!data || !Array.isArray(data)) {
        return res.status(400).json({ error: "Data must be an array of {link, cnpj} objects" });
      }
      
      let updated = 0;
      let notFound = 0;
      const errors: string[] = [];
      
      for (const item of data) {
        const { link, cnpj } = item;
        
        if (!link || !cnpj) {
          errors.push(`Invalid item: missing link or cnpj`);
          continue;
        }
        
        const cleanCnpj = cnpj.replace(/\D/g, '');
        
        try {
          const result = await db.execute(sql`
            UPDATE "Clickup".cup_clientes 
            SET link_lista_clickup = ${link}
            WHERE REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '-', ''), '/', '') = ${cleanCnpj}
            RETURNING cnpj
          `);
          
          if (result.rows.length > 0) {
            updated++;
          } else {
            notFound++;
          }
        } catch (err) {
          errors.push(`Error updating CNPJ ${cnpj}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
      
      res.json({ 
        success: true, 
        updated, 
        notFound, 
        total: data.length,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined
      });
    } catch (error) {
      console.error("[api] Error updating ClickUp links:", error);
      res.status(500).json({ error: "Failed to update ClickUp links" });
    }
  });

  app.post("/api/acessos/ai-match-clients", async (req, res) => {
    try {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const acessosClients = await db.execute(sql`
        SELECT id, name FROM cortex_core.clients WHERE linked_client_cnpj IS NULL
      `);
      
      const cazClientes = await db.execute(sql`
        SELECT id, nome, cnpj FROM "Conta Azul".caz_clientes WHERE nome IS NOT NULL
      `);
      
      if (acessosClients.rows.length === 0 || cazClientes.rows.length === 0) {
        return res.json({ matches: [], message: "Não há clientes para vincular ou não há clientes no Conta Azul" });
      }
      
      const companySuffixes = [
        'ltda', 'me', 'mei', 'eireli', 'epp', 'sa', 's a', 's/a',
        'comercio', 'comercial', 'servicos', 'solucoes', 'industria',
        'brasil', 'br', 'do brasil', 'group', 'grupo', 'holding',
        'assessoria', 'consultoria', 'tecnologia', 'digital',
        'marketing', 'agencia', 'studio', 'estudio', 'lab', 'labs'
      ];
      
      const normalizeName = (name: string): string => {
        return name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      };
      
      const removeCompanySuffixes = (normalized: string): string => {
        let result = normalized;
        for (const suffix of companySuffixes) {
          const regex = new RegExp(`\\b${suffix}\\b`, 'g');
          result = result.replace(regex, '');
        }
        return result.replace(/\s+/g, ' ').trim();
      };
      
      const levenshteinDistance = (a: string, b: string): number => {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        const matrix: number[][] = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
          for (let j = 1; j <= a.length; j++) {
            const cost = a[j - 1] === b[i - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
              matrix[i - 1][j] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j - 1] + cost
            );
          }
        }
        return matrix[b.length][a.length];
      };
      
      const similarity = (a: string, b: string): number => {
        const maxLen = Math.max(a.length, b.length);
        if (maxLen === 0) return 1;
        return 1 - levenshteinDistance(a, b) / maxLen;
      };
      
      const acessosList = acessosClients.rows.map((r: any) => {
        const normalized = normalizeName(r.name || '');
        return { 
          id: r.id, 
          name: r.name,
          normalized,
          core: removeCompanySuffixes(normalized)
        };
      });
      
      const cazList = cazClientes.rows.map((r: any) => {
        const normalized = normalizeName(r.nome || '');
        return { 
          id: r.id,
          nome: r.nome, 
          cnpj: r.cnpj,
          normalized,
          core: removeCompanySuffixes(normalized)
        };
      });
      
      const cazByNormalized = new Map<string, any>();
      const cazByCore = new Map<string, any>();
      cazList.forEach((c: any) => {
        if (c.normalized) cazByNormalized.set(c.normalized, c);
        if (c.core && c.core.length >= 3) cazByCore.set(c.core, c);
      });
      
      const matches: any[] = [];
      const unmatchedAcessos: any[] = [];
      
      for (const acessos of acessosList) {
        const exactMatch = cazByNormalized.get(acessos.normalized);
        if (exactMatch) {
          matches.push({
            acessosId: acessos.id,
            acessosName: acessos.name,
            cazId: exactMatch.id,
            cazCnpj: exactMatch.cnpj,
            cazNome: exactMatch.nome,
            confidence: "high",
            reason: "Nome idêntico (match exato)"
          });
          continue;
        }
        
        const coreMatch = cazByCore.get(acessos.core);
        if (coreMatch && acessos.core.length >= 3) {
          matches.push({
            acessosId: acessos.id,
            acessosName: acessos.name,
            cazId: coreMatch.id,
            cazCnpj: coreMatch.cnpj,
            cazNome: coreMatch.nome,
            confidence: "high",
            reason: "Nome principal idêntico (sem sufixos empresariais)"
          });
          continue;
        }
        
        let bestMatch = null;
        let bestSimilarity = 0;
        for (const caz of cazList) {
          const sim = similarity(acessos.core, caz.core);
          if (sim > bestSimilarity && sim >= 0.8) {
            bestSimilarity = sim;
            bestMatch = caz;
          }
        }
        
        if (bestMatch && bestSimilarity >= 0.8) {
          matches.push({
            acessosId: acessos.id,
            acessosName: acessos.name,
            cazId: bestMatch.id,
            cazCnpj: bestMatch.cnpj,
            cazNome: bestMatch.nome,
            confidence: "medium",
            reason: `Similaridade alta (${Math.round(bestSimilarity * 100)}%)`
          });
          continue;
        }
        
        unmatchedAcessos.push(acessos);
      }
      
      for (const acessos of unmatchedAcessos) {
        let bestMatch = null;
        let bestSimilarity = 0;
        for (const caz of cazList) {
          const sim = similarity(acessos.core, caz.core);
          if (sim > bestSimilarity && sim >= 0.5 && sim < 0.8) {
            bestSimilarity = sim;
            bestMatch = caz;
          }
        }
        
        if (bestMatch && bestSimilarity >= 0.5) {
          matches.push({
            acessosId: acessos.id,
            acessosName: acessos.name,
            cazId: bestMatch.id,
            cazCnpj: bestMatch.cnpj,
            cazNome: bestMatch.nome,
            confidence: "low",
            reason: `Similaridade parcial (${Math.round(bestSimilarity * 100)}%)`
          });
        }
      }
      
      const confidenceOrder = { high: 0, medium: 1, low: 2 };
      matches.sort((a, b) => 
        (confidenceOrder[a.confidence as keyof typeof confidenceOrder] || 2) - 
        (confidenceOrder[b.confidence as keyof typeof confidenceOrder] || 2)
      );
      
      res.json({ matches });
    } catch (error) {
      console.error("[api] Error in AI matching:", error);
      res.status(500).json({ error: "Failed to run AI matching" });
    }
  });

  app.post("/api/acessos/apply-match", async (req, res) => {
    try {
      const { acessosId, cazCnpj, cupCnpj } = req.body;
      const cnpjToLink = cazCnpj || cupCnpj;
      
      if (!acessosId || !cnpjToLink) {
        return res.status(400).json({ error: "acessosId and cazCnpj are required" });
      }
      
      const result = await db.execute(sql`
        UPDATE cortex_core.clients 
        SET linked_client_cnpj = ${cnpjToLink},
            updated_at = NOW()
        WHERE id = ${acessosId}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      res.json({ success: true, client: mapClient(result.rows[0]) });
    } catch (error) {
      console.error("[api] Error applying match:", error);
      res.status(500).json({ error: "Failed to apply match" });
    }
  });

  app.get("/api/acessos/credentials-by-cnpj/:cnpj", async (req, res) => {
    try {
      const { cnpj } = req.params;
      const normalizedCnpj = cnpj.replace(/[^\d]/g, '');
      
      // Get the client name from caz_clientes for the aggregated display name
      const clientNameResult = await db.execute(sql`
        SELECT nome FROM "Conta Azul".caz_clientes 
        WHERE REGEXP_REPLACE(cnpj, '[^0-9]', '', 'g') = ${normalizedCnpj}
        LIMIT 1
      `);
      
      const cazClientName = (clientNameResult.rows[0] as any)?.nome || null;
      
      const result = await db.execute(sql`
        SELECT 
          c.id as client_id,
          c.name as client_name,
          cr.id as credential_id,
          cr.platform,
          cr.username,
          cr.password,
          cr.access_url,
          cr.observations
        FROM cortex_core.clients c
        INNER JOIN cortex_core.credentials cr ON c.id = cr.client_id
        WHERE REGEXP_REPLACE(c.linked_client_cnpj, '[^0-9]', '', 'g') = ${normalizedCnpj}
           OR LOWER(TRIM(c.name)) = (
             SELECT LOWER(TRIM(nome)) FROM "Conta Azul".caz_clientes 
             WHERE REGEXP_REPLACE(cnpj, '[^0-9]', '', 'g') = ${normalizedCnpj}
             LIMIT 1
           )
        ORDER BY cr.platform
      `);
      
      // Aggregate all credentials into a single group
      const allCredentials: any[] = [];
      const clientNames: string[] = [];
      
      for (const row of result.rows as any[]) {
        if (row.client_name && !clientNames.includes(row.client_name)) {
          clientNames.push(row.client_name);
        }
        if (row.credential_id) {
          allCredentials.push({
            id: row.credential_id,
            platform: row.platform,
            username: row.username,
            password: row.password,
            accessUrl: row.access_url,
            observations: row.observations
          });
        }
      }
      
      // Use stable ID based on normalized CNPJ for React keys
      // Use Conta Azul name if available, otherwise first alphabetically sorted client name
      const displayName = cazClientName || (clientNames.length > 0 ? clientNames.sort()[0] : 'Cliente');
      
      if (allCredentials.length > 0) {
        res.json([{
          id: `cnpj-${normalizedCnpj}`,
          name: displayName,
          credentials: allCredentials
        }]);
      } else {
        res.json([]);
      }
    } catch (error) {
      console.error("[api] Error fetching credentials by CNPJ:", error);
      res.status(500).json({ error: "Failed to fetch credentials" });
    }
  });

  app.delete("/api/acessos/clients/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verificar se o id é um UUID válido
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ error: "Invalid client ID format" });
      }
      
      await db.execute(sql`DELETE FROM cortex_core.credentials WHERE client_id::text = ${id}`);
      
      const result = await db.execute(sql`DELETE FROM cortex_core.clients WHERE id::text = ${id} RETURNING id`);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error deleting client:", error);
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  app.get("/api/acessos/credentials/:clientId", async (req, res) => {
    try {
      const { clientId } = req.params;
      
      // Verificar se o clientId é um UUID válido
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(clientId)) {
        return res.status(400).json({ error: "Invalid client ID format" });
      }
      
      const result = await db.execute(sql`
        SELECT * FROM cortex_core.credentials WHERE client_id::text = ${clientId} ORDER BY platform
      `);
      res.json(result.rows.map(mapCredential));
    } catch (error) {
      console.error("[api] Error fetching credentials:", error);
      res.status(500).json({ error: "Failed to fetch credentials" });
    }
  });

  app.post("/api/acessos/credentials", async (req, res) => {
    try {
      const { clientId, platform, username, password, accessUrl, observations } = req.body;
      
      if (!clientId || !platform) {
        return res.status(400).json({ error: "clientId and platform are required" });
      }
      
      // Verificar se o clientId é um UUID válido
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(clientId)) {
        return res.status(400).json({ error: "Invalid clientId format - must be a valid UUID" });
      }
      
      const result = await pool.query(
        `INSERT INTO cortex_core.credentials (client_id, platform, username, password, access_url, observations)
         VALUES ($1::uuid, $2, $3, $4, $5, $6)
         RETURNING *`,
        [clientId, platform, username || null, password || null, accessUrl || null, observations || null]
      );
      
      res.status(201).json(mapCredential(result.rows[0]));
    } catch (error) {
      console.error("[api] Error creating credential:", error);
      res.status(500).json({ error: "Failed to create credential" });
    }
  });

  app.patch("/api/acessos/credentials/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { platform, username, password, accessUrl, observations } = req.body;
      
      // Verificar se o id é um UUID válido
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ error: "Invalid credential ID format" });
      }
      
      const result = await db.execute(sql`
        UPDATE cortex_core.credentials 
        SET platform = COALESCE(${platform}, platform),
            username = COALESCE(${username}, username),
            password = COALESCE(${password}, password),
            access_url = COALESCE(${accessUrl}, access_url),
            observations = COALESCE(${observations}, observations),
            updated_at = NOW()
        WHERE id::text = ${id}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Credential not found" });
      }
      
      res.json(mapCredential(result.rows[0]));
    } catch (error) {
      console.error("[api] Error updating credential:", error);
      res.status(500).json({ error: "Failed to update credential" });
    }
  });

  app.delete("/api/acessos/credentials/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verificar se o id é um UUID válido
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ error: "Invalid credential ID format" });
      }
      
      const result = await db.execute(sql`DELETE FROM cortex_core.credentials WHERE id::text = ${id} RETURNING id`);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Credential not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error deleting credential:", error);
      res.status(500).json({ error: "Failed to delete credential" });
    }
  });
}
