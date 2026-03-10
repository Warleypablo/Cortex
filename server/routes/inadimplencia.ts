import type { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { sql } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { validateBody } from "../middleware/validate";
import { upsertInadimplenciaContextoSchema } from "../middleware/schemas";

export function registerInadimplenciaRoutes(app: Express) {
  // ============== INADIMPLÊNCIA ==============

  app.get("/api/inadimplencia/resumo", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;
      const resumo = await storage.getInadimplenciaResumo(dataInicio, dataFim);
      res.json(resumo);
    } catch (error) {
      console.error("[api] Error fetching inadimplencia resumo:", error);
      res.status(500).json({ error: "Failed to fetch inadimplencia resumo" });
    }
  });

  app.get("/api/inadimplencia/metricas-recebimento", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;
      const metricas = await storage.getMetricasRecebimento(dataInicio, dataFim);
      res.json(metricas);
    } catch (error) {
      console.error("[api] Error fetching metricas recebimento:", error);
      res.status(500).json({ error: "Failed to fetch metricas recebimento" });
    }
  });

  app.get("/api/inadimplencia/clientes-nunca-pagaram", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;
      const data = await storage.getClientesNuncaPagaram(dataInicio, dataFim);
      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching clientes nunca pagaram:", error);
      res.status(500).json({ error: "Failed to fetch clientes nunca pagaram" });
    }
  });

  app.get("/api/inadimplencia/cancelados-com-cobranca", async (req, res) => {
    try {
      const data = await storage.getContratosCanceladosComCobranca();
      res.json(data);
    } catch (error) {
      console.error("[api] Error fetching contratos cancelados com cobranca:", error);
      res.status(500).json({ error: "Failed to fetch contratos cancelados com cobranca" });
    }
  });

  app.get("/api/inadimplencia/clientes", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;
      const ordenarPor = (req.query.ordenarPor as 'valor' | 'diasAtraso' | 'nome') || 'valor';
      const limite = parseInt(req.query.limite as string) || 100;
      const filtroVendedor = req.query.vendedor as string | undefined;
      const filtroSquad = req.query.squad as string | undefined;
      const filtroResponsavel = req.query.responsavel as string | undefined;
      const filtroProduto = req.query.produto as string | undefined;
      const clientes = await storage.getInadimplenciaClientes(
        dataInicio,
        dataFim,
        ordenarPor,
        limite,
        filtroVendedor,
        filtroSquad,
        filtroResponsavel,
        filtroProduto
      );
      res.json(clientes);
    } catch (error) {
      console.error("[api] Error fetching inadimplencia clientes:", error);
      res.status(500).json({ error: "Failed to fetch inadimplencia clientes" });
    }
  });

  app.get("/api/inadimplencia/cliente/:idCliente/parcelas", async (req, res) => {
    try {
      const idCliente = req.params.idCliente;
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;
      const parcelas = await storage.getInadimplenciaDetalheParcelas(idCliente, dataInicio, dataFim);
      res.json(parcelas);
    } catch (error) {
      console.error("[api] Error fetching inadimplencia parcelas:", error);
      res.status(500).json({ error: "Failed to fetch inadimplencia parcelas" });
    }
  });

  app.get("/api/inadimplencia/por-empresa", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;
      const empresas = await storage.getInadimplenciaPorEmpresa(dataInicio, dataFim);
      res.json(empresas);
    } catch (error) {
      console.error("[api] Error fetching inadimplencia por empresa:", error);
      res.status(500).json({ error: "Failed to fetch inadimplencia por empresa" });
    }
  });

  app.get("/api/inadimplencia/por-metodo-pagamento", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;
      const metodos = await storage.getInadimplenciaPorMetodoPagamento(dataInicio, dataFim);
      res.json(metodos);
    } catch (error) {
      console.error("[api] Error fetching inadimplencia por metodo pagamento:", error);
      res.status(500).json({ error: "Failed to fetch inadimplencia por metodo pagamento" });
    }
  });

  // Inadimplência por Vendedor
  app.get("/api/inadimplencia/por-vendedor", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;
      const vendedores = await storage.getInadimplenciaPorVendedor(dataInicio, dataFim);
      res.json(vendedores);
    } catch (error) {
      console.error("[api] Error fetching inadimplencia por vendedor:", error);
      res.status(500).json({ error: "Failed to fetch inadimplencia por vendedor" });
    }
  });

  // Inadimplência por Squad
  app.get("/api/inadimplencia/por-squad", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;
      const squads = await storage.getInadimplenciaPorSquad(dataInicio, dataFim);
      res.json(squads);
    } catch (error) {
      console.error("[api] Error fetching inadimplencia por squad:", error);
      res.status(500).json({ error: "Failed to fetch inadimplencia por squad" });
    }
  });

  // Inadimplência por Responsável
  app.get("/api/inadimplencia/por-responsavel", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;
      const responsaveis = await storage.getInadimplenciaPorResponsavel(dataInicio, dataFim);
      res.json(responsaveis);
    } catch (error) {
      console.error("[api] Error fetching inadimplencia por responsavel:", error);
      res.status(500).json({ error: "Failed to fetch inadimplencia por responsavel" });
    }
  });

  // Inadimplência por Produto/Serviço
  app.get("/api/inadimplencia/por-produto", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;
      const produtos = await storage.getInadimplenciaPorProduto(dataInicio, dataFim);
      res.json(produtos);
    } catch (error) {
      console.error("[api] Error fetching inadimplencia por produto:", error);
      res.status(500).json({ error: "Failed to fetch inadimplencia por produto" });
    }
  });

  app.get("/api/inadimplencia/relatorio-pdf", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;
      const apenasAtivos = req.query.apenasAtivos === 'true';

      const clientesData = await storage.getInadimplenciaClientes(dataInicio, dataFim, 'valor', 500);

      let clientes = clientesData.clientes;
      if (apenasAtivos) {
        clientes = clientes.filter(c => {
          if (!c.statusClickup) return false;
          const statusLower = c.statusClickup.toLowerCase();
          return statusLower.includes('ativo') &&
                 !statusLower.includes('inativo') &&
                 !statusLower.includes('cancelado') &&
                 !statusLower.includes('cancelamento') &&
                 !statusLower.includes('churn') &&
                 !statusLower.includes('encerrado');
        });
      }

      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        layout: 'landscape'
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=relatorio-inadimplencia-${new Date().toISOString().split('T')[0]}.pdf`);

      doc.pipe(res);

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      doc.fontSize(18).fillColor('#1e293b').text('Relatório de Inadimplência', { align: 'center' });
      doc.moveDown(0.3);

      const dataHoje = new Date().toLocaleDateString('pt-BR');
      doc.fontSize(10).fillColor('#64748b').text(`Gerado em: ${dataHoje}`, { align: 'center' });
      if (apenasAtivos) {
        doc.text('Filtro: Apenas clientes ATIVOS no ClickUp', { align: 'center' });
      }
      doc.moveDown();

      const totalValor = clientes.reduce((acc, c) => acc + c.valorTotal, 0);
      const totalParcelas = clientes.reduce((acc, c) => acc + c.quantidadeParcelas, 0);

      doc.fontSize(11).fillColor('#1e293b');
      doc.text(`Total de Clientes: ${clientes.length}`, 40);
      doc.text(`Total de Parcelas em Atraso: ${totalParcelas}`, 40);
      doc.text(`Valor Total Inadimplente: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValor)}`, 40);
      doc.moveDown();

      doc.moveTo(40, doc.y).lineTo(pageWidth + 40, doc.y).stroke('#e2e8f0');
      doc.moveDown(0.5);

      const colWidths = {
        cliente: 180,
        valor: 90,
        parcelas: 60,
        diasAtraso: 70,
        status: 100,
        responsavel: 120,
        empresa: 100
      };

      const headerY = doc.y;
      doc.fontSize(9).fillColor('#475569').font('Helvetica-Bold');
      let xPos = 40;
      doc.text('Cliente', xPos, headerY, { width: colWidths.cliente });
      xPos += colWidths.cliente;
      doc.text('Valor', xPos, headerY, { width: colWidths.valor, align: 'right' });
      xPos += colWidths.valor;
      doc.text('Parcelas', xPos, headerY, { width: colWidths.parcelas, align: 'center' });
      xPos += colWidths.parcelas;
      doc.text('Dias Atraso', xPos, headerY, { width: colWidths.diasAtraso, align: 'center' });
      xPos += colWidths.diasAtraso;
      doc.text('Status', xPos, headerY, { width: colWidths.status });
      xPos += colWidths.status;
      doc.text('Responsável', xPos, headerY, { width: colWidths.responsavel });
      xPos += colWidths.responsavel;
      doc.text('Empresa', xPos, headerY, { width: colWidths.empresa });

      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(pageWidth + 40, doc.y).stroke('#e2e8f0');
      doc.moveDown(0.3);

      doc.font('Helvetica').fontSize(8).fillColor('#334155');

      for (const cliente of clientes) {
        if (doc.y > doc.page.height - 60) {
          doc.addPage();
          doc.fontSize(8).fillColor('#334155');
        }

        const rowY = doc.y;
        xPos = 40;

        const nomeCliente = cliente.nomeCliente.length > 35
          ? cliente.nomeCliente.substring(0, 35) + '...'
          : cliente.nomeCliente;
        doc.text(nomeCliente, xPos, rowY, { width: colWidths.cliente });
        xPos += colWidths.cliente;

        const valorFormatado = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(cliente.valorTotal);
        doc.fillColor('#dc2626').text(valorFormatado, xPos, rowY, { width: colWidths.valor, align: 'right' });
        xPos += colWidths.valor;

        doc.fillColor('#334155').text(String(cliente.quantidadeParcelas), xPos, rowY, { width: colWidths.parcelas, align: 'center' });
        xPos += colWidths.parcelas;

        doc.text(`${cliente.diasAtrasoMax}d`, xPos, rowY, { width: colWidths.diasAtraso, align: 'center' });
        xPos += colWidths.diasAtraso;

        const status = cliente.statusClickup || '-';
        const statusTruncado = status.length > 18 ? status.substring(0, 18) + '...' : status;
        doc.text(statusTruncado, xPos, rowY, { width: colWidths.status });
        xPos += colWidths.status;

        const responsavel = cliente.responsavel || '-';
        const responsavelTruncado = responsavel.length > 20 ? responsavel.substring(0, 20) + '...' : responsavel;
        doc.text(responsavelTruncado, xPos, rowY, { width: colWidths.responsavel });
        xPos += colWidths.responsavel;

        const empresa = cliente.empresa || '-';
        const empresaTruncada = empresa.length > 15 ? empresa.substring(0, 15) + '...' : empresa;
        doc.text(empresaTruncada, xPos, rowY, { width: colWidths.empresa });

        doc.moveDown(0.6);
      }

      doc.end();

    } catch (error) {
      console.error("[api] Error generating inadimplencia PDF report:", error);
      res.status(500).json({ error: "Failed to generate PDF report" });
    }
  });

  // Relatório Completo de Inadimplência (PDF analítico)
  app.get("/api/inadimplencia/relatorio-completo-pdf", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;

      // Buscar todos os dados em paralelo
      const [resumo, metricas, clientesData, empresasData, squadsData,
             vendedoresData, metodosData, responsaveisData, produtosData,
             nuncaPagaramData, canceladosData] = await Promise.all([
        storage.getInadimplenciaResumo(dataInicio, dataFim),
        storage.getMetricasRecebimento(dataInicio, dataFim),
        storage.getInadimplenciaClientes(dataInicio, dataFim, 'valor', 500),
        storage.getInadimplenciaPorEmpresa(dataInicio, dataFim),
        storage.getInadimplenciaPorSquad(dataInicio, dataFim),
        storage.getInadimplenciaPorVendedor(dataInicio, dataFim),
        storage.getInadimplenciaPorMetodoPagamento(dataInicio, dataFim),
        storage.getInadimplenciaPorResponsavel(dataInicio, dataFim),
        storage.getInadimplenciaPorProduto(dataInicio, dataFim),
        storage.getClientesNuncaPagaram(dataInicio, dataFim),
        storage.getContratosCanceladosComCobranca(),
      ]);

      // Query para receita bruta mensal (denominador do % inadimplência)
      const today = new Date().toISOString().split('T')[0];
      const receitaMensalResult = await db.execute(sql.raw(`
        SELECT TO_CHAR(data_vencimento, 'YYYY-MM') as mes,
               COALESCE(SUM(valor_bruto::numeric), 0) as receita_bruta
        FROM "Conta Azul".caz_parcelas
        WHERE tipo_evento = 'RECEITA'
          AND data_vencimento >= (CURRENT_DATE - INTERVAL '3 months')
          AND data_vencimento < CURRENT_DATE
        GROUP BY TO_CHAR(data_vencimento, 'YYYY-MM')
        ORDER BY mes
      `));
      const receitaMensal: Record<string, number> = {};
      for (const row of receitaMensalResult.rows as any[]) {
        receitaMensal[row.mes] = parseFloat(row.receita_bruta) || 0;
      }

      const clientes = clientesData.clientes;
      const empresas = (empresasData as any).empresas || (empresasData as any) || [];
      const squads = (squadsData as any).squads || (squadsData as any) || [];
      const vendedores = (vendedoresData as any).vendedores || (vendedoresData as any) || [];
      const metodos = (metodosData as any).metodos || (metodosData as any) || [];
      const responsaveis = (responsaveisData as any).responsaveis || (responsaveisData as any) || [];
      const produtos = (produtosData as any).produtos || (produtosData as any) || [];
      const nuncaPagaram = (nuncaPagaramData as any).clientes || (nuncaPagaramData as any) || [];
      const cancelados = (canceladosData as any).contratos || (canceladosData as any) || [];

      // Inicializar PDF (bufferPages para rodapé com paginação)
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        layout: 'landscape',
        bufferPages: true
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=relatorio-completo-inadimplencia-${today}.pdf`);
      doc.pipe(res);

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const marginLeft = 40;
      const dataHoje = new Date().toLocaleDateString('pt-BR');

      // Paleta de cores
      const colors = {
        primary: '#1e293b',
        accent: '#f59e0b',
        accentLight: '#fbbf24',
        danger: '#dc2626',
        dangerDark: '#991b1b',
        success: '#22c55e',
        warning: '#f97316',
        warningLight: '#f59e0b',
        text: '#1f2937',
        muted: '#64748b',
        light: '#f8fafc',
        lighter: '#fafafa',
        border: '#e2e8f0',
        headerBg: '#f1f5f9',
        purple: '#7c3aed',
        blue: '#3b82f6',
      };

      // Helper: formatar moeda
      const fmtCurrency = (v: number) => new Intl.NumberFormat('pt-BR', {
        style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0
      }).format(v);

      const fmtCurrencyFull = (v: number) => new Intl.NumberFormat('pt-BR', {
        style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2
      }).format(v);

      const fmtPct = (v: number) => `${v.toFixed(1).replace('.', ',')}%`;

      // Helper: verificar nova página
      const checkNewPage = (space: number = 80) => {
        if (doc.y > doc.page.height - space) {
          doc.addPage();
          return true;
        }
        return false;
      };

      // Helper: desenhar KPI card
      const drawKpiCard = (x: number, y: number, w: number, h: number,
                           label: string, value: string, sub: string, accentColor: string) => {
        doc.rect(x, y, w, h).fill(colors.light);
        doc.rect(x, y, 4, h).fill(accentColor);
        doc.fontSize(8).font('Helvetica').fillColor(colors.muted).text(label, x + 12, y + 8, { width: w - 20 });
        doc.fontSize(16).font('Helvetica-Bold').fillColor(colors.primary).text(value, x + 12, y + 24, { width: w - 20 });
        doc.fontSize(7).font('Helvetica').fillColor(colors.muted).text(sub, x + 12, y + 44, { width: w - 20 });
      };

      // Helper: desenhar header de seção
      const drawSectionHeader = (title: string) => {
        checkNewPage(100);
        doc.moveDown(0.5);
        doc.rect(marginLeft, doc.y, pageWidth, 22).fill(colors.primary);
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#ffffff').text(title, marginLeft + 10, doc.y + 5);
        doc.y = doc.y + 28;
        doc.fillColor(colors.text);
      };

      // Helper: desenhar tabela de breakdown dimensional
      const drawBreakdownTable = (data: any[], labelField: string, valueField: string,
                                  qtdField: string, title: string) => {
        drawSectionHeader(title);
        if (!Array.isArray(data) || data.length === 0) {
          doc.fontSize(9).font('Helvetica').fillColor(colors.muted).text('Sem dados disponíveis', marginLeft + 10);
          doc.moveDown(0.5);
          return;
        }

        const items = data.slice(0, 10);
        const maxVal = Math.max(...items.map((d: any) => parseFloat(d[valueField]) || 0), 1);
        const colWidths = { label: 220, valor: 110, qtd: 60, pct: 60, bar: pageWidth - 480 };

        // Header
        const headerY = doc.y;
        doc.rect(marginLeft, headerY, pageWidth, 16).fill(colors.headerBg);
        doc.fontSize(7).font('Helvetica-Bold').fillColor(colors.muted);
        let xPos = marginLeft + 8;
        doc.text(title.includes('Método') ? 'Método' : title.includes('Empresa') ? 'Empresa' : title.includes('Squad') ? 'Squad' : title.includes('Vendedor') ? 'Vendedor' : title.includes('Responsável') ? 'Responsável' : title.includes('Produto') ? 'Produto' : 'Item', xPos, headerY + 4, { width: colWidths.label });
        xPos += colWidths.label;
        doc.text('Valor', xPos, headerY + 4, { width: colWidths.valor, align: 'right' });
        xPos += colWidths.valor + 10;
        doc.text('Clientes', xPos, headerY + 4, { width: colWidths.qtd, align: 'center' });
        xPos += colWidths.qtd + 10;
        doc.text('% Total', xPos, headerY + 4, { width: colWidths.pct, align: 'center' });
        xPos += colWidths.pct + 10;
        doc.text('Distribuição', xPos, headerY + 4, { width: colWidths.bar });

        doc.y = headerY + 20;

        for (let i = 0; i < items.length; i++) {
          checkNewPage(20);
          const item = items[i];
          const rowY = doc.y;
          const valor = parseFloat(item[valueField]) || 0;
          const qtd = parseInt(item[qtdField]) || 0;
          const pct = resumo.totalInadimplente > 0 ? (valor / resumo.totalInadimplente) * 100 : 0;
          const barWidth = maxVal > 0 ? (valor / maxVal) * colWidths.bar : 0;

          if (i % 2 === 1) {
            doc.rect(marginLeft, rowY - 1, pageWidth, 14).fill(colors.lighter);
          }

          xPos = marginLeft + 8;
          const label = String(item[labelField] || '-');
          const labelTrunc = label.length > 35 ? label.substring(0, 35) + '...' : label;
          doc.fontSize(7).font('Helvetica').fillColor(colors.text).text(labelTrunc, xPos, rowY + 2, { width: colWidths.label });
          xPos += colWidths.label;
          doc.font('Helvetica-Bold').fillColor(colors.danger).text(fmtCurrency(valor), xPos, rowY + 2, { width: colWidths.valor, align: 'right' });
          xPos += colWidths.valor + 10;
          doc.font('Helvetica').fillColor(colors.text).text(String(qtd), xPos, rowY + 2, { width: colWidths.qtd, align: 'center' });
          xPos += colWidths.qtd + 10;
          doc.text(fmtPct(pct), xPos, rowY + 2, { width: colWidths.pct, align: 'center' });
          xPos += colWidths.pct + 10;

          // Barra visual
          if (barWidth > 0) {
            doc.rect(xPos, rowY + 2, barWidth, 8).fill(colors.accent);
          }

          doc.y = rowY + 16;
        }
        doc.moveDown(0.3);
      };

      // ==================== PÁGINA 1: CAPA + RESUMO EXECUTIVO ====================

      // Header bar
      doc.rect(0, 0, doc.page.width, 100).fill(colors.primary);
      doc.fontSize(22).fillColor('#ffffff').font('Helvetica-Bold');
      doc.text('RELATÓRIO COMPLETO DE INADIMPLÊNCIA', marginLeft, 25, { align: 'center' });
      doc.fontSize(13).fillColor(colors.accentLight).font('Helvetica');
      doc.text('Análise Detalhada • Indicadores • Breakdowns', marginLeft, 55, { align: 'center' });
      doc.fontSize(9).fillColor('#94a3b8');
      doc.text(`Gerado em: ${dataHoje}`, marginLeft, 78, { align: 'center' });

      doc.y = 115;

      // 4 KPI Cards
      const cardW = (pageWidth - 30) / 4;
      const cardH = 58;
      const cardY = doc.y;

      drawKpiCard(marginLeft, cardY, cardW, cardH,
        'TOTAL INADIMPLENTE', fmtCurrency(resumo.totalInadimplente),
        `${resumo.quantidadeParcelas} parcelas em aberto`, colors.danger);

      drawKpiCard(marginLeft + cardW + 10, cardY, cardW, cardH,
        'CLIENTES INADIMPLENTES', String(resumo.quantidadeClientes),
        `Ticket médio: ${fmtCurrency(resumo.ticketMedio)}`, colors.warning);

      drawKpiCard(marginLeft + (cardW + 10) * 2, cardY, cardW, cardH,
        'TICKET MÉDIO', fmtCurrency(resumo.ticketMedio),
        `Por cliente inadimplente`, colors.accent);

      drawKpiCard(marginLeft + (cardW + 10) * 3, cardY, cardW, cardH,
        'ÚLTIMOS 45 DIAS', fmtCurrency(resumo.valorUltimos45Dias),
        `${resumo.quantidadeUltimos45Dias} parcelas`, colors.purple);

      doc.y = cardY + cardH + 20;

      // Seção: Inadimplência dos Últimos 3 Meses
      drawSectionHeader('INADIMPLÊNCIA DOS ÚLTIMOS 3 MESES');

      const evolucao = resumo.evolucaoMensal || [];
      const ultimos3Meses = evolucao.slice(-3);

      if (ultimos3Meses.length > 0) {
        // Header da tabela
        const tblHeaderY = doc.y;
        doc.rect(marginLeft, tblHeaderY, pageWidth, 16).fill(colors.headerBg);
        doc.fontSize(8).font('Helvetica-Bold').fillColor(colors.muted);
        doc.text('Mês', marginLeft + 10, tblHeaderY + 4, { width: 120 });
        doc.text('Valor Inadimplente', marginLeft + 140, tblHeaderY + 4, { width: 130, align: 'right' });
        doc.text('Receita Bruta', marginLeft + 280, tblHeaderY + 4, { width: 130, align: 'right' });
        doc.text('% Inadimplência', marginLeft + 420, tblHeaderY + 4, { width: 100, align: 'center' });
        doc.text('Parcelas', marginLeft + 530, tblHeaderY + 4, { width: 60, align: 'center' });
        doc.text('Distribuição', marginLeft + 600, tblHeaderY + 4, { width: pageWidth - 610 });
        doc.y = tblHeaderY + 20;

        const maxMesVal = Math.max(...ultimos3Meses.map((m: any) => m.valor || 0), 1);
        let somaValor = 0;
        let somaPct = 0;
        let mesesComPct = 0;

        for (let i = 0; i < ultimos3Meses.length; i++) {
          const mes = ultimos3Meses[i];
          const rowY = doc.y;
          const valor = mes.valor || 0;
          const receita = receitaMensal[mes.mes] || 0;
          const pct = receita > 0 ? (valor / receita) * 100 : 0;
          const barWidth = maxMesVal > 0 ? (valor / maxMesVal) * (pageWidth - 610) : 0;

          somaValor += valor;
          if (receita > 0) { somaPct += pct; mesesComPct++; }

          if (i % 2 === 1) {
            doc.rect(marginLeft, rowY - 1, pageWidth, 16).fill(colors.lighter);
          }

          doc.fontSize(8).font('Helvetica-Bold').fillColor(colors.text);
          doc.text(mes.mesLabel || mes.mes, marginLeft + 10, rowY + 3, { width: 120 });
          doc.font('Helvetica-Bold').fillColor(colors.danger);
          doc.text(fmtCurrency(valor), marginLeft + 140, rowY + 3, { width: 130, align: 'right' });
          doc.font('Helvetica').fillColor(colors.text);
          doc.text(receita > 0 ? fmtCurrency(receita) : '-', marginLeft + 280, rowY + 3, { width: 130, align: 'right' });
          doc.font('Helvetica-Bold').fillColor(pct > 10 ? colors.danger : pct > 5 ? colors.warning : colors.success);
          doc.text(receita > 0 ? fmtPct(pct) : '-', marginLeft + 420, rowY + 3, { width: 100, align: 'center' });
          doc.font('Helvetica').fillColor(colors.text);
          doc.text(String(mes.quantidade || 0), marginLeft + 530, rowY + 3, { width: 60, align: 'center' });

          if (barWidth > 0) {
            doc.rect(marginLeft + 600, rowY + 3, barWidth, 9).fill(colors.accent);
          }

          doc.y = rowY + 18;
        }

        // Linha de média
        doc.moveDown(0.3);
        const mediaY = doc.y;
        doc.rect(marginLeft, mediaY, pageWidth, 20).fill('#eff6ff');
        doc.rect(marginLeft, mediaY, 4, 20).fill(colors.blue);

        const mediaValor = ultimos3Meses.length > 0 ? somaValor / ultimos3Meses.length : 0;
        const mediaPct = mesesComPct > 0 ? somaPct / mesesComPct : 0;

        doc.fontSize(9).font('Helvetica-Bold').fillColor(colors.primary);
        doc.text('INADIMPLÊNCIA MÉDIA (3 meses)', marginLeft + 14, mediaY + 5, { width: 200 });
        doc.fillColor(colors.danger);
        doc.text(fmtCurrency(mediaValor), marginLeft + 240, mediaY + 5, { width: 130, align: 'right' });
        doc.fillColor(mediaPct > 10 ? colors.danger : mediaPct > 5 ? colors.warning : colors.success);
        doc.text(fmtPct(mediaPct), marginLeft + 420, mediaY + 5, { width: 100, align: 'center' });

        doc.y = mediaY + 26;
      }

      // Detalhamento Últimos 45 Dias
      doc.moveDown(0.5);
      const det45Y = doc.y;
      const det45W = pageWidth / 3 - 10;
      const pct45 = resumo.totalInadimplente > 0 ? (resumo.valorUltimos45Dias / resumo.totalInadimplente) * 100 : 0;

      doc.rect(marginLeft, det45Y, det45W, 48).fill('#fef2f2');
      doc.rect(marginLeft, det45Y, 4, 48).fill(colors.danger);
      doc.fontSize(7).font('Helvetica').fillColor(colors.dangerDark).text('VALOR ÚLTIMOS 45 DIAS', marginLeft + 12, det45Y + 6);
      doc.fontSize(14).font('Helvetica-Bold').fillColor(colors.danger).text(fmtCurrency(resumo.valorUltimos45Dias), marginLeft + 12, det45Y + 18);
      doc.fontSize(7).font('Helvetica').fillColor(colors.muted).text(`${resumo.quantidadeUltimos45Dias} parcelas`, marginLeft + 12, det45Y + 36);

      doc.rect(marginLeft + det45W + 10, det45Y, det45W, 48).fill('#fef2f2');
      doc.rect(marginLeft + det45W + 10, det45Y, 4, 48).fill(colors.warning);
      doc.fontSize(7).font('Helvetica').fillColor(colors.dangerDark).text('% DO TOTAL', marginLeft + det45W + 24, det45Y + 6);
      doc.fontSize(14).font('Helvetica-Bold').fillColor(colors.warning).text(fmtPct(pct45), marginLeft + det45W + 24, det45Y + 18);
      doc.fontSize(7).font('Helvetica').fillColor(colors.muted).text('dos últimos 45 dias sobre o total', marginLeft + det45W + 24, det45Y + 36);

      doc.rect(marginLeft + (det45W + 10) * 2, det45Y, det45W, 48).fill('#f0fdf4');
      doc.rect(marginLeft + (det45W + 10) * 2, det45Y, 4, 48).fill(colors.success);
      doc.fontSize(7).font('Helvetica').fillColor('#166534').text('RESTANTE (> 45 DIAS)', marginLeft + (det45W + 10) * 2 + 12, det45Y + 6);
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#166534').text(fmtCurrency(resumo.totalInadimplente - resumo.valorUltimos45Dias), marginLeft + (det45W + 10) * 2 + 12, det45Y + 18);
      doc.fontSize(7).font('Helvetica').fillColor(colors.muted).text(fmtPct(100 - pct45) + ' do total', marginLeft + (det45W + 10) * 2 + 12, det45Y + 36);

      doc.y = det45Y + 58;

      // ==================== PÁGINA 2: AGING + TOP 10 ====================
      doc.addPage();

      // Análise de Aging
      drawSectionHeader('ANÁLISE DE AGING — DISTRIBUIÇÃO POR FAIXA DE ATRASO');

      const faixas = resumo.faixas;
      const agingData = [
        { label: '1 a 30 dias', ...faixas.ate30dias, color: colors.success },
        { label: '31 a 60 dias', ...faixas.de31a60dias, color: colors.warningLight },
        { label: '61 a 90 dias', ...faixas.de61a90dias, color: colors.warning },
        { label: 'Acima de 90 dias', ...faixas.acima90dias, color: colors.danger },
      ];

      // Stacked bar visual
      const stackBarY = doc.y;
      const stackBarH = 24;
      const totalAging = agingData.reduce((s, d) => s + (d.valor || 0), 0);
      let stackX = marginLeft;

      for (const faixa of agingData) {
        const w = totalAging > 0 ? (faixa.valor / totalAging) * pageWidth : pageWidth / 4;
        if (w > 2) {
          doc.rect(stackX, stackBarY, w, stackBarH).fill(faixa.color);
          if (w > 50) {
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff');
            doc.text(fmtPct(faixa.percentual || 0), stackX + 4, stackBarY + 4, { width: w - 8 });
            doc.fontSize(6).font('Helvetica').text(fmtCurrency(faixa.valor || 0), stackX + 4, stackBarY + 14, { width: w - 8 });
          }
        }
        stackX += w;
      }

      doc.y = stackBarY + stackBarH + 10;

      // Tabela de aging detalhada
      const agingHeaderY = doc.y;
      doc.rect(marginLeft, agingHeaderY, pageWidth, 16).fill(colors.headerBg);
      doc.fontSize(7).font('Helvetica-Bold').fillColor(colors.muted);
      doc.text('Faixa de Atraso', marginLeft + 10, agingHeaderY + 4, { width: 150 });
      doc.text('Valor', marginLeft + 170, agingHeaderY + 4, { width: 120, align: 'right' });
      doc.text('Quantidade', marginLeft + 300, agingHeaderY + 4, { width: 80, align: 'center' });
      doc.text('% do Total', marginLeft + 400, agingHeaderY + 4, { width: 80, align: 'center' });
      doc.text('Barra', marginLeft + 500, agingHeaderY + 4, { width: pageWidth - 510 });
      doc.y = agingHeaderY + 20;

      const maxAgingVal = Math.max(...agingData.map(d => d.valor || 0), 1);
      for (let i = 0; i < agingData.length; i++) {
        const faixa = agingData[i];
        const rowY = doc.y;
        const barW = maxAgingVal > 0 ? ((faixa.valor || 0) / maxAgingVal) * (pageWidth - 510) : 0;

        if (i % 2 === 1) {
          doc.rect(marginLeft, rowY - 1, pageWidth, 16).fill(colors.lighter);
        }

        // Color dot
        doc.circle(marginLeft + 14, rowY + 6, 4).fill(faixa.color);
        doc.fontSize(8).font('Helvetica-Bold').fillColor(colors.text);
        doc.text(faixa.label, marginLeft + 24, rowY + 2, { width: 140 });
        doc.font('Helvetica-Bold').fillColor(colors.danger);
        doc.text(fmtCurrency(faixa.valor || 0), marginLeft + 170, rowY + 2, { width: 120, align: 'right' });
        doc.font('Helvetica').fillColor(colors.text);
        doc.text(String(faixa.quantidade || 0), marginLeft + 300, rowY + 2, { width: 80, align: 'center' });
        doc.text(fmtPct(faixa.percentual || 0), marginLeft + 400, rowY + 2, { width: 80, align: 'center' });
        if (barW > 0) {
          doc.rect(marginLeft + 500, rowY + 2, barW, 9).fill(faixa.color);
        }

        doc.y = rowY + 18;
      }

      doc.moveDown(1);

      // Top 10 Clientes Inadimplentes
      drawSectionHeader('TOP 10 CLIENTES INADIMPLENTES');

      const top10 = clientes.slice(0, 10);
      if (top10.length > 0) {
        const tblY = doc.y;
        doc.rect(marginLeft, tblY, pageWidth, 16).fill(colors.headerBg);
        doc.fontSize(7).font('Helvetica-Bold').fillColor(colors.muted);
        doc.text('#', marginLeft + 5, tblY + 4, { width: 20 });
        doc.text('Cliente', marginLeft + 25, tblY + 4, { width: 200 });
        doc.text('Valor', marginLeft + 235, tblY + 4, { width: 100, align: 'right' });
        doc.text('Parcelas', marginLeft + 345, tblY + 4, { width: 55, align: 'center' });
        doc.text('Dias Atraso', marginLeft + 410, tblY + 4, { width: 65, align: 'center' });
        doc.text('Status', marginLeft + 485, tblY + 4, { width: 120 });
        doc.text('Responsável', marginLeft + 615, tblY + 4, { width: pageWidth - 625 });
        doc.y = tblY + 20;

        for (let i = 0; i < top10.length; i++) {
          checkNewPage(20);
          const c = top10[i];
          const rowY = doc.y;

          if (i % 2 === 1) {
            doc.rect(marginLeft, rowY - 1, pageWidth, 14).fill(colors.lighter);
          }

          doc.fontSize(7).font('Helvetica-Bold').fillColor(colors.muted);
          doc.text(String(i + 1), marginLeft + 5, rowY + 2, { width: 20 });
          const nome = c.nomeCliente.length > 35 ? c.nomeCliente.substring(0, 35) + '...' : c.nomeCliente;
          doc.font('Helvetica').fillColor(colors.text).text(nome, marginLeft + 25, rowY + 2, { width: 200 });
          doc.font('Helvetica-Bold').fillColor(colors.danger).text(fmtCurrency(c.valorTotal), marginLeft + 235, rowY + 2, { width: 100, align: 'right' });
          doc.font('Helvetica').fillColor(colors.text).text(String(c.quantidadeParcelas), marginLeft + 345, rowY + 2, { width: 55, align: 'center' });

          const diasColor = c.diasAtrasoMax > 90 ? colors.danger : c.diasAtrasoMax > 60 ? colors.warning : c.diasAtrasoMax > 30 ? colors.warningLight : colors.success;
          doc.font('Helvetica-Bold').fillColor(diasColor).text(`${c.diasAtrasoMax}d`, marginLeft + 410, rowY + 2, { width: 65, align: 'center' });

          const status = (c.statusClickup || '-').substring(0, 20);
          doc.font('Helvetica').fillColor(colors.text).text(status, marginLeft + 485, rowY + 2, { width: 120 });
          const resp = (c.responsavel || '-').substring(0, 22);
          doc.text(resp, marginLeft + 615, rowY + 2, { width: pageWidth - 625 });

          doc.y = rowY + 16;
        }
      }

      // ==================== PÁGINA 3: BREAKDOWNS DIMENSIONAIS ====================
      doc.addPage();

      drawBreakdownTable(
        Array.isArray(empresas) ? empresas : [],
        'empresa', 'valor', 'quantidadeClientes',
        'INADIMPLÊNCIA POR EMPRESA'
      );

      drawBreakdownTable(
        Array.isArray(squads) ? squads : [],
        'squad', 'valor', 'quantidadeClientes',
        'INADIMPLÊNCIA POR SQUAD'
      );

      drawBreakdownTable(
        Array.isArray(metodos) ? metodos : [],
        'metodoPagamento', 'valor', 'quantidadeClientes',
        'INADIMPLÊNCIA POR MÉTODO DE PAGAMENTO'
      );

      // ==================== PÁGINA 4: VENDEDORES + MÉTRICAS ====================
      doc.addPage();

      drawBreakdownTable(
        Array.isArray(vendedores) ? vendedores : [],
        'vendedor', 'valor', 'quantidadeClientes',
        'INADIMPLÊNCIA POR VENDEDOR'
      );

      drawBreakdownTable(
        Array.isArray(responsaveis) ? responsaveis : [],
        'responsavel', 'valor', 'quantidadeClientes',
        'INADIMPLÊNCIA POR RESPONSÁVEL CS'
      );

      drawBreakdownTable(
        Array.isArray(produtos) ? produtos : [],
        'produto', 'valor', 'quantidadeClientes',
        'INADIMPLÊNCIA POR PRODUTO/SERVIÇO'
      );

      // ==================== MÉTRICAS DE RECEBIMENTO ====================
      doc.addPage();

      drawSectionHeader('MÉTRICAS DE RECEBIMENTO');

      const metCardW = (pageWidth - 30) / 4;
      const metCardH = 58;
      const metCardY = doc.y;

      drawKpiCard(marginLeft, metCardY, metCardW, metCardH,
        'TEMPO MÉDIO RECEBIMENTO', `${metricas.tempoMedioRecebimento || 0} dias`,
        'Média geral de recebimento', colors.blue);

      drawKpiCard(marginLeft + metCardW + 10, metCardY, metCardW, metCardH,
        'TEMPO MÉDIO INADIMPLENTES', `${metricas.tempoMedioRecebimentoInadimplentes || 0} dias`,
        'Pagamentos em atraso', colors.warning);

      drawKpiCard(marginLeft + (metCardW + 10) * 2, metCardY, metCardW, metCardH,
        'INADIMPLENTES 1ª PARCELA', `${metricas.clientesInadimPrimeiraParcela || 0}`,
        `${fmtPct(metricas.percentualInadimPrimeiraParcela || 0)} - ${fmtCurrency(metricas.valorInadimPrimeiraParcela || 0)}`, colors.danger);

      drawKpiCard(marginLeft + (metCardW + 10) * 3, metCardY, metCardW, metCardH,
        'NUNCA PAGARAM', `${metricas.clientesNuncaPagaram || 0}`,
        `${fmtPct(metricas.percentualNuncaPagaram || 0)} - ${fmtCurrency(metricas.valorNuncaPagaram || 0)}`, colors.dangerDark);

      doc.y = metCardY + metCardH + 20;

      // Clientes que Nunca Pagaram - Top 10
      drawSectionHeader('CLIENTES QUE NUNCA PAGARAM — TOP 10');

      const nuncaPagaramTop = Array.isArray(nuncaPagaram) ? nuncaPagaram.slice(0, 10) : [];
      if (nuncaPagaramTop.length > 0) {
        const npHeaderY = doc.y;
        doc.rect(marginLeft, npHeaderY, pageWidth, 16).fill(colors.headerBg);
        doc.fontSize(7).font('Helvetica-Bold').fillColor(colors.muted);
        doc.text('#', marginLeft + 5, npHeaderY + 4, { width: 20 });
        doc.text('Cliente', marginLeft + 25, npHeaderY + 4, { width: 220 });
        doc.text('Valor', marginLeft + 255, npHeaderY + 4, { width: 110, align: 'right' });
        doc.text('Parcelas', marginLeft + 375, npHeaderY + 4, { width: 60, align: 'center' });
        doc.text('Dias Atraso', marginLeft + 445, npHeaderY + 4, { width: 70, align: 'center' });
        doc.text('Empresa', marginLeft + 525, npHeaderY + 4, { width: pageWidth - 535 });
        doc.y = npHeaderY + 20;

        for (let i = 0; i < nuncaPagaramTop.length; i++) {
          checkNewPage(20);
          const c = nuncaPagaramTop[i];
          const rowY = doc.y;

          if (i % 2 === 1) {
            doc.rect(marginLeft, rowY - 1, pageWidth, 14).fill(colors.lighter);
          }

          doc.fontSize(7).font('Helvetica-Bold').fillColor(colors.muted);
          doc.text(String(i + 1), marginLeft + 5, rowY + 2, { width: 20 });
          const nome = String(c.nomeCliente || c.nome || '-');
          doc.font('Helvetica').fillColor(colors.text).text(nome.substring(0, 40), marginLeft + 25, rowY + 2, { width: 220 });
          doc.font('Helvetica-Bold').fillColor(colors.danger).text(fmtCurrency(c.valorTotal || c.valor || 0), marginLeft + 255, rowY + 2, { width: 110, align: 'right' });
          doc.font('Helvetica').fillColor(colors.text).text(String(c.quantidadeParcelas || c.parcelas || 0), marginLeft + 375, rowY + 2, { width: 60, align: 'center' });
          doc.font('Helvetica-Bold').fillColor(colors.danger).text(`${c.diasAtrasoMax || c.diasAtraso || 0}d`, marginLeft + 445, rowY + 2, { width: 70, align: 'center' });
          doc.font('Helvetica').fillColor(colors.text).text(String(c.empresa || '-').substring(0, 25), marginLeft + 525, rowY + 2, { width: pageWidth - 535 });

          doc.y = rowY + 16;
        }
      } else {
        doc.fontSize(9).font('Helvetica').fillColor(colors.muted).text('Nenhum cliente nesta categoria no período.', marginLeft + 10);
      }

      // ==================== CONTRATOS CANCELADOS ====================
      doc.moveDown(1);

      drawSectionHeader('CONTRATOS CANCELADOS COM COBRANÇAS EM ABERTO');

      const canceladosTop = Array.isArray(cancelados) ? cancelados.slice(0, 15) : [];
      if (canceladosTop.length > 0) {
        const ccHeaderY = doc.y;
        doc.rect(marginLeft, ccHeaderY, pageWidth, 16).fill(colors.headerBg);
        doc.fontSize(7).font('Helvetica-Bold').fillColor(colors.muted);
        doc.text('#', marginLeft + 5, ccHeaderY + 4, { width: 20 });
        doc.text('Cliente', marginLeft + 25, ccHeaderY + 4, { width: 220 });
        doc.text('Valor em Aberto', marginLeft + 255, ccHeaderY + 4, { width: 110, align: 'right' });
        doc.text('Parcelas', marginLeft + 375, ccHeaderY + 4, { width: 60, align: 'center' });
        doc.text('Status', marginLeft + 445, ccHeaderY + 4, { width: 120 });
        doc.text('Empresa', marginLeft + 575, ccHeaderY + 4, { width: pageWidth - 585 });
        doc.y = ccHeaderY + 20;

        for (let i = 0; i < canceladosTop.length; i++) {
          checkNewPage(20);
          const c = canceladosTop[i];
          const rowY = doc.y;

          if (i % 2 === 1) {
            doc.rect(marginLeft, rowY - 1, pageWidth, 14).fill(colors.lighter);
          }

          doc.fontSize(7).font('Helvetica-Bold').fillColor(colors.muted);
          doc.text(String(i + 1), marginLeft + 5, rowY + 2, { width: 20 });
          const nome = String(c.nomeCliente || c.nome || '-');
          doc.font('Helvetica').fillColor(colors.text).text(nome.substring(0, 40), marginLeft + 25, rowY + 2, { width: 220 });
          doc.font('Helvetica-Bold').fillColor(colors.danger).text(fmtCurrency(c.valorTotal || c.valor || 0), marginLeft + 255, rowY + 2, { width: 110, align: 'right' });
          doc.font('Helvetica').fillColor(colors.text).text(String(c.quantidadeParcelas || c.parcelas || 0), marginLeft + 375, rowY + 2, { width: 60, align: 'center' });
          const status = String(c.statusClickup || c.status || '-').substring(0, 20);
          doc.text(status, marginLeft + 445, rowY + 2, { width: 120 });
          doc.text(String(c.empresa || '-').substring(0, 20), marginLeft + 575, rowY + 2, { width: pageWidth - 585 });

          doc.y = rowY + 16;
        }

        // Resumo dos cancelados
        doc.moveDown(0.5);
        const totalCanc = canceladosTop.reduce((s: number, c: any) => s + (c.valorTotal || c.valor || 0), 0);
        doc.fontSize(8).font('Helvetica-Bold').fillColor(colors.primary);
        doc.text(`Total: ${canceladosTop.length} contratos cancelados — ${fmtCurrency(totalCanc)} em cobranças pendentes`, marginLeft + 10);
      } else {
        doc.fontSize(9).font('Helvetica').fillColor(colors.muted).text('Nenhum contrato cancelado com cobranças em aberto.', marginLeft + 10);
      }

      // ==================== RODAPÉ EM TODAS AS PÁGINAS ====================
      const pages = doc.bufferedPageRange();
      for (let i = pages.start; i < pages.start + pages.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(7).font('Helvetica').fillColor('#94a3b8');
        doc.text(
          `Relatório gerado automaticamente pelo sistema Cortex — ${dataHoje} — Página ${i + 1} de ${pages.count}`,
          marginLeft, doc.page.height - 30,
          { align: 'center', width: pageWidth }
        );
      }

      doc.end();

    } catch (error) {
      console.error("[api] Error generating complete inadimplencia PDF:", error);
      res.status(500).json({ error: "Failed to generate complete inadimplencia PDF" });
    }
  });

  // Relatório PDF de clientes com Contexto CS = "Cobrar"
  app.get("/api/inadimplencia/relatorio-cobranca-pdf", async (req, res) => {
    try {
      const dataInicio = req.query.dataInicio as string | undefined;
      const dataFim = req.query.dataFim as string | undefined;

      // 1. Buscar todos os clientes
      const clientesData = await storage.getInadimplenciaClientes(dataInicio, dataFim, 'valor', 500);

      // 2. Buscar todos os contextos
      const ids = clientesData.clientes.map(c => c.idCliente);
      const contextos = await storage.getInadimplenciaContextos(ids);

      // 3. Filtrar clientes onde acao = 'cobrar'
      const clientesCobrar = clientesData.clientes.filter(c =>
        contextos[c.idCliente]?.acao === 'cobrar'
      );

      if (clientesCobrar.length === 0) {
        return res.status(404).json({ error: "Nenhum cliente com ação 'Cobrar' encontrado" });
      }

      // 4. Para cada cliente, buscar as parcelas
      const clientesComParcelas: Array<{
        cliente: typeof clientesCobrar[0];
        contexto: typeof contextos[string];
        parcelas: Array<{
          id: number;
          descricao: string;
          valorBruto: number;
          naoPago: number;
          dataVencimento: string;
          diasAtraso: number;
          empresa: string;
          status: string;
          urlCobranca: string | null;
        }>;
      }> = [];

      for (const cliente of clientesCobrar) {
        const parcelasData = await storage.getInadimplenciaDetalheParcelas(cliente.idCliente, dataInicio, dataFim);
        clientesComParcelas.push({
          cliente,
          contexto: contextos[cliente.idCliente],
          parcelas: parcelasData.parcelas.map(p => ({
            ...p,
            dataVencimento: p.dataVencimento instanceof Date ? p.dataVencimento.toISOString() : String(p.dataVencimento)
          }))
        });
      }

      // 5. Gerar PDF
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        layout: 'portrait'
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=relatorio-cobranca-${new Date().toISOString().split('T')[0]}.pdf`);

      doc.pipe(res);

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const marginLeft = 40;
      const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);

      // ==================== CAPA / HEADER ====================
      doc.rect(0, 0, doc.page.width, 120).fill('#1e293b');
      doc.fontSize(24).fillColor('#ffffff').font('Helvetica-Bold');
      doc.text('RELATÓRIO DE COBRANÇA', marginLeft, 35, { align: 'center' });
      doc.fontSize(14).fillColor('#fbbf24').font('Helvetica');
      doc.text('Clientes com Ação: COBRAR', marginLeft, 70, { align: 'center' });

      const dataHoje = new Date().toLocaleDateString('pt-BR');
      doc.fontSize(10).fillColor('#94a3b8');
      doc.text(`Gerado em: ${dataHoje}`, marginLeft, 95, { align: 'center' });

      doc.y = 140;

      // ==================== RESUMO GERAL ====================
      const totalValor = clientesCobrar.reduce((acc, c) => acc + c.valorTotal, 0);
      const totalParcelas = clientesCobrar.reduce((acc, c) => acc + c.quantidadeParcelas, 0);

      // Box de resumo
      const resumoY = doc.y;
      doc.rect(marginLeft, resumoY, pageWidth, 60).fill('#f8fafc').stroke('#e2e8f0');

      const boxWidth = pageWidth / 3;

      // Clientes
      doc.fontSize(10).fillColor('#64748b').font('Helvetica');
      doc.text('CLIENTES A COBRAR', marginLeft + 10, resumoY + 10);
      doc.fontSize(20).fillColor('#1e293b').font('Helvetica-Bold');
      doc.text(`${clientesCobrar.length}`, marginLeft + 10, resumoY + 28);

      // Parcelas
      doc.fontSize(10).fillColor('#64748b').font('Helvetica');
      doc.text('PARCELAS EM ATRASO', marginLeft + boxWidth + 10, resumoY + 10);
      doc.fontSize(20).fillColor('#1e293b').font('Helvetica-Bold');
      doc.text(`${totalParcelas}`, marginLeft + boxWidth + 10, resumoY + 28);

      // Valor Total
      doc.fontSize(10).fillColor('#64748b').font('Helvetica');
      doc.text('VALOR TOTAL', marginLeft + (boxWidth * 2) + 10, resumoY + 10);
      doc.fontSize(18).fillColor('#dc2626').font('Helvetica-Bold');
      doc.text(formatCurrency(totalValor), marginLeft + (boxWidth * 2) + 10, resumoY + 28);

      doc.y = resumoY + 80;

      // ==================== LISTA DE CLIENTES ====================
      for (let i = 0; i < clientesComParcelas.length; i++) {
        const { cliente, contexto, parcelas } = clientesComParcelas[i];

        // Verificar se precisa de nova página
        if (doc.y > doc.page.height - 220) {
          doc.addPage();
        }

        const cardY = doc.y;

        // ---- HEADER DO CLIENTE (barra colorida) ----
        doc.rect(marginLeft, cardY, pageWidth, 28).fill('#1e293b');
        doc.fontSize(12).fillColor('#ffffff').font('Helvetica-Bold');
        doc.text(`${i + 1}. ${cliente.nomeCliente}`, marginLeft + 10, cardY + 8);

        // Valor em destaque no header
        doc.fontSize(11).fillColor('#fbbf24');
        doc.text(formatCurrency(cliente.valorTotal), marginLeft + pageWidth - 120, cardY + 8, { width: 110, align: 'right' });

        doc.y = cardY + 32;

        // ---- INFORMAÇÕES EM DUAS COLUNAS ----
        const infoStartY = doc.y;
        const colWidth = (pageWidth - 20) / 2;

        // Coluna 1: Dados de Contato e Empresa
        doc.fontSize(9).fillColor('#1e293b').font('Helvetica-Bold');
        doc.text('CONTATO E EMPRESA', marginLeft + 5, infoStartY);
        doc.font('Helvetica').fontSize(8).fillColor('#475569');
        doc.y = infoStartY + 14;

        doc.text(`Telefone: `, marginLeft + 5, doc.y, { continued: true });
        doc.font('Helvetica-Bold').fillColor('#1e293b').text(cliente.telefone || 'Não informado');
        doc.font('Helvetica').fillColor('#475569');

        doc.text(`Empresa: ${cliente.empresa || '-'}`, marginLeft + 5);
        if (cliente.cnpj) {
          doc.text(`CNPJ: ${cliente.cnpj}`, marginLeft + 5);
        }
        doc.text(`Responsável: ${cliente.responsavel || '-'}`, marginLeft + 5);

        const col1EndY = doc.y;

        // Coluna 2: Status e Serviços
        doc.fontSize(9).fillColor('#1e293b').font('Helvetica-Bold');
        doc.text('STATUS E SERVIÇOS', marginLeft + colWidth + 15, infoStartY);
        doc.font('Helvetica').fontSize(8).fillColor('#475569');
        doc.y = infoStartY + 14;

        doc.text(`Status ClickUp: ${cliente.statusClickup || '-'}`, marginLeft + colWidth + 15, doc.y);
        doc.text(`Cluster: ${cliente.cluster || '-'}`, marginLeft + colWidth + 15);
        doc.text(`Serviços: ${cliente.servicos || '-'}`, marginLeft + colWidth + 15);

        const col2EndY = doc.y;
        doc.y = Math.max(col1EndY, col2EndY) + 8;

        // ---- MÉTRICAS DE ATRASO ----
        const metricsY = doc.y;
        doc.rect(marginLeft, metricsY, pageWidth, 22).fill('#fef2f2');

        doc.fontSize(8).fillColor('#991b1b').font('Helvetica-Bold');
        doc.text(`${cliente.quantidadeParcelas} parcelas em atraso`, marginLeft + 10, metricsY + 6);
        doc.text(`Atraso máximo: ${cliente.diasAtrasoMax} dias`, marginLeft + 150, metricsY + 6);
        doc.text(`Parcela mais antiga: ${cliente.parcelaMaisAntiga ? new Date(cliente.parcelaMaisAntiga).toLocaleDateString('pt-BR') : '-'}`, marginLeft + 300, metricsY + 6);

        doc.y = metricsY + 28;

        // ---- CONTEXTO CS (se houver) ----
        if (contexto && (contexto.contexto || contexto.evidencias || contexto.statusFinanceiro || contexto.detalheFinanceiro)) {
          const ctxY = doc.y;
          doc.rect(marginLeft, ctxY, pageWidth, 2).fill('#3b82f6');
          doc.y = ctxY + 6;

          doc.fontSize(9).fillColor('#1e293b').font('Helvetica-Bold');
          doc.text('CONTEXTO CS', marginLeft + 5, doc.y);
          doc.moveDown(0.3);

          doc.font('Helvetica').fontSize(8).fillColor('#475569');

          if (contexto.contexto) {
            doc.text(`${contexto.contexto}`, marginLeft + 5, doc.y, { width: pageWidth - 10 });
          }
          if (contexto.evidencias) {
            doc.text(`Evidências: ${contexto.evidencias}`, marginLeft + 5, doc.y, { width: pageWidth - 10 });
          }
          if (contexto.statusFinanceiro) {
            const statusLabel = contexto.statusFinanceiro === 'cobrado' ? 'Cobrado' :
                               contexto.statusFinanceiro === 'acordo_realizado' ? 'Acordo Realizado' :
                               contexto.statusFinanceiro === 'juridico' ? 'Jurídico' : '-';
            doc.font('Helvetica-Bold').fillColor('#1e293b');
            doc.text(`Status Financeiro: ${statusLabel}`, marginLeft + 5);
            doc.font('Helvetica').fillColor('#475569');
          }
          if (contexto.detalheFinanceiro) {
            doc.text(`Detalhe: ${contexto.detalheFinanceiro}`, marginLeft + 5, doc.y, { width: pageWidth - 10 });
          }
          if (contexto.atualizadoPor) {
            doc.fontSize(7).fillColor('#94a3b8');
            doc.text(`Atualizado por: ${contexto.atualizadoPor} em ${contexto.atualizadoEm ? new Date(contexto.atualizadoEm).toLocaleDateString('pt-BR') : '-'}`, marginLeft + 5);
          }
          doc.moveDown(0.3);
        }

        // ---- TABELA DE PARCELAS ----
        if (parcelas.length > 0) {
          doc.moveDown(0.3);
          doc.fontSize(9).fillColor('#1e293b').font('Helvetica-Bold');
          doc.text('PARCELAS EM ATRASO', marginLeft + 5, doc.y);
          doc.moveDown(0.3);

          // Header da tabela
          const colWidths = { desc: 200, valor: 80, venc: 75, dias: 45, link: 110 };
          const tableX = marginLeft;
          let tableY = doc.y;

          // Background do header
          doc.rect(tableX, tableY - 2, pageWidth, 14).fill('#f1f5f9');

          doc.fontSize(7).fillColor('#475569').font('Helvetica-Bold');
          doc.text('Descrição', tableX + 5, tableY + 2);
          doc.text('Valor', tableX + colWidths.desc, tableY + 2, { width: colWidths.valor, align: 'right' });
          doc.text('Vencimento', tableX + colWidths.desc + colWidths.valor + 5, tableY + 2);
          doc.text('Atraso', tableX + colWidths.desc + colWidths.valor + colWidths.venc + 5, tableY + 2);
          doc.text('Link', tableX + colWidths.desc + colWidths.valor + colWidths.venc + colWidths.dias + 5, tableY + 2);

          doc.y = tableY + 16;

          doc.font('Helvetica').fontSize(7).fillColor('#334155');

          for (let j = 0; j < parcelas.length; j++) {
            const parcela = parcelas[j];

            if (doc.y > doc.page.height - 50) {
              doc.addPage();
              doc.fontSize(7).fillColor('#334155');
            }

            tableY = doc.y;

            // Zebra striping
            if (j % 2 === 1) {
              doc.rect(tableX, tableY - 1, pageWidth, 12).fill('#fafafa');
              doc.fillColor('#334155');
            }

            const descTruncada = parcela.descricao.length > 40 ? parcela.descricao.substring(0, 40) + '...' : parcela.descricao;
            doc.text(descTruncada, tableX + 5, tableY + 1, { width: colWidths.desc - 10 });
            doc.fillColor('#dc2626').font('Helvetica-Bold');
            doc.text(formatCurrency(parcela.naoPago), tableX + colWidths.desc, tableY + 1, { width: colWidths.valor, align: 'right' });
            doc.fillColor('#334155').font('Helvetica');
            const dataVenc = parcela.dataVencimento ? new Date(parcela.dataVencimento).toLocaleDateString('pt-BR') : '-';
            doc.text(dataVenc, tableX + colWidths.desc + colWidths.valor + 5, tableY + 1);
            doc.fillColor('#991b1b');
            doc.text(`${parcela.diasAtraso} dias`, tableX + colWidths.desc + colWidths.valor + colWidths.venc + 5, tableY + 1);
            doc.fillColor('#334155');

            if (parcela.urlCobranca) {
              doc.fillColor('#2563eb');
              doc.text('Acessar', tableX + colWidths.desc + colWidths.valor + colWidths.venc + colWidths.dias + 5, tableY + 1, {
                link: parcela.urlCobranca,
                underline: true
              });
              doc.fillColor('#334155');
            } else {
              doc.text('-', tableX + colWidths.desc + colWidths.valor + colWidths.venc + colWidths.dias + 5, tableY + 1);
            }

            doc.y = tableY + 13;
          }
        }

        doc.moveDown(0.5);
        doc.moveTo(marginLeft, doc.y).lineTo(marginLeft + pageWidth, doc.y).stroke('#e2e8f0');
        doc.moveDown(0.8);
      }

      // ==================== RODAPÉ NA ÚLTIMA PÁGINA ====================
      doc.fontSize(8).fillColor('#94a3b8').font('Helvetica');
      doc.text(`Relatório gerado automaticamente pelo sistema CRM - ${dataHoje}`, marginLeft, doc.page.height - 40, { align: 'center' });

      doc.end();

    } catch (error) {
      console.error("[api] Error generating cobranca PDF report:", error);
      res.status(500).json({ error: "Failed to generate cobranca PDF report" });
    }
  });

  // Contextos de inadimplência - GET batch
  app.get("/api/inadimplencia/contextos", async (req, res) => {
    try {
      const idsParam = req.query.ids as string;
      if (!idsParam) {
        return res.json({ contextos: {} });
      }
      const ids = idsParam.split(',').filter(Boolean);
      const contextos = await storage.getInadimplenciaContextos(ids);
      res.json({ contextos });
    } catch (error) {
      console.error("[api] Error fetching inadimplencia contextos:", error);
      res.status(500).json({ error: "Failed to fetch inadimplencia contextos" });
    }
  });

  // Contextos de inadimplência - GET single
  app.get("/api/inadimplencia/contexto/:clienteId", async (req, res) => {
    try {
      const { clienteId } = req.params;
      const contexto = await storage.getInadimplenciaContexto(clienteId);
      res.json({ contexto });
    } catch (error) {
      console.error("[api] Error fetching inadimplencia contexto:", error);
      res.status(500).json({ error: "Failed to fetch inadimplencia contexto" });
    }
  });

  // Contextos de inadimplência - PUT upsert
  app.put("/api/inadimplencia/contexto/:clienteId", validateBody(upsertInadimplenciaContextoSchema), async (req, res) => {
    try {
      const { clienteId } = req.params;
      const { contexto, evidencias, acao, statusFinanceiro, detalheFinanceiro } = req.body;

      // Validar ação CS (opcional agora)
      if (acao && !['cobrar', 'aguardar', 'abonar'].includes(acao)) {
        return res.status(400).json({ error: "Invalid acao. Must be 'cobrar', 'aguardar' or 'abonar'" });
      }

      // Validar status financeiro (opcional)
      if (statusFinanceiro && !['cobrado', 'acordo_realizado', 'juridico'].includes(statusFinanceiro)) {
        return res.status(400).json({ error: "Invalid statusFinanceiro. Must be 'cobrado', 'acordo_realizado' or 'juridico'" });
      }

      const userId = (req.user as any)?.id || 'anonymous';
      const result = await storage.upsertInadimplenciaContexto({
        clienteId,
        contexto,
        evidencias,
        acao,
        statusFinanceiro,
        detalheFinanceiro,
        atualizadoPor: userId,
      });
      res.json({ contexto: result });
    } catch (error) {
      console.error("[api] Error upserting inadimplencia contexto:", error);
      res.status(500).json({ error: "Failed to save inadimplencia contexto" });
    }
  });
}
