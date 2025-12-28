/**
 * =============================================================================
 * CÓDIGO PARA O TURBODASH - Endpoints de KPIs
 * =============================================================================
 * 
 * INSTRUÇÕES:
 * 1. Copie este código para o projeto TurboDash
 * 2. Adicione a secret TURBODASH_API_SECRET no Replit Secrets (mesmo valor nos dois projetos)
 * 3. Importe e use as rotas no seu server principal
 * 
 * DEPENDÊNCIAS NECESSÁRIAS:
 * npm install jsonwebtoken
 * 
 * =============================================================================
 */

import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

// =============================================================================
// CONFIGURAÇÃO
// =============================================================================

const API_SECRET = process.env.TURBODASH_API_SECRET || 'CHANGE_THIS_SECRET_IN_PRODUCTION';

// =============================================================================
// MIDDLEWARE DE AUTENTICAÇÃO
// =============================================================================

interface AuthenticatedRequest extends Request {
  apiClient?: { name: string; iat: number };
}

function authenticateAPI(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, API_SECRET) as { name: string; iat: number };
    req.apiClient = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// =============================================================================
// TIPOS
// =============================================================================

interface KPIData {
  faturamento: number;
  faturamento_variacao: number;
  investimento: number;
  investimento_variacao: number;
  roas: number;
  roas_variacao: number;
  compras: number;
  compras_variacao: number;
  cpa: number;
  cpa_variacao: number;
  ticket_medio: number;
  ticket_medio_variacao: number;
  sessoes: number;
  sessoes_variacao: number;
  cps: number;
  cps_variacao: number;
  taxa_conversao: number;
  taxa_conversao_variacao: number;
  taxa_recorrencia: number;
  taxa_recorrencia_variacao: number;
}

interface ClienteKPI {
  cnpj: string;
  nome_cliente: string;
  periodo_inicio: string;
  periodo_fim: string;
  kpis: KPIData;
  ultima_atualizacao: string;
}

// =============================================================================
// ENDPOINT 1: KPIs de um cliente específico (por CNPJ)
// =============================================================================

router.get('/kpis/:cnpj', authenticateAPI, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cnpj } = req.params;
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    
    if (cnpjLimpo.length !== 14) {
      return res.status(400).json({ error: 'CNPJ inválido' });
    }
    
    // ==========================================================================
    // TODO: SUBSTITUA ESTA QUERY PELA SUA LÓGICA DE BUSCA DE DADOS
    // ==========================================================================
    // Aqui você deve buscar os dados reais do seu banco de dados
    // Exemplo de estrutura esperada:
    
    /*
    const resultado = await suaQueryDoBanco(`
      SELECT 
        c.cnpj,
        c.nome_cliente,
        -- seus campos de KPI aqui
      FROM clientes c
      WHERE c.cnpj = $1
    `, [cnpjLimpo]);
    
    if (!resultado) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    */
    
    // DADOS DE EXEMPLO - SUBSTITUA PELA SUA QUERY REAL
    const clienteData: ClienteKPI = {
      cnpj: cnpjLimpo,
      nome_cliente: "Cliente Exemplo", // Buscar do banco
      periodo_inicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      periodo_fim: new Date().toISOString().split('T')[0],
      kpis: {
        faturamento: 136067.33,
        faturamento_variacao: 181.9,
        investimento: 26020.79,
        investimento_variacao: 1648.4,
        roas: 5.23,
        roas_variacao: -83.9,
        compras: 628,
        compras_variacao: 149.2,
        cpa: 41.43,
        cpa_variacao: 601.6,
        ticket_medio: 216.67,
        ticket_medio_variacao: 13.1,
        sessoes: 0,
        sessoes_variacao: 0,
        cps: 0,
        cps_variacao: 0,
        taxa_conversao: 0,
        taxa_conversao_variacao: 0,
        taxa_recorrencia: 1.17,
        taxa_recorrencia_variacao: 0
      },
      ultima_atualizacao: new Date().toISOString()
    };
    
    return res.json(clienteData);
    
  } catch (error) {
    console.error('[TurboDash API] Erro ao buscar KPIs:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// =============================================================================
// ENDPOINT 2: Lista agregada de todos os clientes
// =============================================================================

router.get('/kpis/lista', authenticateAPI, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // ==========================================================================
    // TODO: SUBSTITUA ESTA QUERY PELA SUA LÓGICA DE BUSCA DE DADOS
    // ==========================================================================
    // Aqui você deve buscar a lista de todos os clientes com seus KPIs
    
    /*
    const clientes = await suaQueryDoBanco(`
      SELECT 
        c.cnpj,
        c.nome_cliente,
        -- agregações de KPI
      FROM clientes c
      GROUP BY c.cnpj, c.nome_cliente
      ORDER BY faturamento DESC
    `);
    */
    
    // DADOS DE EXEMPLO - SUBSTITUA PELA SUA QUERY REAL
    const listaClientes: ClienteKPI[] = [
      {
        cnpj: "12345678000190",
        nome_cliente: "Empresa ABC Ltda",
        periodo_inicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        periodo_fim: new Date().toISOString().split('T')[0],
        kpis: {
          faturamento: 250000,
          faturamento_variacao: 15.5,
          investimento: 45000,
          investimento_variacao: 12.3,
          roas: 5.56,
          roas_variacao: 8.2,
          compras: 1200,
          compras_variacao: 10.1,
          cpa: 37.50,
          cpa_variacao: -5.2,
          ticket_medio: 208.33,
          ticket_medio_variacao: 4.8,
          sessoes: 15000,
          sessoes_variacao: 20.0,
          cps: 3.00,
          cps_variacao: -8.5,
          taxa_conversao: 8.0,
          taxa_conversao_variacao: 2.1,
          taxa_recorrencia: 25.5,
          taxa_recorrencia_variacao: 3.2
        },
        ultima_atualizacao: new Date().toISOString()
      }
      // ... mais clientes
    ];
    
    return res.json({
      total: listaClientes.length,
      periodo_inicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      periodo_fim: new Date().toISOString().split('T')[0],
      clientes: listaClientes
    });
    
  } catch (error) {
    console.error('[TurboDash API] Erro ao buscar lista de KPIs:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// =============================================================================
// ENDPOINT 3: Verificar se CNPJ existe (para auto-conectar clientes)
// =============================================================================

router.get('/clientes/verificar/:cnpj', authenticateAPI, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cnpj } = req.params;
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    
    if (cnpjLimpo.length !== 14) {
      return res.status(400).json({ error: 'CNPJ inválido' });
    }
    
    // ==========================================================================
    // TODO: SUBSTITUA ESTA QUERY PELA SUA LÓGICA
    // ==========================================================================
    /*
    const cliente = await suaQueryDoBanco(`
      SELECT cnpj, nome_cliente, status
      FROM clientes
      WHERE cnpj = $1
    `, [cnpjLimpo]);
    */
    
    // EXEMPLO - SUBSTITUA
    const clienteExiste = true; // Resultado da sua query
    const nomeCliente = "Empresa ABC Ltda";
    
    if (clienteExiste) {
      return res.json({
        existe: true,
        cnpj: cnpjLimpo,
        nome_cliente: nomeCliente
      });
    } else {
      return res.json({
        existe: false,
        cnpj: cnpjLimpo
      });
    }
    
  } catch (error) {
    console.error('[TurboDash API] Erro ao verificar CNPJ:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// =============================================================================
// EXPORTAR ROUTER
// =============================================================================

export default router;

// =============================================================================
// COMO USAR NO SEU SERVER PRINCIPAL:
// =============================================================================
/*

// No seu arquivo principal (ex: server/index.ts ou app.ts)

import turbodashKpisRouter from './routes/turbodash-kpis';

// Adicione as rotas
app.use('/api', turbodashKpisRouter);

// Agora os endpoints estarão disponíveis em:
// GET /api/kpis/:cnpj
// GET /api/kpis/lista
// GET /api/clientes/verificar/:cnpj

*/

// =============================================================================
// GERAÇÃO DE TOKEN (para testes)
// =============================================================================
/*

// Use este código para gerar um token de teste:

import jwt from 'jsonwebtoken';

const token = jwt.sign(
  { name: 'turbo-cortex', iat: Math.floor(Date.now() / 1000) },
  process.env.TURBODASH_API_SECRET || 'CHANGE_THIS_SECRET_IN_PRODUCTION',
  { expiresIn: '24h' }
);

console.log('Token:', token);

*/
