import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { gerarCodigoTotp } from "../fixtures/totp";
import { authFile } from "../fixtures/auth";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, cpfAleatorio, criarConta, liberarLimiteLogin, liberarLimiteLoginIp, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T655 — pendência 3 do QA-LOGIN-B v2: nas filas do admin, o admin observador da QA (profiles.qa_admin) não vê os botões
  das linhas de dado REAL (o servidor já recusa); vê "Só leitura" no lugar. Nas linhas de TESTE os botões continuam.
  O admin comum vê os botões nas duas. Filas provadas: fotos de perfil e pedidos de parceria (+ o pedido por suporte).
  1280 e 390.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const emailObs = `qa+t655${sufixo}-observador@lab.vivanomads.test`;
const emailReal = `qa+t655${sufixo}-real@lab.vivanomads.test`;
const emailTeste = `qa+t655${sufixo}-teste@lab.vivanomads.test`;
const ids: Record<string, string> = {};
let segredo = "";

async function entrarObservador(browser: Browser, largura: 390 | 1280): Promise<Page> {
  await liberarLimiteLogin(emailObs);
  await liberarLimiteLoginIp();
  const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
  const page = await ctx.newPage();
  await page.goto("/auth?senha=1", { waitUntil: "domcontentloaded" });
  const campoEmail = page.locator('input[name="email"], input[type="email"]').first();
  const campoSenha = page.locator('input[name="password"], input[type="password"]').first();
  await expect(async () => {
    if (/verificar-codigo|\/dashboard|\/admin/.test(page.url())) return;
    if ((await campoEmail.inputValue({ timeout: 5_000 })) !== emailObs) await campoEmail.fill(emailObs, { timeout: 5_000 });
    if ((await campoSenha.inputValue({ timeout: 5_000 })) !== senha) await campoSenha.fill(senha, { timeout: 5_000 });
    await page.locator("form").getByRole("button", { name: /^entrar$/i }).click({ timeout: 5_000 });
    await page.waitForURL(/verificar-codigo|\/dashboard|\/admin/, { timeout: 15_000 });
  }).toPass({ timeout: 50_000 });
  await page.goto("/admin/fotos-perfil", { waitUntil: "domcontentloaded" });
  if (/verificar-codigo/.test(page.url())) {
    await page.locator("#codigo-2fa").fill(gerarCodigoTotp(segredo));
    await page.getByRole("button", { name: /confirmar e entrar/i }).click();
    await page.waitForURL(/\/admin\/fotos-perfil/, { timeout: 30_000 });
  }
  return page;
}

const foto = (page: Page, uid: string) => page.locator(`[data-testid="fila-foto"][data-user="${uid}"]`);
const ficha = (page: Page, email: string) => page.locator(`[data-testid="ficha-parceria"][data-email="${email}"]`);

test.describe("T655 — observador da QA: filas sem botões no dado real, com botões no de teste", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.obs = await criarConta({ email: emailObs, nome: "Olga Observadora", role: "tenant" }, senha);
    ids.real = await criarConta({ email: emailReal, nome: "Rita Real", role: "tenant" }, senha);
    ids.teste = await criarConta({ email: emailTeste, nome: "Tito Teste", role: "tenant" }, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.obs, ids.teste]);
    await adm().from("profiles").update({ is_teste: false }).eq("id", ids.real);
    const { error } = await adm().rpc("promover_qa_admin", { p_id: ids.obs });
    if (error) throw error;
    const c = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const { error: eLogin } = await c.auth.signInWithPassword({ email: emailObs, password: senha });
    if (eLogin) throw eLogin;
    const { data: fator, error: eEnroll } = await c.auth.mfa.enroll({ factorType: "totp", friendlyName: "qa-observador-t655" });
    if (eEnroll) throw eEnroll;
    segredo = fator!.totp.secret;
    const { data: desafio } = await c.auth.mfa.challenge({ factorId: fator!.id });
    const { error: eVer } = await c.auth.mfa.verify({ factorId: fator!.id, challengeId: desafio!.id, code: gerarCodigoTotp(segredo) });
    if (eVer) throw eVer;
    // Uma foto em revisão e um pedido de parceria pendente para cada conta (real e de teste).
    for (const [uid, email, nome] of [
      [ids.real, emailReal, "Rita Real"],
      [ids.teste, emailTeste, "Tito Teste"],
    ] as const) {
      const { error: eFoto } = await adm().from("fotos_perfil_revisao").insert({ user_id: uid, caminho: `${uid}/avatar.webp` });
      if (eFoto) throw eFoto;
      const { error: ePedido } = await adm().from("parceiro_solicitacoes").insert({
        user_id: uid,
        email,
        nome,
        tipo_pessoa: "pf",
        documento: cpfAleatorio(),
        categorias: ["fotografia"],
        cidades: ["Uberlândia"],
        status: "pendente",
        origem: "site",
      });
      if (ePedido) throw ePedido;
    }
  });
  test.afterAll(async () => {
    if (ids.obs) await adm().rpc("revogar_qa_admin", { p_id: ids.obs });
    await adm().from("parceiro_solicitacoes").delete().in("email", [emailReal, emailTeste]);
    await apagarContas([ids.obs, ids.real, ids.teste]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — observador: "Só leitura" no dado real; botões no de teste`, async ({ browser }) => {
      const page = await entrarObservador(browser, largura);

      // Fotos de perfil.
      await expect(foto(page, ids.teste).getByTestId("foto-aprovar")).toBeVisible({ timeout: 30_000 });
      await expect(foto(page, ids.teste).getByTestId("so-leitura-qa")).toHaveCount(0);
      await expect(foto(page, ids.real).getByTestId("so-leitura-qa")).toBeVisible();
      await expect(foto(page, ids.real).getByTestId("foto-aprovar")).toHaveCount(0);
      await expect(foto(page, ids.real).getByTestId("foto-remover")).toHaveCount(0);
      await foto(page, ids.real).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t655-observador-fotos-${largura}.png` });

      // Pedidos de parceria + o pedido aberto pelo suporte.
      await page.goto("/admin/parceiros?aba=pendentes", { waitUntil: "domcontentloaded" });
      await expect(ficha(page, emailTeste).getByTestId("ficha-recusar")).toBeVisible({ timeout: 30_000 });
      await expect(ficha(page, emailReal).getByTestId("so-leitura-qa")).toBeVisible();
      await expect(ficha(page, emailReal).getByTestId("ficha-recusar")).toHaveCount(0);
      await expect(ficha(page, emailReal).getByTestId("ficha-motivo")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Abrir pedido e enviar convite" })).toHaveCount(0);
      await ficha(page, emailReal).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t655-observador-parcerias-${largura}.png` });

      // Nada mudou no banco: a tela só deixou de oferecer.
      const { data: fotos } = await adm().from("fotos_perfil_revisao").select("status").in("user_id", [ids.real, ids.teste]);
      expect((fotos ?? []).every((f) => f.status === "em_revisao")).toBe(true);
      await page.context().close();
    });
  }

  test("1280 px — admin comum: botões nas linhas reais e de teste, sem 'Só leitura'", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto("/admin/fotos-perfil", { waitUntil: "domcontentloaded" });
    await expect(foto(page, ids.real).getByTestId("foto-aprovar")).toBeVisible({ timeout: 30_000 });
    await expect(foto(page, ids.teste).getByTestId("foto-aprovar")).toBeVisible();
    await expect(page.getByTestId("so-leitura-qa")).toHaveCount(0);
    await page.goto("/admin/parceiros?aba=pendentes", { waitUntil: "domcontentloaded" });
    await expect(ficha(page, emailReal).getByTestId("ficha-recusar")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Abrir pedido e enviar convite" })).toBeVisible();
    await expect(page.getByTestId("so-leitura-qa")).toHaveCount(0);
    await ctx.close();
  });
});
