import type { Express } from "express";
import type { IStorage } from "../storage";
import { sql } from "drizzle-orm";

export function registerGEGRoutes(app: Express, db: any, storage: IStorage) {
  // GEG (Gestão Estratégica de Gente) API routes

  app.get("/api/geg/metricas", async (req, res) => {
    try {
      const periodo = req.query.periodo as string || 'trimestre';
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const metricas = await storage.getGegMetricas(periodo, squad, setor, nivel, cargo);
      res.json(metricas);
    } catch (error) {
      console.error("[api] Error fetching GEG metricas:", error);
      res.status(500).json({ error: "Failed to fetch GEG metricas" });
    }
  });

  app.get("/api/geg/evolucao-headcount", async (req, res) => {
    try {
      const periodo = req.query.periodo as string || 'trimestre';
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const evolucao = await storage.getGegEvolucaoHeadcount(periodo, squad, setor, nivel, cargo);
      res.json(evolucao);
    } catch (error) {
      console.error("[api] Error fetching GEG evolucao headcount:", error);
      res.status(500).json({ error: "Failed to fetch GEG evolucao headcount" });
    }
  });

  app.get("/api/geg/admissoes-demissoes", async (req, res) => {
    try {
      const periodo = req.query.periodo as string || 'trimestre';
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const dados = await storage.getGegAdmissoesDemissoes(periodo, squad, setor, nivel, cargo);
      res.json(dados);
    } catch (error) {
      console.error("[api] Error fetching GEG admissoes demissoes:", error);
      res.status(500).json({ error: "Failed to fetch GEG admissoes demissoes" });
    }
  });

  app.get("/api/geg/tempo-promocao", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const tempoPromocao = await storage.getGegTempoPromocao(squad, setor, nivel, cargo);
      res.json(tempoPromocao);
    } catch (error) {
      console.error("[api] Error fetching GEG tempo promocao:", error);
      res.status(500).json({ error: "Failed to fetch GEG tempo promocao" });
    }
  });

  app.get("/api/geg/aniversariantes-mes", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const aniversariantes = await storage.getGegAniversariantesMes(squad, setor, nivel, cargo);
      res.json(aniversariantes);
    } catch (error) {
      console.error("[api] Error fetching GEG aniversariantes mes:", error);
      res.status(500).json({ error: "Failed to fetch GEG aniversariantes mes" });
    }
  });

  app.get("/api/geg/aniversarios-empresa", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const aniversarios = await storage.getGegAniversariosEmpresa(squad, setor, nivel, cargo);
      res.json(aniversarios);
    } catch (error) {
      console.error("[api] Error fetching GEG aniversarios empresa:", error);
      res.status(500).json({ error: "Failed to fetch GEG aniversarios empresa" });
    }
  });

  app.get("/api/geg/filtros", async (req, res) => {
    try {
      const filtros = await storage.getGegFiltros();
      res.json(filtros);
    } catch (error) {
      console.error("[api] Error fetching GEG filtros:", error);
      res.status(500).json({ error: "Failed to fetch GEG filtros" });
    }
  });

  app.get("/api/geg/valor-medio-salario", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegValorMedioSalario(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG valor medio salario:", error);
      res.status(500).json({ error: "Failed to fetch GEG valor medio salario" });
    }
  });

  app.get("/api/geg/custo-folha", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegCustoFolha(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG custo folha:", error);
      res.status(500).json({ error: "Failed to fetch GEG custo folha" });
    }
  });

  app.get("/api/geg/valor-beneficio", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegValorBeneficio(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG valor beneficio:", error);
      res.status(500).json({ error: "Failed to fetch GEG valor beneficio" });
    }
  });

  app.get("/api/geg/valor-premiacao", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegValorPremiacao(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG valor premiacao:", error);
      res.status(500).json({ error: "Failed to fetch GEG valor premiacao" });
    }
  });

  app.get("/api/geg/patrimonio-resumo", async (req, res) => {
    try {
      const resultado = await storage.getGegPatrimonioResumo();
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG patrimonio resumo:", error);
      res.status(500).json({ error: "Failed to fetch GEG patrimonio resumo" });
    }
  });

  app.get("/api/geg/ultimas-promocoes", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';
      const limit = parseInt(req.query.limit as string) || 10;

      const resultado = await storage.getGegUltimasPromocoes(squad, setor, nivel, cargo, limit);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG ultimas promocoes:", error);
      res.status(500).json({ error: "Failed to fetch GEG ultimas promocoes" });
    }
  });

  app.get("/api/geg/tempo-permanencia", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegTempoPermanencia(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG tempo permanencia:", error);
      res.status(500).json({ error: "Failed to fetch GEG tempo permanencia" });
    }
  });

  app.get("/api/geg/mas-contratacoes", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegMasContratacoes(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG mas contratacoes:", error);
      res.status(500).json({ error: "Failed to fetch GEG mas contratacoes" });
    }
  });

  app.get("/api/geg/pessoas-por-setor", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegPessoasPorSetor(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG pessoas por setor:", error);
      res.status(500).json({ error: "Failed to fetch GEG pessoas por setor" });
    }
  });

  app.get("/api/geg/custo-por-setor", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegCustoPorSetor(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG custo por setor:", error);
      res.status(500).json({ error: "Failed to fetch GEG custo por setor" });
    }
  });

  app.get("/api/geg/demissoes-por-tipo", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegDemissoesPorTipo(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG demissoes por tipo:", error);
      res.status(500).json({ error: "Failed to fetch GEG demissoes por tipo" });
    }
  });

  app.get("/api/geg/ultimas-demissoes", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';
      const limit = parseInt(req.query.limit as string) || 10;

      const resultado = await storage.getGegUltimasDemissoes(squad, setor, nivel, cargo, limit);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG ultimas demissoes:", error);
      res.status(500).json({ error: "Failed to fetch GEG ultimas demissoes" });
    }
  });

  app.get("/api/geg/headcount-por-tenure", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegHeadcountPorTenure(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG headcount por tenure:", error);
      res.status(500).json({ error: "Failed to fetch GEG headcount por tenure" });
    }
  });

  app.get("/api/geg/colaboradores-por-squad", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegColaboradoresPorSquad(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG colaboradores por squad:", error);
      res.status(500).json({ error: "Failed to fetch GEG colaboradores por squad" });
    }
  });

  app.get("/api/geg/colaboradores-por-cargo", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegColaboradoresPorCargo(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG colaboradores por cargo:", error);
      res.status(500).json({ error: "Failed to fetch GEG colaboradores por cargo" });
    }
  });

  app.get("/api/geg/colaboradores-por-nivel", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const resultado = await storage.getGegColaboradoresPorNivel(squad, setor, nivel, cargo);
      res.json(resultado);
    } catch (error) {
      console.error("[api] Error fetching GEG colaboradores por nivel:", error);
      res.status(500).json({ error: "Failed to fetch GEG colaboradores por nivel" });
    }
  });

  // Geographic Analysis - Distribution by State and City (ES focus: Vitória, Vila Velha, Serra, Cariacica)
  app.get("/api/geg/distribuicao-geografica", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const colaboradores = await storage.getColaboradores({ status: 'Ativo' });

      // Filter by filters
      let filtered = colaboradores;
      if (squad !== 'todos') filtered = filtered.filter(c => c.squad === squad);
      if (setor !== 'todos') filtered = filtered.filter(c => c.setor === setor);
      if (nivel !== 'todos') filtered = filtered.filter(c => c.nivel === nivel);
      if (cargo !== 'todos') filtered = filtered.filter(c => c.cargo === cargo);

      // ES Cities mapping for presencial/remoto analysis
      const esCities = ['vitória', 'vitoria', 'vila velha', 'serra', 'cariacica', 'viana', 'guarapari', 'fundão', 'fundao'];

      // Extract city from address (common patterns: "Cidade - ES" or "Cidade, ES" or just city name)
      const extractCity = (endereco: string | null): string => {
        if (!endereco) return 'Não informado';
        const lower = endereco.toLowerCase();

        // Check for known ES cities
        if (lower.includes('vitória') || lower.includes('vitoria')) return 'Vitória';
        if (lower.includes('vila velha')) return 'Vila Velha';
        if (lower.includes('serra')) return 'Serra';
        if (lower.includes('cariacica')) return 'Cariacica';
        if (lower.includes('viana')) return 'Viana';
        if (lower.includes('guarapari')) return 'Guarapari';
        if (lower.includes('fundão') || lower.includes('fundao')) return 'Fundão';

        // Try to extract city from patterns like "City - STATE" or "City, STATE"
        const match = endereco.match(/^([^,-]+)/);
        if (match) {
          const city = match[1].trim();
          if (city.length > 2 && city.length < 50) return city;
        }

        return 'Outros';
      };

      // Determine if employee is presencial (ES region) or remoto
      const isPresencial = (endereco: string | null, estado: string | null): boolean => {
        if (estado?.toUpperCase() === 'ES') return true;
        if (!endereco) return false;
        const lower = endereco.toLowerCase();
        return esCities.some(city => lower.includes(city));
      };

      // Distribution by state
      const byEstado: Record<string, number> = {};
      // Distribution by city (focus on ES)
      const byCidade: Record<string, number> = {};
      // Presencial vs Remoto
      let presencialCount = 0;
      let remotoCount = 0;
      // Grande Vitória breakdown
      const grandeVitoria: Record<string, number> = {
        'Vitória': 0,
        'Vila Velha': 0,
        'Serra': 0,
        'Cariacica': 0,
        'Viana': 0,
        'Guarapari': 0,
        'Fundão': 0,
        'Outras ES': 0
      };

      filtered.forEach(c => {
        // By state
        const estado = c.estado?.toUpperCase() || 'Não informado';
        byEstado[estado] = (byEstado[estado] || 0) + 1;

        // By city
        const cidade = extractCity(c.endereco);
        byCidade[cidade] = (byCidade[cidade] || 0) + 1;

        // Presencial vs Remoto
        if (isPresencial(c.endereco, c.estado)) {
          presencialCount++;
          // Grande Vitória breakdown
          if (cidade === 'Vitória') grandeVitoria['Vitória']++;
          else if (cidade === 'Vila Velha') grandeVitoria['Vila Velha']++;
          else if (cidade === 'Serra') grandeVitoria['Serra']++;
          else if (cidade === 'Cariacica') grandeVitoria['Cariacica']++;
          else if (cidade === 'Viana') grandeVitoria['Viana']++;
          else if (cidade === 'Guarapari') grandeVitoria['Guarapari']++;
          else if (cidade === 'Fundão') grandeVitoria['Fundão']++;
          else grandeVitoria['Outras ES']++;
        } else {
          remotoCount++;
        }
      });

      // Sort by count
      const estadosSorted = Object.entries(byEstado)
        .sort((a, b) => b[1] - a[1])
        .map(([estado, total]) => ({ estado, total }));

      const cidadesSorted = Object.entries(byCidade)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([cidade, total]) => ({ cidade, total }));

      const grandeVitoriaSorted = Object.entries(grandeVitoria)
        .filter(([_, total]) => total > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([cidade, total]) => ({ cidade, total }));

      res.json({
        byEstado: estadosSorted,
        byCidade: cidadesSorted,
        grandeVitoria: grandeVitoriaSorted,
        modalidade: {
          presencial: presencialCount,
          remoto: remotoCount,
          total: presencialCount + remotoCount
        }
      });
    } catch (error) {
      console.error("[api] Error fetching geographic distribution:", error);
      res.status(500).json({ error: "Failed to fetch geographic distribution" });
    }
  });

  // Alerts and Attention - Veterans without raises, high turnover, etc.
  app.get("/api/geg/alertas", async (req, res) => {
    try {
      const colaboradores = await storage.getColaboradores({ status: 'Ativo' });

      // Veterans without raise (12+ months tenure, 12+ months without raise)
      const veteranosSemAumento = colaboradores
        .filter(c => {
          const mesesTurbo = c.mesesDeTurbo ?? 0;
          const mesesUltAumento = c.mesesUltAumento;
          return mesesTurbo >= 12 && (mesesUltAumento === null || mesesUltAumento >= 12);
        })
        .map(c => ({
          id: c.id,
          nome: c.nome,
          cargo: c.cargo,
          squad: c.squad,
          mesesDeTurbo: c.mesesDeTurbo ?? 0,
          mesesUltAumento: c.mesesUltAumento,
          salario: parseFloat(c.salario || '0') || 0,
          setor: c.setor,
          nivel: c.nivel,
          admissao: c.admissao
        }))
        .sort((a, b) => (b.mesesUltAumento ?? 999) - (a.mesesUltAumento ?? 999))
        .slice(0, 10);

      // Employees ending probation (within 90 days of hire)
      const hoje = new Date();
      const diasFiltro = parseInt(req.query.diasExperiencia as string) || 90;
      const fimExperiencia = colaboradores
        .filter(c => {
          if (!c.admissao) return false;
          const admissao = new Date(c.admissao);
          const diasTrabalhados = Math.floor((hoje.getTime() - admissao.getTime()) / (1000 * 60 * 60 * 24));
          const diasRestantes = 90 - diasTrabalhados;
          return diasRestantes > 0 && diasRestantes <= diasFiltro;
        })
        .map(c => {
          const admissao = new Date(c.admissao!);
          const diasTrabalhados = Math.floor((hoje.getTime() - admissao.getTime()) / (1000 * 60 * 60 * 24));
          const diasRestantes = Math.max(0, 90 - diasTrabalhados);
          return {
            id: c.id,
            nome: c.nome,
            cargo: c.cargo,
            squad: c.squad,
            admissao: c.admissao,
            diasRestantes,
            salario: parseFloat(c.salario || '0') || 0,
            setor: c.setor,
            nivel: c.nivel
          };
        })
        .sort((a, b) => a.diasRestantes - b.diasRestantes)
        .slice(0, 15);

      // Salary below average by role
      const salarioPorCargo: Record<string, { total: number; count: number }> = {};
      colaboradores.forEach(c => {
        const cargo = c.cargo || 'N/A';
        const salario = parseFloat(c.salario || '0') || 0;
        if (salario > 0) {
          if (!salarioPorCargo[cargo]) salarioPorCargo[cargo] = { total: 0, count: 0 };
          salarioPorCargo[cargo].total += salario;
          salarioPorCargo[cargo].count++;
        }
      });

      const salarioAbaixoMedia = colaboradores
        .filter(c => {
          const cargo = c.cargo || 'N/A';
          const salario = parseFloat(c.salario || '0') || 0;
          const avg = salarioPorCargo[cargo]?.count > 2 ? salarioPorCargo[cargo].total / salarioPorCargo[cargo].count : 0;
          return salario > 0 && avg > 0 && salario < avg * 0.8 && salarioPorCargo[cargo]?.count >= 3;
        })
        .map(c => {
          const cargo = c.cargo || 'N/A';
          const salario = parseFloat(c.salario || '0') || 0;
          const avg = salarioPorCargo[cargo].total / salarioPorCargo[cargo].count;
          return {
            id: c.id,
            nome: c.nome,
            cargo: c.cargo,
            squad: c.squad,
            salario,
            mediaCargo: avg,
            diferenca: ((salario - avg) / avg * 100).toFixed(1),
            setor: c.setor,
            nivel: c.nivel,
            admissao: c.admissao,
            mesesDeTurbo: c.mesesDeTurbo ?? 0
          };
        })
        .slice(0, 10);

      res.json({
        veteranosSemAumento,
        fimExperiencia,
        salarioAbaixoMedia,
        totalAlertas: veteranosSemAumento.length + fimExperiencia.length + salarioAbaixoMedia.length
      });
    } catch (error) {
      console.error("[api] Error fetching alerts:", error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  // Retention Rate and Health Distribution
  app.get("/api/geg/retencao-saude", async (req, res) => {
    try {
      const periodo = req.query.periodo as string || 'ano';
      const colaboradores = await storage.getColaboradores({});

      const hoje = new Date();
      let inicioMeses = 12;
      if (periodo === 'trimestre') inicioMeses = 3;
      else if (periodo === 'semestre') inicioMeses = 6;
      else if (periodo === 'mes') inicioMeses = 1;

      const dataInicio = new Date(hoje);
      dataInicio.setMonth(dataInicio.getMonth() - inicioMeses);

      // Count active at start of period
      const ativosInicio = colaboradores.filter(c => {
        const admissao = c.admissao ? new Date(c.admissao) : null;
        const demissao = c.demissao ? new Date(c.demissao) : null;
        return admissao && admissao < dataInicio && (!demissao || demissao >= dataInicio);
      }).length;

      // Count active now
      const ativosAtual = colaboradores.filter(c => c.status === 'Ativo').length;

      // Count dismissed in period
      const demitidosPeriodo = colaboradores.filter(c => {
        const demissao = c.demissao ? new Date(c.demissao) : null;
        return demissao && demissao >= dataInicio && demissao <= hoje;
      }).length;

      // Retention rate
      const taxaRetencao = ativosInicio > 0 ? ((ativosInicio - demitidosPeriodo) / ativosInicio * 100) : 100;

      // Health distribution (simplified calculation)
      const ativos = colaboradores.filter(c => c.status === 'Ativo');
      const healthDistribution = { saudavel: 0, atencao: 0, critico: 0 };

      ativos.forEach(c => {
        const mesesTurbo = c.mesesDeTurbo ?? 0;
        const mesesUltAumento = c.mesesUltAumento;
        const nivel = (c.nivel || '').toLowerCase();

        // Stability score (max 30)
        let stabilityScore = 15;
        if (c.status === 'Ativo') stabilityScore += 5;
        if (mesesTurbo >= 6 && mesesTurbo <= 36) stabilityScore += 10;
        else if (mesesTurbo > 36) stabilityScore += 8;

        // Growth score (max 25)
        let growthScore = 12;
        if (mesesUltAumento !== null) {
          if (mesesUltAumento <= 12) growthScore = 25;
          else if (mesesUltAumento <= 18) growthScore = 18;
          else if (mesesUltAumento <= 24) growthScore = 12;
          else growthScore = 5;
        }

        // Development score (max 25)
        let developmentScore = 15;
        if (nivel.includes('senior') || nivel.includes('sênior') || nivel.includes('head')) developmentScore = 25;
        else if (nivel.includes('pleno')) developmentScore = 20;
        else if (nivel.includes('junior') || nivel.includes('júnior')) developmentScore = 15;

        // Engagement score (max 25) - progressive based on tenure
        let engagementScore = 15;
        if (mesesTurbo >= 60) engagementScore = 25;
        else if (mesesTurbo >= 48) engagementScore = 23;
        else if (mesesTurbo >= 36) engagementScore = 22;
        else if (mesesTurbo >= 24) engagementScore = 20;
        else if (mesesTurbo >= 12) engagementScore = 18;

        const healthScore = stabilityScore + growthScore + developmentScore + engagementScore;

        if (healthScore >= 70) healthDistribution.saudavel++;
        else if (healthScore >= 50) healthDistribution.atencao++;
        else healthDistribution.critico++;
      });

      res.json({
        taxaRetencao: parseFloat(taxaRetencao.toFixed(1)),
        ativosInicio,
        ativosAtual,
        demitidosPeriodo,
        healthDistribution,
        periodo
      });
    } catch (error) {
      console.error("[api] Error fetching retention and health:", error);
      res.status(500).json({ error: "Failed to fetch retention and health data" });
    }
  });

  // Collaborators grouped by health status with reasons
  app.get("/api/geg/colaboradores-por-saude", async (req, res) => {
    try {
      const colaboradores = await storage.getColaboradores({ status: 'Ativo' });

      // Calculate salary averages by cargo
      const salarioPorCargo: Record<string, { total: number; count: number; avg: number }> = {};
      colaboradores.forEach(c => {
        const cargo = c.cargo || 'N/A';
        const salario = parseFloat(c.salario || '0') || 0;
        if (salario > 0) {
          if (!salarioPorCargo[cargo]) salarioPorCargo[cargo] = { total: 0, count: 0, avg: 0 };
          salarioPorCargo[cargo].total += salario;
          salarioPorCargo[cargo].count++;
        }
      });

      // Calculate averages
      Object.keys(salarioPorCargo).forEach(cargo => {
        salarioPorCargo[cargo].avg = salarioPorCargo[cargo].total / salarioPorCargo[cargo].count;
      });

      type HealthCategory = 'saudavel' | 'atencao' | 'critico';
      const result: Record<HealthCategory, { id: number; nome: string; cargo: string | null; squad: string | null; reasons: string[] }[]> = {
        saudavel: [],
        atencao: [],
        critico: []
      };

      colaboradores.forEach(c => {
        const mesesUltAumento = c.mesesUltAumento;
        const cargo = c.cargo || 'N/A';
        const salario = parseFloat(c.salario || '0') || 0;
        const avgCargo = salarioPorCargo[cargo]?.avg || 0;
        const reasons: string[] = [];
        let category: HealthCategory = 'saudavel';

        // Check critical conditions
        if (mesesUltAumento !== null && mesesUltAumento >= 24) {
          reasons.push(`${mesesUltAumento} meses sem aumento`);
          category = 'critico';
        }
        if (avgCargo > 0 && salario > 0 && salario < avgCargo * 0.70 && salarioPorCargo[cargo]?.count >= 3) {
          const pct = ((salario / avgCargo) * 100).toFixed(0);
          reasons.push(`Salário ${pct}% da média do cargo`);
          category = 'critico';
        }

        // Check attention conditions (only if not already critical)
        if (category !== 'critico') {
          if (mesesUltAumento !== null && mesesUltAumento >= 12) {
            reasons.push(`${mesesUltAumento} meses sem aumento`);
            category = 'atencao';
          }
          if (avgCargo > 0 && salario > 0 && salario < avgCargo * 0.85 && salarioPorCargo[cargo]?.count >= 3) {
            const pct = ((salario / avgCargo) * 100).toFixed(0);
            reasons.push(`Salário ${pct}% da média do cargo`);
            category = 'atencao';
          }
        }

        // Default reason for healthy
        if (category === 'saudavel' && reasons.length === 0) {
          reasons.push('Colaborador em boas condições');
        }

        result[category].push({
          id: c.id,
          nome: c.nome,
          cargo: c.cargo,
          squad: c.squad,
          reasons
        });
      });

      res.json(result);
    } catch (error) {
      console.error("[api] Error fetching collaborators by health:", error);
      res.status(500).json({ error: "Failed to fetch collaborators by health" });
    }
  });

  app.get("/api/geg/colaboradores-por-filtro", async (req, res) => {
    try {
      const tipo = req.query.tipo as string;
      const valor = req.query.valor as string;

      if (!tipo || !valor) {
        return res.status(400).json({ error: "tipo and valor are required" });
      }

      const colaboradores = await storage.getColaboradores({ status: 'Ativo' });

      const esCities = ['vitória', 'vitoria', 'vila velha', 'serra', 'cariacica', 'viana', 'guarapari', 'fundão', 'fundao'];

      const extractCity = (endereco: string | null): string => {
        if (!endereco) return 'Não informado';
        const lower = endereco.toLowerCase();
        if (lower.includes('vitória') || lower.includes('vitoria')) return 'Vitória';
        if (lower.includes('vila velha')) return 'Vila Velha';
        if (lower.includes('serra')) return 'Serra';
        if (lower.includes('cariacica')) return 'Cariacica';
        if (lower.includes('viana')) return 'Viana';
        if (lower.includes('guarapari')) return 'Guarapari';
        if (lower.includes('fundão') || lower.includes('fundao')) return 'Fundão';
        const match = endereco.match(/^([^,-]+)/);
        if (match) {
          const city = match[1].trim();
          if (city.length > 2 && city.length < 50) return city;
        }
        return 'Outros';
      };

      const isPresencial = (endereco: string | null, estado: string | null): boolean => {
        if (estado?.toUpperCase() === 'ES') return true;
        if (!endereco) return false;
        const lower = endereco.toLowerCase();
        return esCities.some(city => lower.includes(city));
      };

      const removeEmoji = (str: string) => {
        return str.split('').filter(char => {
          const code = char.codePointAt(0) || 0;
          return !(
            (code >= 0x1F300 && code <= 0x1F9FF) ||
            (code >= 0x2600 && code <= 0x26FF) ||
            (code >= 0x2700 && code <= 0x27BF) ||
            (code >= 0x1F600 && code <= 0x1F64F) ||
            (code >= 0x1F680 && code <= 0x1F6FF) ||
            code === 0x2693
          );
        }).join('').trim();
      };

      let filtered: typeof colaboradores = [];

      switch (tipo) {
        case 'modalidade':
          if (valor === 'Presencial') {
            filtered = colaboradores.filter(c => isPresencial(c.endereco, c.estado));
          } else if (valor === 'Remoto') {
            filtered = colaboradores.filter(c => !isPresencial(c.endereco, c.estado));
          }
          break;
        case 'cidade':
          filtered = colaboradores.filter(c => {
            const cidade = extractCity(c.endereco);
            return cidade === valor;
          });
          break;
        case 'estado':
          filtered = colaboradores.filter(c => {
            const estado = c.estado?.toUpperCase() || 'Não informado';
            return estado === valor;
          });
          break;
        case 'squad':
          filtered = colaboradores.filter(c => {
            const squadName = removeEmoji(c.squad || '').toLowerCase().trim();
            const valorClean = removeEmoji(valor).toLowerCase().trim();
            return squadName.includes(valorClean) ||
                   valorClean.includes(squadName) ||
                   c.squad === valor;
          });
          break;
        case 'cargo':
          filtered = colaboradores.filter(c => c.cargo === valor);
          break;
        case 'nivel':
          filtered = colaboradores.filter(c => {
            const nivelClean = c.nivel?.replace(/^X\s+/, '');
            const valorClean = valor.replace(/^X\s+/, '');
            return c.nivel === valor || nivelClean === valorClean;
          });
          break;
        default:
          return res.status(400).json({ error: "Invalid tipo" });
      }

      const result = filtered.map(c => ({
        id: c.id,
        nome: c.nome,
        cargo: c.cargo,
        squad: c.squad
      }));

      res.json(result);
    } catch (error) {
      console.error("[api] Error fetching collaborators by filter:", error);
      res.status(500).json({ error: "Failed to fetch collaborators by filter" });
    }
  });

  // Salário médio por cargo
  app.get("/api/geg/salario-por-cargo", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const colaboradores = await storage.getColaboradores({ status: 'Ativo' });

      let filtered = colaboradores;
      if (squad !== 'todos') filtered = filtered.filter(c => c.squad === squad);
      if (setor !== 'todos') filtered = filtered.filter(c => c.setor === setor);
      if (nivel !== 'todos') filtered = filtered.filter(c => c.nivel === nivel);
      if (cargo !== 'todos') filtered = filtered.filter(c => c.cargo === cargo);

      const salarioPorCargo: Record<string, { total: number; sum: number }> = {};

      filtered.forEach(c => {
        const cargoNome = c.cargo || 'Não informado';
        const salario = parseFloat(String(c.salario || '0')) || 0;
        if (salario > 0) {
          if (!salarioPorCargo[cargoNome]) {
            salarioPorCargo[cargoNome] = { total: 0, sum: 0 };
          }
          salarioPorCargo[cargoNome].total += 1;
          salarioPorCargo[cargoNome].sum += salario;
        }
      });

      const result = Object.entries(salarioPorCargo)
        .map(([cargoNome, data]) => ({
          cargo: cargoNome,
          salarioMedio: data.total > 0 ? data.sum / data.total : 0,
          total: data.total
        }))
        .sort((a, b) => b.salarioMedio - a.salarioMedio);

      res.json(result);
    } catch (error) {
      console.error("[api] Error fetching salario por cargo:", error);
      res.status(500).json({ error: "Failed to fetch salario por cargo" });
    }
  });

  // Salário médio por squad
  app.get("/api/geg/salario-por-squad", async (req, res) => {
    try {
      const squad = req.query.squad as string || 'todos';
      const setor = req.query.setor as string || 'todos';
      const nivel = req.query.nivel as string || 'todos';
      const cargo = req.query.cargo as string || 'todos';

      const colaboradores = await storage.getColaboradores({ status: 'Ativo' });

      let filtered = colaboradores;
      if (squad !== 'todos') filtered = filtered.filter(c => c.squad === squad);
      if (setor !== 'todos') filtered = filtered.filter(c => c.setor === setor);
      if (nivel !== 'todos') filtered = filtered.filter(c => c.nivel === nivel);
      if (cargo !== 'todos') filtered = filtered.filter(c => c.cargo === cargo);

      const salarioPorSquad: Record<string, { total: number; sum: number }> = {};

      filtered.forEach(c => {
        const squadNome = c.squad || 'Não informado';
        const salario = parseFloat(String(c.salario || '0')) || 0;
        if (salario > 0) {
          if (!salarioPorSquad[squadNome]) {
            salarioPorSquad[squadNome] = { total: 0, sum: 0 };
          }
          salarioPorSquad[squadNome].total += 1;
          salarioPorSquad[squadNome].sum += salario;
        }
      });

      const result = Object.entries(salarioPorSquad)
        .map(([squadNome, data]) => ({
          squad: squadNome,
          salarioMedio: data.total > 0 ? data.sum / data.total : 0,
          total: data.total
        }))
        .sort((a, b) => b.salarioMedio - a.salarioMedio);

      res.json(result);
    } catch (error) {
      console.error("[api] Error fetching salario por squad:", error);
      res.status(500).json({ error: "Failed to fetch salario por squad" });
    }
  });

  // ── Organograma ──────────────────────────────────────────────────────
  app.get("/api/geg/organograma", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT r.nome, r.setor, r.squad, r.cargo, r.email_turbo, a.picture as foto
        FROM "Inhire".rh_pessoal r
        LEFT JOIN cortex_core.auth_users a ON LOWER(r.email_turbo) = LOWER(a.email)
        WHERE r.status = 'Ativo'
        ORDER BY r.setor, r.squad, r.nome
      `);
      const rows: Array<{ nome: string; setor: string | null; squad: string | null; cargo: string | null; email_turbo: string | null; foto: string | null }> = result.rows as any;

      // Helper: strip emojis & trim to normalise squad names
      const normalizeSquadName = (raw: string | null): string => {
        if (!raw) return "Sem Squad";
        return raw
          .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\u{2702}-\u{27B0}️]/gu, "")
          .replace(/\uFE0F/g, "")
          .trim() || "Sem Squad";
      };

      // Identify leader by cargo
      const isLeader = (cargo: string | null): boolean => {
        if (!cargo) return false;
        const lower = cargo.toLowerCase();
        return lower.includes("líder") || lower.includes("lider") || lower.includes("c-level") || lower.includes("head");
      };

      // ── Build department structure ──
      interface Member { nome: string; cargo: string; foto: string | null }
      interface Team { name: string; leader: string | null; leaderCargo: string | null; leaderFoto: string | null; members: Member[] }
      interface Department { name: string; color: string; teams: Team[] }

      const commerceTeams = new Map<string, Team>();
      const techSitesMembers: Member[] = [];
      let techSitesLeader: string | null = null;
      let techSitesLeaderCargo: string | null = null;
      let techSitesLeaderFoto: string | null = null;
      const techInternoMembers: Member[] = [];
      let techInternoLeader: string | null = null;
      let techInternoLeaderCargo: string | null = null;
      let techInternoLeaderFoto: string | null = null;
      const growthMembers: Member[] = [];
      let growthLeader: string | null = null;
      let growthLeaderCargo: string | null = null;
      let growthLeaderFoto: string | null = null;
      const backofficeMembers: Member[] = [];
      const comercialVendas: Member[] = [];
      let comercialVendasLeader: string | null = null;
      let comercialVendasLeaderCargo: string | null = null;
      let comercialVendasLeaderFoto: string | null = null;
      const comercialPreVendas: Member[] = [];
      let comercialPreVendasLeader: string | null = null;
      let comercialPreVendasLeaderCargo: string | null = null;
      let comercialPreVendasLeaderFoto: string | null = null;

      // Commerce squad name mapping for known squads
      const knownCommerceSquads = ["Squadra", "Makers", "Pulse", "Selva", "Black Sheep", "Customer Success", "Squad I.A", "CX&CS"];

      for (const row of rows) {
        const setor = row.setor?.trim() || "";
        const squad = normalizeSquadName(row.squad);
        const cargo = row.cargo?.trim() || "Colaborador";
        const nome = row.nome?.trim() || "";
        const foto = row.foto || null;
        const member: Member = { nome, cargo, foto };

        // Skip CEO / Sócios — handled separately (but keep Rodrigo Queiroz for Tech Interno team)
        if ((setor === "Sócios" || cargo.toLowerCase().includes("ceo")) && !nome.toLowerCase().includes("rodrigo queiroz")) continue;
        // Rodrigo Queiroz → Tech Interno team leader (in Commerce)
        if (nome.toLowerCase().includes("rodrigo queiroz")) {
          const techInternoTeamName = "Tech Interno";
          if (!commerceTeams.has(techInternoTeamName)) {
            commerceTeams.set(techInternoTeamName, { name: techInternoTeamName, leader: null, leaderCargo: null, leaderFoto: null, members: [] });
          }
          const tiTeam = commerceTeams.get(techInternoTeamName)!;
          tiTeam.leader = nome;
          tiTeam.leaderCargo = cargo;
          tiTeam.leaderFoto = foto;
          continue;
        }

        // Skip inactive squads and generic groups
        if (squad.toLowerCase().includes("(off)") || squad.toLowerCase().includes("supreme")) continue;

        // Backoffice — check BEFORE squad filter since they're all "Turbo Interno"
        if (setor === "Backoffice" || setor === "Back Office") {
          backofficeMembers.push(member);
          continue;
        }

        // Growth Interno — check BEFORE squad filter since they may be "Turbo Interno"
        if (setor === "Growth Interno" || setor === "Growth") {
          if (isLeader(cargo)) { growthLeader = nome; growthLeaderCargo = cargo; growthLeaderFoto = foto; }
          else growthMembers.push(member);
          continue;
        }

        if (squad === "Sem Squad" || squad === "Turbo Interno") continue;

        // Tech Sites
        if (setor === "Tech Sites" || setor === "Tech" && squad === "Tech Sites") {
          if (isLeader(cargo)) { techSitesLeader = nome; techSitesLeaderCargo = cargo; techSitesLeaderFoto = foto; }
          else techSitesMembers.push(member);
          continue;
        }

        // Tech Interno / Turbo Interno
        if (setor === "Tech Interno" || setor === "Turbo Interno" || (setor === "Tech" && (squad === "Turbo Interno" || squad === "Tech Interno" || squad === "Tech"))) {
          if (isLeader(cargo)) { techInternoLeader = nome; techInternoLeaderCargo = cargo; techInternoLeaderFoto = foto; }
          else techInternoMembers.push(member);
          continue;
        }

        // Comercial — Pré-Vendas vs Vendas (check cargo FIRST, then squad as fallback)
        if (cargo.toLowerCase().includes("pré-venda") || cargo.toLowerCase().includes("pre-venda") || cargo.toLowerCase().includes("sdr")) {
          comercialPreVendas.push(member);
          continue;
        }

        if (cargo.toLowerCase().includes("inside sales") || cargo.toLowerCase().includes("closer") || squad === "Vendas") {
          comercialVendas.push(member);
          continue;
        }

        // Skip Tech members inside Commerce setor — they belong to Tech department
        if (squad.includes("Tech") && setor === "Commerce") {
          techSitesMembers.push(member);
          continue;
        }

        // Commerce (default for "Commerce" setor or known squads)
        if (setor === "Commerce" || knownCommerceSquads.some(s => squad.includes(s))) {
          // Map squad names
          let teamName = squad;
          if (teamName === "CX&CS" || teamName.includes("CS")) teamName = "Customer Success";
          if (teamName === "Squad I.A") teamName = "Tech Interno";

          if (!commerceTeams.has(teamName)) {
            commerceTeams.set(teamName, { name: teamName, leader: null, leaderCargo: null, leaderFoto: null, members: [] });
          }
          const team = commerceTeams.get(teamName)!;
          // For Tech Interno, Rodrigo Queiroz is the leader (already set) — others are members
          if (isLeader(cargo) && teamName !== "Tech Interno") { team.leader = nome; team.leaderCargo = cargo; team.leaderFoto = foto; }
          else team.members.push(member);
          continue;
        }

        // Fallback: add to backoffice
        backofficeMembers.push(member);
      }

      // Helper to find foto by partial name match
      const findFoto = (name: string): string | null => {
        const lower = name.toLowerCase();
        const row = rows.find(r => r.nome?.toLowerCase().includes(lower));
        return row?.foto || null;
      };

      // ── Assemble departments ──
      const departments: Department[] = [];

      // Commerce
      if (commerceTeams.size > 0) {
        // Set default leaders for teams without one detected from cargo
        const csTeam = commerceTeams.get("Customer Success");
        if (csTeam && !csTeam.leader) {
          // Find Maria Dias in members and promote to leader
          const mariaIdx = csTeam.members.findIndex(m => m.nome.toLowerCase().includes("maria") && m.nome.toLowerCase().includes("dias"));
          if (mariaIdx >= 0) {
            csTeam.leader = csTeam.members[mariaIdx].nome;
            csTeam.leaderCargo = "Líder";
            csTeam.leaderFoto = csTeam.members[mariaIdx].foto;
            csTeam.members.splice(mariaIdx, 1);
          } else {
            csTeam.leader = "Maria Dias";
            csTeam.leaderCargo = "Líder";
            csTeam.leaderFoto = findFoto("maria dias");
          }
        }

        // Sort Tech Interno members: Caio first, then Thiago
        const tiTeam = commerceTeams.get("Tech Interno");
        if (tiTeam) {
          const memberOrder = ["caio", "thiago"];
          tiTeam.members.sort((a, b) => {
            const ai = memberOrder.findIndex(n => a.nome.toLowerCase().includes(n));
            const bi = memberOrder.findIndex(n => b.nome.toLowerCase().includes(n));
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
          });
        }

        const sortOrder = ["Squadra", "Makers", "Pulse", "Selva", "Black Sheep", "Customer Success", "Tech Interno"];
        const sorted = Array.from(commerceTeams.values()).sort((a, b) => {
          const ai = sortOrder.indexOf(a.name);
          const bi = sortOrder.indexOf(b.name);
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });
        departments.push({ name: "Commerce", color: "purple", teams: sorted });
      }

      // Tech — single unified team with Breno as leader
      const allTechMembers = [...techSitesMembers, ...techInternoMembers];
      // Remove Breno from members (he's the leader)
      const techMembersFiltered = allTechMembers.filter(m => !m.nome.toLowerCase().includes("breno"));
      if (techMembersFiltered.length > 0 || techSitesLeader || techInternoLeader) {
        departments.push({
          name: "Tech",
          color: "blue",
          teams: [{ name: "Tech", leader: "Breno Carmo", leaderCargo: "Líder", leaderFoto: findFoto("breno"), members: techMembersFiltered }],
        });
      }

      // Comercial
      const comercialTeams: Team[] = [];
      if (comercialPreVendas.length > 0 || comercialPreVendasLeader) {
        comercialTeams.push({ name: "Pré-Vendas", leader: comercialPreVendasLeader || "Lucas Pereira", leaderCargo: comercialPreVendasLeaderCargo, leaderFoto: comercialPreVendasLeaderFoto || findFoto("lucas pereira"), members: comercialPreVendas });
      }
      if (comercialVendas.length > 0 || comercialVendasLeader) {
        comercialTeams.push({ name: "Vendas", leader: comercialVendasLeader || "João Guarçoni", leaderCargo: comercialVendasLeaderCargo, leaderFoto: comercialVendasLeaderFoto || findFoto("guarçoni"), members: comercialVendas });
      }
      if (comercialTeams.length > 0) {
        departments.push({ name: "Comercial", color: "emerald", teams: comercialTeams });
      }

      // Growth
      if (growthMembers.length > 0 || growthLeader) {
        departments.push({
          name: "Growth",
          color: "orange",
          teams: [{ name: "Growth Interno", leader: growthLeader || "Lucas Pereira", leaderCargo: growthLeaderCargo || "Líder", leaderFoto: growthLeaderFoto || findFoto("lucas pereira"), members: growthMembers }],
        });
      }

      // Back Office — split into Controladoria and G&G
      if (backofficeMembers.length > 0) {
        const controladoriaMembers: Member[] = [];
        const gegMembers: Member[] = [];

        for (const m of backofficeMembers) {
          const cargoLower = m.cargo.toLowerCase();
          if (cargoLower.includes("g&g") || cargoLower.includes("gente") || cargoLower.includes("rh") || cargoLower.includes("people")) {
            gegMembers.push(m);
          } else if (cargoLower.includes("financ") || cargoLower.includes("juríd") || cargoLower.includes("juridic") || cargoLower.includes("dados") || cargoLower.includes("data") || cargoLower.includes("bi")) {
            // Filter out the leader from members list
            if (!m.nome.toLowerCase().includes("marlon")) {
              controladoriaMembers.push(m);
            }
          }
        }

        // Filter out Karol from G&G members (she's the leader)
        const gegFiltered = gegMembers.filter(m => !m.nome.toLowerCase().includes("karoline") && !m.nome.toLowerCase().includes("karol"));

        const boTeams: Team[] = [
          {
            name: "Controladoria",
            leader: "Marlon Carneiro",
            leaderCargo: "Líder",
            leaderFoto: findFoto("marlon"),
            members: controladoriaMembers,
          },
          {
            name: "G&G",
            leader: "Karol Tognere",
            leaderCargo: "Líder",
            leaderFoto: findFoto("karoline") || findFoto("karol"),
            members: gegFiltered,
          },
        ];
        departments.push({ name: "Back Office", color: "gray", teams: boTeams });
      }

      res.json({
        ceo: { nome: "Victor de Souza Peixoto", cargo: "CEO", foto: findFoto("peixoto") },
        coo: { nome: "Rafael Vilela", cargo: "COO", foto: findFoto("vilela") },
        departments,
        totalColaboradores: rows.filter(r => r.setor !== "Sócios").length,
      });
    } catch (error) {
      console.error("[api] Error fetching organograma:", error);
      res.status(500).json({ error: "Failed to fetch organograma" });
    }
  });
}
