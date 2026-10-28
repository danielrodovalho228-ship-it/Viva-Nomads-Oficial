import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T590 — ordem 286312f8 (P3): duas perguntas opcionais sobre espaço de trabalho no Perfil (uma conta só: morador e dono
  veem as duas). A resposta grava, volta depois de recarregar, e a contagem do /admin (Interesse em espaço de trabalho)
  conta a pessoa. Conta de teste fica à parte.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const lucas = { email: `lucas.t590.${sufixo}@lab.vivanomads.test`, nome: "Lucas Morador", role: "tenant" as const };
const dono = { email: `dono.t590.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T590 — interesse em espaço de trabalho", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.lucas = await criarConta(lucas, senha);
    ids.dono = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.lucas, ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — morador responde, salva e a resposta volta ao recarregar`, async ({ browser }) => {
      const p = await entrar(browser, lucas.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto(largura === 390 ? "/dashboard/conta/perfil" : "/dashboard/conta", { waitUntil: "domcontentloaded" });
      const cartao = p.getByTestId("espaco-trabalho");
      await expect(cartao).toBeVisible({ timeout: 30_000 });
      await p.getByTestId("espaco-procura").selectOption("coworking");
      await p.getByTestId("espaco-salvar").click();
      await expect(cartao.getByRole("status")).toHaveText("Salvo.", { timeout: 15_000 });
      await p.reload({ waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("espaco-procura")).toHaveValue("coworking", { timeout: 30_000 });
      await expect(p.getByTestId("espaco-oferta")).toHaveValue("");
      await cartao.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t590-espaco-${largura}.png`, fullPage: true });
      await p.context().close();
    });
  }

  test("1280 px — dono também vê e grava a pergunta da sala/consultório", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("espaco-trabalho")).toBeVisible({ timeout: 30_000 });
    await p.getByTestId("espaco-oferta").selectOption("consultorio");
    await p.getByTestId("espaco-salvar").click();
    await expect(p.getByTestId("espaco-trabalho").getByRole("status")).toHaveText("Salvo.", { timeout: 15_000 });
    const { data } = await adm().from("profiles").select("espaco_trabalho_oferta, espaco_trabalho_procura").eq("id", ids.dono).single();
    expect(data).toEqual({ espaco_trabalho_oferta: "consultorio", espaco_trabalho_procura: null });
    await p.context().close();
  });
});
