import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T219 — Serviços do morador e do dono (ordem 521c5af7; desde o Prompt 31b, a fusão com os parceiros). 390 e 1280 px.
 * A tela não mostra mais o catálogo antigo (servicos_adicionais, obsoleto): mostra as categorias de parceiros da cidade
 * (link para /parceiros/buscar), a nota fixa pela chave e "Meus pedidos" (vazio sem pedidos). Nenhum formulário de
 * data na tela; o pedido é feito na página do parceiro (t249). O banco antigo continua com os nomes acentuados.
 */
test.describe("T219 — Serviços: categorias de parceiros e Meus pedidos", () => {
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
    test(`a ${largura}px: categorias de parceiros na cidade, nota fixa e Meus pedidos vazio; sem catálogo antigo`, async ({ browser }) => {
      test.setTimeout(120_000);
      const page = await entrar(browser, inq.email, senha);
      await page.setViewportSize({ width: largura, height: largura > 500 ? 900 : 844 });
      await page.goto("/dashboard/servicos", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Serviços", level: 1 })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Você paga direto ao prestador. A Viva indica parceiros e acompanha o pedido.").first()).toBeVisible();
      await expect(page.getByTestId("servicos-pedidos")).toContainText("Quando você pedir um serviço, ele aparece aqui com o andamento.");
      await expect(page.locator('[data-testid="servico-form"], input[type="date"]')).toHaveCount(0);
      // Catálogo antigo fora: nem os cartões nem o Plano de manutenção do dono.
      await expect(page.getByTestId("servico-cartao")).toHaveCount(0);
      await expect(page.locator("main")).not.toContainText("Plano de manutenção");
      // Categorias de parceiros com a cidade da estadia.
      const limpeza = page.getByTestId("servicos-limpeza");
      await expect(limpeza).toBeVisible();
      expect(await limpeza.getAttribute("href")).toMatch(/^\/parceiros\/buscar\?categoria=limpeza&cidade=Uberl/);
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(sobra, "rolagem horizontal").toBeLessThanOrEqual(1);
      await page.screenshot({ path: `tests/laboratorio/saida/t219-servicos-${largura}.png`, fullPage: true });
      await page.context().close();
    });
  }
});
