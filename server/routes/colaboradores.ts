import type { Express } from "express";
import { sql } from "drizzle-orm";
import type { IStorage } from "../storage";
import { insertColaboradorSchema } from "@shared/schema";

function isAdmin(req: any, res: any, next: any) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: "Forbidden - Admin access required" });
  }
  next();
}

function isAuthenticated(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export function registerColaboradoresRoutes(app: Express, db: any, storage: IStorage) {
  app.get("/api/colaboradores", async (req, res) => {
    try {
      const colaboradores = await storage.getColaboradores();
      console.log(`[DEBUG] Colaboradores encontrados no banco: ${colaboradores.length} total, ${colaboradores.filter(c => c.status === 'Ativo').length} ativos`);
      res.json(colaboradores);
    } catch (error) {
      console.error("[api] Error fetching colaboradores:", error);
      res.status(500).json({ error: "Failed to fetch colaboradores" });
    }
  });

  // Exportar colaboradores em Excel ou CSV
  const exportarColaboradores = async (req: any, res: any) => {
    try {
      const formatoRaw = (req.body?.formato ?? req.query.formato) as string | undefined;
      const formato = formatoRaw === 'csv' ? 'csv' : 'xlsx';
      const XLSX = await import("xlsx");
      const formatDatePt = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString('pt-BR') : '';

      const exportColumns = [
        { key: "id", label: "ID", getValue: (c: any) => c.id },
        { key: "status", label: "Status", getValue: (c: any) => c.status },
        { key: "nome", label: "Nome", getValue: (c: any) => c.nome },
        { key: "cpf", label: "CPF", getValue: (c: any) => c.cpf },
        { key: "endereco", label: "Endereço", getValue: (c: any) => c.endereco },
        { key: "estado", label: "Estado", getValue: (c: any) => c.estado },
        { key: "telefone", label: "Telefone", getValue: (c: any) => c.telefone },
        { key: "aniversario", label: "Aniversário", getValue: (c: any) => formatDatePt(c.aniversario) },
        { key: "admissao", label: "Admissão", getValue: (c: any) => formatDatePt(c.admissao) },
        { key: "demissao", label: "Demissão", getValue: (c: any) => formatDatePt(c.demissao) },
        { key: "tipo_demissao", label: "Tipo Demissão", getValue: (c: any) => c.tipo_demissao },
        { key: "motivo_demissao", label: "Motivo Demissão", getValue: (c: any) => c.motivo_demissao },
        { key: "proporcional", label: "Proporcional", getValue: (c: any) => c.proporcional },
        { key: "proporcional_caju", label: "Proporcional Caju", getValue: (c: any) => c.proporcional_caju },
        { key: "setor", label: "Setor", getValue: (c: any) => c.setor },
        { key: "squad", label: "Squad", getValue: (c: any) => c.squad },
        { key: "cargo", label: "Cargo", getValue: (c: any) => c.cargo },
        { key: "nivel", label: "Nível", getValue: (c: any) => c.nivel },
        { key: "pix", label: "PIX", getValue: (c: any) => c.pix },
        { key: "cnpj", label: "CNPJ", getValue: (c: any) => c.cnpj },
        { key: "email_turbo", label: "Email Turbo", getValue: (c: any) => c.email_turbo },
        { key: "email_pessoal", label: "Email Pessoal", getValue: (c: any) => c.email_pessoal },
        { key: "meses_de_turbo", label: "Meses de Turbo", getValue: (c: any) => c.meses_de_turbo },
        { key: "ultimo_aumento", label: "Último Aumento", getValue: (c: any) => formatDatePt(c.ultimo_aumento) },
        { key: "meses_ult_aumento", label: "Meses Últ. Aumento", getValue: (c: any) => c.meses_ult_aumento },
        { key: "salario", label: "Salário", getValue: (c: any) => c.salario },
        { key: "user_id", label: "User ID", getValue: (c: any) => c.user_id },
      ];

      // Busca todos os colaboradores diretamente da tabela rh_pessoal (colunas reais)
      const result = await db.execute(sql`
        SELECT
          id,
          status,
          nome,
          cpf,
          endereco,
          estado,
          telefone,
          aniversario,
          admissao,
          demissao,
          tipo_demissao,
          motivo_demissao,
          proporcional,
          proporcional_caju,
          setor,
          squad,
          cargo,
          nivel,
          pix,
          cnpj,
          email_turbo,
          email_pessoal,
          meses_de_turbo,
          ultimo_aumento,
          meses_ult_aumento,
          salario,
          user_id
        FROM "Inhire".rh_pessoal
        ORDER BY nome
      `);

      const colaboradores = result.rows as any[];

      const rawQuery = req.originalUrl?.split("?")[1] ?? "";
      const searchParams = new URLSearchParams(rawQuery);
      const colunasFromUrl = searchParams.getAll("colunas").map((col: string) => col.trim()).filter(Boolean);

      const colunasParam = req.body?.colunas
        ?? (colunasFromUrl.length > 0 ? colunasFromUrl : req.query.colunas);

      const requestedKeys = Array.isArray(colunasParam)
        ? colunasParam.flatMap((col: string) => String(col).split(",")).map((col: string) => col.trim()).filter(Boolean)
        : typeof colunasParam === "string"
          ? colunasParam.split(",").map((col: string) => col.trim()).filter(Boolean)
          : [];
      const requestedSet = new Set(requestedKeys);
      const selectedColumns = requestedKeys.length > 0
        ? exportColumns.filter((col) => requestedSet.has(col.key))
        : exportColumns;

      if (requestedKeys.length > 0 && selectedColumns.length === 0) {
        return res.status(400).json({ error: "Nenhuma coluna válida selecionada" });
      }

      // Define os nomes das colunas em português
      const headers = selectedColumns.map((column) => column.label);

      // Mapeia os dados para formato de array
      const data = colaboradores.map((c) => selectedColumns.map((column) => column.getValue(c)));

      // Adiciona headers no início
      data.unshift(headers);

      // Cria a planilha
      const ws = XLSX.utils.aoa_to_sheet(data);

      // Define largura das colunas
      ws['!cols'] = headers.map(() => ({ wch: 20 }));

      // Cria o workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Colaboradores");

      const dataAtual = new Date().toISOString().split('T')[0];

      if (formato === 'csv') {
        // Gera CSV
        const csvContent = XLSX.utils.sheet_to_csv(ws, { FS: ';' });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=colaboradores_${dataAtual}.csv`);
        res.send('\uFEFF' + csvContent); // BOM para UTF-8 no Excel
      } else {
        // Gera Excel
        const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=colaboradores_${dataAtual}.xlsx`);
        res.send(excelBuffer);
      }

    } catch (error) {
      console.error("[api] Error exporting colaboradores:", error);
      res.status(500).json({ error: "Falha ao exportar colaboradores" });
    }
  };

  app.get("/api/colaboradores/exportar-excel", exportarColaboradores);
  app.post("/api/colaboradores/exportar-excel", exportarColaboradores);

  app.get("/api/colaboradores/by-user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;

      // Busca o usuário no banco de autenticação para pegar o email
      const { findUserById } = await import("../auth/userDb");
      const user = await findUserById(userId);

      if (!user || !user.email) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      // Busca o colaborador pelo email (email_turbo ou email_pessoal)
      const result = await db.execute(sql`
        SELECT id FROM "Inhire".rh_pessoal
        WHERE LOWER(email_turbo) = LOWER(${user.email})
           OR LOWER(email_pessoal) = LOWER(${user.email})
        LIMIT 1
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Colaborador não encontrado para este usuário" });
      }

      const colaboradorId = (result.rows[0] as any).id;
      res.json({ colaboradorId });
    } catch (error) {
      console.error("[api] Error fetching colaborador by userId:", error);
      res.status(500).json({ error: "Failed to fetch colaborador" });
    }
  });

  app.get("/api/colaboradores/com-patrimonios", async (req, res) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const status = req.query.status as string | undefined;
      const squad = req.query.squad as string | undefined;
      const setor = req.query.setor as string | undefined;
      const search = req.query.search as string | undefined;

      const result = await storage.getColaboradoresComPatrimonios({
        page,
        limit,
        status,
        squad,
        setor,
        search,
      });
      res.json(result);
    } catch (error) {
      console.error("[api] Error fetching colaboradores com patrimonios:", error);
      res.status(500).json({ error: "Failed to fetch colaboradores com patrimonios" });
    }
  });

  app.get("/api/colaboradores/analise", async (req, res) => {
    try {
      const analiseData = await storage.getColaboradoresAnalise();
      res.json(analiseData);
    } catch (error) {
      console.error("[api] Error fetching colaboradores analise:", error);
      res.status(500).json({ error: "Failed to fetch colaboradores analise" });
    }
  });

  app.get("/api/colaboradores/saude", async (req, res) => {
    try {
      const colaboradoresResult = await db.execute(sql`
        SELECT
          id, nome, cargo, squad, nivel, status,
          meses_de_turbo as "mesesDeTurbo",
          meses_ult_aumento as "mesesUltAumento",
          ultimo_aumento as "ultimoAumento",
          admissao
        FROM "Inhire".rh_pessoal
        WHERE status = 'Ativo'
        ORDER BY nome
      `);

      interface ColabRow {
        id: number;
        nome: string;
        cargo: string | null;
        squad: string | null;
        nivel: string | null;
        status: string | null;
        mesesDeTurbo: number | null;
        mesesUltAumento: number | null;
        ultimoAumento: string | null;
        admissao: string | null;
      }

      const colaboradores = colaboradoresResult.rows as unknown as ColabRow[];

      const healthData = colaboradores.map((colab) => {
        const reasons: string[] = [];

        const mesesTurbo = colab.mesesDeTurbo ?? 0;
        const mesesUltAumento = colab.mesesUltAumento;

        let stabilityScore = 0;
        if (colab.status === 'Ativo') stabilityScore += 15;

        if (mesesTurbo >= 6 && mesesTurbo <= 36) {
          stabilityScore += 15;
        } else if (mesesTurbo >= 3 && mesesTurbo < 6) {
          stabilityScore += 10;
          reasons.push('Período de adaptação (< 6 meses)');
        } else if (mesesTurbo < 3) {
          stabilityScore += 5;
          reasons.push('Recém-contratado (< 3 meses)');
        } else if (mesesTurbo > 36) {
          stabilityScore += 12;
        }

        let growthScore = 0;
        if (mesesUltAumento !== null) {
          if (mesesUltAumento <= 12) {
            growthScore = 25;
          } else if (mesesUltAumento <= 18) {
            growthScore = 18;
          } else if (mesesUltAumento <= 24) {
            growthScore = 10;
            reasons.push('Sem aumento há mais de 18 meses');
          } else {
            growthScore = 3;
            reasons.push('Sem aumento há mais de 24 meses');
          }
        } else {
          if (mesesTurbo <= 12) {
            growthScore = 20;
          } else {
            growthScore = 12;
            reasons.push('Sem registro de último aumento');
          }
        }

        let developmentScore = 0;
        const nivel = (colab.nivel || '').toLowerCase();
        if (nivel.includes('senior') || nivel.includes('sênior') || nivel.includes('lider') || nivel.includes('líder') || nivel.includes('head') || nivel.includes('diretor') || nivel.includes('c-level')) {
          developmentScore = 25;
        } else if (nivel.includes('pleno') || nivel.includes('mid')) {
          developmentScore = 20;
        } else if (nivel.includes('junior') || nivel.includes('júnior')) {
          developmentScore = 15;
        } else if (nivel.includes('estagiário') || nivel.includes('estagiario') || nivel.includes('trainee')) {
          developmentScore = 12;
        } else {
          developmentScore = 18;
        }

        let engagementScore = 15;

        if (mesesTurbo >= 60) {
          engagementScore = 25;
        } else if (mesesTurbo >= 48) {
          engagementScore = 23;
        } else if (mesesTurbo >= 36) {
          engagementScore = 22;
        } else if (mesesTurbo >= 24) {
          engagementScore = 20;
        } else if (mesesTurbo >= 12) {
          engagementScore = 18;
        } else if (mesesTurbo >= 6) {
          engagementScore = 15;
        } else {
          engagementScore = 12;
        }

        if (mesesTurbo > 36 && (mesesUltAumento === null || mesesUltAumento > 30)) {
          reasons.push('Veterano sem aumento há muito tempo - verificar reconhecimento');
        }

        const healthScore = stabilityScore + growthScore + developmentScore + engagementScore;

        let healthStatus: 'saudavel' | 'atencao' | 'critico';
        if (healthScore >= 70) {
          healthStatus = 'saudavel';
        } else if (healthScore >= 50) {
          healthStatus = 'atencao';
        } else {
          healthStatus = 'critico';
        }

        return {
          id: colab.id,
          nome: colab.nome,
          cargo: colab.cargo,
          squad: colab.squad,
          nivel: colab.nivel,
          healthScore,
          healthStatus,
          mesesDeTurbo: mesesTurbo,
          mesesUltAumento: mesesUltAumento,
          breakdown: {
            stability: stabilityScore,
            growth: growthScore,
            development: developmentScore,
            engagement: engagementScore,
          },
          reasons,
        };
      });

      res.json(healthData);
    } catch (error) {
      console.error("[api] Error fetching colaboradores saude:", error);
      res.status(500).json({ error: "Failed to fetch colaboradores saude" });
    }
  });

  // Endpoint para análises gerais com dados agregados
  app.get("/api/colaboradores/analise-geral", async (req, res) => {
    try {
      const colaboradoresResult = await db.execute(sql`
        SELECT
          id, nome, cargo, squad, nivel, status,
          meses_de_turbo as "mesesDeTurbo",
          meses_ult_aumento as "mesesUltAumento",
          salario,
          admissao
        FROM "Inhire".rh_pessoal
        WHERE status = 'Ativo'
        ORDER BY nome
      `);

      interface ColabAnalise {
        id: number;
        nome: string;
        cargo: string | null;
        squad: string | null;
        nivel: string | null;
        status: string;
        mesesDeTurbo: number | null;
        mesesUltAumento: number | null;
        salario: string | null;
        admissao: string | null;
      }

      const colaboradores = colaboradoresResult.rows as unknown as ColabAnalise[];

      // 1. Calcular saúde de cada colaborador para distribuição
      const healthDistribution = { saudavel: 0, atencao: 0, critico: 0 };

      colaboradores.forEach((colab) => {
        const mesesTurbo = colab.mesesDeTurbo ?? 0;
        const mesesUltAumento = colab.mesesUltAumento;
        const nivel = (colab.nivel || '').toLowerCase();

        let stabilityScore = 15;
        if (mesesTurbo >= 6 && mesesTurbo <= 36) {
          stabilityScore += 15;
        } else if (mesesTurbo >= 3 && mesesTurbo < 6) {
          stabilityScore += 10;
        } else if (mesesTurbo < 3) {
          stabilityScore += 5;
        } else if (mesesTurbo > 36) {
          stabilityScore += 12;
        }

        let growthScore = 0;
        if (mesesUltAumento !== null && mesesUltAumento !== undefined) {
          if (mesesUltAumento <= 12) {
            growthScore = 25;
          } else if (mesesUltAumento <= 18) {
            growthScore = 18;
          } else if (mesesUltAumento <= 24) {
            growthScore = 10;
          } else {
            growthScore = 3;
          }
        } else {
          growthScore = mesesTurbo <= 12 ? 20 : 12;
        }

        let developmentScore = 18;
        if (nivel.includes('senior') || nivel.includes('sênior') || nivel.includes('lider') || nivel.includes('líder') || nivel.includes('head') || nivel.includes('diretor')) {
          developmentScore = 25;
        } else if (nivel.includes('pleno')) {
          developmentScore = 20;
        } else if (nivel.includes('junior') || nivel.includes('júnior')) {
          developmentScore = 15;
        } else if (nivel.includes('estagiário') || nivel.includes('trainee')) {
          developmentScore = 12;
        }

        let engagementScore = 15;
        if (mesesTurbo >= 60) {
          engagementScore = 25;
        } else if (mesesTurbo >= 48) {
          engagementScore = 23;
        } else if (mesesTurbo >= 36) {
          engagementScore = 22;
        } else if (mesesTurbo >= 24) {
          engagementScore = 20;
        } else if (mesesTurbo >= 12) {
          engagementScore = 18;
        } else if (mesesTurbo >= 6) {
          engagementScore = 15;
        } else {
          engagementScore = 12;
        }

        const healthScore = stabilityScore + growthScore + developmentScore + engagementScore;

        if (healthScore >= 70) {
          healthDistribution.saudavel++;
        } else if (healthScore >= 50) {
          healthDistribution.atencao++;
        } else {
          healthDistribution.critico++;
        }
      });

      // 2. Headcount por Squad
      const headcountBySquad: Record<string, number> = {};
      colaboradores.forEach((colab) => {
        const squad = colab.squad || 'Sem Squad';
        headcountBySquad[squad] = (headcountBySquad[squad] || 0) + 1;
      });

      // 3. Distribuição por Nível
      const nivelDistribution: Record<string, number> = {};
      colaboradores.forEach((colab) => {
        const nivel = colab.nivel || 'Não definido';
        nivelDistribution[nivel] = (nivelDistribution[nivel] || 0) + 1;
      });

      // 4. Salário por Tempo de Casa (faixas)
      const salarioByTempo: Record<string, { total: number; count: number; avg: number }> = {
        '0-6 meses': { total: 0, count: 0, avg: 0 },
        '6-12 meses': { total: 0, count: 0, avg: 0 },
        '1-2 anos': { total: 0, count: 0, avg: 0 },
        '2-3 anos': { total: 0, count: 0, avg: 0 },
        '3-5 anos': { total: 0, count: 0, avg: 0 },
        '+5 anos': { total: 0, count: 0, avg: 0 },
      };

      colaboradores.forEach((colab) => {
        const meses = colab.mesesDeTurbo ?? 0;
        const salario = parseFloat(colab.salario || '0') || 0;

        let faixa = '0-6 meses';
        if (meses >= 60) faixa = '+5 anos';
        else if (meses >= 36) faixa = '3-5 anos';
        else if (meses >= 24) faixa = '2-3 anos';
        else if (meses >= 12) faixa = '1-2 anos';
        else if (meses >= 6) faixa = '6-12 meses';

        if (salario > 0) {
          salarioByTempo[faixa].total += salario;
          salarioByTempo[faixa].count++;
        }
      });

      // Calcular médias
      Object.keys(salarioByTempo).forEach((faixa) => {
        const data = salarioByTempo[faixa];
        data.avg = data.count > 0 ? Math.round(data.total / data.count) : 0;
      });

      // 5. Média salarial por Squad
      const salarioBySquad: Record<string, { total: number; count: number; avg: number }> = {};
      colaboradores.forEach((colab) => {
        const squad = colab.squad || 'Sem Squad';
        const salario = parseFloat(colab.salario || '0') || 0;

        if (!salarioBySquad[squad]) {
          salarioBySquad[squad] = { total: 0, count: 0, avg: 0 };
        }

        if (salario > 0) {
          salarioBySquad[squad].total += salario;
          salarioBySquad[squad].count++;
        }
      });

      Object.keys(salarioBySquad).forEach((squad) => {
        const data = salarioBySquad[squad];
        data.avg = data.count > 0 ? Math.round(data.total / data.count) : 0;
      });

      // 6. Tempo médio por Squad
      const tempoBySquad: Record<string, { total: number; count: number; avg: number }> = {};
      colaboradores.forEach((colab) => {
        const squad = colab.squad || 'Sem Squad';
        const meses = colab.mesesDeTurbo ?? 0;

        if (!tempoBySquad[squad]) {
          tempoBySquad[squad] = { total: 0, count: 0, avg: 0 };
        }

        tempoBySquad[squad].total += meses;
        tempoBySquad[squad].count++;
      });

      Object.keys(tempoBySquad).forEach((squad) => {
        const data = tempoBySquad[squad];
        data.avg = data.count > 0 ? Math.round((data.total / data.count) * 10) / 10 : 0;
      });

      // 7. Estatísticas gerais
      const totalColaboradores = colaboradores.length;
      const salarios = colaboradores.map(c => parseFloat(c.salario || '0')).filter(s => s > 0);
      const salarioMedio = salarios.length > 0 ? Math.round(salarios.reduce((a, b) => a + b, 0) / salarios.length) : 0;
      const tempoMedio = colaboradores.reduce((acc, c) => acc + (c.mesesDeTurbo ?? 0), 0) / (totalColaboradores || 1);

      res.json({
        healthDistribution,
        headcountBySquad,
        nivelDistribution,
        salarioByTempo,
        salarioBySquad,
        tempoBySquad,
        estatisticas: {
          totalColaboradores,
          salarioMedio,
          tempoMedioMeses: Math.round(tempoMedio * 10) / 10,
        },
      });
    } catch (error) {
      console.error("[api] Error fetching analise geral:", error);
      res.status(500).json({ error: "Failed to fetch analise geral" });
    }
  });

  app.get("/api/colaboradores/dropdown", async (req, res) => {
    try {
      const colaboradores = await storage.getColaboradoresDropdown();
      res.json(colaboradores);
    } catch (error) {
      console.error("[api] Error fetching colaboradores dropdown:", error);
      res.status(500).json({ error: "Failed to fetch colaboradores" });
    }
  });

  app.get("/api/colaboradores/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID" });
      }

      const result = await db.execute(sql`
        SELECT
          c.*,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', p.id,
                'numeroAtivo', p.numero_ativo,
                'descricao', p.descricao,
                'ativo', p.ativo,
                'marca', p.marca,
                'estadoConservacao', p.estado_conservacao,
                'valorMercado', p.valor_mercado
              )
            ) FILTER (WHERE p.id IS NOT NULL),
            '[]'
          ) as patrimonios
        FROM "Inhire".rh_pessoal c
        LEFT JOIN "Inhire".rh_patrimonio p ON (p.responsavel_id = c.id OR (p.responsavel_id IS NULL AND p.responsavel_atual = c.nome))
        WHERE c.id = ${id}
        GROUP BY c.id
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Colaborador not found" });
      }

      const row = result.rows[0] as any;

      // Fetch promotion history (gracefully handle missing table)
      let promocoesResult = { rows: [] as any[] };
      try {
        promocoesResult = await db.execute(sql`
          SELECT
            id,
            colaborador_id as "colaboradorId",
            data_promocao as "dataPromocao",
            cargo_anterior as "cargoAnterior",
            cargo_novo as "cargoNovo",
            nivel_anterior as "nivelAnterior",
            nivel_novo as "nivelNovo",
            salario_anterior as "salarioAnterior",
            salario_novo as "salarioNovo",
            observacoes,
            criado_em as "criadoEm",
            criado_por as "criadoPor"
          FROM "Inhire".rh_promocoes
          WHERE colaborador_id = ${id}
          ORDER BY data_promocao DESC
        `);
      } catch (promoError: any) {
        // Table doesn't exist - continue with empty array
        if (promoError?.code !== '42P01') {
          console.error("[api] Error fetching promocoes:", promoError);
        }
      }

      // Fetch linked user info - first by user_id, then by emailTurbo
      let linkedUser = null;
      if (row.user_id) {
        const userResult = await db.execute(sql`
          SELECT id, email, name, picture, role
          FROM cortex_core.auth_users
          WHERE id = ${row.user_id}
        `);
        if (userResult.rows.length > 0) {
          linkedUser = userResult.rows[0];
        }
      }
      // If no linkedUser found by user_id, try to find by emailTurbo
      if (!linkedUser && row.email_turbo) {
        const emailNormalized = row.email_turbo.toLowerCase().trim();
        const userByEmailResult = await db.execute(sql`
          SELECT id, email, name, picture, role
          FROM cortex_core.auth_users
          WHERE LOWER(TRIM(email)) = ${emailNormalized}
        `);
        if (userByEmailResult.rows.length > 0) {
          linkedUser = userByEmailResult.rows[0];
        }
      }

      const colaborador = {
        id: row.id,
        status: row.status,
        nome: row.nome,
        cpf: row.cpf,
        endereco: row.endereco,
        estado: row.estado,
        cidade: row.cidade,
        telefone: row.telefone,
        aniversario: row.aniversario,
        admissao: row.admissao,
        demissao: row.demissao,
        tipoDemissao: row.tipo_demissao,
        motivoDemissao: row.motivo_demissao,
        proporcional: row.proporcional,
        proporcionalCaju: row.proporcional_caju,
        setor: row.setor,
        squad: row.squad,
        cargo: row.cargo,
        nivel: row.nivel,
        pix: row.pix,
        cnpj: row.cnpj,
        emailTurbo: row.email_turbo,
        emailPessoal: row.email_pessoal,
        mesesDeTurbo: row.meses_de_turbo,
        ultimoAumento: row.ultimo_aumento,
        mesesUltAumento: row.meses_ult_aumento,
        salario: row.salario,
        userId: row.user_id,
        patrimonios: row.patrimonios || [],
        promocoes: promocoesResult.rows || [],
        linkedUser: linkedUser,
      };

      res.json(colaborador);
    } catch (error) {
      console.error("[api] Error fetching colaborador by id:", error);
      res.status(500).json({ error: "Failed to fetch colaborador" });
    }
  });

  app.post("/api/colaboradores", async (req, res) => {
    try {
      const validation = insertColaboradorSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error });
      }
      const novoColaborador = await storage.createColaborador(validation.data);
      res.status(201).json(novoColaborador);
    } catch (error) {
      console.error("[api] Error creating colaborador:", error);
      res.status(500).json({ error: "Failed to create colaborador" });
    }
  });

  app.patch("/api/colaboradores/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID" });
      }
      const validation = insertColaboradorSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error });
      }
      const user = req.user as { email?: string } | undefined;
      const criadoPor = user?.email || 'Sistema';
      const colaboradorAtualizado = await storage.updateColaborador(id, validation.data, criadoPor);
      res.json(colaboradorAtualizado);
    } catch (error) {
      console.error("[api] Error updating colaborador:", error);
      res.status(500).json({ error: "Failed to update colaborador" });
    }
  });

  app.delete("/api/colaboradores/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID" });
      }
      await storage.deleteColaborador(id);
      res.status(204).send();
    } catch (error) {
      console.error("[api] Error deleting colaborador:", error);
      res.status(500).json({ error: "Failed to delete colaborador" });
    }
  });

  app.get("/api/colaboradores/:id/health-history", async (req, res) => {
    try {
      const colaboradorId = parseInt(req.params.id);
      if (isNaN(colaboradorId)) {
        return res.status(400).json({ error: "Invalid colaborador ID" });
      }

      const now = new Date();
      const months: { month: string; endDate: Date }[] = [];

      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
        const monthLabel = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        months.push({ month: monthLabel, endDate: endOfMonth });
      }

      const healthHistory = await Promise.all(months.map(async ({ month, endDate }) => {
        const endDateStr = endDate.toISOString().split('T')[0];

        let enpsScore = 0;
        try {
          const enpsResult = await db.execute(sql`
            SELECT score FROM "Inhire".rh_enps
            WHERE colaborador_id = ${colaboradorId}
              AND data <= ${endDateStr}
            ORDER BY data DESC LIMIT 1
          `);
          if (enpsResult.rows.length > 0) {
            const score = (enpsResult.rows[0] as { score: number }).score;
            if (score >= 9) enpsScore = 30;
            else if (score >= 7) enpsScore = 20;
            else if (score >= 5) enpsScore = 10;
          }
        } catch (e) { }

        let oneOnOneScore = 0;
        try {
          const oneOnOneResult = await db.execute(sql`
            SELECT data FROM "Inhire".rh_one_on_one
            WHERE colaborador_id = ${colaboradorId}
              AND data <= ${endDateStr}
            ORDER BY data DESC LIMIT 1
          `);
          if (oneOnOneResult.rows.length > 0) {
            const lastDate = new Date((oneOnOneResult.rows[0] as { data: string }).data);
            const daysDiff = Math.floor((endDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff <= 14) oneOnOneScore = 25;
            else if (daysDiff <= 30) oneOnOneScore = 15;
            else if (daysDiff <= 45) oneOnOneScore = 5;
          }
        } catch (e) { }

        let pdiScore = 0;
        try {
          const pdiResult = await db.execute(sql`
            SELECT AVG(progresso) as avg_progress FROM "Inhire".rh_pdi
            WHERE colaborador_id = ${colaboradorId}
              AND (criado_em IS NULL OR criado_em <= ${endDateStr})
          `);
          if (pdiResult.rows.length > 0 && (pdiResult.rows[0] as any).avg_progress !== null) {
            const avgProgress = parseFloat((pdiResult.rows[0] as any).avg_progress) || 0;
            pdiScore = Math.round((avgProgress / 100) * 25);
          }
        } catch (e) { }

        let pendingActionsScore = 20;
        try {
          const actionsResult = await db.execute(sql`
            SELECT COUNT(*) as count FROM "Inhire".rh_one_on_one_acoes a
            JOIN "Inhire".rh_one_on_one o ON a.one_on_one_id = o.id
            WHERE o.colaborador_id = ${colaboradorId}
              AND o.data <= ${endDateStr}
              AND (a.status IS NULL OR a.status != 'concluida')
              AND (a.concluida_em IS NULL OR a.concluida_em > ${endDateStr})
          `);
          if (actionsResult.rows.length > 0) {
            const count = parseInt((actionsResult.rows[0] as any).count) || 0;
            if (count === 0) pendingActionsScore = 20;
            else if (count <= 2) pendingActionsScore = 15;
            else if (count <= 5) pendingActionsScore = 10;
            else if (count <= 8) pendingActionsScore = 5;
            else pendingActionsScore = 0;
          }
        } catch (e) { }

        const healthScore = enpsScore + oneOnOneScore + pdiScore + pendingActionsScore;

        return { month, healthScore };
      }));

      res.json(healthHistory);
    } catch (error) {
      console.error("[api] Error fetching health history:", error);
      res.status(500).json({ error: "Failed to fetch health history" });
    }
  });

  // Endpoint para importar datas de último aumento em batch
  app.post("/api/colaboradores/import-ultimo-aumento", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { data } = req.body as { data: { nome: string; ultimoAumento: string | null }[] };

      if (!data || !Array.isArray(data)) {
        return res.status(400).json({ error: "Invalid data format. Expected { data: [{nome, ultimoAumento}] }" });
      }

      const colaboradores = await storage.getColaboradores();
      const results: { nome: string; status: string; error?: string }[] = [];

      for (const item of data) {
        const nome = item.nome?.trim();
        const ultimoAumentoStr = item.ultimoAumento?.trim();

        if (!nome) {
          results.push({ nome: item.nome || "unknown", status: "skipped", error: "Nome vazio" });
          continue;
        }

        // Encontrar colaborador por nome (match parcial ou exato)
        const colaborador = colaboradores.find(c =>
          c.nome?.toLowerCase().trim() === nome.toLowerCase()
        );

        if (!colaborador) {
          results.push({ nome, status: "not_found", error: "Colaborador não encontrado" });
          continue;
        }

        // Se não tem data de último aumento, pular
        if (!ultimoAumentoStr || ultimoAumentoStr === "-") {
          results.push({ nome, status: "skipped", error: "Sem data de último aumento" });
          continue;
        }

        try {
          // Converter data de DD/MM/YY para YYYY-MM-DD
          const parts = ultimoAumentoStr.split("/");
          if (parts.length !== 3) {
            results.push({ nome, status: "error", error: `Formato de data inválido: ${ultimoAumentoStr}` });
            continue;
          }

          const day = parts[0].padStart(2, "0");
          const month = parts[1].padStart(2, "0");
          let year = parts[2];

          // Converter ano de 2 dígitos para 4 dígitos
          if (year.length === 2) {
            year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
          }

          const ultimoAumentoDate = `${year}-${month}-${day}`;

          await storage.updateColaborador(colaborador.id, {
            ultimoAumento: ultimoAumentoDate
          });

          results.push({ nome, status: "updated" });
        } catch (error) {
          results.push({ nome, status: "error", error: String(error) });
        }
      }

      const updated = results.filter(r => r.status === "updated").length;
      const notFound = results.filter(r => r.status === "not_found").length;
      const skipped = results.filter(r => r.status === "skipped").length;
      const errors = results.filter(r => r.status === "error").length;

      res.json({
        summary: { total: data.length, updated, notFound, skipped, errors },
        details: results
      });
    } catch (error) {
      console.error("[api] Error importing ultimo aumento:", error);
      res.status(500).json({ error: "Failed to import ultimo aumento data" });
    }
  });
}
