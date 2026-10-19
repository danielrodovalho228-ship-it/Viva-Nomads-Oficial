import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { FOTOS_SERVICOS } from "../../../src/config/fotos-servicos";

/**
 * T219 — Serviços do morador (ordem 521c5af7 + complemento do coordenador, reteste do #869). 390 e 1280 px.
 * S1: catálogo em grade par (2 colunas a 390 px, 4 a 1280 px) só com as categorias do INQUILINO que já têm FOTO;
 * cartão "Em breve" abre o "Avise-me quando estiver disponível" (grava em interesse_servico); nota fixa pela chave;
 * "Meus pedidos" só com o estado vazio (o pedido e o acompanhamento chegam com o 31b); o Plano de manutenção do dono
 * não aparece; nenhum cartão sem foto (nada de ícone no lugar).
 */
const COM_FOTO = Object.keys(FOTOS_SERVICOS);

test.describe("T219 — Serviços do morador: catálogo com foto, Em breve → avise-me", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t219.${sufixo}@lab.vivanomads.test`, nome: "Dora Servicos", role: "owner" as const };
  const inq = { email: `inq.t219.${sufixo}@lab.vivanomads.test`, nome: "Iago Servicos", role: "tenant" as const };
  const ids: { dono?: string; inq?: string; imovel?: string; contrato?: string } = {};

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Servicos t219 ${sufixo}`, { ativo: true });
    const { data, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, status: "ativo", garantia: "caucao" })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
  });

  test.afterAll(async () => {
    await adm().from("interesse_servico").delete().eq("user_id", ids.inq!);
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("banco: nomes com acento e as 4 categorias do inquilino em breve; o plano do dono fica do dono", async () => {
    const { data } = await adm().from("servicos_adicionais").select("id, nome, quem_paga, status").order("id");
    const por = new Map(((data ?? []) as { id: string; nome: string; quem_paga: string; status: string }[]).map((s) => [s.id, s]));
    expect(por.get("assistencia_24h")?.nome).toBe("Assistência 24h");
    expect(por.get("plano_manutencao")?.nome).toBe("Plano de manutenção");
    expect(por.get("plano_manutencao")?.quem_paga).toBe("proprietario");
    for (const [id, nome] of [["limpeza", "Limpeza"], ["lavanderia_enxoval", "Lavanderia e enxoval"], ["frete_mudanca", "Frete e mudança leve"], ["assistencia_24h", "Assistência 24h"]]) {
      expect(por.get(id), id).toMatchObject({ nome, quem_paga: "inquilino", status: "em_breve" });
    }
  });

  for (const largura of [390, 1280]) {
    test(`S1 a ${largura}px: só cartões com foto, grade par, nota fixa e Meus pedidos vazio`, async ({ browser }) => {
      test.setTimeout(120_000);
      const page = await entrar(browser, inq.email, senha);
      await page.setViewportSize({ width: largura, height: largura > 500 ? 900 : 844 });
      await page.goto("/dashboard/servicos", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Serviços", level: 1 })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Você paga direto ao prestador. A Viva indica parceiros e acompanha o pedido.").first()).toBeVisible();
      await expect(page.getByTestId("servicos-pedidos-vazio")).toHaveText("Quando você pedir um serviço, ele aparece aqui com o andamento.");
      await expect(page.locator('[data-testid="servico-form"], input[type="date"]')).toHaveCount(0);
      // O Plano de manutenção do dono não aparece para o inquilino.
      await expect(page.getByTestId("servico-plano_manutencao")).toHaveCount(0);
      await expect(page.locator("main")).not.toContainText("Plano de manutenção");
      // Só aparece cartão com foto: um por foto pronta, cada um com a imagem e sem ícone no lugar.
      const cartoes = page.getByTestId("servico-cartao");
      await expect(cartoes).toHaveCount(COM_FOTO.length);
      for (let i = 0; i < COM_FOTO.length; i++) {
        await expect(cartoes.nth(i).getByTestId("servico-foto")).toBeVisible();
        expect(await cartoes.nth(i).locator("svg").count()).toBe(0);
      }
      if (COM_FOTO.length === 0) await expect(page.getByTestId("servicos-vazio")).toBeVisible();
      else {
        // Grade par: 2 colunas a 390 px, 4 a 1280 px.
        const colunas = await page.getByTestId("servicos-lista").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
        expect(colunas).toBe(largura > 1000 ? 4 : 2);
      }
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(sobra, "rolagem horizontal").toBeLessThanOrEqual(1);
      await page.screenshot({ path: `tests/laboratorio/saida/t219-servicos-${largura}.png`, fullPage: true });
      await page.context().close();
    });
  }

  test("cartão 'Em breve' → 'Avise-me quando estiver disponível' gravado (quando as fotos estiverem prontas)", async ({ browser }) => {
    test.skip(COM_FOTO.length === 0, "Aguarda as 4 fotos do Moacir (public/images/servicos): sem foto, o cartão não aparece.");
    const page = await entrar(browser, inq.email, senha);
    await page.goto("/dashboard/servicos", { waitUntil: "domcontentloaded" });
    const id = COM_FOTO[0];
    await page.getByTestId(`servico-${id}`).getByTestId("servico-cartao").click();
    await expect(page.getByTestId("servico-aviseme")).toBeVisible();
    await page.getByTestId("servico-aviseme-enviar").click();
    await expect(page.getByTestId("servico-aviseme-ok")).toBeVisible({ timeout: 20_000 });
    const { data } = await adm().from("interesse_servico").select("servico_id").eq("user_id", ids.inq!);
    expect((data ?? []).map((r) => r.servico_id)).toContain(id);
    await page.context().close();
  });
});
