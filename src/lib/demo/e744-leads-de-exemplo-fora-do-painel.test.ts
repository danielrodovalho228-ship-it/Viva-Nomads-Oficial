/*
  E744, varredura dos dados de exemplo no JavaScript do painel (família do E975/E980). Depois da persona (t1674) e dos
  anúncios de exemplo (t1675), a varredura das 42 telas achou mais um caso: os LEADS de exemplo ("Rafael L.",
  "Júlia M."…) iam no JavaScript da tela Interessados (/dashboard/leads), para toda conta. A tela importa só as funções
  puras `leadScore` e `leadSummary`, mas elas moravam no mesmo arquivo dos leads fictícios (src/lib/data/lead-types.ts),
  e o arquivo inteiro ia junto. Os leads de exemplo ganharam um arquivo só deles, que só o servidor e o seed do modo
  demonstração (carregado sob demanda, E980) importam.
  Roda: node --test src/lib/demo/e744-leads-de-exemplo-fora-do-painel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

const SRC = new URL("../../", import.meta.url).pathname;
const arquivos = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
const rel = (p: string) => p.slice(SRC.length);
const ler = (p: string) => readFileSync(join(SRC, p), "utf8");

/** Arquivos que importam (valor, não só tipo) o módulo `alvo` (caminho a partir de src, sem extensão). */
function importamValor(pastas: string[], alvo: string): string[] {
  const destino = join(SRC, alvo);
  return pastas
    .flatMap((p) => arquivos(join(SRC, p)))
    .filter((p) =>
      [...readFileSync(p, "utf8").matchAll(/^\s*(import|export)\s+(?!type\b)[^;]*?from\s*["']([^"']+)["']/gm)].some(([, , de]) => {
        const caminho = de.startsWith("@/") ? join(SRC, de.slice(2)) : de.startsWith(".") ? join(dirname(p), de) : "";
        return caminho.replace(/\.ts$/, "") === destino;
      }),
    )
    .map(rel)
    .sort();
}

/** Nomes dos leads fictícios: não podem estar no arquivo que as telas importam. */
const NOMES_FICTICIOS = [/Ana C\./, /Rafael L\./, /J[úu]lia M\./];

test("o arquivo dos tipos e funções de Lead (o que as telas importam) não carrega lead fictício", () => {
  const tipos = ler("lib/data/lead-types.ts");
  assert.doesNotMatch(tipos, /SAMPLE_LEADS/);
  for (const nome of NOMES_FICTICIOS) assert.doesNotMatch(tipos, nome);
  assert.doesNotMatch(tipos, /^\s*import\b/m, "continua sem importar nada: é o arquivo puro que cliente e servidor usam");
});

test("os leads de exemplo têm arquivo próprio, com os mesmos três de antes", async () => {
  const exemplos = ler("lib/data/lead-exemplos.ts");
  // Só o tipo vem de fora: o arquivo não puxa mais nada para dentro do pacote de quem o importar.
  assert.deepEqual([...exemplos.matchAll(/^\s*import\s+(?!type\b)/gm)], []);
  const { SAMPLE_LEADS } = await import("../data/lead-exemplos.ts");
  assert.deepEqual(
    SAMPLE_LEADS.map((l: { id: string; name: string; property: string; light: string }) => [l.id, l.name, l.property, l.light]),
    [
      ["1", "Ana C.", "Apto Santa Mônica", "green"],
      ["2", "Rafael L.", "Studio Centro", "green"],
      ["3", "Júlia M.", "Apto Santa Mônica", "yellow"],
    ],
  );
});

test("só o servidor (leads.ts) e o seed do modo demonstração importam os leads de exemplo", () => {
  assert.deepEqual(importamValor(["app", "components", "lib", "config", "hooks"].filter((p) => existe(p)), "lib/data/lead-exemplos"), ["lib/data/leads.ts", "lib/demo/seed.ts"]);
});

test("nenhum arquivo de cliente importa o módulo de servidor dos leads (que reexporta os exemplos)", () => {
  const deCliente = importamValor(["app", "components", "lib"], "lib/data/leads").filter((p) => /^\s*["']use client["']/m.test(ler(p)));
  assert.deepEqual(deCliente, []);
});

test("o seed do modo demonstração continua com os mesmos leads (os três de exemplo e os próprios)", () => {
  const seed = ler("lib/demo/seed.ts");
  assert.match(seed, /import \{ SAMPLE_LEADS \} from "@\/lib\/data\/lead-exemplos";/);
  assert.match(seed, /\.\.\.SAMPLE_LEADS\.map\(\(l\) => \(\{ \.\.\.l, _demo: true as const \}\)\),/);
});

function existe(pasta: string): boolean {
  try {
    return statSync(join(SRC, pasta)).isDirectory();
  } catch {
    return false;
  }
}
