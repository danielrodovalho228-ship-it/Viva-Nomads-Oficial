import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { nomeCompleto, nomeCurto } from "../../../src/lib/perfil/perfil-publico";

/*
  T923 — E427 (resto; prova ao vivo 05/11): na visita confirmada o morador vê o nome COMPLETO do dono, mas "Sobre o
  proprietário" na página do ANÚNCIO seguia abreviado — a mesma pessoa com dois nomes. Regra aprovada: antes do aceite, o
  nome curto para todos; depois do aceite (visita confirmada), o completo, só para quem tem o aceite com ESTE dono — o mesmo
  de "Quem recebe" e de /proprietario/[id]. A página do anúncio é estática e indexável: o HTML dela NUNCA leva o nome inteiro
  (nem para quem tem o aceite; o nome completo chega depois, do servidor). 390 e 1280. Só no laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const NOME = "Dora Prado Lima 2";
const COMPLETO = nomeCompleto(NOME)!;
const CURTO = nomeCurto(NOME)!;
const dono = { email: `dono.t923.${sufixo}@lab.vivanomads.test`, nome: NOME, role: "owner" as const };
const inq = { email: `inq.t923.${sufixo}@lab.vivanomads.test`, nome: "Iara Visita Sobrenome", role: "tenant" as const };
const outra = { email: `out.t923.${sufixo}@lab.vivanomads.test`, nome: "Olga Outra Pessoa", role: "tenant" as const };
const ids: Record<string, string> = {};

test.describe("T923 — E427: o nome do dono na página do anúncio segue a mesma regra", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.outra = await criarConta(outra, senha);
    await adm().from("profiles").update({ full_name: NOME }).eq("id", ids.dono);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio nome t923 ${sufixo}`, { ativo: true, preco: 2600 });
    const amanha = new Date(Date.now() + 26 * 3600_000).toISOString();
    const { data, error } = await adm().from("visitas_video").insert({ property_id: ids.imovel, owner_id: ids.dono, tenant_id: ids.inq, horarios: [amanha], modalidade: "video" }).select("id").single();
    if (error) throw error;
    ids.visita = (data as { id: string }).id;
  });
  test.afterAll(async () => {
    await adm().from("visitas_video").delete().eq("id", ids.visita ?? "");
    await apagarContas([ids.dono, ids.inq, ids.outra]);
  });

  test("ANTES do aceite, e para quem não tem aceite com este dono: nome curto; o HTML nunca leva o inteiro", async ({ browser, request }) => {
    const html = await (await request.get(`/imoveis/${ids.imovel}`)).text();
    expect(html, "o HTML estático não leva o nome inteiro").not.toContain("Prado Lima");
    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const pa = await anon.newPage();
    const pi = await entrar(browser, inq.email, senha); // visita só pedida: ainda sem aceite
    const po = await entrar(browser, outra.email, senha); // sem relação nenhuma com este dono
    for (const w of [390, 1280] as const) {
      for (const page of [pa, pi, po]) {
        await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
        await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
        const nome = page.getByTestId("proprietario-nome");
        await expect(nome).toHaveText(CURTO, { timeout: 30_000 });
        await page.waitForTimeout(1500); // o pedido do nome do aceite já respondeu: sem aceite, segue curto
        await expect(nome).toHaveText(CURTO);
        await expect(page.getByTestId("sobre-proprietario")).not.toContainText("Prado Lima");
      }
    }
    await anon.close();
    await pi.context().close();
    await po.context().close();
  });

  test("DEPOIS do aceite (visita confirmada): o morador vê o MESMO nome completo da visita; os outros seguem curtos", async ({ browser }) => {
    const { error } = await adm().from("visitas_video").update({ status: "confirmado", horario_confirmado: new Date(Date.now() + 26 * 3600_000).toISOString() }).eq("id", ids.visita);
    expect(error).toBeNull();
    const pi = await entrar(browser, inq.email, senha);
    const po = await entrar(browser, outra.email, senha);
    for (const w of [390, 1280] as const) {
      await pi.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await pi.goto(`/dashboard/visitas/${ids.visita}`, { waitUntil: "domcontentloaded" });
      await expect(pi.getByTestId("visita-pessoa-dono")).toContainText(`Quem recebe: ${COMPLETO}`, { timeout: 30_000 });
      await pi.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
      const nome = pi.getByTestId("proprietario-nome");
      await expect(nome, "página do anúncio = visita").toHaveText(COMPLETO, { timeout: 30_000 });
      expect(await pi.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await pi.screenshot({ path: `tests/laboratorio/saida/t923-anuncio-depois-${w}.png` });

      await po.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await po.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
      await expect(po.getByTestId("proprietario-nome")).toHaveText(CURTO, { timeout: 30_000 });
      await po.waitForTimeout(1500);
      await expect(po.getByTestId("proprietario-nome")).toHaveText(CURTO);
    }
    await pi.context().close();
    await po.context().close();
  });
});
