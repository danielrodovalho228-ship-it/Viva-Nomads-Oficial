import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AJUDA_LINK_CHAMADA, MSG_LINK_OBRIGATORIO, mudancaDeStatus } from "../visitas-video.ts";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("E327 — a orientação do link é a frase aprovada", () => {
  assert.equal(AJUDA_LINK_CHAMADA, "Use um link novo para cada visita; ele fica visível só para você e o morador e some depois do uso.");
  assert.match(MSG_LINK_OBRIGATORIO, /link da chamada/);
});

test("E327 — o campo 'Link da chamada' marca obrigatório, traz a orientação e pede o link antes de confirmar", () => {
  const cartao = ler("../../components/visitas/cartao-visita.tsx");
  assert.match(cartao, /data-testid="visita-link-obrigatorio"[\s\S]{0,40}\(obrigatório\)/);
  assert.match(cartao, /\{AJUDA_LINK_CHAMADA\}/);
  assert.match(cartao, /required\s+aria-required="true"/);
  assert.match(cartao, /if \(!video \|\| link\.trim\(\)\) return true;\s+setErroLink\(MSG_LINK_OBRIGATORIO\);/);
  assert.match(cartao, /data-testid="visita-confirmar" onClick=\{\(\) => linkOk\(\) && rodar\(/);
  assert.match(cartao, /outroIso && linkOk\(\) && rodar\(\{ acao: "remarcar"/);
});

test("E327 — o servidor também recusa confirmar visita por vídeo sem link", () => {
  const agora = new Date("2026-11-01T12:00:00Z");
  const horario = "2026-11-03T17:00:00.000Z";
  for (const link of [undefined, "", "   "]) {
    const r = mudancaDeStatus("pedido", "dono", { acao: "confirmar", horario, link }, agora, { modalidade: "video" });
    assert.equal(r.ok, false, JSON.stringify(link));
  }
  const ok = mudancaDeStatus("pedido", "dono", { acao: "confirmar", horario, link: "https://meet.google.com/abc-defg-hij" }, agora, { modalidade: "video" });
  assert.ok(ok.ok);
});
