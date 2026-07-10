import { test } from "node:test";
import assert from "node:assert/strict";
import {
  categoriaLabel,
  isCategoriaKey,
  DE_PARA_CATEGORIAS,
  CATEGORIA_NAO_INFORMAR,
  CATEGORIA_OUTRO_PREFIX,
} from "./categorias-profissionais.ts";

test("categoriaLabel resolve keys, outro e nao_informar", () => {
  assert.equal(categoriaLabel("saude_medico_residente"), "Médico(a) residente");
  assert.equal(categoriaLabel(CATEGORIA_NAO_INFORMAR), "Prefiro não informar");
  assert.equal(categoriaLabel("outro:Piloto de drone"), "Piloto de drone");
  assert.equal(categoriaLabel("outro:"), "Outro");
  assert.equal(categoriaLabel(null), "");
  assert.equal(categoriaLabel(undefined), "");
});

test("categoriaLabel mapeia rótulos LEGADO (5 antigas) para os novos", () => {
  assert.equal(categoriaLabel("Médico / saúde"), "Outros profissionais de saúde");
  assert.equal(categoriaLabel("Nômade digital / remoto"), "Trabalho remoto/nômade digital");
});

test("de-para cobre exatamente as 5 categorias antigas", () => {
  assert.equal(Object.keys(DE_PARA_CATEGORIAS).length, 5);
  for (const k of Object.keys(DE_PARA_CATEGORIAS)) {
    const alvo = DE_PARA_CATEGORIAS[k];
    if (alvo === CATEGORIA_OUTRO_PREFIX) continue;
    assert.ok(isCategoriaKey(alvo), `de-para de "${k}" deve apontar para key válida`);
  }
});

test("isCategoriaKey reconhece keys válidas e rejeita desconhecidas", () => {
  assert.equal(isCategoriaKey("saude_enfermagem"), true);
  assert.equal(isCategoriaKey("trabalho_remoto"), true);
  assert.equal(isCategoriaKey("categoria_que_nao_existe"), false);
  assert.equal(isCategoriaKey(CATEGORIA_OUTRO_PREFIX), false);
});
