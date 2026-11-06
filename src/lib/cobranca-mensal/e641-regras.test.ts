/*
  E641 — cobrança MENSAL para contratos longos (91 a 180 dias), só a parte NEUTRA, atrás da chave COBRANCA_MENSAL_ATIVA
  (desligada até o parecer da Dra. Beatriz). Vale: cronograma com vencimento no aniversário do check-in, 1º mês adiantado,
  pró-rata só do período final (divisor 30), taxa da Viva por mês sobre o ALUGUEL (nunca sobre multa/juros), livro de pagamentos
  com 3 estados ("não registrado" NUNCA é "não pago"), lembretes neutros D-5/D-3 e duração acumulada com teto de 180 dias.
  NÃO existe aqui: status de atraso, multa/juros, mensagem depois do vencimento, notificação formal ou consequência ao morador.
  Roda: node --test src/lib/cobranca-mensal/e641-regras.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DIVISOR_PRORATA,
  ESTADOS_DO_LIVRO,
  TETO_DIAS_ACUMULADOS,
  cronogramaMensal,
  duracaoAcumulada,
  estadoDoLivro,
  lembreteDaParcela,
  podeConfirmar,
  podeRegistrar,
  rotuloDoLivro,
  taxaDaParcela,
  textoDoLembrete,
} from "./regras.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("120 dias: 4 mensalidades, vencendo no aniversário do check-in; a 1ª é adiantada (vence no check-in)", () => {
  const c = cronogramaMensal({ checkin: "2027-01-10", checkout: "2027-05-10", aluguelMensal: 3000, taxa: 0.1 });
  assert.equal(c.ok, true);
  if (!c.ok) return;
  assert.deepEqual(c.parcelas.map((p) => p.venceEm), ["2027-01-10", "2027-02-10", "2027-03-10", "2027-04-10"]);
  assert.ok(c.parcelas.every((p) => p.valor === 3000 && p.tipo === "mensal"));
  assert.equal(c.parcelas[0].adiantada, true);
  assert.equal(c.parcelas[1].adiantada, false);
  assert.equal(c.dias, 120);
});

test("pró-rata SÓ no período final, com divisor 30: 135 dias = 4 mensalidades + 15/30 do aluguel", () => {
  const c = cronogramaMensal({ checkin: "2027-01-10", checkout: "2027-05-25", aluguelMensal: 3000, taxa: 0.1 });
  assert.equal(c.ok, true);
  if (!c.ok) return;
  assert.equal(c.parcelas.length, 5);
  const ultima = c.parcelas[4];
  assert.equal(ultima.tipo, "prorata_final");
  assert.equal(ultima.dias, 15);
  assert.equal(ultima.valor, 1500);
  assert.equal(ultima.venceEm, "2027-05-10");
  assert.ok(c.parcelas.slice(0, 4).every((p) => p.tipo === "mensal" && p.valor === 3000));
  assert.equal(DIVISOR_PRORATA, 30);
});

test("aniversário em dia que o mês não tem: vence no último dia do mês, sem pular nem repetir mês", () => {
  const c = cronogramaMensal({ checkin: "2027-01-31", checkout: "2027-05-31", aluguelMensal: 1000, taxa: 0.1 });
  assert.equal(c.ok, true);
  if (!c.ok) return;
  assert.deepEqual(c.parcelas.map((p) => p.venceEm), ["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
});

test("a taxa da Viva é por mês, no vencimento, sobre o ALUGUEL da parcela (nunca sobre multa/juros)", () => {
  assert.equal(taxaDaParcela(3000, 0.1), 300);
  assert.equal(taxaDaParcela(1500, 0.12), 180);
  assert.equal(taxaDaParcela(333.33, 0.1), 33.33);
  const c = cronogramaMensal({ checkin: "2027-01-10", checkout: "2027-05-25", aluguelMensal: 3000, taxa: 0.1 });
  if (!c.ok) return assert.fail("cronograma");
  assert.deepEqual(c.parcelas.map((p) => p.taxaViva), [300, 300, 300, 300, 150]);
  // a função só recebe o aluguel: não existe parâmetro de multa ou juros
  assert.equal(taxaDaParcela.length, 2);
});

test("só 91 a 180 dias entram; mais de 180 é recusado", () => {
  const curto = cronogramaMensal({ checkin: "2027-01-10", checkout: "2027-03-10", aluguelMensal: 3000, taxa: 0.1 });
  assert.equal(curto.ok, false);
  const longo = cronogramaMensal({ checkin: "2027-01-10", checkout: "2027-07-20", aluguelMensal: 3000, taxa: 0.1 });
  assert.equal(longo.ok, false);
  if (!longo.ok) assert.match(longo.motivo, /180/);
  const limite = cronogramaMensal({ checkin: "2027-01-10", checkout: "2027-07-09", aluguelMensal: 3000, taxa: 0.1 });
  assert.equal(limite.ok, true);
  assert.equal(TETO_DIAS_ACUMULADOS, 180);
});

test("duração acumulada: renovações somam e o teto é 180 dias no total", () => {
  assert.deepEqual(duracaoAcumulada({ diasJaContratados: 120, diasNovos: 60 }), { ok: true, total: 180 });
  const passou = duracaoAcumulada({ diasJaContratados: 150, diasNovos: 60 });
  assert.equal(passou.ok, false);
  if (!passou.ok) {
    assert.equal(passou.restam, 30);
    assert.match(passou.motivo, /180/);
  }
});

test("livro: 3 estados e, sem registro, 'não registrado' — nunca 'não pago'", () => {
  assert.deepEqual([...ESTADOS_DO_LIVRO], ["registrado_morador", "aguardando_confirmacao", "confirmado_dono"]);
  assert.equal(estadoDoLivro(null), "nao_registrado");
  assert.equal(estadoDoLivro("confirmado_dono"), "confirmado_dono");
  assert.equal(rotuloDoLivro("nao_registrado").rotulo, "Não registrado");
  const todos = [null, ...ESTADOS_DO_LIVRO].map((e) => rotuloDoLivro(estadoDoLivro(e)));
  for (const r of todos) assert.doesNotMatch(`${r.rotulo} ${r.detalhe}`, /atras|inadimpl|n[ãa]o pago|vencid|devedor|multa|juros/i);
  assert.match(rotuloDoLivro("nao_registrado").detalhe, /não quer dizer que não foi pago/i);
});

test("quem faz o quê: o morador registra, o dono confirma; ninguém pula etapa nem desfaz a confirmação", () => {
  assert.equal(podeRegistrar(null).ok, true);
  assert.equal(podeRegistrar("registrado_morador").ok, false);
  assert.equal(podeRegistrar("confirmado_dono").ok, false);
  assert.equal(podeConfirmar("registrado_morador").ok, true);
  assert.equal(podeConfirmar("aguardando_confirmacao").ok, true);
  assert.equal(podeConfirmar(null).ok, false); // sem o morador registrar, o dono não "confirma" nada
  assert.equal(podeConfirmar("confirmado_dono").ok, false);
});

test("lembretes neutros: só D-5 e D-3 antes do vencimento, e só se ainda não houve registro; nunca depois", () => {
  assert.equal(lembreteDaParcela({ venceEm: "2027-02-10", hoje: "2027-02-05", estado: null }), "D-5");
  assert.equal(lembreteDaParcela({ venceEm: "2027-02-10", hoje: "2027-02-07", estado: null }), "D-3");
  assert.equal(lembreteDaParcela({ venceEm: "2027-02-10", hoje: "2027-02-06", estado: null }), null);
  assert.equal(lembreteDaParcela({ venceEm: "2027-02-10", hoje: "2027-02-10", estado: null }), null);
  assert.equal(lembreteDaParcela({ venceEm: "2027-02-10", hoje: "2027-02-11", estado: null }), null);
  assert.equal(lembreteDaParcela({ venceEm: "2027-02-10", hoje: "2027-02-12", estado: null }), null);
  assert.equal(lembreteDaParcela({ venceEm: "2027-02-10", hoje: "2027-02-05", estado: "registrado_morador" }), null);
  for (const l of ["D-5", "D-3"] as const) {
    const t = textoDoLembrete(l, { valor: 3000, venceEm: "2027-02-10" });
    assert.match(t, /10\/02\/2027/);
    assert.doesNotMatch(t, /atras|inadimpl|multa|juros|cobran[çc]a formal|consequ[êe]ncia|bloque/i);
  }
});

test("a parte neutra não tem atraso, multa, juros, D+ nem consequência: nada disso existe no código", () => {
  for (const f of ["src/lib/cobranca-mensal/regras.ts", "src/lib/cobranca-mensal/servidor.ts", "src/lib/cobranca-mensal/acoes.ts"]) {
    const src = ler(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(src, /atrasad|inadimpl|multa|juros|D\+|em_atraso/i, f);
  }
});

test("tudo atrás da chave COBRANCA_MENSAL_ATIVA (desligada): servidor, ações e cron", () => {
  const flags = ler("src/lib/flags.ts");
  assert.match(flags, /export const COBRANCA_MENSAL_ATIVA = process\.env\.NEXT_PUBLIC_COBRANCA_MENSAL_ATIVA === "on";/);
  assert.match(ler("src/config/chaves-ambiente.ts"), /COBRANCA_MENSAL_ATIVA/);
  assert.match(ler("src/lib/cobranca-mensal/servidor.ts"), /if \(!COBRANCA_MENSAL_ATIVA\)/);
  const a = ler("src/lib/cobranca-mensal/acoes.ts");
  assert.match(a, /"use server"/);
  assert.equal((a.match(/if \(!COBRANCA_MENSAL_ATIVA\)/g) ?? []).length, 2);
  assert.match(a, /tenant_id !== user\.id/);
  assert.match(a, /owner_id !== user\.id/);
  assert.match(ler("src/app/api/cron/cobranca-mensal/route.ts"), /if \(!COBRANCA_MENSAL_ATIVA\)/);
  assert.match(ler("vercel.json"), /\/api\/cron\/cobranca-mensal/);
});
