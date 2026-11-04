import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";

/*
  T848 — E557: na Revisão do cadastro, "Tudo certo para publicar" só aparece com o "Publicar anúncio" HABILITADO.
  Cenário do QA: Passos 1 a 9 completos (todos ✓) e 1 coisa faltando fora da lista (aqui, o aceite do texto) — antes o
  título dizia "Tudo certo para publicar" ao lado do botão travado. Agora, travado, o título diz o que falta; com o
  aceite marcado, o botão libera e o título vira "Tudo certo para publicar". 1280 e 390. Só no laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
// Uma conta por largura: o aceite do termo pode ficar gravado na conta, e cada teste precisa começar sem ele.
const donoDe = (largura: number) => ({ email: `dono.e557.${largura}.${sufixo}@lab.vivanomads.test`, nome: "Rita Revisão", role: "owner" as const });
const contas: string[] = [];

test.describe("T848 — E557: 'Tudo certo' só com o Publicar liberado", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  /** Conta nova + rascunho "publicável" (a mesma montagem do t400), faltando só o aceite do texto. */
  async function montar(largura: number): Promise<string> {
    const ids: { dono?: string; imovel?: string } = {};
    const TITULO = `Chácara Revisão ${largura} ${sufixo}`;
    ids.dono = await criarConta(donoDe(largura), senha);
    contas.push(ids.dono);
    ids.imovel = await criarImovelPronto(ids.dono, TITULO);
    // O assistente lê o draft_data: a mesma montagem "publicável" do t400 (passo 3, com internet fibra e velocidade).
    const fotos = Array.from({ length: 8 }, (_, i) => {
      const caminho = `${ids.dono}/${ids.imovel}-${i}.png`;
      return { id: `lab-${i}`, url: `https://lab.vivanomads.test/storage/v1/object/public/property-photos/${caminho}`, name: "", path: caminho, demo: false };
    });
    const { error } = await adm()
      .from("properties")
      .update({
        property_type: "chacara",
        detalhes_anuncio: { chacara: { acesso: "terra", internet: "fibra", pontoMarcado: true } },
        draft_data: {
          title: TITULO,
          description: "Casa de chácara mobiliada, com home office, cozinha completa e varanda. Pronta para morar por temporada.",
          propertyType: "chacara",
          chacara: { acesso: "terra", internet: "fibra", ponto: { lat: -18.95, lng: -48.4 } },
          amenityKeys: { internet_fibra: true },
          internetMbps: "250",
          tipoEntrada: "porteiro",
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
          step: 9,
          ordemEtapas: 5,
          etapaMax: 9,
        },
      })
      .eq("id", ids.imovel);
    if (error) throw error;
    const { error: eQual } = await adm()
      .from("qualification_checklists")
      .update({ document_path: `${ids.dono}/${ids.imovel}-documento.png`, formulario: { versao: 1, elig: { furnished: true, accepts30days: true, iptuOk: true, habitable: true, isOwnerOrAgent: true, condoAllows: "yes" } } })
      .eq("property_id", ids.imovel!);
    if (eQual) throw eQual;
    return ids.imovel;
  }
  test.afterAll(async () => {
    await apagarContas(contas);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura}px: travado diz o que falta; liberado diz 'Tudo certo para publicar'`, async ({ browser }) => {
      const imovel = await montar(largura);
      const page = await entrar(browser, donoDe(largura).email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/dashboard/imoveis/novo?draft=${imovel}&etapa=revisao`, { waitUntil: "domcontentloaded" });
      await noPasso(page, "revisao", 30_000);

      const titulo = page.locator("#lista-conferencia-titulo");
      const publicar = page.locator('[data-testid="publicar-anuncio"]:visible').first();
      const caixa = page.getByTestId("aceite-ia").getByRole("checkbox");
      await expect(caixa).toBeVisible({ timeout: 20_000 });
      if (await caixa.isChecked()) await caixa.uncheck();

      // Travado (falta o aceite), com os Passos 1 a 9 todos ✓: nunca "tudo certo".
      await expect(page.getByTestId("lista-conferencia")).toHaveAttribute("data-faltam", "0", { timeout: 20_000 });
      await expect(publicar).toBeDisabled();
      await expect(titulo).not.toHaveText("Tudo certo para publicar");
      await expect(titulo).toHaveText(/^Falta/);
      await page.getByTestId("lista-conferencia").screenshot({ path: `tests/laboratorio/saida/t848-travado-${largura}.png` });

      // Liberado: o mesmo título vira "Tudo certo para publicar".
      await caixa.check();
      await expect(publicar).toBeEnabled({ timeout: 20_000 });
      await expect(titulo).toHaveText("Tudo certo para publicar");
      await page.getByTestId("lista-conferencia").screenshot({ path: `tests/laboratorio/saida/t848-liberado-${largura}.png` });
      await page.context().close();
    });
  }
});
