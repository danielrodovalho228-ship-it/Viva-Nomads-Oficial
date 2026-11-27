import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T854 — E569 (resíduo do E541): o "Responder pela plataforma" fica visível no cartão do interessado e abre a conversa
  DAQUELE morador naquele imóvel, mesmo sem mensagem ainda; o requisito do dono (documento) aparece ANTES do clique.
   1. dono sem documento: o aviso com "Informar meu documento" está na tela sem clicar em nada;
   2. candidatura sem mensagem: o botão está no cartão e abre a conversa certa (sem "não está na sua lista").
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const contas: (string | undefined)[] = [];
const ids = { dono: "", morador: "", imovel: "", lead: "" };
let emailDono = "";

test.describe("T854 — Interessados: responder pela plataforma", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas de teste).");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    const tag = `${randomBytes(3).toString("hex")}.${sufixo}`;
    emailDono = `dono.t854.${tag}@lab.vivanomads.test`;
    // Dono SEM documento (comCpf = false): o aviso tem de aparecer antes de qualquer clique.
    ids.dono = await criarConta({ email: emailDono, nome: "Dona T854 Sobrenome", role: "owner" }, senha, false);
    ids.morador = await criarConta({ email: `mor.t854.${tag}@lab.vivanomads.test`, nome: "Mário T854 Sobrenome", role: "tenant" }, senha);
    contas.push(ids.dono, ids.morador);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.morador]);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio T854 ${tag}`, { ativo: true });
    ids.lead = await criarLead(ids.dono, ids.morador, ids.imovel); // sem mensagem na conversa
  });

  test.afterAll(async () => {
    await apagarContas(contas);
  });

  test("1 e 2. aviso do documento antes do clique; o botão abre a conversa daquele morador naquele imóvel", async ({ browser }) => {
    const page = await entrar(browser, emailDono, senha);
    await page.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("pendencia-dono-aceite")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("pendencia-dono-link")).toHaveAttribute("href", "/dashboard/conta/dados#documento");
    const cartao = page.locator(`#candidato-${ids.lead}`);
    const responder = cartao.getByTestId("responder-pela-plataforma");
    await expect(responder).toBeVisible();
    await responder.click();
    await page.waitForURL(/\/dashboard\/mensagens\?conversa=[0-9a-f-]{36}$/, { timeout: 20_000 });
    await expect(page.getByTestId("mensagens-conversa-nao-encontrada")).toHaveCount(0);
    await expect(page.getByTestId("conversa-nome")).toBeVisible({ timeout: 20_000 });
    await page.context().close();
  });
});
