import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AVISO_VISITA_CONFIRMADA } from "../visitas-video.ts";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("E329 — confirmar tem aviso de sucesso ao dono, e o e-mail ao morador sai de fato", () => {
  assert.equal(AVISO_VISITA_CONFIRMADA, "Visita confirmada — o morador foi avisado por e-mail");
  const cartao = ler("../../components/visitas/cartao-visita.tsx");
  assert.match(cartao, /if \(respondido && feita === "confirmar"\) \{[\s\S]{0,120}role="status" data-testid="visita-confirmada-aviso"/);
  assert.match(cartao, /setFeita\(acao\.acao\);/);
  // O aviso só promete o e-mail porque a confirmação dispara "visita_confirmada" à outra parte.
  const acoes = ler("../data/visitas-video-actions.ts");
  assert.match(acoes, /campos\.status === "confirmado" && campos\.horario_confirmado\) \{[\s\S]{0,1400}"visita_confirmada"/);
});

test("E329 — com visita confirmada e por vir, o anúncio mostra 'Visita agendada' levando a Visitas", () => {
  const acoes = ler("../data/visitas-video-actions.ts");
  const f = acoes.slice(acoes.indexOf("export async function minhasVisitasAgendadas"));
  assert.match(f, /\.eq\("tenant_id", user\.id\)/);
  assert.match(f, /\.eq\("status", "confirmado"\)/);
  assert.match(f, /\.gt\("horario_confirmado", new Date\(\)\.toISOString\(\)\)/);
  const botao = ler("../../components/property/visita-video.tsx");
  assert.match(botao, /if \(agendada && !exemplo\) \{[\s\S]{0,80}<ButtonLink\s+href="\/dashboard\/visitas"/);
  assert.match(botao, /data-testid=\{`\$\{t\.prefixo\}-agendada`\}[\s\S]{0,80}Visita agendada/);
  const detalhe = ler("../../app/(public)/imoveis/[id]/property-detail.tsx");
  assert.match(detalhe, /agendada=\{agendadas\.includes\("video"\)\}/);
  assert.match(detalhe, /agendada=\{agendadas\.includes\("presencial"\)\}/);
  assert.match(detalhe, /agendadas\.includes\("presencial"\) \? router\.push\("\/dashboard\/visitas"\)/);
});
