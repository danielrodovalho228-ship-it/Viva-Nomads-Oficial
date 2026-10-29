// Portão pós-#1500 (Pista C, 29/10): o E193 (#1496) trocou listas e caixas por pílulas e cartões no assistente e no editor; roda no lab-crítico deste PR.
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";

/*
  T564 — E193 (print do Daniel, 25/10): a qualificação usa UM padrão de controle — o cartão grande tocável. Nenhum
  interruptor (switch) nem chip nas 5 telas: sim/não ("Sim, tem" / "Não tem"), as opções com ícone e o "Não tem
  internet" são o mesmo cartão (data-cartao-qualificacao), no computador e no celular. No Passo 5, as comodidades
  são várias escolhas, então pílulas (E193 da lista-master de 29/10: várias escolhas = pílula; uma escolha = cartão).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t564.${sufixo}@lab.vivanomads.test`, nome: "Cris Cartões", role: "owner" as const };
// O Passo 5 usa outra conta: o rascunho dele faria a qualificação abrir com "Começar outro / Continuar".
const dono5 = { email: `dono5.t564.${sufixo}@lab.vivanomads.test`, nome: "Cris Passo Cinco", role: "owner" as const };
const ids: Record<string, string> = {};

async function semInterruptor(p: Page) {
  const q = p.getByTestId("qualificacao");
  await expect(q.getByRole("switch")).toHaveCount(0);
  await expect(q.locator('[role="switch"], input[type="checkbox"]')).toHaveCount(0);
  const botoes = q.locator("button[aria-pressed]");
  const cartoes = q.locator("button[data-cartao-qualificacao]");
  expect(await botoes.count()).toBeGreaterThan(0);
  expect(await cartoes.count()).toBe(await botoes.count());
}

test.describe("T564 — E193: um padrão só de cartões na qualificação", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    ids.dono5 = await criarConta(dono5, senha);
    ids.rascunho = await criarImovelPronto(ids.dono5, `Imóvel cartões ${sufixo}`);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono, ids.dono5]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — as 5 telas só com cartões grandes`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
      const comecarOutro = p.getByRole("button", { name: "Começar outro" });
      await expect(p.getByTestId("qualificacao").or(comecarOutro).first()).toBeVisible({ timeout: 30_000 });
      if (await comecarOutro.isVisible()) await comecarOutro.click();
      for (let n = 1; n <= 5; n++) {
        await expect(p.getByTestId("qualificacao-progresso")).toContainText(`${n} de 5`, { timeout: 20_000 });
        await semInterruptor(p);
        if (n === 1) {
          // Sim/não no mesmo cartão das opções: tocar marca, o par troca.
          await p.getByTestId("qualificacao-opcao-cama-sim").click();
          await expect(p.getByTestId("qualificacao-opcao-cama-sim")).toHaveAttribute("aria-pressed", "true");
          await p.getByTestId("qualificacao-opcao-cama-nao").click();
          await expect(p.getByTestId("qualificacao-opcao-cama-sim")).toHaveAttribute("aria-pressed", "false");
          await expect(p.getByTestId("qualificacao-opcao-cama-nao")).toHaveAttribute("aria-pressed", "true");
        }
        if (n === 5) await expect(p.getByTestId("qualificacao-sem-internet")).toHaveAttribute("data-cartao-qualificacao", "true");
        await p.screenshot({ path: `${SAIDA}/t564-tela${n}-${largura}.png`, fullPage: true });
        await p.getByTestId("qualificacao-continuar").click();
      }
      await p.context().close();
    });
  }

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — Passo 5: comodidades em pílulas (E193, 29/10: várias escolhas = pílula)`, async ({ browser }) => {
      const p = await entrar(browser, dono5.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=comodidades`, { waitUntil: "domcontentloaded" });
      await noPasso(p, "comodidades", 30_000);
      const etapa = p.getByTestId("etapa-encontramos");
      const itens = etapa.locator("button[data-comodidade]");
      expect(await itens.count()).toBeGreaterThan(0);
      expect(await etapa.locator("button[data-comodidade][data-pilula-assistente]").count()).toBe(await itens.count());
      const primeiro = itens.first();
      const antes = await primeiro.getAttribute("aria-pressed");
      await primeiro.click();
      await expect(primeiro).toHaveAttribute("aria-pressed", antes === "true" ? "false" : "true");
      // Pílula: cantos totalmente arredondados (raio ≥ metade da altura).
      const forma = await primeiro.evaluate((el) => ({ raio: parseFloat(getComputedStyle(el).borderTopLeftRadius), altura: el.getBoundingClientRect().height }));
      expect(forma.raio).toBeGreaterThanOrEqual(forma.altura / 2 - 1);
      await primeiro.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t564-passo5-${largura}.png` });
      await p.context().close();
    });
  }
});
