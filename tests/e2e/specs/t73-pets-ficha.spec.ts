import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { jpegComGps } from "../fixtures/exif";
import { metadadoNoDeposito } from "../fixtures/exif-deposito";

/**
 * T73 — Ficha do pet do morador (ordem 022afabb, item 1, partes 1 e 2: com fotos): cadastra pela Conta,
 * a ficha chega ao banco só para a própria pessoa, o limite é 3 e dá para remover.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const inquilino = { email: `inq.pet.${sufixo}@lab.vivanomads.test`, nome: "Paula Pet", role: "tenant" as const };
const outro = { email: `outro.pet.${sufixo}@lab.vivanomads.test`, nome: "Otto Alheio", role: "tenant" as const };
const ids: { inquilino?: string; outro?: string } = {};

// Começo da spec (com folga para o relógio do Storage): o teste de EXIF só confere o que esta execução enviou.
const INICIO = new Date(Date.now() - 60_000);
test.describe("T73 — Ficha do pet na Conta", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.inquilino = await criarConta(inquilino, senha);
    ids.outro = await criarConta(outro, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.inquilino, ids.outro]);
  });

  test("1. cadastra o pet, vê o cartão e o banco guarda a ficha", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, inquilino.email, senha);
    await page.goto("/dashboard/conta", { waitUntil: "networkidle" });
    // C9/E56: sem pets o bloco nasce fechado; "Você tem pet?" abre o formulário.
    await page.getByTestId("pets-toggle-bloco-toggle").click({ timeout: 15_000 });
    const form = page.getByTestId("pets-form");
    await expect(form).toBeVisible({ timeout: 15_000 });
    await form.getByLabel("Nome").fill("Thor");
    await form.getByLabel("Porte").selectOption("M");
    await form.getByRole("button", { name: "Adicionar pet" }).click();
    await expect(page.getByTestId("pets-lista")).toContainText("Thor");
    const { data } = await adm().from("pets_inquilino").select("nome, porte, vacinas_em_dia").eq("user_id", ids.inquilino!);
    expect(data).toEqual([{ nome: "Thor", porte: "M", vacinas_em_dia: true }]);
    await page.context().close();
  });

  test("2. outra pessoa não vê a ficha; limite de 3 no banco; remover funciona", async ({ browser }) => {
    test.setTimeout(90_000);
    const alheio = await entrar(browser, outro.email, senha);
    await alheio.goto("/dashboard/conta", { waitUntil: "networkidle" });
    await expect(alheio.getByTestId("pets-toggle-bloco-toggle")).toHaveAttribute("aria-checked", "false", { timeout: 15_000 });
    await expect(alheio.getByTestId("pets-form")).toHaveCount(0);
    await expect(alheio.getByTestId("pets-lista")).toHaveCount(0);
    await alheio.context().close();

    const linha = { user_id: ids.inquilino!, especie: "gato", porte: "P", idade_anos: 1, castrado: true, vacinas_em_dia: true };
    expect((await adm().from("pets_inquilino").insert({ ...linha, nome: "Mia" })).error).toBeNull();
    expect((await adm().from("pets_inquilino").insert({ ...linha, nome: "Nina" })).error).toBeNull();
    expect((await adm().from("pets_inquilino").insert({ ...linha, nome: "Quarto" })).error).not.toBeNull();

    const page = await entrar(browser, inquilino.email, senha);
    await page.goto("/dashboard/conta", { waitUntil: "networkidle" });
    // Com pets salvos o bloco nasce aberto; no limite de 3, sem formulário.
    await expect(page.getByTestId("pets-toggle-bloco-toggle")).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });
    await expect(page.getByTestId("pets-form")).toHaveCount(0);
    await page.getByRole("button", { name: "Remover Mia" }).click();
    await expect(page.getByTestId("pets-form")).toBeVisible();
    await page.context().close();
  });

  test("3. foto do pet e carteira de vacina: servidor regrava em WebP na pasta da pessoa; SVG é recusado", async ({ browser }) => {
    test.setTimeout(120_000);
    const jpeg = await jpegComGps(4, 320, 240); // como sai do celular: o cenário 4 confere que o depósito guarda limpo
    const { data: antes } = await adm().from("pets_inquilino").select("id").eq("user_id", ids.inquilino!).eq("nome", "Nina").single();
    const petId = antes!.id as string;

    const page = await entrar(browser, inquilino.email, senha);
    await page.goto("/dashboard/conta", { waitUntil: "networkidle" });
    const nina = page.getByTestId("pets-lista").locator("li", { hasText: "Nina" });
    await nina.getByLabel("Enviar foto de Nina").setInputFiles({ name: "nina.jpg", mimeType: "image/jpeg", buffer: jpeg });
    await expect(nina.getByAltText("Foto 1 de Nina")).toBeVisible({ timeout: 20_000 });
    await nina.getByLabel("Enviar carteira de vacina de Nina").setInputFiles({ name: "carteira.jpg", mimeType: "image/jpeg", buffer: jpeg });
    await expect(nina.getByText("Carteira de vacina enviada")).toBeVisible({ timeout: 20_000 });

    const { data: linha } = await adm().from("pets_inquilino").select("fotos, carteira_vacina").eq("id", petId).single();
    expect(linha!.fotos).toHaveLength(1);
    for (const c of [linha!.fotos[0], linha!.carteira_vacina]) expect(c).toMatch(new RegExp(`^${ids.inquilino}/[0-9a-f-]{36}\\.webp$`));
    const baixado = await adm().storage.from("pets-fotos").download(linha!.fotos[0]);
    expect(baixado.data!.type).toBe("image/webp");

    await nina.getByLabel("Enviar foto de Nina").setInputFiles({ name: "x.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') });
    // getByRole("alert") também pega o anúncio de rota do Next (#__next-route-announcer__): procura o texto do erro.
    await expect(page.getByText("Envie uma foto JPG, PNG ou WebP de verdade.")).toBeVisible();
    expect((await adm().from("pets_inquilino").select("fotos").eq("id", petId).single()).data!.fotos).toHaveLength(1);
    await page.context().close();
  });

  test("4. EXIF/GPS: foto do pet e carteira de vacina enviadas com GPS ficam sem metadado no depósito 'pets-fotos'", async () => {
    const r = await metadadoNoDeposito("pets-fotos", ids.inquilino!, INICIO);
    expect(r.conferidas, "a foto e a carteira do cenário 3 deveriam estar no depósito").toBeGreaterThan(0);
    expect(r.problemas, "foto enviada com EXIF e GPS tem de ser guardada limpa").toEqual([]);
  });
});
