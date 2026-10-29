// Portão pós-#1500 (Pista C, 29/10): o E193 (#1496) trocou listas e caixas por pílulas e cartões no assistente e no editor; roda no lab-crítico deste PR.
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T393 — TIPO-CHACARA-B: tipo "Chácara/Sítio". Só no laboratório.
   1. Busca: o tipo aparece no filtro "Tipo de imóvel" com a contagem e na URL (?tipo=chacara).
   2. Cadastro: no passo Detalhes do tipo aparecem a linha fixa e os 3 campos; sem eles, o item "Dados da chácara/sítio"
      barra o publicar; preenchidos, o item some.
   3. Edição: o ponto marcado vira o ponto exato do anúncio e a distância até a cidade é CALCULADA dele (servidor).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE = `Cidade Chacara ${sufixo}`;
const dono = { email: `dono.chacara.${sufixo}@lab.vivanomads.test`, nome: "Dora Chácara", role: "owner" as const };
const ids: { dono?: string; ativa?: string; rascunho?: string } = {};
// ~15 km a oeste do centro de Uberlândia (centro conhecido: -18.9113, -48.2622).
const PONTO = { lat: -18.95, lng: -48.4 };

test.describe("T393 — TIPO-CHACARA-B: Chácara/Sítio", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.ativa = await criarImovelPronto(ids.dono, `Chácara Ativa ${sufixo}`, { ativo: true });
    ids.rascunho = await criarImovelPronto(ids.dono, `Chácara Rascunho ${sufixo}`);
    const { error } = await adm()
      .from("properties")
      .update({ property_type: "chacara", city: CIDADE, detalhes_anuncio: { chacara: { acesso: "terra", internet: "radio", pontoMarcado: true } } })
      .eq("id", ids.ativa);
    expect(error).toBeNull();
    // O assistente lê o tipo do rascunho (draft_data), não da coluna: sem ele o passo Detalhes não mostra os campos.
    const { error: e2 } = await adm().from("properties").update({ property_type: "chacara", city: "Uberlândia", draft_data: { propertyType: "chacara" } }).eq("id", ids.rascunho);
    expect(e2).toBeNull();
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1. busca: o tipo no filtro (com contagem) e na URL", async ({ page }) => {
    // E105: o tipo mora só na pílula "Tipo" da linha de cima.
    await page.goto(`/buscar?local=${encodeURIComponent(CIDADE)}`, { waitUntil: "domcontentloaded" });
    await expect(async () => {
      await page.getByTestId("pilula-tipo").click({ timeout: 5_000 });
      await expect(page.getByTestId("painel-pilula-tipo")).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 60_000 });
    await expect(page.getByTestId("pilula-tipo-chacara")).toContainText("Chácara/Sítio");
    await expect.poll(async () => Number(await page.getByTestId("pilula-tipo-chacara").getAttribute("data-n")), { timeout: 30_000 }).toBe(1);
    await page.goto(`/buscar?local=${encodeURIComponent(CIDADE)}&tipo=chacara`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(`Chácara Ativa ${sufixo}`).first()).toBeVisible({ timeout: 30_000 });
    // Na página do anúncio: a linha do tipo e nada de andar.
    await page.goto(`/imoveis/${ids.ativa}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#regras-da-estadia")).toContainText("Acesso: estrada de terra · internet: rádio", { timeout: 30_000 });
    await expect(page.locator("#regras-da-estadia")).not.toContainText("andar");
  });

  test("2. cadastro: linha fixa, 3 campos e o publicar barrado até preencher", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=detalhes`, { waitUntil: "domcontentloaded" });
    const campos = page.getByTestId("campos-chacara");
    await expect(campos.getByTestId("chacara-linha-fixa")).toHaveText(
      "Anuncie só a casa para morar. Uso da terra para plantio ou criação não entra no anúncio.",
      { timeout: 30_000 },
    );
    await expect(campos).toHaveAttribute("data-falta", "acesso,tipo de internet,ponto no mapa");
    await expect(page.getByTestId("checklist-item-chacara")).toHaveAttribute("data-ok", "0");
    await campos.getByTestId("chacara-acesso-terra").check();
    await campos.getByTestId("chacara-internet-radio").check();
    await expect(campos).toHaveAttribute("data-falta", "ponto no mapa");
    await campos.getByTestId("chacara-coordenadas").fill(`${PONTO.lat}, ${PONTO.lng}`);
    await expect(campos.getByTestId("chacara-ponto")).toHaveAttribute("data-marcado", "1");
    await expect(campos).toHaveAttribute("data-falta", "");
    await expect(page.getByTestId("checklist-item-chacara")).toHaveCount(0);
    await page.screenshot({ path: "tests/laboratorio/saida/t393-2-cadastro.png", fullPage: true });
    await page.context().close();
  });

  test("3. edição: o ponto marcado vira o exato e a distância vem dele", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.goto(`/dashboard/imoveis/${ids.rascunho}/editar`, { waitUntil: "domcontentloaded" });
    const secao = page.getByTestId("secao-detalhes-anuncio");
    if ((await secao.getAttribute("data-aberta")) !== "true") await secao.locator("button").first().click();
    const campos = secao.getByTestId("campos-chacara");
    await campos.getByTestId("chacara-acesso-misto").check({ timeout: 30_000 });
    await campos.getByTestId("chacara-internet-satelite").check();
    await campos.getByTestId("chacara-coordenadas").fill(`${PONTO.lat}, ${PONTO.lng}`);
    await expect(secao.getByTestId("detalhe-andar")).toHaveCount(0);
    await secao.getByRole("button", { name: "Salvar seção" }).click();
    await expect
      .poll(async () => {
        const { data } = await adm().from("properties").select("detalhes_anuncio, lat_exata, lng_exata").eq("id", ids.rascunho!).single();
        return data as { detalhes_anuncio: { chacara?: { acesso?: string; distanciaCidadeKm?: number } } | null; lat_exata: number | null; lng_exata: number | null };
      }, { timeout: 30_000 })
      .toMatchObject({ lat_exata: PONTO.lat, lng_exata: PONTO.lng, detalhes_anuncio: { chacara: { acesso: "misto", internet: "satelite", pontoMarcado: true } } });
    const { data } = await adm().from("properties").select("detalhes_anuncio").eq("id", ids.rascunho!).single();
    const km = (data?.detalhes_anuncio as { chacara?: { distanciaCidadeKm?: number } }).chacara?.distanciaCidadeKm ?? 0;
    expect(km).toBeGreaterThan(14);
    expect(km).toBeLessThan(16);
    await page.context().close();
  });
});
