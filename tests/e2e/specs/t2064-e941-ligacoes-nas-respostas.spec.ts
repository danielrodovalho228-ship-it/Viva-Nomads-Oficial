import { test, expect } from "@playwright/test";

/*
  T2064 — E941 (Pista 3; autorizado pelo Gerente em 17/11) @E941 @ao-vivo-seguro
  Regra decidida: as respostas da Central de ajuda têm ligações clicáveis REAIS dentro do texto da resposta (não só o
  botão por baixo dela). Hoje: 0 ligações em 20 respostas. Correção do Code 2 (Família 6). Esta spec é a trava
  (vermelha na main até a correção entrar).
  Leitura conservadora do que a spec exige: em cada tema — Morador, Contratos e Segurança e conta — pelo menos uma
  resposta tem uma ligação dentro do próprio texto, e toda ligação dentro de uma resposta é real (um endereço do site
  que abre com 200, nunca "#" nem vazio). Visitante, só leitura.
*/
test.use({ storageState: { cookies: [], origins: [] } });

for (const tema of ["morador", "contratos", "seguranca"]) {
  test(`T2064 — E941: as respostas do tema ${tema} têm ligações reais dentro do texto @E941 @ao-vivo-seguro`, async ({ page, request }) => {
    const r = await page.goto(`/ajuda/${tema}`, { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(200);
    const lista = page.getByTestId("ajuda-perguntas");
    const perguntas = lista.locator("li > button[aria-expanded]");
    await expect(perguntas.first()).toBeVisible({ timeout: 30_000 });
    const n = await perguntas.count();
    expect(n, "o tema tem perguntas").toBeGreaterThan(0);

    const ligacoes: { pergunta: string; href: string }[] = [];
    for (let i = 0; i < n; i++) {
      const botao = perguntas.nth(i);
      const pergunta = (await botao.innerText()).trim();
      // Abre a resposta (repete até a página hidratar).
      await expect(async () => {
        if ((await botao.getAttribute("aria-expanded")) !== "true") await botao.click();
        await expect(botao).toHaveAttribute("aria-expanded", "true", { timeout: 2_000 });
      }).toPass({ timeout: 30_000 });
      // O texto da resposta é o parágrafo logo abaixo da pergunta; as ligações contam só DENTRO dele.
      const resposta = botao.locator("xpath=following-sibling::div[1]").locator("p").first();
      await expect(resposta).toBeVisible();
      for (const href of await resposta.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""))) {
        ligacoes.push({ pergunta, href });
      }
    }

    expect(ligacoes.length, `tema ${tema}: nenhuma ligação dentro das ${n} respostas`).toBeGreaterThan(0);
    for (const l of ligacoes) {
      expect(l.href, `"${l.pergunta}": ligação sem endereço real`).toMatch(/^\/[^#\s]/);
      const resp = await request.get(l.href);
      expect(resp.status(), `"${l.pergunta}": ${l.href} não abre`).toBe(200);
    }
  });
}
