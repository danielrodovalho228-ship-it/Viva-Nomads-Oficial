/*
  E1108, volta à construção (ORDEM-DUET-787; linha Parceiros). Do lado do avaliador, o valor e o prazo que ele submeteu
  só apareciam enquanto o pedido estava na etapa do pedido (status "designado"). Marcada a visita, a tela do pedido
  passa a ser a da visita e do laudo, e os dois valores sumiam do detalhe — a linha da lista continuava a mostrá-los.
  A cura: a tela da visita e do laudo mostra a proposta combinada, pelas mesmas duas linhas da etapa "aceito" e pelas
  mesmas colunas que a lista lê.
  Roda: node --test src/lib/vistoria/e1108-detalhe-mostra-a-proposta.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linhaDoPrazoDoLaudo, linhaDoValor, propostaCombinada, resumoDoValorNaLista } from "./pedido-avaliador.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

const ler = (p: string) => semComentarios(readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8"));
const ESCOLHIDO = "2026-11-22T12:00:00Z";
const pedido = { valor_tabela: 350, valor_proposto: 250 as number | string | null, prazo_proposto_dias: 3 as number | null, prazo_laudo_dias_uteis: 3 as number | null, teste: false, escolhido_em: ESCOLHIDO as string | null };

test("E1108 (1): com a proposta submetida, o detalhe mostra o valor e o prazo combinados", () => {
  assert.deepEqual(propostaCombinada(pedido), { valor: "Você recebe R$ 250,00", prazo: "Laudo em até 3 dias úteis depois da visita" });
  // O valor guardado como texto (como o banco o devolve) lê-se igual.
  assert.equal(propostaCombinada({ ...pedido, valor_proposto: "250.00" })?.valor, "Você recebe R$ 250,00");
});

test("E1108 (2): são as mesmas duas linhas da etapa 'aceito' — nenhum texto novo", () => {
  const c = propostaCombinada(pedido);
  assert.equal(c?.valor, linhaDoValor("aceito", pedido).texto);
  assert.equal(c?.prazo, linhaDoPrazoDoLaudo("aceito", pedido));
});

test("E1108 (3): é a mesma fonte da linha da lista — o mesmo valor e o mesmo prazo", () => {
  assert.equal(resumoDoValorNaLista(pedido), "R$ 250,00 · 3 dias úteis");
  const c = propostaCombinada(pedido);
  assert.ok(c?.valor.includes("R$ 250,00"), c?.valor);
  assert.ok(c?.prazo?.includes("3 dias úteis"), String(c?.prazo));
});

test("E1108 (4): o pedido anterior à regra dos dias úteis mantém a promessa como foi escrita", () => {
  const antigo = { ...pedido, prazo_proposto_dias: 2, prazo_laudo_dias_uteis: null };
  assert.deepEqual(propostaCombinada(antigo), { valor: "Você recebe R$ 250,00", prazo: "Laudo em 2 dias" });
  assert.equal(resumoDoValorNaLista(antigo), "R$ 250,00 · 2 dias");
});

test("E1108 (5): o pedido do piloto (de teste, escolhido pelo dono) mostra a proposta como qualquer pedido", () => {
  assert.deepEqual(propostaCombinada({ ...pedido, teste: true }), { valor: "Você recebe R$ 250,00", prazo: "Laudo em até 3 dias úteis depois da visita" });
});

test("E1108 (6): sem proposta submetida não há o que mostrar", () => {
  // A avaliação de teste do credenciamento: de teste e sem escolha do dono.
  assert.equal(propostaCombinada({ valor_tabela: 0, valor_proposto: null, prazo_proposto_dias: null, prazo_laudo_dias_uteis: null, teste: true, escolhido_em: null }), null);
  // Um pedido sem valor proposto gravado: a referência da tabela não é proposta.
  assert.equal(propostaCombinada({ ...pedido, valor_proposto: null, prazo_proposto_dias: null, prazo_laudo_dias_uteis: null }), null);
});

test("E1108 (estático): a tela da visita e do laudo lê as colunas da proposta e mostra a linha", () => {
  const pagina = ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx");
  // A leitura do pedido traz as colunas que a lista também lê.
  const leitura = pagina.slice(pagina.indexOf('.from("vistoria_pedidos")'), pagina.indexOf('.eq("id", pedido)'));
  for (const coluna of ["valor_tabela", "valor_proposto", "prazo_proposto_dias", "prazo_laudo_dias_uteis", "escolhido_em", "teste"]) assert.ok(leitura.includes(coluna), `a leitura do pedido não traz ${coluna}`);
  // A linha sai da função única, fora do ramo da etapa do pedido (que já a mostrava).
  const depoisDoPedido = pagina.slice(pagina.indexOf("const { data: imovelDaVisita }"));
  assert.match(depoisDoPedido, /const combinado = propostaCombinada\(/);
  assert.match(depoisDoPedido, /\{combinado && \(\s*<p [^>]*data-testid="proposta-combinada">/);
  assert.match(depoisDoPedido, /<span data-testid="proposta-combinada-valor">\{combinado\.valor\}<\/span>/);
  assert.match(depoisDoPedido, /\{combinado\.prazo && <span data-testid="proposta-combinada-prazo">\{combinado\.prazo\}<\/span>\}/);
  // Nenhum texto do valor escrito à mão na página.
  assert.doesNotMatch(pagina, /Você recebe/);
});
