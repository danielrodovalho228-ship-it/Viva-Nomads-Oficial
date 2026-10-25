import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirNoEndereco, noPasso } from "../fixtures/cadastro";

/*
  T487 — E147 (#1379), guarda permanente da Pista C: o caminho do CEP (a t476 da Pista A só digita "Minas Gerais").
  CEP de Uberlândia com as consultas de CEP simuladas (ViaCEP e BrasilAPI, como na t195):
   1. o CEP devolve bairro "Santa Mônica": o campo e o rascunho gravado (draft_data.neighborhood) ficam "Santa Mônica",
      nunca "Minas Gerais"; e o valor continua lá depois de ir ao Passo 4 e voltar, e depois de recarregar;
   2. o CEP devolve o ESTADO no bairro ("Minas Gerais"): o campo fica vazio para a pessoa preencher e nada grava
      "Minas Gerais".
  A 390 e 1280 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t487.${sufixo}@lab.vivanomads.test`, nome: "Mônica Bairro", role: "owner" as const };
const ids: Record<string, string> = {};

async function simularCep(page: Page, bairro: string) {
  await page.route("https://viacep.com.br/ws/**", (r) =>
    r.fulfill({ json: { cep: "38408-100", logradouro: "Avenida João Naves de Ávila", bairro, localidade: "Uberlândia", uf: "MG", estado: "Minas Gerais" } }),
  );
  await page.route("https://brasilapi.com.br/api/cep/**", (r) =>
    r.fulfill({ json: { cep: "38408100", state: "MG", city: "Uberlândia", neighborhood: bairro, street: "Avenida João Naves de Ávila" } }),
  );
}

async function rascunhoGravado(): Promise<Record<string, unknown> | null> {
  const { data } = await adm().from("properties").select("draft_data").eq("owner_id", ids.dono).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data?.draft_data as Record<string, unknown> | null) ?? null;
}

test.describe("T487 — E147: bairro Santa Mônica pelo CEP, nunca o estado", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`1. a ${w} px: CEP de Uberlândia grava "Santa Mônica" e o valor persiste`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await simularCep(page, "Santa Mônica");
      await abrirNoEndereco(page);
      await page.getByTestId("cadastro-cep").fill("38408100");
      const bairro = page.getByTestId("cadastro-bairro");
      await expect(bairro).toHaveValue("Santa Mônica", { timeout: 15_000 });
      await expect(page.getByTestId("cadastro-cidade")).toHaveValue("Uberlândia");
      await page.getByTestId("cadastro-numero").fill("2121");
      await page.waitForTimeout(2_500);
      await expect(page.getByText(/Salvo/).first()).toBeVisible({ timeout: 15_000 });
      await expect.poll(async () => (await rascunhoGravado())?.neighborhood ?? null, { timeout: 15_000 }).toBe("Santa Mônica");

      // Sai para o Passo 4 e volta.
      await page.getByTestId("cadastro-continuar").click();
      await noPasso(page, "detalhes", 20_000);
      await page.getByTestId("cadastro-voltar").click();
      await noPasso(page, "endereco", 20_000);
      await expect(bairro).toHaveValue("Santa Mônica");
      // Recarrega o rascunho.
      await page.reload({ waitUntil: "domcontentloaded" });
      await noPasso(page, "endereco", 30_000);
      await expect(page.getByTestId("cadastro-bairro")).toHaveValue("Santa Mônica", { timeout: 15_000 });
      expect((await rascunhoGravado())?.neighborhood).not.toBe("Minas Gerais");
      await page.screenshot({ path: `tests/laboratorio/saida/t487-santa-monica-${w}.png` });
      await page.context().close();
    });
  }

  test("2. a 390 px: o CEP que devolve o estado no bairro não grava 'Minas Gerais'", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
    await simularCep(page, "Minas Gerais");
    await abrirNoEndereco(page);
    await page.getByTestId("cadastro-cep").fill("38408100");
    await expect(page.getByTestId("cadastro-cidade")).toHaveValue("Uberlândia", { timeout: 15_000 });
    await expect(page.getByTestId("cadastro-bairro")).not.toHaveValue("Minas Gerais");
    await page.getByTestId("cadastro-numero").fill("2121");
    await page.waitForTimeout(2_500);
    await expect(page.getByText(/Salvo/).first()).toBeVisible({ timeout: 15_000 });
    expect((await rascunhoGravado())?.neighborhood ?? "").not.toBe("Minas Gerais");
    await page.context().close();
  });
});
