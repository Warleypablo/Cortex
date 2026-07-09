// Funções puras espelhadas de server/routes/reportsTrimestral.window.ts
// (mantidas em duplicata para não importar código de servidor no bundle do client — ver Task 4 brief).

export function getDefaultTrimestre(hoje: Date): string {
  const q = Math.floor(hoje.getMonth() / 3) + 1;
  return `${hoje.getFullYear()}-Q${q}`;
}

export function getTrimestreOptions(hoje: Date, count: number): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  let q = Math.floor(hoje.getMonth() / 3) + 1;
  let ano = hoje.getFullYear();
  for (let i = 0; i < count; i++) {
    options.push({ value: `${ano}-Q${q}`, label: `Q${q} ${ano}` });
    q -= 1;
    if (q === 0) { q = 4; ano -= 1; }
  }
  return options;
}
