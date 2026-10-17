import { test, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, fotosReais, novaSenha, novoSufixo, pngDeTeste } from "../fixtures/laboratorio";

/*
  T186 — Cadastro em 5 etapas (prompt 10) + documento conferido na hora (prompt 11) + Negociação (prompt 17 §8),
  a 390 e 1280 px, com a IA, o OSM e o ViaCEP SIMULADOS (nada sai para a rede):
  1. Onde fica: o CEP vem com foco e preenche rua, bairro e cidade; o documento fictício é conferido → ✓.
  2. Fotos: 8 fotos; a IA analisa sozinha ao terminar.
  3. O que encontramos: quartos, banheiros, pessoas e título com "Sugerido · confira"; comodidades pré-marcadas;
     "Pronto para trabalhar de casa" com o contador; proximidades do OSM marcadas.
  4. Preço e disponibilidade: valor mensal com o preço sugerido da região (mediana de 3 anúncios reais); um seletor de
     data só (type=date, sem máscara); campos dentro do cartão; Negociação com desconto e limite privado.
  5. Revisar: documento conferido; publica. O anúncio mostra o que o dono confirmou, e o limite privado não aparece.
  Laboratório: o Supabase local é http e a regra do editor só aceita fotos https na pasta do dono; por isso as fotos
  do rascunho são trocadas pelas de teste (como em criarImovelPronto) antes de publicar.
*/
const SAIDA = "tests/laboratorio/saida";
const FOTOS = ["sala", "quarto-1", "quarto-2", "cozinha", "banheiro", "home-office", "varanda", "fachada"].map((n) => `public/images/imoveis/ube/ube-001-${n}.webp`);

/** Documento FICTÍCIO do laboratório: PDF mínimo com o marcador do caso e bytes aleatórios (hash único). */
function docLab(caso: "ok" | "endereco_errado" | "editado" | "vencido", extra = randomBytes(8).toString("hex")): Buffer {
  return Buffer.concat([Buffer.from(`%PDF-1.4\n% documento ficticio do laboratorio VIVA-LAB-DOC:${caso} ${extra}\n`), Buffer.alloc(12 * 1024, 0x20), Buffer.from("\n%%EOF\n")]);
}

async function esperarSalvo(page: Page) {
  await page.waitForTimeout(2_500);
  await expect(page.getByText("Salvando…")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByText(/Salvo/).first()).toBeVisible({ timeout: 15_000 });
}

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

/** Todo campo da etapa fica dentro do cartão (Q9). Mede tudo de uma vez, já sem a animação de entrada da etapa. */
async function camposDentroDoCartao(page: Page, etapa: string) {
  await page.waitForFunction((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    return !!el && el.getAnimations({ subtree: true }).every((a) => a.playState !== "running");
  }, etapa);
  const fora = await page.getByTestId(etapa).evaluate((cartao) => {
    const c = cartao.getBoundingClientRect();
    return [...cartao.querySelectorAll<HTMLElement>("input, select, textarea")]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ r: el.getBoundingClientRect(), html: el.outerHTML.slice(0, 160) }))
      .filter(({ r }) => r.width > 0 && (r.left < c.left - 1 || r.right > c.right + 1))
      .map(({ r, html }) => `${html} (${Math.round(r.left)}–${Math.round(r.right)} fora de ${Math.round(c.left)}–${Math.round(c.right)})`);
  });
  expect(fora, "campo fora do cartão").toEqual([]);
}

test.describe("T186 — cadastro em 5 etapas com IA, OSM e documento simulados", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (integrações simuladas).");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const bairro = `Bairro Lab ${sufixo}`;
  const ids: Record<string, string | undefined> = {};

  test.beforeAll(async () => {
    // 3 anúncios ATIVOS e reais de 2 quartos no mesmo bairro: a mediana (3.200) é o preço sugerido.
    ids.vizinho = await criarConta({ email: `vizinho.cad.${sufixo}@lab.vivanomads.test`, nome: "Vera Vizinha Sobrenome", role: "owner" }, senha);
    for (const preco of [3000, 3200, 3400]) {
      const id = await criarImovelPronto(ids.vizinho, `Comparável ${preco} ${sufixo}`, { ativo: true, preco });
      await adm().from("properties").update({ bedrooms: 2, address: bairro, city: "Uberlândia" }).eq("id", id);
    }
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono390, ids.dono1280, ids.vizinho]);
  });

  for (const largura of [390, 1280]) {
    test(`${largura}px — do CEP ao anúncio publicado`, async ({ browser }) => {
      const email = `dono.cad${largura}.${sufixo}@lab.vivanomads.test`;
      const nome = `Clara Cadastro${largura} Sobrenome`;
      const donoId = await criarConta({ email, nome, role: "owner" }, senha);
      ids[`dono${largura}`] = donoId;
      const page = await entrar(browser, email, senha);
      await page.setViewportSize({ width: largura, height: 900 });
      await page.addInitScript(() => {
        try {
          sessionStorage.setItem("vivanomads-qualification", JSON.stringify({ eligible: true, baseBadge: false, tHome: false, tWork: false, score: 3 }));
        } catch {
          /* sem sessionStorage */
        }
      });
      // ViaCEP simulado (o laboratório não sai para a rede).
      await page.route("https://viacep.com.br/ws/**", (r) =>
        r.fulfill({ json: { cep: "38400-100", logradouro: "Rua do Laboratório", bairro, localidade: "Uberlândia", uf: "MG" } }),
      );

      // ── Etapa 1: Onde fica ───────────────────────────────────────────────
      await page.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Onde fica" })).toBeVisible({ timeout: 20_000 });
      const cep = page.getByTestId("cadastro-cep");
      await expect(cep).toBeFocused();
      await cep.fill("38400100");
      await expect(cep).toHaveValue("38400-100");
      await expect(page.getByTestId("cadastro-rua")).toHaveValue("Rua do Laboratório", { timeout: 10_000 });
      await expect(page.getByTestId("cadastro-bairro")).toHaveValue(bairro);
      await expect(page.getByTestId("cadastro-cidade")).toHaveValue("Uberlândia");
      await page.getByTestId("cadastro-numero").fill("102");
      await esperarSalvo(page); // o rascunho existe: o documento fica ligado a ele

      const docEnviar = page.getByTestId("documento-vinculo").locator('input[type="file"]');
      await docEnviar.setInputFiles({ name: "conta-de-luz-ficticia.pdf", mimeType: "application/pdf", buffer: docLab("ok") });
      await expect(page.getByTestId("documento-estado")).toHaveAttribute("data-estado", "aprovado", { timeout: 30_000 });
      await expect(page.getByTestId("documento-estado")).toContainText("Documentação conferida ✓");
      await camposDentroDoCartao(page, "etapa-onde-fica");
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t186-1-onde-fica-${largura}.png`, fullPage: true });
      await page.getByTestId("cadastro-continuar").click();

      // ── Etapa 2: Fotos (a IA analisa sozinha) ────────────────────────────
      await expect(page.getByRole("heading", { name: "Fotos do imóvel" })).toBeVisible();
      await page.getByTestId("etapa-fotos").locator('input[type="file"]').first().setInputFiles(FOTOS);
      await expect(page.getByText(/^8\/40 fotos/)).toBeVisible({ timeout: 60_000 });
      await expect(page.getByTestId("ia-fotos")).toHaveAttribute("data-estado", "feita", { timeout: 60_000 });
      await expect(page.getByTestId("aviso-metadados")).toBeVisible();
      // Q7: a frase dos metadados é uma linha de texto só (não vira colunas).
      expect(await page.getByTestId("aviso-metadados").evaluate((el) => getComputedStyle(el).display)).toBe("block");
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t186-2-fotos-${largura}.png`, fullPage: true });
      await page.getByTestId("cadastro-continuar").click();

      // ── Etapa 3: O que encontramos ──────────────────────────────────────
      await expect(page.getByRole("heading", { name: "O que encontramos" })).toBeVisible();
      await expect(page.getByTestId("ia-resumo")).toBeVisible();
      await expect(page.getByTestId("cadastro-quartos")).toHaveValue("2");
      await expect(page.getByTestId("cadastro-banheiros")).toHaveValue("1");
      await expect(page.getByTestId("cadastro-capacidade")).toHaveValue("4"); // 2 por quarto
      const titulo = await page.getByTestId("cadastro-titulo").inputValue();
      expect(titulo.length).toBeGreaterThan(10);
      expect(titulo.length).toBeLessThanOrEqual(60);
      expect(await page.getByTestId("etapa-encontramos").getByTestId("marca-sugerido").count()).toBeGreaterThanOrEqual(4);
      // Comodidades pré-marcadas + bloco "Pronto para trabalhar de casa" com o contador.
      await expect(page.getByTestId("trabalho-contador")).toHaveText("3 de 4 itens essenciais");
      await expect(page.getByTestId("trabalho-mesa_trabalho")).toHaveAttribute("aria-pressed", "true");
      await page.getByTestId("trabalho-home_office").click();
      await expect(page.getByTestId("trabalho-contador")).toHaveText("4 de 4 itens essenciais");
      // Proximidades do OSM (simuladas): todas marcadas.
      const prox = page.getByTestId("proximidade-item");
      await expect(prox).toHaveCount(7, { timeout: 20_000 });
      for (const p of await prox.all()) await expect(p).toHaveAttribute("aria-pressed", "true");
      await prox.filter({ hasText: "Academia" }).click(); // desmarca uma
      // Nenhuma imagem decorativa no meio do formulário.
      await expect(page.getByTestId("etapa-encontramos").locator("img")).toHaveCount(0);
      await page.getByTestId("cadastro-area").fill("52");
      await page.getByTestId("declaracao-sem-cameras").click(); // declaração obrigatória para publicar
      await expect(page.getByTestId("declaracao-sem-cameras")).toHaveAttribute("aria-checked", "true");
      await camposDentroDoCartao(page, "etapa-encontramos");
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t186-3-o-que-encontramos-${largura}.png`, fullPage: true });
      await page.getByTestId("cadastro-continuar").click();

      // ── Etapa 4: Preço e disponibilidade ────────────────────────────────
      await expect(page.getByRole("heading", { name: "Preço e disponibilidade" })).toBeVisible();
      await expect(page.getByTestId("cadastro-preco")).toHaveValue("3200", { timeout: 15_000 });
      await expect(page.getByTestId("preco-regiao")).toContainText("Sugestão para imóveis parecidos na região");
      await expect(page.getByTestId("cadastro-consumo")).toHaveValue("220"); // 2 quartos
      // Um seletor de data só: o calendário nativo, sem máscara de digitação.
      const de = page.getByTestId("disponivel-de");
      const ate = page.getByTestId("disponivel-ate");
      for (const d of [de, ate]) {
        await expect(d).toHaveAttribute("type", "date");
        expect(await d.getAttribute("inputmode")).toBeNull();
      }
      await de.fill("2026-11-01");
      await expect(de).toHaveValue("2026-11-01");
      // Q9: rótulo curto; no celular os dois campos ficam um embaixo do outro, com a mesma largura.
      await expect(page.getByTestId("disponibilidade")).toContainText("Disponível até");
      const bde = (await de.boundingBox())!;
      const bate = (await ate.boundingBox())!;
      if (largura === 390) {
        expect(bate.y).toBeGreaterThanOrEqual(bde.y + bde.height - 1);
        expect(Math.abs(bate.width - bde.width)).toBeLessThanOrEqual(1);
      } else {
        expect(Math.abs(bate.y - bde.y)).toBeLessThanOrEqual(1); // lado a lado e alinhados
      }
      // Negociação: aceita, só "meses"; 6% a partir de 6 meses; limite privado de R$ 2.950.
      await page.getByTestId("negociar-sim").click();
      await page.getByTestId("negociavel-meses").click();
      await page.getByTestId("adicionar-faixa").click();
      await page.getByLabel("Meses da faixa 1").fill("6");
      await page.getByLabel("Desconto da faixa 1").fill("6");
      await page.getByTestId("limites-privados").getByRole("spinbutton").first().fill("2950");
      await camposDentroDoCartao(page, "etapa-preco");
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t186-4-preco-${largura}.png`, fullPage: true });
      await page.getByTestId("cadastro-continuar").click();

      // ── Etapa 5: Revisar e publicar ─────────────────────────────────────
      await expect(page.getByRole("heading", { name: "Revisar e publicar" })).toBeVisible();
      await expect(page.getByTestId("revisar-documento")).toHaveAttribute("data-estado", "aprovado");
      await expect(page.getByTestId("previa-anuncio")).toContainText("6% de desconto a partir de 6 meses");
      await expect(page.getByTestId("qualidade-anuncio")).toBeVisible();
      await page.screenshot({ path: `${SAIDA}/t186-5-revisar-${largura}.png`, fullPage: true });
      await esperarSalvo(page);
      await page.getByRole("button", { name: "Salvar como rascunho" }).click();
      await page.waitForURL(/\/dashboard\/imoveis$/, { timeout: 30_000 });

      // Laboratório: fotos https de teste no rascunho (a regra do editor só aceita https na pasta do dono).
      const { data: rasc } = await adm().from("properties").select("id, draft_data").eq("owner_id", donoId).eq("status", "draft").single();
      const imovelId = rasc!.id as string;
      const fotos = [];
      for (let i = 0; i < 8; i++) {
        const caminho = `${donoId}/${imovelId}-${i}.png`;
        await adm().storage.from("property-photos").upload(caminho, pngDeTeste(i), { contentType: "image/png", upsert: true });
        fotos.push({ id: `lab-${i}`, url: `https://lab.vivanomads.test/storage/v1/object/public/property-photos/${caminho}`, name: "", path: caminho, demo: false });
      }
      await adm().from("properties").update({ draft_data: { ...(rasc!.draft_data as object), photos: fotos } }).eq("id", imovelId);

      await page.goto(`/dashboard/imoveis/novo?draft=${imovelId}&etapa=4`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Revisar e publicar" })).toBeVisible({ timeout: 20_000 });
      await page.getByTestId("aceite-ia").getByRole("checkbox").check();
      await expect(page.getByTestId("publicar-anuncio")).toBeEnabled({ timeout: 20_000 });
      await page.getByTestId("publicar-anuncio").click();
      await page.waitForURL(/\/dashboard\/imoveis$/, { timeout: 30_000 });
      const { data: pub } = await adm().from("properties").select("status, title, bedrooms, bathrooms, max_guests, monthly_price, negociacao").eq("id", imovelId).single();
      expect(pub!.status).toBe("active");
      expect(pub!.title).toBe(titulo);
      expect([pub!.bedrooms, pub!.bathrooms, pub!.max_guests, Number(pub!.monthly_price)]).toEqual([2, 1, 4, 3200]);
      expect(pub!.negociacao).toMatchObject({ aceita: true, itens: ["meses"], descontos: [{ mesesMin: 6, pct: 6 }] });

      // O anúncio público mostra o que o dono confirmou — e nunca o limite privado.
      await fotosReais(imovelId, donoId);
      const publico = await browser.newContext({ viewport: { width: largura, height: 900 }, storageState: { cookies: [], origins: [] } });
      const p2 = await publico.newPage();
      await p2.goto(`/imoveis/${imovelId}`, { waitUntil: "domcontentloaded" });
      await expect(p2.getByRole("heading", { level: 1 })).toHaveText(titulo, { timeout: 20_000 });
      await expect(p2.getByTestId("desconto-estadia").first()).toHaveText("6% de desconto a partir de 6 meses");
      await expect(p2.locator("main")).toContainText("Farmácia Central (exemplo do laboratório)");
      await expect(p2.locator("main")).not.toContainText("Academia Movimento");
      const html = await p2.content();
      expect(html).not.toContain("2.950");
      expect(html).not.toMatch(/valor_?[mM]inimo|limpezas_?[mM]ax/);
      await p2.screenshot({ path: `${SAIDA}/t186-6-anuncio-publicado-${largura}.png`, fullPage: false });
      await publico.close();
      await page.context().close();
    });
  }
});
