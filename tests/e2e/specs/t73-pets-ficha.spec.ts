import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T73 — Ficha do pet do morador (ordem 022afabb, item 1, parte 1): cadastra pela Conta,
 * a ficha chega ao banco só para a própria pessoa, o limite é 3 e dá para remover.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const inquilino = { email: `inq.pet.${sufixo}@lab.vivanomads.test`, nome: "Paula Pet", role: "tenant" as const };
const outro = { email: `outro.pet.${sufixo}@lab.vivanomads.test`, nome: "Otto Alheio", role: "tenant" as const };
const ids: { inquilino?: string; outro?: string } = {};

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
    await expect(alheio.getByTestId("pets-form")).toBeVisible({ timeout: 15_000 });
    await expect(alheio.getByTestId("pets-lista")).toHaveCount(0);
    await alheio.context().close();

    const linha = { user_id: ids.inquilino!, especie: "gato", porte: "P", idade_anos: 1, castrado: true, vacinas_em_dia: true };
    expect((await adm().from("pets_inquilino").insert({ ...linha, nome: "Mia" })).error).toBeNull();
    expect((await adm().from("pets_inquilino").insert({ ...linha, nome: "Nina" })).error).toBeNull();
    expect((await adm().from("pets_inquilino").insert({ ...linha, nome: "Quarto" })).error).not.toBeNull();

    const page = await entrar(browser, inquilino.email, senha);
    await page.goto("/dashboard/conta", { waitUntil: "networkidle" });
    await expect(page.getByTestId("pets-form")).toHaveCount(0);
    await page.getByRole("button", { name: "Remover Mia" }).click();
    await expect(page.getByTestId("pets-form")).toBeVisible();
    await page.context().close();
  });
});
