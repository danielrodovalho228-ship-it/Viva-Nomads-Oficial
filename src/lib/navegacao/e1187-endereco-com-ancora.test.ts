/*
  E1187 (ORDENS-DUET 833, 841, 845 e 850; Central, com a cura na casca).
  Uma âncora simples é um salto do navegador: o roteador não sabe dele e, quando uma ação de servidor responde a dizer
  que a página mudou, volta a escrever o endereço sem a âncora e empurra uma entrada a mais no histórico. Na área da
  equipe isso acontece logo ao abrir a tela (as leituras da casca).
  A cura (candidata B): um ouvinte na casca reescreve o MESMO endereço pelo histórico, que o roteador acompanha. Não
  toca no toque nem na rolagem — os números de "Para decidir" continuam âncoras simples (E1184).
  Travado aqui:
   1. sem âncora no endereço, a regra não escreve nada (inerte nas cargas comuns);
   2. com âncora numa entrada que já é do roteador, não escreve nada;
   3. com âncora numa entrada só do navegador, reescreve o mesmo endereço uma vez, sem criar entrada nova;
   4. o ouvinte só ouve a mudança de âncora e chama a regra: não trata cliques, não rola, não empurra histórico;
   5. o ouvinte está na casca, uma vez só, e os números da Central continuam âncoras simples.
  A prova de tela (leituras da sessão atrasadas) é a t1784.
  Roda: node --test src/lib/navegacao/e1187-endereco-com-ancora.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { contarAncoraAoRoteador, type JanelaComHistorico } from "./endereco-com-ancora.ts";
import { fonteSemComentarios } from "../fonte-sem-comentarios.ts";

const RAIZ = new URL("../../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");

type Escrita = { estado: unknown; url: string };
/** Uma janela de mentira: o endereço, o estado da entrada do histórico e as escritas que a regra fizer. */
function janela(endereco: string, estado: unknown): JanelaComHistorico & { escritas: Escrita[]; empurradas: number } {
  const url = new URL(endereco, "https://vivanomads.test");
  const j = {
    escritas: [] as Escrita[],
    empurradas: 0,
    location: { hash: url.hash, href: url.href },
    history: {
      state: estado,
      replaceState(e: unknown, _titulo: string, u: string) {
        j.escritas.push({ estado: e, url: u });
      },
      pushState() {
        j.empurradas++;
      },
    },
  };
  return j;
}
/** O estado que o roteador do Next deixa numa entrada que é dele. */
const DO_ROTEADOR = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: {} };

test("E1187 (1): sem âncora no endereço, a regra não escreve nada", () => {
  for (const [endereco, estado] of [
    ["/admin/avaliadores", DO_ROTEADOR],
    ["/admin/avaliadores", null],
    ["/dashboard/conta?aba=perfil", DO_ROTEADOR],
    ["/", null],
    // Só o "#", sem nome: o navegador dá a âncora vazia.
    ["/admin/avaliadores#", null],
  ] as const) {
    const j = janela(endereco, estado);
    assert.equal(contarAncoraAoRoteador(j), false, endereco);
    assert.deepEqual(j.escritas, [], endereco);
    assert.equal(j.empurradas, 0, endereco);
  }
});

test("E1187 (2): com âncora numa entrada que já é do roteador, não escreve nada", () => {
  // O link direto com âncora e o salto que o próprio roteador fez: ele já conhece o endereço.
  const j = janela("/admin/avaliadores#contestacoes", DO_ROTEADOR);
  assert.equal(contarAncoraAoRoteador(j), false);
  assert.deepEqual(j.escritas, []);
});

test("E1187 (3): com âncora numa entrada só do navegador, reescreve o MESMO endereço uma vez, sem entrada nova", () => {
  const j = janela("/admin/avaliadores#contestacoes", null);
  assert.equal(contarAncoraAoRoteador(j), true);
  assert.deepEqual(j.escritas, [{ estado: null, url: "https://vivanomads.test/admin/avaliadores#contestacoes" }]);
  assert.equal(j.empurradas, 0, "nunca empurra uma entrada nova");
  // Um estado que não é do roteador (outro código guardou algo na entrada) é preservado.
  const outro = { rolagem: 120 };
  const k = janela("/como-funciona?x=1#para-proprietarios", outro);
  assert.equal(contarAncoraAoRoteador(k), true);
  assert.deepEqual(k.escritas, [{ estado: outro, url: "https://vivanomads.test/como-funciona?x=1#para-proprietarios" }]);
});

test("E1187 (4): o ouvinte só ouve a mudança de âncora e chama a regra", () => {
  const ouvinte = fonteSemComentarios(ler("src/components/layout/endereco-com-ancora.tsx"));
  assert.match(ouvinte, /^"use client";/);
  assert.match(ouvinte, /window\.addEventListener\("hashchange", contar\)/);
  assert.match(ouvinte, /window\.removeEventListener\("hashchange", contar\)/);
  assert.match(ouvinte, /contarAncoraAoRoteador\(window\)/);
  assert.match(ouvinte, /return null;/, "não desenha nada");
  // Não toca no toque nem na rolagem (E1184), nem empurra histórico.
  assert.equal((ouvinte.match(/addEventListener\(/g) ?? []).length, 1, "um ouvinte só: o da mudança de âncora");
  assert.doesNotMatch(ouvinte, /"click"|onClick|preventDefault|scrollTo|scrollIntoView|pushState|replaceState|useRouter/);
  // A regra escreve pelo histórico (que o Next acompanha), o mesmo endereço, e nunca empurra.
  const regra = fonteSemComentarios(ler("src/lib/navegacao/endereco-com-ancora.ts"));
  assert.match(regra, /janela\.history\.replaceState\(estado, "", janela\.location\.href\)/);
  assert.doesNotMatch(regra, /pushState|scroll/);
});

test("E1187 (5): o ouvinte está na casca, uma vez só; os números da Central continuam âncoras simples", () => {
  const casca = fonteSemComentarios(ler("src/app/layout.tsx"));
  assert.match(casca, /import \{ EnderecoComAncora \} from "@\/components\/layout\/endereco-com-ancora";/);
  assert.equal((casca.match(/<EnderecoComAncora \/>/g) ?? []).length, 1, "uma vez no layout raiz");
  // Em mais nenhum lugar do código: um só sítio para a correção.
  const outros: string[] = [];
  const andar = (dir: string) => {
    for (const nome of readdirSync(join(RAIZ, dir))) {
      const rel = `${dir}/${nome}`;
      if (statSync(join(RAIZ, rel)).isDirectory()) andar(rel);
      else if (/\.tsx$/.test(nome) && rel !== "src/app/layout.tsx" && /<EnderecoComAncora\b/.test(ler(rel))) outros.push(rel);
    }
  };
  andar("src");
  assert.deepEqual(outros, [], "o ouvinte montado fora da casca");
  // E1184 não se desfaz: os números continuam âncoras simples, sem tratador de clique.
  const central = ler("src/app/(dashboard)/admin/avaliadores/page.tsx");
  assert.match(central, /<a href=\{n\.ancora\} className="block rounded-xl border border-line p-4 hover:border-forest" data-testid=\{`decidir-numero-\$\{n\.chave\}`\}/);
});
