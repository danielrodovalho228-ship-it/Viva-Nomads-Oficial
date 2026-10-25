import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";

/*
  T456 — E111-A: comodidades conforme o tipo do imóvel. Só no laboratório (conta e rascunhos novos).
   1. Passo 5, a 390 e 1280 px: apartamento com "No prédio" e "Prédio / condomínio" (com elevador); casa de condomínio
      com "No condomínio" e "Condomínio" (sem elevador); chácara sem nenhum item de prédio, com piscina, churrasqueira e
      vaga em "Área externa e garagem". Prints dos três.
   2. Troca de tipo: o "Elevador" marcado na chácara não aparece, mas fica salvo; de volta a apartamento, volta marcado.
   3. Anúncio público de chácara com "Elevador" e "Portaria 24h" salvos não mostra os dois (e mostra a piscina).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t456.${sufixo}@lab.vivanomads.test`, nome: "Lia Comodidades", role: "owner" as const };
const ids: { dono?: string } = {};
const rascunhos: Record<string, string> = {};
const SAIDA = "tests/laboratorio/saida";
const TIPOS = ["apartamento", "casa_condominio", "chacara"] as const;
const SO_PREDIO = ["sala_reuniao", "coworking", "cabine_chamadas", "academia", "portaria_24h", "elevador", "salao_festas", "lavanderia", "bicicletario"];

async function gravarTipo(id: string, tipo: string, amenityKeys: Record<string, boolean>) {
  const { error } = await adm()
    .from("properties")
    .update({ property_type: tipo, draft_data: { title: `Imóvel ${tipo} ${sufixo}`, propertyType: tipo, amenityKeys } })
    .eq("id", id);
  if (error) throw error;
}

async function abrirComodidades(page: Page, id: string) {
  await page.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=comodidades`, { waitUntil: "domcontentloaded" });
  await noPasso(page, "comodidades", 30_000);
  return page.getByTestId("etapa-encontramos");
}
const titulo = (etapa: ReturnType<Page["getByTestId"]>, grupo: string) => etapa.locator(`[data-grupo="${grupo}"] > p`).first();
const botao = (etapa: ReturnType<Page["getByTestId"]>, chave: string) => etapa.locator(`[data-comodidade="${chave}"]`);

test.describe("T456 — E111-A: comodidades conforme o tipo do imóvel", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (cria conta e rascunhos).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    for (const t of TIPOS) {
      rascunhos[t] = await criarImovelPronto(ids.dono, `Imóvel ${t} ${sufixo}`);
      await gravarTipo(rascunhos[t], t, { elevador: true, piscina: true, ar_condicionado: true });
    }
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`1. a ${w} px: Passo 5 do apartamento, da casa de condomínio e da chácara`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });

      let etapa = await abrirComodidades(page, rascunhos.apartamento);
      await expect(titulo(etapa, "trabalho")).toHaveText("No prédio");
      await expect(titulo(etapa, "edificio")).toHaveText("Prédio / condomínio");
      for (const k of SO_PREDIO) await expect(botao(etapa, k), k).toHaveCount(1);
      await expect(botao(etapa, "elevador")).toHaveAttribute("aria-pressed", "true");
      await etapa.locator('[data-grupo="edificio"]').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t456-apartamento-${w}.png` });

      etapa = await abrirComodidades(page, rascunhos.casa_condominio);
      await expect(titulo(etapa, "trabalho")).toHaveText("No condomínio");
      await expect(titulo(etapa, "edificio")).toHaveText("Condomínio");
      await expect(botao(etapa, "elevador")).toHaveCount(0);
      await expect(botao(etapa, "academia")).toHaveCount(1);
      await etapa.locator('[data-grupo="edificio"]').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t456-casa-condominio-${w}.png` });

      etapa = await abrirComodidades(page, rascunhos.chacara);
      await expect(etapa.locator('[data-grupo="trabalho"]')).toHaveCount(0);
      await expect(titulo(etapa, "edificio")).toHaveText("Área externa e garagem");
      for (const k of SO_PREDIO) await expect(botao(etapa, k), k).toHaveCount(0);
      await expect(etapa.locator('[data-grupo="edificio"] [data-comodidade]')).toHaveCount(3);
      await expect(botao(etapa, "piscina")).toHaveAttribute("aria-pressed", "true");
      await etapa.locator('[data-grupo="edificio"]').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t456-chacara-${w}.png` });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await page.context().close();
    });
  }

  test("2. troca de tipo: o elevador marcado fica salvo na chácara e volta no apartamento", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    const id = rascunhos.chacara;
    const etapa = await abrirComodidades(page, id);
    await expect(botao(etapa, "elevador")).toHaveCount(0);
    // Mexe numa comodidade visível: o rascunho salva sozinho, com o elevador escondido junto.
    await botao(etapa, "churrasqueira").click();
    await expect(botao(etapa, "churrasqueira")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/^Salvo/)).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(async () => {
        const { data } = await adm().from("properties").select("draft_data").eq("id", id).single();
        return (data?.draft_data as { amenityKeys?: Record<string, boolean> } | null)?.amenityKeys ?? {};
      }, { timeout: 30_000 })
      .toMatchObject({ elevador: true, churrasqueira: true });
    // O dono volta para apartamento: o elevador volta marcado.
    const { data } = await adm().from("properties").select("draft_data").eq("id", id).single();
    const salvo = data!.draft_data as Record<string, unknown>;
    await adm().from("properties").update({ property_type: "apartamento", draft_data: { ...salvo, propertyType: "apartamento" } }).eq("id", id);
    const deNovo = await abrirComodidades(page, id);
    await expect(botao(deNovo, "elevador")).toHaveAttribute("aria-pressed", "true");
    await expect(botao(deNovo, "churrasqueira")).toHaveAttribute("aria-pressed", "true");
    await page.context().close();
  });

  test("3. anúncio público de chácara não mostra 'Elevador' nem 'Portaria 24h' salvos", async ({ page }) => {
    const id = await criarImovelPronto(ids.dono!, `Chácara pública ${sufixo}`, { ativo: true });
    await adm().from("properties").update({ property_type: "chacara" }).eq("id", id);
    await adm().from("property_amenities").delete().eq("property_id", id);
    const { error } = await adm()
      .from("property_amenities")
      .insert([
        { property_id: id, category: "edificio", label: "Elevador" },
        { property_id: id, category: "edificio", label: "Portaria 24h" },
        { property_id: id, category: "edificio", label: "Piscina" },
      ]);
    if (error) throw error;
    await page.goto(`/imoveis/${id}`, { waitUntil: "domcontentloaded" });
    const comodidades = page.getByTestId("comodidades");
    await expect(comodidades).toContainText("Piscina", { timeout: 30_000 });
    await expect(comodidades).not.toContainText("Elevador");
    await expect(comodidades).not.toContainText("Portaria 24h");
  });
});
