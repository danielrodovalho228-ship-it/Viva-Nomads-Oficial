import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { campoBrasiliaParaIso, instanteParaCampoBrasilia } from "../../../src/lib/visitas-video";

/*
  T211 — Complemento do prompt 23 (reteste do Muse, 18/10). 390 e 1280 px.
   1. O dono grava rua, número e complemento pelo editor do anúncio publicado (antes ficavam só no rascunho, apagado
      ao publicar — por isso a visita confirmada não mostrava o endereço em produção).
   2. Agendamento: o horário escolhido não some quando o "Motivo da estadia" muda; o pedido grava o horário.
   3. Endereço exato: oculto antes da confirmação; depois, no cartão (com "Abrir no mapa") e no e-mail "Visita
      confirmada" da caixa de teste, só para aquele morador; outro usuário e o visitante nunca recebem o endereço
      (nem no HTML nem na API); visita que já passou volta à região.
   4. Visão geral do inquilino: "Identidade confirmada · válida até DD/MM/AAAA" com laudo; conta de teste sem laudo
      → "Verificar (simulado)"; conta real → "em breve".
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t211.${sufixo}@lab.vivanomads.test`, nome: "Dora Endereco Sobrenome", role: "owner" as const };
const inqA = { email: `inqa.t211.${sufixo}@lab.vivanomads.test`, nome: "Alice Visita Sobrenome", role: "tenant" as const };
const inqB = { email: `inqb.t211.${sufixo}@lab.vivanomads.test`, nome: "Bruna Outra Sobrenome", role: "tenant" as const };
const real = { email: `real.t211.${sufixo}@lab.vivanomads.test`, nome: "Rita Contareal Sobrenome", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};
const RUA = "Rua Modesta Maria, 120, apto 302";
const SAIDA = "tests/laboratorio/saida";

async function abrir(page: Page, rota: string) {
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await page.locator("main").first().waitFor();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

const visitaDe = async (tenantId: string) =>
  (await adm().from("visitas_video").select("id, status, horarios, horario_confirmado").eq("tenant_id", tenantId).eq("property_id", ids.imovel!).maybeSingle()).data;

test.describe("T211 — complemento do prompt 23: endereço da visita, horário que fica, cartão de verificação", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inqA = await criarConta(inqA, senha);
    ids.inqB = await criarConta(inqB, senha);
    ids.real = await criarConta(real, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inqA, ids.inqB]);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio endereço ${sufixo}`, { ativo: true, preco: 3200 });
  });

  test.afterAll(async () => {
    if (ids.imovel) {
      await adm().from("visitas_video").delete().eq("property_id", ids.imovel);
      await adm().from("messages").delete().eq("property_id", ids.imovel);
    }
    await adm().from("tenant_verifications").delete().in("tenant_id", [ids.inqA, ids.inqB, ids.real].filter(Boolean) as string[]);
    await apagarContas([ids.inqA, ids.inqB, ids.real, ids.dono]);
  });

  test("1. 1280 — o dono grava rua, número e complemento no editor do anúncio publicado", async ({ browser }) => {
    test.setTimeout(90_000);
    const d = await entrar(browser, dono.email, senha);
    await d.setViewportSize({ width: 1280, height: 900 });
    await abrir(d, `/dashboard/imoveis/${ids.imovel}/editar`);
    await d.getByRole("button", { name: /Endereço exato/ }).click();
    await d.getByTestId("editar-endereco-exato").fill(RUA);
    await d.getByRole("button", { name: /^Salvar seção/ }).first().click();
    await expect.poll(async () => (await adm().from("properties").select("exact_address").eq("id", ids.imovel!).single()).data?.exact_address, { timeout: 20_000 }).toBe(RUA);
    await d.screenshot({ path: `${SAIDA}/t211-editor-endereco-1280.png` });
    await d.context().close();
  });

  for (const [largura, conta] of [[390, inqA], [1280, inqB]] as const) {
    test(`2. ${largura} — o horário escolhido continua depois de mudar o motivo; o pedido grava o horário`, async ({ browser }) => {
      test.setTimeout(120_000);
      const dia = instanteParaCampoBrasilia(new Date(Date.now() + 2 * 24 * 3600_000)).slice(0, 10);
      const campo = `${dia}T${largura === 390 ? "15:00" : "16:30"}`;
      const p = await entrar(browser, conta.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await abrir(p, `/imoveis/${ids.imovel}`);
      const horario = p.getByTestId("visita-presencial-horario-0");
      await expect(async () => {
        if (!(await horario.isVisible())) {
          const botao = p.getByTestId("agendar-visita").first();
          await botao.scrollIntoViewIfNeeded({ timeout: 3_000 });
          await botao.click({ timeout: 4_000 }).catch(() => botao.dispatchEvent("click"));
        }
        await expect(horario).toBeVisible({ timeout: 3_000 });
      }).toPass({ timeout: 40_000 });
      await horario.fill(campo);
      // Outro campo muda e a tela redesenha: o horário fica.
      const motivo = p.getByTestId("visita-presencial-motivo");
      const opcoes = await motivo.locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
      await motivo.selectOption(opcoes[0]);
      await expect(horario).toHaveValue(campo);
      await motivo.selectOption(opcoes[1] ?? opcoes[0]);
      await expect(horario).toHaveValue(campo);
      await p.screenshot({ path: `${SAIDA}/t211-horario-fica-${largura}.png` });
      await p.getByTestId("visita-presencial-enviar").click();
      await expect(p.getByTestId("visita-presencial-ok")).toBeVisible({ timeout: 25_000 });
      await semRolagemLateral(p);
      await p.context().close();
      const v = await visitaDe(largura === 390 ? ids.inqA! : ids.inqB!);
      expect(new Date((v!.horarios as string[])[0]).toISOString()).toBe(campoBrasiliaParaIso(campo));
    });
  }

  test("3. 390 — endereço oculto antes; confirmado: cartão + 'Abrir no mapa' + e-mail, só para esse morador", async ({ browser }) => {
    test.setTimeout(180_000);
    const a = await entrar(browser, inqA.email, senha);
    await abrir(a, "/dashboard/visitas");
    await expect(a.getByTestId("visita-endereco-oculto").first()).toBeVisible({ timeout: 25_000 });
    expect(await a.content()).not.toContain("Modesta Maria");
    await a.context().close();

    const d = await entrar(browser, dono.email, senha);
    await abrir(d, "/dashboard/visitas");
    const va = await visitaDe(ids.inqA!);
    await d.locator(`#visita-${va!.id}`).getByTestId("visita-confirmar").click();
    await expect.poll(async () => (await visitaDe(ids.inqA!))?.status, { timeout: 25_000 }).toBe("confirmado");
    await d.context().close();

    const a2 = await entrar(browser, inqA.email, senha);
    await abrir(a2, "/dashboard/visitas");
    const end = a2.getByTestId("visita-endereco").first();
    await expect(end).toContainText(`${RUA} · Centro · Uberlândia`, { timeout: 25_000 });
    await expect(a2.getByTestId("visita-abrir-mapa").first()).toHaveAttribute("href", /google\.com\/maps\/search\/\?api=1&query=Rua%20Modesta%20Maria/);
    await semRolagemLateral(a2);
    await a2.screenshot({ path: `${SAIDA}/t211-endereco-confirmada-390.png`, fullPage: true });
    await a2.context().close();

    // E-mail "Visita confirmada" na caixa de teste do morador, com o endereço e o link do mapa.
    await expect
      .poll(async () => {
        const { data } = await adm().from("emails_teste").select("corpo").eq("usuario_id", ids.inqA!).eq("evento", "visita_confirmada");
        return ((data ?? []) as { corpo: string }[]).map((r) => r.corpo).join("\n");
      }, { timeout: 25_000 })
      .toMatch(/Modesta Maria[\s\S]*Abrir no mapa/);

    // A outra interessada (visita ainda pedida), a conta real e o visitante nunca recebem o endereço.
    const b = await entrar(browser, inqB.email, senha);
    await b.setViewportSize({ width: 1280, height: 900 });
    await abrir(b, "/dashboard/visitas");
    await expect(b.getByTestId("visita-endereco-oculto").first()).toBeVisible({ timeout: 25_000 });
    expect(await b.content()).not.toContain("Modesta Maria");
    const api = await b.request.get(`/api/properties`);
    expect(await api.text()).not.toContain("Modesta Maria");
    await b.context().close();
    const r = await entrar(browser, real.email, senha);
    await abrir(r, `/imoveis/${ids.imovel}`);
    expect(await r.content()).not.toContain("Modesta Maria");
    await r.context().close();
    const anon = await browser.newContext();
    const pa = await anon.newPage();
    await pa.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
    expect(await pa.content()).not.toContain("Modesta Maria");
    expect(await (await pa.request.get(`/api/properties`)).text()).not.toContain("Modesta Maria");
    await anon.close();
  });

  test("3b. 1280 — a visita que já passou volta a mostrar só a região", async ({ browser }) => {
    test.setTimeout(90_000);
    const va = await visitaDe(ids.inqA!);
    await adm().from("visitas_video").update({ horario_confirmado: new Date(Date.now() - 2 * 24 * 3600_000).toISOString() }).eq("id", va!.id);
    const a = await entrar(browser, inqA.email, senha);
    await a.setViewportSize({ width: 1280, height: 900 });
    await abrir(a, "/dashboard/visitas");
    await expect(a.getByTestId("cartao-visita").first()).toBeVisible({ timeout: 25_000 });
    await expect(a.getByTestId("visita-endereco")).toHaveCount(0);
    expect(await a.content()).not.toContain("Modesta Maria");
    await a.context().close();
  });

  for (const largura of [390, 1280]) {
    test(`4. ${largura} — Visão geral: identidade confirmada com a data; teste sem laudo: simulado; real: em breve`, async ({ browser }) => {
      test.setTimeout(120_000);
      const ate = new Date();
      ate.setFullYear(ate.getFullYear() + 1);
      await adm().from("tenant_verifications").delete().eq("tenant_id", ids.inqA!);
      await adm()
        .from("tenant_verifications")
        .insert({ tenant_id: ids.inqA, caf_result: { identity: true, document: true, liveness: true, light: "green", simulado: true }, traffic_light: "green", valid_until: ate.toISOString() });
      const dataBR = ate.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

      const casos: [typeof inqA, RegExp][] = [
        [inqA, new RegExp(`Identidade confirmada · válida até ${dataBR.replace(/\//g, "\\/")}`)],
        [inqB, /Verificação de identidade/],
        [real, /Verificação de identidade \(em breve\)/],
      ];
      for (const [conta, esperado] of casos) {
        const p = await entrar(browser, conta.email, senha);
        await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
        await abrir(p, "/dashboard");
        const passo = p.getByTestId("onboarding-verificar");
        await expect(passo).toContainText(esperado, { timeout: 25_000 });
        if (conta === inqB) await expect(passo).toContainText("Verificar (simulado)");
        if (conta === real) await expect(passo).toContainText("Saber mais");
        await semRolagemLateral(p);
        if (conta === inqA) await p.screenshot({ path: `${SAIDA}/t211-identidade-confirmada-${largura}.png` });
        await p.context().close();
      }
    });
  }
});
