import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2134 — E484 @E484: cada bolha da conversa diz quando a mensagem foi enviada, no fuso de Brasília.
  Regra decidida (E484; unitário src/lib/mensagens/hora-da-bolha.test.ts):
    - mensagem de hoje: "HH:MM";
    - de ontem: "Ontem, HH:MM";
    - mais antiga, no mesmo ano: "DD/MM, HH:MM";
    - de outro ano: "DD/MM/AAAA, HH:MM".
  O "dia" é o do calendário de Brasília, não o do UTC. O t41 só confere o formato "HH:MM" da mensagem de agora. Esta
  spec grava quatro mensagens (agora, ontem, 5 dias atrás e um dia do ano passado) e confere o texto exato de cada
  bolha. O esperado é calculado aqui, pela regra, a partir da hora gravada (não importa a função do código).
  390 e 1280 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2134.${sufixo}@lab.vivanomads.test`, nome: "Hilda Hora", role: "owner" as const };
const inq = { email: `inq.t2134.${sufixo}@lab.vivanomads.test`, nome: "Otto Ontem", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string } = {};
const TITULO = `Studio das horas ${sufixo}`;

/** Partes da data e hora no calendário de Brasília. */
function brt(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return { dia: `${p.year}-${p.month}-${p.day}`, ano: p.year, dd: p.day, mm: p.month, hm: `${p.hour}:${p.minute}` };
}
/** O texto esperado pela regra do E484, para uma mensagem enviada em `enviada`, lida em `agora`. */
function esperado(enviada: Date, agora: Date): string {
  const e = brt(enviada);
  const a = brt(agora);
  const ontem = brt(new Date(Date.parse(`${a.dia}T12:00:00Z`) - 86_400_000)).dia;
  if (e.dia === a.dia) return e.hm;
  if (e.dia === ontem) return `Ontem, ${e.hm}`;
  if (e.ano === a.ano) return `${e.dd}/${e.mm}, ${e.hm}`;
  return `${e.dd}/${e.mm}/${e.ano}, ${e.hm}`;
}

const agoraDoTeste = Date.now();
const MENSAGENS = [
  { texto: `Do ano passado ${sufixo}`, em: new Date(Date.UTC(new Date(agoraDoTeste).getUTCFullYear() - 1, 0, 15, 15, 7)) },
  { texto: `De cinco dias ${sufixo}`, em: new Date(agoraDoTeste - 5 * 86_400_000) },
  { texto: `De ontem ${sufixo}`, em: new Date(agoraDoTeste - 86_400_000) },
  { texto: `De agora ${sufixo}`, em: new Date(agoraDoTeste - 5 * 60_000) },
];

async function horaDaBolha(page: Page, texto: string): Promise<string> {
  const bolha = page.getByText(texto, { exact: true }).last();
  await expect(bolha).toBeVisible({ timeout: 20_000 });
  return ((await bolha.locator("xpath=..").getByTestId("mensagem-hora").innerText()) ?? "").trim();
}

test.describe("T2134 — E484: a hora de cada bolha (hoje, ontem, dias atrás, outro ano) no fuso de Brasília @E484", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true });
    await criarLead(ids.dono, ids.inq, ids.imovel);
    const conversa = conversationId(ids.inq, ids.dono, ids.imovel);
    for (const m of MENSAGENS) {
      const { error } = await adm()
        .from("messages")
        .insert({ conversation_id: conversa, sender_id: ids.inq, receiver_id: ids.dono, property_id: ids.imovel, body: m.texto, created_at: m.em.toISOString() });
      if (error) throw error;
    }
  });

  test.afterAll(async () => {
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — cada bolha diz quando foi enviada, pela regra do dia de Brasília`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: new RegExp(TITULO) }).first().click();
      const agora = new Date();
      for (const m of MENSAGENS) {
        expect(await horaDaBolha(page, m.texto), `bolha "${m.texto}" (enviada em ${m.em.toISOString()})`).toBe(esperado(m.em, agora));
      }
      await page.context().close();
    });
  }
});
