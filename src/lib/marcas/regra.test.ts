import test from "node:test";
import assert from "node:assert/strict";
import { rotuloMarca, mapaDeMarcas, ultimaBuscaParaPedido, serializarUltimaBusca } from "./regra.ts";

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
  const ok = serializarUltimaBusca({ inicio: "2026-11-01", meses: 3 });
  assert.deepEqual(ultimaBuscaParaPedido(ok, hoje), { inicio: "2026-11-01", meses: 3 });
  assert.deepEqual(ultimaBuscaParaPedido(serializarUltimaBusca({ inicio: "2026-10-01", meses: 3 }), hoje), { inicio: "", meses: 3 });
  assert.deepEqual(ultimaBuscaParaPedido("não é json", hoje), { inicio: "", meses: 0 });
  assert.deepEqual(ultimaBuscaParaPedido(null, hoje), { inicio: "", meses: 0 });
  assert.deepEqual(ultimaBuscaParaPedido(JSON.stringify({ inicio: "<script>", meses: 99 }), hoje), { inicio: "", meses: 0 });
});
