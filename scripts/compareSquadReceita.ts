// scripts/compareSquadReceita.ts
// Uso: tsx scripts/compareSquadReceita.ts 2026
//
// Baixa o response de /api/contribuicao-squad/dfc/bulk para o ano dado,
// agrega receita por squad e imprime uma tabela. Deve ser rodado ANTES
// e DEPOIS do merge para validação manual.

const ANO = parseInt(process.argv[2]) || new Date().getFullYear();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function main() {
  const res = await fetch(`${BASE_URL}/api/contribuicao-squad/dfc/bulk?ano=${ANO}`, {
    headers: { 'Cookie': process.env.AUTH_COOKIE || '' },
  });
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const data: any = await res.json();

  const porSquad = new Map<string, number>();
  let totalReceita = 0;

  for (const mes of data.meses || []) {
    if (!mes.data) continue;
    for (const linha of mes.data.receitas || []) {
      if (linha.nivel === 3 && linha.parcelas) {
        for (const p of linha.parcelas) {
          porSquad.set(p.squad, (porSquad.get(p.squad) || 0) + (p.valor || 0));
          totalReceita += p.valor || 0;
        }
      }
    }
  }

  console.log(`\n=== Receita por squad — ano ${ANO} ===`);
  console.log(`Total geral: R$ ${totalReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`);

  const ordenado = Array.from(porSquad.entries()).sort((a, b) => b[1] - a[1]);
  const maxSquadLen = Math.max(...ordenado.map(([s]) => s.length));

  for (const [squad, valor] of ordenado) {
    const pct = totalReceita > 0 ? ((valor / totalReceita) * 100).toFixed(1) : '0.0';
    console.log(
      `${squad.padEnd(maxSquadLen)}  R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(16)}  ${pct.padStart(5)}%`
    );
  }

  if (data.fonteDados) {
    console.log(`\nFonte dos dados:`);
    console.log(`  Total parcelas elegíveis: ${data.fonteDados.totalParcelasElegiveis}`);
    console.log(`  Via caz_vendas_itens:     ${data.fonteDados.viaItens} (${data.fonteDados.pctViaItens}%)`);
    console.log(`  Via simulador A3:         ${data.fonteDados.viaSimuladorA3}`);
    if (data.fonteDados.fallbackUsed) {
      console.log(`  ⚠️ Pipeline de itens indisponível — rodou só A3`);
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
