import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T74 — Pets na candidatura (ordem 022afabb, itens 1 e 4): o inquilino com pet cadastrado vê, antes de enviar,
 * os pets que vão junto e um aviso claro quando o porte/espécie não cabe nas regras do imóvel.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.pet74.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const inquilino = { email: `inq.pet74.${sufixo}@lab.vivanomads.test`, nome: "Iago Inquilino", role: "tenant" as const };
const ids: { dono?: string; inquilino?: string; imovel?: string; imovelG?: string } = {};

test.describe("T74 — Aviso de pet na candidatura", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inquilino = await criarConta(inquilino, senha);
    // Um imóvel por cenário: a página do anúncio é cacheada por 60 s (revalidate) e o spec altera as regras
    // direto no banco, sem revalidatePath. Reusar o mesmo imóvel faria o 2º teste ler as regras do 1º.
    ids.imovel = await criarImovelPronto(ids.dono, `Studio Pet ${sufixo}`, { ativo: true });
    ids.imovelG = await criarImovelPronto(ids.dono, `Studio Pet G ${sufixo}`, { ativo: true });
    const { error } = await adm()
      .from("pets_inquilino")
      .insert({ user_id: ids.inquilino, nome: "Rex", especie: "cao", porte: "G", idade_anos: 3, castrado: true, vacinas_em_dia: true });
    expect(error).toBeNull();
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono, ids.inquilino]);
  });

  test("1. cão grande em imóvel que só aceita porte P: aviso claro antes de enviar", async ({ browser }) => {
    test.setTimeout(90_000);
    await adm()
      .from("properties")
      .update({ pets_allowed: true, pets_regras: { especies: ["cao", "gato"], porteMax: "P", qtdMax: 1, reforcoCaucao: 0, regrasCondominio: "" } })
      .eq("id", ids.imovel!);
    const page = await entrar(browser, inquilino.email, senha);
    await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "networkidle" });
    const aviso = page.getByTestId("pet-candidatura-aviso").first();
    await expect(aviso).toBeVisible({ timeout: 20_000 });
    await expect(aviso).toContainText("Rex");
    await expect(aviso).toContainText("porte máximo");
    await page.context().close();
  });

  test("2. regras que aceitam porte G: sem aviso, só a confirmação dos pets", async ({ browser }) => {
    test.setTimeout(90_000);
    await adm()
      .from("properties")
      .update({ pets_allowed: true, pets_regras: { especies: ["cao", "gato"], porteMax: "G", qtdMax: 2, reforcoCaucao: 0, regrasCondominio: "" } })
      .eq("id", ids.imovelG!);
    const page = await entrar(browser, inquilino.email, senha);
    await page.goto(`/imoveis/${ids.imovelG}`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("pet-candidatura-ok").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("pet-candidatura-aviso")).toHaveCount(0);
    await page.context().close();
  });
});
