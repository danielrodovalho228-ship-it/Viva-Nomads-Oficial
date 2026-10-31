/*
  Admin › Ajuda para publicar: a fila vazia dizia só "Nenhum pedido ainda.". Agora diz de onde o pedido vem (Meus imóveis)
  e o que a equipe faz com ele (monta o rascunho e envia ao dono), preso ao fluxo real.
  Roda: node --test src/lib/painel/vazio-admin-ajuda.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const RAIZ = new URL("../../../", import.meta.url);
const ler = (p: string) => readFileSync(new URL(p, RAIZ), "utf8");
const FILA = ler("src/app/(dashboard)/admin/ajuda-publicacao/ajuda-publicacao-client.tsx");

test("a fila vazia diz de onde o pedido vem e o que a equipe faz, com testid", () => {
  assert.doesNotMatch(FILA, />Nenhum pedido ainda\.</);
  assert.match(FILA, /data-testid="ajuda-fila-vazia">Nenhum pedido de ajuda para publicar ainda\. Quando um proprietário pedir ajuda em Meus imóveis, o pedido entra aqui para a equipe montar o rascunho e enviar ao dono\./);
});

test("o fluxo que o texto descreve existe: o pedido nasce em Meus imóveis; estados 'em montagem' e 'com o dono'", () => {
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/page.tsx"), /ajuda-publicacao-actions|AjudaPublicar/);
  assert.match(FILA, /contar\("em_montagem"\)/);
  assert.match(FILA, /contar\("enviado_dono"\)/);
});
