import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { GUARD_NOTICE } from "../../../src/lib/messages/contact-guard";
import { MSG_CONTATO_BLOQUEADO } from "../../../src/lib/respostas/regras";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T379 — 55-E2, PERNA DE LABORATÓRIO (Pista C, 24/10): o que o QA ao vivo do Muse não exerce.
 *   1. FILTRO DE CONTATO na conversa do dono, com telefone e com e-mail:
 *      a) resposta rápida com telefone acrescentado → envio BLOQUEADO, aviso MSG_CONTATO_BLOQUEADO, nada gravado;
 *      b) resposta rápida com e-mail acrescentado → idem;
 *      c) texto digitado à mão (sem resposta rápida) com telefone e com e-mail → o que acontece hoje: medido e registrado
 *         (a regra do 55-E2 bloqueia o que veio da resposta rápida; o chat comum mascara). O contato nunca chega cru ao banco.
 *   2. 1 TOQUE: a resposta salva entra no campo SEM enviar (nada gravado depois de 3 s), o campo é editável e o envio
 *      grava o texto editado.
 * O relatório sai em tests/laboratorio/saida/55e2/.
 */
const SAIDA = "tests/laboratorio/saida/55e2";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t379.${sufixo}@lab.vivanomads.test`, nome: "Dalva Filtro", role: "owner" as const };
const morador = { email: `mor.t379.${sufixo}@lab.vivanomads.test`, nome: "Murilo Filtro", role: "tenant" as const };
const ids: { dono?: string; morador?: string; imovel?: string } = {};
const RESPOSTA = { titulo: "Entrada", texto: `A entrada é a partir das 14h, código ${sufixo}.` };
const TELEFONE = "(34) 99876-5432";
const EMAIL = `dalva.${sufixo}@gmail.com`;
const relatorio: Record<string, unknown> = {};

async function mensagensDoDono(): Promise<string[]> {
  const { data } = await adm().from("messages").select("body").eq("sender_id", ids.dono!).eq("receiver_id", ids.morador!).order("created_at");
  return ((data ?? []) as { body: string }[]).map((m) => m.body);
}
async function abrirConversa(browser: Browser): Promise<Page> {
  const p = await entrar(browser, dono.email, senha);
  await p.setViewportSize({ width: 390, height: 844 });
  p.on("dialog", (d) => {
    throw new Error(`diálogo do navegador não permitido: ${d.type()} ${d.message()}`);
  });
  await p.goto(`/dashboard/mensagens?conversa=${conversationId(ids.dono!, ids.morador!, ids.imovel!)}`, { waitUntil: "domcontentloaded" });
  await expect(p.getByTestId("mensagem-campo")).toBeVisible({ timeout: 30_000 });
  return p;
}
async function tocarNaResposta(p: Page) {
  await p.getByTestId("respostas-rapidas-abrir").click();
  const item = p.getByTestId("resposta-rapida-item").filter({ hasText: RESPOSTA.titulo });
  await expect(item).toHaveCount(1, { timeout: 20_000 });
  await item.click();
}

test.describe("T379 — 55-E2: filtro de contato bloqueando de verdade e o 1 toque sem enviar", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio filtro ${sufixo}`, { ativo: true, preco: 3000 });
    await criarLead(ids.dono, ids.morador, ids.imovel, true);
    await gravarMensagem(ids.morador, ids.dono, ids.imovel, "Oi! Qual o horário de entrada?", conversationId(ids.morador, ids.dono, ids.imovel));
  });
  test.afterAll(async () => {
    mkdirSync(SAIDA, { recursive: true });
    writeFileSync(`${SAIDA}/t379-relatorio.json`, JSON.stringify(relatorio, null, 2));
    await apagarContas([ids.dono, ids.morador]);
  });

  test("0. o dono cria a resposta rápida de teste pela tela", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.goto("/dashboard/respostas-rapidas", { waitUntil: "domcontentloaded" });
    await expect(p.getByText("Telefone, e-mail, link de WhatsApp, rede social ou documento não podem ir no texto: a conversa fica registrada na Viva.")).toBeVisible();
    await p.getByTestId("resposta-titulo").fill(RESPOSTA.titulo);
    await p.getByTestId("resposta-texto").fill(RESPOSTA.texto);
    await p.getByTestId("resposta-salvar").click();
    await expect(p.getByTestId("resposta-item")).toHaveCount(1, { timeout: 20_000 });
    await p.context().close();
  });

  test("1a/1b. resposta rápida + telefone e + e-mail: envio BLOQUEADO com o aviso, nada gravado", async ({ browser }) => {
    const p = await abrirConversa(browser);
    for (const [caso, contato] of [["telefone", TELEFONE], ["email", EMAIL]] as const) {
      await tocarNaResposta(p);
      await p.getByTestId("mensagem-campo").fill(`${RESPOSTA.texto} Fala comigo: ${contato}`);
      const antes = (await mensagensDoDono()).length;
      await p.getByRole("button", { name: "Enviar" }).click();
      const aviso = p.getByTestId("resposta-rapida-bloqueada");
      await expect(aviso, `${caso}: o aviso do bloqueio aparece`).toBeVisible({ timeout: 10_000 });
      const textoAviso = await aviso.innerText();
      await p.waitForTimeout(3_000);
      const depois = await mensagensDoDono();
      relatorio[`1-${caso}`] = { aviso: textoAviso, gravadas: depois.length - antes, campo: await p.getByTestId("mensagem-campo").inputValue() };
      await p.screenshot({ path: `${SAIDA}/t379-bloqueio-${caso}-390.png`, fullPage: true });
      expect.soft(textoAviso.trim(), `${caso}: texto do aviso`).toBe(MSG_CONTATO_BLOQUEADO);
      expect.soft(depois.length - antes, `${caso}: nada gravado`).toBe(0);
      expect.soft(depois.some((b) => b.includes(contato)), `${caso}: o contato não chegou ao banco`).toBe(false);
      // O texto continua no campo para a pessoa corrigir.
      await expect.soft(p.getByTestId("mensagem-campo")).toHaveValue(new RegExp(contato.replace(/[()+.]/g, "\\$&")));
      await p.getByTestId("mensagem-campo").fill("");
    }
    await p.context().close();
  });

  test("1c. texto digitado à mão com telefone e com e-mail: comportamento atual medido", async ({ browser }) => {
    const p = await abrirConversa(browser);
    for (const [caso, contato] of [["telefone", TELEFONE], ["email", EMAIL]] as const) {
      const texto = `Digitado à mão ${caso} ${sufixo}: ${contato}`;
      const antes = (await mensagensDoDono()).length;
      await p.getByTestId("mensagem-campo").fill(texto);
      await p.getByRole("button", { name: "Enviar" }).click();
      await p.waitForTimeout(4_000);
      const depois = await mensagensDoDono();
      const novas = depois.slice(antes);
      const bloqueio = await p.getByTestId("resposta-rapida-bloqueada").isVisible().catch(() => false);
      const protecao = await p.getByText(GUARD_NOTICE).isVisible().catch(() => false);
      relatorio[`1c-${caso}`] = { bloqueado: novas.length === 0, avisoDeBloqueio: bloqueio, avisoDeProtecao: protecao, gravado: novas };
      console.log(`T379|1c|${caso}|gravadas=${novas.length}|bloqueio=${bloqueio}|protecao=${protecao}|corpo=${JSON.stringify(novas)}`);
      await p.screenshot({ path: `${SAIDA}/t379-digitado-${caso}-390.png`, fullPage: true });
      // O que nunca pode acontecer, bloqueando ou mascarando: o contato cru no banco.
      expect.soft(novas.some((b) => b.includes(contato)), `${caso} digitado: o contato não chegou cru ao banco`).toBe(false);
    }
    await p.context().close();
  });

  test("2. 1 toque: o texto entra no campo sem enviar, é editável e o envio grava o editado", async ({ browser }) => {
    const p = await abrirConversa(browser);
    const antes = (await mensagensDoDono()).length;
    await tocarNaResposta(p);
    const campo = p.getByTestId("mensagem-campo");
    await expect(campo).toHaveValue(RESPOSTA.texto);
    await p.waitForTimeout(3_000);
    const semEnviar = (await mensagensDoDono()).length - antes;
    await expect(campo).toBeEditable();
    const editado = `${RESPOSTA.texto} Pode chegar até as 20h.`;
    await campo.fill(editado);
    await expect(campo).toHaveValue(editado);
    await p.screenshot({ path: `${SAIDA}/t379-um-toque-390.png`, fullPage: true });
    await p.getByRole("button", { name: "Enviar" }).click();
    await expect.poll(async () => (await mensagensDoDono()).slice(antes), { timeout: 20_000 }).toEqual([editado]);
    relatorio["2-um-toque"] = { gravadasAntesDoEnvio: semEnviar, gravadoNoEnvio: editado };
    expect(semEnviar, "o toque na resposta não envia sozinho").toBe(0);
    await p.context().close();
  });
});
