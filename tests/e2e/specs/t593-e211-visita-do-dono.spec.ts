import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T593 — E211: o proprietário abre o detalhe da visita (/dashboard/visitas/<id>) pela Agenda, pela lista "Visitas"
  de Interessados e pelo cartão. O detalhe mostra status, horário, imóvel, quem vem (1º nome após o aceite) e tipo;
  a presencial confirmada traz o endereço exato + "Abrir no mapa"; a pedida, só a região; a por vídeo que já passou
  não oferece "Entrar na chamada" e segue com "Marcar como feita". Outra conta não abre o detalhe (404).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t593.${sufixo}@lab.vivanomads.test`, nome: "Dora Agenda", role: "owner" as const };
const mor = { email: `mor.t593.${sufixo}@lab.vivanomads.test`, nome: "Lia Visitante", role: "tenant" as const };
const outro = { email: `outro.t593.${sufixo}@lab.vivanomads.test`, nome: "Otto Fora", role: "tenant" as const };
const ids: Record<string, string> = {};
const H = 3600_000;
const RUA = "Rua das Visitas, 50";

async function visita(imovel: string, horario: Date, modalidade: "presencial" | "video", status = "confirmado") {
  const iso = horario.toISOString();
  const { data, error } = await adm()
    .from("visitas_video")
    .insert({
      property_id: imovel,
      owner_id: ids.dono,
      tenant_id: ids.mor,
      horarios: [iso],
      modalidade,
      status,
      horario_confirmado: status === "confirmado" ? iso : null,
      link_chamada: modalidade === "video" ? "https://meet.google.com/abc-defg-hij" : null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

test.describe("T593 — E211: detalhe da visita para o proprietário", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.mor = await criarConta(mor, senha);
    ids.outro = await criarConta(outro, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Casa visitas t593 ${sufixo}`, { ativo: true });
    ids.pedidaImovel = await criarImovelPronto(ids.dono, `Casa pedida t593 ${sufixo}`, { ativo: true });
    // Uma visita aberta por morador, imóvel e tipo (visitas_video_um_aberto_modalidade): a futura por vídeo vai em outro imóvel.
    ids.videoImovel = await criarImovelPronto(ids.dono, `Casa vídeo t593 ${sufixo}`, { ativo: true });
    await adm().from("properties").update({ exact_address: RUA }).in("id", [ids.imovel, ids.pedidaImovel, ids.videoImovel]);
    await criarLead(ids.dono, ids.mor, ids.imovel, true);
    ids.presencial = await visita(ids.imovel, new Date(Date.now() + 2 * 24 * H), "presencial");
    ids.videoPassada = await visita(ids.imovel, new Date(Date.now() - 2 * 24 * H), "video");
    ids.videoFutura = await visita(ids.videoImovel, new Date(Date.now() + 3 * 24 * H), "video");
    ids.pedida = await visita(ids.pedidaImovel, new Date(Date.now() + 4 * 24 * H), "presencial", "pedido");
  });

  test.afterAll(async () => {
    await adm().from("visitas_video").delete().eq("owner_id", ids.dono ?? "");
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.mor, ids.outro, ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — Agenda e Interessados levam ao detalhe; presencial confirmada com endereço e mapa`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });

      await p.goto("/dashboard/agenda", { waitUntil: "domcontentloaded" });
      await p.getByTestId("agenda-vista-lista").click({ timeout: 30_000 });
      await expect(p.locator(`a[href="/dashboard/visitas/${ids.presencial}"]`).first()).toBeAttached({ timeout: 30_000 });
      await expect(p.locator('a[href^="/dashboard/visitas#"]')).toHaveCount(0);

      await p.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
      await expect(p.locator('a[href="/dashboard/visitas?de=dono"]').first()).toBeAttached({ timeout: 30_000 });

      await p.goto("/dashboard/visitas?de=dono", { waitUntil: "domcontentloaded" });
      const ver = p.locator(`#visita-${ids.presencial}`).getByTestId("visita-ver-detalhes");
      await expect(ver).toHaveAttribute("href", `/dashboard/visitas/${ids.presencial}`, { timeout: 30_000 });
      await ver.click();
      await p.waitForURL(`**/dashboard/visitas/${ids.presencial}`);

      const d = p.getByTestId("visita-detalhe");
      await expect(d).toHaveAttribute("data-papel", "dono", { timeout: 30_000 });
      await expect(p.getByRole("heading", { level: 1 })).toContainText("Casa visitas t593");
      await expect(d.getByTestId("visita-status")).toHaveText("Confirmada");
      await expect(d.getByTestId("visita-pessoa")).toContainText("Lia");
      await expect(d.getByTestId("visita-pessoa")).not.toContainText("Visitante");
      await expect(d.getByTestId("visita-endereco")).toContainText(RUA);
      await expect(d.getByTestId("visita-abrir-mapa")).toHaveAttribute("href", /google\.com\/maps\/search\/\?api=1&query=Rua%20das%20Visitas/);
      await expect(d.getByTestId("visita-cancelar")).toBeVisible();
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await p.screenshot({ path: `${SAIDA}/t593-presencial-${largura}.png`, fullPage: true });
      await p.context().close();
    });

    test(`${largura} px — vídeo: a passada sem "Entrar na chamada" e com "Marcar como feita"; a futura com o link; a pedida só com a região`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });

      await p.goto(`/dashboard/visitas/${ids.videoPassada}`, { waitUntil: "domcontentloaded" });
      const d = p.getByTestId("visita-detalhe");
      await expect(d.getByTestId("visita-status")).toHaveText("Horário passou", { timeout: 30_000 });
      await expect(d.getByTestId("visita-link-chamada")).toHaveCount(0);
      await expect(d.getByTestId("visita-concluir")).toBeVisible();
      await p.screenshot({ path: `${SAIDA}/t593-video-passada-${largura}.png`, fullPage: true });

      await p.goto(`/dashboard/visitas/${ids.videoFutura}`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("visita-detalhe").getByTestId("visita-link-chamada")).toHaveText("Entrar na chamada", { timeout: 30_000 });

      await p.goto(`/dashboard/visitas/${ids.pedida}`, { waitUntil: "domcontentloaded" });
      const pd = p.getByTestId("visita-detalhe");
      await expect(pd.getByTestId("visita-endereco-oculto")).toContainText("Centro", { timeout: 30_000 });
      await expect(pd.getByTestId("visita-endereco")).toHaveCount(0);
      await expect(pd.getByTestId("visita-pessoa")).toContainText("Interessado(a)");
      expect(await p.content()).not.toContain("Rua das Visitas");
      await p.screenshot({ path: `${SAIDA}/t593-pedida-${largura}.png`, fullPage: true });
      await p.context().close();
    });
  }

  test("390 px — o morador abre o mesmo detalhe; outra conta recebe 404", async ({ browser }) => {
    const m = await entrar(browser, mor.email, senha);
    await m.setViewportSize({ width: 390, height: 844 });
    await m.goto(`/dashboard/visitas/${ids.presencial}`, { waitUntil: "domcontentloaded" });
    await expect(m.getByTestId("visita-detalhe")).toHaveAttribute("data-papel", "morador", { timeout: 30_000 });
    await expect(m.getByTestId("visita-endereco")).toContainText(RUA);
    await m.context().close();

    const o = await entrar(browser, outro.email, senha);
    const r = await o.goto(`/dashboard/visitas/${ids.presencial}`, { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(404);
    expect(await o.content()).not.toContain("Rua das Visitas");
    await o.context().close();
  });
});
