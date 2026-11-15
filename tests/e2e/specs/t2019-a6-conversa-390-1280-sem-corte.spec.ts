import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2019 — Pista 3, lote 2, item A6 @E243 @E244 @ao-vivo-seguro. Regra: a conversa aberta, a 390 e a 1280 px, para o
  morador e para o dono, não corta nada: sem rolagem lateral da página, cada bolha inteira dentro da tela e da própria
  caixa (texto longo quebra em linhas), e o campo e o botão Enviar visíveis dentro da largura.
  Vermelho: pendente de laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2019.${sufixo}@lab.vivanomads.test`, nome: "Dulce Largura", role: "owner" as const };
const inq = { email: `inq.t2019.${sufixo}@lab.vivanomads.test`, nome: "Iris Largura", role: "tenant" as const };
const ids: Record<string, string> = {};
const LONGA = `Chego na Rua Desembargador Joaquim Nabuco de Araújo Figueiredo, apartamento 1204, bloco B, na sexta-feira à noite depois das 21h30, com duas malas grandes e a bicicleta dobrável ${sufixo}`;
const CURTA = `Perfeito, deixo a chave na portaria ${sufixo}`;

async function medir(p: Page, largura: number) {
  expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "rolagem lateral da página").toBeLessThanOrEqual(1);
  for (const texto of [LONGA, CURTA]) {
    const bolha = p.locator("main").getByText(texto, { exact: true }).last();
    await expect(bolha).toBeVisible();
    const m = await bolha.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { esq: r.left, dir: r.right, sobra: el.scrollWidth - el.clientWidth };
    });
    expect(m.esq, `bolha "${texto.slice(0, 20)}…" começa dentro da tela`).toBeGreaterThanOrEqual(0);
    expect(m.dir, `bolha "${texto.slice(0, 20)}…" termina dentro da tela`).toBeLessThanOrEqual(largura);
    expect(m.sobra, `texto cortado dentro da bolha "${texto.slice(0, 20)}…"`).toBeLessThanOrEqual(1);
  }
  for (const alvo of [p.getByTestId("mensagem-campo"), p.getByRole("button", { name: "Enviar", exact: true })]) {
    await expect(alvo).toBeVisible();
    const b = (await alvo.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(largura);
  }
}

test.describe("T2019 — A6: conversa a 390 e 1280 px sem corte @E243", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio da largura ${sufixo}`, { ativo: true });
    const conv = conversationId(ids.inq, ids.dono, ids.imovel);
    await gravarMensagem(ids.inq, ids.dono, ids.imovel, LONGA, conv);
    await gravarMensagem(ids.dono, ids.inq, ids.imovel, CURTA, conv);
  });
  test.afterAll(async () => {
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const largura of [390, 1280] as const) {
    for (const quem of [inq, dono]) {
      test(`${largura} px — ${quem.role === "tenant" ? "morador" : "dono"}`, async ({ browser }) => {
        const p = await entrar(browser, quem.email, senha);
        await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
        await p.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
        await p.getByRole("button", { name: new RegExp(`Studio da largura ${sufixo}`) }).first().click();
        await expect(p.getByTestId("mensagem-campo")).toBeVisible();
        await medir(p, largura);
        await p.screenshot({ path: `tests/laboratorio/saida/t2019-${largura}-${quem.role}.png` });
        await p.context().close();
      });
    }
  }
});
