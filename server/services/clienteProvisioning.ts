// server/services/clienteProvisioning.ts
import { db } from "../db";
import { sql } from "drizzle-orm";

interface ProvisioningContext {
  contratoId: number;
  userId: string;
  userName: string;
}

/**
 * Provisions a client record when a contract is activated.
 * Fire-and-forget: logs errors but never throws.
 */
export async function provisionClienteFromContrato(ctx: ProvisioningContext): Promise<void> {
  try {
    // 1. Fetch contrato + entidade data
    const contratoResult = await db.execute(sql`
      SELECT c.id, c.numero_contrato, c.entidade_id,
             e.cpf_cnpj, e.nome, e.email, e.telefone
      FROM staging.contratos c
      LEFT JOIN staging.entidades e ON e.id = c.entidade_id
      WHERE c.id = ${ctx.contratoId}
    `);

    if (contratoResult.rows.length === 0) {
      console.warn("[card-auto] Contrato not found:", ctx.contratoId);
      return;
    }

    const contrato = contratoResult.rows[0] as any;
    const cnpj = contrato.cpf_cnpj;

    if (!cnpj) {
      console.warn("[card-auto] No CNPJ found for contrato:", ctx.contratoId);
      return;
    }

    // 2. Find least-loaded CS
    const csResult = await db.execute(sql`
      WITH cs_roster AS (
        SELECT DISTINCT responsavel
        FROM "Clickup".cup_clientes
        WHERE responsavel IS NOT NULL
          AND responsavel != ''
      ),
      cs_carga AS (
        SELECT r.responsavel,
               COUNT(c.cnpj) as carga
        FROM cs_roster r
        LEFT JOIN "Clickup".cup_clientes c
          ON c.responsavel = r.responsavel
          AND c.status IN ('ativo', 'onboarding', 'triagem')
        GROUP BY r.responsavel
        ORDER BY carga ASC
        LIMIT 1
      )
      SELECT responsavel FROM cs_carga
    `);

    const csResponsavel = csResult.rows.length > 0 ? (csResult.rows[0] as any).responsavel : null;

    if (!csResponsavel) {
      console.warn("[card-auto] No CS found for round-robin, assigning NULL");
    }

    // 3. Upsert into cup_clientes
    const entidadeId = contrato.entidade_id;
    if (!entidadeId) {
      console.warn("[card-auto] No entidade_id for contrato:", ctx.contratoId);
      return;
    }
    const taskId = `cortex-ent-${entidadeId}`;
    const nome = contrato.nome;
    if (!nome) {
      console.warn("[card-auto] No nome found for entidade of contrato:", ctx.contratoId);
      return;
    }

    await db.execute(sql`
      INSERT INTO "Clickup".cup_clientes (cnpj, nome, status, responsavel, email, telefone, task_id, site)
      VALUES (
        ${cnpj},
        ${nome},
        'onboarding',
        ${csResponsavel},
        ${contrato.email},
        ${contrato.telefone},
        ${taskId},
        ${null}
      )
      ON CONFLICT (cnpj) DO UPDATE SET
        status = 'onboarding',
        responsavel = ${csResponsavel},
        email = COALESCE("Clickup".cup_clientes.email, EXCLUDED.email),
        telefone = COALESCE("Clickup".cup_clientes.telefone, EXCLUDED.telefone),
        nome = COALESCE("Clickup".cup_clientes.nome, EXCLUDED.nome),
        task_id = COALESCE("Clickup".cup_clientes.task_id, EXCLUDED.task_id)
    `);

    // 4. Fetch contract items for event details
    const itensResult = await db.execute(sql`
      SELECT ci.contrato_id,
             COALESCE(s.nome, ps.nome, 'Servico') as servico_nome,
             ci.valor_final
      FROM staging.contratos_itens ci
      LEFT JOIN staging.planos_servicos ps ON ps.id = ci.plano_servico_id
      LEFT JOIN staging.servicos s ON s.id = ps.servico_id
      WHERE ci.contrato_id = ${ctx.contratoId}
    `);

    const servicos = itensResult.rows.map((r: any) => r.servico_nome);
    const valorTotal = itensResult.rows.reduce((sum: number, r: any) => sum + (parseFloat(r.valor_final) || 0), 0);

    // 5. Create timeline event
    const dadosExtras = JSON.stringify({
      contrato_id: ctx.contratoId,
      numero_contrato: contrato.numero_contrato,
      cs_atribuido: csResponsavel,
      servicos,
      valor_total: valorTotal
    });

    await db.execute(sql`
      INSERT INTO cliente_eventos (cliente_cnpj, tipo, titulo, descricao, usuario_id, usuario_nome, dados_extras)
      VALUES (
        ${cnpj},
        'contrato_ativado',
        'Novo contrato ativado',
        ${`Contrato #${contrato.numero_contrato} ativado. CS: ${csResponsavel || 'Nao atribuido'}. Servicos: ${servicos.join(', ')}`},
        ${ctx.userId},
        ${ctx.userName},
        ${dadosExtras}
      )
    `);

    console.log(`[card-auto] Cliente ${cnpj} provisionado com sucesso. CS: ${csResponsavel}`);
  } catch (error) {
    console.error("[card-auto] Erro no provisioning:", error);
    // Fire-and-forget: never throw
  }
}
