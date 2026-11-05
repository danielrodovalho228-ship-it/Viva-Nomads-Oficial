/*
  E539 (iv) — a folha "Ações desta estadia" repetia o que a página da estadia já mostra: "Falar com o proprietário/
  morador" é o mesmo link do primário "Mensagem" do cartão de status, e "Ver instruções de chegada" só pulava para o
  painel "Instruções de chegada" da própria página (#instrucoes). Correção: a folha leva só o que NÃO está na página
  (contrato, alteração de datas, pedidos de serviço, calendário do dono).
  Roda: node --test src/lib/estadia/e539-folha-sem-repeticao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { acoesDaEstadia, mensagemDaEstadia, type ContratoDaEstadia } from "./acoes.ts";
import { HREF_ESTADIA, type FaseEstadia } from "./estadia.ts";

const ID = "11111111-2222-4333-8444-555555555555";
const base: ContratoDaEstadia = { id: ID, fase: "antes", conversaId: "conv-1", imovelId: "66666666-7777-4888-8999-aaaaaaaaaaaa", cidade: "Uberlândia", instrucoesLiberadas: false };

test("nenhum item da folha repete um link que a página já mostra", () => {
  const mensagem = mensagemDaEstadia(base).href;
  for (const papel of ["inquilino", "proprietario"] as const)
    for (const fase of ["antes", "durante", "encerrada"] as FaseEstadia[])
      for (const instrucoesLiberadas of [false, true]) {
        const acoes = acoesDaEstadia(papel, { ...base, fase, instrucoesLiberadas });
        const caso = JSON.stringify({ papel, fase, instrucoesLiberadas });
        assert.ok(!acoes.some((a) => a.href === mensagem), `repete o "Mensagem": ${caso}`);
        assert.ok(!acoes.some((a) => a.href.startsWith(`${HREF_ESTADIA(ID)}#`)), `âncora da própria página: ${caso}`);
      }
});

test("a folha segue com o que só ela oferece", () => {
  assert.deepEqual(acoesDaEstadia("proprietario", { ...base, fase: "durante", instrucoesLiberadas: true }).map((a) => a.chave), ["contrato", "alteracao", "limpeza", "manutencao", "calendario"]);
  assert.deepEqual(acoesDaEstadia("inquilino", { ...base, instrucoesLiberadas: true }).map((a) => a.chave), ["contrato", "alteracao", "limpeza", "manutencao"]);
});
