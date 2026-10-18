import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ROTULO_FUSO,
  STATUS_VISITA_ROTULO,
  campoBrasiliaParaIso,
  formatarHorarioBrasilia,
  instanteParaCampoBrasilia,
  mudancaDeStatus,
  podeTransicionar,
} from "./visitas-video.ts";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

// ── Item 1: horário de Brasília ────────────────────────────────────────────────────────────────────────────────
test("p23 — 15:00 escolhido no campo é 15:00 de Brasília (18:00 UTC), qualquer que seja o fuso do navegador", () => {
  assert.equal(campoBrasiliaParaIso("2026-10-21T15:00"), "2026-10-21T18:00:00.000Z");
  // O fuso do processo não entra na conta (Chicago e São Paulo dão o mesmo instante).
  const antes = process.env.TZ;
  try {
    for (const tz of ["America/Chicago", "America/Sao_Paulo", "Asia/Tokyo"]) {
      process.env.TZ = tz;
      assert.equal(campoBrasiliaParaIso("2026-10-21T15:00"), "2026-10-21T18:00:00.000Z", tz);
      assert.equal(instanteParaCampoBrasilia(new Date("2026-10-21T18:00:00Z")), "2026-10-21T15:00", tz);
    }
  } finally {
    process.env.TZ = antes;
  }
  assert.equal(campoBrasiliaParaIso("2026-02-30T10:00"), null);
  assert.equal(campoBrasiliaParaIso("lixo"), null);
});

test("p23 — o horário mostrado sempre diz 'horário de Brasília'", () => {
  assert.equal(ROTULO_FUSO, "horário de Brasília");
  const t = formatarHorarioBrasilia("2026-10-21T18:00:00Z");
  assert.match(t, /15:00/);
  assert.match(t, /\(horário de Brasília\)$/);
});

// ── Item 2: presencial no mesmo fluxo (Pedida → Confirmada / Remarcar / Cancelada) ─────────────────────────────
const agora = new Date("2026-10-18T12:00:00Z");
const amanha = "2026-10-19T17:00:00.000Z";

test("p23 — status e transições: dono confirma, propõe outro ou recusa; morador aceita o novo horário ou cancela", () => {
  assert.deepEqual(STATUS_VISITA_ROTULO.remarcar, "Remarcar");
  assert.equal(podeTransicionar("pedido", "confirmado", "dono"), true);
  assert.equal(podeTransicionar("pedido", "remarcar", "dono"), true);
  assert.equal(podeTransicionar("pedido", "cancelado", "dono"), true);
  assert.equal(podeTransicionar("pedido", "confirmado", "morador"), false);
  assert.equal(podeTransicionar("remarcar", "confirmado", "morador"), true);
  assert.equal(podeTransicionar("remarcar", "confirmado", "dono"), false);
  assert.equal(podeTransicionar("cancelado", "confirmado", "dono"), false);
});

test("p23 — presencial confirma sem link; vídeo exige o link da chamada", () => {
  const pres = mudancaDeStatus("pedido", "dono", { acao: "confirmar", horario: amanha }, agora, { modalidade: "presencial" });
  assert.ok(pres.ok);
  if (pres.ok) {
    assert.equal(pres.campos.status, "confirmado");
    assert.equal(pres.campos.horario_confirmado, amanha);
    assert.equal("link_chamada" in pres.campos, false);
  }
  const video = mudancaDeStatus("pedido", "dono", { acao: "confirmar", horario: amanha }, agora, { modalidade: "video" });
  assert.equal(video.ok, false);
});

test("p23 — propor outro horário vira Remarcar; o morador aceita e vira Confirmada com o horário proposto", () => {
  const r = mudancaDeStatus("pedido", "dono", { acao: "remarcar", horario: amanha }, agora, { modalidade: "presencial" });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual([r.campos.status, r.campos.horario_proposto], ["remarcar", amanha]);
  const a = mudancaDeStatus("remarcar", "morador", { acao: "aceitar_remarcacao" }, agora, { modalidade: "presencial", horarioProposto: amanha });
  assert.ok(a.ok);
  if (a.ok) assert.deepEqual([a.campos.status, a.campos.horario_confirmado, a.campos.horario_proposto], ["confirmado", amanha, null]);
});

test("p23 — recusar exige motivo (3 a 200 caracteres); o morador cancela sem explicar", () => {
  assert.equal(mudancaDeStatus("pedido", "dono", { acao: "cancelar" }, agora, { modalidade: "presencial" }).ok, false);
  const ok = mudancaDeStatus("pedido", "dono", { acao: "cancelar", motivo: "Imóvel já alugado nessas datas" }, agora, { modalidade: "presencial" });
  assert.ok(ok.ok);
  if (ok.ok) assert.equal(ok.campos.motivo_recusa, "Imóvel já alugado nessas datas");
  assert.ok(mudancaDeStatus("pedido", "morador", { acao: "cancelar" }, agora, { modalidade: "presencial" }).ok);
});

test("p23 — endereço exato só para o morador e só com a presencial CONFIRMADA; sem WhatsApp no pedido", () => {
  const acoes = ler("./data/visitas-video-actions.ts");
  // Complemento do 23: a regra mora em mostraEnderecoDaVisita (presencial, confirmada e ainda não passada).
  assert.match(acoes, /papel === "morador" && mostraEnderecoDaVisita\(v, new Date\(\)\)/);
  const cartao = ler("../components/visitas/cartao-visita.tsx");
  assert.match(cartao, /data-testid="visita-endereco-oculto"/);
  const pedido = ler("../components/property/visita-video.tsx");
  assert.match(pedido, /Pedido de visita enviado\. O proprietário confirma aqui na plataforma e você recebe um aviso\./);
  const detalhe = ler("../app/(public)/imoveis/[id]/property-detail.tsx");
  assert.doesNotMatch(detalhe, /e-mail\/WhatsApp\./);
  assert.match(detalhe, /<VisitaPresencial/);
});

// ── Item 6: e-mails da jornada (nunca "recusada") ──────────────────────────────────────────────────────────────
test("p23 — e-mails: visita pedida/confirmada/remarcada/cancelada, candidatura recebida e aceita; recusa sem e-mail", () => {
  const ev = ler("./notifications/eventos-email.ts");
  for (const e of ["visita_pedida", "visita_confirmada", "visita_remarcada", "visita_cancelada", "candidatura_nova", "candidatura_aceita", "proposta_recebida"]) {
    assert.match(ev, new RegExp(`\\b${e}: \\{`), e);
  }
  assert.doesNotMatch(ev, /candidatura_recusada/);
  const acoes = ler("./data/actions.ts");
  assert.match(acoes, /event: kind === "candidatura" \? "candidatura_nova" : "new_lead"/);
  const leads = ler("./data/leads-actions.ts");
  const recusar = leads.slice(leads.indexOf("export async function recusarCandidatura"), leads.indexOf("export async function recusarCandidatura") + 2500);
  assert.doesNotMatch(recusar.slice(0, recusar.indexOf("\n}\n")), /notify\(|sendEmail\(/);
  const visitas = ler("./data/visitas-video-actions.ts");
  for (const e of ["visita_pedida", "visita_confirmada", "visita_remarcada", "visita_cancelada"]) assert.match(visitas, new RegExp(`"${e}"`), e);
});
