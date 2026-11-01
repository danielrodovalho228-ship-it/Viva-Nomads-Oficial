import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, pngDeTeste } from "../fixtures/laboratorio";

/**
 * T945 — E409 (#2050): depois do aceite, a outra parte vê o 1º nome + a inicial do sobrenome ("Lia V.") e a foto pela
 * regra do avatar — antes, só o 1º nome. Pela tela real (/dashboard/visitas/<id>), 390 e 1280:
 *   1. dono, visita CONFIRMADA: "Quem vem: Lia V." — nunca o sobrenome inteiro;
 *   2. dono, visita só PEDIDA: "Quem vem: Interessado(a)" — nem nome, nem foto (o aceite ainda não houve);
 *   3. morador, visita confirmada: "Quem recebe: Dora A." com a foto da dona (pública no contexto do imóvel dela), e a
 *      foto CARREGA de fato;
 *   4. dono, visita confirmada: a foto da moradora não aparece (sem relação aceita a regra do avatar não libera).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dona = { email: `dona.t945.${sufixo}@lab.vivanomads.test`, nome: "Dora Agenda Albuquerque", role: "owner" as const };
const mor = { email: `mor.t945.${sufixo}@lab.vivanomads.test`, nome: "Lia Maria Visitante", role: "tenant" as const };
const ids: Record<string, string> = {};
const H = 3600_000;
const LARGURAS = [390, 1280] as const;

async function visita(imovel: string, horario: Date, status: "confirmado" | "pedido") {
  const iso = horario.toISOString();
  const { data, error } = await adm()
    .from("visitas_video")
    .insert({ property_id: imovel, owner_id: ids.dona, tenant_id: ids.mor, horarios: [iso], modalidade: "presencial", status, horario_confirmado: status === "confirmado" ? iso : null })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}
async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test.describe("T945 — E409: nome com a inicial do sobrenome depois do aceite", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dona = await criarConta(dona, senha);
    ids.mor = await criarConta(mor, senha);
    // As duas com foto: a da dona é pública no contexto do imóvel dela; a da moradora só com relação aceita.
    for (const id of [ids.dona, ids.mor]) {
      const caminho = `${id}/avatar.webp`;
      await adm().storage.from("avatars").upload(caminho, pngDeTeste(9, 200, 200), { contentType: "image/webp", upsert: true });
      await adm().from("profiles").update({ avatar_url: caminho }).eq("id", id);
    }
    ids.imovel = await criarImovelPronto(ids.dona, `Casa nome t945 ${sufixo}`, { ativo: true });
    ids.imovelPedida = await criarImovelPronto(ids.dona, `Casa pedida t945 ${sufixo}`, { ativo: true });
    ids.confirmada = await visita(ids.imovel, new Date(Date.now() + 2 * 24 * H), "confirmado");
    ids.pedida = await visita(ids.imovelPedida, new Date(Date.now() + 4 * 24 * H), "pedido");
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("visitas_video").delete().eq("owner_id", ids.dona ?? "");
    await adm().storage.from("avatars").remove([`${ids.dona}/avatar.webp`, `${ids.mor}/avatar.webp`]);
    await apagarContas([ids.mor, ids.dona]);
  });

  test("dono: confirmada mostra 'Lia V.' (sem sobrenome, sem foto da moradora); pedida mostra 'Interessado(a)'", async ({ browser }) => {
    const p = await entrar(browser, dona.email, senha);
    for (const largura of LARGURAS) {
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto(`/dashboard/visitas/${ids.confirmada}`, { waitUntil: "domcontentloaded" });
      const d = p.getByTestId("visita-detalhe");
      await expect(d).toHaveAttribute("data-papel", "dono", { timeout: 30_000 });
      await expect(d.getByTestId("visita-pessoa")).toHaveText("Quem vem: Lia V.");
      await expect(d.getByTestId("visita-pessoa")).not.toContainText("Visitante");
      await expect(d.getByTestId("visita-pessoa")).not.toContainText("Maria");
      await expect(d.getByTestId("visita-pessoa-foto")).toHaveCount(0);
      await semRolagemLateral(p);

      await p.goto(`/dashboard/visitas/${ids.pedida}`, { waitUntil: "domcontentloaded" });
      const pd = p.getByTestId("visita-detalhe");
      await expect(pd.getByTestId("visita-pessoa")).toHaveText("Quem vem: Interessado(a)", { timeout: 30_000 });
      await expect(pd.getByTestId("visita-pessoa-foto")).toHaveCount(0);
      expect(await p.content()).not.toContain("Lia V.");
    }
    await p.context().close();
  });

  test("morador: confirmada mostra 'Quem recebe: Dora A.' com a foto da dona carregada", async ({ browser }) => {
    const m = await entrar(browser, mor.email, senha);
    for (const largura of LARGURAS) {
      await m.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await m.goto(`/dashboard/visitas/${ids.confirmada}`, { waitUntil: "domcontentloaded" });
      const d = m.getByTestId("visita-detalhe");
      await expect(d.getByTestId("visita-pessoa-dono")).toHaveText("Quem recebe: Dora A.", { timeout: 30_000 });
      await expect(d.getByTestId("visita-pessoa-dono")).not.toContainText("Albuquerque");
      const foto = d.getByTestId("visita-pessoa-dono-foto");
      await expect(foto).toBeVisible();
      await expect.poll(() => foto.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { timeout: 20_000 }).toBe(true);
      await semRolagemLateral(m);
    }
    await m.context().close();
  });
});
