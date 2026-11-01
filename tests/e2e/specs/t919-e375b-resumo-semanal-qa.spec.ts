import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T919 — E375-B (#1992, Pista B): Admin → Dados de teste → "Gerar resumo semanal agora" gera o resumo semanal de
  recomendações SÓ para as contas de teste (a chave RESUMO_SEMANAL_ATIVO segue desligada; o e-mail vai para a caixa de
  teste). Na tela de verdade, com a sessão de admin (2 etapas do laboratório), a 1280 px: o botão pede confirmação em dois
  passos ("Confirmar e gerar" / "Cancelar"); Cancelar não gera; Confirmar mostra o resultado "N de M conta(s) de teste
  receberam o resumo … Veja na aba E-mails." (sem erro). Para a prova não depender da massa (o 1º lab-crítico deu
  "0 de 0": nenhuma conta de teste elegível), a spec cria uma moradora de teste com busca salva e alerta ligado (a regra
  de destinatarios(): pedido ativo ou busca com alerta) — então M ≥ 1; a conta e a busca são apagadas no fim. Não toca
  contas reais nem a chave.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
let moradora = "";

test.describe("T919 — E375-B (#1992): resumo semanal de teste pelo botão do QA", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (sessão de admin com 2 etapas).");
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    moradora = await criarConta({ email: `mora.t919.${sufixo}@lab.vivanomads.test`, nome: "Mara Resumo", role: "tenant" }, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", moradora);
    const { error } = await adm().from("buscas_salvas").insert({ usuario_id: moradora, parametros: "local=Uberl%C3%A2ndia", resumo: "Uberlândia", alerta_ativo: true });
    if (error) throw error;
  });
  test.afterAll(async () => {
    if (!moradora) return;
    await adm().from("buscas_salvas").delete().eq("usuario_id", moradora);
    await adm().from("emails_teste").delete().eq("usuario_id", moradora);
    await apagarContas([moradora]);
  });

  test("confirmação em dois passos; gera só para contas de teste e diz o resultado", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto("/admin/dados-de-teste", { waitUntil: "domcontentloaded" });
    const bloco = page.getByTestId("gerar-resumo-semanal");
    await expect(bloco).toBeVisible({ timeout: 30_000 });
    await expect(bloco).toContainText("só para as contas de teste");

    // Cancelar não gera nada.
    await page.getByTestId("gerar-resumo-semanal-botao").click();
    await expect(page.getByTestId("gerar-resumo-confirmacao")).toBeVisible();
    await page.getByTestId("gerar-resumo-confirmacao").getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByTestId("gerar-resumo-confirmacao")).toHaveCount(0);
    await expect(page.getByTestId("gerar-resumo-resultado")).toHaveCount(0);

    // Confirmar gera e diz o resultado.
    await page.getByTestId("gerar-resumo-semanal-botao").click();
    await page.getByTestId("gerar-resumo-confirmacao").getByRole("button", { name: "Confirmar e gerar" }).click();
    const res = page.getByTestId("gerar-resumo-resultado");
    await expect(res).toBeVisible({ timeout: 60_000 });
    const texto = (await res.innerText()).replace(/\s+/g, " ");
    console.log(`t919|resultado|${texto}`);
    await expect(res).toHaveAttribute("role", "status");
    const m = /^(\d+) de (\d+) conta\(s\) de teste receberam o resumo.*Veja na aba E-mails\.$/.exec(texto);
    expect(m, texto).not.toBeNull();
    expect(Number(m![2]), "a moradora de teste com busca e alerta entrou na conta").toBeGreaterThanOrEqual(1);
    await page.screenshot({ path: `${SAIDA}/t919-resumo-semanal-1280.png` });
    await ctx.close();
  });
});
