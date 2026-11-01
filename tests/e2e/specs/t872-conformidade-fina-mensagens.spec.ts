import { test, expect } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T872 — CONFORMIDADE FINA DE MENSAGENS (Pista C, 01/11; merge #1887, F8/F9, mockup morador-mensagens). O merge trouxe só
  teste de fonte; aqui, na tela de verdade, com uma conversa real do laboratório sobre um imóvel, a 390 e 1280 px:
   1) o contexto da conversa (conversa-contexto) mostra o imóvel em destaque: a foto (conversa-contexto-foto) carregada
      de verdade e no tamanho novo (h-16 w-20 = 64 × 80 px; antes 48 × 64) e o título do imóvel em 16 px, na fonte de
      título;
   2) vale pelos dois lados: o morador e o proprietário veem o mesmo destaque.
  A parte das abas que somam o total (F9) é das conversas de EXEMPLO (modo demonstração do admin) e fica com o teste de
  unidade do merge (contarPorFiltro). Contas e imóvel do laboratório, criados e apagados aqui.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t872.${sufixo}@lab.vivanomads.test`, nome: "Mila Mensagens", role: "owner" as const };
const morador = { email: `mor.t872.${sufixo}@lab.vivanomads.test`, nome: "Rui Conversa", role: "tenant" as const };
const ids: { dono?: string; morador?: string; imovel?: string; lead?: string } = {};
const TITULO = `Studio conversa t872 ${sufixo}`;

test.describe("T872 — Mensagens: o imóvel da conversa em destaque (#1887)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true });
    ids.lead = await criarLead(ids.dono, ids.morador, ids.imovel, true);
    await gravarMensagem(ids.morador, ids.dono, ids.imovel, "Oi! O imóvel ainda está disponível?", conversationId(ids.morador, ids.dono, ids.imovel));
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono, ids.morador]);
  });

  for (const lado of ["morador", "dono"] as const) {
    for (const largura of [390, 1280] as const) {
      test(`${lado} @${largura}: foto 64 × 80 carregada e título do imóvel em 16 px`, async ({ browser }) => {
        const conta = lado === "morador" ? morador : dono;
        const page = await entrar(browser, conta.email, senha);
        await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
        const conversa = conversationId(ids.morador!, ids.dono!, ids.imovel!);
        await page.goto(`/dashboard/mensagens?conversa=${conversa}`, { waitUntil: "domcontentloaded" });
        const contexto = page.getByTestId("conversa-contexto");
        await expect(contexto).toBeVisible({ timeout: 30_000 });

        const foto = contexto.getByTestId("conversa-contexto-foto");
        await expect(foto).toBeVisible();
        await expect.poll(() => foto.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 20_000 }).toBe(true);
        const caixa = await foto.boundingBox();
        expect(caixa, "caixa da foto").toBeTruthy();
        expect(Math.round(caixa!.width), "largura da foto (w-20)").toBe(80);
        expect(Math.round(caixa!.height), "altura da foto (h-16)").toBe(64);

        const titulo = contexto.getByText(TITULO, { exact: true });
        await expect(titulo).toBeVisible();
        const estilo = await titulo.evaluate((el) => {
          const s = getComputedStyle(el);
          const ref = document.createElement("span");
          ref.className = "font-title";
          document.body.appendChild(ref);
          const fonteTitulo = getComputedStyle(ref).fontFamily;
          ref.remove();
          return { tamanho: s.fontSize, fonte: s.fontFamily, fonteTitulo };
        });
        expect(estilo.tamanho, "título do imóvel em text-base").toBe("16px");
        expect(estilo.fonte, "título do imóvel na fonte de título").toBe(estilo.fonteTitulo);
        await page.context().close();
      });
    }
  }
});
