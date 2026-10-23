import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { VERSAO_CONFORTO } from "../../../src/config/conforto-minimo";

/*
  T309 — 59-C1: o padrão mínimo persiste no editor do anúncio (QA do Muse em produção, 23/10). Só no laboratório.
   1. Rascunho com 8 fotos e documento aprovado → Comodidades → "Confirmo todos" → "Confirmação salva" (sem tocar em
      Salvar) → RECARREGAR → os 12 continuam confirmados → "Salvar como rascunho" logo depois de recarregar (foi o que
      mandou [] em produção) → os 12 continuam → Publicar → anúncio ativo.
   2. Autosave: a operação vai junto (imóvel próprio = sem sublocação) e o selo é "Salvo", nunca "Sem conexão".
  A linha antiga "própria com sublocação" não se cria no laboratório (a própria restrição da 0200 recusa a fixture):
  esse caminho está no teste de unidade (src/lib/conforto/gravacao.test.ts) e no reteste do Muse com 4a693a63.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.59c1.${sufixo}@lab.vivanomads.test`, nome: "Sara Persiste", role: "owner" as const };
const TITULO = `Studio que persiste 59-C1 ${sufixo}`;
const ids: { dono?: string; imovel?: string; outro?: string } = {};

async function confirmadosNoBanco(id: string): Promise<number> {
  const { data } = await adm().from("conforto_declaracoes").select("chave, confirmado, versao_lista").eq("property_id", id);
  return (data ?? []).filter((d) => d.confirmado && d.versao_lista === VERSAO_CONFORTO).length;
}

async function abrir(page: Page, etapa: string) {
  await page.goto(`/dashboard/imoveis/novo?draft=${ids.imovel}&etapa=${etapa}`, { waitUntil: "domcontentloaded" });
}

test.describe("T309 — 59-C1: o padrão mínimo persiste no editor", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { semConforto: true });
    const fotos = Array.from({ length: 8 }, (_, i) => {
      const caminho = `${ids.dono}/${ids.imovel}-${i}.png`;
      return { id: `lab-${i}`, url: `https://lab.vivanomads.test/storage/v1/object/public/property-photos/${caminho}`, name: "", path: caminho, demo: false };
    });
    // O estado do editor que um rascunho completo deixa (tudo pronto, menos o padrão mínimo).
    const { error } = await adm()
      .from("properties")
      .update({
        draft_data: {
          title: TITULO,
          description: "Studio mobiliado no Centro, com home office, internet rápida e cozinha completa. Pronto para morar.",
          propertyType: "Studio",
          bedrooms: "1",
          bathrooms: "1",
          areaM2: "40",
          maxGuests: "2",
          minPeriod: "30",
          maxPeriod: "180",
          monthlyPrice: "3200",
          street: "Rua Santos Dumont",
          numero: "100",
          neighborhood: "Centro",
          city: "Uberlândia",
          uf: "MG",
          cep: "38400-060",
          garantias: { caucao: true },
          privacidade: { semCamerasInterior: true, camerasExternas: false, tipoAcesso: "chave", senhaTrocadaEstadia: false },
          ownershipType: "own",
          subleaseAuthorized: false,
          photos: fotos,
          iaAnalisadas: fotos.map((f) => f.url),
          step: 3,
          ordemEtapas: 4,
          etapaMax: 5,
        },
      })
      .eq("id", ids.imovel!);
    if (error) throw error;
    // "Antes de anunciar" respondido (a qualificação do rascunho vem do servidor).
    const { error: eQual } = await adm()
      .from("qualification_checklists")
      // O "documento enviado" da qualificação sai do document_path (criarImovelPronto grava só o "aprovado").
      .update({ document_path: `${ids.dono}/${ids.imovel}-documento.png`, formulario: { versao: 1, elig: { furnished: true, accepts30days: true, iptuOk: true, habitable: true, isOwnerOrAgent: true, condoAllows: "yes" } } })
      .eq("property_id", ids.imovel!);
    if (eQual) throw eQual;
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1. 'Confirmo todos' salva sozinho, sobrevive ao recarregar e ao 'Salvar como rascunho', e o anúncio publica", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
    await abrir(page, "comodidades");
    const todos = page.getByTestId("conforto-marcar-todos");
    await expect(todos).toBeEnabled({ timeout: 30_000 });
    await todos.click();
    const salvamento = page.getByTestId("conforto-salvamento");
    await expect(salvamento).toHaveAttribute("data-estado", "salvo", { timeout: 20_000 });
    await expect(salvamento).toHaveText("Confirmação salva");
    expect(await confirmadosNoBanco(ids.imovel!)).toBe(12);
    await page.screenshot({ path: "tests/laboratorio/saida/t309-1-confirmacao-salva-390.png", fullPage: true });

    // Recarregar: o checklist volta do servidor com os 12.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("conforto-checklist")).toHaveAttribute("data-faltam", "0", { timeout: 30_000 });
    await expect(page.getByTestId("conforto-faltam")).toHaveText("Todos os itens confirmados.");

    // "Salvar como rascunho" logo depois de recarregar (o caminho que desmarcou tudo em produção).
    await abrir(page, "5");
    await expect(page.getByRole("heading", { name: "Revisar e publicar" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Salvar como rascunho" }).click();
    await page.waitForURL(/\/dashboard\/imoveis$/, { timeout: 30_000 });
    expect(await confirmadosNoBanco(ids.imovel!)).toBe(12);

    // Publicar: sem "Falta confirmar" do padrão mínimo; o anúncio fica ativo.
    await abrir(page, "5");
    await expect(page.getByRole("heading", { name: "Revisar e publicar" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("publicar-falta-conforto")).toHaveCount(0);
    await page.getByTestId("aceite-ia").getByRole("checkbox").check();
    const publicar = page.getByTestId("publicar-anuncio");
    const faltaOutros = page.getByTestId("publicar-falta-outros");
    await expect(publicar.and(page.locator(":enabled")).or(faltaOutros)).toBeVisible({ timeout: 20_000 });
    expect(await faltaOutros.isVisible() ? await faltaOutros.innerText() : "", "nada mais falta para publicar").toBe("");
    await publicar.click();
    await page.waitForURL(/\/dashboard\/imoveis$/, { timeout: 30_000 });
    const { data: pub } = await adm().from("properties").select("status").eq("id", ids.imovel!).single();
    expect(pub!.status).toBe("active");
    expect(await confirmadosNoBanco(ids.imovel!)).toBe(12);
    await page.context().close();
  });

  test("2. autosave grava a operação junto e não mostra 'Sem conexão'", async ({ browser }) => {
    // Um 2º rascunho, com a operação "sublocação autorizada" no banco e "É meu" no estado do editor (draft_data): ao abrir,
    // o autosave grava own + sem sublocação pela regra do updateProperty (a linha antiga "própria com sublocação" a 0200
    // recusa até na fixture, então o caminho dela fica no teste de unidade).
    const outro = await criarImovelPronto(ids.dono!, `${TITULO} (2)`);
    ids.outro = outro;
    const { error } = await adm()
      .from("properties")
      .update({
        ownership_type: "subleased",
        sublease_authorized: true,
        draft_data: { title: `${TITULO} (2)`, description: "Rascunho para conferir o autosave da operação no laboratório.", monthlyPrice: "3200", ownershipType: "own", subleaseAuthorized: false, step: 3, ordemEtapas: 4, etapaMax: 5 },
      })
      .eq("id", outro);
    if (error) throw error;
    const page = await entrar(browser, dono.email, senha);
    await page.goto(`/dashboard/imoveis/novo?draft=${outro}&etapa=comodidades`, { waitUntil: "domcontentloaded" });
    await expect
      .poll(async () => (await adm().from("properties").select("ownership_type, sublease_authorized").eq("id", outro).single()).data, { timeout: 30_000 })
      .toMatchObject({ ownership_type: "own", sublease_authorized: false });
    // Pelo selo do salvamento: se falhar, o relatório mostra o texto real ("Salvando…", "Não foi possível salvar: …").
    await expect(page.getByTestId("estado-salvamento")).toHaveText(/^Salvo/, { timeout: 20_000 });
    await expect(page.getByText(/Sem conexão|Não foi possível salvar/)).toHaveCount(0);
    await page.context().close();
  });
});

