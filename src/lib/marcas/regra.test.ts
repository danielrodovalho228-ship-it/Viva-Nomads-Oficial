import test from "node:test";
import assert from "node:assert/strict";
import { rotuloMarca, mapaDeMarcas, ultimaBuscaParaPedido, serializarUltimaBusca, ultimoMotivoParaPedido } from "./regra.ts";

test("rotulo: contatou vence visto; sem marca não mostra nada", () => {
  assert.equal(rotuloMarca({ vistoEm: "2026-10-10T10:00:00Z", contatadoEm: null }), "Visto");
  assert.equal(rotuloMarca({ vistoEm: "2026-10-10T10:00:00Z", contatadoEm: "2026-10-11T10:00:00Z" }), "Você já contatou");
  assert.equal(rotuloMarca({ vistoEm: null, contatadoEm: "2026-10-11T10:00:00Z" }), "Você já contatou");
  assert.equal(rotuloMarca({ vistoEm: null, contatadoEm: null }), null);
  assert.equal(rotuloMarca(undefined), null);
});

test("mapaDeMarcas indexa por imóvel e ignora linha sem id", () => {
  const m = mapaDeMarcas([
    { imovel_id: "a", visto_em: "2026-10-10T10:00:00Z", contatado_em: null },
    { imovel_id: "", visto_em: "x", contatado_em: null },
  ]);
  assert.deepEqual(Object.keys(m), ["a"]);
  assert.equal(m.a.vistoEm, "2026-10-10T10:00:00Z");
});

test("última busca: data de entrada futura preenche; passada, inválida ou lixo não", () => {
  const hoje = "2026-10-16";
  const ok = serializarUltimaBusca({ inicio: "2026-11-01", meses: 3, pessoas: 2 });
  assert.deepEqual(ultimaBuscaParaPedido(ok, hoje), { inicio: "2026-11-01", meses: 3, pessoas: 2 });
  assert.deepEqual(ultimaBuscaParaPedido(serializarUltimaBusca({ inicio: "2026-10-01", meses: 3 }), hoje), { inicio: "", meses: 3, pessoas: 0 });
  assert.deepEqual(ultimaBuscaParaPedido("não é json", hoje), { inicio: "", meses: 0, pessoas: 0 });
  assert.deepEqual(ultimaBuscaParaPedido(null, hoje), { inicio: "", meses: 0, pessoas: 0 });
  assert.deepEqual(ultimaBuscaParaPedido(JSON.stringify({ inicio: "<script>", meses: 99, pessoas: 99 }), hoje), { inicio: "", meses: 0, pessoas: 0 });
});

test("nº de pessoas da última busca: inteiro de 1 a 20; zero, fração ou texto são descartados", () => {
  const hoje = "2026-10-16";
  const com = (pessoas: unknown) => ultimaBuscaParaPedido(JSON.stringify({ inicio: "", meses: 0, pessoas }), hoje).pessoas;
  assert.equal(com(3), 3);
  assert.equal(com(0), 0);
  assert.equal(com(1.5), 0);
  assert.equal(com("2"), 0);
  assert.equal(com(21), 0);
});

test("último motivo: só volta se ainda for um motivo conhecido", () => {
  const conhecido = (k: string) => k === "trabalho_remoto" || k === "outro";
  assert.equal(ultimoMotivoParaPedido("trabalho_remoto", conhecido), "trabalho_remoto");
  assert.equal(ultimoMotivoParaPedido(" outro ", conhecido), "outro");
  assert.equal(ultimoMotivoParaPedido("motivo_antigo", conhecido), "");
  assert.equal(ultimoMotivoParaPedido("<script>", conhecido), "");
  assert.equal(ultimoMotivoParaPedido(null, conhecido), "");
});
