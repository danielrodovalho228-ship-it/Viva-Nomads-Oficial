/*
  E1079, fatia 3 (ORDEM-DUET-445): o pedido do avaliador pelo mockup aprovado (avaliador-pedido), SEM desfazer o E648 —
  "Aceitar pedido" abre o valor e o prazo do avaliador; o valor da tabela é só referência; "Você recebe R$ X" só depois
  de o dono aceitar; bairro e cidade antes do aceite, endereço completo depois; sem a linha da data pedida pelo dono.
  Roda: node --test src/lib/vistoria/e1079-pedido-avaliador.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ETIQUETA_DO_PEDIDO, ROTULO_ACEITAR_PEDIDO, ROTULO_RECUSAR_PEDIDO, etapaDoPedido, linhaDoPorte, linhaDoValor, localDoPedido, tituloDoPedido } from "./pedido-avaliador.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const imovel = { exact_address: "Rua das Palmeiras, 450", address: "Santa Mônica", city: "Uberlândia", state: "MG" };

test("E1079 pedido: a etapa sai do estado gravado (novo → proposta enviada → aceito pelo dono)", () => {
  assert.equal(etapaDoPedido({ status: "designado", resposta: null, proposta_aceita_em: null, teste: false, escolhido_em: null }), "novo");
  assert.equal(etapaDoPedido({ status: "designado", resposta: "aceita", proposta_aceita_em: null, teste: false, escolhido_em: null }), "proposta_enviada");
  assert.equal(etapaDoPedido({ status: "designado", resposta: "aceita", proposta_aceita_em: "2026-11-22T10:00:00Z", teste: false, escolhido_em: null }), "aceito");
  // Avaliação de teste do credenciamento (o admin designou; o dono não escolheu): não há proposta para o dono aceitar.
  // E1101: o pedido de teste que o DONO escolheu (o piloto) espera o aceite — travado em e1101-relogio-do-pedido.test.ts.
  assert.equal(etapaDoPedido({ status: "designado", resposta: "aceita", proposta_aceita_em: null, teste: true, escolhido_em: null }), "aceito");
  // Fora do "designado" (visita, laudo) ou recusado/sem resposta no prazo: não é a tela do pedido.
  assert.equal(etapaDoPedido({ status: "agendado", resposta: "aceita", proposta_aceita_em: "x", teste: false, escolhido_em: null }), null);
  assert.equal(etapaDoPedido({ status: "designado", resposta: "recusada", proposta_aceita_em: null, teste: false, escolhido_em: null }), null);
});

test("E1079 pedido: os textos do desenho — título, etiqueta, porte e os dois botões", () => {
  assert.equal(tituloDoPedido("novo"), "Novo pedido de avaliação");
  assert.equal(tituloDoPedido("proposta_enviada"), "Pedido de avaliação");
  assert.equal(tituloDoPedido("aceito"), "Pedido de avaliação");
  assert.deepEqual(ETIQUETA_DO_PEDIDO, { novo: "Novo", proposta_enviada: "Proposta enviada", aceito: "Aceito pelo proprietário" });
  assert.equal(linhaDoPorte("q1_2"), "Porte: 1 ou 2 quartos");
  assert.equal(linhaDoPorte("estudio"), "Porte: Estúdio");
  assert.equal(ROTULO_ACEITAR_PEDIDO, "Aceitar pedido");
  assert.equal(ROTULO_RECUSAR_PEDIDO, "Recusar");
});

test("E1079 pedido (E648 de pé): o valor da tabela é referência; 'Você recebe' só depois de o dono aceitar", () => {
  const base = { valor_tabela: 250, valor_proposto: null, prazo_proposto_dias: null, teste: false };
  assert.deepEqual(linhaDoValor("novo", base), { texto: "Valor de referência: R$ 250,00", recebe: false });
  assert.deepEqual(linhaDoValor("proposta_enviada", { ...base, valor_proposto: 280, prazo_proposto_dias: 5 }), { texto: "Proposta enviada: R$ 280,00 em 5 dias", recebe: false });
  assert.deepEqual(linhaDoValor("proposta_enviada", { ...base, valor_proposto: 280, prazo_proposto_dias: 1 }), { texto: "Proposta enviada: R$ 280,00 em 1 dia", recebe: false });
  assert.deepEqual(linhaDoValor("aceito", { ...base, valor_proposto: 280, prazo_proposto_dias: 5 }), { texto: "Você recebe R$ 280,00", recebe: true });
  // Antes do aceite do dono a tela nunca diz "Você recebe".
  for (const e of ["novo", "proposta_enviada"] as const) assert.doesNotMatch(linhaDoValor(e, { ...base, valor_proposto: 280, prazo_proposto_dias: 5 }).texto, /Você recebe/);
  // Avaliação de teste: sem valor.
  assert.deepEqual(linhaDoValor("novo", { ...base, teste: true }), { texto: "Avaliação de teste: sem valor a receber", recebe: false });
  assert.deepEqual(linhaDoValor("aceito", { ...base, teste: true }), { texto: "Avaliação de teste: sem valor a receber", recebe: false });
});

test("E1079 pedido: bairro e cidade antes do aceite do dono; endereço completo só depois", () => {
  assert.equal(localDoPedido("novo", imovel, "Uberlândia"), "Santa Mônica · Uberlândia");
  assert.equal(localDoPedido("proposta_enviada", imovel, "Uberlândia"), "Santa Mônica · Uberlândia");
  assert.equal(localDoPedido("aceito", imovel, "Uberlândia"), "Rua das Palmeiras, 450 · Santa Mônica · Uberlândia");
  for (const e of ["novo", "proposta_enviada"] as const) assert.doesNotMatch(localDoPedido(e, imovel, "Uberlândia"), /Palmeiras|450/);
  // Sem bairro gravado, a cidade do pedido; aceito sem a linha exata, a região (nunca vazio).
  assert.equal(localDoPedido("novo", { address: null, city: null }, "Uberlândia"), "Uberlândia");
  assert.equal(localDoPedido("aceito", { exact_address: null, address: "Saraiva", city: "Uberlândia" }, "Uberlândia"), "Saraiva · Uberlândia");
});

test("E1079 pedido: a tela aceita pela proposta do E648 e não mostra a data pedida pelo dono", () => {
  const tela = ler("../../components/avaliadores/pedido.tsx");
  const aceitar = ler("../../components/avaliadores/aceitar-pedido.tsx");
  assert.match(aceitar, /semQuedaDeRede\(proporPrecoEPrazo\(form\)\)/, "aceitar é propor o próprio valor e o próprio prazo (E648)");
  assert.match(aceitar, /name="valor"/);
  assert.match(aceitar, /name="prazoDias"/);
  assert.match(aceitar, /semQuedaDeRede\(responderDesignacao\(form\)\)/, "recusar segue pela ação de hoje");
  assert.doesNotMatch(tela + aceitar, /Data pedida pelo dono/);
  // Regra da casa: as cores e medidas do desenho vivem em visual-mockup.ts, não no componente.
  assert.doesNotMatch(tela + aceitar, /bg-\[#|text-\[#|shadow-\[|border-\[#/);
});
