/* Roda: node --test src/lib/perfil/perfil-publico.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cartaoCandidato,
  desdeLabel,
  metricaResposta,
  nomeCurto,
  nomeNaProposta,
  nomeNaConversa,
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

test("selo 'Telefone verificado' só com verificação real (prompt 7)", () => {
  assert.deepEqual(selosReais({ emailConfirmado: true }), ["E-mail confirmado"]);
  assert.deepEqual(selosReais({ emailConfirmado: true, telefoneVerificado: true }), ["E-mail confirmado", "Telefone verificado"]);
  assert.deepEqual(selosReais({ emailConfirmado: false, telefoneVerificado: false }), []);
  const base = { nome: "Iara Perfilinq Sobrenomeoculto", fotoUrl: null, profissao: null, motivo: null, inicioDesejado: null, pets: 0, desde: null, reputacao: null, emailConfirmado: false };
  assert.deepEqual(cartaoCandidato({ ...base, telefoneVerificado: true }, false).selos, ["Telefone verificado"]);
  assert.deepEqual(cartaoCandidato({ ...base, telefoneVerificado: false }, false).selos, []);
});

test("barra 'Complete seu perfil': celular é item opcional só quando a verificação existe", () => {
  const vazio = { foto: false, bio: null, idiomas: [], cidade: null, profissao: null, motivo: null };
  assert.equal(progressoPerfil(vazio, { anuncia: true }).itens.some((i) => i.chave === "telefone"), false);
  const com = progressoPerfil(vazio, { anuncia: true, telefone: false });
  const item = com.itens.find((i) => i.chave === "telefone")!;
  assert.equal(item.feito, false);
  assert.match(item.rotulo, /^Verifique seu celular: perfis verificados passam mais confiança$/);
  assert.equal(progressoPerfil({ ...vazio, foto: true, bio: "Oi", idiomas: ["Português"], cidade: "X" }, { anuncia: true, telefone: true }).pct, 100);
});

test("nomeNaConversa: proprietário vê 'Candidato(a)' até o aceite; inquilino vê o nome curto do proprietário", () => {
  const nome = "Iara Perfilinq Sobrenomeoculto";
  assert.equal(nomeNaConversa({ papel: "proprietario", nomeCompleto: nome, aceito: false, primeiroNome: "Iara" }), "Candidato(a)");
  assert.equal(nomeNaConversa({ papel: "proprietario", nomeCompleto: nome, aceito: true }), "Iara S.");
  assert.equal(nomeNaConversa({ papel: "proprietario", nomeCompleto: null, aceito: true }), "Candidato(a)");
  assert.equal(nomeNaConversa({ papel: "inquilino", nomeCompleto: "Túlio Perfildono Sobrenomedono", aceito: false }), "Túlio S.");
  assert.equal(nomeNaConversa({ papel: "inquilino", nomeCompleto: null, aceito: false, primeiroNome: "Túlio" }), "Túlio");
  assert.equal(nomeNaConversa({ papel: "suporte", nomeCompleto: nome, aceito: false, primeiroNome: "Iara" }), "Iara");
  assert.equal(nomeNaConversa({ papel: "suporte", nomeCompleto: null, aceito: false }), "Conversa");
});

import { robotsDoProprietario } from "./perfil-publico.ts";

test("proprietário sem imóvel visível (só anúncio de teste) fica noindex", () => {
  assert.deepEqual(robotsDoProprietario(0), { index: false, follow: false });
  assert.deepEqual(robotsDoProprietario(2), { index: true, follow: true });
});

test("proposta: nome completo das partes, nunca o curto; o interessado só depois do aceite (Prompt 56, D4)", () => {
  assert.equal(nomeNaProposta({ quemVe: "owner", nomeCompleto: "Daniel Teste 1", aceito: true }), "Daniel Teste 1");
  assert.equal(nomeNaProposta({ quemVe: "tenant", nomeCompleto: "Carlos  Eduardo Mendes", aceito: true }), "Carlos Eduardo Mendes");
  assert.equal(nomeNaProposta({ quemVe: "owner", nomeCompleto: "Juliana Prado", aceito: false }), "Candidato(a)");
  assert.equal(nomeNaProposta({ quemVe: "tenant", nomeCompleto: null, aceito: true }), "Proprietário");
});
