import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SEM_INSTRUCOES, corpoDaChegada, imovelPorExtenso, instrucoesNoEmail, lembreteDeChegadaPermitido, linhasDaEstadia } from "./emails-chegada.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const E = {
  imovel: { titulo: "Studio Centro", bairro: "Centro", cidade: "Uberlândia" },
  entrada: "2026-11-04",
  saida: "2027-01-02",
  horarioEntrada: "14:00",
  horarioSaida: "11:00",
};

test("E209 (a): imóvel e datas da estadia no corpo", () => {
  assert.equal(imovelPorExtenso(E.imovel), "Studio Centro · Centro, Uberlândia");
  assert.deepEqual(linhasDaEstadia(E), [
    { rotulo: "Imóvel", valor: "Studio Centro · Centro, Uberlândia" },
    { rotulo: "Entrada", valor: "04/11/2026, a partir das 14:00" },
    { rotulo: "Saída", valor: "02/01/2027, até as 11:00" },
  ]);
  // Sem horário no anúncio: só a data (nada inventado).
  assert.deepEqual(linhasDaEstadia({ ...E, horarioEntrada: null, horarioSaida: "" }).map((l) => l.valor).slice(1), ["04/11/2026", "02/01/2027"]);
});

test("E209 (b): as instruções vão no corpo do e-mail do morador (na ordem do formulário); o dono não recebe", () => {
  const instr = { wifi_senha: "abc123", como_entrar: "Chave na portaria.\nApto 12.", lixo: "  " };
  assert.deepEqual(instrucoesNoEmail(instr).map((i) => i.rotulo), ["Como entrar", "Wi-Fi: senha"]);
  const m = corpoDaChegada(E, instr, true, "Imóvel: Studio Centro. Entrada em 04/11/2026.");
  assert.match(m.html, /Imóvel: Studio Centro\. Entrada em 04\/11\/2026\./);
  assert.match(m.html, /Studio Centro · Centro, Uberlândia/);
  assert.match(m.html, /Instruções de chegada/);
  assert.match(m.html, /Chave na portaria\.<br>Apto 12\./);
  assert.match(m.texto, /Como entrar: Chave na portaria\.\nApto 12\./);
  const d = corpoDaChegada(E, instr, false);
  assert.doesNotMatch(d.html, /Instruções de chegada|portaria|abc123/);
  // Sem instruções preenchidas: aviso claro, nunca vazio.
  assert.match(corpoDaChegada(E, null, true).html, new RegExp(SEM_INSTRUCOES.slice(0, 40)));
  // Escapado.
  assert.match(corpoDaChegada(E, { como_entrar: "<b>x</b>" }, true).html, /&lt;b&gt;x&lt;\/b&gt;/);
});

test("E209 (c): o lembrete D-2/D-1 só com assinado pelas duas + 1º pagamento", () => {
  assert.equal(lembreteDeChegadaPermitido({ assinadoPelasDuas: true, primeiroPagamento: true }), true);
  assert.equal(lembreteDeChegadaPermitido({ assinadoPelasDuas: true, primeiroPagamento: false }), false);
  assert.equal(lembreteDeChegadaPermitido({ assinadoPelasDuas: false, primeiroPagamento: true }), false);
});

test("GUARDA: as rotinas usam o corpo novo e a condição do pagamento", () => {
  const checkin = ler("../../app/api/cron/checkin-lembretes/route.ts");
  assert.match(checkin, /pagamentos_bloco\(tipo, confirmado_pelo_inquilino, anulado_em\)/);
  assert.ok(checkin.indexOf("lembreteDeChegadaPermitido(") < checkin.indexOf(".upsert("), "a condição vem antes de marcar e enviar");
  assert.match(checkin, /detailsHtml: corpo\.html/);
  const auto = ler("../../app/api/cron/automacoes/route.ts");
  assert.match(auto, /corpoDaChegada\(estadia, instrucoes, true, detalheAutomacao\("estadia_instrucoes_liberadas"/);
  assert.match(auto, /\.\.\.\(a\.detailsHtml \? \{ detailsHtml: a\.detailsHtml \} : \{\}\)/);
});
