import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, novoSufixo } from "../fixtures/laboratorio";

/**
 * T287 — Correção do /admin/destinos (22/10): era impossível salvar um destino.
 *  1. Cadastrar: a busca no mapa devolve sugestões; escolher uma preenche latitude e longitude e mostra o mapa; salvar
 *     grava o destino (inativo, com o ponto).
 *  2. Colar "lat, lng" (como o Google Maps copia) num campo preenche os dois.
 *  3. Editar o mesmo destino ATUALIZA a linha (antes virava cadastro novo e a RLS recusava: "Não foi possível salvar.").
 * No laboratório a busca no mapa é simulada (nada sai para a rede).
 */
const sufixo = novoSufixo();
const NOME = `Destino T287 ${sufixo}`;
const ids: { slug?: string } = {};

test.describe("T287 — /admin/destinos salva", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: authFile("admin"), viewport: { width: 390, height: 844 } });

  test.afterAll(async () => {
    await adm().from("destinos").delete().eq("nome", NOME);
  });

  test("1. busca no mapa preenche o ponto e o cadastro salva", async ({ page }) => {
    test.skip(!hasAccount("admin"), "sem conta admin de teste");
    await page.goto("/admin/destinos", { waitUntil: "domcontentloaded" });
    const form = page.getByTestId("destino-form");
    await expect(form).toBeVisible({ timeout: 30_000 });
    await form.locator("#nome").fill(NOME);
    await form.locator("#tipo").selectOption("empresa");
    await form.getByTestId("destino-busca").fill("Centro empresarial de teste");
    await form.getByTestId("destino-buscar").click();
    const sugestao = form.getByTestId("destino-sugestao").first();
    await expect(sugestao).toContainText("laboratório", { timeout: 20_000 });
    await sugestao.click();
    await expect(form.getByTestId("destino-lat")).not.toHaveValue("");
    await expect(form.getByTestId("destino-lng")).not.toHaveValue("");
    await expect(form.getByTestId("destino-mapa")).toBeVisible();
    await page.screenshot({ path: "tests/laboratorio/saida/t287-busca-390.png", fullPage: true });
    await form.getByTestId("salvar-destino").click();
    await expect(form.getByRole("status")).toContainText(`${NOME} salvo.`, { timeout: 20_000 });
    const { data } = await adm().from("destinos").select("slug, lat, lng, ativo").eq("nome", NOME).maybeSingle();
    expect(data).toMatchObject({ ativo: false });
    ids.slug = data!.slug as string;
    expect(data!.lat).not.toBeNull();
    expect(data!.lng).not.toBeNull();
  });

  test("2–3. colar 'lat, lng' preenche os dois; editar atualiza a mesma linha", async ({ page }) => {
    test.skip(!hasAccount("admin"), "sem conta admin de teste");
    test.skip(!ids.slug, "o caso 1 não cadastrou");
    await page.goto(`/admin/destinos?editar=${ids.slug}#form-destino`, { waitUntil: "domcontentloaded" });
    const form = page.getByTestId("destino-form");
    await expect(form.locator("#nome")).toHaveValue(NOME, { timeout: 30_000 });
    await form.getByTestId("destino-lat").fill("-18.918600, -48.277200");
    await expect(form.getByTestId("destino-lat")).toHaveValue("-18.918600");
    await expect(form.getByTestId("destino-lng")).toHaveValue("-48.277200");
    await form.getByTestId("salvar-destino").click();
    await expect(form.getByRole("status")).toContainText(`${NOME} salvo.`, { timeout: 20_000 });
    const { data } = await adm().from("destinos").select("lat, lng").eq("nome", NOME);
    expect(data).toEqual([{ lat: -18.9186, lng: -48.2772 }]);
  });
});
