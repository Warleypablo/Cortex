import { describe, it, expect } from 'vitest';
import { formatarMesesEmAtraso, formatarValoresDescricao, renderizarNotificacao, anoPorExtenso, renderizarNotificacaoHtml } from './notificacao-extrajudicial';

describe('formatarMesesEmAtraso', () => {
  it('formata um único mês', () => {
    expect(formatarMesesEmAtraso(['2026-02-10'])).toBe('fevereiro/2026');
  });

  it('formata dois meses com "e"', () => {
    expect(formatarMesesEmAtraso(['2026-01-10', '2026-02-10']))
      .toBe('janeiro/2026 e fevereiro/2026');
  });

  it('formata três meses com vírgulas e "e"', () => {
    expect(formatarMesesEmAtraso(['2026-01-10', '2026-02-10', '2026-03-10']))
      .toBe('janeiro/2026, fevereiro/2026 e março/2026');
  });

  it('remove duplicatas do mesmo mês/ano', () => {
    expect(formatarMesesEmAtraso(['2026-01-05', '2026-01-15', '2026-02-10']))
      .toBe('janeiro/2026 e fevereiro/2026');
  });

  it('ordena cronologicamente mesmo com entrada fora de ordem', () => {
    expect(formatarMesesEmAtraso(['2026-03-10', '2026-01-10', '2026-02-10']))
      .toBe('janeiro/2026, fevereiro/2026 e março/2026');
  });

  it('lida com parcelas em anos diferentes', () => {
    expect(formatarMesesEmAtraso(['2025-12-10', '2026-01-10']))
      .toBe('dezembro/2025 e janeiro/2026');
  });

  it('retorna string vazia para array vazio', () => {
    expect(formatarMesesEmAtraso([])).toBe('');
  });
});

describe('formatarValoresDescricao', () => {
  it('usa formato "cada uma" quando todas as parcelas têm mesmo valor', () => {
    const parcelas = [
      { naoPago: 6000, dataVencimento: '2026-01-10' },
      { naoPago: 6000, dataVencimento: '2026-02-10' },
      { naoPago: 6000, dataVencimento: '2026-03-10' },
    ];
    expect(formatarValoresDescricao(parcelas))
      .toBe('no valor de R$ 6.000,00 cada uma');
  });

  it('tolera diferenças de até R$ 0,01 como mesmo valor', () => {
    const parcelas = [
      { naoPago: 6000.00, dataVencimento: '2026-01-10' },
      { naoPago: 6000.001, dataVencimento: '2026-02-10' },
    ];
    expect(formatarValoresDescricao(parcelas))
      .toBe('no valor de R$ 6.000,00 cada uma');
  });

  it('usa formato de lista quando valores variam', () => {
    const parcelas = [
      { naoPago: 5000, dataVencimento: '2026-01-10' },
      { naoPago: 5000, dataVencimento: '2026-02-10' },
      { naoPago: 3200, dataVencimento: '2026-03-10' },
    ];
    expect(formatarValoresDescricao(parcelas))
      .toBe('sendo R$ 5.000,00 com vencimento em 10/01/2026, R$ 5.000,00 com vencimento em 10/02/2026 e R$ 3.200,00 com vencimento em 10/03/2026');
  });

  it('retorna string vazia para lista vazia', () => {
    expect(formatarValoresDescricao([])).toBe('');
  });

  it('usa "no valor de R$ X" para parcela única', () => {
    const parcelas = [{ naoPago: 6000, dataVencimento: '2026-01-10' }];
    expect(formatarValoresDescricao(parcelas))
      .toBe('no valor de R$ 6.000,00');
  });
});

describe('anoPorExtenso', () => {
  it('converte 2026', () => {
    expect(anoPorExtenso(2026)).toBe('Dois Mil e Vinte e Seis');
  });
  it('converte 2025', () => {
    expect(anoPorExtenso(2025)).toBe('Dois Mil e Vinte e Cinco');
  });
  it('usa placeholder para anos fora da lista', () => {
    expect(anoPorExtenso(1999)).toBe('[ANO POR EXTENSO]');
  });
});

describe('renderizarNotificacao', () => {
  const cliente = {
    nomeCliente: 'EMPRESA DEVEDORA LTDA',
    empresa: 'Turbo Partners',
    cnpj: '22.222.020/0002-22',
  };

  const parcelas = [
    { naoPago: 6000, dataVencimento: '2026-01-10' },
    { naoPago: 6000, dataVencimento: '2026-02-10' },
    { naoPago: 6000, dataVencimento: '2026-03-10' },
  ];

  const form = {
    email: 'contato@devedora.com',
    endereco: 'Rua do Triunfo, 222, Vitória da Conquista/BA, CEP 45.000-000',
    numeroContrato: '000.33333.22',
    dataContrato: '2025-06-15',
    nomeServico: 'Consultoria financeira',
  };

  const hoje = new Date('2026-04-23T12:00:00Z');

  it('inclui nome e CNPJ da notificada', () => {
    const texto = renderizarNotificacao({ cliente, parcelas, form, hoje });
    expect(texto).toContain('EMPRESA DEVEDORA LTDA');
    expect(texto).toContain('22.222.020/0002-22');
  });

  it('inclui endereço do formulário', () => {
    const texto = renderizarNotificacao({ cliente, parcelas, form, hoje });
    expect(texto).toContain('Rua do Triunfo, 222');
  });

  it('inclui meses em atraso formatados', () => {
    const texto = renderizarNotificacao({ cliente, parcelas, form, hoje });
    expect(texto).toContain('janeiro/2026, fevereiro/2026 e março/2026');
  });

  it('inclui ano principal por extenso', () => {
    const texto = renderizarNotificacao({ cliente, parcelas, form, hoje });
    expect(texto).toContain('Dois Mil e Vinte e Seis');
  });

  it('inclui data do contrato formatada', () => {
    const texto = renderizarNotificacao({ cliente, parcelas, form, hoje });
    expect(texto).toContain('15/06/2025');
  });

  it('inclui nome do serviço e número do contrato', () => {
    const texto = renderizarNotificacao({ cliente, parcelas, form, hoje });
    expect(texto).toContain('Consultoria financeira');
    expect(texto).toContain('000.33333.22');
  });

  it('inclui valor das parcelas no formato cada uma', () => {
    const texto = renderizarNotificacao({ cliente, parcelas, form, hoje });
    expect(texto).toContain('R$ 6.000,00 cada uma');
  });

  it('inclui assinatura com data de emissão', () => {
    const texto = renderizarNotificacao({ cliente, parcelas, form, hoje });
    expect(texto).toContain('Vitória/ES');
    expect(texto).toContain('23/04/2026');
  });

  it('usa placeholders quando campos do form estão vazios', () => {
    const formVazio = { ...form, numeroContrato: '', dataContrato: '', nomeServico: '', endereco: '' };
    const texto = renderizarNotificacao({ cliente, parcelas, form: formVazio, hoje });
    expect(texto).toContain('[Nº DO CONTRATO]');
    expect(texto).toContain('[DATA DO CONTRATO]');
    expect(texto).toContain('[NOME DO SERVIÇO]');
    expect(texto).toContain('[ENDEREÇO NÃO INFORMADO]');
  });

  it('usa placeholder quando CNPJ é null', () => {
    const clienteSemCnpj = { ...cliente, cnpj: null };
    const texto = renderizarNotificacao({ cliente: clienteSemCnpj, parcelas, form, hoje });
    expect(texto).toContain('[CNPJ NÃO INFORMADO]');
  });

  it('faz fallback de nomeCliente para empresa quando nomeCliente vazio', () => {
    const clienteSemNome = { ...cliente, nomeCliente: '', empresa: 'RAZAO SOCIAL LTDA' };
    const texto = renderizarNotificacao({ cliente: clienteSemNome, parcelas, form, hoje });
    expect(texto).toContain('RAZAO SOCIAL LTDA');
  });

  it('inclui cabeçalho fixo da TURBO PARTNERS', () => {
    const texto = renderizarNotificacao({ cliente, parcelas, form, hoje });
    expect(texto).toContain('TURBO PARTNERS');
    expect(texto).toContain('42.100.292/0001-84');
    expect(texto).toContain('Rua Carlos Fernando Lindenberg Filho, 90');
  });
});

describe('renderizarNotificacaoHtml', () => {
  const textoSimples = `NOTIFICAÇÃO EXTRAJUDICIAL DE COBRANÇA

NOTIFICANTE: TURBO PARTNERS, pessoa jurídica com CNPJ 42.100.292/0001-84.

NOTIFICADA: EMPRESA LTDA, CNPJ 22.222.020/0002-22.

Texto do corpo da notificação.

Vitória/ES, 23/04/2026.`;

  it('envolve output em div com inline style de fonte serif', () => {
    const html = renderizarNotificacaoHtml(textoSimples);
    expect(html).toMatch(/<div[^>]*style="[^"]*Georgia[^"]*"[^>]*>/);
    expect(html).toContain('</div>');
  });

  it('usa <h2> para a primeira linha', () => {
    const html = renderizarNotificacaoHtml(textoSimples);
    expect(html).toMatch(/<h2[^>]*>NOTIFICAÇÃO EXTRAJUDICIAL DE COBRANÇA<\/h2>/);
  });

  it('aplica <strong> em NOTIFICANTE:', () => {
    const html = renderizarNotificacaoHtml(textoSimples);
    expect(html).toMatch(/<strong[^>]*>NOTIFICANTE:<\/strong>/);
  });

  it('aplica <strong> em NOTIFICADA:', () => {
    const html = renderizarNotificacaoHtml(textoSimples);
    expect(html).toMatch(/<strong[^>]*>NOTIFICADA:<\/strong>/);
  });

  it('usa <p> para parágrafos comuns', () => {
    const html = renderizarNotificacaoHtml(textoSimples);
    expect(html).toMatch(/<p[^>]*>Texto do corpo da notificação\.<\/p>/);
  });

  it('escapa caracteres especiais HTML no corpo', () => {
    const textoComHtml = `Título\n\nParágrafo com <script>alert("xss")</script> e & ampersand.`;
    const html = renderizarNotificacaoHtml(textoComHtml);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('lida com texto vazio retornando div vazia', () => {
    const html = renderizarNotificacaoHtml('');
    expect(html).toMatch(/<div[^>]*><\/div>/);
  });

  it('renderiza cabeçalho com marca TURBO PARTNERS e tagline', () => {
    const html = renderizarNotificacaoHtml(textoSimples);
    expect(html).toMatch(/<h1[^>]*>TURBO PARTNERS<\/h1>/);
    expect(html).toContain('Departamento Jurídico');
  });

  it('renderiza rodapé informativo com CNPJ da notificante', () => {
    const html = renderizarNotificacaoHtml(textoSimples);
    expect(html).toContain('Esta é uma notificação extrajudicial');
    expect(html).toContain('42.100.292/0001-84');
  });

  it('destaca o parágrafo do aviso legal (art. 726 CPC) em caixa própria', () => {
    const textoComAviso = `TÍTULO\n\nCumpre informar, através deste documento, nos termos do artigo 726 do CPC, que prazo é de 10 dias.`;
    const html = renderizarNotificacaoHtml(textoComAviso);
    expect(html).toMatch(/<div[^>]*border:1px solid[^>]*>[^<]*Cumpre informar/);
  });
});
