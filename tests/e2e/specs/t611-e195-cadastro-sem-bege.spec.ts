import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

// Portão/catraca dos merges da noite (#1483–#1489) (Pista C, 29/10): roda no lab-crítico deste PR (o completo não chega aqui).
/*
  T611 — E195 (auditoria do Muse, 28/10): o assistente de CADASTRO no MESMO padrão clean da Qualificação, etapa por
  etapa — fundo da página, moldura, cartões, rodapé e o botão travado. Varre as cores de fundo de tudo o que está à
  vista e não aceita nenhum tom quente claro (bege/creme/areia). Avisos de verdade (âmbar) ficam de fora pela marca
  data-aviso. A 1280 e 390 px.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t611.${sufixo}@lab.vivanomads.test`, nome: "Bia Semareia", role: "owner" as const };
const ids: Record<string, string> = {};
const ETAPAS = ["tipo", "fotos", "endereco", "detalhes", "comodidades", "regras", "descricao", "preco", "disponibilidade", "revisao"] as const;

/** Cor de fundo da página: o primeiro fundo pintado de <main> para cima (no celular, o carrossel de tipos vai de borda
    a borda, então um pixel da lateral pode cair num cartão). */
const fundoNaLateral = (p: Page) =>
  p.evaluate(() => {
    let el = document.querySelector("main") as HTMLElement | null;
    while (el && getComputedStyle(el).backgroundColor === "rgba(0, 0, 0, 0)") el = el.parentElement;
    return el ? getComputedStyle(el).backgroundColor : "";
  });

/** Fundos claros e quentes (r ≥ 225, r − b ≥ 10, r ≥ g): o bege/creme antigo. Devolve onde aparecem. */
const tonsQuentes = (p: Page) =>
  p.evaluate(() => {
    const achados: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (el.closest("[data-aviso], [role=alert], [role=status], img, picture, video, svg")) continue;
      const cs = getComputedStyle(el);
      for (const cor of [cs.backgroundColor, cs.borderTopColor]) {
        const m = cor.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/);
        if (!m) continue;
        const [R, G, B, A] = [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
        if (A < 0.05 || (cor === cs.borderTopColor && cs.borderTopWidth === "0px")) continue;
        if (R >= 225 && R - B >= 10 && R >= G && G - B >= 4) {
          const id = el.getAttribute("data-testid") ?? el.id ?? "";
          achados.push(`${el.tagName.toLowerCase()}${id ? `#${id}` : ""}.${String(el.className).slice(0, 60)} → ${cor}`);
        }
      }
    }
    return [...new Set(achados)].slice(0, 20);
  });

const estilo = (p: Page, testid: string) =>
  p.getByTestId(testid).evaluate((b) => {
    const cs = getComputedStyle(b);
    return { bg: cs.backgroundColor, cor: cs.color, op: cs.opacity, borda: cs.borderTopColor };
  });

test.describe("T611 — E195: cadastro sem bege/creme, no padrão clean da Qualificação", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    ids.rascunho = await criarImovelPronto(ids.dono, `Rascunho t611 ${sufixo}`);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — Qualificação e as 10 etapas: mesmo fundo, mesmo rodapé, nenhum tom quente`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });

      await p.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("qualificacao")).toBeVisible({ timeout: 30_000 });
      const ref = { fundo: await fundoNaLateral(p), rodape: await estilo(p, "assistente-rodape"), primario: await estilo(p, "qualificacao-continuar") };
      console.log(`t611 ${largura} qualificacao`, JSON.stringify(ref), JSON.stringify(await tonsQuentes(p)));
      expect(await tonsQuentes(p), "Qualificação: tons quentes").toEqual([]);
      await p.screenshot({ path: `${SAIDA}/t611-qualificacao-${largura}.png` });

      const falhas: string[] = [];
      for (const etapa of ETAPAS) {
        await p.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=${etapa}`, { waitUntil: "domcontentloaded" });
        await expect(p.getByTestId("assistente-rodape")).toBeVisible({ timeout: 30_000 });
        await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        const fundo = await fundoNaLateral(p);
        const rodape = await estilo(p, "assistente-rodape");
        const quentes = await tonsQuentes(p);
        const botao = etapa === "revisao" ? "publicar-anuncio" : "cadastro-continuar";
        const prim = await estilo(p, botao);
        const travado = await p.getByTestId(botao).isDisabled();
        console.log(`t611 ${largura} ${etapa}`, JSON.stringify({ fundo, rodape, prim, travado }), JSON.stringify(quentes));
        if (fundo !== ref.fundo) falhas.push(`${etapa}: fundo ${fundo} ≠ ${ref.fundo}`);
        if (rodape.bg !== ref.rodape.bg || rodape.borda !== ref.rodape.borda) falhas.push(`${etapa}: rodapé ${JSON.stringify(rodape)}`);
        if (!travado && (prim.bg !== ref.primario.bg || prim.op !== ref.primario.op)) falhas.push(`${etapa}: primário ${JSON.stringify(prim)}`);
        if (quentes.length) falhas.push(`${etapa}: ${quentes.join(" | ")}`);
        if (etapa === "tipo" || etapa === "fotos" || etapa === "detalhes" || etapa === "preco" || etapa === "revisao") await p.screenshot({ path: `${SAIDA}/t611-${etapa}-${largura}.png` });
      }
      expect(falhas, falhas.join("\n")).toEqual([]);
      await p.context().close();
    });
  }
});
