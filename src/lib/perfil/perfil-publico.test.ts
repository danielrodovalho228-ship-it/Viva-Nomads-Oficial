/* Roda: node --test src/lib/perfil/perfil-publico.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cartaoCandidato,
  desdeLabel,
  metricaResposta,
  nomeCurto,
  progressoPerfil,
  selosReais,
  tempoRespostaLabel,
  validarBio,
  validarCidade,
  validarIdiomas,
  type CandidatoBase,
} from "./perfil-publico.ts";

test("nome curto: primeiro nome + inicial do último sobrenome; nunca o nome completo", () => {
  assert.equal(nomeCurto("Maria Souza Lima"), "Maria L.");
  assert.equal(nomeCurto("  paulo   essencial "), "paulo E.");
  assert.equal(nomeCurto("Ana"), "Ana");
  assert.equal(nomeCurto(""), null);
  assert.equal(nomeCurto(null), null);
});

test("Na Viva desde mês de ano", () => {
  assert.equal(desdeLabel("2025-03-14T10:00:00Z"), "Na Viva desde março de 2025");
  assert.equal(desdeLabel("lixo"), null);
  assert.equal(desdeLabel(null), null);
});

test("resposta no chat: só com 3 ou mais conversas; antes disso, null (Novo na Viva)", () => {
  assert.equal(metricaResposta(0, 0, null), null);
  assert.equal(metricaResposta(2, 2, 30), null);
  assert.deepEqual(metricaResposta(3, 3, 30), { taxa: 100, tempo: "em menos de 1 hora" });
  assert.deepEqual(metricaResposta(4, 3, 180), { taxa: 75, tempo: "em cerca de 3 horas" });
  assert.deepEqual(metricaResposta(10, 5, 60 * 30), { taxa: 50, tempo: "em cerca de 1 dia" });
  assert.equal(metricaResposta(5, 9, 10)!.taxa, 100, "respondidas nunca passa de 100%");
  assert.equal(tempoRespostaLabel(null), "sem respostas ainda");
});

test("bio: até 280 caracteres, sem telefone, e-mail, @ ou link (contact-guard)", () => {
  assert.deepEqual(validarBio("  "), { ok: true, valor: null });
  assert.deepEqual(validarBio("Médica em residência,   tranquila."), { ok: true, valor: "Médica em residência, tranquila." });
  for (const ruim of ["me liga 34 99999-8888", "maria@exemplo.com", "insta @maria.silva", "veja www.meusite.com", "https://wa.me/5534999998888", "site maria.com.br"])
    assert.equal(validarBio(ruim).ok, false, ruim);
  assert.equal(validarBio("a".repeat(281)).ok, false);
  assert.equal(validarBio("a".repeat(280)).ok, true);
});

test("idiomas só da lista, sem repetir; cidade sem endereço nem contato", () => {
  assert.deepEqual(validarIdiomas(["Inglês", "Klingon", "Português", "Inglês"]), ["Português", "Inglês"]);
  assert.deepEqual(validarCidade("Uberlândia (MG)"), { ok: true, valor: "Uberlândia (MG)" });
  assert.equal(validarCidade("Rua X, CEP 38400-000").ok, false);
  assert.equal(validarCidade("34 99999-8888").ok, false);
});

test("selos só com verificação real: hoje, só e-mail confirmado (telefone e identidade ainda não)", () => {
  assert.deepEqual(selosReais({ emailConfirmado: true }), ["E-mail confirmado"]);
  assert.deepEqual(selosReais({ emailConfirmado: false }), []);
  assert.deepEqual(selosReais({}), []);
});

const base: CandidatoBase = {
  nome: "Iara Inquilinasobrenome",
  fotoUrl: "https://exemplo/foto.webp",
  profissao: "Médica",
  motivo: "Saúde",
  inicioDesejado: "01/11/2026",
  pets: 1,
  desde: "2026-01-10T00:00:00Z",
  reputacao: { media: 4.8, n: 3 },
  emailConfirmado: true,
};

test("candidato ANTES do aceite: 'Candidato(a)', sem nome, sem foto; só sinais", () => {
  const c = cartaoCandidato(base, false);
  assert.equal(c.titulo, "Candidato(a)");
  assert.equal(c.fotoUrl, null);
  const tudo = JSON.stringify(c);
  assert.doesNotMatch(tudo, /Iara|Inquilinasobrenome/);
  assert.ok(c.sinais.includes("Com 1 pet"));
  assert.ok(c.sinais.includes("Na Viva desde janeiro de 2026"));
  assert.deepEqual(c.selos, ["E-mail confirmado"]);
  assert.deepEqual(c.reputacao, { media: 4.8, n: 3 });
});

test("candidato DEPOIS do aceite: nome curto e foto — nunca o sobrenome completo nem contato", () => {
  const c = cartaoCandidato(base, true);
  assert.equal(c.titulo, "Iara I.");
  assert.equal(c.fotoUrl, "https://exemplo/foto.webp");
  assert.doesNotMatch(JSON.stringify(c), /Inquilinasobrenome|@|\d{4,}-\d{4}/);
  assert.equal(cartaoCandidato({ ...base, reputacao: { media: 0, n: 0 } }, true).reputacao, null, "sem avaliação, sem nota");
});

test("Complete seu perfil: nunca obrigatório; quem só anuncia não precisa de profissão/motivo", () => {
  const vazio = { foto: false, bio: null, idiomas: [], cidade: null, profissao: null, motivo: null };
  assert.equal(progressoPerfil(vazio, { anuncia: true }).itens.length, 4);
  assert.equal(progressoPerfil(vazio, { anuncia: false }).itens.length, 6);
  assert.equal(progressoPerfil(vazio, { anuncia: true }).pct, 0);
  const meio = { ...vazio, foto: true, bio: "Oi", idiomas: [], cidade: null };
  assert.equal(progressoPerfil(meio, { anuncia: true }).pct, 50);
});
