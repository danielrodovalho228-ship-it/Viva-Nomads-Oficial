// Portão pós-#1506/#1507 (Pista C, 29/10): E180 (entrada do anúncio novo, cópia local) e E222-B (renovar = aditivo); roda no lab-crítico deste PR.
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T488 — E179: no Resultado da Qualificação, "Para subir a Conforto" não pede o que as respostas já mostram que o imóvel
  tem (ex.: Micro-ondas quando a cozinha tem micro-ondas). O que não foi respondido continua na lista.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t488.${sufixo}@lab.vivanomads.test`, nome: "Clara Conforto", role: "owner" as const };
const ids: Record<string, string> = {};

/** As 5 telas: cozinha com micro-ondas, ventilação sem ar, máquina no prédio. */
async function responder(p: Page) {
  const continuar = () => p.getByTestId("qualificacao-continuar").click();
  await expect(p.getByTestId("qualificacao-progresso")).toHaveText("Qualificação · 1 de 5", { timeout: 30_000 });
  await p.getByTestId("qualificacao-opcao-cama-sim").click();
  await p.getByTestId("qualificacao-opcao-apoio-sim").click();
  await p.getByTestId("qualificacao-opcao-ventilacao-ventilacao").click();
  await continuar();
  await p.getByTestId("qualificacao-opcao-cozinha-micro").click();
  await p.getByTestId("qualificacao-opcao-roupa-todos").click();
  await continuar();
  await p.getByTestId("qualificacao-opcao-agua-sim").click();
  await p.getByTestId("qualificacao-opcao-lavanderia-predio").click();
  await continuar();
  for (const t of ["luz", "fechadura", "limpa", "mobilia"]) await p.getByTestId(`qualificacao-opcao-${t}-sim`).click();
  await continuar();
  await p.getByTestId("qualificacao-mbps").fill("300");
  await continuar();
}

test.describe("T488 — E179: 'Para subir a Conforto' sem o que o imóvel já tem", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — cozinha com micro-ondas: o Micro-ondas sai da lista; ar e máquina continuam`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
      const comecarOutro = p.getByRole("button", { name: "Começar outro" });
      await expect(p.getByTestId("qualificacao").or(comecarOutro).first()).toBeVisible({ timeout: 30_000 });
      if (await comecarOutro.isVisible()) await comecarOutro.click();
      await responder(p);
      const lista = p.getByTestId("qualificacao-para-subir");
      await expect(lista).toBeVisible({ timeout: 20_000 });
      await expect(lista).not.toContainText("Micro-ondas");
      await expect(lista).toContainText("Mesa de jantar para todos");
      await expect(lista).toContainText("Ar-condicionado no quarto principal");
      await expect(lista).toContainText("Máquina de lavar no imóvel");
      await lista.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t488-para-subir-${largura}.png` });
      await p.context().close();
    });
  }
});
