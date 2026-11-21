import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1598 — ordem 9950ef15, item 5 (LGPD art. 11): a frase do cartão "Por que estou na cidade" (que o proprietário lê
  depois do aceite) recusa diagnóstico e nome de doença. Nada é gravado; uma frase comum continua sendo aceita.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const morador = { email: `morador.t1598.${sufixo}@lab.vivanomads.test`, nome: "Marta Moradora", role: "tenant" as const };
const ids: Record<string, string> = {};

test.describe("T1598 — 9950ef15: frase sem diagnóstico", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.morador]);
  });

  test("390 px — diagnóstico é recusado e nada grava; frase comum grava", async ({ browser }) => {
    const p = await entrar(browser, morador.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
    const cartao = p.getByTestId("por-que-na-cidade");
    await expect(cartao).toBeVisible({ timeout: 30_000 });
    await expect(cartao).not.toHaveAttribute("aria-busy", "true", { timeout: 20_000 });

    await cartao.getByTestId("cidade-frase").fill("Vim fazer quimioterapia no hospital");
    await cartao.getByTestId("cidade-salvar").click();
    await expect(cartao.getByRole("alert")).toContainText("diagnóstico", { timeout: 20_000 });
    await cartao.scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${SAIDA}/t1598-recusa-390.png`, fullPage: true });
    const antes = await adm().from("profiles").select("cidade_frase").eq("id", ids.morador).single();
    expect(antes.data?.cidade_frase ?? null).toBeNull();

    await cartao.getByTestId("cidade-frase").fill("Residência médica");
    await cartao.getByTestId("cidade-salvar").click();
    await expect.poll(async () => (await adm().from("profiles").select("cidade_frase").eq("id", ids.morador).single()).data?.cidade_frase, { timeout: 20_000 }).toBe("Residência médica");
    await p.context().close();
  });
});
