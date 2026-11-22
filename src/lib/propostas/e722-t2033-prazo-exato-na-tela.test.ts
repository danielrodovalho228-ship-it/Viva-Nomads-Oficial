/*
  t2033 · E722 (Pista 3, lote 2, item E1) @E722 @ao-vivo-seguro
  Regra: o prazo da pré-aceitação aparece na tela da proposta com a data e a hora EXATAS (horário de Brasília), para o
  morador e para o dono; um prazo por vez — com a candidatura de volta ao dono, some o do morador e aparece só o dele.
  Renderiza a tela REAL (proposta-detalhe.tsx) com o prazo calculado pelas regras REAIS (prazoDaPreAceitacao,
  prazoDoDono, textoDoPrazo, linhaDeContexto). Dublês só nas bordas (ver e722-tela-harness/). A chave do E722 está
  desligada em produção e no laboratório: a tela só é alcançável assim.
  Roda: node --test src/lib/propostas/e722-t2033-prazo-exato-na-tela.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { proposta, renderizar, textoDe } from "./e722-tela-harness/proposta.ts";
import { linhaDeContexto, prazoDaPreAceitacao, prazoDoDono, textoDoPrazo, TEXTO_REGRA_CORRIDA, TEXTO_SEM_PUNICAO, TEXTO_TAXA_CONTINUA } from "./pre-aceitacao.ts";

const ACEITE = new Date("2026-11-08T15:30:00Z"); // 08/11 12:30 BRT
const ATE = prazoDaPreAceitacao(ACEITE, "2026-12-20"); // 11/11 12:30 BRT

function pre(papel: "owner" | "tenant", estado: "vigente" | "expirada") {
  const ateTexto = textoDoPrazo(ATE);
  const donoAteTexto = estado === "expirada" ? textoDoPrazo(prazoDoDono(ATE, "2026-12-20")) : null;
  return {
    estado, ateIso: ATE.toISOString(), ateTexto, donoAteTexto, contexto: linhaDeContexto(papel, estado, ateTexto, donoAteTexto),
    encerrada: false, perdeuACorrida: false, reaberturas: 0, podeReabrir: estado === "expirada",
    regraCorrida: TEXTO_REGRA_CORRIDA, semPunicao: TEXTO_SEM_PUNICAO, taxaContinua: TEXTO_TAXA_CONTINUA,
  };
}

test("E1: vigente — morador e dono veem 'Termina em 11/11/2026 às 12:30 (horário de Brasília).'", () => {
  for (const papel of ["tenant", "owner"] as const) {
    const t = textoDe(renderizar(proposta({ papel, preAceitacao: pre(papel, "vigente") })));
    assert.match(t, /Prazo para concluir o contrato/, papel);
    assert.ok(t.includes("Termina em 11/11/2026 às 12:30 (horário de Brasília)."), `${papel}: ${t.slice(0, 400)}`);
    assert.ok(t.includes(TEXTO_REGRA_CORRIDA) && t.includes(TEXTO_SEM_PUNICAO), papel);
  }
});

test("E1: o dono, durante a janela do morador, lê que o prazo dele só começa se ela terminar sem contrato", () => {
  const t = textoDe(renderizar(proposta({ papel: "owner", preAceitacao: pre("owner", "vigente") })));
  assert.ok(t.includes("Seu prazo de 1 dia útil para decidir só começa se a janela do morador terminar sem contrato."));
});

test("E1: expirada — um prazo por vez: o dono vê só o prazo dele (quinta 12/11 12:30); o do morador não aparece como vigente", () => {
  const dono = textoDe(renderizar(proposta({ papel: "owner", status: "expirada", preAceitacao: pre("owner", "expirada") })));
  assert.ok(dono.includes("Seu prazo para decidir termina em 12/11/2026 às 12:30 (horário de Brasília)."), dono.slice(0, 500));
  assert.doesNotMatch(dono, /Termina em 11\/11\/2026/);
  assert.ok(dono.includes("A janela do morador terminou em 11/11/2026 às 12:30 (horário de Brasília)."));
  const morador = textoDe(renderizar(proposta({ papel: "tenant", status: "expirada", preAceitacao: pre("tenant", "expirada") })));
  assert.doesNotMatch(morador, /Termina em 11\/11\/2026/);
  assert.doesNotMatch(morador, /Seu prazo para decidir/);
  assert.ok(morador.includes("O proprietário tem até 12/11/2026 às 12:30 (horário de Brasília) para decidir."));
});

test("E1: o horário é o de Brasília, com os minutos exatos (aceite 23:47 de Brasília → fim 23:47 três dias depois)", () => {
  const ate = prazoDaPreAceitacao(new Date("2026-11-09T02:47:00Z"), null); // 08/11 23:47 BRT
  const v = { ...pre("tenant", "vigente"), ateIso: ate.toISOString(), ateTexto: textoDoPrazo(ate) };
  const t = textoDe(renderizar(proposta({ papel: "tenant", preAceitacao: v })));
  assert.ok(t.includes("Termina em 11/11/2026 às 23:47 (horário de Brasília)."), t.slice(0, 400));
});
