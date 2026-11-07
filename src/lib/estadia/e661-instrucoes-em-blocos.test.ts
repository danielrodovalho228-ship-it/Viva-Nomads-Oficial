import { test } from "node:test";
import assert from "node:assert/strict";
import { CAMPOS_INSTRUCOES, GRUPO_DA_INSTRUCAO, agruparInstrucoes } from "./instrucoes.ts";

test("E661: todo campo das instruções pertence a um grupo", () => {
  for (const c of CAMPOS_INSTRUCOES) assert.ok(GRUPO_DA_INSTRUCAO[c.chave], c.chave);
});

test("E661: Wi-Fi do apartamento e vaga ficam no bloco do imóvel; regras, lixo e contatos do prédio no do condomínio", () => {
  const g = agruparInstrucoes({ como_entrar: "Portaria 24h", wifi_rede: "Casa", wifi_senha: "x", vaga: "12", regras_condominio: "Silêncio", lixo: "Subsolo", contatos_predio: "Zelador", observacoes: "Obs" });
  const por = Object.fromEntries(g.map((x) => [x.grupo, x.campos.map((c) => c.chave)]));
  assert.deepEqual(por.entrada, ["como_entrar"]);
  assert.deepEqual(por.imovel, ["wifi_rede", "wifi_senha", "vaga", "observacoes"]);
  assert.deepEqual(por.condominio, ["regras_condominio", "lixo", "contatos_predio"]);
  assert.deepEqual(g.map((x) => x.grupo), ["entrada", "imovel", "condominio"]);
});

test("E661: grupo sem texto some e campo em branco não aparece", () => {
  assert.deepEqual(agruparInstrucoes({ wifi_rede: "  ", lixo: "" }), []);
  assert.deepEqual(agruparInstrucoes(null), []);
  const g = agruparInstrucoes({ wifi_rede: "Rede" });
  assert.deepEqual(g.map((x) => x.grupo), ["imovel"]);
});

test("E661: guia do morador/dono e do convidado usam o mesmo componente", async () => {
  const { readFileSync } = await import("node:fs");
  for (const p of ["src/app/(dashboard)/dashboard/estadia/[contratoId]/page.tsx", "src/app/(dashboard)/dashboard/estadia/[contratoId]/convidado/page.tsx"]) {
    assert.match(readFileSync(p, "utf8"), /<InstrucoesEmBlocos /, p);
  }
});

test("E661/E662: Wi-Fi, recepção e fechadura do condomínio vão para o bloco do condomínio; a saída fica com a chegada", () => {
  const g = agruparInstrucoes({ como_entrar: "Portaria", instrucao_saida: "Até 11h", condominio_wifi_rede: "Cond", condominio_recepcao: "24h", condominio_fechadura: "Biometria", lixo: "Subsolo" });
  const por = Object.fromEntries(g.map((x) => [x.grupo, x.campos.map((c) => c.chave)]));
  assert.deepEqual(por.entrada, ["como_entrar", "instrucao_saida"]);
  assert.deepEqual(por.condominio, ["condominio_wifi_rede", "condominio_recepcao", "condominio_fechadura", "lixo"]);
});
