import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1438 — E703 (#3287, na main): em Notificações, sem celular cadastrado o canal WhatsApp fica DESLIGADO e indisponível, com o
  convite "Cadastre o seu celular para receber avisos no WhatsApp." e o link para o perfil; os outros canais (e-mail, push) seguem
  livres. Caminho contrário: com celular cadastrado, o WhatsApp está ligado, habilitado e sem convite. 390 e 1280 px.
*/
const ROTA = "/dashboard/notificacoes";
const senha = novaSenha();
const sufixo = novoSufixo();
const semCel = { email: `semcel.t1438.${sufixo}@lab.vivanomads.test`, nome: "Sem Celular", role: "tenant" as const };
const comCel = { email: `comcel.t1438.${sufixo}@lab.vivanomads.test`, nome: "Com Celular", role: "tenant" as const };
const ids: { a?: string; b?: string } = {};

test.describe("T1438 — E703: WhatsApp sem celular cadastrado", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.beforeAll(async () => {
    ids.a = await criarConta(semCel, senha);
    ids.b = await criarConta(comCel, senha);
    const { error } = await adm().from("profiles").update({ phone: null }).eq("id", ids.a);
    if (error) throw error;
  });
  test.afterAll(async () => {
    await apagarContas([ids.a, ids.b]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: sem celular o WhatsApp fica desligado com o convite; com celular, ligado`, async ({ browser }) => {
      const a = await entrar(browser, semCel.email, senha);
      await a.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await a.goto(ROTA, { waitUntil: "domcontentloaded" });
      await a.getByTestId("tela-notificacoes").waitFor({ timeout: 30_000 });
      const wpp = a.getByTestId("notif-canal-whatsapp");
      await expect(wpp).toHaveAttribute("aria-checked", "false");
      await expect(wpp).toBeDisabled();
      const convite = a.getByTestId("notif-whatsapp-convite");
      await expect(convite).toContainText("Cadastre o seu celular para receber avisos no WhatsApp.");
      await expect(convite.getByRole("link", { name: "Cadastrar celular" })).toHaveAttribute("href", "/dashboard/conta/perfil");
      await expect(a.getByTestId("notif-canal-email")).toBeEnabled();
      await expect(a.getByTestId("notif-canal-push")).toBeEnabled();
      expect(await a.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await a.context().close();

      const b = await entrar(browser, comCel.email, senha);
      await b.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await b.goto(ROTA, { waitUntil: "domcontentloaded" });
      await b.getByTestId("tela-notificacoes").waitFor({ timeout: 30_000 });
      await expect(b.getByTestId("notif-canal-whatsapp")).toHaveAttribute("aria-checked", "true");
      await expect(b.getByTestId("notif-canal-whatsapp")).toBeEnabled();
      await expect(b.getByTestId("notif-whatsapp-convite")).toHaveCount(0);
      await b.context().close();
    });
  }
});
