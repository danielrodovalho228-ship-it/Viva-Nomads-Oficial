import { test, expect } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T864 — E425 (ciclo): parceria APROVADA ativa a conta pelo PAINEL, sem depender do link do e-mail (o link já é a t236).
   1. Conta Papéis mostra "Parceria aprovada — ativar sua página" (E576) e leva ao painel.
   2. No painel, "Ativar minha página": o pedido vira 'ativada', a página nasce (rascunho, ligada a ESTA conta) e o painel
      completo abre (?ativada=1). Um 2º clique/visita não cria outra página.
   3. Outra conta (e-mail diferente, sem pedido) não vê o botão nem ativa nada.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const parceira = { email: `parc.t864.${sufixo}@lab.vivanomads.test`, nome: "Paula Painel Sobrenome", role: "tenant" as const };
const outra = { email: `outra.t864.${sufixo}@lab.vivanomads.test`, nome: "Olga Outra Sobrenome", role: "tenant" as const };
const ids: { parceira?: string; outra?: string; sol?: string } = {};

test.describe("T864 — E425: parceiro aprovado ativa pelo painel", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    ids.parceira = await criarConta(parceira, senha);
    ids.outra = await criarConta(outra, senha);
    const { data, error } = await adm()
      .from("parceiro_solicitacoes")
      .insert({
        user_id: ids.parceira,
        email: parceira.email,
        nome: "Paula Painel Fotografia",
        tipo_pessoa: "pf",
        documento: "52998224725",
        categorias: ["fotografia"],
        cidades: ["Uberlândia"],
        status: "aprovada",
        origem: "conta",
        decidido_em: new Date().toISOString(),
        token_ativacao_hash: createHash("sha256").update(randomBytes(32)).digest("hex"),
        token_expira_em: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.sol = data.id as string;
  });

  test.afterAll(async () => {
    if (ids.parceira) await adm().from("parceiros").delete().eq("user_id", ids.parceira);
    if (ids.sol) await adm().from("parceiro_solicitacoes").delete().eq("id", ids.sol);
    await apagarContas([ids.parceira, ids.outra]);
  });

  test("1–2. Papéis aponta a ativação; o botão do painel ativa (uma página só, desta conta)", async ({ browser }) => {
    const page = await entrar(browser, parceira.email, senha);
    await page.goto("/dashboard/conta/papeis", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("papel-parceiro-botao")).toHaveText("Parceria aprovada — ativar sua página", { timeout: 20_000 });
    await page.getByTestId("papel-parceiro-botao").click();
    await page.waitForURL(/\/dashboard\/parceiro$/, { timeout: 20_000 });
    await expect(page.getByTestId("parceiro-aprovado")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("parceiro-ativar-painel").click();
    await page.waitForURL(/\/dashboard\/parceiro\?ativada=1$/, { timeout: 30_000 });
    await expect(page.getByTestId("parceiro-ativada")).toBeVisible({ timeout: 20_000 });

    const { data: sol } = await adm().from("parceiro_solicitacoes").select("status, user_id").eq("id", ids.sol!).single();
    expect(sol!.status).toBe("ativada");
    expect(sol!.user_id).toBe(ids.parceira);
    const { data: paginas } = await adm().from("parceiros").select("status, solicitacao_id").eq("user_id", ids.parceira!);
    expect(paginas ?? []).toHaveLength(1);
    expect(paginas![0].status).toBe("rascunho");
    expect(paginas![0].solicitacao_id).toBe(ids.sol);

    // Voltar ao painel não cria outra página nem mostra o botão de novo.
    await page.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("parceiro-ativar-painel")).toHaveCount(0);
    expect(((await adm().from("parceiros").select("id").eq("user_id", ids.parceira!)).data ?? []).length).toBe(1);
    await page.context().close();
  });

  test("3. outra conta não vê o botão nem ativa nada", async ({ browser }) => {
    const page = await entrar(browser, outra.email, senha);
    await page.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
    await page.locator("main").first().waitFor();
    await expect(page.getByTestId("parceiro-ativar-painel")).toHaveCount(0);
    expect(((await adm().from("parceiros").select("id").eq("user_id", ids.outra!)).data ?? []).length).toBe(0);
    await page.context().close();
  });
});
