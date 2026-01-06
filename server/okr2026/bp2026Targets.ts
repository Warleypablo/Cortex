export interface MetricTargets {
  [month: string]: number;
}

export interface MetricDefinition {
  metric_key: string;
  title: string;
  unit: "BRL" | "COUNT" | "PCT";
  period_type: "month_end" | "month_sum";
  direction: "up" | "down" | "flat";
  is_derived: boolean;
  formula?: string;
  dimension_key?: string;
  dimension_value?: string;
  months: MetricTargets;
  totals?: { sum_months?: number; dec?: number; avg?: number };
}

export const BP_2026_TARGETS: MetricDefinition[] = [
  {
    metric_key: "mrr_active",
    title: "MRR Ativo",
    unit: "BRL",
    period_type: "month_end",
    direction: "up",
    is_derived: false,
    months: {
      "2026-01": 1156850, "2026-02": 1267734, "2026-03": 1368637,
      "2026-04": 1485460, "2026-05": 1591769, "2026-06": 1688510,
      "2026-07": 1806544, "2026-08": 1913955, "2026-09": 2011699,
      "2026-10": 2130646, "2026-11": 2238888, "2026-12": 2337388
    },
    totals: { sum_months: 20998078, dec: 2337388 }
  },
  {
    metric_key: "sales_mrr",
    title: "Vendas MRR",
    unit: "BRL",
    period_type: "month_sum",
    direction: "up",
    is_derived: false,
    months: {
      "2026-01": 215000, "2026-02": 215000, "2026-03": 215000,
      "2026-04": 240000, "2026-05": 240000, "2026-06": 240000,
      "2026-07": 270000, "2026-08": 270000, "2026-09": 270000,
      "2026-10": 300000, "2026-11": 300000, "2026-12": 300000
    },
    totals: { sum_months: 2975000 }
  },
  {
    metric_key: "revenue_one_time",
    title: "Receita Pontual",
    unit: "BRL",
    period_type: "month_sum",
    direction: "up",
    is_derived: false,
    months: {
      "2026-01": 240000, "2026-02": 280000, "2026-03": 270000,
      "2026-04": 288333, "2026-05": 306667, "2026-06": 325000,
      "2026-07": 343333, "2026-08": 361667, "2026-09": 380000,
      "2026-10": 398333, "2026-11": 416667, "2026-12": 435000
    },
    totals: { sum_months: 4045000 }
  },
  {
    metric_key: "revenue_other",
    title: "Outras Receitas",
    unit: "BRL",
    period_type: "month_sum",
    direction: "up",
    is_derived: false,
    months: {
      "2026-01": 24767, "2026-02": 21600, "2026-03": 20267,
      "2026-04": 34037, "2026-05": 34037, "2026-06": 25703,
      "2026-07": 45973, "2026-08": 45973, "2026-09": 49587,
      "2026-10": 87927, "2026-11": 87927, "2026-12": 87927
    },
    totals: { sum_months: 565723 }
  },
  {
    metric_key: "revenue_billable_total",
    title: "Receita Total Faturável",
    unit: "BRL",
    period_type: "month_sum",
    direction: "up",
    is_derived: true,
    formula: "mrr_active + revenue_one_time + revenue_other",
    dimension_key: "bp_checkpoint",
    dimension_value: "checkpoint",
    months: {
      "2026-01": 1421617, "2026-02": 1569334, "2026-03": 1658904,
      "2026-04": 1807830, "2026-05": 1932472, "2026-06": 2039213,
      "2026-07": 2195850, "2026-08": 2321595, "2026-09": 2441285,
      "2026-10": 2616906, "2026-11": 2743481, "2026-12": 2860315
    },
    totals: { sum_months: 25608801 }
  },
  {
    metric_key: "bad_debt",
    title: "Perdas / Inadimplência",
    unit: "BRL",
    period_type: "month_sum",
    direction: "down",
    is_derived: false,
    months: {
      "2026-01": 99513, "2026-02": 109853, "2026-03": 116123,
      "2026-04": 108470, "2026-05": 115948, "2026-06": 122353,
      "2026-07": 131751, "2026-08": 139296, "2026-09": 146477,
      "2026-10": 157014, "2026-11": 164609, "2026-12": 171619
    },
    totals: { sum_months: 1583026 }
  },
  {
    metric_key: "taxes_on_revenue",
    title: "Impostos sobre Receita",
    unit: "BRL",
    period_type: "month_sum",
    direction: "down",
    is_derived: false,
    months: {
      "2026-01": 146247, "2026-02": 160603, "2026-03": 169308,
      "2026-04": 185757, "2026-05": 198001, "2026-06": 208486,
      "2026-07": 223872, "2026-08": 236224, "2026-09": 247981,
      "2026-10": 265233, "2026-11": 277666, "2026-12": 289143
    },
    totals: { sum_months: 2608521 }
  },
  {
    metric_key: "revenue_net",
    title: "Receita Líquida",
    unit: "BRL",
    period_type: "month_sum",
    direction: "up",
    is_derived: true,
    formula: "revenue_billable_total - bad_debt - taxes_on_revenue",
    dimension_key: "bp_checkpoint",
    dimension_value: "checkpoint",
    months: {
      "2026-01": 1175857, "2026-02": 1298878, "2026-03": 1373473,
      "2026-04": 1513603, "2026-05": 1618523, "2026-06": 1708374,
      "2026-07": 1840227, "2026-08": 1946075, "2026-09": 2046827,
      "2026-10": 2194659, "2026-11": 2301206, "2026-12": 2399553
    },
    totals: { sum_months: 21417255 }
  },
  {
    metric_key: "cogs_csv",
    title: "CSV (Custo Serviços Vendidos)",
    unit: "BRL",
    period_type: "month_sum",
    direction: "down",
    is_derived: false,
    months: {
      "2026-01": 392504, "2026-02": 407706, "2026-03": 436438,
      "2026-04": 475848, "2026-05": 497651, "2026-06": 516746,
      "2026-07": 577633, "2026-08": 602414, "2026-09": 616990,
      "2026-10": 659609, "2026-11": 672624, "2026-12": 697685
    },
    totals: { sum_months: 6553848 }
  },
  {
    metric_key: "gross_margin",
    title: "Margem Bruta",
    unit: "BRL",
    period_type: "month_sum",
    direction: "up",
    is_derived: true,
    formula: "revenue_net - cogs_csv",
    dimension_key: "bp_checkpoint",
    dimension_value: "checkpoint",
    months: {
      "2026-01": 783352, "2026-02": 891171, "2026-03": 937036,
      "2026-04": 1037755, "2026-05": 1120872, "2026-06": 1191628,
      "2026-07": 1262594, "2026-08": 1343661, "2026-09": 1429837,
      "2026-10": 1535050, "2026-11": 1628582, "2026-12": 1701868
    },
    totals: { sum_months: 14863406 }
  },
  {
    metric_key: "cac_total",
    title: "CAC (Custo Aquisição)",
    unit: "BRL",
    period_type: "month_sum",
    direction: "down",
    is_derived: false,
    months: {
      "2026-01": 287296, "2026-02": 290796, "2026-03": 316796,
      "2026-04": 336374, "2026-05": 421374, "2026-06": 361374,
      "2026-07": 452725, "2026-08": 370725, "2026-09": 383725,
      "2026-10": 419577, "2026-11": 404577, "2026-12": 427577
    },
    totals: { sum_months: 4472916 }
  },
  {
    metric_key: "sga_total",
    title: "SG&A (Despesas Adm.)",
    unit: "BRL",
    period_type: "month_sum",
    direction: "down",
    is_derived: false,
    months: {
      "2026-01": 410130, "2026-02": 296477, "2026-03": 290518,
      "2026-04": 296633, "2026-05": 299429, "2026-06": 303725,
      "2026-07": 437438, "2026-08": 309683, "2026-09": 311030,
      "2026-10": 335494, "2026-11": 347141, "2026-12": 369337
    },
    totals: { sum_months: 4007035 }
  },
  {
    metric_key: "ebitda",
    title: "EBITDA",
    unit: "BRL",
    period_type: "month_sum",
    direction: "up",
    is_derived: true,
    formula: "gross_margin - cac_total - sga_total",
    dimension_key: "bp_checkpoint",
    dimension_value: "checkpoint",
    months: {
      "2026-01": 85927, "2026-02": 303899, "2026-03": 329722,
      "2026-04": 404749, "2026-05": 400070, "2026-06": 526529,
      "2026-07": 372431, "2026-08": 663253, "2026-09": 735082,
      "2026-10": 779979, "2026-11": 876864, "2026-12": 904954
    },
    totals: { sum_months: 6383459 }
  },
  {
    metric_key: "tax_ir_csll",
    title: "IR/CSLL",
    unit: "BRL",
    period_type: "month_sum",
    direction: "down",
    is_derived: false,
    months: {
      "2026-01": 29215, "2026-02": 103325, "2026-03": 112105,
      "2026-04": 137614, "2026-05": 136024, "2026-06": 179020,
      "2026-07": 126627, "2026-08": 225506, "2026-09": 249928,
      "2026-10": 265193, "2026-11": 298134, "2026-12": 307684
    },
    totals: { sum_months: 2170375 }
  },
  {
    metric_key: "capex",
    title: "CAPEX",
    unit: "BRL",
    period_type: "month_sum",
    direction: "down",
    is_derived: false,
    months: {
      "2026-01": 32500, "2026-02": 32500, "2026-03": 32500,
      "2026-04": 32500, "2026-05": 32500, "2026-06": 32500,
      "2026-07": 32500, "2026-08": 32500, "2026-09": 32500,
      "2026-10": 32500, "2026-11": 32500, "2026-12": 32500
    },
    totals: { sum_months: 390000 }
  },
  {
    metric_key: "cash_generation",
    title: "Geração de Caixa",
    unit: "BRL",
    period_type: "month_sum",
    direction: "up",
    is_derived: true,
    formula: "ebitda - tax_ir_csll - capex",
    dimension_key: "bp_checkpoint",
    dimension_value: "checkpoint",
    months: {
      "2026-01": 24212, "2026-02": 168073, "2026-03": 185117,
      "2026-04": 234634, "2026-05": 231546, "2026-06": 315009,
      "2026-07": 213304, "2026-08": 405247, "2026-09": 452654,
      "2026-10": 482286, "2026-11": 546230, "2026-12": 564770
    },
    totals: { sum_months: 3823082 }
  },
  {
    metric_key: "cash_generation_margin_pct",
    title: "Margem Geração Caixa %",
    unit: "PCT",
    period_type: "month_sum",
    direction: "up",
    is_derived: true,
    formula: "cash_generation / revenue_billable_total",
    dimension_key: "bp_checkpoint",
    dimension_value: "checkpoint",
    months: {
      "2026-01": 0.0209, "2026-02": 0.1326, "2026-03": 0.1353,
      "2026-04": 0.1580, "2026-05": 0.1455, "2026-06": 0.1866,
      "2026-07": 0.1181, "2026-08": 0.2117, "2026-09": 0.2250,
      "2026-10": 0.2264, "2026-11": 0.2440, "2026-12": 0.2416
    },
    totals: { avg: 0.170475 }
  },
  {
    metric_key: "revenue_total",
    title: "Receita Total",
    unit: "BRL",
    period_type: "month_sum",
    direction: "up",
    is_derived: false,
    months: {
      "2026-01": 1322104, "2026-02": 1459480, "2026-03": 1542781,
      "2026-04": 1699360, "2026-05": 1816524, "2026-06": 1916860,
      "2026-07": 2064099, "2026-08": 2182299, "2026-09": 2294808,
      "2026-10": 2459892, "2026-11": 2578872, "2026-12": 2688696
    },
    totals: { sum_months: 24025775 }
  },
  {
    metric_key: "expense_total",
    title: "Despesa Total",
    unit: "BRL",
    period_type: "month_sum",
    direction: "down",
    is_derived: false,
    months: {
      "2026-01": 1297892, "2026-02": 1291407, "2026-03": 1357664,
      "2026-04": 1464726, "2026-05": 1584978, "2026-06": 1601851,
      "2026-07": 1850795, "2026-08": 1777052, "2026-09": 1842154,
      "2026-10": 1977605, "2026-11": 2032642, "2026-12": 2123926
    },
    totals: { sum_months: 20202692 }
  },
  {
    metric_key: "headcount_total",
    title: "Headcount Total",
    unit: "COUNT",
    period_type: "month_end",
    direction: "flat",
    is_derived: false,
    months: {
      "2026-01": 126, "2026-02": 129, "2026-03": 138,
      "2026-04": 143, "2026-05": 147, "2026-06": 151,
      "2026-07": 158, "2026-08": 163, "2026-09": 166,
      "2026-10": 172, "2026-11": 175, "2026-12": 179
    },
    totals: { dec: 179 }
  },
  {
    metric_key: "clients_active",
    title: "Clientes Ativos",
    unit: "COUNT",
    period_type: "month_end",
    direction: "up",
    is_derived: false,
    months: {
      "2026-01": 290, "2026-02": 319, "2026-03": 340,
      "2026-04": 365, "2026-05": 388, "2026-06": 409,
      "2026-07": 434, "2026-08": 458, "2026-09": 479,
      "2026-10": 505, "2026-11": 530, "2026-12": 552
    },
    totals: { dec: 552 }
  },
  {
    metric_key: "contracts_active",
    title: "Contratos Ativos",
    unit: "COUNT",
    period_type: "month_end",
    direction: "up",
    is_derived: false,
    months: {
      "2026-01": 415, "2026-02": 456, "2026-03": 486,
      "2026-04": 521, "2026-05": 555, "2026-06": 585,
      "2026-07": 620, "2026-08": 655, "2026-09": 686,
      "2026-10": 722, "2026-11": 758, "2026-12": 789
    },
    totals: { dec: 789 }
  },
  {
    metric_key: "churn_mrr_month",
    title: "Churn MRR Mensal",
    unit: "BRL",
    period_type: "month_sum",
    direction: "down",
    is_derived: false,
    months: {
      "2026-01": 104117, "2026-02": 114096, "2026-03": 123177,
      "2026-04": 133691, "2026-05": 143259, "2026-06": 151966,
      "2026-07": 162589, "2026-08": 172256, "2026-09": 181053,
      "2026-10": 191758, "2026-11": 201500, "2026-12": 210365
    },
    totals: { sum_months: 1889827 }
  },
  {
    metric_key: "effective_tax_rate_pct",
    title: "Taxa Efetiva Impostos %",
    unit: "PCT",
    period_type: "month_sum",
    direction: "flat",
    is_derived: true,
    formula: "taxes_on_revenue / revenue_billable_total",
    dimension_key: "bp_checkpoint",
    dimension_value: "checkpoint",
    months: {
      "2026-01": 0.1234, "2026-02": 0.1682, "2026-03": 0.1696,
      "2026-04": 0.1789, "2026-05": 0.1728, "2026-06": 0.1900,
      "2026-07": 0.1596, "2026-08": 0.1989, "2026-09": 0.2040,
      "2026-10": 0.2027, "2026-11": 0.2099, "2026-12": 0.2087
    },
    totals: { avg: 0.182225 }
  },
  {
    metric_key: "cash_balance",
    title: "Saldo de Caixa",
    unit: "BRL",
    period_type: "month_end",
    direction: "up",
    is_derived: false,
    months: {
      "2026-01": 624212, "2026-02": 792285, "2026-03": 977401,
      "2026-04": 1212035, "2026-05": 1443581, "2026-06": 1758591,
      "2026-07": 1971895, "2026-08": 2377142, "2026-09": 2829796,
      "2026-10": 3312082, "2026-11": 3858312, "2026-12": 4423082
    },
    totals: { dec: 4423082 }
  },
  {
    metric_key: "headcount_bucket_csv",
    title: "Headcount CSV",
    unit: "COUNT",
    period_type: "month_end",
    direction: "flat",
    is_derived: false,
    months: {
      "2026-01": 87, "2026-02": 89, "2026-03": 96,
      "2026-04": 100, "2026-05": 104, "2026-06": 107,
      "2026-07": 114, "2026-08": 118, "2026-09": 120,
      "2026-10": 125, "2026-11": 128, "2026-12": 131
    },
    totals: { dec: 131 }
  },
  {
    metric_key: "headcount_bucket_cac",
    title: "Headcount CAC",
    unit: "COUNT",
    period_type: "month_end",
    direction: "flat",
    is_derived: false,
    months: {
      "2026-01": 27, "2026-02": 28, "2026-03": 30,
      "2026-04": 31, "2026-05": 31, "2026-06": 31,
      "2026-07": 31, "2026-08": 32, "2026-09": 33,
      "2026-10": 34, "2026-11": 34, "2026-12": 35
    },
    totals: { dec: 35 }
  },
  {
    metric_key: "headcount_bucket_sga",
    title: "Headcount SG&A",
    unit: "COUNT",
    period_type: "month_end",
    direction: "flat",
    is_derived: false,
    months: {
      "2026-01": 12, "2026-02": 12, "2026-03": 12,
      "2026-04": 12, "2026-05": 12, "2026-06": 13,
      "2026-07": 13, "2026-08": 13, "2026-09": 13,
      "2026-10": 13, "2026-11": 13, "2026-12": 13
    },
    totals: { dec: 13 }
  },
  {
    metric_key: "revenue_per_head",
    title: "Receita por Cabeça",
    unit: "BRL",
    period_type: "month_sum",
    direction: "up",
    is_derived: true,
    dimension_key: "bp_checkpoint",
    dimension_value: "checkpoint",
    months: {
      "2026-01": 11283, "2026-02": 12165, "2026-03": 12021,
      "2026-04": 12642, "2026-05": 13146, "2026-06": 13505,
      "2026-07": 13898, "2026-08": 14243, "2026-09": 14707,
      "2026-10": 15215, "2026-11": 15677, "2026-12": 15979
    }
  },
  {
    metric_key: "mrr_per_head",
    title: "MRR por Cabeça",
    unit: "BRL",
    period_type: "month_end",
    direction: "up",
    is_derived: true,
    dimension_key: "bp_checkpoint",
    dimension_value: "checkpoint",
    months: {
      "2026-01": 9181, "2026-02": 9827, "2026-03": 9918,
      "2026-04": 10388, "2026-05": 10828, "2026-06": 11182,
      "2026-07": 11434, "2026-08": 11742, "2026-09": 12119,
      "2026-10": 12387, "2026-11": 12794, "2026-12": 13058
    }
  },
  {
    metric_key: "avg_ticket_client",
    title: "Ticket Médio Cliente",
    unit: "BRL",
    period_type: "month_end",
    direction: "up",
    is_derived: true,
    dimension_key: "bp_checkpoint",
    dimension_value: "checkpoint",
    months: {
      "2026-01": 4899, "2026-02": 4924, "2026-03": 4883,
      "2026-04": 4959, "2026-05": 4976, "2026-06": 4986,
      "2026-07": 5065, "2026-08": 5068, "2026-09": 5092,
      "2026-10": 5186, "2026-11": 5178, "2026-12": 5184
    }
  },
  {
    metric_key: "avg_ticket_contract",
    title: "Ticket Médio Contrato",
    unit: "BRL",
    period_type: "month_end",
    direction: "up",
    is_derived: true,
    dimension_key: "bp_checkpoint",
    dimension_value: "checkpoint",
    months: {
      "2026-01": 3426, "2026-02": 3443, "2026-03": 3415,
      "2026-04": 3468, "2026-05": 3480, "2026-06": 3487,
      "2026-07": 3542, "2026-08": 3544, "2026-09": 3561,
      "2026-10": 3626, "2026-11": 3621, "2026-12": 3625
    }
  },
  {
    metric_key: "sales_mrr_total_target",
    title: "Meta Vendas MRR Total",
    unit: "BRL",
    period_type: "month_sum",
    direction: "up",
    is_derived: false,
    months: {
      "2026-01": 215000, "2026-02": 215000, "2026-03": 215000,
      "2026-04": 240000, "2026-05": 240000, "2026-06": 240000,
      "2026-07": 270000, "2026-08": 270000, "2026-09": 270000,
      "2026-10": 300000, "2026-11": 300000, "2026-12": 300000
    }
  },
  {
    metric_key: "sales_mrr_new_target",
    title: "Meta Vendas MRR Novos",
    unit: "BRL",
    period_type: "month_sum",
    direction: "up",
    is_derived: false,
    months: {
      "2026-01": 200000, "2026-02": 200000, "2026-03": 200000,
      "2026-04": 220000, "2026-05": 220000, "2026-06": 220000,
      "2026-07": 240000, "2026-08": 240000, "2026-09": 240000,
      "2026-10": 260000, "2026-11": 260000, "2026-12": 260000
    }
  },
  {
    metric_key: "sales_mrr_monetization_target",
    title: "Meta Monetização MRR",
    unit: "BRL",
    period_type: "month_sum",
    direction: "up",
    is_derived: false,
    months: {
      "2026-01": 15000, "2026-02": 15000, "2026-03": 15000,
      "2026-04": 20000, "2026-05": 20000, "2026-06": 20000,
      "2026-07": 30000, "2026-08": 30000, "2026-09": 30000,
      "2026-10": 40000, "2026-11": 40000, "2026-12": 40000
    }
  },
  {
    metric_key: "sales_performance_share_pct",
    title: "% Performance Vendas",
    unit: "PCT",
    period_type: "month_sum",
    direction: "up",
    is_derived: false,
    months: {
      "2026-01": 0.30, "2026-02": 0.30, "2026-03": 0.30,
      "2026-04": 0.30, "2026-05": 0.30, "2026-06": 0.30,
      "2026-07": 0.30, "2026-08": 0.30, "2026-09": 0.30,
      "2026-10": 0.30, "2026-11": 0.30, "2026-12": 0.30
    }
  },
  {
    metric_key: "sales_mrr_performance_target",
    title: "Meta MRR Performance",
    unit: "BRL",
    period_type: "month_sum",
    direction: "up",
    is_derived: false,
    months: {
      "2026-01": 64500, "2026-02": 64500, "2026-03": 64500,
      "2026-04": 72000, "2026-05": 72000, "2026-06": 72000,
      "2026-07": 81000, "2026-08": 81000, "2026-09": 81000,
      "2026-10": 90000, "2026-11": 90000, "2026-12": 90000
    }
  },
  {
    metric_key: "aov_performance",
    title: "AOV Performance",
    unit: "BRL",
    period_type: "month_end",
    direction: "up",
    is_derived: false,
    months: {
      "2026-01": 3000, "2026-02": 3000, "2026-03": 3000,
      "2026-04": 3000, "2026-05": 3000, "2026-06": 3000,
      "2026-07": 3000, "2026-08": 3000, "2026-09": 3000,
      "2026-10": 3000, "2026-11": 3000, "2026-12": 3000
    }
  },
  {
    metric_key: "contracts_performance",
    title: "Contratos Performance",
    unit: "COUNT",
    period_type: "month_sum",
    direction: "up",
    is_derived: false,
    months: {
      "2026-01": 22, "2026-02": 22, "2026-03": 22,
      "2026-04": 24, "2026-05": 24, "2026-06": 24,
      "2026-07": 27, "2026-08": 27, "2026-09": 27,
      "2026-10": 30, "2026-11": 30, "2026-12": 30
    }
  }
];

export const BP_MONTHS = [
  "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
  "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"
];

export const BP_METRIC_ORDER = [
  "mrr_active",
  "sales_mrr",
  "revenue_one_time",
  "revenue_other",
  "revenue_billable_total",
  "bad_debt",
  "taxes_on_revenue",
  "revenue_net",
  "cogs_csv",
  "gross_margin",
  "cac_total",
  "sga_total",
  "ebitda",
  "tax_ir_csll",
  "capex",
  "cash_generation",
  "cash_generation_margin_pct",
  "cash_balance",
  "headcount_total",
  "clients_active",
  "contracts_active",
  "churn_mrr_month"
];

export function getMetricByKey(key: string): MetricDefinition | undefined {
  return BP_2026_TARGETS.find(m => m.metric_key === key);
}
