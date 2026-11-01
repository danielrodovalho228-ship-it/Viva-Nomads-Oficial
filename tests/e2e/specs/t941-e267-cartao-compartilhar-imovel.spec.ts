import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T941 — #2038 (E267, resíduo): com o contrato assinado pelas duas partes, o dono recebe o cartão do anúncio para
 * compartilhar — e o aviso agora diz QUAL anúncio (o dono pode ter vários). Antes: "Seu anúncio está no ar: compartilhe
 * o cartão" / "o cartão do seu anúncio está pronto".
 * Pela tela real: o inquilino assina (390) e o dono assina (1280), cada um com o código de 6 números que chega à caixa de
 * testes (contas is_teste → emails_teste). Depois:
 *   • o dono tem UM e-mail "anuncio_compartilhar" com o assunto "Compartilhe o cartão de <título> · Viva Nomads",
 *     a abertura "o contrato de <título> foi assinado pelas duas partes, e o cartão do anúncio está pronto" e o título
 *     no bloco de dados; nada de "seu anúncio está pronto", nada de "undefined";
 *   • o inquilino não recebe esse e-mail (é do dono);
 *   • L-86 (achado aqui, corrigido no #2069): o e-mail agora sai — o caso é teste normal;
 *   • o destino do aviso (/dashboard/imoveis/<id>/cartao) abre a 390 e 1280 com a prévia carregada (1080 px),
 *     sem painel-erro e sem rolagem lateral.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const TITULO = `Studio Cartão ${sufixo}`;
const dono = { email: `dono.t941.${sufixo}@lab.vivanomads.test`, nome: "Rogério Cartão", role: "owner" as const };
const inq = { email: `inq.t941.${sufixo}@lab.vivanomads.test`, nome: "Inês Cartão", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; contrato?: string } = {};

async function codigoDaCaixa(usuarioId: string, depoisDe: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const { data } = await adm()
      .from("emails_teste")
      .select("corpo")
      .eq("usuario_id", usuarioId)
      .eq("evento", "contract_signature_code")
      .gte("criado_em", depoisDe)
      .order("criado_em", { ascending: false })
      .limit(1);
    const m = /":\s*(\d{6})\s*$/m.exec(String(data?.[0]?.corpo ?? "").trim());
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("O código de assinatura não chegou à caixa de testes em 30 s.");
}
async function emailsDoEvento(usuarioId: string, evento: string): Promise<{ assunto: string; corpo: string }[]> {
  const { data } = await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", usuarioId).eq("evento", evento).order("criado_em");
  return (data ?? []).map((d) => ({ assunto: String(d.assunto ?? ""), corpo: String(d.corpo ?? "") }));
}
async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}
async function assinarPelaTela(browser: Browser, quem: { email: string; id: string }, largura: number) {
  const page = await entrar(browser, quem.email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await page.goto(`/dashboard/contratos/${ids.contrato}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("form-assinar")).toBeVisible({ timeout: 30_000 });
  await semRolagemLateral(page);
  const antes = new Date(Date.now() - 2_000).toISOString();
  await page.getByTestId("assinar-pedir-codigo").click();
  await expect(page.getByText(/Enviamos 6 números/)).toBeVisible({ timeout: 45_000 });
  await page.getByTestId("assinar-aceite").check();
  await page.getByTestId("assinar-codigo").fill(await codigoDaCaixa(quem.id, antes));
  await page.getByTestId("assinar-enviar").click();
  await expect(page.getByTestId("form-assinar")).toHaveCount(0, { timeout: 45_000 });
  await page.context().close();
}

test.describe("T941 — #2038 E267 resíduo: o cartão para compartilhar nomeia o imóvel", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha, true);
    ids.inq = await criarConta(inq, senha, true);
    const { error: eTeste } = await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    if (eTeste) throw eTeste;
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true, preco: 3200 });
    const { data, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.imovel,
        tenant_id: ids.inq,
        owner_plan: "essential",
        faixa: "temporada",
        prazo_total_dias: 60,
        aluguel_mensal: 3200,
        tamanho_bloco_meses: 2,
        comissao_percent: 0.08,
        comissao_valor: 256,
        qtd_ocupantes: 1,
        status: "ativo",
        garantia: "caucao",
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    // O dono só assina com as instruções de entrada completas (conferido no servidor antes do código).
    const { error: eCheckin } = await adm()
      .from("contratos_checkin")
      .insert({ contrato_id: ids.contrato, horario: "14:00", instrucoes: "Chave na portaria, apto 12.", plantao: "34999990000" });
    if (eCheckin) throw eCheckin;
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    const pessoas = [ids.dono, ids.inq].filter(Boolean) as string[];
    await adm().from("emails_teste").delete().in("usuario_id", pessoas);
    if (ids.contrato) {
      for (const t of ["contratos_checkin", "pagamentos_bloco", "contrato_eventos", "contrato_blocos"]) await adm().from(t).delete().eq("contrato_id", ids.contrato);
      await adm().from("contratos").delete().eq("id", ids.contrato);
    }
    await apagarContas(pessoas);
  });

  test("as duas assinaturas pela tela → o e-mail do cartão diz qual anúncio", async ({ browser }) => {
    test.setTimeout(240_000);
    await assinarPelaTela(browser, { email: inq.email, id: ids.inq! }, 390);
    expect(await emailsDoEvento(ids.dono!, "anuncio_compartilhar"), "com uma assinatura só, nada de cartão").toHaveLength(0);
    await assinarPelaTela(browser, { email: dono.email, id: ids.dono! }, 1280);

    await expect.poll(async () => (await emailsDoEvento(ids.dono!, "anuncio_compartilhar")).length, { timeout: 45_000 }).toBe(1);
    const [m] = await emailsDoEvento(ids.dono!, "anuncio_compartilhar");
    test.info().annotations.push({ type: "assunto", description: m.assunto });
    expect(m.assunto).toMatch(new RegExp(`^Compartilhe o cartão de ${TITULO}`));
    expect(m.assunto).toContain("Viva Nomads");
    expect(m.corpo).toContain(`o contrato de ${TITULO} foi assinado pelas duas partes, e o cartão do anúncio está pronto`);
    expect(m.corpo.split(TITULO).length - 1, "o título também no bloco de dados").toBeGreaterThanOrEqual(2);
    expect(m.corpo).not.toMatch(/seu anúncio está pronto|undefined|null/);
    expect(await emailsDoEvento(ids.inq!, "anuncio_compartilhar"), "o cartão é do dono").toHaveLength(0);
  });

  test("o destino do aviso (/cartao) abre a 390 e 1280", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await entrar(browser, dono.email, senha);
    for (const largura of [390, 1280]) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/dashboard/imoveis/${ids.imovel}/cartao`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("cartao-compartilhar")).toHaveAttribute("data-tipo", "ownercard", { timeout: 30_000 });
      // A prévia do cartão CARREGA de fato (não só existe a <img>).
      await expect.poll(() => page.getByTestId("cartao-previa").evaluate((i: HTMLImageElement) => i.naturalWidth), { timeout: 45_000 }).toBe(1080);
      await expect(page.getByTestId("painel-erro")).toHaveCount(0);
      await semRolagemLateral(page);
    }
    await page.context().close();
  });
});
