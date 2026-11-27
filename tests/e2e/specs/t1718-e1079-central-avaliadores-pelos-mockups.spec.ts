import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1718 — E1079 @E1079 (ORDEM-DUET-385/386): a Central → Avaliadores pelos mockups aprovados (admin-avaliadores-novo).
  Massa própria, só contas de teste: um avaliador EM TESTE com foto de perfil e um ATIVO sem foto (conta de teste),
  os dois em Uberlândia, e a tabela da cidade com os três portes — o estado que o desenho mostra.
   1. Chave: o cartão "Chave da Vistoria" com as três condições, cada uma com a pílula do estado
      (tabela Cumprida; avaliadores Falta N, porque conta de teste não conta; parecer Pendente).
   2. Credenciamento: cartão com a FOTO de perfil da conta e a pílula "Em teste"; sem foto, as INICIAIS no círculo
      e a pílula "Ativo". Foto nunca é obrigatória.
   3. Tabela de preços limpa da cidade: os três portes com o valor vigente; o formulário e o histórico continuam.
  Sem rolagem lateral. Capturas a 390 e a 1280 px para o lado a lado com o desenho. Laboratório; não é prova ao vivo.
*/
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Uberlândia";
const senha = novaSenha();
const sufixo = novoSufixo();
const comFoto = { email: `av.foto.t1718.${sufixo}@lab.vivanomads.test`, nome: "Renato Teste Avaliador", role: "tenant" as const };
const semFoto = { email: `av.iniciais.t1718.${sufixo}@lab.vivanomads.test`, nome: "Ana Teste Avaliadora", role: "tenant" as const };
const ids: { comFoto?: string; semFoto?: string } = {};
const numeros: { comFoto?: string; semFoto?: string } = {};

async function central(page: Page, largura: 390 | 1280) {
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await page.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Avaliadores" })).toBeVisible({ timeout: 30_000 });
}
const item = (page: Page, numero: string) => page.locator(`[data-testid="credenciamento-item"][data-numero="${numero}"]`);

test.describe("T1718 — E1079: a Central → Avaliadores pelos mockups (cartões, foto e pílulas) @E1079", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: authFile("admin") });
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    for (const [chave, conta, status] of [["comFoto", comFoto, "em_teste"], ["semFoto", semFoto, "ativo"]] as const) {
      const id = await criarConta(conta, senha);
      ids[chave] = id;
      await adm().from("profiles").update({ is_teste: true }).eq("id", id);
      const { data: parc, error } = await adm()
        .from("parceiros")
        .insert({ user_id: id, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: conta.nome, slug: `aval-${chave.toLowerCase()}-t1718-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
        .select("id")
        .single();
      if (error) throw error;
      const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
      numeros[chave] = n as string;
      const { error: e2 } = await adm()
        .from("avaliadores_credenciamento")
        .insert({ parceiro_id: parc.id, user_id: id, cidade: CIDADE, numero_credenciado: n, status, experiencia_link: "https://portfolio.lab.vivanomads.test", conduta_versao: "2026-10-23", ativado_em: status === "ativo" ? new Date().toISOString() : null });
      if (e2) throw e2;
    }
    // A foto de perfil da conta (a mesma que a pessoa envia em Conta): bucket privado, caminho canónico.
    const up = await adm().storage.from("avatars").upload(`${ids.comFoto}/avatar.webp`, readFileSync("public/images/home/persona-saude.webp"), { contentType: "image/webp", upsert: true });
    if (up.error) throw up.error;
    const { error: e3 } = await adm().from("profiles").update({ avatar_url: `${ids.comFoto}/avatar.webp` }).eq("id", ids.comFoto!);
    if (e3) throw e3;
    await adm().from("vistoria_precos").delete().eq("cidade", CIDADE);
    const { error: e4 } = await adm().from("vistoria_precos").insert([
      { cidade: CIDADE, porte: "estudio", valor: 150 },
      { cidade: CIDADE, porte: "q1_2", valor: 250 },
      { cidade: CIDADE, porte: "q3_mais", valor: 350 },
    ]);
    if (e4) throw e4;
  });

  test.afterAll(async () => {
    await adm().from("vistoria_precos").delete().eq("cidade", CIDADE);
    if (ids.comFoto) await adm().storage.from("avatars").remove([`${ids.comFoto}/avatar.webp`]);
    await apagarContas([ids.comFoto, ids.semFoto]);
  });

  test("1. a chave em cartão: três condições, cada uma com a pílula do estado", async ({ page }) => {
    await central(page, 390);
    const chave = page.getByTestId("avaliadores-chave");
    await expect(chave.getByRole("heading", { name: "Chave da Vistoria" })).toBeVisible();
    const cond = chave.locator(`[data-testid="avaliadores-condicoes"][data-cidade="${CIDADE}"]`);
    const tabela = cond.getByTestId("condicao-tabela");
    await expect(tabela).toHaveAttribute("data-ok", "sim");
    await expect(tabela).toContainText("Tabela de preço preenchida");
    await expect(tabela.locator('[data-tom="ok"]')).toHaveText("Cumprida");
    // Os dois avaliadores desta massa são contas de teste e não contam rumo aos 2 ativos (regra do E30). Quantos
    // faltam depende de quem mais estiver ativo na cidade na base do laboratório (outras specs credenciam gente em
    // Uberlândia); a conta exata de "Falta N" é da trava de unidade. Aqui: a pílula diz o estado que a linha tem.
    const avaliadores = cond.getByTestId("condicao-avaliadores");
    await expect(avaliadores).toContainText("2 avaliadores ativos na cidade");
    if ((await avaliadores.getAttribute("data-ok")) === "sim") await expect(avaliadores.locator('[data-tom="ok"]')).toHaveText("Cumprida");
    else await expect(avaliadores.locator('[data-tom="atencao"]')).toHaveText(/^Falta [12]$/);
    const parecer = cond.getByTestId("condicao-parecer");
    await expect(parecer).toContainText("Parecer jurídico");
    await expect(parecer.locator('[data-tom="pendente"]')).toHaveText("Pendente");
    await expect(chave).toContainText("A chave é liberada apenas quando todos os itens forem cumpridos.");
    // A pílula tem fundo de cor e texto branco, como no desenho (o resto do admin segue com a pílula branca).
    const fundo = await tabela.locator('[data-tom="ok"]').evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(fundo, "pílula 'Cumprida' em verde").toBe("rgb(61, 145, 80)");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "390 px: sem rolagem lateral").toBeLessThanOrEqual(1);
  });

  test("2. credenciamento: foto de perfil da conta e pílula; sem foto, as iniciais no círculo", async ({ page }) => {
    await central(page, 390);
    const foto = item(page, numeros.comFoto!);
    await expect(foto).toContainText(comFoto.nome);
    await expect(foto).toContainText(`${numeros.comFoto} • ${CIDADE}`);
    await expect(foto.locator('[data-tom="teste"]')).toHaveText("Em teste");
    const img = foto.locator("img").first();
    await expect(img, "a foto de perfil da conta aparece no cartão").toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => img.evaluate((el) => (el as HTMLImageElement).naturalWidth), { timeout: 20_000 }).toBeGreaterThan(0);

    const iniciais = item(page, numeros.semFoto!);
    await expect(iniciais).toContainText(semFoto.nome);
    await expect(iniciais.locator('[data-tom="ok"]')).toHaveText("Ativo");
    await expect(iniciais.locator("img"), "sem foto não há imagem quebrada nem espaço vazio").toHaveCount(0);
    // As iniciais da casa: primeiro e último nome ("Ana Teste Avaliadora" → AA).
    await expect(iniciais.locator('[data-rosto="iniciais"]')).toHaveText("AA");
    // As decisões do admin continuam no cartão.
    await expect(foto.getByRole("button", { name: "Marcar avaliação de teste" })).toBeVisible();
    await foto.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SAIDA}/t1718-2-credenciamento-390.png` });
  });

  test("3. tabela de preços limpa da cidade; formulário e histórico continuam; capturas a 390 e a 1280 px", async ({ page }) => {
    for (const largura of [390, 1280] as const) {
      await central(page, largura);
      const limpa = page.locator(`[data-testid="precos-limpa"][data-cidade="${CIDADE}"]`);
      await expect(limpa.getByRole("heading", { name: `Tabela de preços — ${CIDADE}` })).toBeVisible();
      await expect(limpa.locator('[data-porte="estudio"]')).toHaveText(/Estúdio\s*R\$\s?150$/);
      await expect(limpa.locator('[data-porte="q1_2"]')).toHaveText(/1–2 quartos\s*R\$\s?250$/);
      await expect(limpa.locator('[data-porte="q3_mais"]')).toHaveText(/3\+ quartos\s*R\$\s?350$/);
      await expect(page.getByTestId("preco-form").getByRole("button", { name: "Salvar valor" })).toBeVisible();
      await expect(page.getByTestId("precos-historico").locator('[data-vigente="sim"]').first()).toContainText("vigente");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${largura} px: sem rolagem lateral`).toBeLessThanOrEqual(1);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${SAIDA}/t1718-3-central-topo-${largura}.png` });
      await page.screenshot({ path: `${SAIDA}/t1718-3-central-inteira-${largura}.png`, fullPage: true });
      // O bloco dos três cartões do desenho (chave, credenciamento, tabela), inteiro, para o lado a lado.
      await page.getByTestId("avaliadores-chave").locator("xpath=..").screenshot({ path: `${SAIDA}/t1718-3-cartoes-${largura}.png` });
    }
  });
});
