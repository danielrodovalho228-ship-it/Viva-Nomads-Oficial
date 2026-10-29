/* Roda: node --test src/lib/onboarding/ativacao.test.ts — Prompt 43: papéis em camadas e checklist de ativação. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { checklistMorador, checklistParceiro, checklistProprietario, checklistsDoInicio, papeisDaConta, type FatosConta } from "./ativacao.ts";

const nova: FatosConta = {
  temNome: false, temFoto: false, favoritos: 0, buscasSalvas: 0, pedidosEnviados: 0, imoveis: 0, imoveisAtivos: 0,
  rascunhoComDados: false, rascunhoComFotos: false, rascunhoComValor: false, parceria: "nenhuma", pedidosParceiroAceitos: 0, entrouComoDono: false,
};

test("papéis em camadas: morador sempre; proprietário com o 1º imóvel; parceiro aguardando até a Viva aprovar", () => {
  const so = papeisDaConta(nova);
  assert.deepEqual(so.map((p) => [p.papel, p.ativo]), [["morador", true], ["proprietario", false], ["parceiro", false]]);
  assert.deepEqual(so[1].convite, { rotulo: "Anunciar um imóvel", href: "/dashboard/imoveis/novo" });
  assert.equal(so[2].convite?.rotulo, "Quero ser parceiro");
  const aguardando = papeisDaConta({ ...nova, parceria: "aguardando" })[2];
  assert.equal(aguardando.ativo, false);
  assert.equal(aguardando.estado, "Aguardando aprovação da Viva.");
  assert.equal(aguardando.convite, null);
  const todos = papeisDaConta({ ...nova, imoveis: 2, parceria: "publicada" });
  assert.ok(todos.every((p) => p.ativo));
  assert.equal(todos[1].estado, "2 imóveis na sua conta.");
});

test("morador: perfil, salvar e primeiro pedido; a frase fixa do pedido; some quando ativa", () => {
  const c = checklistMorador(nova);
  assert.deepEqual(c.itens.map((i) => i.id), ["perfil", "salvar", "pedido"]);
  assert.equal(c.itens[2].detalhe, "Pedido não é contrato: nada é cobrado até vocês assinarem.");
  assert.equal(c.ativado, false);
  const feito = checklistMorador({ ...nova, temNome: true, temFoto: true, favoritos: 1, pedidosEnviados: 1 });
  assert.equal(feito.ativado, true);
  assert.ok(feito.itens.every((i) => i.acao === null), "item feito não tem ação");
});

test("proprietário: dados, fotos, valor, publicar; publicado marca tudo", () => {
  const c = checklistProprietario({ ...nova, imoveis: 1, rascunhoComDados: true });
  assert.deepEqual(c.itens.map((i) => [i.id, i.feito]), [["dados", true], ["fotos", false], ["valor", false], ["publicar", false]]);
  assert.match(c.itens[2].detalhe!, /taxa da faixa em reais/);
  assert.equal(checklistProprietario({ ...nova, imoveis: 1, imoveisAtivos: 1 }).ativado, true);
});

test("parceiro: análise com o prazo e o Falar com a Viva; página e primeiro pedido", () => {
  const c = checklistParceiro({ ...nova, parceria: "aguardando" });
  assert.deepEqual(c.itens.map((i) => [i.id, i.feito]), [["solicitacao", true], ["analise", false], ["pagina", false], ["pedido", false]]);
  assert.equal(c.itens[1].detalhe, "Em análise. Resposta em até 1 dia útil.");
  assert.deepEqual(c.itens[1].acao, { rotulo: "Falar com a Viva", href: "/ajuda/fale-com-a-viva" });
  assert.equal(checklistParceiro({ ...nova, parceria: "publicada", pedidosParceiroAceitos: 1 }).ativado, true);
});

test("Início: um checklist por papel ativo e não ativado; nada quando os três ativaram", () => {
  assert.deepEqual(checklistsDoInicio(nova).map((c) => c.papel), ["morador"]);
  assert.deepEqual(checklistsDoInicio({ ...nova, entrouComoDono: true }).map((c) => c.papel), ["morador", "proprietario"]);
  assert.deepEqual(checklistsDoInicio({ ...nova, imoveis: 1, parceria: "aguardando" }).map((c) => c.papel), ["morador", "proprietario", "parceiro"]);
  const ativa = { ...nova, temNome: true, temFoto: true, favoritos: 1, pedidosEnviados: 1, imoveis: 1, imoveisAtivos: 1, parceria: "publicada" as const, pedidosParceiroAceitos: 2 };
  assert.deepEqual(checklistsDoInicio(ativa), []);
});
