/*
  DESTINO-PESSOAL-B — "Outro local" pessoal, agregado do admin e "Não achei meu local".
  Roda: node --test src/lib/destinos/pessoal.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CELULA_GRAUS_LAT,
  CELULA_GRAUS_LNG,
  MIN_PESSOAS_AGREGADO,
  MSG_NAO_ACHAMOS,
  ROTULO_NAO_ACHEI,
  agregarCelulas,
  celulaDoPonto,
  centroDaCelula,
  consultaDoLocal,
  pontoDoLaboratorio,
  pontoGuardado,
  pontoValido,
  rotuloDoLocal,
  validarNaoAchei,
} from "./pessoal.ts";
import { rotuloReta } from "../rotas/tempo.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const AGORA = new Date("2026-10-24T12:00:00Z");
const dias = (n: number) => new Date(AGORA.getTime() - n * 86_400_000).toISOString();
const pessoa = (n: number, lat = -18.911, lng = -48.262, usado = dias(1)) => ({ userId: `u${n}`, lat, lng, usadoEm: usado });

test("grade de ~300 m: a mesma conta do banco (0,0027° × 0,0029°)", () => {
  assert.ok(Math.abs(CELULA_GRAUS_LAT * 111_320 - 300) < 5, "≈300 m de latitude");
  assert.ok(Math.abs(CELULA_GRAUS_LNG * 111_320 * Math.cos((19 * Math.PI) / 180) - 305) < 10, "≈300 m de longitude em Uberlândia");
  const sql = ler("supabase/migrations/0240_destinos_pessoais.sql");
  assert.match(sql, /floor\(d\.lat \/ 0\.0027\)/);
  assert.match(sql, /floor\(d\.lng \/ 0\.0029\)/);
  assert.match(sql, /count\(distinct c\.user_id\) >= greatest\(5, p_min\)/);
  const c = celulaDoPonto({ lat: -18.911, lng: -48.262 });
  assert.equal(c.chave, "-7005:-16643");
  assert.deepEqual(centroDaCelula(c.i, c.j), { lat: -18.91215, lng: -48.26325 });
});

test("agregado esconde ponto com menos de 5 pessoas distintas (a mesma pessoa duas vezes conta uma)", () => {
  const quatro = [1, 2, 3, 4].map((n) => pessoa(n));
  assert.deepEqual(agregarCelulas([...quatro, pessoa(4, -18.9112, -48.2621)], AGORA), [], "4 pessoas: não aparece");
  const cinco = agregarCelulas([...quatro, pessoa(5)], AGORA);
  assert.equal(cinco.length, 1);
  assert.equal(cinco[0].pessoas, 5);
  assert.equal(MIN_PESSOAS_AGREGADO, 5);
  assert.equal(agregarCelulas([...quatro, pessoa(5)], AGORA, 2).length, 1);
});

test("agregado: só os últimos 90 dias e nunca endereço, rótulo ou quem", () => {
  const velhos = [1, 2, 3, 4].map((n) => pessoa(n)).concat(pessoa(5, -18.911, -48.262, dias(91)));
  assert.deepEqual(agregarCelulas(velhos, AGORA), [], "uso de 91 dias atrás não conta");
  const r = agregarCelulas([1, 2, 3, 4, 5].map((n) => pessoa(n)), AGORA)[0];
  assert.deepEqual(Object.keys(r).sort(), ["centro", "chave", "pessoas"]);
  assert.notDeepEqual(r.centro, { lat: -18.911, lng: -48.262 }, "o centro da célula, não o ponto de alguém");
});

test("ponto guardado com 3 casas; fora do Brasil é inválido", () => {
  assert.deepEqual(pontoGuardado({ lat: -18.91234, lng: -48.26291 }), { lat: -18.912, lng: -48.263 });
  assert.equal(pontoValido({ lat: -18.9, lng: -48.2 }), true);
  assert.equal(pontoValido({ lat: 40.7, lng: -74 }), false);
  assert.equal(pontoValido({ lat: "x", lng: 1 }), false);
});

test("rótulo do local sem número de casa nem CEP; consulta com cidade e estado", () => {
  assert.equal(rotuloDoLocal("Rua Tal, 123 - Centro, 38400-100"), "Rua Tal, Centro");
  assert.equal(rotuloDoLocal("  "), "Meu local");
  assert.deepEqual(consultaDoLocal(" Hospital <b>X</b> ", "Uberlândia", "mg"), { endereco: "Hospital bX/b", cidade: "Uberlândia", uf: "MG" });
  assert.equal(consultaDoLocal("ab", "Uberlândia", "MG"), null);
});

test("'Não achei meu local': nome do lugar e cidade; sem contato nem endereço", () => {
  assert.deepEqual(validarNaoAchei({ nome: " Clínica Bem Estar ", cidade: "Uberlândia" }), { ok: true, nome: "Clínica Bem Estar", cidade: "Uberlândia" });
  assert.equal(validarNaoAchei({ nome: "x", cidade: "Uberlândia" }).ok, false);
  assert.equal(validarNaoAchei({ nome: "Clínica", cidade: "" }).ok, false);
  assert.equal(validarNaoAchei({ nome: "fale com joao@x.com", cidade: "Uberlândia" }).ok, false);
  assert.equal(validarNaoAchei({ nome: "Rua 12345", cidade: "Uberlândia" }).ok, false);
});

test("endereço inválido cai no pedido: o laboratório não acha 'inexistente' e a tela oferece o 'Não achei meu local'", () => {
  assert.equal(pontoDoLaboratorio("Rua Inexistente 999"), null);
  const p = pontoDoLaboratorio("Hospital do Lab");
  assert.ok(p && pontoValido(p));
  assert.deepEqual(pontoDoLaboratorio("Hospital do Lab"), p, "mesmo texto, mesmo ponto");
  assert.equal(MSG_NAO_ACHAMOS, "Não achamos este endereço.");
  assert.equal(ROTULO_NAO_ACHEI, "Não achei meu local");
  const acoes = ler("src/lib/destinos/pessoal-actions.ts");
  assert.match(acoes, /naoAchou: true/);
  const campo = ler("src/components/busca/campo-destino.tsx");
  assert.match(campo, /MSG_NAO_ACHAMOS/);
  assert.match(campo, /ROTULO_NAO_ACHEI/);
});

test("sem token de rotas: distância em linha reta dita como tal, nunca minutos inventados", () => {
  // O local pessoal vai à busca pela URL (dlat/dlng/drot) e passa pelo mesmo /api/tempos do Prompt 37.
  assert.match(rotuloReta(1400, "Hospital X"), /linha reta/);
  assert.doesNotMatch(rotuloReta(1400, "Hospital X"), /min/);
  const campo = ler("src/components/busca/campo-destino.tsx");
  assert.match(campo, /escolher\(\{ lat: r\.ponto\.lat, lng: r\.ponto\.lng, rot: r\.rotulo \}\)/);
  const api = ler("src/app/api/tempos/route.ts");
  assert.match(api, /dlat: b\.dlat == null/);
});

test("RLS e privacidade: tabela só da pessoa; admin lê só o agregado (função do servidor)", () => {
  const sql = ler("supabase/migrations/0240_destinos_pessoais.sql");
  assert.match(sql, /using \(user_id = auth\.uid\(\)\) with check \(user_id = auth\.uid\(\)\)/);
  assert.doesNotMatch(sql, /is_admin\(\)/, "nenhuma política para o admin ler destinos_pessoais");
  assert.match(sql, /grant execute on function public\.destinos_pessoais_agregado\(int, int\) to service_role/);
  assert.match(sql, /revoke all on public\.destinos_nao_achados from anon, authenticated/);
  const admin = ler("src/app/(dashboard)/admin/destinos/page.tsx");
  assert.doesNotMatch(admin, /from\("destinos_pessoais"\)/, "o admin nunca lê a tabela, só o agregado");
  assert.match(admin, /rpc\("destinos_pessoais_agregado"/);
  const acoes = ler("src/lib/destinos/pessoal-actions.ts");
  assert.match(acoes, /consumirLimite\(/);
});
