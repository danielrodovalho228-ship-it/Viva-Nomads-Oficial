import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";
import { AVISO_LISTA_INCOMPLETA, LINHAS_POR_PAGINA, TETO_DE_PAGINAS, lerSeparandoContasDeTeste } from "./leitura-por-paginas.ts";

/*
  E1170 (ORDENS-DUET 740, 745 e 759; linha Parceiros). As duas listas de /admin/avaliadores — "Recusas e ausências" e
  "Propostas expiradas ou descartadas" — liam as 50 linhas mais recentes e SÓ DEPOIS separavam as de conta de teste.
  Com 50 ou mais linhas de teste recentes, as reais mais antigas não chegavam a ser lidas: a lista de trabalho saía
  curta e o número do topo contava menos do que havia.
  A cura aprovada (forma 1): a leitura vai por páginas até a lista de trabalho encher, sem migração; o teto é de 20
  páginas; se o teto for atingido, a tela avisa. O critério continua a ser o DONO DO PEDIDO (ORDEM-740).
  Roda: node --test src/lib/vistoria/e1170-contas-de-teste-antes-do-limite.test.ts
*/
type Linha = { id: string; dono: string | null };
const TESTE = new Set(["dono-teste"]);
const linhas = (n: number, dono: string | null, prefixo: string): Linha[] => Array.from({ length: n }, (_, i) => ({ id: `${prefixo}-${i + 1}`, dono }));
/** Um banco de mentira: devolve a fatia pedida e conta as páginas lidas. */
function banco(todas: Linha[]) {
  const pedidos: [number, number][] = [];
  const ler = async (de: number, ate: number) => {
    pedidos.push([de, ate]);
    return { data: todas.slice(de, ate + 1), error: null };
  };
  return { ler, pedidos };
}
const dono = (l: Linha) => l.dono;
const ids = (l: readonly Linha[]) => l.map((x) => x.id);

test("E1170 (1): 60 linhas de teste recentes e 3 reais mais antigas — as 3 reais chegam à lista de trabalho", async () => {
  const b = banco([...linhas(60, "dono-teste", "t"), ...linhas(3, "dono-real", "r")]);
  const r = await lerSeparandoContasDeTeste<Linha>(b.ler, dono, TESTE);
  assert.equal(r.error, null);
  assert.equal(r.incompleta, false);
  // Antes: só as 50 primeiras eram lidas, todas de teste, e as reais sumiam.
  assert.deepEqual(ids((r.data ?? []).filter((l) => l.dono === "dono-real")), ["r-1", "r-2", "r-3"]);
  // As de teste têm o seu próprio limite: as 50 mais recentes.
  assert.equal((r.data ?? []).filter((l) => l.dono === "dono-teste").length, LINHAS_POR_PAGINA);
  assert.deepEqual(b.pedidos, [[0, 49], [50, 99]], "duas páginas: a segunda veio curta, acabou");
});

test("E1170 (2): com a lista de trabalho cheia logo na 1ª página, lê uma página só — nenhum custo a mais", async () => {
  const b = banco([...linhas(70, "dono-real", "r"), ...linhas(5, "dono-teste", "t")]);
  const r = await lerSeparandoContasDeTeste<Linha>(b.ler, dono, TESTE);
  assert.equal((r.data ?? []).length, LINHAS_POR_PAGINA);
  assert.equal(r.incompleta, false);
  assert.deepEqual(b.pedidos, [[0, 49]]);
});

test("E1170 (3): a ordem do banco é mantida, e cada lista para no seu limite", async () => {
  // Intercaladas: real, teste, real, teste… 140 linhas. A lista de trabalho enche na 2ª página.
  const todas = Array.from({ length: 140 }, (_, i) => ({ id: `l-${i + 1}`, dono: i % 2 === 0 ? "dono-real" : "dono-teste" }));
  const b = banco(todas);
  const r = await lerSeparandoContasDeTeste<Linha>(b.ler, dono, TESTE);
  const reais = (r.data ?? []).filter((l) => l.dono === "dono-real");
  const deTeste = (r.data ?? []).filter((l) => l.dono === "dono-teste");
  assert.equal(reais.length, 50);
  assert.equal(deTeste.length, 50);
  assert.deepEqual(ids(r.data ?? []), ids(todas.slice(0, 100)), "as 100 primeiras, na ordem em que o banco as deu");
  assert.deepEqual(b.pedidos, [[0, 49], [50, 99]]);
});

test("E1170 (4): o critério é o dono do pedido — linha sem dono conhecido conta como real", async () => {
  const b = banco([...linhas(55, "dono-teste", "t"), { id: "sem-dono", dono: null }, { id: "real", dono: "outro-dono" }]);
  const r = await lerSeparandoContasDeTeste<Linha>(b.ler, dono, TESTE);
  assert.deepEqual(ids((r.data ?? []).filter((l) => l.dono !== "dono-teste")), ["sem-dono", "real"]);
});

test("E1170 (5): o teto de páginas — 20 páginas só de teste e ainda há mais: para, e diz que a lista pode estar incompleta", async () => {
  const b = banco([...linhas(TETO_DE_PAGINAS * LINHAS_POR_PAGINA + 10, "dono-teste", "t"), ...linhas(2, "dono-real", "r")]);
  const r = await lerSeparandoContasDeTeste<Linha>(b.ler, dono, TESTE);
  assert.equal(b.pedidos.length, TETO_DE_PAGINAS, "nunca mais de 20 leituras");
  assert.equal(r.incompleta, true);
  assert.equal(r.error, null);
  assert.equal((r.data ?? []).length, LINHAS_POR_PAGINA, "as 50 de teste mais recentes; as reais ficaram para lá do teto");
  assert.equal(TETO_DE_PAGINAS, 20);
  assert.equal(LINHAS_POR_PAGINA, 50);
  assert.equal(AVISO_LISTA_INCOMPLETA, "A lista pode estar incompleta: há mais registros do que a página lê.");
});

test("E1170 (6): o fim exato dos dados não é teto — 20 páginas cheias e mais nenhuma linha: lista completa, sem aviso", async () => {
  const exatas = banco(linhas(100, "dono-teste", "t"));
  const r = await lerSeparandoContasDeTeste<Linha>(exatas.ler, dono, TESTE);
  assert.equal(r.incompleta, false);
  assert.deepEqual(exatas.pedidos, [[0, 49], [50, 99], [100, 149]], "a 3ª página veio vazia: acabou");
  // No limite do teto, com os dados a acabarem exatamente na 20ª página, não há como saber sem ler a 21ª: avisa.
  const noTeto = banco(linhas(TETO_DE_PAGINAS * LINHAS_POR_PAGINA, "dono-teste", "t"));
  assert.equal((await lerSeparandoContasDeTeste<Linha>(noTeto.ler, dono, TESTE)).incompleta, true);
});

test("E1170 (7): a leitura que falha numa página devolve o erro — nunca uma lista curta que parece certa", async () => {
  let n = 0;
  const ler = async (de: number, ate: number) => {
    n++;
    return n === 2 ? { data: null, error: { message: "falhou na 2ª página" } } : { data: linhas(ate - de + 1, "dono-teste", `p${n}`), error: null };
  };
  const r = await lerSeparandoContasDeTeste<Linha>(ler, dono, TESTE);
  assert.equal(r.data, null);
  assert.equal(r.error?.message, "falhou na 2ª página");
  assert.equal(r.incompleta, false);
});

test("E1170 (estático): as três leituras da página vão por páginas, com desempate, e a tela só avisa no teto", () => {
  const pagina = semComentarios(readFileSync("src/app/(dashboard)/admin/avaliadores/page.tsx", "utf8"));
  // As recusas e as duas colunas das propostas: ordem pela data, desempate pelo id, e a fatia pedida.
  for (const coluna of ["respondido_em", "proposta_expirada_em", "proposta_descartada_em"]) {
    assert.ok(pagina.includes(`.gte("${coluna}", trintaDias).order("${coluna}", { ascending: false }).order("id", { ascending: false }).range(de, ate)`), coluna);
  }
  assert.equal((pagina.match(/lerSeparandoContasDeTeste</g) ?? []).length, 3);
  // Nenhuma das três volta a cortar antes de separar.
  const rodada = pagina.slice(pagina.indexOf("const [fila_rodizio, recusasLeitura"), pagina.indexOf("const [{ data: recusas }"));
  assert.doesNotMatch(rodada, /vistoria_designacoes[^\n]*\.limit\(/);
  // O critério: o dono do pedido, pelas contas de teste da Central, nas três.
  assert.equal((rodada.match(/, DONO_DO_PEDIDO, contasDeTesteDaCentral\)/g) ?? []).length, 3);
  assert.match(pagina, /const DONO_DO_PEDIDO = \(l: \{ vistoria_pedidos: \{ owner_id: string \| null \} \| null \}\) => l\.vistoria_pedidos\?\.owner_id;/);
  // O aviso: um por lista, só quando a leitura bateu no teto.
  assert.match(pagina, /\{recusasLeitura\.incompleta && <p [^>]*data-testid="recusas-incompletas">\{AVISO_LISTA_INCOMPLETA\}<\/p>\}/);
  assert.match(pagina, /\{\(expiradasLeitura\.incompleta \|\| descartadasLeitura\.incompleta\) && <p [^>]*data-testid="propostas-incompletas">\{AVISO_LISTA_INCOMPLETA\}<\/p>\}/);
  assert.equal((pagina.match(/AVISO_LISTA_INCOMPLETA\}/g) ?? []).length, 2);
  // A frase mora num lugar só.
  assert.doesNotMatch(pagina, /pode estar incompleta/);
});
