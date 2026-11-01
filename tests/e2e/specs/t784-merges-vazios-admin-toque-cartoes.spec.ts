import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T784 — merges de 31/10 (fim da tarde), Pista C, bloco 107. Pelas telas de verdade, a 1280 e a 390 px:
   A. admin, estados vazios (#1720 respostas prontas, #1721 ordens do agente, #1729 ajuda para publicar, #1730
      serviços): o laboratório é compartilhado, então cada tela pode ter itens; com a lista vazia, o texto novo (exato),
      e em qualquer caso o texto antigo ("Nenhuma ainda." / "Nenhuma ordem ainda." / "Nenhum pedido ainda.") sumiu;
   B. #1723 — Conta › Meus dados, sem local de trabalho salvo: diz o próximo passo (conta nova);
   C. #1724 — Meus anúncios: a foto fica 4:3 (não estica com o cartão) e os botões ficam no mesmo lugar em todos os
      cartões, com um anúncio de estadia mínima longa (a linha que empurrava os botões);
   D. (saiu) #1726 — o título em 2 linhas das linhas de Imóveis recomendados: o #1794 trocou essas linhas por cartões
      com foto (conformidade morador-inicio), com a guarda dele na t761-morador-inicio-conformidade;
   E. #1725 e #1731 — alvos de toque no celular (390, tela de toque): links do rodapé, Instagram e Compartilhar com
      44 px; os links de texto soltos (.alvo-toque) ganham a área de 44 px só em tela de toque (a 1280, com mouse, não).
  Já guardados pelo próprio merge: #1727 (t597) e #1728 (t240, t537). #1719 e #1722 são rascunhos da própria Pista C.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t784.${sufixo}@lab.vivanomads.test`, nome: "Cora Cartão", role: "owner" as const };
const morador = { email: `mor.t784.${sufixo}@lab.vivanomads.test`, nome: "Lia Local", role: "tenant" as const };
const LARGURAS = [1280, 390] as const;
const ids: Record<string, string> = {};
const altura = (l: number) => (l === 390 ? 844 : 900);

async function comoAdmin(browser: Browser, largura: number, caminho: string): Promise<Page> {
  const p = await (await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: altura(largura) } })).newPage();
  await p.goto(caminho, { waitUntil: "domcontentloaded" });
  await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  return p;
}
async function comoConta(browser: Browser, email: string, largura: number, caminho: string): Promise<Page> {
  const p = await entrar(browser, email, senha);
  await p.setViewportSize({ width: largura, height: altura(largura) });
  await p.goto(caminho, { waitUntil: "domcontentloaded" });
  await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  return p;
}
/** Com a lista vazia, o texto novo exato; o antigo, nunca. Devolve se estava vazia (vai para a anotação). */
async function vazioNovo(p: Page, testid: string, texto: string | RegExp, antigo: string): Promise<boolean> {
  const vazio = p.getByTestId(testid);
  const temVazio = (await vazio.count()) > 0;
  if (temVazio) await expect(vazio.first()).toHaveText(texto);
  await expect(p.getByText(antigo, { exact: true })).toHaveCount(0);
  test.info().annotations.push({ type: "estado", description: `${testid}: ${temVazio ? "lista vazia (texto novo conferido)" : "lista com itens no laboratório"}` });
  return temVazio;
}

test.describe("T784 — merges de 31/10: vazios do admin e da conta, cartões de Meus anúncios, recomendados e alvos de toque", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    await adm().from("profiles").update({ intencao: ["anunciar"] }).eq("id", ids.dono);
    await adm().from("profiles").update({ intencao: ["morar"] }).eq("id", ids.morador);
    ids.curto = await criarImovelPronto(ids.dono, `Studio curto t784 ${sufixo}`, { ativo: true });
    ids.longo = await criarImovelPronto(ids.dono, `Casa de estadia longa t784 ${sufixo}`, { ativo: true });
    // A estadia mínima longa é a linha que, antes do #1724, empurrava os botões só nesse cartão.
    await adm().from("properties").update({ min_period_days: 180 }).eq("id", ids.longo);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono, ids.morador]);
  });

  for (const largura of LARGURAS) {
    test(`A. ${largura} px: admin — vazios de respostas prontas, ordens do agente, ajuda para publicar e serviços (#1720, #1721, #1729, #1730)`, async ({ browser }) => {
      let p = await comoAdmin(browser, largura, "/admin/atendimento?aba=respostas");
      await expect(p.getByText("Respostas prontas").first()).toBeVisible({ timeout: 30_000 });
      await vazioNovo(
        p,
        "respostas-prontas-vazio",
        'Nenhuma resposta pronta ainda. Salve uma no formulário acima: ela aparece em "Resposta pronta", no Responder de cada chamado, com {nome} trocado pelo primeiro nome da pessoa.',
        "Nenhuma ainda.",
      );
      await p.context().close();

      p = await comoAdmin(browser, largura, "/admin/agentes");
      await p.getByRole("tab", { name: "Conversar" }).click({ timeout: 30_000 });
      await expect(p.getByTestId("chat-agente")).toBeVisible({ timeout: 20_000 });
      await expect(p.getByText(/^Ordens para /).first()).toBeVisible({ timeout: 20_000 });
      await vazioNovo(p, "ordens-agente-vazio", /^Nenhuma ordem para \S.* ainda\. Peça uma ação na conversa acima: o pedido vira ordem e aparece aqui, com o estado de cada uma\.$/, "Nenhuma ordem ainda.");
      await p.context().close();

      p = await comoAdmin(browser, largura, "/admin/ajuda-publicacao");
      await vazioNovo(
        p,
        "ajuda-fila-vazia",
        "Nenhum pedido de ajuda para publicar ainda. Quando um proprietário pedir ajuda em Meus imóveis, o pedido entra aqui para a equipe montar o rascunho e enviar ao dono.",
        "Nenhum pedido ainda.",
      );
      await p.context().close();

      p = await comoAdmin(browser, largura, "/admin/servicos");
      await vazioNovo(
        p,
        "admin-servicos-vazio",
        "Nenhum pedido de serviço dos moradores ainda. Cada pedido feito em Serviços, no painel do morador, aparece aqui com o prestador, a data desejada e o estado, para a equipe acompanhar.",
        "Nenhum pedido ainda.",
      );
      await p.context().close();
    });

    test(`B. ${largura} px: Conta › Meus dados sem local de trabalho diz o próximo passo (#1723)`, async ({ browser }) => {
      const p = await comoConta(browser, morador.email, largura, "/dashboard/conta/dados");
      const bloco = p.getByTestId("meu-local-trabalho").last();
      // Sem local salvo o bloco nasce fechado; o toque antes da hidratação pode não abrir (t261): toca até abrir.
      await expect(async () => {
        const chave = p.getByTestId("local-toggle-bloco-toggle").last();
        if ((await chave.getAttribute("aria-checked")) !== "true") await chave.click({ timeout: 5_000 });
        await expect(bloco.getByTestId("local-salvo")).toBeVisible({ timeout: 5_000 });
      }).toPass({ timeout: 40_000 });
      await expect(bloco.getByTestId("local-salvo")).toHaveText('Nenhum local salvo ainda: escolha abaixo o lugar e como você vai até ele, e toque em "Salvar local de trabalho".');
      await p.context().close();
    });

    test(`C. ${largura} px: Meus anúncios — foto 4:3 sem esticar e botões no mesmo lugar em todos os cartões (#1724)`, async ({ browser }) => {
      const p = await comoConta(browser, dono.email, largura, "/dashboard/imoveis");
      const rodapes = p.getByTestId("anuncio-rodape");
      await expect(rodapes).toHaveCount(2, { timeout: 30_000 });
      const medidas = await rodapes.evaluateAll((els) =>
        els.map((r) => {
          const cartao = r.parentElement!.parentElement!;
          const foto = cartao.firstElementChild!.getBoundingClientRect();
          const c = cartao.getBoundingClientRect();
          const b = r.getBoundingClientRect();
          return { razao: foto.height / foto.width, folgaBaixo: Math.round(c.bottom - b.bottom), esquerda: Math.round(b.left - c.left) };
        }),
      );
      for (const m of medidas) expect(m.razao, `foto 4:3 (${JSON.stringify(m)})`).toBeCloseTo(0.75, 1);
      expect(Math.abs(medidas[0].folgaBaixo - medidas[1].folgaBaixo), `botões à mesma distância do fim do cartão (${JSON.stringify(medidas)})`).toBeLessThanOrEqual(2);
      expect(Math.abs(medidas[0].esquerda - medidas[1].esquerda), `botões na mesma coluna (${JSON.stringify(medidas)})`).toBeLessThanOrEqual(2);
      await p.context().close();
    });
  }
      await p.context().close();
    });
  }

  test("E. 390 px, tela de toque: rodapé, Instagram e Compartilhar com 44 px; links de texto soltos com área de 44 px (#1725, #1731)", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const p = await ctx.newPage();
    await p.goto("/", { waitUntil: "domcontentloaded" });
    await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const rodape = await p.locator("footer ul li a").evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent).map((e) => ({ t: (e.textContent ?? "").trim(), h: Math.round(e.getBoundingClientRect().height) })));
    expect(rodape.length, "há links no rodapé").toBeGreaterThan(0);
    for (const l of rodape) expect(l.h, `rodapé "${l.t}" com 44 px`).toBeGreaterThanOrEqual(44);
    const redes = await p.getByTestId("redes-oficiais").first().locator("a").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; }));
    expect(redes.length, "Instagram no rodapé").toBeGreaterThan(0);
    for (const r of redes) {
      expect(r.w, "rede oficial: 44 px de largura").toBeGreaterThanOrEqual(44);
      expect(r.h, "rede oficial: 44 px de altura").toBeGreaterThanOrEqual(44);
    }
    const alvos = await p.locator(".alvo-toque").evaluateAll((els) => els.map((e) => getComputedStyle(e, "::after").height));
    expect(alvos.length, "a página inicial tem links de texto soltos").toBeGreaterThan(0);
    for (const h of alvos) expect(h, "área de toque de 44 px no link de texto solto").toBe("44px");

    await p.goto(`/imoveis/${ids.curto}`, { waitUntil: "domcontentloaded" });
    const compartilhar = p.getByTestId("compartilhar").first();
    await expect(compartilhar).toBeVisible({ timeout: 30_000 });
    const caixa = (await compartilhar.boundingBox())!;
    expect(Math.round(caixa.width), "Compartilhar: 44 px").toBeGreaterThanOrEqual(44);
    expect(Math.round(caixa.height), "Compartilhar: 44 px").toBeGreaterThanOrEqual(44);
    await ctx.close();

    // A 1280, com mouse, o link de texto solto continua como era (sem a área extra).
    const mesa = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    await mesa.goto("/", { waitUntil: "domcontentloaded" });
    const semArea = await mesa.locator(".alvo-toque").evaluateAll((els) => els.map((e) => getComputedStyle(e, "::after").content));
    for (const c of semArea) expect(c, "sem área extra com mouse").toBe("none");
    await mesa.context().close();
  });
});
