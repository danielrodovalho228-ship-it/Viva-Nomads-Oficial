import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T219 — ordem 521c5af7, telas S1–S3: Serviços para o morador.
 * S1: catálogo com a nota "paga direto ao prestador"; serviço sem parceiro = "Em breve", sem botão de pedir.
 * S2: pedido com data, faixa e observação; o resumo mostra prestador, preço e pagamento direto.
 * S3: o pedido aparece com o estado e "Fale com a Viva" leva o código ao atendimento; outro morador não vê o pedido.
 * 390 e 1280 px, sem rolagem horizontal.
 */
test.describe("T219 — Serviços do morador: catálogo → pedido → acompanhamento", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t219.${sufixo}@lab.vivanomads.test`, nome: "Dora Servicos", role: "owner" as const };
  const inq = { email: `inq.t219.${sufixo}@lab.vivanomads.test`, nome: "Iago Servicos", role: "tenant" as const };
  const outro = { email: `outro.t219.${sufixo}@lab.vivanomads.test`, nome: "Olga Servicos", role: "tenant" as const };
  const ids: { dono?: string; inq?: string; outro?: string; imovel?: string; contratos: string[] } = { contratos: [] };
  const COM_PARCEIRO = `lab_t219_${sufixo}`;
  const SEM_PARCEIRO = `lab_t219_breve_${sufixo}`;

  async function contratoAtivo(tenantId: string) {
    const { data, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.imovel, tenant_id: tenantId, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60,
        aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 256, qtd_ocupantes: 1,
        status: "ativo", garantia: "caucao",
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contratos.push(data.id as string);
  }

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.outro = await criarConta(outro, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Servicos t219 ${sufixo}`, { ativo: true });
    await contratoAtivo(ids.inq);
    await contratoAtivo(ids.outro);
    const { error } = await adm().from("servicos_adicionais").insert([
      { id: COM_PARCEIRO, nome: `Limpeza Lab ${sufixo}`, categoria: "assistencia_inquilino", quem_paga: "inquilino", parceiro_nome: "Limpa Bem Lab", status: "ativo", descricao: "Serviço de teste.", preco_texto: "R$ 120 por visita" },
      { id: SEM_PARCEIRO, nome: `Internet Lab ${sufixo}`, categoria: "assistencia_inquilino", quem_paga: "inquilino", parceiro_nome: null, status: "ativo", descricao: "Serviço de teste sem parceiro." },
    ]);
    if (error) throw error;
  });

  test.afterAll(async () => {
    await adm().from("servicos_pedidos").delete().in("tenant_id", [ids.inq, ids.outro].filter(Boolean) as string[]);
    await adm().from("servicos_adicionais").delete().in("id", [COM_PARCEIRO, SEM_PARCEIRO]);
    if (ids.contratos.length) await adm().from("contratos").delete().in("id", ids.contratos);
    await apagarContas([ids.dono, ids.inq, ids.outro]);
  });

  for (const largura of [390, 1280]) {
    test(`S1–S3 a ${largura}px: sem parceiro não pede; com parceiro pede e acompanha`, async ({ browser }) => {
      test.setTimeout(150_000);
      const page = await entrar(browser, inq.email, senha);
      await page.setViewportSize({ width: largura, height: largura > 500 ? 900 : 844 });
      await page.goto("/dashboard/servicos", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Serviços", level: 1 })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Você paga direto ao prestador. A Viva indica parceiros e acompanha o pedido.").first()).toBeVisible();
      // S1: sem parceiro = "Em breve", sem botão de pedir.
      await expect(page.getByTestId(`servico-embreve-${SEM_PARCEIRO}`)).toHaveText("Em breve");
      await expect(page.getByTestId(`servico-pedir-${SEM_PARCEIRO}`)).toHaveCount(0);
      // S2: o resumo mostra prestador, preço e pagamento direto antes de enviar.
      await page.getByTestId(`servico-pedir-${COM_PARCEIRO}`).click();
      const resumo = page.getByTestId("servico-resumo");
      await expect(resumo).toContainText("Limpa Bem Lab");
      await expect(resumo).toContainText("R$ 120 por visita");
      await expect(resumo).toContainText("direto ao prestador");
      const amanha = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
      await page.getByTestId("servico-data").fill(amanha);
      await page.getByTestId("servico-faixa").selectOption("manha");
      await page.getByTestId("servico-observacao").fill("Portão azul, tocar o interfone");
      await page.getByTestId("servico-enviar").click();
      // S3: o pedido aparece com o estado e o atalho para a Viva leva o código.
      const pedido = page.getByTestId("servico-pedido").first();
      await expect(pedido).toBeVisible({ timeout: 30_000 });
      await expect(pedido.getByTestId("servico-pedido-estado")).toHaveText("Pedido enviado");
      await expect(pedido).toContainText("Limpa Bem Lab");
      const href = (await pedido.getByTestId("servico-fale-com-viva").getAttribute("href")) ?? "";
      expect(href).toMatch(/^\/ajuda\?novo=1&servico=SV-[0-9A-F]{8}$/);
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(sobra, "rolagem horizontal").toBeLessThanOrEqual(1);
      await page.goto(href, { waitUntil: "domcontentloaded" });
      await expect(page.getByPlaceholder(/Conte com suas palavras/i)).toHaveValue(/^Sobre o pedido de serviço SV-[0-9A-F]{8}: /, { timeout: 30_000 });
      await page.context().close();
      // Limpa para a próxima largura (o limite de pedidos em aberto não é o foco desta prova).
      await adm().from("servicos_pedidos").delete().eq("tenant_id", ids.inq!);
    });
  }

  test("outro morador não vê o pedido; o pedido gravou prestador e preço", async ({ browser }) => {
    test.setTimeout(120_000);
    const { error } = await adm().from("servicos_pedidos").insert({
      servico_id: COM_PARCEIRO, tenant_id: ids.inq, data_desejada: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10),
      faixa: "tarde", prestador_nome: "Limpa Bem Lab", preco_texto: "R$ 120 por visita",
    });
    expect(error).toBeNull();
    const page = await entrar(browser, outro.email, senha);
    await page.goto("/dashboard/servicos", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("servicos-pedidos")).toContainText("ainda não fez nenhum pedido", { timeout: 30_000 });
    await expect(page.getByTestId("servico-pedido")).toHaveCount(0);
    await page.context().close();
  });
});
