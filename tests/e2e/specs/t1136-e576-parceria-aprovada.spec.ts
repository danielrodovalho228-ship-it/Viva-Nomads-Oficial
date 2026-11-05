import { test, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { BOTAO_PARCERIA_APROVADA, TEXTO_PARCERIA_APROVADA } from "../../../src/lib/parceiros/situacao-conta";

/**
 * T1136 — E576 (#2554, 05/11): com a parceria APROVADA e a página ainda não ativada, Conta › Papéis e o Início dizem
 * isso e levam à ativação (/dashboard/parceiro). Antes, Papéis só oferecia "Cadastrar meu serviço" (como se nunca tivesse
 * pedido) e o Início não dizia nada. Entrou com teste de unidade; aqui é a tela, 390 e 1280, de uma conta com o pedido
 * de parceria aprovado (token de ativação gerado, como a aprovação do admin grava) e nenhuma página de parceiro:
 *   1. Início: o aviso inicio-parceria-aprovada com o texto e o botão "Parceria aprovada — ativar sua página";
 *   2. Conta › Papéis: o cartão do parceiro com o mesmo texto (papel-parceiro-aprovada) e o botão apontando para
 *      /dashboard/parceiro.
 * L-98 (achado desta spec, 05/11): a 390, Conta › Papéis estoura 87 px com o botão novo, que não quebra a linha — fica
 * como test.fail ligado ao L-98 (Pista B) no caso de rolagem a 390; a 1280 e o Início seguem cobrados.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const pessoa = { email: `aprovada.t1136.${sufixo}@lab.vivanomads.test`, nome: "Nara Aprovada", role: "tenant" as const };
const ids: Record<string, string> = {};
const sobra = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe("T1136 — E576: parceria aprovada sem página aparece em Papéis e no Início, com o caminho para ativar", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.pessoa = await criarConta(pessoa, senha);
    const { error } = await adm().from("parceiro_solicitacoes").insert({
      user_id: ids.pessoa,
      email: pessoa.email,
      nome: pessoa.nome,
      tipo_pessoa: "pf",
      documento: cpfAleatorio(),
      categorias: ["fotografia"],
      cidades: ["Uberlândia"],
      portfolio_url: "https://exemplo.lab.vivanomads.test",
      status: "aprovada",
      token_ativacao_hash: randomBytes(32).toString("hex"),
      token_expira_em: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      decidido_em: new Date().toISOString(),
      origem: "site",
    });
    expect(error, error?.message).toBeNull();
    const { data: pagina } = await adm().from("parceiros").select("id").eq("user_id", ids.pessoa).maybeSingle();
    expect(pagina, "ainda sem página de parceiro").toBeNull();
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("parceiro_solicitacoes").delete().eq("user_id", ids.pessoa ?? "");
    await apagarContas([ids.pessoa]);
  });

  for (const w of [390, 1280] as const) {
    test(`Início e Papéis: "parceria aprovada" e o botão para ativar (${w})`, async ({ browser }) => {
      const p = await entrar(browser, pessoa.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      try {
        // 1. Início.
        await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
        const aviso = p.getByTestId("inicio-parceria-aprovada");
        await expect(aviso).toBeVisible({ timeout: 30_000 });
        await expect(aviso).toContainText(TEXTO_PARCERIA_APROVADA);
        await expect(aviso.getByRole("link", { name: BOTAO_PARCERIA_APROVADA })).toHaveAttribute("href", "/dashboard/parceiro");
        expect(await sobra(p), "Início sem rolagem lateral").toBeLessThanOrEqual(1);

        // 2. Conta › Papéis.
        await p.goto("/dashboard/conta/papeis", { waitUntil: "domcontentloaded" });
        await expect(p.getByTestId("papel-parceiro-aprovada")).toHaveText(TEXTO_PARCERIA_APROVADA, { timeout: 30_000 });
        const botao = p.getByTestId("papel-parceiro-botao");
        await expect(botao).toHaveText(BOTAO_PARCERIA_APROVADA);
        await expect(botao).toHaveAttribute("href", "/dashboard/parceiro");
      } finally {
        await p.context().close();
      }
    });

    test(`Papéis sem rolagem lateral com o botão da parceria aprovada (${w})`, async ({ browser }) => {
      // L-98 (achado desta spec, 05/11): a 390 o botão "Parceria aprovada — ativar sua página" (ButtonLink size lg,
      // whitespace-nowrap + shrink-0) não quebra e empurra a tela 87 px para a direita. A 1280 cabe.
      test.fail(w === 390, "L-98: a 390 o botão da parceria aprovada em Conta › Papéis não quebra a linha (whitespace-nowrap) e estoura 87 px");
      const p = await entrar(browser, pessoa.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      try {
        await p.goto("/dashboard/conta/papeis", { waitUntil: "domcontentloaded" });
        await expect(p.getByTestId("papel-parceiro-botao")).toHaveText(BOTAO_PARCERIA_APROVADA, { timeout: 30_000 });
        const px = await sobra(p);
        test.info().annotations.push({ type: "sobra", description: `${px}px` });
        expect(px, "Papéis sem rolagem lateral").toBeLessThanOrEqual(1);
      } finally {
        await p.context().close();
      }
    });
  }
});
