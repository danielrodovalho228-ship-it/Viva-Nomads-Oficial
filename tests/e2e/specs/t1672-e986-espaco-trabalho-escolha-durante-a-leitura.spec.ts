import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1672 — E986: Espaço de trabalho (Perfil). A escolha feita ENQUANTO a tela ainda lê o que está gravado era apagada
  quando a leitura chegava, e o "Salvar" gravava vazio com "Salvo." na tela (o t590 a 1280 px falhou 3 de 3 vezes por
  isso). Aqui a leitura é segurada de propósito, para a escolha acontecer sempre durante o carregamento:
   • nada gravado: a escolha fica na tela depois da leitura, grava e volta ao recarregar;
   • já havia resposta nas duas perguntas: o campo mexido fica com a escolha nova e o outro recebe o que estava gravado.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const lia = { email: `lia.t1672.${sufixo}@lab.vivanomads.test`, nome: "Lia Leitura", role: "tenant" as const };
const ids: Record<string, string> = {};

/** Segura as chamadas ao servidor feitas pela tela do Perfil (a leitura do que está gravado é uma delas). */
async function segurarLeituras(p: Page, ms: number) {
  await p.route("**/dashboard/conta/perfil*", async (rota) => {
    const pedido = rota.request();
    if (pedido.method() === "POST" && pedido.headers()["next-action"]) await new Promise((r) => setTimeout(r, ms));
    await rota.continue();
  });
}

const gravado = async () => (await adm().from("profiles").select("espaco_trabalho_oferta, espaco_trabalho_procura").eq("id", ids.lia).single()).data;

test.describe("T1672 — E986: a escolha feita durante a leitura não é apagada", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.lia = await criarConta(lia, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.lia]);
  });

  test("nada gravado: a escolha feita durante a leitura fica, grava e volta ao recarregar", async ({ browser }) => {
    const p = await entrar(browser, lia.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await segurarLeituras(p, 2_500);
    await p.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
    const cartao = p.getByTestId("espaco-trabalho");
    await expect(cartao).toBeVisible({ timeout: 30_000 });
    await expect(cartao, "a tela ainda está lendo").toHaveAttribute("aria-busy", "true");
    await p.getByTestId("espaco-procura").selectOption("coworking");
    await expect(cartao, "a escolha foi feita durante a leitura").toHaveAttribute("aria-busy", "true");
    await expect(cartao).toHaveAttribute("aria-busy", "false", { timeout: 90_000 });
    // O defeito: aqui o campo voltava para "Prefiro não responder".
    await expect(p.getByTestId("espaco-procura")).toHaveValue("coworking");
    await p.getByTestId("espaco-salvar").click();
    await expect(cartao.getByRole("status")).toHaveText("Salvo.", { timeout: 60_000 });
    expect(await gravado()).toEqual({ espaco_trabalho_oferta: null, espaco_trabalho_procura: "coworking" });
    await p.unroute("**/dashboard/conta/perfil*");
    await p.reload({ waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("espaco-procura")).toHaveValue("coworking", { timeout: 30_000 });
    await expect(p.getByTestId("espaco-oferta")).toHaveValue("");
    await p.context().close();
  });

  test("com resposta gravada nas duas: o campo mexido fica com a escolha nova; o outro recebe o que estava gravado", async ({ browser }) => {
    await adm().from("profiles").update({ espaco_trabalho_oferta: "consultorio", espaco_trabalho_procura: "coworking" }).eq("id", ids.lia);
    const p = await entrar(browser, lia.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await segurarLeituras(p, 2_500);
    await p.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
    const cartao = p.getByTestId("espaco-trabalho");
    await expect(cartao).toBeVisible({ timeout: 30_000 });
    await expect(cartao).toHaveAttribute("aria-busy", "true");
    await p.getByTestId("espaco-procura").selectOption("nao");
    await expect(cartao).toHaveAttribute("aria-busy", "true");
    await expect(cartao).toHaveAttribute("aria-busy", "false", { timeout: 90_000 });
    await expect(p.getByTestId("espaco-procura"), "a escolha nova fica").toHaveValue("nao");
    await expect(p.getByTestId("espaco-oferta"), "o campo em que a pessoa não mexeu recebe o que estava gravado").toHaveValue("consultorio");
    await p.getByTestId("espaco-salvar").click();
    await expect(cartao.getByRole("status")).toHaveText("Salvo.", { timeout: 60_000 });
    expect(await gravado()).toEqual({ espaco_trabalho_oferta: "consultorio", espaco_trabalho_procura: "nao" });
    await p.context().close();
  });
});
