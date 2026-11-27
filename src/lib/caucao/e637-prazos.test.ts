/*
  E637 (desenho FECHADO pelo coordenador em 05/11/2026) — prazos da caução, ATRÁS DE TRAVA DESLIGADA (CAUCAO_PRAZOS_ATIVA)
  até o parecer da Dra. Beatriz:
   • parecer do dono = 7 dias corridos após o check-out;
   • silêncio no dia 7 → o sistema registra "liberação integral" e avisa os dois; a devolução integral vence no dia 30;
   • contestação do morador = 5 dias, item a item;
   • desconto só com prova (foto de entrada × saída lado a lado + valor + comprovante); desgaste natural NUNCA desconta;
   • dia 30 sem devolução → pendência no painel do dono + bloqueio de novos anúncios até regularizar;
   • a Viva NUNCA decide a disputa: entrega o dossiê em PDF e oferece acordo, vistoriador parceiro ou Juizado.
  Roda: node --test src/lib/caucao/e637-prazos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  PRAZO_CONTESTACAO_DIAS, PRAZO_DEVOLUCAO_DIAS, PRAZO_PARECER_DIAS, TEXTO_VIVA_NAO_DECIDE, SAIDAS_DA_DISPUTA,
  addDias, bloqueiaNovosAnuncios, descontoValido, estadoDosPrazos, prazosDaSaida, type FatosPrazo,
} from "./prazos.ts";
import { prontidaoAnuncio, type FatosAnuncio } from "../anuncio/prontidao.ts";
import { CHAVES_AMBIENTE } from "../../config/chaves-ambiente.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("os números do desenho: 7 dias para o parecer, 5 para contestar, 30 para devolver", () => {
  assert.equal(PRAZO_PARECER_DIAS, 7);
  assert.equal(PRAZO_CONTESTACAO_DIAS, 5);
  assert.equal(PRAZO_DEVOLUCAO_DIAS, 30);
});

test("dias CORRIDOS (calendário), não úteis, inclusive na virada de mês e de ano", () => {
  assert.equal(addDias("2026-11-06", 7), "2026-11-13");
  assert.equal(addDias("2026-12-28", 7), "2027-01-04");
  assert.equal(addDias("2027-02-25", 5), "2027-03-02");
  assert.deepEqual(prazosDaSaida("2026-11-06"), { parecerAte: "2026-11-13", devolucaoAte: "2026-12-06" });
});

const base: FatosPrazo = { saida: "2026-11-06", parecerEm: null, descontos: [], devolvidaEm: null, hoje: "2026-11-08" };

test("dentro dos 7 dias sem parecer: aguardando o dono; o dia 7 ainda é do dono", () => {
  assert.equal(estadoDosPrazos({ ...base, hoje: "2026-11-08" }).chave, "aguardando_parecer");
  assert.equal(estadoDosPrazos({ ...base, hoje: "2026-11-13" }).chave, "aguardando_parecer");
});

test("silêncio: passado o dia 7 sem parecer vira liberação integral, com a devolução vencendo no dia 30", () => {
  const e = estadoDosPrazos({ ...base, hoje: "2026-11-14" });
  assert.equal(e.chave, "liberacao_integral");
  assert.equal(e.motivo, "silencio");
  assert.equal(e.devolverAte, "2026-12-06");
  assert.equal(e.avisarOsDois, true);
});

test("parecer sem desconto também é liberação integral", () => {
  const e = estadoDosPrazos({ ...base, parecerEm: "2026-11-09", hoje: "2026-11-10" });
  assert.equal(e.chave, "liberacao_integral");
  assert.equal(e.motivo, "parecer_sem_desconto");
});

const item = { id: "i1", valor: 300, categoria: "dano", comodo: "Sala", fotoEntrada: "e/1.jpg", fotoSaida: "s/1.jpg", comprovante: "c/1.pdf", status: "proposto" as const };

test("parecer com desconto: o morador tem 5 dias, item a item; passados, o que não foi contestado vale", () => {
  const dentro = estadoDosPrazos({ ...base, parecerEm: "2026-11-09", descontos: [item], hoje: "2026-11-14" });
  assert.equal(dentro.chave, "em_contestacao");
  assert.equal(dentro.contestarAte, "2026-11-14");
  const fora = estadoDosPrazos({ ...base, parecerEm: "2026-11-09", descontos: [item], hoje: "2026-11-15" });
  assert.equal(fora.chave, "desconto_valendo");
});

test("item contestado leva à disputa: a Viva não decide, entrega o dossiê e oferece as saídas", () => {
  const e = estadoDosPrazos({ ...base, parecerEm: "2026-11-09", descontos: [{ ...item, status: "contestado" }, { ...item, id: "i2", status: "proposto" }], hoje: "2026-11-12" });
  assert.equal(e.chave, "em_disputa");
  assert.equal(e.vivaDecide, false);
  assert.deepEqual(SAIDAS_DA_DISPUTA.map((s) => s.chave), ["acordo", "vistoriador_parceiro", "juizado"]);
  assert.match(TEXTO_VIVA_NAO_DECIDE, /não decide/i);
  assert.match(TEXTO_VIVA_NAO_DECIDE, /dossiê/i);
});

test("desconto só vale com prova: foto de entrada e de saída, valor e comprovante", () => {
  assert.equal(descontoValido(item).ok, true);
  for (const campo of ["fotoEntrada", "fotoSaida", "comprovante"] as const) {
    const r = descontoValido({ ...item, [campo]: "" });
    assert.equal(r.ok, false, campo);
  }
  assert.equal(descontoValido({ ...item, valor: 0 }).ok, false);
  assert.equal(descontoValido({ ...item, valor: -5 }).ok, false);
  assert.equal(descontoValido({ ...item, comodo: " " }).ok, false);
});

test("desgaste natural NUNCA desconta", () => {
  const r = descontoValido({ ...item, categoria: "desgaste_natural" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.motivo, /desgaste natural/i);
});

test("dia 30 sem devolução: pendência e bloqueio de novos anúncios; devolvida a qualquer hora regulariza", () => {
  const antes = estadoDosPrazos({ ...base, hoje: "2026-12-06" });
  assert.equal(antes.chave, "liberacao_integral");
  assert.equal(antes.pendenciaDevolucao, false);
  const dia31 = estadoDosPrazos({ ...base, hoje: "2026-12-07" });
  assert.equal(dia31.pendenciaDevolucao, true);
  assert.equal(bloqueiaNovosAnuncios([dia31]), true);
  const paga = estadoDosPrazos({ ...base, hoje: "2026-12-20", devolvidaEm: "2026-12-10" });
  assert.equal(paga.chave, "devolvida");
  assert.equal(paga.pendenciaDevolucao, false);
  assert.equal(bloqueiaNovosAnuncios([paga]), false);
  assert.equal(bloqueiaNovosAnuncios([]), false);
});

const ok: FatosAnuncio = {
  enderecoOk: true, detalhesOk: true, periodoOk: true, fotos: 10, titulo: "Apartamento claro", preco: 2500, garantiaOk: true,
  sublocacaoOk: true, privacidadeOk: true, documento: "approved", descricao: "x".repeat(200), selo: false, video: false,
};

test("prontidão: devolução da caução em atraso trava a publicação de anúncio novo; sem pendência não muda nada", () => {
  const trava = prontidaoAnuncio({ ...ok, caucaoDevolucaoPendente: true });
  assert.equal(trava.podePublicar, false);
  assert.ok(trava.obrigatorios.some((i) => i.key === "caucao_pendente" && !i.ok));
  assert.equal(prontidaoAnuncio({ ...ok, caucaoDevolucaoPendente: false }).podePublicar, true);
  assert.equal(prontidaoAnuncio(ok).podePublicar, true);
});

test("a chave CAUCAO_PRAZOS_ATIVA existe, está registrada e é DESLIGADA por padrão (parecer da Dra. Beatriz)", () => {
  assert.ok(CHAVES_AMBIENTE.some((c) => c.nome === "CAUCAO_PRAZOS_ATIVA" && c.variavel === "NEXT_PUBLIC_CAUCAO_PRAZOS_ATIVA"));
  const f = ler("src/lib/flags.ts");
  assert.match(f, /export const CAUCAO_PRAZOS_ATIVA = process\.env\.NEXT_PUBLIC_CAUCAO_PRAZOS_ATIVA === "on";/);
  assert.match(f, /Beatriz/);
});

test("o cron é diário, exige o CRON_SECRET e não faz nada com a chave desligada", () => {
  assert.ok(ler("vercel.json").includes('"/api/cron/caucao-prazos"'));
  const r = ler("src/app/api/cron/caucao-prazos/route.ts");
  assert.match(r, /Bearer \$\{segredo\}/);
  assert.match(r, /if \(!CAUCAO_PRAZOS_ATIVA\)/);
  const s = ler("src/lib/caucao/prazos-servidor.ts");
  assert.match(s, /if \(!CAUCAO_PRAZOS_ATIVA\) return/);
  assert.match(s, /estadoDosPrazos\(/);
  assert.match(s, /event: "contract_status"/);
  assert.match(s, /avisou_liberacao_em/);
  assert.match(s, /pendencia_em/);
});

test("migração 0310: tabelas novas com RLS (as partes leem, só o servidor escreve) e prova obrigatória no banco", () => {
  const m = ler("supabase/migrations/0310_caucao_prazos_e637.sql");
  assert.match(m, /create table if not exists public\.caucao_prazos/);
  assert.match(m, /create table if not exists public\.caucao_desconto_itens/);
  assert.equal((m.match(/enable row level security/g) ?? []).length, 2);
  assert.match(m, /revoke all on public\.caucao_prazos from anon, authenticated/);
  assert.match(m, /revoke all on public\.caucao_desconto_itens from anon, authenticated/);
  assert.match(m, /categoria in \('dano', 'sujeira_excessiva', 'item_faltando'\)/);
  assert.doesNotMatch(m, /desgaste/, "desgaste natural nem existe como categoria de desconto");
  assert.match(m, /foto_entrada_path is not null/);
  assert.match(m, /foto_saida_path is not null/);
  assert.match(m, /comprovante_path is not null/);
  assert.match(m, /valor > 0/);
  assert.ok(existsSync(new URL("../../../supabase/producao/aplicar-0310.sql", import.meta.url)));
  assert.ok(existsSync(new URL("../../../supabase/producao/rollback/0310_rollback.sql", import.meta.url)));
  const ap = ler("supabase/producao/aplicar-0310.sql");
  assert.match(ap, /begin;/);
  assert.match(ap, /20261105000310/);
  assert.match(ap, /0310_caucao_prazos_e637/);
});

test("retenção: as duas tabelas estão no inventário", () => {
  const r = ler("src/config/retencao.ts");
  assert.match(r, /i\("caucao_prazos", "public\.caucao_prazos"/);
  assert.match(r, /i\("caucao_desconto_itens", "public\.caucao_desconto_itens"/);
});
