import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T181 — Quantas pessoas vão morar (prompt 8), a 390 e 1280 px:
  1. a candidatura pergunta "Quantas pessoas vão morar?", com opções até a capacidade do imóvel, e grava
     leads.qtd_ocupantes;
  2. o proprietário vê "Para N pessoas" no cartão do candidato (ainda sem nome);
  3. depois do aceite, o Fechamento abre com o mesmo número de ocupantes.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.p181.${sufixo}@lab.vivanomads.test`, nome: "Dalila Pessoas Sobrenomeoculto", role: "owner" as const };
const inq = (l: number) => ({ email: `inq.p181.${l}.${sufixo}@lab.vivanomads.test`, nome: `Ivo${l} Pessoas Sobrenomeoculto`, role: "tenant" as const });
const ids: { dono?: string; imovel?: string; inq: Record<number, string> } = { inq: {} };

async function candidatar(page: Page, largura: number, pessoas: number) {
  await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "networkidle" });
  const cartao = page.locator("#cartao-preco");
  const seletor = cartao.getByTestId("candidatura-pessoas");
  await expect(seletor).toBeVisible({ timeout: 20_000 });
  // Opções só até a capacidade (4).
  await expect(seletor.locator("option")).toHaveCount(4);
  await seletor.selectOption(String(pessoas));
  await page.screenshot({ path: `${SAIDA}/t181-candidatura-${largura}.png`, fullPage: false });
  const botao = largura < 768 ? page.getByTestId("barra-fixa-imovel").getByRole("button", { name: "Enviar candidatura" }) : cartao.getByRole("button", { name: "Enviar candidatura" });
  await botao.click();
  const passo = page.getByTestId("solicitacao-passo");
  await expect(passo).toBeVisible();
  await passo.getByRole("button", { name: "Continuar" }).click();
  await passo.getByRole("button", { name: "Continuar" }).click();
  await passo.getByRole("button", { name: "Enviar candidatura" }).click();
  await expect(page.getByText("Candidatura enviada").filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 });
}

test.describe("T181 — quantas pessoas vão morar", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(150_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    for (const l of [390, 1280]) ids.inq[l] = await criarConta(inq(l), senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio Pessoas ${sufixo}`, { ativo: true });
    await adm().from("properties").update({ max_guests: 4 }).eq("id", ids.imovel);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono, ...Object.values(ids.inq)]);
  });

  for (const [largura, pessoas] of [[390, 3], [1280, 2]] as const) {
    test(`${largura}px — candidatura com ${pessoas} pessoas: grava, o dono vê e o Fechamento abre com ${pessoas}`, async ({ browser }) => {
      const p = await entrar(browser, inq(largura).email, senha);
      await p.setViewportSize({ width: largura, height: 900 });
      await candidatar(p, largura, pessoas);
      await p.context().close();
      const { data: lead } = await adm().from("leads").select("id, qtd_ocupantes").eq("tenant_id", ids.inq[largura]).eq("property_id", ids.imovel!).single();
      expect(lead!.qtd_ocupantes).toBe(pessoas);

      const d = await entrar(browser, dono.email, senha);
      await d.setViewportSize({ width: largura, height: 900 });
      await d.goto("/dashboard/leads", { waitUntil: "networkidle" });
      await expect(d.locator("main")).toContainText(`Para ${pessoas} pessoas`, { timeout: 20_000 });
      await expect(d.locator("main")).not.toContainText("Sobrenomeoculto");
      await d.screenshot({ path: `${SAIDA}/t181-interessados-${largura}.png`, fullPage: true });

      // Aceite (o que o servidor grava) → Fechamento abre com o número da candidatura.
      await adm().from("leads").update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_commission_rate: 0.12, accepted_plan: "free" }).eq("id", lead!.id);
      await d.goto(`/dashboard/fechamento?c=${lead!.id}`, { waitUntil: "networkidle" });
      await expect(d.getByLabel("Número de ocupantes")).toHaveValue(String(pessoas), { timeout: 20_000 });
      await d.screenshot({ path: `${SAIDA}/t181-fechamento-${largura}.png`, fullPage: false });
      expect(await d.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await d.context().close();
    });
  }
});
