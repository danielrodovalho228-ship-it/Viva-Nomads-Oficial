/*
  E1183 (ORDEM-DUET-791; Central, nos intervalos). O item da "Fila da equipe" (/admin/avaliadores) mostrava só o rótulo
  e o motivo: a equipe não sabia de que imóvel nem de que avaliador era o item. Com os quatro tipos do laudo de volta à
  fila (E1179), nota-se mais.
  A cura: o item passa a dizer o avaliador e o imóvel, a partir dos dados do próprio pedido — no formato que a Central
  já usa nas outras listas ("nº UDI-002 · Título do anúncio · VN-XXXXXX").
  Roda: node --test src/lib/vistoria/e1183-item-da-fila-identifica.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { identificacaoDoItemDaFila, referenciasDaFila } from "./item-da-fila.ts";
import { identificacaoDoImovel } from "./pedido-avaliador.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

const ler = (p: string) => semComentarios(readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8"));
const IMOVEL = "0a1b2c3d-0000-4000-8000-000000000001";
const pedidos = new Map([
  ["pedido-1", { property_id: IMOVEL, avaliador_id: "cred-do-pedido" }],
  ["pedido-sem-avaliador", { property_id: IMOVEL, avaliador_id: null }],
]);
const numeros = new Map([
  ["cred-do-pedido", "UDI-002"],
  ["cred-do-item", "UDI-007"],
]);
const titulos = new Map([[IMOVEL, "Casa das Acácias"]]);
const dados = { pedidos, numeros, titulos };

test("E1183 (1): item com pedido — diz o avaliador do pedido e o imóvel, no formato das outras listas da Central", () => {
  assert.equal(identificacaoDoItemDaFila({ pedido_id: "pedido-1", avaliador_id: null }, dados), `nº UDI-002 · ${identificacaoDoImovel("Casa das Acácias", IMOVEL)}`);
  assert.match(identificacaoDoItemDaFila({ pedido_id: "pedido-1", avaliador_id: null }, dados) ?? "", /^nº UDI-002 · Casa das Acácias · VN-[A-Z0-9]{6}$/);
});

test("E1183 (2): o avaliador que o próprio item traz vale mais do que o do pedido", () => {
  // Ex.: a devolução não confirmada é do PRIMEIRO avaliador; o pedido da contestação já é de outro.
  assert.match(identificacaoDoItemDaFila({ pedido_id: "pedido-1", avaliador_id: "cred-do-item" }, dados) ?? "", /^nº UDI-007 · Casa das Acácias · VN-/);
});

test("E1183 (3): item só com avaliador (sem pedido) diz só o avaliador; item só com pedido sem avaliador diz só o imóvel", () => {
  assert.equal(identificacaoDoItemDaFila({ pedido_id: null, avaliador_id: "cred-do-item" }, dados), "nº UDI-007");
  assert.equal(identificacaoDoItemDaFila({ pedido_id: "pedido-sem-avaliador", avaliador_id: null }, dados), identificacaoDoImovel("Casa das Acácias", IMOVEL));
});

test("E1183 (4): o que não se sabe não se inventa — sem referência, ou com referência que a leitura não trouxe, a linha não aparece", () => {
  assert.equal(identificacaoDoItemDaFila({ pedido_id: null, avaliador_id: null }, dados), null);
  assert.equal(identificacaoDoItemDaFila({ pedido_id: "pedido-apagado", avaliador_id: "cred-apagado" }, dados), null);
  // Imóvel sem título: fica o código VN, como nas outras listas.
  assert.match(identificacaoDoItemDaFila({ pedido_id: "pedido-1", avaliador_id: null }, { ...dados, titulos: new Map() }) ?? "", /^nº UDI-002 · VN-[A-Z0-9]{6}$/);
});

test("E1183 (5): as referências a ler saem dos itens da fila, sem repetição", () => {
  const fila = [
    { pedido_id: "pedido-1", avaliador_id: null },
    { pedido_id: "pedido-1", avaliador_id: "cred-do-item" },
    { pedido_id: null, avaliador_id: "cred-do-item" },
    { pedido_id: "pedido-2", avaliador_id: null },
  ];
  assert.deepEqual(referenciasDaFila(fila), { pedidos: ["pedido-1", "pedido-2"] });
});

test("E1183 (estático): a página lê os pedidos e os imóveis dos itens e mostra a linha — a leitura que falha lança", () => {
  const pagina = ler("src/app/(dashboard)/admin/avaliadores/page.tsx");
  assert.match(pagina, /admin\.from\("vistoria_pedidos"\)\.select\("id, property_id, avaliador_id"\)\.in\("id", pedidosDaFila\)/);
  assert.match(pagina, /if \(pedidosDaFilaLeitura\.error\) throw new Error\(/);
  assert.match(pagina, /if \(titulosDaFilaLeitura\.error\) throw new Error\(/);
  assert.match(pagina, /const deQuem = identificacaoDoItemDaFila\(f, dadosDaFila\);/);
  assert.match(pagina, /\{deQuem && <span className="block text-ink" data-testid="fila-item-de-quem">\{deQuem\}<\/span>\}/);
});
