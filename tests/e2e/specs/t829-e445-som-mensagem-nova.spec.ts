import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { EVENTO_CONTADORES } from "../../../src/lib/painel/contadores";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T829 — E445 item 6 (Relay 57): som discreto de mensagem nova com o site aberto, desligável em /dashboard/notificacoes.
  - Abrir o site nunca toca (as mensagens que já estavam lá não são "novas").
  - Chegou mensagem e a casca releu os contadores → toca uma vez.
  - Desligado em Notificações (vale para o aparelho) → não toca. 390 e 1280.
  O toque dispara o evento "vn:som-mensagem-tocou" (o teste conta os eventos; o áudio em si é do navegador).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t829.${sufixo}@lab.vivanomads.test`, nome: "Dora Somnovo", role: "owner" as const };
const inq = { email: `inq.t829.${sufixo}@lab.vivanomads.test`, nome: "Iara Somnovo", role: "tenant" as const };
const ids: Record<string, string> = {};

const toques = (p: Page) => p.evaluate(() => (window as unknown as { __toques: number }).__toques);

async function chegaMensagemEReler(p: Page, texto: string) {
  await gravarMensagem(ids.dono, ids.inq, ids.imovel, texto, conversationId(ids.inq, ids.dono, ids.imovel));
  await p.evaluate((ev) => window.dispatchEvent(new Event(ev)), EVENTO_CONTADORES);
}

test.describe("T829 — E445 item 6: som de mensagem nova", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio do som ${sufixo}`, { ativo: true });
    await gravarMensagem(ids.dono, ids.inq, ids.imovel, "Mensagem antiga.", conversationId(ids.inq, ids.dono, ids.imovel));
  });
  test.afterAll(async () => {
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const w of [390, 1280] as const) {
    test(`${w}: abrir não toca; mensagem nova toca; desligado não toca`, async ({ browser }) => {
      const p = await entrar(browser, inq.email, senha);
      await p.addInitScript(() => {
        const j = window as unknown as { __toques: number };
        j.__toques = 0;
        window.addEventListener("vn:som-mensagem-tocou", () => (j.__toques += 1));
      });
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });

      // Ligado (padrão): o interruptor aparece em Notificações, ligado.
      await p.goto("/dashboard/notificacoes", { waitUntil: "domcontentloaded" });
      const interruptor = p.getByTestId("notif-som-mensagem");
      await expect(interruptor).toBeVisible({ timeout: 30_000 });
      await expect(interruptor).toHaveAttribute("aria-checked", "true");
      expect(await p.evaluate((l) => document.documentElement.scrollWidth - l, w)).toBeLessThanOrEqual(1);
      await p.getByTestId("notif-neste-aparelho").screenshot({ path: `tests/laboratorio/saida/t829-interruptor-${w}.png` });

      // Abrir o painel não toca.
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await p.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await p.waitForTimeout(2_000);
      expect(await toques(p)).toBe(0);

      // Chegou mensagem: toca uma vez.
      await chegaMensagemEReler(p, `Nova ${w} ${sufixo}`);
      await expect.poll(() => toques(p), { timeout: 20_000 }).toBe(1);

      // Desliga em Notificações e recebe outra: não toca.
      await p.goto("/dashboard/notificacoes", { waitUntil: "domcontentloaded" });
      await interruptor.click();
      await expect(interruptor).toHaveAttribute("aria-checked", "false");
      await p.reload({ waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("notif-som-mensagem")).toHaveAttribute("aria-checked", "false", { timeout: 30_000 });
      await p.waitForTimeout(2_000);
      await chegaMensagemEReler(p, `Outra ${w} ${sufixo}`);
      await p.waitForTimeout(5_000);
      expect(await toques(p)).toBe(0);

      // Religa para a próxima largura (a preferência é do aparelho/contexto).
      await p.getByTestId("notif-som-mensagem").click();
      await p.context().close();
    });
  }
});
