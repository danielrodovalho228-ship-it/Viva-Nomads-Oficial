import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { dataHoraBRT } from "../../../src/lib/datas-brasilia";
import { gerarCodigoTotp } from "../fixtures/totp";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, criarAdmin, liberarLimiteLogin, liberarLimiteLoginIp, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2115 — E577 (Pista 3; varredura "sem spec" das 142, lote I) @E577 — sem @ao-vivo-seguro: precisa de sessão de admin
  (2FA) e do laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E577; unitário e577-recusadas.test.ts): em /admin/parceiros › Recusadas, o cartão de um pedido
  recusado diz "Recusado", com "Pedido recusado em <data>." e "Motivo: <motivo>" — nunca "Não aprovável ainda · faltam
  N de N itens do checklist", sem checklist e sem Aprovar/Recusar (o pedido já foi decidido).
  O login de admin com 2FA segue o t1608 (fator TOTP inscrito pela API, código gerado na hora).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const admin = { email: `equipe.t2115.${sufixo}@lab.vivanomads.test`, nome: "[TESTE QA] Rui Recusas" };
const pedido = { email: `recusado.t2115.${sufixo}@lab.vivanomads.test`, nome: `Rita Recusada ${sufixo}`, motivo: "Fotos do trabalho não são da própria empresa (T2115)." };
const ids: Record<string, string> = {};
let segredoTotp = "";

async function entrarAdmin(page: Page) {
  await liberarLimiteLogin(admin.email);
  await liberarLimiteLoginIp();
  await page.goto("/auth?senha=1", { waitUntil: "domcontentloaded" });
  const campoEmail = page.locator('input[name="email"], input[type="email"]').first();
  const campoSenha = page.locator('input[name="password"], input[type="password"]').first();
  await expect(async () => {
    if (/verificar-codigo|\/dashboard|\/admin/.test(page.url())) return;
    if ((await campoEmail.inputValue({ timeout: 5_000 })) !== admin.email) await campoEmail.fill(admin.email, { timeout: 5_000 });
    if ((await campoSenha.inputValue({ timeout: 5_000 })) !== senha) await campoSenha.fill(senha, { timeout: 5_000 });
    await page.locator("form").getByRole("button", { name: /^entrar$/i }).click({ timeout: 5_000 });
    await page.waitForURL(/verificar-codigo|\/dashboard|\/admin/, { timeout: 15_000 });
  }).toPass({ timeout: 50_000 });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  if (/verificar-codigo/.test(page.url())) {
    await page.locator("#codigo-2fa").fill(gerarCodigoTotp(segredoTotp));
    await page.getByRole("button", { name: /confirmar e entrar/i }).click();
    await page.waitForURL(/\/admin(?!.*verificar)/, { timeout: 30_000 });
  }
}

test.describe("T2115 — E577: o pedido de parceria recusado aparece como Recusado, com motivo e data, sem ações @E577", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.admin = await criarAdmin(admin.email, admin.nome, senha);
    const c = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const { error: eLogin } = await c.auth.signInWithPassword({ email: admin.email, password: senha });
    if (eLogin) throw eLogin;
    const { data: fator, error: eEnroll } = await c.auth.mfa.enroll({ factorType: "totp", friendlyName: "t2115" });
    if (eEnroll) throw eEnroll;
    segredoTotp = fator!.totp.secret;
    const { data: desafio } = await c.auth.mfa.challenge({ factorId: fator!.id });
    const { error: eVer } = await c.auth.mfa.verify({ factorId: fator!.id, challengeId: desafio!.id, code: gerarCodigoTotp(segredoTotp) });
    if (eVer) throw eVer;
    // Pedido recusado como a ação do admin deixa: status, motivo, quem e quando.
    ids.decididoEm = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const { data, error } = await adm()
      .from("parceiro_solicitacoes")
      .insert({
        email: pedido.email, nome: pedido.nome, origem: "conta", tipo_pessoa: "pj", categorias: ["limpeza"], cidades: ["Uberlândia"],
        status: "recusada", motivo_recusa: pedido.motivo, decidido_por: ids.admin, decidido_em: ids.decididoEm,
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.pedido = data.id as string;
  });

  test.afterAll(async () => {
    if (ids.pedido) await adm().from("parceiro_solicitacoes").delete().eq("id", ids.pedido);
    await apagarContas([ids.admin]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — Recusadas: Recusado, Pedido recusado em <data>, o motivo; sem checklist nem Aprovar/Recusar`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await entrarAdmin(page);
      await page.goto("/admin/parceiros?aba=recusadas", { waitUntil: "domcontentloaded" });
      const ficha = page.locator(`[data-testid="ficha-parceria"][data-email="${pedido.email}"]`);
      await expect(ficha, "a ficha do pedido recusado na aba Recusadas").toBeVisible({ timeout: 30_000 });

      await expect(ficha).toHaveAttribute("data-estado", "recusada");
      await expect(ficha.getByTestId("ficha-estado")).toHaveText("Recusado");
      const recusa = ficha.getByTestId("ficha-recusada");
      await expect(recusa).toContainText(`Pedido recusado em ${dataHoraBRT(ids.decididoEm)}.`);
      await expect(ficha.getByTestId("ficha-recusada-motivo")).toHaveText(`Motivo: ${pedido.motivo}`);

      await expect(ficha, "nunca o Não aprovável ainda do checklist").not.toContainText("Não aprovável ainda");
      await expect(ficha.getByTestId("ficha-checklist"), "sem checklist").toHaveCount(0);
      await expect(ficha.getByRole("button", { name: /^Aprovar$/ }), "sem Aprovar").toHaveCount(0);
      await expect(ficha.getByRole("button", { name: /^Recusar$/ }), "sem Recusar").toHaveCount(0);
    });
  }
});
