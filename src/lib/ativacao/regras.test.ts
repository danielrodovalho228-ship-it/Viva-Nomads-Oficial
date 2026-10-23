/* Roda: node --test src/lib/ativacao/regras.test.ts — Prompt 50: ativação por papel (1× por papel). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { checklistsDoInicio, type FatosConta } from "../onboarding/ativacao.ts";
import { ativacoesParaGravar, estadoAtivacao } from "./regras.ts";

const AGORA = new Date("2026-10-23T12:00:00Z");
const nova: FatosConta = {
  temNome: false, temFoto: false, favoritos: 0, buscasSalvas: 0, pedidosEnviados: 0, imoveis: 0, imoveisAtivos: 0,
  rascunhoComDados: false, rascunhoComFotos: false, rascunhoComValor: false, parceria: "nenhuma", pedidosParceiroAceitos: 0, entrouComoDono: false,
};

test("morador: todos os itens; ativa no 1º pedido enviado, mesmo sem perfil completo", () => {
  const e = estadoAtivacao("morador", { fatos: nova, ativadoEm: null }, AGORA);
  assert.deepEqual(e.itens.map((i) => i.chave), ["perfil", "salvar", "pedido"]);
  assert.equal(e.ativado, false);
  assert.equal(e.gravar, false);
  assert.ok(e.itens.every((i) => i.acao));
  const ativou = estadoAtivacao("morador", { fatos: { ...nova, pedidosEnviados: 1 }, ativadoEm: null }, AGORA);
  assert.equal(ativou.ativado, true);
  assert.equal(ativou.gravar, true);
  assert.equal(ativou.ativadoEm, AGORA.toISOString());
  assert.equal(ativou.itens.find((i) => i.chave === "perfil")?.feito, false);
});

test("proprietário: dados, fotos, valor, publicar; ativa no 1º anúncio publicado e não desativa ao despublicar", () => {
  const e = estadoAtivacao("proprietario", { fatos: { ...nova, imoveis: 1, rascunhoComDados: true }, ativadoEm: null }, AGORA);
  assert.deepEqual(e.itens.map((i) => i.chave), ["dados", "fotos", "valor", "publicar"]);
  assert.deepEqual(e.itens.map((i) => i.feito), [true, false, false, false]);
  assert.equal(estadoAtivacao("proprietario", { fatos: { ...nova, imoveis: 1, imoveisAtivos: 1 }, ativadoEm: null }, AGORA).gravar, true);
  // Gravada em 10/10: o anúncio foi pausado depois, a ativação continua (1× por papel) e não grava de novo.
  const depois = estadoAtivacao("proprietario", { fatos: { ...nova, imoveis: 1, imoveisAtivos: 0 }, ativadoEm: "2026-10-10T12:00:00Z" }, AGORA);
  assert.equal(depois.ativado, true);
  assert.equal(depois.gravar, false);
  assert.equal(depois.ativadoEm, "2026-10-10T12:00:00Z");
  assert.equal(depois.itens.find((i) => i.chave === "publicar")?.feito, true);
});

test("parceiro: solicitação, análise, página, 1º pedido aceito; ativa no 1º aceito", () => {
  const e = estadoAtivacao("parceiro", { fatos: { ...nova, parceria: "publicada" }, ativadoEm: null }, AGORA);
  assert.deepEqual(e.itens.map((i) => i.chave), ["solicitacao", "analise", "pagina", "pedido"]);
  assert.equal(e.ativado, false);
  assert.equal(estadoAtivacao("parceiro", { fatos: { ...nova, parceria: "publicada", pedidosParceiroAceitos: 1 }, ativadoEm: null }, AGORA).ativado, true);
});

test("ativação 1× por papel: só grava o que ainda não foi gravado", () => {
  const f = { ...nova, pedidosEnviados: 2, imoveis: 1, imoveisAtivos: 1, parceria: "publicada" as const, pedidosParceiroAceitos: 1 };
  assert.deepEqual(ativacoesParaGravar(f, {}, AGORA), ["morador", "proprietario", "parceiro"]);
  assert.deepEqual(ativacoesParaGravar(f, { morador: "2026-10-01T00:00:00Z", parceiro: "2026-10-02T00:00:00Z" }, AGORA), ["proprietario"]);
  assert.deepEqual(ativacoesParaGravar(f, { morador: "x", proprietario: "y", parceiro: "z" }, AGORA), []);
});

test("Início: o checklist some na ativação (fato ou data gravada)", () => {
  assert.deepEqual(checklistsDoInicio(nova).map((c) => c.papel), ["morador"]);
  assert.deepEqual(checklistsDoInicio({ ...nova, pedidosEnviados: 1 }).map((c) => c.papel), []);
  const dono = { ...nova, imoveis: 1 };
  assert.deepEqual(checklistsDoInicio(dono).map((c) => c.papel), ["morador", "proprietario"]);
  assert.deepEqual(checklistsDoInicio(dono, { proprietario: "2026-10-10T00:00:00Z" }).map((c) => c.papel), ["morador"]);
});
