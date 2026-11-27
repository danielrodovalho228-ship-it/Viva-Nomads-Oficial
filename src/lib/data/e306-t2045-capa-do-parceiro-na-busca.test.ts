/*
  t2045 · E306 (Pista 3, cobertura do mapa das 142; ORDEM-DUET-073 ponto 3) @E306 @ao-vivo-seguro (unitário, sem rede)
  Regra (E306, 01/11): na busca de parceiros, quem NÃO enviou capa aparece com uma foto DELE — a 1ª da galeria (pela
  ordem), não a foto genérica da categoria; quem tem capa usa a capa; tudo numa consulta só à galeria, e só para os sem capa.
  Corre o buscarParceiros REAL com o Supabase público em memória (dublês só nas bordas, ver e306-harness/), e a capa do
  cartão pela mesma capaDoParceiro da tela. A ponta "tela de produção" (cartão = página do parceiro) fica para o spec de
  visitante, que só prova num alvo com parceiros publicados.
  Roda: node --test src/lib/data/e306-t2045-capa-do-parceiro-na-busca.test.ts
*/
import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

register("./e306-harness/loader.mjs", import.meta.url);
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://lab.invalid";
const { buscarParceiros } = await import("../data/parceiros-publico.ts");
const { capaDoParceiro } = await import("../parceiros/apresentacao.ts");

type Linha = Record<string, unknown>;
function sbFalso(tabelas: Record<string, Linha[]>) {
  const consultas: { tabela: string; ids?: unknown[] }[] = [];
  return {
    consultas,
    from(tabela: string) {
      const filtros: ((l: Linha) => boolean)[] = [];
      let ordem: string | null = null;
      const reg: { tabela: string; ids?: unknown[] } = { tabela };
      consultas.push(reg);
      const executar = () => {
        let r = (tabelas[tabela] ?? []).filter((l) => filtros.every((f) => f(l)));
        if (ordem) r = [...r].sort((a, b) => Number(a[ordem!]) - Number(b[ordem!]));
        return { data: r, error: null };
      };
      const b = {
        select: () => b,
        limit: () => b,
        in: (c: string, vs: unknown[]) => ((reg.ids = vs), filtros.push((l) => vs.includes(l[c])), b),
        order: (c: string) => ((ordem = c), b),
        then: (ok: (r: unknown) => unknown) => Promise.resolve(executar()).then(ok),
      };
      return b;
    },
  };
}
const parceiro = (id: string, o: Linha = {}) => ({ id, slug: `p-${id}`, nome_publico: `Parceiro ${id}`, categorias: ["limpeza"], cidades: ["Uberlândia"], tipo_pessoa: "pj", teste: false, avatar_path: null, banner_path: null, ...o });
const URL = (path: string) => `https://lab.invalid/storage/v1/object/public/parceiros/${path}`;

test("E306: sem capa, o cartão usa a 1ª foto da galeria pela ORDEM (não a da categoria); com capa, a capa", async () => {
  const sb = sbFalso({
    parceiros_publicos: [parceiro("a"), parceiro("b", { banner_path: "b/capa.jpg" }), parceiro("c")],
    parceiro_galeria: [
      { parceiro_id: "a", path: "a/segunda.jpg", ordem: 2 },
      { parceiro_id: "a", path: "a/primeira.jpg", ordem: 1 },
      { parceiro_id: "b", path: "b/galeria.jpg", ordem: 1 },
    ],
  });
  (globalThis as unknown as { __E306: unknown }).__E306 = { sb };
  const r = await buscarParceiros({});
  const porId = new Map(r.lista.map((p) => [p.id, p]));
  assert.equal(porId.get("a")!.galeriaCapaUrl, URL("a/primeira.jpg"));
  assert.deepEqual(capaDoParceiro(porId.get("a")!), { src: URL("a/primeira.jpg"), alt: "Trabalho de Parceiro a", origem: "galeria" });
  // Com capa enviada: a capa vale, e a galeria dele nem é consultada.
  assert.equal(capaDoParceiro(porId.get("b")!)?.origem, "capa");
  assert.equal(porId.get("b")!.galeriaCapaUrl, undefined);
  // Sem capa e sem galeria: cai na foto da categoria (nunca vazio).
  assert.equal(capaDoParceiro(porId.get("c")!)?.origem, "categoria");
  // Uma consulta só à galeria, e só com os sem capa.
  const galeria = sb.consultas.filter((c) => c.tabela === "parceiro_galeria");
  assert.equal(galeria.length, 1);
  assert.deepEqual([...(galeria[0].ids ?? [])].sort(), ["a", "c"]);
});

test("E306: todos com capa → nenhuma consulta à galeria", async () => {
  const sb = sbFalso({ parceiros_publicos: [parceiro("x", { banner_path: "x/capa.jpg" })], parceiro_galeria: [{ parceiro_id: "x", path: "x/g.jpg", ordem: 1 }] });
  (globalThis as unknown as { __E306: unknown }).__E306 = { sb };
  const r = await buscarParceiros({});
  assert.equal(r.lista.length, 1);
  assert.equal(sb.consultas.filter((c) => c.tabela === "parceiro_galeria").length, 0);
});
