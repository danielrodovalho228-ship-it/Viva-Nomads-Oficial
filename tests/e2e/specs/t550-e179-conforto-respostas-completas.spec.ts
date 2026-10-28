import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T550 — E179 (#1402), guarda permanente da Pista C: a spec da Pista A responde "micro-ondas", "ventilação sem ar" e
  "máquina no prédio". Aqui, as outras três respostas que também tiram itens de "Para subir a Conforto": cozinha
  COMPLETA (está acima do micro-ondas na escala), AR nos quartos (inclui o principal) e máquina NO IMÓVEL — os três
  itens saem da lista; o que as respostas não mostram (a mesa de jantar) continua. A 1280 e 390 px.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t550.${sufixo}@lab.vivanomads.test`, nome: "Cora Completa", role: "owner" as const };
const ids: Record<string, string> = {};

/** As 5 telas: cozinha completa, ar nos quartos, máquina no imóvel. */
async function responder(p: Page) {
  const continuar = () => p.getByTestId("qualificacao-continuar").click();
  await expect(p.getByTestId("qualificacao-progresso")).toHaveText("Qualificação · 1 de 5", { timeout: 30_000 });
  await p.getByTestId("qualificacao-opcao-cama-sim").click();
  await p.getByTestId("qualificacao-opcao-apoio-sim").click();
  await p.getByTestId("qualificacao-opcao-ventilacao-ar").click();
  await continuar();
  await p.getByTestId("qualificacao-opcao-cozinha-completa").click();
  await p.getByTestId("qualificacao-opcao-roupa-todos").click();
  await continuar();
  await p.getByTestId("qualificacao-opcao-agua-sim").click();
  await p.getByTestId("qualificacao-opcao-lavanderia-imovel").click();
  await continuar();
  for (const t of ["luz", "fechadura", "limpa", "mobilia"]) await p.getByTestId(`qualificacao-opcao-${t}-sim`).click();
  await continuar();
  await p.getByTestId("qualificacao-mbps").fill("300");
  await continuar();
}

test.describe("T550 — E179: cozinha completa, ar e máquina no imóvel saem de 'Para subir a Conforto'", () => {
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
    test(`${largura} px — cozinha completa, ar nos quartos e máquina no imóvel: os três saem da lista`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
      const comecarOutro = p.getByRole("button", { name: "Começar outro" });
      await expect(p.getByTestId("qualificacao").or(comecarOutro).first()).toBeVisible({ timeout: 30_000 });
      if (await comecarOutro.isVisible()) await comecarOutro.click();
      await responder(p);
      const lista = p.getByTestId("qualificacao-para-subir");
      await expect(lista).toBeVisible({ timeout: 20_000 });
      console.log(`t550 ${largura}: para subir = ${JSON.stringify((await lista.innerText()).split("\n").filter(Boolean))}`);
      await expect(lista).not.toContainText("Micro-ondas");
      await expect(lista).not.toContainText("Ar-condicionado no quarto principal");
      await expect(lista).not.toContainText("Máquina de lavar no imóvel");
      await expect(lista).toContainText("Mesa de jantar para todos");
      await lista.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t550-para-subir-${largura}.png` });
      await p.context().close();
    });
  }
});
