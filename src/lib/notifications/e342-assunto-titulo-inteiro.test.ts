/*
  E342 — o nome do imóvel nunca morre no meio do assunto. O corte era no ASSUNTO REAL enviado (régua dos 70 caracteres
  em assuntoComTitulo), não só na cópia da caixa de teste: "Renovar [TESTE QA] Automaçõ…?". Agora: o título inteiro na
  forma normal ou na compacta (fato primeiro, imóvel depois); se nem assim couber, corte numa fronteira de palavra que
  ainda identifique o imóvel; se não der, o assunto do modelo (o corpo nomeia o imóvel).
  Roda: node --test src/lib/notifications/e342-assunto-titulo-inteiro.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { assuntoComTitulo, comMarca, ASSUNTO_MAX, tituloNoAssunto } from "./assuntos.ts";
import { corpoAutomacao } from "../automacoes/corpo-automacao.ts";

const TESTE = { titulo: "[TESTE QA] Automações E289 R.", bairro: "Santa Mônica", cidade: "Uberlândia" };
const LONGO = { titulo: "Apartamento mobiliado espaçoso no Santa Mônica perto da UFU", bairro: "Santa Mônica", cidade: "Uberlândia" };
const assunto = (tipo: string, imovel: object, extra: object) => {
  const s = corpoAutomacao(tipo as never, { imovel, ...extra } as never).subject;
  return s ? comMarca(s) : null;
};
// Nenhuma palavra do título pode aparecer cortada: cada pedaço antes do "…" é uma palavra inteira do título.
const semPalavraCortada = (a: string, titulo: string) => {
  const m = /(\S+)…/.exec(a);
  if (!m) return true;
  return titulo.split(" ").includes(m[1].replace(/[,;:·]$/, ""));
};

test("os 4 assuntos da conferência de 01/11 saem com o nome inteiro, em até 70 caracteres", () => {
  const casos = [
    ["renovacao_aviso", { data: "2026-11-15" }, "Renovar [TESTE QA] Automações E289 R.? Termina em 15/11 · Viva Nomads"],
    ["proposta_vencendo", { prazo: "2026-11-01T01:00:00Z", numero: "PRP-1" }, "Proposta vence 31/10 22h: [TESTE QA] Automações E289 R. · Viva Nomads"],
    ["estadia_instrucoes_pendentes", { data: "2026-11-10" }, "Chegada em 10/11: [TESTE QA] Automações E289 R. · Viva Nomads"],
  ] as const;
  for (const [tipo, extra, esperado] of casos) {
    const a = assunto(tipo, TESTE, extra);
    assert.equal(a, esperado, tipo);
    assert.ok(a!.length <= ASSUNTO_MAX, `${tipo}: ${a!.length}`);
    assert.ok(a!.includes(TESTE.titulo), `${tipo}: nome inteiro`);
  }
  // Quem já cabia segue igual (forma normal primeiro).
  assert.equal(assunto("saida_lembrete", TESTE, { data: "2026-11-03" }), "Saída de [TESTE QA] Automações E289 R. em 03/11 · Viva Nomads");
});

test("título longo: corte só em fronteira de palavra, nunca no meio; sem palavra que identifique, assunto do modelo", () => {
  for (const tipo of ["renovacao_aviso", "proposta_vencendo", "estadia_instrucoes_pendentes", "saida_lembrete", "avaliacao_pedido"]) {
    const a = assunto(tipo, LONGO, { data: "2026-11-15", prazo: "2026-11-01T01:30:00Z" });
    assert.ok(a, tipo);
    assert.ok(a!.length <= ASSUNTO_MAX, `${tipo}: ${a}`);
    assert.ok(semPalavraCortada(a!, LONGO.titulo), `${tipo}: ${a}`);
  }
  assert.equal(tituloNoAssunto("Apartamento enorme com vista para o mar e varanda gourmet"), "Apartamento enorme com vista para o mar…");
  assert.equal(tituloNoAssunto("Casa Automações Integradas", 18), "Casa Automações…");
  // Só a marca de teste caberia: melhor o assunto do modelo do que "[TESTE QA]…".
  assert.equal(assuntoComTitulo("Um prefixo bem comprido para não sobrar nada: ", "[TESTE QA] Automações E289 R."), null);
});
