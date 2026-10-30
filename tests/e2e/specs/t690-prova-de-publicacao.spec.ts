import { randomBytes } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, fotosReais, novaSenha, novoSufixo, pngDeTeste, aceitarTermoIaSePreciso } from "../fixtures/laboratorio";
import { abrirSecoesPasso10, continuarAte, noPasso } from "../fixtures/cadastro";
import { emDiasBR, isoParaBR, reais } from "../fixtures/rascunho-cadastro";

/*
  T690 — PROVA DE PUBLICAÇÃO (QA do Muse, 30/10): o assistente inteiro, do rascunho vazio ao anúncio no ar, e a página
  pública com os MESMOS números da prévia do Passo 10.
  Massa no padrão da 0259 (supabase/migrations/0259_qa_rascunho_prova_publicacao.sql), descartável e só no laboratório:
  uma conta de teste, um rascunho NOVO e vazio "[TESTE QA] Prova de publicação …" (preço 0, sem endereço, só o título
  no draft_data) e a qualificação DESTE rascunho com o documento já aprovado E com o arquivo no bucket (sem o arquivo, a
  qualificação nova que a tela grava ao publicar não herda a aprovação) — a aprovação real é ação de admin. Todo o
  resto (tipo, fotos, endereço, detalhes, comodidades, regras, descrição, preço, disponibilidade, identidade, publicar)
  é feito na tela, como a t186. Nada de migração: tudo criado aqui e apagado no fim.
   1. Os 10 passos, a 1280 px, até "Publicar anúncio" → o anúncio fica "active".
   2. A prévia do Passo 10 guarda Mensal e Total por mês; a página pública (1280) mostra os mesmos valores, a taxa de
      preparação (limpeza) na lista "Fora do total mensal" e NÃO dentro do total por mês.
   3. Anúncio de teste: na página pública (390 e 1280) o visitante vê a faixa "Anúncio de teste…" e o "Solicitar"
      travado; na /buscar o anúncio não aparece.
  IA, OSM e ViaCEP simulados (nada sai para a rede).
*/
const SAIDA = "tests/laboratorio/saida";
const FOTOS = ["sala", "quarto-1", "quarto-2", "cozinha", "banheiro", "home-office", "varanda", "fachada"].map((n) => `public/images/imoveis/ube/ube-001-${n}.webp`);
const FAIXA_VISITANTE = "Anúncio de teste da equipe Viva — não é um imóvel disponível";
const senha = novaSenha();
const sufixo = novoSufixo();
const bairro = `Bairro Prova ${sufixo}`;
const titulo = `[TESTE QA] Prova de publicação ${sufixo}`;
const dono = { email: `dono.t690.${sufixo}@lab.vivanomads.test`, nome: "Paula Prova Sobrenome", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};
const previa: { mensal?: number; totalMes?: number } = {};

async function esperarSalvo(page: Page) {
  await page.waitForTimeout(2_500);
  await expect(page.getByText("Salvando…")).toHaveCount(0, { timeout: 15_000 });
}

test.describe("T690 — prova de publicação: os 10 passos, publicar e a página pública igual à prévia", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (integrações simuladas).");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true, preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    // A massa da 0259: o rascunho vazio, como o autosave deixa um anúncio recém-aberto, com o título no draft_data.
    const { data, error } = await adm()
      .from("properties")
      .insert({ owner_id: ids.dono, status: "draft", title: titulo, city: "Uberlândia", monthly_price: 0, address: "", draft_data: { title: titulo } })
      .select("id")
      .single();
    if (error) throw error;
    ids.imovel = data!.id as string;
    // …e a qualificação dele com o documento aprovado (o portão do Publicar lê a última do imóvel). Como na 0259, a linha
    // precisa do ARQUIVO (document_path): antes de publicar a tela grava uma qualificação nova, e o gatilho da 0072 só
    // herda a aprovação de uma linha com arquivo — sem ele o servidor recusa ("Documentação do imóvel ainda não aprovada").
    // O "Antes de anunciar" já respondido, como a /qualificar deixaria (a t186 grava o mesmo depois do envio do documento).
    const caminhoDoc = `${ids.dono}/${randomBytes(6).toString("hex")}.png`;
    const { error: eUp } = await adm().storage.from("property-docs").upload(caminhoDoc, pngDeTeste(7), { contentType: "image/png" });
    if (eUp) throw eUp;
    const { error: eQ } = await adm()
      .from("qualification_checklists")
      .insert({
        owner_id: ids.dono,
        property_id: ids.imovel,
        document_path: caminhoDoc,
        document_hash_sha256: randomBytes(32).toString("hex"),
        document_uploaded_at: new Date().toISOString(),
        document_status: "approved",
        document_reviewed_at: new Date().toISOString(),
        status: "pending",
        formulario: { versao: 1, elig: { furnished: true, accepts30days: true, iptuOk: true, habitable: true, isOwnerOrAgent: true, condoAllows: "yes" } },
      });
    if (eQ) throw eQ;
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1–2. 1280 px — os 10 passos na tela, a prévia do Passo 10 e Publicar", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route("https://viacep.com.br/ws/**", (r) =>
      r.fulfill({ json: { cep: "38400-100", logradouro: "Rua da Prova", bairro, localidade: "Uberlândia", uf: "MG" } }),
    );
    const continuar = page.getByTestId("cadastro-continuar");
    await page.goto(`/dashboard/imoveis/novo?draft=${ids.imovel}&etapa=tipo`, { waitUntil: "domcontentloaded" });

    // 1. Tipo
    await noPasso(page, "tipo", 30_000);
    await continuar.click();
    // 2. Fotos (a IA simulada analisa sozinha)
    await noPasso(page, "fotos");
    await page.getByTestId("etapa-fotos").locator('input[type="file"]').first().setInputFiles(FOTOS);
    await expect(page.getByText(/^8\/40 fotos/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("ia-fotos")).toHaveAttribute("data-estado", "feita", { timeout: 60_000 });
    await continuar.click();
    // 3. Endereço (ViaCEP simulado)
    await noPasso(page, "endereco");
    await page.getByTestId("cadastro-cep").fill("38400100");
    await expect(page.getByTestId("cadastro-rua")).toHaveValue("Rua da Prova", { timeout: 10_000 });
    await page.getByTestId("cadastro-numero").fill("120");
    await esperarSalvo(page);
    await continuar.click();
    // 4. Detalhes
    await noPasso(page, "detalhes");
    await page.getByTestId("cadastro-banheiros").fill("1");
    await page.getByTestId("cadastro-capacidade").fill("3");
    await page.getByTestId("cadastro-area").fill("48");
    await continuar.click();
    // 5. Comodidades: internet, declaração das câmeras e o padrão mínimo de conforto
    await noPasso(page, "comodidades");
    await page.getByLabel("Velocidade da internet em Mbps").fill("300");
    const semCameras = page.getByTestId("declaracao-sem-cameras");
    await semCameras.scrollIntoViewIfNeeded();
    if ((await semCameras.getAttribute("aria-checked")) !== "true") await semCameras.click();
    await expect(semCameras).toHaveAttribute("aria-checked", "true");
    await page.getByTestId("conforto-marcar-todos").click();
    await expect(page.getByTestId("conforto-faltam")).toHaveText("Todos os itens confirmados.");
    await continuar.click();
    // 6. Regras: tipo de entrada (obrigatório para publicar)
    await noPasso(page, "regras");
    await page.getByTestId("tipo-entrada-porteiro").click();
    await expect(page.getByTestId("tipo-entrada-porteiro")).toHaveAttribute("aria-checked", "true");
    await continuar.click();
    // 7. Título e descrição: o título da massa segue (é o que faz dele um anúncio de teste)
    await noPasso(page, "descricao");
    const campoTitulo = page.getByTestId("cadastro-titulo");
    if ((await campoTitulo.inputValue()) !== titulo) await campoTitulo.fill(titulo);
    await continuar.click();
    // 8. Preço: R$ 3.200/mês, negociação como a t186, e a taxa de preparação (limpeza) de R$ 450, fora do total
    await noPasso(page, "preco");
    await page.getByTestId("cadastro-preco").fill("3200");
    await expect(page.getByTestId("cadastro-preco")).toHaveValue("3.200");
    await page.getByTestId("negociar-sim").click();
    await page.getByTestId("negociavel-meses").click();
    await page.getByTestId("adicionar-faixa").click();
    await page.getByLabel("Meses da faixa 1").fill("6");
    await page.getByLabel("Desconto da faixa 1").fill("6");
    await page.getByTestId("etapa-preco").getByPlaceholder("450").fill("450");
    await continuar.click();
    // 9. Disponibilidade
    await noPasso(page, "disponibilidade");
    await page.getByTestId("disponivel-de").pressSequentially(isoParaBR(emDiasBR(10)).replace(/\//g, ""));
    await continuar.click();

    // 10. Revise e publique: identidade (documento já aprovado pela massa) e a prévia
    await noPasso(page, "revisao");
    await abrirSecoesPasso10(page);
    const antes = page.getByTestId("antes-de-publicar");
    const identidade = antes.getByTestId("etapa-identidade");
    if ((await identidade.getAttribute("data-estado")) !== "confirmada") {
      await identidade.getByTestId("identidade-confirmar").click();
      await expect(identidade.getByTestId("identidade-confirmada")).toBeVisible({ timeout: 20_000 });
    }
    await expect(page.getByTestId("documento-estado")).toHaveAttribute("data-estado", "aprovado", { timeout: 30_000 });
    previa.mensal = reais((await page.getByTestId("previa-preco-mensal").textContent()) ?? "");
    previa.totalMes = reais((await page.getByTestId("previa-preco-total-mes").textContent()) ?? "");
    expect(previa.mensal, "Mensal na prévia").toBe(3200);
    expect(previa.totalMes, "Total por mês na prévia").toBeGreaterThan(3200);
    await page.screenshot({ path: `${SAIDA}/t690-10-previa-1280.png`, fullPage: true });
    await esperarSalvo(page);
    await page.getByTestId("assistente-sair").click();
    await page.waitForURL(/\/dashboard\/imoveis\?saiu=assistente$/, { timeout: 30_000 });

    // Laboratório (como a t186): o Supabase local é http e o editor só aceita fotos https na pasta do dono.
    const { data: rasc } = await adm().from("properties").select("draft_data").eq("id", ids.imovel!).single();
    const fotos = [];
    for (let i = 0; i < 8; i++) {
      const caminho = `${ids.dono}/${ids.imovel}-${i}.png`;
      await adm().storage.from("property-photos").upload(caminho, pngDeTeste(i), { contentType: "image/png", upsert: true });
      fotos.push({ id: `lab-${i}`, url: `https://lab.vivanomads.test/storage/v1/object/public/property-photos/${caminho}`, name: "", path: caminho, demo: false });
    }
    await adm().from("properties").update({ draft_data: { ...(rasc!.draft_data as object), photos: fotos } }).eq("id", ids.imovel!);

    await page.goto(`/dashboard/imoveis/novo?draft=${ids.imovel}&etapa=revisao`, { waitUntil: "domcontentloaded" });
    await noPasso(page, "revisao", 30_000);
    await aceitarTermoIaSePreciso(page);
    const resolver = page.getByTestId("publicar-falta-conforto-resolver");
    const publicar = page.getByTestId("publicar-anuncio");
    await expect(publicar.and(page.locator(":enabled")).or(resolver)).toBeVisible({ timeout: 20_000 });
    if (await resolver.isVisible()) {
      await resolver.click();
      await page.getByTestId("conforto-marcar-todos").click();
      await continuarAte(page, "comodidades", "revisao");
    }
    await expect(publicar).toBeEnabled({ timeout: 20_000 });
    await publicar.click();
    // Publicou → vai para Meus imóveis; recusou → fica no Passo 10 com o motivo em vermelho (publishError) ou no
    // "publicar-motivo". A espera devolve esse texto, para a falha dizer POR QUE não publicou.
    await expect
      .poll(
        async () => {
          if (new URL(page.url()).pathname === "/dashboard/imoveis") return "publicou";
          const motivos = (await page.locator("p.text-red-600, [data-testid=publicar-motivo]").allTextContents()).map((t) => t.trim()).filter(Boolean);
          return motivos.length ? `recusou: ${motivos.join(" | ")}` : "esperando";
        },
        { timeout: 45_000, intervals: [1_000] },
      )
      .toBe("publicou");
    const { data: pub } = await adm().from("properties").select("status, title, monthly_price").eq("id", ids.imovel!).single();
    expect(pub).toMatchObject({ status: "active", title: titulo });
    expect(Number(pub!.monthly_price)).toBe(3200);
    await page.context().close();
  });

  test("2. 1280 px — a página pública mostra os mesmos Mensal e Total por mês da prévia; a limpeza fica fora do total", async ({ browser }) => {
    expect(previa.totalMes, "o caso 1 leu a prévia").toBeTruthy();
    await fotosReais(ids.imovel!, ids.dono!);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: { cookies: [], origins: [] } });
    const p = await ctx.newPage();
    await p.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
    await expect(p.getByRole("heading", { level: 1 })).toHaveText(titulo, { timeout: 20_000 });
    const lista = p.getByTestId("total-mensal");
    await expect(lista).toBeVisible({ timeout: 20_000 });
    expect(reais((await lista.locator('li[data-taxa="mensal"]').textContent()) ?? ""), "Mensal na página = prévia").toBe(previa.mensal);
    expect(reais((await p.getByTestId("total-por-mes").textContent()) ?? ""), "Total por mês na página = prévia").toBe(previa.totalMes);
    // A limpeza (taxa de preparação) só na lista "Fora do total mensal", com o valor; nunca dentro do total.
    await expect(lista.locator('li[data-taxa="preparacao"]')).toHaveCount(0);
    const fora = p.getByTestId("taxas-itemizadas");
    await expect(fora).toContainText("Fora do total mensal");
    expect(reais((await fora.locator('li[data-taxa="preparacao"]').textContent()) ?? "")).toBe(450);
    await p.getByTestId("total-mensal").scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${SAIDA}/t690-publico-precos-1280.png`, fullPage: false });
    await ctx.close();
  });

  for (const largura of [390, 1280] as const) {
    test(`3. ${largura} px — anúncio de teste: faixa e "Solicitar" travado para o visitante; fora da /buscar`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 }, storageState: { cookies: [], origins: [] } });
      const p = await ctx.newPage();
      await p.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("faixa-anuncio-teste")).toHaveText(FAIXA_VISITANTE, { timeout: 20_000 });
      await expect(p.getByTestId("faixa-anuncio-teste")).toHaveAttribute("data-modo", "visitante");
      const botao = largura === 1280 ? p.getByTestId("cartao-solicitar") : p.getByTestId("barra-solicitar");
      await expect(botao).toBeDisabled();
      await p.screenshot({ path: `${SAIDA}/t690-publico-faixa-${largura}.png`, fullPage: false });

      await p.goto("/buscar?local=Uberl%C3%A2ndia", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("card-resultado").first()).toBeVisible({ timeout: 30_000 });
      await expect(p.locator(`[data-testid="card-resultado"][data-id="${ids.imovel}"]`)).toHaveCount(0);
      await expect(p.getByText(titulo)).toHaveCount(0);
      await ctx.close();
    });
  }
});
