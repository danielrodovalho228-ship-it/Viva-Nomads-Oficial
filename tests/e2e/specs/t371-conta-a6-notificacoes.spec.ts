import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T371 — CONTA-A A6 (mockup perfil-06): Conta › Notificações.
 *   1. Cartão dos tipos (Novas mensagens, Lembretes da estadia, Novidades e dicas da Viva) e cartão "Canais" (E-mail,
 *      push, WhatsApp) com "Salvar preferências"; sem check-in/reserva/viagens. 1280 e 390, com prints.
 *   2. "Salvar preferências" grava tipo (notif_categorias_desligadas), e-mail/WhatsApp (perfil) e push (dados da conta);
 *      tudo volta depois de recarregar. Gravar a preferência não envia nada.
 */
const SAIDA = "tests/laboratorio/saida";
// E176 (parte 2): Notificações é a página única do sino (/dashboard/conta/notificacoes redireciona para cá).
const ROTA = "/dashboard/notificacoes";

test.describe("T371 — CONTA-A A6: Notificações (perfil-06)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
  const senha = novaSenha();
  const conta = { email: `inq.t371.${novoSufixo()}@lab.vivanomads.test`, nome: "João Martins", role: "tenant" as const };
  let id = "";
  const perfil = async () =>
    (await adm().from("profiles").select("notif_email, notif_whatsapp, notif_categorias_desligadas").eq("id", id).single()).data as {
      notif_email: boolean;
      notif_whatsapp: boolean;
      notif_categorias_desligadas: string[] | null;
    };
  const push = async () => ((await adm().auth.admin.getUserById(id)).data.user?.user_metadata as { notif_push?: boolean } | undefined)?.notif_push;
  async function como(browser: Browser, w: number): Promise<Page> {
    const p = await entrar(browser, conta.email, senha);
    await p.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
    return p;
  }
  test.beforeAll(async () => {
    id = await criarConta(conta, senha);
  });
  test.afterAll(async () => {
    await apagarContas([id]);
  });

  for (const w of [1280, 390]) {
    test(`1. a ${w} px: os dois cartões do desenho`, async ({ browser }) => {
      const p = await como(browser, w);
      await p.goto(ROTA, { waitUntil: "domcontentloaded" });
      await p.getByTestId("tela-notificacoes").waitFor({ timeout: 20_000 });
      await expect(p.locator("h1:visible")).toHaveText("Notificações");
      for (const c of ["mensagens", "lembretes", "outros"]) await expect(p.getByTestId(`notif-tipo-${c}`)).toHaveAttribute("aria-checked", "true");
      for (const c of ["email", "push", "whatsapp"]) await expect(p.getByTestId(`notif-canal-${c}`)).toHaveAttribute("aria-checked", "true");
      const tela = p.getByTestId("tela-notificacoes");
      await expect(tela).toContainText("Lembretes da estadia");
      await expect(tela).toContainText("conferência de entrada e de saída");
      await expect(tela).toContainText("Notificação no celular (push)");
      await expect(p.getByTestId("notif-salvar")).toHaveText(/Salvar preferências/);
      await expect(p.locator("main")).not.toContainText(/check-in|check-out|reserva|viage|acomoda/i);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await p.screenshot({ path: `${SAIDA}/t371-notificacoes-${w}.png`, fullPage: true });
      await p.context().close();
    });
  }

  test("2. Salvar preferências grava os tipos e os três canais e volta depois de recarregar", async ({ browser }) => {
    const p = await como(browser, 1280);
    await p.goto(ROTA, { waitUntil: "domcontentloaded" });
    await p.getByTestId("tela-notificacoes").waitFor({ timeout: 20_000 });
    await p.getByTestId("notif-tipo-outros").click();
    await p.getByTestId("notif-canal-push").click();
    await p.getByTestId("notif-canal-whatsapp").click();
    await p.getByTestId("notif-salvar").click();
    await expect(p.getByTestId("notif-salvar-msg")).toHaveText("Preferências salvas.");
    await expect.poll(async () => (await perfil()).notif_categorias_desligadas, { timeout: 15_000 }).toEqual(["outros"]);
    const pf = await perfil();
    expect(pf.notif_email).toBe(true);
    expect(pf.notif_whatsapp).toBe(false);
    await expect.poll(push, { timeout: 15_000 }).toBe(false);
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.getByTestId("tela-notificacoes").waitFor({ timeout: 20_000 });
    await expect(p.getByTestId("notif-tipo-outros")).toHaveAttribute("aria-checked", "false");
    await expect(p.getByTestId("notif-tipo-mensagens")).toHaveAttribute("aria-checked", "true");
    await expect(p.getByTestId("notif-canal-push")).toHaveAttribute("aria-checked", "false");
    await expect(p.getByTestId("notif-canal-whatsapp")).toHaveAttribute("aria-checked", "false");
    await expect(p.getByTestId("notif-canal-email")).toHaveAttribute("aria-checked", "true");
    await p.context().close();
  });
});
