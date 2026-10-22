/*
  Guarda de estilo do ADMIN (Prompt 46, D5) — vale para src/app/(dashboard)/admin e src/components/admin, somada à guarda
  geral (estilo-padrao.test.ts, que já cobre src/ inteiro: sombra, raio, espaço, gradiente, teto de 28 px):
    - peso só 400/600: nada de font-medium, font-light, font-thin, font-extralight;
    - selo de estado é pill branca com texto: nenhum fundo colorido (bg-amber-50, bg-red-100, bg-blue-50…), nem no hover;
    - cores do sistema: texto em tinta/secundário/apoio/forest; vermelho/âmbar só para estado; nada de azul, verde-água,
      roxo etc. (text-blue-700 em link era fora do sistema);
    - sem cartão de indicador (StatCard): número do admin vai em NumeroHeroi (um por tela) ou ListaNumeros;
    - o início do /admin abre com "Hoje você tem N decisões" e tem UM número-herói.
  Roda: node --test src/lib/estilo/estilo-admin.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = new URL("../../", import.meta.url).pathname;
const PASTAS = ["app/(dashboard)/admin", "components/admin"];

function arquivos(pasta: string): string[] {
  const out: string[] = [];
  for (const nome of readdirSync(join(SRC, pasta))) {
    const rel = `${pasta}/${nome}`;
    if (statSync(join(SRC, rel)).isDirectory()) out.push(...arquivos(rel));
    else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) out.push(rel);
  }
  return out;
}
const TODOS = PASTAS.flatMap(arquivos);
const ler = (p: string) => readFileSync(join(SRC, p), "utf8");

const VARIANTES = String.raw`(?:[a-z0-9-]+(?:\[[^\]\s]*\])?:)*!?`;
const MATIZ_FORA = "(?:blue|sky|indigo|violet|purple|pink|fuchsia|cyan|teal|lime|emerald|green|yellow|orange|rose|slate|gray|zinc|neutral|stone)";
const MATIZ_ESTADO = "(?:amber|red)";
const RE_PESO = new RegExp(String.raw`(?:^|[\s"'\`{(])${VARIANTES}(font-(?:medium|light|thin|extralight))(?=$|[\s"'\`{}),;])`, "g");
const RE_FUNDO = new RegExp(String.raw`(?:^|[\s"'\`{(])${VARIANTES}(bg-(?:${MATIZ_FORA}|${MATIZ_ESTADO})-\d{2,3}(?:\/\d+)?)(?=$|[\s"'\`{}),;])`, "g");
const RE_COR_FORA = new RegExp(String.raw`(?:^|[\s"'\`{(])${VARIANTES}((?:text|border|ring|divide|decoration)-${MATIZ_FORA}-\d{2,3}(?:\/\d+)?)(?=$|[\s"'\`{}),;])`, "g");

function violacoes(re: RegExp): string[] {
  const out: string[] = [];
  for (const arq of TODOS) {
    ler(arq)
      .split("\n")
      .forEach((l, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(l)) return;
        for (const m of l.matchAll(re)) out.push(`${arq}:${i + 1} ${m[1]}`);
      });
  }
  return out;
}

test("o alcance tem as telas do admin (sanidade)", () => {
  assert.ok(TODOS.length > 50, `só ${TODOS.length} arquivos`);
  assert.ok(TODOS.includes("app/(dashboard)/admin/page.tsx"));
  assert.ok(TODOS.includes("components/admin/numeros.tsx"));
});

test("peso só 400/600 no admin (sem font-medium/light/thin)", () => {
  assert.deepEqual(violacoes(RE_PESO), []);
});

test("nenhum fundo colorido no admin: selo é pill branca com texto, aviso é caixa branca com borda fina", () => {
  assert.deepEqual(violacoes(RE_FUNDO), []);
});

test("só as cores do sistema no admin (tinta, secundário, apoio, forest; vermelho/âmbar só para estado)", () => {
  assert.deepEqual(violacoes(RE_COR_FORA), []);
});

test("selo (rounded-full) é pill branca: sem fundo sage/surface", () => {
  const out: string[] = [];
  for (const arq of TODOS) {
    ler(arq)
      .split("\n")
      .forEach((l, i) => {
        for (const m of l.matchAll(/"[^"\n]*"|`[^`]*`/g)) {
          const c = m[0];
          if (/(?:^|[\s"`])rounded-full(?=$|[\s"`])/.test(c) && /(?:^|[\s"`])bg-(?:sage|surface|forest|gold)(?:-\d+)?(?=$|[\s"`])/.test(c)) out.push(`${arq}:${i + 1}`);
        }
      });
  }
  assert.deepEqual(out, []);
});

test("sem cartão de indicador (StatCard) no admin", () => {
  assert.deepEqual(TODOS.filter((a) => /\bStatCard\b/.test(ler(a))), []);
});

test("início do /admin: decisões primeiro, um número-herói, números em lista com divisor fino", () => {
  const pagina = ler("app/(dashboard)/admin/page.tsx");
  const cliente = ler("app/(dashboard)/admin/visao-geral-client.tsx");
  assert.ok(pagina.indexOf("<DecisoesHoje") < pagina.indexOf("<VisaoGeralClient"), "as decisões vêm antes dos números");
  assert.equal((cliente.match(/<NumeroHeroi\b/g) ?? []).length, 1, "um número-herói só");
  assert.match(cliente, /<ListaNumeros itens=\{agoraItens\} testId="home-agora" \/>/);
  assert.match(cliente, /divide-y divide-line border-y border-line/);
  assert.doesNotMatch(cliente, /Sparkline|<Funil\b|PrecisaAgora/);
  const numeros = ler("components/admin/numeros.tsx");
  assert.match(numeros, /tituloDecisoesAdmin\(total\)/);
  assert.match(numeros, /variant="secondary" size="sm"/, "o botão da decisão é secundário (o primário é único por tela)");
});

test("um número-herói por tela do admin, no máximo", () => {
  const muitos = TODOS.filter((a) => (ler(a).match(/<NumeroHeroi\b/g) ?? []).length > 1);
  assert.deepEqual(muitos, []);
});
