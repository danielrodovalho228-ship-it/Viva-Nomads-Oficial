/*
  Ordem a8c05cd0 (Daniel, 14/10), item 5 + item 8(c), parte 1 (faixa A): a palavra "inquilino" sai do texto que a pessoa
  LÊ no site e no painel ("você", "morador", "quem pediu"). Nomes internos (tabela, papel "inquilino", data-testid, rota
  /api/upload/inquilino-doc) NÃO mudam. Exceções da ordem: /termos, /privacidade e o texto dos modelos de contrato.
  Fora desta parte (faixa B: contrato, fechamento, documento do morador, manutenção, atendimento) e o admin interno.
  Roda: node --test src/lib/vocabulario/sem-inquilino.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { STATUS_CONVERSA } from "../pedidos/mural-dono.ts";
import { validarInteresse } from "../cidades-liberadas/regras.ts";
import { llmsTxt, llmsFullTxt } from "../seo/llms.ts";

const PALAVRA = /\b[Ii]nquilin[oa]s?\b/;
const ler = (f: string) => readFileSync(f, "utf8");

/**
 * Texto visível de um arquivo .tsx/.ts: texto de JSX (entre > e <) e literais de string com espaço (frases). Comentários
 * saem antes; em .ts (sem JSX) só os literais. Identificadores, chaves de objeto e valores de uma palavra (ex.: papel "inquilino") não contam.
 */
function frasesComInquilino(fonte: string, tsx = true): string[] {
  const semComentario = fonte
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  // Texto de JSX: depois de ">" (ou de "}" de uma expressão no meio da frase) até o próximo "<" ou "{". Depois de "}",
  // só conta se não parece código (sem =, ; ou =>).
  // O ">" de "=>" não abre texto.
  const jsx = !tsx ? [] : [...semComentario.matchAll(/(?<!=)([>}])([^<>{}]+)(?=[<{])/g)]
    .filter((m) => m[1] === ">" || !/[=;]/.test(m[2]))
    .map((m) => m[2]);
  return [...jsx, ...literaisComEspaco(semComentario)].map((t) => t.trim()).filter((t) => PALAVRA.test(t));
}

/** Literais de string lidos em sequência (abre e fecha com a mesma aspa, respeitando "\"), só os que têm espaço (frases). */
function literaisComEspaco(codigo: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < codigo.length; i++) {
    const q = codigo[i];
    if (q !== '"' && q !== "'" && q !== "`") continue;
    let j = i + 1;
    while (j < codigo.length && codigo[j] !== q && (q === "`" || codigo[j] !== "\n")) j += codigo[j] === "\\" ? 2 : 1;
    const corpo = codigo.slice(i + 1, j);
    if (/\s/.test(corpo)) out.push(corpo);
    i = j;
  }
  return out;
}

function arquivos(dir: string, fora: RegExp[] = []): string[] {
  const out: string[] = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (fora.some((r) => r.test(p))) continue;
    if (statSync(p).isDirectory()) out.push(...arquivos(p, fora));
    else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

test("o detector acha a frase e ignora identificadores e valores de uma palavra", () => {
  assert.deepEqual(frasesComInquilino(`<p>O inquilino paga</p>`), ["O inquilino paga"]);
  assert.deepEqual(frasesComInquilino(`<p>{n} candidatos, verificação do inquilino {valor}</p>`), ["candidatos, verificação do inquilino"]);
  assert.deepEqual(frasesComInquilino(`if (x) { a(); } else if (papel === "inquilino") { b(); }`), []);
  assert.deepEqual(frasesComInquilino(`const x = { inquilino: "Morador" }; papel === "inquilino"; // o inquilino`), []);
  assert.deepEqual(frasesComInquilino(`/* Inquilino verificado */ const a = "Morador verificado";`), []);
});

test("página do imóvel: avaliação de quem morou assina 'Morador verificado'", () => {
  const fonte = ler("src/lib/data/properties.ts");
  assert.deepEqual(frasesComInquilino(fonte, false), []);
  assert.match(fonte, /author: "Morador verificado"/);
});

test("pedidos de moradia: o mural do dono e o aviso de aceite falam de morador", () => {
  for (const v of Object.values(STATUS_CONVERSA)) assert.doesNotMatch(v, PALAVRA, v);
  assert.deepEqual(frasesComInquilino(ler("src/lib/pedidos/notify-templates.ts"), false), []);
});

test("interesse por cidade: o erro de papel não diz 'inquilino'", () => {
  const r = validarInteresse({ cidade: "Uberlândia", uf: "MG", papel: "x" });
  assert.equal(r.ok, false);
  assert.doesNotMatch(r.ok ? "" : r.erro, PALAVRA);
});

test("llms.txt e llms-full.txt (texto público para buscadores de IA) sem 'inquilino'", () => {
  assert.doesNotMatch(llmsTxt("https://vivanomads.com.br"), PALAVRA);
  assert.doesNotMatch(llmsFullTxt("https://vivanomads.com.br"), PALAVRA);
});

test("telas públicas e componentes (página do imóvel, modelo de negócio, menus): nenhuma frase visível com 'inquilino'", () => {
  const lista = [
    ...arquivos("src/app/(public)", [/[/\\]termos$/, /[/\\]privacidade$/]),
    ...arquivos("src/components"),
    "src/lib/cobranca/regra.ts",
  ];
  const achados = lista.flatMap((f) => frasesComInquilino(ler(f), f.endsWith(".tsx")).map((t) => `${f}: ${t.slice(0, 90)}`));
  assert.deepEqual(achados, []);
});
