/*
  E812 — o "Não tem" nunca desmente as fotos.
  (a) Exemplos: as fotos de sala de ube-003, 005, 008, 010, 012 e 013 mostram a TV; a lista dizia "Não tem: TV".
      O ube-003 tinha 1 item em "O que tem por perto" e nenhum "Serviços por perto".
  (b) Fluxo real: comodidade que a detecção viu nas fotos (sugestão pendente para o dono) sai do "Não tem" da página;
      a detecção passa a procurar também TV, lava-louças e ar-condicionado.
  Roda: node --test src/lib/anuncio/e812-nao-tem-x-fotos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_PROPERTIES } from "../properties.ts";
import { comodidadesQueNaoTem } from "./nao-tem.ts";
import { CHAVES_DETECCAO, DETECCAO_SYSTEM_PROMPT } from "../fotos/deteccao.ts";
import { servicosPorPerto } from "./proximidades.ts";

const porId = (id: string) => SAMPLE_PROPERTIES.find((p) => p.id === id)!;

test("(a) nenhum exemplo diz 'Não tem: TV' — todas as salas dos exemplos mostram a TV", () => {
  for (const p of SAMPLE_PROPERTIES) assert.ok(!comodidadesQueNaoTem(p).includes("TV"), p.id);
  for (const id of ["ube-003", "ube-005", "ube-008", "ube-010", "ube-012", "ube-013"]) assert.ok(porId(id).amenities.includes("TV"), id);
});

test("(a) ube-003: arredores como os outros exemplos — vários itens e os 3 serviços por perto", () => {
  const p = porId("ube-003");
  assert.ok((p.proximities?.length ?? 0) >= 4);
  const visiveis = (p.proximities ?? []).map((x) => ({ categoria: x.category, tipo: null, nome: x.name, distanciaM: x.distanciaM, texto: `${x.distanciaM} m` }));
  assert.deepEqual(servicosPorPerto(visiveis as never).map((s) => s.tipo), ["onibus", "mercado", "farmacia"]);
});

test("(b) item visto nas fotos (sugestão pendente) não entra no 'Não tem'", () => {
  const base = { ...porId("ube-002"), amenities: ["Mobiliado completo", "Cozinha equipada"], amenityGroups: undefined };
  assert.ok(comodidadesQueNaoTem(base).includes("TV"));
  assert.ok(comodidadesQueNaoTem(base).includes("Lava-louças"));
  const comFoto = { ...base, vistoNasFotos: ["tv", "lava_loucas"] };
  assert.ok(!comodidadesQueNaoTem(comFoto).includes("TV"));
  assert.ok(!comodidadesQueNaoTem(comFoto).includes("Lava-louças"));
  assert.ok(comodidadesQueNaoTem(comFoto).includes("Elevador"), "o que a foto não mostrou segue no 'Não tem'");
});

test("(b) a detecção procura TV, lava-louças e ar-condicionado (vira sugestão para o dono = o alerta)", () => {
  for (const k of ["tv", "lava_loucas", "ar_condicionado"]) {
    const c = CHAVES_DETECCAO.find((x) => x.chave === k);
    assert.ok(c, k);
    assert.equal(c!.tipo, "comodidade");
    assert.match(DETECCAO_SYSTEM_PROMPT, new RegExp(`- ${k} — `));
  }
  assert.equal(new Set(CHAVES_DETECCAO.map((c) => c.chave)).size, CHAVES_DETECCAO.length, "sem chave repetida");
});

test("(b) a página pública carrega o que foi visto nas fotos antes de montar o 'Não tem'", () => {
  const dados = readFileSync(new URL("../data/properties.ts", import.meta.url), "utf8");
  assert.match(dados, /await attachVistoNasFotos\(base\);/);
  assert.match(dados, /from\("deteccao_sugestoes"\)\s*\.select\("chave"\)[\s\S]{0,120}\.eq\("tipo", "comodidade"\)[\s\S]{0,60}\.in\("status", \["sugerida", "confirmada_sem_foto"\]\)/);
});
