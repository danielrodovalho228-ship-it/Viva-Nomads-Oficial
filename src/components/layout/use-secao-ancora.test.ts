import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { abrirPedido, fecharPedido, secaoVisivel } from "./use-secao-ancora.ts";
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

test("E340 — uma aba acesa por vez: a da seção; sem seção medida, a 1ª (E459: Início, o topo do painel)", () => {
  const a = ancorasDasAbas(ABAS_PARCEIRO);
  assert.deepEqual(a, { rota: "/dashboard/parceiro", ids: ["inicio", ...ids] });
  assert.equal(abaAtivaPainel(ABAS_PARCEIRO, "/dashboard/parceiro", "agenda")?.id, "agenda");
  assert.equal(abaAtivaPainel(ABAS_PARCEIRO, "/dashboard/parceiro", "ganhos")?.id, "ganhos");
  assert.equal(abaAtivaPainel(ABAS_PARCEIRO, "/dashboard/parceiro", null)?.id, "inicio");
  assert.equal(abaAtivaPainel(ABAS_PARCEIRO, "/dashboard/parceiro", "pedidos")?.id, "pedidos");
  assert.equal(abaAtivaPainel(ABAS_PARCEIRO, "/dashboard/servicos/pedidos/x", "ganhos")?.id, "pedidos");
});

test("E340 — o topo do computador e a barra do celular usam a seção visível", () => {
  const topo = readFileSync(new URL("./topo-dono.tsx", import.meta.url), "utf8");
  assert.match(topo, /const ativa = abaAtivaPainel\(p\.abas, p\.pathname, secao\);/);
  const barra = readFileSync(new URL("./mobile-tab-bar.tsx", import.meta.url), "utf8");
  // E460: a barra usa a mesma regra do topo (ancoraAtiva), sem "pedidos" fixo.
  assert.match(barra, /if \(ancora\) return ancoraAtiva\(tabs, pathname, secao\) === ancora;/);
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
  // E1018: a mesma regra, com o pedido guardado por rota (pedido.rolouAteAncora, pedido.preferida) e não por instância.
  assert.match(h, /if \(!pedido\.rolouAteAncora && pedido\.preferida\) \{[\s\S]{0,200}el\.scrollIntoView\(\{ block: "start" \}\);/);
  assert.match(h, /for \(const ev of \["wheel", "touchmove", "keydown"\] as const\) window\.addEventListener\(ev, soltar/);
  assert.match(h, /document\.addEventListener\("click", aoClicar, true\);/);
  // Clique no mesmo #âncora que já está na URL: o hook leva a seção à vista (o navegador não rola).
  assert.match(h, /pediu\(id\);\s+\/\/[^\n]*\n\s+requestAnimationFrame\(\(\) => document\.getElementById\(id\)\?\.scrollIntoView\(\{ block: "start" \}\)\);/);
});

// ---------------------------------------------------------------------------------------------------------------------
// E1018 (t776 a 390 px, instável na suíte completa): o hook tem DUAS instâncias na mesma página — a barra de baixo do
// celular e o topo do computador (escondido no celular, mas montado). A do topo monta mais tarde, quando as abas do
// parceiro ficam conhecidas. Cada instância guardava o seu próprio "pedido" (a seção do #âncora da URL): a que montava
// depois lia o #ganhos da URL de novo e ROLAVA A PÁGINA de volta para Ganhos, mesmo com a pessoa já em Agenda.
// Medido no laboratório com o processador 4x mais lento: a 2ª instalação dos ouvintes vem depois da rolagem da pessoa,
// e a aba acesa volta para Ganhos em todas as repetições.
// Regra: o pedido é UM por rota, dividido pelas instâncias. O que a pessoa já largou (rolou por conta própria) não volta.
// ---------------------------------------------------------------------------------------------------------------------
const ROTA = "/dashboard/parceiro";

test("E1018 — a instância que monta depois recebe o MESMO pedido: o #âncora que a pessoa já largou não volta", () => {
  const barra = abrirPedido(ROTA, "ganhos");
  assert.equal(barra.preferida, "ganhos");
  assert.equal(barra.rolouAteAncora, false);
  // A barra rola até o #âncora uma vez; depois a pessoa rola por conta própria (wheel): a seção visível passa a mandar.
  barra.rolouAteAncora = true;
  barra.preferida = null;
  // O topo monta agora, com o mesmo #ganhos ainda na URL.
  const topo = abrirPedido(ROTA, "ganhos");
  assert.equal(topo, barra, "o mesmo objeto: um pedido por rota");
  assert.equal(topo.preferida, null, "não ressuscita o #âncora da URL");
  assert.equal(topo.rolouAteAncora, true, "não rola a página até o #âncora de novo");
  fecharPedido(ROTA);
  fecharPedido(ROTA);
});

test("E1018 — sem a pessoa ter rolado, a 2ª instância vê o pedido da URL e não repete a rolagem até ele", () => {
  const barra = abrirPedido(ROTA, "ganhos");
  barra.rolouAteAncora = true;
  const topo = abrirPedido(ROTA, "ganhos");
  assert.equal(topo.preferida, "ganhos");
  assert.equal(topo.rolouAteAncora, true);
  fecharPedido(ROTA);
  fecharPedido(ROTA);
});

test("E1018 — o pedido acaba quando a última instância sai da rota: voltar à página lê a URL de novo", () => {
  const a = abrirPedido(ROTA, "ganhos");
  a.preferida = null;
  const b = abrirPedido(ROTA, "ganhos");
  fecharPedido(ROTA);
  assert.equal(abrirPedido(ROTA, "agenda"), a, "ainda há uma instância montada: o pedido continua");
  fecharPedido(ROTA);
  fecharPedido(ROTA);
  assert.ok(b);
  const novo = abrirPedido(ROTA, "agenda");
  assert.notEqual(novo, a);
  assert.equal(novo.preferida, "agenda");
  assert.equal(novo.rolouAteAncora, false);
  fecharPedido(ROTA);
  // Rotas diferentes não dividem pedido.
  const x = abrirPedido("/a", "um");
  const y = abrirPedido("/b", "dois");
  assert.notEqual(x, y);
  fecharPedido("/a");
  fecharPedido("/b");
});

test("E1018 — o hook usa o pedido da rota (não guarda um por instância) e o devolve ao desmontar", () => {
  const fonte = readFileSync(new URL("./use-secao-ancora.ts", import.meta.url), "utf8");
  const hook = fonte.slice(fonte.indexOf("export function useSecaoAncora("));
  assert.match(hook, /const pedido = abrirPedido\(rota, daUrl\(\)\);/);
  assert.match(hook, /fecharPedido\(rota\);/);
  assert.doesNotMatch(hook, /let preferida\b|let rolouAteAncora\b/, "sem estado por instância");
  // Só rola até o #âncora quem ainda tem pedido e ainda não rolou.
  assert.match(hook, /if \(!pedido\.rolouAteAncora && pedido\.preferida\) \{/);
});
