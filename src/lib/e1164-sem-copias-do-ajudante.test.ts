import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/*
  E1164 (ORDEM-DUET-687/714): as travas de unidade que leem o código-fonte tiram os comentários com o ajudante único
  `src/lib/fonte-sem-comentarios.ts`, nunca com uma cópia. A cópia antiga ("/\\*[\\s\\S]*?\\*\\/" em qualquer ponto) toma o
  "/*" de um texto — `accept="application/pdf,image/*"` — por começo de comentário e apaga o código até ao comentário
  seguinte: a trava passa a ler uma tela sem as linhas que diz conferir.
  A troca vai em fatias (até 15 arquivos por PR). Esta varredura:
   1. proíbe cópia nova: um arquivo com cópia fora da lista PENDENTES falha;
   2. obriga a lista a encolher: um arquivo da lista que já não tem cópia falha até sair dela.
  Roda: node --test src/lib/e1164-sem-copias-do-ajudante.test.ts
*/

/** A assinatura da cópia: a expressão que apaga de "/*" até "*\/" em qualquer ponto ([\s\S] ou [^]). */
const COPIA = /\\\/\\\*\[(?:\\s\\S|\^)\]\*\?\\\*\\\//;

/** Ainda por trocar: os arquivos que estão em PRs abertos (entram quando esses PRs saírem). Só encolhe. */
const PENDENTES = new Set([
  "src/lib/estilo/estilo-padrao.test.ts", // #3812, #3822
]);

/**
 * Exceções nomeadas (ORDEM-DUET-730): a assinatura aparece, mas não é uma cópia do ajudante. Cada uma com a razão.
 */
const EXCECOES = new Map<string, string>([
  ["scripts/lab/gerar-cobertura.mjs", "ferramenta da cobertura, não trava: só tira o cabeçalho de comentários; adota a fonte única quando o pacote do resolver entrar"],
  ["src/components/layout/logo-sem-link-aninhado.test.ts", "não tira comentários: a expressão casa no produto o padrão <Link>{/* … */}<Logo"],
  ["src/lib/rotas-remissoes/e916-404-rodape-busca.test.ts", "não tira comentários: a expressão casa no produto o padrão <header>{/* … */}<Logo"],
]);

const AJUDANTE = new Set(["src/lib/fonte-sem-comentarios.ts", "src/lib/fonte-sem-comentarios.test.ts", "src/lib/e1164-sem-copias-do-ajudante.test.ts"]);

function arquivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n.startsWith(".")) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...arquivos(p));
    else if (/\.(ts|tsx|mts|mjs)$/.test(n)) out.push(p);
  }
  return out;
}

const comCopia = ["src", "tests", "scripts"].flatMap(arquivos).filter((f) => !AJUDANTE.has(f) && COPIA.test(readFileSync(f, "utf8"))).sort();

test("E1164: nenhuma cópia nova do ajudante que tira comentários (use src/lib/fonte-sem-comentarios.ts)", () => {
  assert.deepEqual(comCopia.filter((f) => !PENDENTES.has(f) && !EXCECOES.has(f)), []);
});

test("E1164: cada exceção nomeada tem a razão escrita e ainda tem a assinatura (senão sai da lista)", () => {
  for (const [f, razao] of EXCECOES) {
    assert.ok(razao.trim().length >= 20, `${f}: a razão está escrita`);
    assert.ok(comCopia.includes(f), `${f}: já não tem a assinatura — sai das exceções`);
  }
});

test("E1164: a lista dos pendentes só encolhe — o arquivo já trocado sai dela", () => {
  assert.deepEqual([...PENDENTES].filter((f) => !comCopia.includes(f)).sort(), []);
});

test("E1164: a assinatura reconhece a cópia e não o ajudante", () => {
  assert.ok(COPIA.test('s.replace(/\\/\\*[\\s\\S]*?\\*\\//g, "")'));
  assert.ok(COPIA.test('s.replace(/\\/\\*[^]*?\\*\\//g, "")'));
  assert.ok(!COPIA.test('import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";'));
});
