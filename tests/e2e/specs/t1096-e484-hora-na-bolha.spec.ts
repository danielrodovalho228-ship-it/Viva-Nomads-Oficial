import { test, expect, type Browser } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { horaDaBolha } from "../../../src/lib/mensagens/hora-da-bolha";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1096 — E484 (#2467, 04/11): cada bolha da conversa mostra a hora de envio, no fuso de Brasília. O que a t41 não cobre
 * (ela confere só a mensagem de AGORA, "HH:MM"): as mensagens antigas que vêm do servidor (created_at) e o fuso. Pela
 * tela real, com o APARELHO no fuso de Tóquio (12 h à frente de Brasília), 390 e 1280:
 *   1. mensagem de ONTEM → "Ontem, HH:MM"; de 5 dias atrás → "dd/mm, HH:MM" — sempre a hora de Brasília, não a de Tóquio;
 *   2. a resposta enviada agora ganha a hora na bolha na hora ("HH:MM" de Brasília).
 * O formato (horaDaBolha) fica com o hora-da-bolha.test.ts; o "de agora" em fuso igual, com a t41.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const mor = { email: `mor.t1096.${sufixo}@lab.vivanomads.test`, nome: "Helena Hora Campos", role: "tenant" as const };
const dono = { email: `dono.t1096.${sufixo}@lab.vivanomads.test`, nome: "Otto Ontem Ramos", role: "owner" as const };
const TITULO = `Studio da hora t1096 ${sufixo}`;
const ids: Record<string, string> = {};
const DIA = 24 * 3600_000;
// 15:07 de Brasília (18:07 UTC): em Tóquio seria 03:07 do dia seguinte — a diferença salta aos olhos.
const emBrasilia = (diasAtras: number) => {
  const d = new Date(Date.now() - diasAtras * DIA);
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
  return new Date(`${ymd}T15:07:00-03:00`).toISOString();
};
const ONTEM = emBrasilia(1);
const ANTES = emBrasilia(5);

async function abrirEmToquio(browser: Browser, w: number) {
  const ctx = await browser.newContext({ timezoneId: "Asia/Tokyo", viewport: { width: w, height: w === 390 ? 844 : 900 } });
  const p = await ctx.newPage();
  await entrarNaPagina(p, mor.email, senha);
  return p;
}

test.describe("T1096 — E484: a hora de envio em cada bolha, no fuso de Brasília", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.mor = await criarConta(mor, senha);
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true });
    await criarLead(ids.dono, ids.mor, ids.imovel, true);
    const conv = conversationId(ids.mor, ids.dono, ids.imovel);
    const { error } = await adm().from("messages").insert([
      { conversation_id: conv, sender_id: ids.dono, receiver_id: ids.mor, property_id: ids.imovel, body: "Mensagem de cinco dias atrás (t1096).", created_at: ANTES },
      { conversation_id: conv, sender_id: ids.dono, receiver_id: ids.mor, property_id: ids.imovel, body: "Mensagem de ontem (t1096).", created_at: ONTEM },
    ]);
    if (error) throw error;
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.mor, ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`antigas: "Ontem, 15:07" e "dd/mm, 15:07" de Brasília num aparelho em Tóquio; a enviada agora ganha a hora (${w})`, async ({ browser }) => {
      const p = await abrirEmToquio(browser, w);
      await p.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
      await p.getByRole("button", { name: new RegExp(TITULO) }).first().click({ timeout: 30_000 });
      const conversa = p.locator("section");
      const bolha = (texto: string) => conversa.locator("div").filter({ has: p.getByText(texto, { exact: true }) }).last();

      // 1. As antigas: a hora de Brasília (15:07), com "Ontem" / a data.
      await expect(bolha("Mensagem de ontem (t1096).").getByTestId("mensagem-hora")).toHaveText(horaDaBolha(ONTEM)!, { timeout: 30_000 });
      expect(horaDaBolha(ONTEM)).toBe("Ontem, 15:07");
      await expect(bolha("Mensagem de cinco dias atrás (t1096).").getByTestId("mensagem-hora")).toHaveText(horaDaBolha(ANTES)!);
      expect(horaDaBolha(ANTES)).toMatch(/^\d{2}\/\d{2}(\/\d{4})?, 15:07$/);

      // 2. A enviada agora: "HH:MM" de Brasília, já na bolha.
      const texto = `Resposta de agora ${w} (t1096 ${sufixo}).`;
      await p.getByTestId("mensagem-campo").fill(texto);
      await p.getByRole("button", { name: "Enviar" }).click();
      const agora = bolha(texto).getByTestId("mensagem-hora");
      await expect(agora).toHaveText(/^\d{2}:\d{2}$/, { timeout: 20_000 });
      const esperado = horaDaBolha(new Date().toISOString())!;
      const lida = (await agora.textContent())!.trim();
      const minutos = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
      expect(Math.abs(minutos(lida) - minutos(esperado)), `a hora de agora é a de Brasília (${esperado}), não a de Tóquio`).toBeLessThanOrEqual(2);
      const sobra = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(sobra).toBeLessThanOrEqual(1);
      await p.context().close();
    });
  }
});
