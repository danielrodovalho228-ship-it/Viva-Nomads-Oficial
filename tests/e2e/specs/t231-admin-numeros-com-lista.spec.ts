import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, liberarLimiteLogin, liberarLimiteLoginIp, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { chaveCidade } from "../../../src/lib/cidades";

/*
  T231 — Complemento do Prompt 29 (reteste do #891), 390 e 1280 px:
   • item 4: TODO número da home é link; clicar abre a lista filtrada que ele conta, com a mesma contagem
     (cartões, funil e "Precisa de você agora", inclusive "Taxas vencidas" → Financeiro);
   • item 3: /admin/financeiro com UMA base — Real (padrão), Teste e Todos; a soma da tabela = os cartões
     ("Taxa de serviço gerada" e "Taxa a receber"), e cada cartão mostra a base escrita abaixo;
   • item 5b/c: /admin/pedidos com o mesmo recorte nos cartões e na lista; "com compatível" mostra a conta;
   • item 5a: avise-me sem login — texto novo, entrar volta para a mesma busca e grava o aviso;
   • item 1: taxa de serviço de 10% dos parceiros em /parceiros e /parceiros/fotografos, sem R$ 40/60/80.
  Isolado por uma cidade única e um período personalizado novo (a home guarda os números por 5 minutos).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE = `Cidade T231 ${sufixo}`;
const dono = { email: `dono.t231.${sufixo}@lab.vivanomads.test`, nome: "Helena Numeros Lima", role: "owner" as const };
const inq = { email: `inq.t231.${sufixo}@lab.vivanomads.test`, nome: "Caio Numeros Reis", role: "tenant" as const };
const inq2 = { email: `inq2.t231.${sufixo}@lab.vivanomads.test`, nome: "Lia Numeros Paz", role: "tenant" as const };
const teste = { email: `teste.t231.${sufixo}@lab.vivanomads.test`, nome: `Tadeu Teste ${sufixo}`, role: "owner" as const };
const ids: Record<string, string | undefined> = {};
const hoje = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10); // dia de Brasília
const de = new Date(Date.now() - (40 + Math.floor(Math.random() * 300)) * 86_400_000).toISOString().slice(0, 10);
const FILTRO = `periodo=custom&de=${de}&ate=${hoje}&cidade=${encodeURIComponent(CIDADE)}`;
const HOME = `/admin?${FILTRO}`;
const n = (s: string) => Number(s.replace(/\D/g, "") || "NaN");

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test.describe("T231 — admin: todo número com lista, financeiro com uma base", () => {
  test.describe.configure({ mode: "serial", timeout: 240_000 });
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
  test.use({ storageState: authFile("admin") });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.inq2 = await criarConta(inq2, senha);
    ids.teste = await criarConta(teste, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.teste);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio T231 ${sufixo}`, { ativo: true });
    ids.imovelTeste = await criarImovelPronto(ids.teste, `[TESTE QA] T231 ${sufixo}`, { ativo: true });
    await adm().from("properties").update({ city: CIDADE }).in("id", [ids.imovel, ids.imovelTeste]);

    // Candidaturas reais do período: 1 aceita (vira o contrato) e 1 sem resposta há 3 dias. A do imóvel de teste fica fora.
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel, true);
    await adm().from("leads").update({ accepted_at: new Date().toISOString() }).eq("id", ids.lead);
    ids.leadAberto = await criarLead(ids.dono, ids.inq2, ids.imovel);
    await adm().from("leads").update({ created_at: new Date(Date.now() - 3 * 86_400_000).toISOString() }).eq("id", ids.leadAberto);
    ids.leadTeste = await criarLead(ids.teste, ids.inq, ids.imovelTeste, true);

    // Contrato real 3.200 × 4 (taxa gravada 1.536) com a cobrança da taxa vencida; contrato de teste 1.000 × 2 (240).
    const base = { owner_plan: "free", faixa: "temporada", tamanho_bloco_meses: 2, comissao_percent: 0.12, qtd_ocupantes: 1, status: "ativo", garantia: "caucao" };
    const { data: c1, error: e1 } = await adm()
      .from("contratos")
      .insert({ ...base, lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.inq, prazo_total_dias: 120, aluguel_mensal: 3200, comissao_valor: 1536 })
      .select("id")
      .single();
    expect(e1).toBeNull();
    ids.contrato = c1!.id as string;
    const { data: c2, error: e2 } = await adm()
      .from("contratos")
      .insert({ ...base, lead_id: ids.leadTeste, property_id: ids.imovelTeste, tenant_id: ids.inq, prazo_total_dias: 60, aluguel_mensal: 1000, comissao_valor: 240 })
      .select("id")
      .single();
    expect(e2).toBeNull();
    ids.contratoTeste = c2!.id as string;
    const { error: eCob } = await adm().from("cobrancas_fechamento").insert({ lead_id: ids.lead, tipo: "comissao", status: "vencido" });
    expect(eCob).toBeNull();

    // Pedidos: 1 real (2 compatíveis ao publicar) e 1 de conta de teste, na cidade do spec.
    const pedido = { cidade: CIDADE, uf: "MG", data_inicio: hoje, prazo_meses: 2, orcamento_mensal: 3000, qtd_ocupantes: 1, motivo: "trabalho_remoto", expira_em: new Date(Date.now() + 20 * 86_400_000).toISOString() };
    const { error: eP } = await adm().from("pedidos_moradia").insert([
      { ...pedido, inquilino_id: ids.inq, compativeis_ao_publicar: 2 },
      { ...pedido, inquilino_id: ids.teste, compativeis_ao_publicar: 0 },
    ]);
    expect(eP).toBeNull();

    // Eventos anônimos da cidade: 3 buscas reais + 1 de conta de teste (fica fora) e 2 anúncios vistos.
    const k = chaveCidade(CIDADE);
    const { error: eEv } = await adm().from("eventos").insert([
      { tipo: "busca", cidade_chave: k },
      { tipo: "busca", cidade_chave: k },
      { tipo: "busca", cidade_chave: k },
      { tipo: "busca", cidade_chave: k, usuario_id: ids.teste },
      { tipo: "ver_anuncio", cidade_chave: k, imovel_id: ids.imovel },
      { tipo: "ver_anuncio", cidade_chave: k, imovel_id: ids.imovel },
    ]);
    expect(eEv).toBeNull();
  });

  test.afterAll(async () => {
    await adm().from("eventos").delete().eq("cidade_chave", chaveCidade(CIDADE));
    await adm().from("pedidos_moradia").delete().eq("cidade", CIDADE);
    if (ids.lead) await adm().from("cobrancas_fechamento").delete().eq("lead_id", ids.lead);
    await adm().from("contratos").delete().in("id", [ids.contrato, ids.contratoTeste].filter(Boolean) as string[]);
    await adm().from("interesse_fotografo_cidade").delete().eq("user_id", ids.inq2 ?? "");
    await apagarContas([ids.dono, ids.inq, ids.inq2, ids.teste]);
  });

  for (const largura of [1280, 390]) {
    test(`${largura}px — todo número da home é link e a lista aberta tem a mesma contagem`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(HOME, { waitUntil: "domcontentloaded" });
      await expect(page.locator('[data-indicador="contratos"] [data-valor]')).toBeVisible();
      await semRolagemLateral(page);

      // Guarda: nenhum número da home sem href (cartões, funil e filas).
      const semLink = await page.locator("[data-indicador] [data-valor]:not([data-href]), [data-funil]:not([data-href])").count();
      expect(semLink).toBe(0);
      await expect(page.locator("main")).not.toContainText("sem lista");
      await expect(page.locator("main")).not.toContainText(/comiss/i);
      await page.screenshot({ path: `${SAIDA}/t231-home-${largura}.png`, fullPage: true });

      const cartao = async (chave: string) => {
        const v = page.locator(`[data-indicador="${chave}"] [data-valor]`);
        return { valor: (await v.innerText()).trim(), href: (await v.getAttribute("data-href"))! };
      };
      const funil = async (rotulo: string) => {
        const l = page.locator(`[data-funil="${rotulo}"]`);
        return { valor: (await l.locator("[data-valor]").innerText()).trim(), href: (await l.getAttribute("data-href"))! };
      };
      const fila = async (chave: string) => {
        const li = page.locator(`[data-precisa="${chave}"]`);
        return { valor: n(await li.locator("span.font-title").innerText()), href: (await li.locator("[data-href]").first().getAttribute("data-href"))! };
      };

      const alvos: { nome: string; valor: number; href: string; esperado?: number }[] = [];
      for (const [chave, esperado] of [["buscas", 3], ["visualizacoes", 2], ["candidaturas", 2], ["pedidos", 1], ["contratos", 1]] as const) {
        const c = await cartao(chave);
        alvos.push({ nome: `cartão ${chave}`, valor: n(c.valor), href: c.href, esperado });
      }
      for (const [rotulo, esperado] of [["Buscas", 3], ["Anúncios vistos", 2], ["Candidaturas enviadas", 2], ["Aceitas", 1], ["Contratos", 1]] as const) {
        const f = await funil(rotulo);
        alvos.push({ nome: `funil ${rotulo}`, valor: n(f.valor), href: f.href, esperado });
      }
      for (const chave of ["candidaturas_sem_resposta_48h", "chamados_urgentes_sem_resposta", "comissoes_vencidas", "pedidos_sem_resposta_expirando"]) {
        const f = await fila(chave);
        alvos.push({ nome: `fila ${chave}`, valor: f.valor, href: f.href });
      }
      expect(alvos.find((a) => a.nome === "fila comissoes_vencidas")!.href).toBe("/admin/financeiro?situacao=vencida");
      expect(alvos.find((a) => a.nome === "fila candidaturas_sem_resposta_48h")!.href).toBe("/admin/candidaturas?status=sem_resposta");
      await expect(page.locator('[data-precisa="comissoes_vencidas"]')).toContainText("Taxas vencidas");

      for (const a of alvos) {
        if (a.esperado !== undefined) expect(a.valor, a.nome).toBe(a.esperado);
        await page.goto(a.href, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("lista-total"), `${a.nome} → ${a.href}`).toHaveText(String(a.valor));
      }
      // As filas de agora contam o que o spec criou (pelo menos a candidatura parada e a taxa vencida).
      expect(alvos.find((a) => a.nome === "fila candidaturas_sem_resposta_48h")!.valor).toBeGreaterThanOrEqual(1);
      expect(alvos.find((a) => a.nome === "fila comissoes_vencidas")!.valor).toBeGreaterThanOrEqual(1);
      await page.goto("/admin/financeiro?situacao=vencida", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("vencida-linha").filter({ hasText: `Studio T231 ${sufixo}` })).toBeVisible();
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t231-vencidas-${largura}.png`, fullPage: true });
    });

    test(`${largura}px — financeiro com uma base: Real, Teste e Todos; tabela = cartões`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      const valor = (id: string) => page.locator(`[data-indicador="${id}"] [data-valor]`);
      const conferir = async (recorte: "real" | "teste" | "todos", linhas: number, total: RegExp, aReceber: RegExp, base: string) => {
        await page.goto(`/admin/financeiro?${FILTRO}${recorte === "real" ? "" : `&tipo=${recorte}`}`, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("filtro-tipo")).toHaveValue(recorte);
        await expect(page.getByTestId("fin-taxa-linha")).toHaveCount(linhas);
        await expect(page.getByTestId("fin-taxa-total")).toHaveText(total);
        await expect(valor("f-taxa-de-servi-o-gerada")).toHaveText(total);
        await expect(valor("f-taxa-a-receber")).toHaveText(aReceber);
        await expect(valor("f-contratos-no-per-odo")).toHaveText(String(linhas));
        // Cada cartão mostra a base escrita abaixo, a mesma para a página inteira.
        const bases = await page.getByTestId("base-cartao").allInnerTexts();
        expect(bases.length).toBeGreaterThan(10);
        expect(new Set(bases.map((b) => b.trim()))).toEqual(new Set([base]));
        await expect(page.locator("main")).not.toContainText(/comiss/i);
        await semRolagemLateral(page);
      };
      await conferir("real", 1, /R\$\s?1\.536/, /R\$\s?1\.536/, "só contratos reais");
      await expect(page.getByTestId("fin-rotulo-taxa").first()).toContainText("12% sobre o valor mensal × meses (R$ 3.200 × 4 = R$ 12.800) = R$ 1.536");
      await page.screenshot({ path: `${SAIDA}/t231-financeiro-real-${largura}.png`, fullPage: true });
      await conferir("teste", 1, /R\$\s?240/, /R\$\s?240/, "só de teste");
      await conferir("todos", 2, /R\$\s?1\.776/, /R\$\s?1\.776/, "todos");
      // O seletor (GET) troca a base mantendo o período e a cidade.
      await page.getByTestId("filtro-tipo").selectOption("real");
      await page.getByTestId("financeiro-recorte").getByRole("button", { name: "Aplicar" }).click();
      await expect(page).toHaveURL(/tipo=real/);
      await expect(page).toHaveURL(/cidade=Cidade/);
      await expect(page.getByTestId("fin-taxa-linha")).toHaveCount(1);
      await page.screenshot({ path: `${SAIDA}/t231-financeiro-todos-${largura}.png`, fullPage: true });
    });

    test(`${largura}px — pedidos: cartões e lista no mesmo recorte; compatível com a conta`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/admin/pedidos?${FILTRO}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("lista-total")).toHaveText("1");
      await expect(page.getByTestId("filtro-tipo")).toHaveValue("real");
      await expect(page.locator("main")).toContainText("1 de 1 pedido do período, 100%");
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t231-pedidos-${largura}.png`, fullPage: true });
      await page.goto(`/admin/pedidos?${FILTRO}&tipo=todos`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("lista-total")).toHaveText("2");
      await expect(page.locator("main")).toContainText("1 de 2 pedidos do período, 50%");
      await page.goto(`/admin/pedidos?${FILTRO}&tipo=teste`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("lista-total")).toHaveText("1");
      await expect(page.locator("main")).toContainText("0 de 1 pedido do período, 0%");
    });
  }

  test("taxa de serviço dos parceiros (10%) e avise-me sem login que grava na volta", async ({ browser }) => {
    for (const largura of [1280, 390]) {
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      for (const url of ["/parceiros", "/parceiros/fotografos"]) {
        await page.goto(url, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("taxa-servico-parceiros").first()).toContainText("Taxa de serviço: 10% sobre o valor do serviço, para todas as categorias.");
        await expect(page.getByTestId("taxa-servico-parceiros").first()).toContainText("A Viva não guarda o dinheiro.");
        await expect(page.getByTestId("taxa-servico-parceiros").first()).toContainText("Pagamento pela plataforma em breve.");
        await expect(page.locator("body")).not.toContainText(/R\$ ?(40|60|80)\b|taxa de parceria por pedido/i);
        await semRolagemLateral(page);
      }
      await page.goto(`/parceiros/fotografos?cidade=${encodeURIComponent(CIDADE)}&uf=MG`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("aviso-fotografo-deslogado")).toHaveText("Entre ou crie sua conta para ser avisado quando houver fotógrafo na sua cidade.");
      const href = await page.getByTestId("aviso-fotografo-entrar").getAttribute("href");
      expect(decodeURIComponent(href!.split("redirect=")[1])).toBe(`/parceiros/fotografos?cidade=${encodeURIComponent(CIDADE)}&uf=MG&avisar=1`);
      await page.screenshot({ path: `${SAIDA}/t231-avise-me-${largura}.png`, fullPage: true });
      if (largura === 390) {
        // Entra pelo link: volta para a mesma busca e o aviso é gravado sem outro clique.
        await liberarLimiteLogin(inq2.email);
        await liberarLimiteLoginIp();
        await page.getByTestId("aviso-fotografo-entrar").click();
        await page.locator('input[name="email"], input[type="email"]').first().fill(inq2.email);
        await page.locator('input[name="password"], input[type="password"]').first().fill(senha);
        await page.locator("form").getByRole("button", { name: /^entrar$/i }).click();
        await page.waitForURL(/\/parceiros\/fotografos/, { timeout: 30_000 });
        await expect(page.getByTestId("aviso-fotografo-ok")).toContainText(`Anotado! Avisamos você quando houver fotógrafo parceiro em ${CIDADE}.`, { timeout: 20_000 });
        await expect(page).not.toHaveURL(/avisar=1/);
        const { data } = await adm().from("interesse_fotografo_cidade").select("id").eq("user_id", ids.inq2!);
        expect(data?.length).toBe(1);
        await page.screenshot({ path: `${SAIDA}/t231-avise-me-gravado.png`, fullPage: true });
      }
      await ctx.close();
    }
  });
});
