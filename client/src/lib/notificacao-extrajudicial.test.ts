import { describe, it, expect } from 'vitest';
import { formatarMesesEmAtraso, formatarValoresDescricao, renderizarNotificacao, anoPorExtenso } from './notificacao-extrajudicial';

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
    nomeCliente: 'João da Silva',
    empresa: 'EMPRESA DEVEDORA LTDA',
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

  it('faz fallback de empresa para nomeCliente quando empresa vazia', () => {
    const clienteSemEmpresa = { ...cliente, empresa: '' };
    const texto = renderizarNotificacao({ cliente: clienteSemEmpresa, parcelas, form, hoje });
    expect(texto).toContain('JOÃO DA SILVA');
  });

  it('inclui cabeçalho fixo da TURBO PARTNERS', () => {
    const texto = renderizarNotificacao({ cliente, parcelas, form, hoje });
    expect(texto).toContain('TURBO PARTNERS');
    expect(texto).toContain('42.100.292/0001-84');
    expect(texto).toContain('Rua Carlos Fernando Lindenberg Filho, 90');
  });
});
