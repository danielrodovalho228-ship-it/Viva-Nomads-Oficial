import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T229 — Prompt 29, /admin "conversa com tudo" (390 e 1280 px):
   • "admin conversa com tudo": cada cartão da home com lista abre a lista que ele conta, com o MESMO filtro, e a lista
     mostra o mesmo número (contratos, solicitações de manutenção, atendimento, pedidos, imóveis);
   • "um número, uma fonte": 3.200 × 4 meses → valor total R$ 12.800 e taxa R$ 1.536 iguais na home, em
     /admin/contratos e no Financeiro; fila de documentos e "Aguardando o seu OK" iguais na home, na página e no selo;
   • usuários: o admin aparece (Papel: admin), conta de teste com o selo TESTE e fora da lista padrão;
   • imóveis: Tipo (Real/Demonstração/Teste) e "Aparece para o público";
   • Dados de teste: "Encerrar jornadas de teste" pede confirmação e grava no registro;
   • Fotógrafos: a taxa de serviço dos parceiros (10%); horários do admin com BRT.
  Isolado por uma cidade única do spec e um período personalizado novo (a home guarda os números por 5 minutos por
  período e cidade).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE = `Cidade T229 ${sufixo}`;
const dono = { email: `dono.t229.${sufixo}@lab.vivanomads.test`, nome: "Marina Conversa Prado", role: "owner" as const };
const inq = { email: `inq.t229.${sufixo}@lab.vivanomads.test`, nome: "Rafael Conversa Dias", role: "tenant" as const };
const teste = { email: `teste.t229.${sufixo}@lab.vivanomads.test`, nome: `Tobias Teste ${sufixo}`, role: "owner" as const };
const ids: Record<string, string | undefined> = {};
const hoje = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10); // dia de Brasília
const de = new Date(Date.now() - (40 + Math.floor(Math.random() * 300)) * 86_400_000).toISOString().slice(0, 10);
const HOME = `/admin?periodo=custom&de=${de}&ate=${hoje}&cidade=${encodeURIComponent(CIDADE)}`;

test.describe("T229 — admin conversa com tudo", () => {
  test.describe.configure({ mode: "serial", timeout: 240_000 });
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
  test.use({ storageState: authFile("admin") });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.teste = await criarConta(teste, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.teste);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio T229 ${sufixo}`, { ativo: true });
    ids.imovelTeste = await criarImovelPronto(ids.teste, `[TESTE QA] T229 ${sufixo}`, { ativo: true });
    await adm().from("properties").update({ city: CIDADE }).in("id", [ids.imovel, ids.imovelTeste]);
    // 3.200 × 4 meses, taxa de 12% gravada no aceite = 1.536 (Prompt 29, item 6).
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "free", faixa: "temporada", prazo_total_dias: 120, aluguel_mensal: 3200,
        tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 1536, qtd_ocupantes: 1, status: "ativo", garantia: "caucao",
        assinado_proprietario_em: new Date().toISOString(),
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    ids.contrato = c!.id as string;
    const { error: eSo } = await adm()
      .from("service_orders")
      .insert({ property_id: ids.imovel, tenant_id: ids.inq, owner_id: ids.dono, category: "hidraulica", priority: "media", description: "T229: torneira pingando." });
    expect(eSo).toBeNull();
    const prazo = new Date(Date.now() + 24 * 3_600_000).toISOString();
    const { data: ch, error: eCh } = await adm()
      .from("chamados")
      .insert({ visitante_nome: "Visitante T229", visitante_email: `t229.${sufixo}@lab.vivanomads.test`, tipo: "suporte", categoria: "contrato", prioridade: "p3", canal: "site", assunto: `T229 ${sufixo}`, responsavel_tipo: "humano", prazo_primeira_resposta: prazo, prazo_resolucao: prazo })
      .select("id")
      .single();
    expect(eCh).toBeNull();
    ids.chamado = ch!.id as string;
  });

  test.afterAll(async () => {
    if (ids.chamado) await adm().from("chamados").delete().eq("id", ids.chamado);
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.dono, ids.inq, ids.teste]);
  });

  /** Valor do cartão da home (data-indicador) e o link que ele abre. */
  async function cartao(page: Page, chave: string): Promise<{ valor: string; href: string | null }> {
    const c = page.locator(`[data-indicador="${chave}"]`);
    const v = c.locator("[data-valor]");
    return { valor: (await v.innerText()).trim(), href: await v.getAttribute("data-href") };
  }
  const n = (s: string) => Number(s.replace(/\D/g, "") || "NaN");
  async function semRolagemLateral(page: Page) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  }

  for (const largura of [1280, 390]) {
    test(`${largura}px — cada cartão abre a lista que ele conta, com o mesmo número`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(HOME, { waitUntil: "domcontentloaded" });
      await semRolagemLateral(page);

      // Manutenção ≠ atendimento: dois cartões, dois destinos.
      const manut = await cartao(page, "chamados");
      await expect(page.locator('[data-indicador="chamados"]')).toContainText("Solicitações de manutenção abertas");
      expect(manut.valor).toBe("1");
      expect(manut.href).toMatch(/^\/admin\/solicitacoes\?periodo=custom&de=/);
      const atd = await cartao(page, "atendimento_abertos");
      expect(atd.href).toBe("/admin/atendimento?aba=fila");

      // Contratos: 1 contrato, valor total 12.800, taxa 1.536, take rate 12%.
      const contratos = await cartao(page, "contratos");
      expect(contratos.valor).toBe("1");
      expect((await cartao(page, "valor_total_contratos")).valor).toMatch(/R\$\s?12\.800/);
      expect((await cartao(page, "taxa_gerada")).valor).toMatch(/R\$\s?1\.536/);
      expect((await cartao(page, "take_rate")).valor).toBe("12%");
      expect((await cartao(page, "valor_mensal_contratado")).valor).toMatch(/R\$\s?3\.200/);
      const pedidos = await cartao(page, "pedidos");
      // Desde o Prompt 46 a home só lista decisão com n > 0 (decisoes-admin.ts): com a fila vazia (banco limpo do
      // lab-crítico) a linha de documentos não aparece, e a conta abaixo vale 0.
      const fila = page.locator('[data-precisa="documentos_pendentes"]');
      if (await fila.count()) await expect(fila).toContainText(/na fila \(\d+ documentos? \+ \d+ matrículas?\)/);
      await page.screenshot({ path: `${SAIDA}/t229-home-${largura}.png`, fullPage: true });

      // Destinos: a lista conta o mesmo.
      await page.goto(contratos.href!, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("lista-total")).toHaveText("1");
      await expect(page.getByTestId("contratos-valor-total")).toHaveText(/R\$\s?12\.800/);
      await expect(page.getByTestId("contratos-taxa")).toHaveText(/R\$\s?1\.536/);
      await expect(page.getByTestId("contrato-assinatura").first()).toHaveText("Falta assinar: inquilino");
      await expect(page.getByTestId("contrato-rotulo-taxa").first()).toContainText("Taxa de serviço: 12% sobre o valor mensal × meses (R$ 3.200 × 4 = R$ 12.800) = R$ 1.536");
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t229-contratos-${largura}.png`, fullPage: true });

      await page.goto(`/admin/financeiro?periodo=custom&de=${de}&ate=${hoje}&cidade=${encodeURIComponent(CIDADE)}`, { waitUntil: "domcontentloaded" });
      await expect(page.locator('[data-indicador="f-valor-total-dos-contratos"] [data-valor]')).toHaveText(/R\$\s?12\.800/);
      await expect(page.locator('[data-indicador="f-taxa-de-servi-o-gerada"] [data-valor]')).toHaveText(/R\$\s?1\.536/);
      await expect(page.locator('[data-indicador="f-take-rate"] [data-valor]')).toHaveText("12%");
      await expect(page.locator("main")).not.toContainText("Aluguel contratado");

      await page.goto(manut.href!, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("lista-total")).toHaveText(manut.valor);
      await expect(page.getByTestId("solicitacao-linha").first()).toContainText("BRT");

      await page.goto(pedidos.href!, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("lista-total")).toHaveText(String(n(pedidos.valor)));

      // Atendimento: o número da home = as linhas da fila (a home guarda 5 min; o chamado do spec já existia antes).
      await page.goto(atd.href!, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("chamado-linha")).toHaveCount(n(atd.valor));

      // Documentos: home = página = selo da barra lateral.
      // A fila de documentos é global e as outras specs do laboratório mexem nela em paralelo: a home lida
      // minutos antes pode divergir com razão. Compara a home relida com a página logo em seguida, com nova tentativa.
      await expect(async () => {
        await page.goto(HOME, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("admin-decisoes")).toBeVisible({ timeout: 10_000 });
        const linha = page.locator('[data-precisa="documentos_pendentes"] [data-href]').first();
        const naHome = (await linha.count()) ? Number(await linha.getAttribute("data-valor")) : 0;
        await page.goto("/admin/documentos", { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("fila-agora-total")).toHaveText(String(naHome), { timeout: 10_000 });
        if (largura === 1280) {
          const selo = page.locator('[data-menu-id="admin-documentos"]');
          if (await selo.isVisible()) {
            // O selo carrega depois da tela (as server actions do menu rodam em fila): espera o número chegar.
            await expect
              .poll(async () => Number((await selo.innerText()).match(/(\d+)\s*$/)?.[1] ?? 0), { timeout: 15_000 })
              .toBe(naHome);
          }
        }
      }).toPass({ timeout: 90_000 });
    });

    test(`${largura}px — agora: imóveis reais, demonstração e teste; agentes com nome`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(HOME, { waitUntil: "domcontentloaded" });
      const agora = page.getByTestId("home-agora");
      // Prompt 46: "Imóveis reais publicados" é o número-herói; o resto de "Agora" é lista com divisor fino.
      const valorDe = async (rotulo: string) => {
        const link = agora.locator(`[data-agora^="${rotulo}"] [data-href]`);
        return { valor: n((await link.innerText()).trim()), href: await link.getAttribute("href") };
      };
      const heroi = page.getByTestId("admin-heroi").locator("[data-href]");
      const reais = { valor: n((await heroi.innerText()).trim()), href: await heroi.getAttribute("href") };
      expect(reais.valor).toBe(1);
      await page.goto(reais.href!, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("lista-total")).toHaveText("1");
      await expect(page.getByTestId("imovel-tipo").first()).toHaveText("Real");
      await expect(page.getByTestId("imovel-publico").first()).toHaveText("sim");

      await page.goto(HOME, { waitUntil: "domcontentloaded" });
      const testes = await valorDe("Anúncios de teste");
      expect(testes.valor).toBe(1);
      await page.goto(testes.href!, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("lista-total")).toHaveText("1");
      const linhaTeste = page.getByTestId("imovel-linha").first();
      await expect(linhaTeste).toHaveAttribute("data-tipo", "teste");
      await expect(linhaTeste.getByTestId("imovel-publico")).toHaveText("não");
      await expect(linhaTeste.getByTestId("selo-teste")).toBeVisible();

      await page.goto("/admin/imoveis?tipo=demonstracao", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("lista-total")).not.toHaveText("0");
      await expect(page.getByTestId("imovel-tipo").first()).toHaveText("Demonstração");
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t229-imoveis-${largura}.png`, fullPage: true });

      // Agentes: "Aguardando o seu OK" igual na home e na página.
      await page.goto(HOME, { waitUntil: "domcontentloaded" });
      const ok = await page.locator("dl div", { hasText: /Equipe — aguardando o seu ok/i }).locator("[data-valor]").first().innerText();
      await page.goto("/admin/agentes", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("agentes-aguardandoOk").locator("[data-valor]")).toHaveText(ok.trim());
      await expect(page.getByTestId("agentes-contadores")).toContainText("Ordens lidas não concluídas");
    });

    test(`${largura}px — usuários: admin na lista, selo TESTE, cadastro completo e identidade`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/admin/usuarios?papel=admin", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("admin-usuarios-lista")).toBeVisible();
      await expect(page.locator('[data-usuario][data-papel="admin"]:visible').first()).toBeVisible();
      await page.goto(`/admin/usuarios?q=${encodeURIComponent(teste.nome)}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText("Nenhum usuário nesta lista")).toBeVisible();
      await expect(page.locator("[data-usuario]:visible")).toHaveCount(0);
      await page.goto(`/admin/usuarios?teste=sim&q=${encodeURIComponent(teste.nome)}`, { waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-usuario]:visible").first().getByTestId("selo-teste")).toBeVisible();
      await page.goto(`/admin/usuarios?q=${encodeURIComponent(dono.nome)}`, { waitUntil: "domcontentloaded" });
      const linha = page.locator("[data-usuario]:visible").first();
      await expect(linha).toContainText(/Não verificada|Confirmada|Vencida/);
      if (largura === 1280) await expect(linha.getByTestId("admin-cadastro-completo")).toHaveAttribute("title", /Falta: .*Foto de perfil/);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t229-usuarios-${largura}.png`, fullPage: true });
    });
  }

  test("Dados de teste: encerrar jornadas pede confirmação e grava no registro; fotógrafos dizem quem recebe", async ({ page }) => {
    await page.goto("/admin/dados-de-teste", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("link-emails-teste")).toHaveAttribute("href", "/admin/emails-teste");
    await page.getByTestId("encerrar-jornadas").click();
    await page.getByTestId("encerrar-jornadas-confirmar").click();
    await expect(page.getByTestId("encerrar-jornadas-resultado")).toContainText(/encerrados? em \d+ anúncios? de teste/);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("log-dados-teste-linha").first()).toContainText("Jornadas de teste encerradas");
    await expect(page.getByTestId("conta-teste").filter({ hasText: teste.nome })).toBeVisible();
    await page.screenshot({ path: `${SAIDA}/t229-dados-de-teste.png`, fullPage: true });

    await page.goto("/admin/fotografos", { waitUntil: "domcontentloaded" });
    // Complemento do P29, item 1: a taxa fixa saiu — taxa de serviço de 10% para todas as categorias.
    await expect(page.getByTestId("texto-taxa-parceria")).toContainText("Taxa de serviço: 10% sobre o valor do serviço, para todas as categorias.");
    await expect(page.locator("main")).not.toContainText(/R\$ ?(40|60|80)\b/);
  });
});
