import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2207 — E1060 (linha Mensagens; ORDEM-DUET-315). As travas que sustentam a re-prova do fecho das Mensagens depois do
  #4063. Na prova ao vivo de 20/11: com a visita já confirmada, o dono abria Visitas e via "Nenhuma visita ainda", e o
  alerta crítico "Pedido de visita" (ação "Confirmar a visita") continuava no topo do painel.
  Vizinha do E1242 (ORDEM-DUET 1247): corre também no portão do E1242 reaberto, porque a leitura do sino e da faixa
  mudou da rota para avisos-telas.ts (uma regra de resolução para todas as superfícies).
  O caminho, todo pela tela: o morador pede a visita na página do imóvel → o dono vê a faixa crítica "Pedido de visita"
  → o dono confirma (com o link da chamada) → depois:
    1. o dono abre /dashboard/visitas (SEM ?de=dono, como pelo menu) e vê a visita confirmada, não "Nenhuma visita ainda";
    2. o morador abre /dashboard/visitas e vê a mesma visita confirmada;
    3. a faixa crítica "Pedido de visita" sai do painel do dono (e o aviso não volta como crítico pendente na API do sino).
  Visita por vídeo, como a t168 (presencial pediria a massa do endereço; o caminho de Visitas e do alerta é o mesmo).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2207.${sufixo}@lab.vivanomads.test`, nome: "Dora Visitas", role: "owner" as const };
const inq = { email: `inq.t2207.${sufixo}@lab.vivanomads.test`, nome: "Iara Visitante", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string } = {};
const TITULO = `Visita E1060 ${sufixo}`;
const LINK = "https://meet.google.com/abc-defg-hij";

async function abrir(browser: Browser, email: string, largura = 1280): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  return page;
}

/** Os avisos críticos pendentes do dono, como a faixa os lê (a API do sino, com a sessão do dono). */
async function criticosDoSino(page: Page): Promise<{ evento: string; titulo: string }[]> {
  const r = await page.request.get("/api/painel/avisos");
  expect(r.ok(), "a API do sino responde").toBe(true);
  const j = (await r.json()) as { criticos?: { evento: string; titulo: string }[] };
  return (j.criticos ?? []).map((a) => ({ evento: a.evento, titulo: a.titulo }));
}

test.describe("T2207 — E1060: a visita confirmada aparece em Visitas para os dois e o alerta 'Pedido de visita' sai @E1060", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true });
  });
  test.afterAll(async () => {
    if (ids.imovel) await adm().from("visitas_video").delete().eq("property_id", ids.imovel);
    await apagarContas([ids.dono!, ids.inq!].filter(Boolean));
  });

  test("1. o morador pede a visita pela página do imóvel; o dono vê a faixa crítica 'Pedido de visita'", async ({ browser }) => {
    const p = await abrir(browser, inq.email);
    await p.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
    const horario = p.getByTestId("visita-video-horario-0");
    await expect(async () => {
      if (!(await horario.isVisible())) {
        const botao = p.getByTestId("visita-video-abrir").first();
        await botao.scrollIntoViewIfNeeded({ timeout: 3_000 });
        await botao.click({ timeout: 4_000 }).catch(() => botao.dispatchEvent("click"));
      }
      await expect(horario).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 40_000 });
    const quando = new Date(Date.now() + 2 * 24 * 3600_000);
    quando.setMinutes(0, 0, 0);
    const z = (n: number) => String(n).padStart(2, "0");
    await horario.fill(`${quando.getFullYear()}-${z(quando.getMonth() + 1)}-${z(quando.getDate())}T${z(quando.getHours())}:00`);
    const enviar = p.getByTestId("visita-video-enviar");
    await enviar.scrollIntoViewIfNeeded({ timeout: 5_000 });
    await enviar.click({ timeout: 6_000 }).catch(() => enviar.dispatchEvent("click"));
    await expect(p.getByTestId("visita-video-ok")).toBeVisible({ timeout: 25_000 });
    await p.context().close();

    const d = await abrir(browser, dono.email);
    await d.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("faixa-critico"), "o pedido chega ao dono como aviso crítico").toContainText("Pedido de visita", { timeout: 30_000 });
    await d.context().close();
  });

  test("2. o dono confirma com o link; Visitas mostra a visita confirmada aos dois (pelo menu, sem ?de=dono)", async ({ browser }) => {
    const d = await abrir(browser, dono.email, 390);
    await d.goto("/dashboard/visitas?de=dono", { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("visitas-recebidas")).toBeVisible({ timeout: 25_000 });
    await d.getByTestId("visita-link").fill(LINK);
    // E1060 (ORDEM-DUET-335): um "Pedido de visita" ANTIGO, sem ref_id (como os de antes da ligação à visita). O caminho da
    // resposta só resolve o aviso pelo ref_id da visita; este fica, e a faixa só o pode largar pela situação real das visitas.
    test.info().annotations.push({ type: "simulação", description: "o laboratório grava para o dono um aviso 'visita_pedida' antigo, sem ref_id" });
    const { data: novo } = await adm().from("avisos").select("evento, prioridade, titulo, url").eq("usuario_id", ids.dono!).eq("evento", "visita_pedida").is("resolvido_em", null).limit(1).maybeSingle();
    expect(novo, "o pedido da tela gravou o aviso 'visita_pedida' do dono").toBeTruthy();
    const { error: eAntigo } = await adm().from("avisos").insert({ ...novo!, usuario_id: ids.dono, ref_id: null, criado_em: new Date(Date.now() - 3 * 24 * 3600_000).toISOString() });
    if (eAntigo) throw eAntigo;
    await d.getByTestId("visita-confirmar").click();
    await expect
      .poll(async () => (await adm().from("visitas_video").select("status").eq("property_id", ids.imovel!).maybeSingle()).data?.status, { timeout: 25_000, message: "a confirmação grava" })
      .toBe("confirmado");
    await d.context().close();

    for (const largura of [390, 1280] as const) {
      // O dono, como chega pelo menu: /dashboard/visitas sem parâmetro.
      const pd = await abrir(browser, dono.email, largura);
      await pd.goto("/dashboard/visitas", { waitUntil: "domcontentloaded" });
      await expect(pd.getByText("Nenhuma visita ainda"), `${largura}: o dono não fica sem a visita confirmada`).toHaveCount(0, { timeout: 25_000 });
      await expect(pd.getByTestId("visitas-recebidas"), `${largura}: o dono vê as visitas nos imóveis dele`).toBeVisible({ timeout: 25_000 });
      await expect(pd.getByTestId("visita-status").first(), `${largura}: a do dono está confirmada`).toHaveText("Confirmada", { timeout: 25_000 });
      await pd.context().close();

      const pm = await abrir(browser, inq.email, largura);
      await pm.goto("/dashboard/visitas", { waitUntil: "domcontentloaded" });
      await expect(pm.getByTestId("visitas-minhas"), `${largura}: o morador vê o pedido dele`).toBeVisible({ timeout: 25_000 });
      await expect(pm.getByTestId("visita-status").first(), `${largura}: a do morador está confirmada`).toHaveText("Confirmada", { timeout: 25_000 });
      await expect(pm.getByTestId("visita-link-chamada")).toHaveAttribute("href", LINK);
      await pm.context().close();
    }
  });

  test("3. depois da confirmação, a faixa crítica 'Pedido de visita' sai do painel do dono", async ({ browser }) => {
    const d = await abrir(browser, dono.email);
    await d.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await d.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const criticos = await criticosDoSino(d);
    expect(criticos.filter((c) => c.evento === "visita_pedida"), "nenhum 'Pedido de visita' crítico pendente na API do sino").toEqual([]);
    await expect(d.getByTestId("faixa-critico").filter({ hasText: "Pedido de visita" }), "a faixa não pede mais para confirmar a visita").toHaveCount(0, { timeout: 15_000 });
    await d.context().close();
  });
});
