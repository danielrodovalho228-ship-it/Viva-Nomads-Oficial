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

test("E329 + varredura 01/11 — o anúncio reflete a visita em aberto (agendada, pedida ou já passada) e leva a Visitas", () => {
  const acoes = ler("../data/visitas-video-actions.ts");
  const f = acoes.slice(acoes.indexOf("export async function minhasVisitasNoImovel"));
  assert.match(f, /\.eq\("tenant_id", user\.id\)/);
  // O mesmo recorte do índice único do banco (um em aberto por morador, imóvel e modalidade).
  assert.match(f, /\.in\("status", \["pedido", "confirmado", "remarcar"\]\)/);
  const botao = ler("../../components/property/visita-video.tsx");
  assert.match(botao, /if \(estado && !exemplo\) \{[\s\S]{0,240}<ButtonLink\s+href="\/dashboard\/visitas"/);
  assert.match(botao, /data-testid=\{`\$\{t\.prefixo\}-\$\{estado\}`\}/);
  assert.match(botao, /estado === "agendada" \? "Visita agendada" : estado === "pedida" \? t\.feito : "Ver minha visita"/);
  const detalhe = ler("../../app/(public)/imoveis/[id]/property-detail.tsx");
  assert.match(detalhe, /estado=\{visitas\.video\}/);
  assert.match(detalhe, /estado=\{visitas\.presencial\}/);
  assert.match(detalhe, /visitas\.presencial \? router\.push\("\/dashboard\/visitas"\)/);
});
