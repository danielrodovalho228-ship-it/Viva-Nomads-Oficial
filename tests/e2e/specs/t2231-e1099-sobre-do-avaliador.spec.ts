import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2231 — E1099 parte 2 (#4128): o "Sobre" do avaliador credenciado (ORDEM-DUET-564 §1, trava CURTA e nomeada do item)
  @E1099 — só no laboratório. A t2219 continua a ser o portão da jornada; esta é a trava do item:
   1. o avaliador escreve o "Sobre" na área dele (/dashboard/parceiro/avaliacao) → "Texto salvo…", o banco guarda e o
      perfil público (/avaliadores/<número>) mostra a secção "Sobre" com o texto;
   2. até 600 caracteres: exactamente 600 grava; 601 é recusado com o motivo e o banco não muda;
   3. telefone ou e-mail no "Sobre" → o aviso da casa, nada é gravado, e o perfil público continua sem o contacto;
   4. apagar o texto → "Texto apagado…", e a secção some do perfil público (nunca uma caixa vazia).
  Antes do #4128 (main sem a 0355 e sem o campo) a trava cai: a área do avaliador não tem o "Sobre".
*/
const AVISO = "Para sua segurança e registro, o contato acontece pela plataforma — remova telefone, e-mail ou apps de mensagem do texto.";
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE = "Araguari";
const avaliador = { email: `aval.t2231.${sufixo}@lab.vivanomads.test`, nome: "Rita Avaliadora Teste", role: "tenant" as const };
const ids: Record<string, string> = {};
const cred = { id: "", numero: "" };
const SOBRE = "Avalio imóveis mobiliados há oito anos, com foco em conforto acústico e iluminação.";

async function abrirArea(browser: Browser): Promise<Page> {
  const page = await entrar(browser, avaliador.email, senha);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(page.url()).origin }]);
  await page.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("meu-sobre"), "a área do avaliador tem o \"Sobre\"").toBeVisible({ timeout: 30_000 });
  return page;
}
async function salvar(page: Page, texto: string, semLimite = false) {
  const campo = page.getByTestId("meu-sobre").locator('textarea[name="sobre"]');
  if (semLimite) await campo.evaluate((el) => el.removeAttribute("maxlength"));
  await campo.fill(texto);
  await page.getByTestId("salvar-sobre").getByRole("button", { name: "Salvar texto" }).click();
}
const sobreNoBanco = async () => (await adm().from("avaliadores_credenciamento").select("sobre").eq("id", cred.id).single()).data?.sobre ?? null;
async function perfilPublico(browser: Browser): Promise<{ page: Page; fechar: () => Promise<void> }> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ctx.addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(page.url()).origin }]);
  await page.goto(`/avaliadores/${cred.numero}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
  // P1 (ORDEM-DUET-668): antes de qualquer ausência ("sem contacto", "sem a secção Sobre"), o perfil tem de estar MESMO na
  // tela — um elemento positivo dele. Uma página ainda vazia passava as ausências sem provar nada.
  await expect(page.getByTestId("avaliador-numero"), "o perfil público carregou").toContainText(cred.numero, { timeout: 30_000 });
  return { page, fechar: () => ctx.close() };
}

test.describe("T2231 — E1099: o \"Sobre\" do avaliador credenciado @E1099", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.av = await criarConta(avaliador, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.av);
    const { error: ePil } = await adm().from("vistoria_piloto").insert({ user_id: ids.av, nota: "T2231 (laboratório)" });
    if (ePil) throw ePil;
    const { data: parc, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.av, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: avaliador.nome, slug: `aval-t2231-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (error) throw error;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: c, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: parc.id, cidade: CIDADE, numero_credenciado: n, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test", conduta_versao: "2026-10-23", ativado_em: new Date().toISOString() })
      .select("id, numero_credenciado")
      .single();
    if (eC) throw eC;
    cred.id = c.id as string;
    cred.numero = c.numero_credenciado as string;
  });
  test.afterAll(async () => {
    if (cred.id) await adm().from("avaliadores_credenciamento").delete().eq("id", cred.id);
    if (ids.av) await adm().from("vistoria_piloto").delete().eq("user_id", ids.av);
    await apagarContas([ids.av]);
  });

  test("1. o avaliador escreve o \"Sobre\": salva, e o perfil público mostra a secção com o texto", async ({ browser }) => {
    const page = await abrirArea(browser);
    await expect(page.getByTestId("meu-sobre-explicacao")).toHaveText("Este texto aparece no seu perfil público.");
    await salvar(page, SOBRE);
    await expect(page.getByTestId("acao-ok")).toHaveText("Texto salvo. Ele aparece no seu perfil público.", { timeout: 20_000 });
    expect(await sobreNoBanco()).toBe(SOBRE);
    await page.context().close();
    const pub = await perfilPublico(browser);
    await expect(pub.page.getByTestId("avaliador-sobre")).toContainText("Sobre");
    await expect(pub.page.getByTestId("avaliador-sobre")).toContainText(SOBRE);
    await pub.fechar();
  });

  test("2. até 600 caracteres: 600 grava; 601 é recusado com o motivo e o banco não muda", async ({ browser }) => {
    const page = await abrirArea(browser);
    const seiscentos = "a".repeat(590) + " conforto.";
    expect(seiscentos.length).toBe(600);
    await salvar(page, seiscentos);
    await expect(page.getByTestId("acao-ok")).toBeVisible({ timeout: 20_000 });
    expect(await sobreNoBanco()).toBe(seiscentos);
    await salvar(page, seiscentos + "x", true);
    await expect(page.getByTestId("acao-erro")).toHaveText('O texto "Sobre" tem até 600 caracteres.', { timeout: 20_000 });
    // E1139 (ORDEM-DUET-601): o motivo da recusa está dentro do ecrã de quem salvou (390×844).
    await expect(page.getByTestId("acao-erro"), "601: o motivo está à vista").toBeInViewport();
    expect(await sobreNoBanco(), "o banco ficou com os 600").toBe(seiscentos);
    await page.context().close();
  });

  test("3. telefone ou e-mail no \"Sobre\": o aviso da casa, nada gravado, perfil público sem o contacto", async ({ browser }) => {
    const page = await abrirArea(browser);
    await salvar(page, SOBRE);
    await expect(page.getByTestId("acao-ok")).toBeVisible({ timeout: 20_000 });
    for (const contacto of ["Fale comigo no (34) 99876-5432", "Escreva para rita.avalia@exemplo.com.br"]) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("meu-sobre")).toBeVisible({ timeout: 30_000 });
      await salvar(page, `${SOBRE} ${contacto}`);
      await expect(page.getByTestId("acao-erro"), contacto).toHaveText(AVISO, { timeout: 20_000 });
      // E1139: o aviso da casa está dentro do ecrã de quem salvou (390×844).
      await expect(page.getByTestId("acao-erro"), `${contacto}: o aviso está à vista`).toBeInViewport();
      expect(await sobreNoBanco(), `${contacto}: nada gravado`).toBe(SOBRE);
    }
    await page.context().close();
    const pub = await perfilPublico(browser);
    const corpo = await pub.page.locator("main").innerText();
    expect(corpo).not.toMatch(/99876-5432|rita\.avalia@/);
    await pub.fechar();
  });

  test("4. apagar o texto: \"Texto apagado…\" e a secção some do perfil público", async ({ browser }) => {
    const page = await abrirArea(browser);
    await salvar(page, "");
    await expect(page.getByTestId("acao-ok")).toHaveText("Texto apagado. A seção Sobre não aparece no seu perfil.", { timeout: 20_000 });
    expect(await sobreNoBanco()).toBeNull();
    await page.context().close();
    const pub = await perfilPublico(browser);
    await expect(pub.page.getByTestId("avaliador-sobre")).toHaveCount(0);
    await pub.fechar();
  });
});
