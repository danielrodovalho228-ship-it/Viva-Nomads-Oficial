/*
  E707 — composição dos prazos da caução (parecer da Dra. Beatriz pendente; tudo atrás de CAUCAO_PRAZOS_ATIVA, desligada):
   (a) parecer sem desconto OU silêncio no 7º dia = devolução DEVIDA DE IMEDIATO; os 30 dias são só o TETO EXTERNO contado
       do check-out confirmado — um marco só, usado por prazos.ts e caucao.ts;
   (c) a parte INDISCUTÍVEL (caução − tudo o que o dono pleiteia) é liberada ao fim da janela de contestação, mesmo com
       disputa no restante.
  Roda: node --test src/lib/caucao/e707-composicao-prazos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRAZO_REEMBOLSO_DIAS, tetoExternoDevolucao } from "../caucao.ts";
import { PRAZO_DEVOLUCAO_DIAS, estadoDosPrazos, parteIndiscutivel, type FatosPrazo, type ItemDesconto } from "./prazos.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const base: FatosPrazo = { saida: "2026-11-06", parecerEm: null, descontos: [], devolvidaEm: null, hoje: "2026-11-08" };
const item: ItemDesconto = { id: "i1", valor: 300, categoria: "dano", comodo: "Sala", fotoEntrada: "e", fotoSaida: "s", comprovante: "c", status: "proposto" };

test("E707: um marco só — o teto de 30 dias é o mesmo em prazos.ts e caucao.ts, contado do check-out", () => {
  assert.equal(PRAZO_DEVOLUCAO_DIAS, PRAZO_REEMBOLSO_DIAS);
  assert.equal(tetoExternoDevolucao("2026-11-06"), "2026-12-06");
  assert.equal(estadoDosPrazos(base).devolverAte, tetoExternoDevolucao(base.saida));
  assert.equal(estadoDosPrazos(base).tetoExterno, tetoExternoDevolucao(base.saida));
});

test("E707 (a): silêncio no 7º dia → devolução devida de imediato, desde o dia seguinte ao prazo do parecer", () => {
  const e = estadoDosPrazos({ ...base, hoje: "2026-11-14" });
  assert.equal(e.chave, "liberacao_integral");
  assert.equal(e.devolucaoDevida, true);
  assert.equal(e.devidaDesde, "2026-11-14");
  assert.equal(e.pendenciaDevolucao, false, "o teto de 30 dias ainda não passou");
});

test("E707 (a): parecer sem desconto → devida desde o dia do parecer; antes do prazo do parecer nada é devido", () => {
  const e = estadoDosPrazos({ ...base, parecerEm: "2026-11-09", hoje: "2026-11-10" });
  assert.equal(e.motivo, "parecer_sem_desconto");
  assert.equal(e.devolucaoDevida, true);
  assert.equal(e.devidaDesde, "2026-11-09");
  const antes = estadoDosPrazos({ ...base, hoje: "2026-11-13" });
  assert.equal(antes.chave, "aguardando_parecer");
  assert.equal(antes.devolucaoDevida, false);
  assert.equal(antes.devidaDesde, null);
});

test("E707 (a): o teto de 30 dias continua gerando a pendência só depois do dia 30 do check-out", () => {
  assert.equal(estadoDosPrazos({ ...base, hoje: "2026-12-06" }).pendenciaDevolucao, false);
  assert.equal(estadoDosPrazos({ ...base, hoje: "2026-12-07" }).pendenciaDevolucao, true);
});

test("E707 (c): parte indiscutível = caução − tudo o que o dono pleiteia (aceito, proposto ou contestado), nunca negativa", () => {
  assert.equal(parteIndiscutivel(1000, [{ ...item, valor: 300, status: "contestado" }, { ...item, id: "i2", valor: 200, status: "proposto" }]), 500);
  assert.equal(parteIndiscutivel(1000, []), 1000);
  assert.equal(parteIndiscutivel(400, [{ ...item, valor: 900 }]), 0);
});

test("E707 (c): ao fim da janela de contestação a parte indiscutível é liberada, mesmo com disputa no resto", () => {
  const f = { ...base, caucao: 1000, parecerEm: "2026-11-09", descontos: [{ ...item, status: "contestado" as const }, { ...item, id: "i2", valor: 200 }] };
  const dentro = estadoDosPrazos({ ...f, hoje: "2026-11-12" });
  assert.equal(dentro.chave, "em_disputa");
  assert.equal(dentro.liberarParteIndiscutivel, null, "a janela ainda está aberta");
  const fim = estadoDosPrazos({ ...f, hoje: "2026-11-15" });
  assert.equal(fim.chave, "em_disputa");
  assert.deepEqual(fim.liberarParteIndiscutivel, { valor: 500, desde: "2026-11-15" });
  const semCaucao = estadoDosPrazos({ ...f, caucao: undefined, hoje: "2026-11-15" });
  assert.equal(semCaucao.liberarParteIndiscutivel, null, "sem o valor da caução, nada a calcular");
});

test("E707: tudo segue atrás de CAUCAO_PRAZOS_ATIVA (desligada) e o cron avisa 'devida agora', com o teto externo", () => {
  assert.match(ler("src/lib/flags.ts"), /CAUCAO_PRAZOS_ATIVA = process\.env\.NEXT_PUBLIC_CAUCAO_PRAZOS_ATIVA === "on"/);
  const srv = ler("src/lib/caucao/prazos-servidor.ts");
  assert.match(srv, /if \(!CAUCAO_PRAZOS_ATIVA\) return/);
  assert.match(srv, /devolução é devida agora/);
  assert.match(srv, /teto externo/);
});

test("E707 (c) — antes do fim da janela, se o morador já respondeu a TODOS os itens (aceitou ou contestou), a parte indiscutível é liberada na hora", () => {
  const f = { ...base, caucao: 1000, parecerEm: "2026-11-09", hoje: "2026-11-11" };
  // aceitou tudo: não há disputa; o que sobra depois dos descontos aceitos é devido já
  const aceitou = estadoDosPrazos({ ...f, descontos: [{ ...item, status: "aceito" as const }, { ...item, id: "i2", valor: 200, status: "aceito" as const }] });
  assert.equal(aceitou.chave, "em_contestacao", "a janela ainda existe no calendário");
  assert.deepEqual(aceitou.liberarParteIndiscutivel, { valor: 500, desde: "2026-11-11" });
  // aceitou um e contestou o outro: disputa no restante, mas todos respondidos → libera antes do dia 14
  const misto = estadoDosPrazos({ ...f, descontos: [{ ...item, status: "aceito" as const }, { ...item, id: "i2", valor: 200, status: "contestado" as const }] });
  assert.equal(misto.chave, "em_disputa");
  assert.deepEqual(misto.liberarParteIndiscutivel, { valor: 500, desde: "2026-11-11" });
  // ainda há item sem resposta: espera o fim da janela
  const pendente = estadoDosPrazos({ ...f, descontos: [{ ...item, status: "aceito" as const }, { ...item, id: "i2", valor: 200, status: "proposto" as const }] });
  assert.equal(pendente.liberarParteIndiscutivel, null);
  const pendenteContestado = estadoDosPrazos({ ...f, descontos: [{ ...item, status: "contestado" as const }, { ...item, id: "i2", valor: 200, status: "proposto" as const }] });
  assert.equal(pendenteContestado.liberarParteIndiscutivel, null);
});

test("E707 (c) — passada a janela sem contestação, o valor indiscutível também é informado (desconto valendo)", () => {
  const e = estadoDosPrazos({ ...base, caucao: 1000, parecerEm: "2026-11-09", descontos: [item], hoje: "2026-11-15" });
  assert.equal(e.chave, "desconto_valendo");
  assert.deepEqual(e.liberarParteIndiscutivel, { valor: 700, desde: "2026-11-15" });
});
