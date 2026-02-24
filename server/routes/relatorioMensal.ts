import type { Express } from "express";
import { sql } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as path from "path";
import * as fs from "fs";

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function registerRelatorioMensalRoutes(app: Express, db: any) {

  app.get("/api/relatorio-mensal/pdf", async (req, res) => {
    try {
      const mesParam = req.query.mes as string; // YYYY-MM
      if (!mesParam || !/^\d{4}-\d{2}$/.test(mesParam)) {
        return res.status(400).json({ error: "Parâmetro 'mes' inválido. Use formato YYYY-MM." });
      }

      const [yearStr, monthStr] = mesParam.split("-");
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);

      if (month < 1 || month > 12) {
        return res.status(400).json({ error: "Mês inválido." });
      }

      const mesInicio = `${mesParam}-01`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const mesFim = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

      const now = new Date();
      const isCurrentMonth = year === now.getFullYear() && month === (now.getMonth() + 1);
      const mesLabel = `${MESES_PT[month - 1]} ${year}`;

      // ===== 1. MRR =====
      let mrrAtual = 0;
      let mrrAnterior = 0;

      if (isCurrentMonth) {
        const mrrResult = await db.execute(sql`
          SELECT COALESCE(SUM(valorr::numeric), 0) as mrr
          FROM "Clickup".cup_contratos
          WHERE status IN ('ativo', 'onboarding', 'triagem')
        `);
        mrrAtual = parseFloat((mrrResult.rows[0] as any)?.mrr || "0");
      } else {
        const mrrResult = await db.execute(sql`
          SELECT COALESCE(SUM(valorr::numeric), 0) as mrr
          FROM "Clickup".cup_data_hist
          WHERE snapshot_date = (
            SELECT MAX(snapshot_date) FROM "Clickup".cup_data_hist
            WHERE snapshot_date >= ${mesInicio}::date AND snapshot_date < ${mesFim}::date
          )
          AND status IN ('ativo', 'onboarding', 'triagem')
        `);
        mrrAtual = parseFloat((mrrResult.rows[0] as any)?.mrr || "0");
      }

      // MRR mês anterior
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const prevMesInicio = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;

      const mrrPrevResult = await db.execute(sql`
        SELECT COALESCE(SUM(valorr::numeric), 0) as mrr
        FROM "Clickup".cup_data_hist
        WHERE snapshot_date = (
          SELECT MAX(snapshot_date) FROM "Clickup".cup_data_hist
          WHERE snapshot_date >= ${prevMesInicio}::date AND snapshot_date < ${mesInicio}::date
        )
        AND status IN ('ativo', 'onboarding', 'triagem')
      `);
      mrrAnterior = parseFloat((mrrPrevResult.rows[0] as any)?.mrr || "0");

      // ===== 2. Projetos pontuais entregues =====
      const projetosResult = await db.execute(sql`
        SELECT
          COUNT(*) as quantidade,
          COALESCE(SUM(valor_p::numeric), 0) as valor
        FROM "Clickup".cup_projetos_tech_fechados
        WHERE lancamento >= ${mesInicio}::date AND lancamento < ${mesFim}::date
      `);
      const projetosQtd = parseInt((projetosResult.rows[0] as any)?.quantidade || "0");
      const projetosValor = parseFloat((projetosResult.rows[0] as any)?.valor || "0");

      // ===== 3. Faturamento (valor_bruto) =====
      const faturamentoResult = await db.execute(sql`
        SELECT COALESCE(SUM(valor_bruto::numeric), 0) as faturamento
        FROM "Conta Azul".caz_parcelas
        WHERE tipo_evento = 'RECEITA'
          AND data_vencimento >= ${mesInicio}::date AND data_vencimento < ${mesFim}::date
      `);
      const faturamento = parseFloat((faturamentoResult.rows[0] as any)?.faturamento || "0");

      // ===== 4. Vendas (Bitrix CRM) =====
      const vendasResult = await db.execute(sql`
        SELECT
          COALESCE(SUM(valor_recorrente::numeric), 0) as vendas_recorrente,
          COALESCE(SUM(valor_pontual::numeric), 0) as vendas_pontual
        FROM "Bitrix".crm_deal
        WHERE stage_name = 'Negócio Ganho'
          AND data_fechamento >= ${mesInicio}::date AND data_fechamento < ${mesFim}::date
      `);
      const vendasRecorrente = parseFloat((vendasResult.rows[0] as any)?.vendas_recorrente || "0");
      const vendasPontual = parseFloat((vendasResult.rows[0] as any)?.vendas_pontual || "0");
      const vendasTotal = vendasRecorrente + vendasPontual;

      // ===== 5 & 6. Margem Bruta & EBITDA =====
      // Receita Líquida = receita quitada - impostos (05.05%)
      const receitaResult = await db.execute(sql`
        SELECT
          COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' AND status = 'QUITADO'
            THEN valor_pago::numeric ELSE 0 END), 0) as receita_quitada,
          COALESCE(SUM(CASE WHEN tipo_evento = 'DESPESA' AND categoria_nome LIKE '05.05%' AND status = 'QUITADO'
            THEN valor_pago::numeric ELSE 0 END), 0) as impostos
        FROM "Conta Azul".caz_parcelas
        WHERE data_quitacao::date >= ${mesInicio}::date AND data_quitacao::date < ${mesFim}::date
      `);
      const receitaQuitada = parseFloat((receitaResult.rows[0] as any)?.receita_quitada || "0");
      const impostos = parseFloat((receitaResult.rows[0] as any)?.impostos || "0");
      const receitaLiquida = receitaQuitada - impostos;

      // CSV, CAC, SG&A
      const custosResult = await db.execute(sql`
        SELECT
          COALESCE(SUM(CASE WHEN categoria_nome LIKE '06.%' AND categoria_nome NOT LIKE '06.13%'
            THEN valor_pago::numeric ELSE 0 END), 0) as csv,
          COALESCE(SUM(CASE WHEN (categoria_nome LIKE '06.03%' OR categoria_nome LIKE '06.04%')
            THEN valor_pago::numeric ELSE 0 END), 0) as cac,
          COALESCE(SUM(CASE WHEN (categoria_nome LIKE '06.10%' OR categoria_nome LIKE '06.11%' OR categoria_nome LIKE '06.12%')
            THEN valor_pago::numeric ELSE 0 END), 0) as sga
        FROM "Conta Azul".caz_parcelas
        WHERE status = 'QUITADO'
          AND data_quitacao::date >= ${mesInicio}::date AND data_quitacao::date < ${mesFim}::date
      `);
      const csvTotal = parseFloat((custosResult.rows[0] as any)?.csv || "0");
      const cacTotal = parseFloat((custosResult.rows[0] as any)?.cac || "0");
      const sgaTotal = parseFloat((custosResult.rows[0] as any)?.sga || "0");

      const margemBruta = receitaLiquida - csvTotal;
      const ebitda = margemBruta - cacTotal - sgaTotal;

      // ===== 7. Churn Receita =====
      const churnResult = await db.execute(sql`
        SELECT COALESCE(SUM(valorr::numeric), 0) as churn_mrr
        FROM "Clickup".cup_contratos
        WHERE data_solicitacao_encerramento >= ${mesInicio}::date
          AND data_solicitacao_encerramento < ${mesFim}::date
      `);
      const churnMrr = parseFloat((churnResult.rows[0] as any)?.churn_mrr || "0");

      // ===== 8. Inadimplência =====
      const inadResult = await db.execute(sql`
        SELECT
          COALESCE(SUM(CASE WHEN data_vencimento < ${mesFim}::date AND nao_pago::numeric > 0
            THEN nao_pago::numeric ELSE 0 END), 0) as total_inadimplencia,
          COALESCE(SUM(CASE WHEN data_vencimento >= ${mesInicio}::date AND data_vencimento < ${mesFim}::date AND nao_pago::numeric > 0
            THEN nao_pago::numeric ELSE 0 END), 0) as inadimplencia_mes
        FROM "Conta Azul".caz_parcelas
        WHERE tipo_evento = 'RECEITA'
      `);
      const inadTotal = parseFloat((inadResult.rows[0] as any)?.total_inadimplencia || "0");
      const inadMes = parseFloat((inadResult.rows[0] as any)?.inadimplencia_mes || "0");

      // ===== 9. Caixa =====
      let saldoCaixa = 0;
      if (isCurrentMonth) {
        const caixaResult = await db.execute(sql`
          SELECT COALESCE(SUM(balance::numeric), 0) as saldo
          FROM "Conta Azul".caz_bancos
        `);
        saldoCaixa = parseFloat((caixaResult.rows[0] as any)?.saldo || "0");
      } else {
        const snapshotResult = await db.execute(sql`
          SELECT metricas FROM cortex_core.bp_snapshots
          WHERE mes_ano = ${mesParam}
          LIMIT 1
        `);
        if (snapshotResult.rows.length > 0) {
          const metricas = typeof (snapshotResult.rows[0] as any).metricas === 'string'
            ? JSON.parse((snapshotResult.rows[0] as any).metricas)
            : (snapshotResult.rows[0] as any).metricas;
          saldoCaixa = metricas?.cash_balance || 0;
        }
      }

      // ===== 10. Faturamento por pessoa =====
      let headcount = 0;
      if (isCurrentMonth) {
        const hcResult = await db.execute(sql`
          SELECT COUNT(*) as total FROM "Inhire".rh_pessoal WHERE status = 'Ativo'
        `);
        headcount = parseInt((hcResult.rows[0] as any)?.total || "0");
      } else {
        const snapshotResult = await db.execute(sql`
          SELECT metricas FROM cortex_core.bp_snapshots
          WHERE mes_ano = ${mesParam}
          LIMIT 1
        `);
        if (snapshotResult.rows.length > 0) {
          const metricas = typeof (snapshotResult.rows[0] as any).metricas === 'string'
            ? JSON.parse((snapshotResult.rows[0] as any).metricas)
            : (snapshotResult.rows[0] as any).metricas;
          headcount = metricas?.headcount_total || 0;
        }
        if (!headcount) {
          const hcResult = await db.execute(sql`
            SELECT COUNT(*) as total FROM "Inhire".rh_pessoal WHERE status = 'Ativo'
          `);
          headcount = parseInt((hcResult.rows[0] as any)?.total || "0");
        }
      }
      const faturamentoPorPessoa = headcount > 0 ? faturamento / headcount : 0;

      // ===== 11. Health Score =====
      const hsResult = await db.execute(sql`
        SELECT COALESCE(AVG(score::numeric), 0) as media_hs
        FROM "Inhire".rh_health_scores
        WHERE data >= ${mesInicio}::date AND data < ${mesFim}::date
      `);
      const mediaHS = parseFloat((hsResult.rows[0] as any)?.media_hs || "0");

      // ===== FORMAT HELPERS =====
      const fmtCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

      const fmtShort = (value: number) => {
        if (Math.abs(value) >= 1000000) return `R$ ${(value / 1000000).toFixed(2)}M`;
        if (Math.abs(value) >= 1000) return `R$ ${(value / 1000).toFixed(1)}K`;
        return fmtCurrency(value);
      };

      // ===== GENERATE PDF =====
      const doc = new PDFDocument({ margin: 40, size: 'A4' });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=relatorio-mensal-${mesParam}.pdf`);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');

      doc.pipe(res);

      const colors = {
        primary: '#0f172a',
        accent: '#2563eb',
        success: '#16a34a',
        danger: '#dc2626',
        warning: '#ea580c',
        text: '#1f2937',
        muted: '#6b7280',
        light: '#f8fafc',
        border: '#e2e8f0',
      };

      const lm = 50;
      const pw = 595 - lm - 50; // A4 width minus margins

      // ==================== COVER PAGE ====================
      doc.rect(0, 0, 595, 842).fill('#0f172a');
      doc.rect(0, 0, 595, 280).fill('#1e293b');

      const logoPath = path.join(process.cwd(), 'attached_assets', 'Logo-Turbo-branca_(1)_1766081013390.png');
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, 197, 80, { width: 200 });
        } catch {
          doc.fontSize(24).font('Helvetica-Bold').fillColor('#ffffff')
            .text('TURBO', 50, 120, { align: 'center', width: 495 });
        }
      } else {
        doc.fontSize(24).font('Helvetica-Bold').fillColor('#ffffff')
          .text('TURBO', 50, 120, { align: 'center', width: 495 });
      }

      doc.rect(50, 320, 495, 4).fill(colors.accent);

      doc.fontSize(36).font('Helvetica-Bold').fillColor('#ffffff')
        .text('RELATÓRIO', 50, 350, { align: 'center', width: 495 });
      doc.fontSize(36).font('Helvetica-Bold').fillColor(colors.accent)
        .text('MENSAL', 50, 395, { align: 'center', width: 495 });

      doc.fontSize(16).font('Helvetica').fillColor('#94a3b8')
        .text(mesLabel, 50, 450, { align: 'center', width: 495 });

      doc.fontSize(12).font('Helvetica').fillColor('#64748b')
        .text('Análise Financeira Consolidada', 50, 480, { align: 'center', width: 495 });

      doc.rect(150, 530, 295, 1).fill('#334155');

      doc.fontSize(18).font('Helvetica-Bold').fillColor('#ffffff')
        .text('TURBO PARTNERS', 50, 720, { align: 'center', width: 495 });

      doc.fontSize(9).font('Helvetica').fillColor('#64748b')
        .text(`Gerado em ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`, 50, 800, { align: 'center', width: 495 });

      // ==================== METRICS PAGE ====================
      doc.addPage();
      doc.rect(lm, 45, pw, 4).fill(colors.accent);
      doc.fontSize(22).font('Helvetica-Bold').fillColor(colors.primary)
        .text('RELATÓRIO MENSAL', lm, 60, { align: 'center', width: pw });
      doc.fontSize(10).font('Helvetica').fillColor(colors.muted)
        .text(`Turbo Partners | ${mesLabel} | Análise Financeira`, lm, 85, { align: 'center', width: pw });

      let y = 115;

      // KPI Card helper
      const drawCard = (x: number, cy: number, w: number, h: number, label: string, value: string, subtitle: string, barColor: string) => {
        doc.rect(x, cy, w, h).fill(colors.light);
        doc.rect(x, cy, 4, h).fill(barColor);
        doc.fontSize(8).font('Helvetica').fillColor(colors.muted).text(label, x + 14, cy + 8, { width: w - 24 });
        doc.fontSize(16).font('Helvetica-Bold').fillColor(colors.primary).text(value, x + 14, cy + 24, { width: w - 24 });
        doc.fontSize(7).font('Helvetica').fillColor(colors.muted).text(subtitle, x + 14, cy + 44, { width: w - 24 });
      };

      const gap = 12;
      const cardW = (pw - gap) / 2;
      const cardH = 60;

      // --- RECEITA ---
      doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary).text('RECEITA', lm, y);
      y += 16;

      const mrrVar = mrrAnterior > 0 ? ((mrrAtual - mrrAnterior) / mrrAnterior * 100) : 0;
      const mrrVarStr = mrrVar >= 0 ? `+${mrrVar.toFixed(1)}%` : `${mrrVar.toFixed(1)}%`;

      drawCard(lm, y, cardW, cardH,
        '1. MRR (Receita Recorrente Mensal)',
        fmtCurrency(mrrAtual),
        `${mrrVarStr} vs mês anterior (${fmtShort(mrrAnterior)})`,
        colors.accent);

      drawCard(lm + cardW + gap, y, cardW, cardH,
        '3. Faturamento (Valor Bruto)',
        fmtCurrency(faturamento),
        'Todas as parcelas de receita do mês',
        colors.accent);
      y += cardH + gap;

      drawCard(lm, y, cardW, cardH,
        '2. Projetos Pontuais Entregues',
        `${projetosQtd} projetos`,
        `Valor total: ${fmtShort(projetosValor)}`,
        '#8b5cf6');

      drawCard(lm + cardW + gap, y, cardW, cardH,
        '4. Vendas (Bitrix CRM)',
        fmtCurrency(vendasTotal),
        `Recorrente: ${fmtShort(vendasRecorrente)} | Pontual: ${fmtShort(vendasPontual)}`,
        '#8b5cf6');
      y += cardH + gap;

      // --- MARGENS ---
      doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary).text('MARGENS', lm, y);
      y += 16;

      const margemBrutaPct = receitaLiquida > 0 ? (margemBruta / receitaLiquida * 100).toFixed(1) : '0.0';
      const ebitdaPct = receitaLiquida > 0 ? (ebitda / receitaLiquida * 100).toFixed(1) : '0.0';

      drawCard(lm, y, cardW, cardH,
        '5. Margem Bruta (Rec. Líquida − CSV)',
        fmtCurrency(margemBruta),
        `${margemBrutaPct}% da rec. líquida | CSV: ${fmtShort(csvTotal)}`,
        margemBruta >= 0 ? colors.success : colors.danger);

      drawCard(lm + cardW + gap, y, cardW, cardH,
        '6. EBITDA (Margem Contribuição)',
        fmtCurrency(ebitda),
        `${ebitdaPct}% | CAC: ${fmtShort(cacTotal)} | SG&A: ${fmtShort(sgaTotal)}`,
        ebitda >= 0 ? colors.success : colors.danger);
      y += cardH + gap;

      // --- SAÚDE ---
      doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary).text('SAÚDE', lm, y);
      y += 16;

      const churnPct = mrrAtual > 0 ? (churnMrr / mrrAtual * 100).toFixed(1) : '0.0';

      drawCard(lm, y, cardW, cardH,
        '7. Churn Receita',
        fmtCurrency(churnMrr),
        `${churnPct}% do MRR`,
        colors.danger);

      drawCard(lm + cardW + gap, y, cardW, cardH,
        '8. Inadimplência',
        fmtCurrency(inadMes),
        `Do mês: ${fmtShort(inadMes)} | Acumulada: ${fmtShort(inadTotal)}`,
        colors.warning);
      y += cardH + gap;

      // --- OPERACIONAL ---
      doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary).text('OPERACIONAL', lm, y);
      y += 16;

      drawCard(lm, y, cardW, cardH,
        '9. Saldo de Caixa',
        fmtCurrency(saldoCaixa),
        isCurrentMonth ? 'Saldo atual (contas bancárias)' : 'Snapshot do período',
        '#0ea5e9');

      drawCard(lm + cardW + gap, y, cardW, cardH,
        '10. Faturamento por Pessoa',
        fmtCurrency(faturamentoPorPessoa),
        `Faturamento ÷ ${headcount} colaboradores`,
        '#0ea5e9');
      y += cardH + gap;

      // --- QUALIDADE ---
      drawCard(lm, y, cardW, cardH,
        '11. Health Score (Qualidade)',
        mediaHS > 0 ? mediaHS.toFixed(1) : 'N/A',
        'Média dos health scores do mês',
        '#f59e0b');
      y += cardH + 20;

      // --- FOOTER ---
      doc.rect(lm, y, pw, 1).fill(colors.border);
      y += 8;
      doc.fontSize(7).font('Helvetica').fillColor(colors.muted)
        .text(`Relatório gerado automaticamente pelo Turbo Cortex em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, lm, y, { align: 'center', width: pw });

      doc.end();

    } catch (error) {
      console.error("[api] Error generating relatorio mensal PDF:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to generate relatorio mensal PDF" });
      }
    }
  });
}
