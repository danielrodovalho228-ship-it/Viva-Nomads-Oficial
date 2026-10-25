import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T372 — CONTA-A A7 (mockup perfil-07): Conta › Pagamentos.
 *   1. Proprietário: "Como você recebe (proprietário)" com a chave Pix mascarada no campo, botão de copiar e a nota
 *      "a Viva não fica com o seu dinheiro"; "Para suas estadias (morador)" com a linha do cartão e "Adicionar cartão"
 *      desligado (nenhuma cobrança). 1280 e 390, com prints.
 *   2. Morador: só o cartão "Para suas estadias (morador)"; nada de chave Pix.
 */
const SAIDA = "tests/laboratorio/saida";
const ROTA = "/dashboard/conta/pagamentos";

test.describe("T372 — CONTA-A A7: Pagamentos (perfil-07)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t372.${sufixo}@lab.vivanomads.test`, nome: "Ana Ribeiro", role: "owner" as const };
  const morador = { email: `inq.t372.${sufixo}@lab.vivanomads.test`, nome: "João Martins", role: "tenant" as const };
  const ids: string[] = [];
  async function como(browser: Browser, email: string, w: number): Promise<Page> {
    const p = await entrar(browser, email, senha);
    await p.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
    return p;
  }
  test.beforeAll(async () => {
    ids.push(await criarConta(dono, senha), await criarConta(morador, senha));
    // Papel de proprietário ativo = tem anúncio (como na t362).
    await criarImovelPronto(ids[0], `Apartamento t372 ${sufixo}`, { ativo: true, preco: 2900 });
    const { error } = await adm().from("recebimento_pix").insert({ user_id: ids[0], tipo: "email", chave: `ana.ribeiro.${sufixo}@lab.vivanomads.test` });
    if (error) throw error;
  });
  test.afterAll(async () => {
    await adm().from("recebimento_pix").delete().eq("user_id", ids[0]);
    await adm().from("properties").delete().eq("owner_id", ids[0]);
    await apagarContas(ids);
  });

  for (const w of [1280, 390]) {
    test(`1. a ${w} px: proprietário vê os dois cartões do desenho`, async ({ browser }) => {
      const p = await como(browser, dono.email, w);
      await p.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      await p.goto(ROTA, { waitUntil: "domcontentloaded" });
      await expect(p.locator("h1:visible")).toHaveText("Pagamentos");
      const recebe = p.getByTestId("conta-pix");
      await expect(recebe.getByRole("heading", { level: 2 })).toHaveText("Como você recebe (proprietário)", { timeout: 25_000 });
      await expect(recebe.getByTestId("conta-pix-salva")).toContainText("E-mail:", { timeout: 20_000 });
      await expect(recebe.getByTestId("conta-pix-salva")).not.toContainText(`ana.ribeiro.${sufixo}`);
      await expect(recebe.getByTestId("conta-pix-nota")).toHaveText("O pagamento do morador vai direto para você — a Viva não fica com o seu dinheiro.");
      await recebe.getByTestId("conta-pix-copiar").click();
      await expect(recebe.getByTestId("conta-pix-copiar")).toHaveAttribute("aria-label", "Chave Pix copiada");
      // Extra do E70: com o campo vazio, "Salvar chave" diz por que está travado.
      await recebe.getByTestId("conta-pix-trocar").click();
      await expect(recebe.getByTestId("conta-pix-salvar")).toBeDisabled();
      await expect(recebe.getByTestId("conta-pix-dica")).toHaveText("Preencha a chave para salvar.");
      await recebe.getByTestId("conta-pix-chave").fill("x");
      await expect(recebe.getByTestId("conta-pix-dica")).toHaveCount(0);
      const morar = p.getByTestId("conta-pag-morador");
      await expect(morar.getByRole("heading", { level: 2 })).toHaveText("Para suas estadias (morador)");
      // E70: sem botão morto — "em breve" + "Avise-me", que grava o aviso e vira a confirmação.
      await expect(morar.getByTestId("conta-cartao-adicionar")).toHaveCount(0);
      await expect(morar.getByTestId("conta-cartao-em-breve")).toHaveText("Pagamento com cartão: em breve.");
      await morar.getByTestId("conta-cartao-avise").click();
      await expect(morar.getByTestId("conta-cartao-avisado")).toContainText("Avisaremos você quando abrir.");
      // E70: o terceiro cartão, do parceiro (convite para quem não é parceiro), e as fotos do acervo carregando.
      const parceiro = p.getByTestId("conta-pag-parceiro");
      await expect(parceiro.getByRole("heading", { level: 2 })).toHaveText("Como você recebe (parceiro)");
      await expect(parceiro).toContainText("10% são a taxa de serviço da Viva");
      await expect(parceiro.getByTestId("conta-parceiro-botao")).toHaveText("Cadastrar meu serviço");
      await expect(parceiro.getByTestId("conta-parceiro-botao")).toHaveAttribute("href", "/dashboard/parceiro");
      const caixas: string[] = [];
      for (const c of ["conta-pix", "conta-pag-morador", "conta-pag-parceiro"]) {
        const img = p.getByTestId(c).getByTestId("cartao-foto").locator("img");
        await img.scrollIntoViewIfNeeded();
        await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0), { timeout: 15_000 }).toBe(true);
        const b = (await p.getByTestId(c).getByTestId("cartao-foto").boundingBox())!;
        caixas.push(`${Math.round(b.width)}x${Math.round(b.height)}`);
      }
      expect(new Set(caixas).size, caixas.join(",")).toBe(1);
      // E75: a tela termina na linha institucional.
      await expect(p.getByTestId("conta-fechamento")).toHaveText("Viva Nomads · Uberlândia, MG");
      await expect(p.locator("main")).not.toContainText(/comiss|reserva|hósped/i);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await p.screenshot({ path: `${SAIDA}/t372-pagamentos-${w}.png`, fullPage: true });
      await p.context().close();
    });
  }

  test("2. morador: só o cartão das estadias, sem chave Pix", async ({ browser }) => {
    const p = await como(browser, morador.email, 390);
    await p.goto(ROTA, { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("conta-pag-morador")).toBeVisible({ timeout: 25_000 });
    await expect(p.getByTestId("conta-pagamentos")).toContainText("A Viva não recebe esse valor");
    await expect(p.getByTestId("conta-pix")).toHaveCount(0);
    await p.context().close();
  });
});
