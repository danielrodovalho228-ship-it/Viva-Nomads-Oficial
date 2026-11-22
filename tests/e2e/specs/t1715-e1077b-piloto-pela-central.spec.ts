import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1715 — E1077-b1 (ORDEM-DUET-378/379): a lista do piloto da avaliação pela Central. Em /admin/avaliadores, seção
  "Contas no teste da avaliação", o admin (sessão AAL2 do laboratório):
   1. e-mail que não existe → "Conta não encontrada";
   2. adiciona uma conta de teste por e-mail, com nota → a linha aparece com nome, e-mail, "conta de teste" e a nota;
      e a linha da tabela vistoria_piloto existe;
   3. remove → a linha some da tela e da tabela.
  Não depende da lista estar vazia (outros specs usam a tabela). 1280 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `piloto.t1715.${sufixo}@lab.vivanomads.test`, nome: "Paula Piloto", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T1715 — E1077-b1: a lista do piloto pela Central", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
    const { error } = await adm().from("profiles").update({ is_teste: true }).eq("id", ids.conta);
    if (error) throw error;
  });
  test.afterAll(async () => {
    if (ids.conta) await adm().from("vistoria_piloto").delete().eq("user_id", ids.conta);
    await apagarContas([ids.conta].filter(Boolean));
  });

  test("não encontrada; adiciona a conta de teste com nota; remove", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
    const secao = page.getByTestId("avaliadores-piloto");
    await expect(secao).toBeVisible({ timeout: 30_000 });
    await expect(secao.getByRole("heading", { name: "Contas no teste da avaliação" })).toBeVisible();

    // 1. E-mail que não existe.
    const form = secao.getByTestId("piloto-adicionar");
    await form.getByTestId("piloto-email").fill(`ninguem.t1715.${sufixo}@lab.vivanomads.test`);
    await form.getByTestId("piloto-adicionar-botao").click();
    await expect(form).toContainText("Conta não encontrada", { timeout: 20_000 });

    // 2. Adiciona a conta de teste, com nota.
    await form.getByTestId("piloto-email").fill(conta.email.toUpperCase());
    await form.getByTestId("piloto-nota").fill("T1715 (laboratório)");
    await form.getByTestId("piloto-adicionar-botao").click();
    const linha = secao.getByTestId("piloto-conta").filter({ hasText: conta.email });
    await expect(linha).toBeVisible({ timeout: 20_000 });
    await expect(linha).toContainText(conta.nome);
    await expect(linha.getByTestId("piloto-conta-teste")).toHaveText("conta de teste");
    await expect(linha).toContainText("T1715 (laboratório)");
    const { data } = await adm().from("vistoria_piloto").select("user_id, nota").eq("user_id", ids.conta);
    expect(data).toEqual([{ user_id: ids.conta, nota: "T1715 (laboratório)" }]);

    // 3. Remove.
    await linha.getByTestId("piloto-remover").click();
    await expect(secao.getByTestId("piloto-conta").filter({ hasText: conta.email })).toHaveCount(0, { timeout: 20_000 });
    const { data: depois } = await adm().from("vistoria_piloto").select("user_id").eq("user_id", ids.conta);
    expect(depois).toEqual([]);
    await page.screenshot({ path: "tests/laboratorio/saida/t1715-piloto-1280.png", fullPage: false });
    await ctx.close();
  });
});
