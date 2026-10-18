import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T168 — ordem 6f964617, telas 8 e 9: Visita por vídeo.
 * O morador pede horários na página do imóvel; o proprietário vê o pedido SEM nome do morador, confirma um horário
 * com o link da chamada; o morador vê o link. Outro proprietário não vê o pedido. 390 e 1280 px.
 */
test.describe("T168 — Visita por vídeo: pedir → confirmar", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  // Sem teto por ação, qualquer clique/preenchimento travado esperava os 120 s do teste e a falha vinha sem dizer onde.
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t168.${sufixo}@lab.vivanomads.test`, nome: "Dora Anfitria", role: "owner" as const };
  const outro = { email: `outro.t168.${sufixo}@lab.vivanomads.test`, nome: "Otavio Vizinho", role: "owner" as const };
  const inq = { email: `inq.t168.${sufixo}@lab.vivanomads.test`, nome: "Iago Moradorsobrenome", role: "tenant" as const };
  const ids: { dono?: string; outro?: string; inq?: string; imovel?: string } = {};
  const LINK = "https://meet.google.com/abc-defg-hij";

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.outro = await criarConta(outro, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Visita t168 ${sufixo}`, { ativo: true });
  });

  test.afterAll(async () => {
    if (ids.imovel) await adm().from("visitas_video").delete().eq("property_id", ids.imovel);
    await apagarContas([ids.dono, ids.outro, ids.inq]);
  });

  for (const [nome, largura, altura] of [["390 px", 390, 844], ["1280 px", 1280, 800]] as const) {
    test(`morador pede a visita — ${nome}`, async ({ browser }) => {
      test.setTimeout(120_000);
      if (ids.imovel) await adm().from("visitas_video").delete().eq("property_id", ids.imovel);
      const page = await entrar(browser, inq.email, senha);
      await page.setViewportSize({ width: largura, height: altura });
      await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
      // Na 1ª carga fria o clique pode chegar antes da hidratação e o formulário não abre: reclica até aparecer
      // (só clica se ainda estiver fechado, para o botão não fechar o que acabou de abrir).
      const horario = page.getByTestId("visita-video-horario-0");
      await expect(async () => {
        if (!(await horario.isVisible())) {
          // Sem actionTimeout no config, um clique tapado pela barra fixa do celular esperaria até os 120 s do teste:
          // limita o clique e, se não der, dispara o clique direto no botão (o toPass tenta de novo).
          const abrir = page.getByTestId("visita-video-abrir").first();
          await abrir.scrollIntoViewIfNeeded({ timeout: 3_000 });
          await abrir.click({ timeout: 4_000 }).catch(() => abrir.dispatchEvent("click"));
        }
        await expect(horario).toBeVisible({ timeout: 3_000 });
      }).toPass({ timeout: 40_000 });
      const quando = new Date(Date.now() + 2 * 24 * 3600_000);
      quando.setMinutes(0, 0, 0);
      const z = (n: number) => String(n).padStart(2, "0");
      const campo = `${quando.getFullYear()}-${z(quando.getMonth() + 1)}-${z(quando.getDate())}T${z(quando.getHours())}:00`;
      await horario.fill(campo);
      // A 390 px a barra fixa do celular pode tapar o botão e o clique esperaria até o fim do teste: limita e,
      // se não der, dispara o clique direto (o botão desliga em "Enviando...", então não envia duas vezes).
      const enviar = page.getByTestId("visita-video-enviar");
      await enviar.scrollIntoViewIfNeeded({ timeout: 5_000 });
      await enviar.click({ timeout: 6_000 }).catch(() => enviar.dispatchEvent("click"));
      await expect(page.getByTestId("visita-video-ok")).toBeVisible({ timeout: 25_000 });
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sobra).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `test-results/t168-pedido-${largura}.png` });
      await page.context().close();
    });
  }

  test("dono vê o pedido sem identidade do morador e confirma com o link", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/visitas", { waitUntil: "domcontentloaded" });
    const recebidas = page.getByTestId("visitas-recebidas");
    await expect(recebidas).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText("Moradorsobrenome")).toHaveCount(0);
    await expect(page.getByText(inq.email)).toHaveCount(0);
    await page.getByTestId("visita-link").fill("https://wa.me/5534999999999");
    await page.getByTestId("visita-confirmar").click();
    await expect(page.getByTestId("visita-erro")).toBeVisible();
    await page.getByTestId("visita-link").fill(LINK);
    await page.getByTestId("visita-confirmar").click();
    // Confere primeiro o que o servidor gravou: separa "a ação não gravou" (mostra o alerta da tela) de "a tela não recarregou".
    await expect
      .poll(async () => (await adm().from("visitas_video").select("status").eq("property_id", ids.imovel!).maybeSingle()).data?.status, {
        timeout: 25_000,
        message: `ação não gravou; alerta na tela: ${await page.getByTestId("visita-erro").textContent({ timeout: 1_000 }).catch(() => "(nenhum)")}`,
      })
      .toBe("confirmado");
    await expect(page.getByTestId("visita-status").first()).toHaveText("Confirmada", { timeout: 25_000 });
    await page.screenshot({ path: "test-results/t168-dono-390.png" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: "test-results/t168-dono-1280.png" });
    await page.context().close();
  });

  test("morador vê o link da chamada; outro proprietário não vê o pedido", async ({ browser }) => {
    test.setTimeout(120_000);
    const a = await entrar(browser, inq.email, senha);
    await a.goto("/dashboard/visitas", { waitUntil: "domcontentloaded" });
    await expect(a.getByTestId("visita-link-chamada")).toHaveAttribute("href", LINK, { timeout: 25_000 });
    await a.context().close();

    const b = await entrar(browser, outro.email, senha);
    await b.goto("/dashboard/visitas", { waitUntil: "domcontentloaded" });
    await expect(b.getByTestId("estado-vazio")).toBeVisible({ timeout: 25_000 });
    await expect(b.getByTestId("visitas-recebidas")).toHaveCount(0);
    await b.context().close();
  });
});
