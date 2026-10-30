import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T687 — E259 (2) (prova de publicação do QA, 30/10): a entrada do imóvel é UMA pergunta só. 1280 e 390, com prints.
   1. Passo 5 não pergunta mais "Tipo de acesso ao imóvel"; o Passo 6 pergunta "Como se entra no imóvel?" e, com a
      fechadura com código, mostra "A senha é trocada antes de cada nova estadia".
   2. A página pública lê a resposta do Passo 6: "Acesso: Porteiro ou recepção" — mesmo com um tipo_acesso antigo
      diferente gravado ("chave").
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t687.${sufixo}@lab.vivanomads.test`, nome: "Ana Entrada", role: "owner" as const };
const ids: { dono?: string; rascunho?: string; ativo?: string } = {};

test.describe("T687 — E259 (2): a entrada do imóvel é uma pergunta só", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    ids.rascunho = await prepararRascunho(ids.dono, `Studio Entrada ${sufixo}`, { street: "Rua Santos Dumont", numero: "100", neighborhood: "Centro", uf: "MG" });
    ids.ativo = await criarImovelPronto(ids.dono, `Apartamento Porteiro ${sufixo}`, { ativo: true });
    // Gravado ANTES de qualquer visita (a página pública guarda cache): Passo 6 = porteiro; coluna antiga = chave.
    const { error } = await adm().from("properties").update({ tipo_entrada: "porteiro", tipo_acesso: "chave", sem_cameras_interior: true }).eq("id", ids.ativo);
    if (error) throw error;
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [1280, 390] as const) {
    test(`1. ${w} px — Passo 5 sem "Tipo de acesso"; Passo 6 com a pergunta e a senha trocada na fechadura`, async ({ browser }) => {
      const p = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho!, "comodidades", w);
      await expect(p.getByTestId("privacidade-campos")).toBeVisible({ timeout: 30_000 });
      await expect(p.getByTestId("tipo-acesso")).toHaveCount(0);
      await expect(p.getByText("Tipo de acesso ao imóvel")).toHaveCount(0);
      await p.context().close();

      const q = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho!, "regras", w);
      await expect(q.getByRole("radiogroup", { name: "Como se entra no imóvel?" })).toBeVisible({ timeout: 30_000 });
      await expect(q.getByTestId("senha-trocada")).toHaveCount(0);
      await q.getByTestId("tipo-entrada-fechadura_com_codigo").click();
      await expect(q.getByTestId("senha-trocada")).toBeVisible();
      await q.getByTestId("senha-trocada").click();
      await expect(q.getByTestId("senha-trocada")).toHaveAttribute("aria-checked", "true");
      await q.getByTestId("tipo-entrada-porteiro").click();
      await expect(q.getByTestId("senha-trocada")).toHaveCount(0);
      await q.getByTestId("chegada-e-pedido").scrollIntoViewIfNeeded();
      await q.screenshot({ path: `${SAIDA}/t687-passo6-${w}.png` });
      await q.context().close();
    });

    test(`2. ${w} px — a página pública lê o Passo 6`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 1280 ? 900 : 844 } });
      const p = await ctx.newPage();
      await p.goto(`/imoveis/${ids.ativo}`, { waitUntil: "domcontentloaded" });
      const bloco = p.getByTestId("bloco-privacidade");
      await expect(bloco).toBeVisible({ timeout: 30_000 });
      await expect(bloco).toContainText("Acesso: Porteiro ou recepção");
      await expect(bloco).not.toContainText("Acesso: Chave");
      await bloco.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t687-publico-${w}.png` });
      await ctx.close();
    });
  }
});
