/*
  E699: as travas da publicação (confirmação de identidade e documento do imóvel) aparecem desde o PASSO 1, não só no passo 10.
  Roda: node --test src/lib/anuncio/travas-publicacao.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { estadoIdentidadeParaTrava, travasDePublicacao } from "./travas-publicacao.ts";

test("sem nada feito: as duas travas aparecem como 'falta', com o aviso de que dá para enviar quando quiser", () => {
  const t = travasDePublicacao({ identidade: "pendente", documento: "nenhum" });
  assert.deepEqual(t.itens.map((i) => [i.chave, i.estado]), [["identidade", "falta"], ["documento", "falta"]]);
  assert.equal(t.mostrar, true);
  assert.match(t.itens[0].rotulo, /Confirmação de identidade/);
  assert.match(t.itens[1].rotulo, /Documento do imóvel/);
});

test("identidade confirmada e documento aprovado: nada a mostrar (o cartão some)", () => {
  const t = travasDePublicacao({ identidade: "ok", documento: "aprovado" });
  assert.equal(t.mostrar, false);
  assert.ok(t.itens.every((i) => i.estado === "ok"));
});

test("documento enviado e em análise não é 'falta': é 'em análise'; documento a corrigir é 'falta'", () => {
  assert.equal(travasDePublicacao({ identidade: "ok", documento: "revisao" }).itens[1].estado, "em_analise");
  assert.equal(travasDePublicacao({ identidade: "ok", documento: "corrija" }).itens[1].estado, "falta");
  assert.equal(travasDePublicacao({ identidade: "ok", documento: "revisao" }).mostrar, true);
});

test("enquanto o estado da identidade carrega, não afirma 'falta' (evita piscar)", () => {
  const t = travasDePublicacao({ identidade: "carregando", documento: "aprovado" });
  assert.equal(t.itens[0].estado, "carregando");
  assert.equal(t.mostrar, false);
});

test("o estado da identidade vem do mesmo critério do passo 10", () => {
  assert.equal(estadoIdentidadeParaTrava(null), "carregando");
  assert.equal(estadoIdentidadeParaTrava({ identidade: { estado: "confirmada" }, temCpf: true }), "ok");
  assert.equal(estadoIdentidadeParaTrava({ identidade: { estado: "nao_confirmada" }, temCpf: false }), "sem_cpf");
  assert.equal(estadoIdentidadeParaTrava({ identidade: { estado: "nao_confirmada" }, temCpf: true }), "pendente");
});

test("o passo 1 do cadastro mostra o cartão das travas", () => {
  const src = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/page.tsx", import.meta.url), "utf8");
  const i = src.indexOf("{step === ETAPA.tipo && (");
  assert.ok(i > 0);
  assert.match(src.slice(i, i + 900), /<TravasDePublicacao documento=\{docEstado\} \/>/);
});
