import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizarRegrasPets, linhasRegrasPets, linhaPetsPublica, type RegrasPets } from "./pets-regras.ts";
import { conferenciaPetComRegras } from "./ficha-pet-dono.ts";

/*
  Ordem 75ce56db, item D (pets): o dono escolhe as exigências — além de porte e quantidade, "carteira de vacinação
  em dia" e "foto do pet". As exigências aparecem no anúncio e o dono vê, ANTES de aceitar, se a ficha cumpre.
  Nunca bloqueiam a candidatura (mesma regra da linha de compatibilidade, E263-A).
*/
const ler = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const REGRAS = (p: Partial<RegrasPets> = {}): RegrasPets => ({ especies: ["cao"], porteMax: "M", qtdMax: 1, reforcoCaucao: 0, regrasCondominio: "", ...p });
const TOTO = { nome: "Totó", especie: "cao" as const, porte: "M" as const };

test("normalização guarda as exigências só quando marcadas (true de verdade)", () => {
  const r = normalizarRegrasPets({ especies: ["cao"], exigeCarteiraVacina: true, exigeFotoPet: true });
  assert.equal(r?.exigeCarteiraVacina, true);
  assert.equal(r?.exigeFotoPet, true);
  const s = normalizarRegrasPets({ especies: ["cao"], exigeCarteiraVacina: "sim", exigeFotoPet: 1 });
  assert.equal(s?.exigeCarteiraVacina, undefined);
  assert.equal(s?.exigeFotoPet, undefined);
});

test("só a exigência marcada já é uma condição (não cai no aceite geral)", () => {
  const r = normalizarRegrasPets({ exigeCarteiraVacina: true });
  assert.ok(r);
  assert.equal(r?.exigeCarteiraVacina, true);
  assert.deepEqual(r?.especies, ["cao", "gato", "outro"]);
});

test("regras antigas (sem exigência) continuam iguais — o resumo e o hash de contrato não mudam", () => {
  const antiga = normalizarRegrasPets({ especies: ["cao"], porteMax: "M" });
  assert.ok(antiga && !("exigeCarteiraVacina" in antiga) && !("exigeFotoPet" in antiga));
  assert.deepEqual(linhasRegrasPets(antiga!), ["Aceita: cão", "Porte máximo: médio (até 25 kg)"]);
});

test("anúncio e resumo mostram as exigências", () => {
  const r = REGRAS({ exigeCarteiraVacina: true, exigeFotoPet: true });
  const linhas = linhasRegrasPets(r);
  assert.ok(linhas.includes("Exige carteira de vacinação em dia"));
  assert.ok(linhas.includes("Exige foto do pet"));
  const publica = linhaPetsPublica(true, r);
  assert.match(publica, /carteira de vacinação exigida/);
  assert.match(publica, /foto do pet exigida/);
});

test("conferência do dono: falta a carteira ou a foto que o anúncio exige", () => {
  const r = REGRAS({ exigeCarteiraVacina: true });
  assert.deepEqual(conferenciaPetComRegras(true, r, { ...TOTO, fotos: [], carteira_vacina: null }), {
    ok: false,
    texto: "Fora das regras: falta a carteira de vacinação que o anúncio exige",
  });
  assert.deepEqual(conferenciaPetComRegras(true, r, { ...TOTO, carteira_vacina: "u/carteira.pdf" }), {
    ok: true,
    texto: "Dentro das regras: aceita cão de porte médio",
  });
  const f = REGRAS({ exigeFotoPet: true });
  assert.deepEqual(conferenciaPetComRegras(true, f, { ...TOTO, fotos: [] }), {
    ok: false,
    texto: "Fora das regras: falta a foto do pet que o anúncio exige",
  });
  assert.equal(conferenciaPetComRegras(true, f, { ...TOTO, fotos: ["u/1.jpg"] }).ok, true);
  const ambas = conferenciaPetComRegras(true, REGRAS({ exigeCarteiraVacina: true, exigeFotoPet: true }), TOTO);
  assert.equal(ambas.texto, "Fora das regras: falta a foto do pet e a carteira de vacinação que o anúncio exige");
});

test("espécie ou porte fora continua tendo prioridade na frase", () => {
  const r = REGRAS({ porteMax: "P", exigeCarteiraVacina: true });
  assert.equal(conferenciaPetComRegras(true, r, TOTO).texto, "Fora das regras: o anúncio aceita até porte pequeno");
});

test("servidor passa fotos e carteira para a conferência; formulário do dono tem as duas exigências", () => {
  const servidor = ler("../data/pets-candidatura.ts");
  assert.match(servidor, /conferenciaPetComRegras\(petsAllowed, regras, l\)/);
  assert.match(servidor, /select\("nome, especie, porte, raca, observacoes, fotos, carteira_vacina"\)/);
  const form = ler("../../components/anuncio/pets-regras-campos.tsx");
  assert.match(form, /testid="pets-exige-carteira"/);
  assert.match(form, /testid="pets-exige-foto"/);
  assert.match(form, /exigeCarteiraVacina/);
  assert.match(form, /exigeFotoPet/);
});
