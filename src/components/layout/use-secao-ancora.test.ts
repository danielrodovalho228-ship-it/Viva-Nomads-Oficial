import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { secaoVisivel } from "./use-secao-ancora.ts";
import { ABAS_PARCEIRO, abaAtivaPainel, ancorasDasAbas } from "../../config/abas-painel.ts";

const ids = ["pedidos", "agenda", "ganhos"];
/** Documento falso: cada seção com o topo (px) na tela. */
const doc = (tops: Record<string, number>) => ({ getElementById: (id: string) => (id in tops ? ({ id, getBoundingClientRect: () => ({ top: tops[id], bottom: tops[id] + 200 }) } as unknown as HTMLElement) : null) });
const janela = (scrollY: number, docAltura = 3000) => ({ innerHeight: 800, scrollY, docAltura });

test("E340 — a seção acesa acompanha a rolagem (a 1ª que ocupa a faixa de cima da tela)", () => {
  // Seções curtas (t776 no lab): Pedidos rolado ao topo acende Pedidos, não a vizinha de baixo.
  assert.equal(secaoVisivel(ids, "", doc({ pedidos: 96, agenda: 262, ganhos: 430 }), janela(500)), "pedidos");
  assert.equal(secaoVisivel(ids, "", doc({ pedidos: 100, agenda: 900, ganhos: 1600 }), janela(0)), "pedidos");
  assert.equal(secaoVisivel(ids, "", doc({ pedidos: -700, agenda: 96, ganhos: 800 }), janela(800)), "agenda");
  assert.equal(secaoVisivel(ids, "", doc({ pedidos: -1400, agenda: -600, ganhos: 96 }), janela(1500)), "ganhos");
  // Fim da página: a última seção à vista, mesmo sem chegar à linha.
  assert.equal(secaoVisivel(ids, "", doc({ pedidos: -1500, agenda: -50, ganhos: 600 }), janela(2200)), "ganhos");
  // Fim da página sem ter passado da seção (ela começa na tela): fica a seção para onde a pessoa rolou.
  assert.equal(secaoVisivel(ids, "", doc({ pedidos: -1500, agenda: 300, ganhos: 520 }), janela(2200)), "agenda");
});

test("E340 — carregando (sem seções) e página que não rola: vale o #âncora; sem ele, a 1ª", () => {
  assert.equal(secaoVisivel(ids, "#ganhos", doc({}), janela(0)), "ganhos");
  assert.equal(secaoVisivel(ids, "", doc({}), janela(0)), "pedidos");
  assert.equal(secaoVisivel(ids, "#agenda", doc({ pedidos: 100, agenda: 300, ganhos: 500 }), janela(0, 700)), "agenda");
  assert.equal(secaoVisivel(ids, "", doc({ pedidos: 100, agenda: 300, ganhos: 500 }), janela(0, 700)), "pedidos");
});

test("E340 — uma aba acesa por vez: a da seção; sem seção medida, Pedidos", () => {
  const a = ancorasDasAbas(ABAS_PARCEIRO);
  assert.deepEqual(a, { rota: "/dashboard/parceiro", ids });
  assert.equal(abaAtivaPainel(ABAS_PARCEIRO, "/dashboard/parceiro", "agenda")?.id, "agenda");
  assert.equal(abaAtivaPainel(ABAS_PARCEIRO, "/dashboard/parceiro", "ganhos")?.id, "ganhos");
  assert.equal(abaAtivaPainel(ABAS_PARCEIRO, "/dashboard/parceiro", null)?.id, "pedidos");
  assert.equal(abaAtivaPainel(ABAS_PARCEIRO, "/dashboard/servicos/pedidos/x", "ganhos")?.id, "pedidos");
});

test("E340 — o topo do computador e a barra do celular usam a seção visível", () => {
  const topo = readFileSync(new URL("./topo-dono.tsx", import.meta.url), "utf8");
  assert.match(topo, /const ativa = abaAtivaPainel\(p\.abas, p\.pathname, secao\);/);
  const barra = readFileSync(new URL("./mobile-tab-bar.tsx", import.meta.url), "utf8");
  assert.match(barra, /if \(ancora\) return pathname === rota && ancora === \(secao \?\? "pedidos"\);/);
  assert.match(barra, /const secao = useSecaoAncora\(/);
});

test("E340 (t776) — a seção pedida (#âncora ou aba clicada) vale enquanto estiver à vista, mesmo curta no fim da página", () => {
  // Ganhos curto, abaixo da linha de 35%: sem preferência acenderia Agenda; pedida, acende Ganhos.
  const tops = { pedidos: -900, agenda: 100, ganhos: 520 };
  assert.equal(secaoVisivel(ids, "#ganhos", doc(tops), janela(900)), "agenda");
  assert.equal(secaoVisivel(ids, "#ganhos", doc(tops), janela(900), "ganhos"), "ganhos");
  // Fora da tela, a preferência não vale: manda a seção visível.
  assert.equal(secaoVisivel(ids, "", doc({ pedidos: 50, agenda: 900, ganhos: 1700 }), janela(0), "ganhos"), "pedidos");
});

test("E340 (t776) — o hook refaz a rolagem até o #âncora quando a seção aparece e solta a preferência quando a pessoa rola", () => {
  const h = readFileSync(new URL("./use-secao-ancora.ts", import.meta.url), "utf8");
  assert.match(h, /if \(!rolouAteAncora && preferida\) \{[\s\S]{0,160}el\.scrollIntoView\(\{ block: "start" \}\);/);
  assert.match(h, /for \(const ev of \["wheel", "touchmove", "keydown"\] as const\) window\.addEventListener\(ev, soltar/);
  assert.match(h, /document\.addEventListener\("click", aoClicar, true\);/);
});
