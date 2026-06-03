import fs from "fs/promises";
import path from "path";
import type { ParsedPlaybook } from "./types";

const PLAYBOOK_PATH = path.resolve(
  process.cwd(),
  "server/playbooks/ads-optimization.md",
);

function parseWhitelist(md: string): string[] {
  const sectionMatch = md.match(/## Campanhas protegidas[\s\S]*?```([\s\S]*?)```/);
  if (!sectionMatch) return [];
  return sectionMatch[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function parseConfig(md: string): {
  janelaDias: number;
  cooldownHoras: number;
  knownProdutos: string[];
} {
  let janelaDias = 14;
  let cooldownHoras = 48;

  const janelaMatch = md.match(
    /Janela de avalia[çc][ãa]o[^:]*:\s*[úu]ltimos\s+(\d+)\s+dias/i,
  );
  if (janelaMatch) janelaDias = parseInt(janelaMatch[1], 10);

  const cooldownMatch = md.match(/Cooldown:[^\d]*(\d+)\s*horas/i);
  if (cooldownMatch) cooldownHoras = parseInt(cooldownMatch[1], 10);

  // Lista canônica de produtos (usada pra extrair [Produto] do nome da campanha
  // e pra confirmar match com funis de meta_ads.growth_budgets).
  const produtosMatch = md.match(
    /## Produtos reconhecidos[\s\S]*?```([\s\S]*?)```/,
  );
  const knownProdutos = produtosMatch
    ? produtosMatch[1]
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
    : ["Creators", "Ecommerce", "Comercial", "Comunidade"];

  return { janelaDias, cooldownHoras, knownProdutos };
}

let cached: { mtimeMs: number; playbook: ParsedPlaybook } | null = null;

export async function loadPlaybook(): Promise<ParsedPlaybook> {
  const stat = await fs.stat(PLAYBOOK_PATH);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached.playbook;
  }
  const md = await fs.readFile(PLAYBOOK_PATH, "utf-8");
  const { janelaDias, cooldownHoras, knownProdutos } = parseConfig(md);
  const playbook: ParsedPlaybook = {
    janelaAvaliacaoDias: janelaDias,
    cooldownHoras,
    whitelistPatterns: parseWhitelist(md),
    knownProdutos,
    rawMarkdown: md,
  };
  cached = { mtimeMs: stat.mtimeMs, playbook };
  return playbook;
}

export function isWhitelisted(
  entityName: string | null,
  entityId: string,
  patterns: string[],
): boolean {
  for (const pattern of patterns) {
    if (pattern === entityId) return true;
    const regex = globToRegex(pattern);
    if (entityName && regex.test(entityName)) return true;
  }
  return false;
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

const PRODUCT_TOKEN_BLACKLIST = new Set([
  "TP",
  "Leads",
  "Vendas",
  "Tráfego",
  "Trafego",
  "Reconhecimento",
  "ABO",
  "CBO",
  "CLASS",
  "COMMERCE",
]);

export function extractProduto(
  campaignName: string,
  knownProdutos: string[],
): string | null {
  const matches = campaignName.match(/\[([^\]]+)\]/g);
  if (!matches) return null;

  for (const m of matches) {
    const token = m.slice(1, -1).trim();
    if (PRODUCT_TOKEN_BLACKLIST.has(token)) continue;
    const known = knownProdutos.find(
      (p) => p.toLowerCase() === token.toLowerCase(),
    );
    if (known) return known;
  }
  return null;
}
