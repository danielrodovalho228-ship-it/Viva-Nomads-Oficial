import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { secaoVisivel } from "./use-secao-ancora.ts";
import { ABAS_PARCEIRO, abaAtivaPainel, ancorasDasAbas } from "../../config/abas-painel.ts";

const ids = ["pedidos", "agenda", "ganhos"];
/** Documento falso: cada seção com o topo (px) na tela. */
const doc = (tops: Record<string, number>) => ({ getElementById: (id: string) => (id in tops ? ({ id, getBoundingClientRect: () => ({ top: tops[id] }) } as unknown as HTMLElement) : null) });
const janela = (scrollY: number, docAltura = 3000) => ({ innerHeight: 800, scrollY, docAltura });

test("E340 — a seção acesa acompanha a rolagem (linha a 35% da tela)", () => {
  assert.equal(secaoVisivel(ids, "", doc({ pedidos: 100, agenda: 900, ganhos: 1600 }), janela(0)), "pedidos");
  assert.equal(secaoVisivel(ids, "", doc({ pedidos: -700, agenda: 96, ganhos: 800 }), janela(800)), "agenda");
  assert.equal(secaoVisivel(ids, "", doc({ pedidos: -1400, agenda: -600, ganhos: 96 }), janela(1500)), "ganhos");
  // Fim da página: a última seção à vista, mesmo sem chegar à linha.
  assert.equal(secaoVisivel(ids, "", doc({ pedidos: -1500, agenda: 0, ganhos: 600 }), janela(2200)), "ganhos");
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
