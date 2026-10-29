import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, fotosReais, gravarMensagem, novaSenha, novoSufixo, tornarContratoVigente } from "../fixtures/laboratorio";

/*
  T649 — lote Contratos/Início (varredura da área do dono, 29/10):
   E246 — no painel do celular o "Fale com a Viva" flutuante não senta sobre o conteúdo (Contratos: caixa "Taxa de
          serviço"; Início: a capa do "Continue seu anúncio"); no computador ele segue na faixa reservada.
   E247 — anexos da conferência (check-in/check-out) com o seletor do site em português, sem o nativo cru em inglês.
   E248 — fileiras que rolam (subabas de Contratos, filtros de Mensagens) mostram "›" quando há item fora da tela.
   E249 — "Início da estadia" aparece UMA vez no cartão Contrato.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t649.${sufixo}@lab.vivanomads.test`, nome: "Helena Lote", role: "owner" as const };
const mor = { email: `mor.t649.${sufixo}@lab.vivanomads.test`, nome: "Bruno Lote", role: "tenant" as const };
const ids: Record<string, string> = {};

const flutuanteVisivel = (p: Page) =>
  p.evaluate(() => {
    const f = document.querySelector("[data-testid=fale-com-a-viva-raiz]") as HTMLElement | null;
    if (!f) return false;
    const r = f.getBoundingClientRect();
    return getComputedStyle(f).display !== "none" && r.width > 0 && r.height > 0;
  });

test.describe("T649 — E246 + E247 + E248 + E249", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "default", timeout: 150_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.mor = await criarConta(mor, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.mor]);
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    ids.im = await criarImovelPronto(ids.dono, `Studio do lote ${sufixo}`, { ativo: true });
    ids.r = await criarImovelPronto(ids.dono, `Rascunho do lote ${sufixo}`, { semInternet: true });
    for (const i of [ids.im, ids.r]) await fotosReais(i, ids.dono);
    await criarLead(ids.dono, ids.mor, ids.im, true);
    await gravarMensagem(ids.mor, ids.dono, ids.im, "Olá! Tenho interesse.", conversationId(ids.mor, ids.dono, ids.im));
    const t = new Date().toISOString();
    const { data: c, error } = await adm().from("contratos").insert({ property_id: ids.im, tenant_id: ids.mor, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 768, qtd_ocupantes: 1, garantia: "caucao", status: "ativo", assinado_proprietario_em: t, assinado_inquilino_em: t }).select("id").single();
    if (error) throw error;
    ids.c = c!.id as string;
    await tornarContratoVigente(ids.c, ids.dono);
  });
  test.afterAll(async () => {
    if (ids.c) {
      await adm().from("pagamentos_bloco").delete().eq("contrato_id", ids.c);
      await adm().from("contrato_blocos").delete().eq("contrato_id", ids.c);
      await adm().from("contratos").delete().eq("id", ids.c);
    }
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.mor]);
  });

  test("E246 — 390 px: sem flutuante sobre Contratos e Início; 1280 px: ele continua (faixa reservada)", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    for (const url of ["/dashboard/contratos", "/dashboard"]) {
      await p.goto(url, { waitUntil: "domcontentloaded" });
      await p.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await p.waitForTimeout(800);
      expect(await flutuanteVisivel(p), `${url} a 390`).toBe(false);
      await p.screenshot({ path: `${SAIDA}/t649-flutuante-${url === "/dashboard" ? "inicio" : "contratos"}-390.png` });
    }
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("fale-com-a-viva")).toBeVisible({ timeout: 20_000 });
    await p.context().close();
  });

  for (const largura of [390, 1280] as const) {
    test(`E247 + E249 — ${largura} px: anexos em português e "Início da estadia" uma vez`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto(`/dashboard/contratos/${ids.c}`, { waitUntil: "domcontentloaded" });
      await expect(p.locator("#contrato")).toBeVisible({ timeout: 30_000 });
      await p.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      // E249
      const inicios = await p.locator("#contrato").evaluate((el) => (el as HTMLElement).innerText.match(/Início da estadia/g)?.length ?? 0);
      expect(inicios, "'Início da estadia' no cartão Contrato").toBe(1);
      // E247: nenhum seletor nativo visível; o botão do site, em português.
      const nativos = await p.evaluate(() =>
        Array.from(document.querySelectorAll("input[type=file]")).filter((i) => {
          const r = i.getBoundingClientRect();
          return r.width > 2 && r.height > 2;
        }).length,
      );
      expect(nativos, "input de arquivo nativo visível").toBe(0);
      await expect(p.getByTestId("conferencia-entrada-foto-botao")).toContainText("Escolher foto do cômodo");
      await expect(p.getByText(/Choose File|No file chosen/)).toHaveCount(0);
      // O botão abre o arquivo de verdade (o input continua funcionando).
      await p.getByTestId("conferencia-entrada-foto").setInputFiles({ name: "sala.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
      await expect(p.getByTestId("conferencia-entrada-foto-escolhida")).toContainText("sala.png");
      await p.getByTestId("conferencia-entrada-form").screenshot({ path: `${SAIDA}/t649-anexo-${largura}.png` });
      await p.locator("#contrato").screenshot({ path: `${SAIDA}/t649-contrato-${largura}.png` });
      await p.context().close();
    });
  }

  test("E248 — 390 px: subabas e filtros mostram '›' quando há item fora; ao tocar, o último aparece inteiro", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    const sub = p.getByTestId("subabas-proprietario");
    await expect(sub).toBeVisible({ timeout: 30_000 });
    const conjunto = p.locator("[data-fileira-rolavel]").filter({ has: sub });
    await expect(conjunto.getByTestId("fileira-seta-dir")).toBeVisible();
    await p.screenshot({ path: `${SAIDA}/t649-subabas-390.png` });
    await conjunto.getByTestId("fileira-seta-dir").click();
    await conjunto.getByTestId("fileira-seta-dir").click().catch(() => {});
    await p.waitForTimeout(700);
    const ultimo = await sub.locator("a").last().evaluate((a) => { const r = a.getBoundingClientRect(); return { left: r.left, right: r.right, vw: document.documentElement.clientWidth }; });
    expect(ultimo.right, "último item inteiro na tela").toBeLessThanOrEqual(ultimo.vw);
    await p.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
    const filtros = p.locator("[data-fileira-rolavel]").filter({ has: p.getByRole("group", { name: "Filtrar conversas" }) });
    await expect(filtros.getByTestId("fileira-seta-dir")).toBeVisible({ timeout: 30_000 });
    await p.screenshot({ path: `${SAIDA}/t649-filtros-390.png` });
    // No computador cabe tudo: nenhuma seta.
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("subabas-proprietario")).toBeVisible({ timeout: 30_000 });
    await expect(p.getByTestId("fileira-seta-dir")).toHaveCount(0);
    await p.context().close();
  });
});
