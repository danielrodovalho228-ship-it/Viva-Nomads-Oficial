import { test, expect, type Page } from "@playwright/test";
import {
  NO_LABORATORIO,
  adm,
  apagarContas,
  criarConta,
  criarImovelPronto,
  criarLead,
  entrar,
  novaSenha,
  novoSufixo,
  tornarContratoVigente,
} from "../fixtures/laboratorio";

/*
  T304 — Prompt 61-A (adendos Airbnb ao 32, item 6, e ao 45, item 9). Só no laboratório; tudo a 390 e 1280 px.
   1. "Estadia confirmada": com as duas assinaturas, a tela mostra foto, título, datas, o texto direto e o próximo
      passo (Caução e conferência de entrada, com prazo); "Ver a página da estadia" leva à estadia. Com uma assinatura
      só, a tela não existe (volta para a estadia). A página da estadia não abre a confirmação sozinha (só o link).
   2. Página da estadia: a linha do tempo mostra os horários do imóvel (checkin_after / checkout_before) e o mapa com
      as proximidades; endereço exato só com as duas assinaturas; antes, a região aproximada.
   3. Página do imóvel: "Como funcionam as avaliações" abre e fecha pelo teclado (Enter / Esc, o foco volta ao link);
      a avaliação mostra a cidade e "na Viva desde [ano]" de quem avaliou.
  (A ida para a confirmação logo depois da segunda assinatura pela tela está no t57 e no t205.)
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.61a.${sufixo}@lab.vivanomads.test`, nome: "Lúcia Estadia", role: "owner" as const };
const inq = { email: `inq.61a.${sufixo}@lab.vivanomads.test`, nome: "Paulo Estadia", role: "tenant" as const };
const T = { casa: `Casa da confirmação ${sufixo}`, outra: `Studio meia assinatura ${sufixo}` };
const ENDERECO = "Rua Duque de Caxias, 1450, apto 32";
const LARGURAS = [390, 1280] as const;
const ids: { dono?: string; inq?: string; casa?: string; outra?: string; contrato?: string; meio?: string; antigo?: string } = {};

async function semRolagemLateral(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra, "sem rolagem lateral").toBeLessThanOrEqual(1);
}
async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
async function contrato(propertyId: string, extra: Record<string, unknown> = {}): Promise<string> {
  const lead = await criarLead(ids.dono!, ids.inq!, propertyId, true);
  const { data, error } = await adm()
    .from("contratos")
    .insert({ property_id: propertyId, tenant_id: ids.inq, lead_id: lead, owner_plan: "pro", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, status: "ativo", garantia: "caucao", ...extra })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

test.describe("T304 — Prompt 61-A: Estadia confirmada, horários e mapa, Como funcionam as avaliações", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ cidade: "Uberlândia" }).eq("id", ids.inq);
    ids.casa = await criarImovelPronto(ids.dono, T.casa, { ativo: true });
    ids.outra = await criarImovelPronto(ids.dono, T.outra, { ativo: true });
    // Horários, ponto no mapa, endereço exato e uma proximidade (a mesma lista do anúncio).
    const local = { checkin_after: "15:00", checkout_before: "10:00", lat: -18.9186, lng: -48.2772, exact_address: ENDERECO };
    for (const id of [ids.casa, ids.outra]) {
      const { error } = await adm().from("properties").update(local).eq("id", id);
      if (error) throw error;
      await adm().from("property_proximities").insert({ property_id: id, category: "mercado", name: `Mercado do bairro ${sufixo}`, tipo: "mercado", origem: "osm", distancia_m: 400, sort_order: 1 }); // PERTO-B: distância calculada (nota em texto livre não aparece mais)
    }
    // Contrato assinado pelos dois (Caução pendente) e outro só com a assinatura do morador.
    ids.contrato = await contrato(ids.casa);
    await tornarContratoVigente(ids.contrato, ids.dono, 3200);
    // Sem blocos (as datas do mesmo morador não se sobrepõem): só a assinatura do morador.
    ids.meio = await contrato(ids.outra);
    const { error: eMeio } = await adm().from("contratos").update({ assinado_inquilino_em: new Date().toISOString() }).eq("id", ids.meio);
    if (eMeio) throw eMeio;
    // Uma estadia já encerrada na casa, com a avaliação publicada do morador (a mesma regra do servidor: encerrado há < 14 dias).
    ids.antigo = await contrato(ids.casa, { status: "concluido", encerrado_em: new Date(Date.now() - 86_400_000).toISOString() });
    const { error: eAv } = await adm()
      .from("avaliacoes")
      .insert({ contrato_id: ids.antigo, autor_id: ids.inq, alvo_id: ids.dono, papel_autor: "inquilino", nota_geral: 5, comentario_publico: `Casa silenciosa e bem equipada ${sufixo}.`, status: "publicada", publicada_em: new Date().toISOString() });
    if (eAv) throw eAv;
  });

  test.afterAll(async () => {
    for (const c of [ids.contrato, ids.meio, ids.antigo]) if (c) await adm().from("contratos").delete().eq("id", c);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("1. 'Estadia confirmada' só com as duas assinaturas: texto direto, próximo passo com prazo e um primário", async ({ browser }) => {
    const page = await entrar(browser, inq.email, senha);
    for (const w of LARGURAS) {
      await largura(page, w);
      // Uma assinatura só: a tela não existe e volta para a estadia.
      await page.goto(`/dashboard/estadia/${ids.meio}/confirmada`, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(new RegExp(`/dashboard/estadia/${ids.meio}$`), { timeout: 30_000 });
      await expect(page.getByTestId("estadia-ver-confirmacao")).toHaveCount(0);

      await page.goto(`/dashboard/estadia/${ids.contrato}/confirmada`, { waitUntil: "domcontentloaded" });
      const tela = page.getByTestId("estadia-confirmada");
      await expect(tela).toBeVisible({ timeout: 30_000 });
      await expect(tela.getByRole("heading", { level: 1 })).toHaveText("Estadia confirmada");
      await expect(tela.getByTestId("confirmada-imovel")).toHaveText(T.casa);
      await expect(tela.getByTestId("confirmada-entrada")).toContainText(/^Entrada: \d{2}\/\d{2}\/\d{4} a partir das 15:00$/);
      await expect(tela.getByTestId("confirmada-saida")).toContainText(/^Saída: \d{2}\/\d{2}\/\d{4} até as 10:00$/);
      await expect(tela.getByTestId("confirmada-texto")).toHaveText("Contrato assinado pelos dois lados. Próximo passo:");
      await expect(tela.getByTestId("confirmada-passo-caucao")).toContainText(/Caução\s*até a entrada, em \d{2}\/\d{2}\/\d{4}/);
      await expect(tela.getByTestId("confirmada-passo-conferencia")).toContainText(/Conferência de entrada\s*até \d{2}\/\d{2} às 15:00, horário de Brasília/);
      expect(await tela.innerText()).not.toContain("!");
      await semRolagemLateral(page);
      await page.screenshot({ path: `tests/laboratorio/saida/t304-1-confirmada-${w}.png`, fullPage: true });
    }
    await page.getByTestId("confirmada-ver-estadia").click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/estadia/${ids.contrato}$`), { timeout: 30_000 });
    // A página da estadia não reabre a confirmação sozinha; fica o link.
    await expect(page.getByTestId("pagina-estadia")).toBeVisible();
    await expect(page.getByTestId("estadia-ver-confirmacao")).toHaveAttribute("href", `/dashboard/estadia/${ids.contrato}/confirmada`);
    await page.context().close();
  });

  test("2. página da estadia: horários do imóvel na linha do tempo e mapa; endereço exato só com as duas assinaturas", async ({ browser }) => {
    const page = await entrar(browser, inq.email, senha);
    for (const w of LARGURAS) {
      await largura(page, w);
      await page.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("estadia-etapa-entrada")).toContainText("a partir das 15:00, horário de Brasília", { timeout: 30_000 });
      await expect(page.getByTestId("estadia-etapa-saida")).toContainText("até as 10:00, horário de Brasília");
      const local = page.getByTestId("estadia-local");
      await expect(local).toHaveAttribute("data-exato", "1");
      await expect(local.getByTestId("estadia-endereco")).toContainText(ENDERECO);
      await expect(local.getByTestId("estadia-abrir-mapa")).toHaveAttribute("href", /google\.com\/maps\/search/);
      await expect(local.getByTestId("estadia-proximidades")).toContainText(`Mercado do bairro ${sufixo}`);
      await semRolagemLateral(page);
      await page.screenshot({ path: `tests/laboratorio/saida/t304-2-estadia-${w}.png`, fullPage: true });

      // Antes das duas assinaturas: região aproximada, sem o endereço.
      await page.goto(`/dashboard/estadia/${ids.meio}`, { waitUntil: "domcontentloaded" });
      const aprox = page.getByTestId("estadia-local");
      await expect(aprox).toHaveAttribute("data-exato", "0", { timeout: 30_000 });
      await expect(aprox.getByTestId("estadia-regiao")).toContainText("Região aproximada");
      await expect(aprox.getByTestId("estadia-endereco")).toHaveCount(0);
      await expect(page.getByText(ENDERECO)).toHaveCount(0);
    }
    await page.context().close();
  });

  test("3. página do imóvel: 'Como funcionam as avaliações' pelo teclado e a linha de quem avaliou", async ({ browser }) => {
    const ano = new Date().getUTCFullYear();
    for (const w of LARGURAS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      await page.goto(`/imoveis/${ids.casa}`, { waitUntil: "domcontentloaded" });
      const av = page.getByTestId("avaliacao-real").filter({ hasText: `Casa silenciosa e bem equipada ${sufixo}.` });
      await expect(av.getByTestId("avaliacao-autor")).toHaveText(`Uberlândia · na Viva desde ${ano}`, { timeout: 30_000 });
      const link = page.getByTestId("avaliacoes-como-funcionam");
      const folha = page.getByTestId("avaliacoes-folha");
      // Só pelo teclado: foco no link e Enter (repete até a página terminar de hidratar).
      await expect(async () => {
        await link.focus();
        await page.keyboard.press("Enter");
        await expect(folha).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 30_000 });
      await expect(folha).toContainText("Só avalia quem morou no imóvel, com contrato assinado pela Viva.");
      await expect(folha).toContainText("A avaliação é publicada depois que os dois avaliam, ou 14 dias depois do fim da estadia.");
      // O print espera a folha e a rolagem pararem (sem isso, sai no meio da animação).
      let antes = "";
      await expect(async () => {
        const agora = JSON.stringify([await folha.boundingBox(), await page.evaluate(() => scrollY)]);
        const parado = agora === antes;
        antes = agora;
        expect(parado).toBe(true);
      }).toPass({ intervals: [250], timeout: 10_000 });
      await page.screenshot({ path: `tests/laboratorio/saida/t304-3-avaliacoes-folha-${w}.png` });
      await page.keyboard.press("Escape");
      await expect(folha).toHaveCount(0);
      await expect(link).toBeFocused();
      await av.scrollIntoViewIfNeeded();
      await semRolagemLateral(page);
      await page.screenshot({ path: `tests/laboratorio/saida/t304-3-avaliacoes-${w}.png` });
      await ctx.close();
    }
  });
});
