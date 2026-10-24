import { test, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, fotosReais, novaSenha, novoSufixo, pngDeTeste } from "../fixtures/laboratorio";

/*
  Rodada da vigia 24/10 (Pista C): falhou no lab completo de bde9c79; reproduzir sozinha no lab-crítico.
  T186 — Anunciar em 6 passos (Prompt 43, sobre o cadastro do prompt 10) + documento conferido na hora (prompt 11) +
  Negociação (prompt 17 §8), a 390 e 1280 px, com a IA, o OSM e o ViaCEP SIMULADOS (nada sai para a rede):
  1. Endereço e dados: o CEP vem com foco e preenche rua, bairro e cidade; o documento fictício é conferido → ✓.
  2. Tipo e quartos: tipo, banheiros, pessoas e área (quartos fica vazio: a IA sugere pelas fotos).
  3. Fotos: 8 fotos; a IA analisa sozinha ao terminar.
  4. Comodidades e segurança: título com "Sugerido · confira"; comodidades pré-marcadas; "Pronto para trabalhar de
     casa" com o contador; grupo Segurança; declaração das câmeras; proximidades do OSM marcadas.
  5. Regras, valores e disponibilidade: valor mensal com o preço sugerido da região (mediana de 3 anúncios reais);
     datas; campos dentro do cartão; Negociação com desconto e limite privado.
  6. Revisar: documento conferido; publica. O anúncio mostra o que o dono confirmou, e o limite privado não aparece.
  Laboratório: o Supabase local é http e a regra do editor só aceita fotos https na pasta do dono; por isso as fotos
  do rascunho são trocadas pelas de teste (como em criarImovelPronto) antes de publicar.
*/
const SAIDA = "tests/laboratorio/saida";
const FOTOS = ["sala", "quarto-1", "quarto-2", "cozinha", "banheiro", "home-office", "varanda", "fachada"].map((n) => `public/images/imoveis/ube/ube-001-${n}.webp`);

/** Documento FICTÍCIO do laboratório: PDF mínimo com o marcador do caso e bytes aleatórios (hash único). */
/** Matrícula FICTÍCIA do laboratório (tests/fixtures), com bytes extras: cada envio tem um hash próprio. */
function matriculaLab(): Buffer {
  return Buffer.concat([readFileSync("tests/fixtures/matricula-ficticia-dono.pdf"), Buffer.from(`% ${randomBytes(8).toString("hex")}\n`)]);
}

async function esperarSalvo(page: Page) {
  await page.waitForTimeout(2_500);
  await expect(page.getByText("Salvando…")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByText(/Salvo/).first()).toBeVisible({ timeout: 15_000 });
}

/** Sem rolagem lateral, medida depois da animação de entrada da etapa; se sobrar, diz qual elemento passa da tela. */
async function semRolagemLateral(page: Page) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"), undefined, { timeout: 10_000 }).catch(() => {});
  const r = await page.evaluate(() => {
    const sobra = document.documentElement.scrollWidth - window.innerWidth;
    const largo = [...document.querySelectorAll<HTMLElement>("body *")]
      // Ignora o que está dentro de um contêiner com rolagem/corte próprio (ex.: a fileira de etapas no celular).
      .filter((el) => {
        if (el.getBoundingClientRect().right <= window.innerWidth + 1 || el.offsetParent === null) return false;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).overflowX !== "visible") return false;
        return true;
      })
      .map((el) => `${el.tagName.toLowerCase()}[${el.getAttribute("data-testid") ?? ""}].${String(el.className).slice(0, 60)} → ${Math.round(el.getBoundingClientRect().right)}px`)
      .slice(0, 5);
    return { sobra, largo };
  });
  expect(r.sobra, `passa da tela: ${r.largo.join(" | ")}`).toBeLessThanOrEqual(1);
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

test.describe("T186 — Anunciar em 6 passos com IA, OSM e documento simulados", () => {
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
    for (const [letra, preco] of [["A", 3000], ["B", 3200], ["C", 3400]] as const) {
      const id = await criarImovelPronto(ids.vizinho, `Comparável ${letra} ${sufixo}` /* sem o preço no título: com um sufixo só de dígitos, viraria "telefone" para a trava de contato */, { ativo: true, preco });
      await adm().from("properties").update({ bedrooms: 2, address: bairro, city: "Uberlândia" }).eq("id", id);
    }
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono390, ids.dono1280, ids.vizinho]);
  });

  for (const largura of [390, 1280]) {
    test(`${largura}px — do CEP ao anúncio publicado`, async ({ browser }) => {
      const email = `dono.cad${largura}.${sufixo}@lab.vivanomads.test`;
      // Sem dígitos no nome: "Cadastro1280" vira "telefone" para a validação de nome e o servidor recusa publicar.
      const nome = `Clara ${largura === 390 ? "Celular" : "Computador"} Sobrenome`;
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

      // ── Passo 1: Endereço e dados ───────────────────────────────────────
      await page.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Endereço e dados" })).toBeVisible({ timeout: 20_000 });
      const cep = page.getByTestId("cadastro-cep");
      await expect(cep).toBeFocused();
      await cep.fill("38400100");
      await expect(cep).toHaveValue("38400-100");
      await expect(page.getByTestId("cadastro-rua")).toHaveValue("Rua do Laboratório", { timeout: 10_000 });
      await expect(page.getByTestId("cadastro-bairro")).toHaveValue(bairro);
      await expect(page.getByTestId("cadastro-cidade")).toHaveValue("Uberlândia");
      await page.getByTestId("cadastro-numero").fill("102");
      await esperarSalvo(page); // o rascunho existe: o documento fica ligado a ele

      // Endereço → identidade → matrícula (decisão do Daniel, 18/10): sem matrícula o documento vai para a equipe.
      const identidade = page.getByTestId("etapa-identidade");
      await expect(identidade).toHaveAttribute("data-estado", "pendente", { timeout: 15_000 });
      await identidade.getByTestId("identidade-confirmar").click();
      await expect(identidade.getByTestId("identidade-confirmada")).toBeVisible({ timeout: 20_000 });
      const docEnviar = page.getByTestId("documento-vinculo").locator('input[type="file"]').first();
      await docEnviar.setInputFiles({ name: "matricula-ficticia.pdf", mimeType: "application/pdf", buffer: matriculaLab() });
      await expect(page.getByTestId("documento-estado")).toHaveAttribute("data-estado", "aprovado", { timeout: 30_000 });
      await expect(page.getByTestId("documento-estado")).toContainText("Documentação conferida");
      await camposDentroDoCartao(page, "etapa-onde-fica");
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t186-1-onde-fica-${largura}.png`, fullPage: true });
      await page.getByTestId("cadastro-continuar").click();

      // ── Passo 2: Tipo e quartos ─────────────────────────────────────────
      await expect(page.getByRole("heading", { name: "Tipo e quartos" })).toBeVisible();
      await expect(page.getByTestId("cadastro-tipo")).toHaveValue("apartamento");
      await page.getByTestId("cadastro-continuar").click(); // vazio não avança: diz o que falta
      await expect(page.getByText("Informe ao menos 1 banheiro.")).toBeVisible();
      await page.getByTestId("cadastro-banheiros").fill("1");
      await page.getByTestId("cadastro-capacidade").fill("4");
      await page.getByTestId("cadastro-area").fill("52");
      await camposDentroDoCartao(page, "etapa-espaco");
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t186-2-tipo-quartos-${largura}.png`, fullPage: true });
      await page.getByTestId("cadastro-continuar").click();

      // ── Passo 3: Fotos (a IA analisa sozinha) ───────────────────────────
      await expect(page.getByRole("heading", { name: "Fotos do imóvel" })).toBeVisible();
      await page.getByTestId("etapa-fotos").locator('input[type="file"]').first().setInputFiles(FOTOS);
      await expect(page.getByText(/^8\/40 fotos/)).toBeVisible({ timeout: 60_000 });
      await expect(page.getByTestId("ia-fotos")).toHaveAttribute("data-estado", "feita", { timeout: 60_000 });
      await expect(page.getByTestId("aviso-metadados")).toBeVisible();
      // Q7: a frase dos metadados é uma linha de texto só (não vira colunas).
      expect(await page.getByTestId("aviso-metadados").evaluate((el) => getComputedStyle(el).display)).toBe("block");
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t186-3-fotos-${largura}.png`, fullPage: true });
      await page.getByTestId("cadastro-continuar").click();

      // ── Passo 4: Comodidades e segurança ────────────────────────────────
      await expect(page.getByRole("heading", { name: "Comodidades e segurança" })).toBeVisible();
      await expect(page.getByTestId("ia-resumo")).toBeVisible();
      const titulo = await page.getByTestId("cadastro-titulo").inputValue();
      expect(titulo.length).toBeGreaterThan(10);
      expect(titulo.length).toBeLessThanOrEqual(60);
      expect(await page.getByTestId("etapa-encontramos").getByTestId("marca-sugerido").count()).toBeGreaterThanOrEqual(2); // título e descrição
      // Comodidades pré-marcadas + bloco "Pronto para trabalhar de casa" com o contador.
      await expect(page.getByTestId("trabalho-contador")).toHaveText("3 de 4 itens essenciais");
      await expect(page.getByTestId("trabalho-mesa_trabalho")).toHaveAttribute("aria-pressed", "true");
      await page.getByTestId("trabalho-home_office").click();
      await expect(page.getByTestId("trabalho-contador")).toHaveText("4 de 4 itens essenciais");
      // FILTROS-1 (E39): publicar exige a velocidade da internet.
      await page.getByLabel("Velocidade da internet em Mbps").fill("300");
      // Proximidades do OSM (simuladas): todas marcadas.
      const prox = page.getByTestId("proximidade-item");
      await expect(prox).toHaveCount(7, { timeout: 20_000 });
      for (const p of await prox.all()) await expect(p).toHaveAttribute("aria-pressed", "true");
      await prox.filter({ hasText: "Academia" }).click(); // desmarca uma
      // Nenhuma imagem decorativa no meio do formulário.
      await expect(page.getByTestId("etapa-encontramos").locator("img")).toHaveCount(0);
      // Segurança e imóvel: o grupo Segurança e a declaração das câmeras no mesmo bloco.
      const seguranca = page.getByTestId("seguranca-imovel");
      await seguranca.locator('[data-comodidade="detector_fumaca"]').click();
      await expect(seguranca.locator('[data-comodidade="detector_fumaca"]')).toHaveAttribute("aria-pressed", "true");
      await seguranca.getByTestId("declaracao-sem-cameras").click(); // declaração obrigatória para publicar
      await expect(page.getByTestId("declaracao-sem-cameras")).toHaveAttribute("aria-checked", "true");
      // Prompt 59-A (#1081): o padrão mínimo da Viva é confirmado aqui, junto das comodidades (antes ficava na revisão).
      await page.getByTestId("conforto-marcar-todos").click();
      await expect(page.getByTestId("conforto-faltam")).toHaveText("Todos os itens confirmados.");
      await camposDentroDoCartao(page, "etapa-encontramos");
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t186-4-comodidades-${largura}.png`, fullPage: true });
      await page.getByTestId("cadastro-continuar").click();

      // ── Passo 5: Regras, valores e disponibilidade ──────────────────────
      await expect(page.getByRole("heading", { name: "Regras, valores e disponibilidade" })).toBeVisible();
      await expect(page.getByTestId("etapa-regras-casa")).toContainText("Aceita pets");
      await expect(page.getByTestId("cadastro-preco")).toHaveValue("3.200", { timeout: 15_000 });
      await expect(page.getByTestId("preco-regiao")).toContainText("Sugestão para imóveis parecidos na região");
      await expect(page.getByTestId("cadastro-consumo")).toHaveValue("220"); // 2 quartos
      // Prompt 22: no computador a data aceita digitar dd/mm/aaaa (com máscara) e o calendário fica num botão; no
      // celular (toque) segue o seletor nativo — coberto no t204.
      const de = page.getByTestId("disponivel-de");
      const ate = page.getByTestId("disponivel-ate");
      for (const d of [de, ate]) await expect(d).toHaveAttribute("type", "text");
      await expect(page.getByTestId("disponivel-de-calendario")).toBeVisible();
      await de.pressSequentially("01112026");
      await expect(de).toHaveValue("01/11/2026");
      // Q9: rótulo curto; no celular os dois campos ficam um embaixo do outro, com a mesma largura.
      await expect(page.getByTestId("disponibilidade")).toContainText("Disponível até");
      // As duas caixas na MESMA leitura: lidas uma depois da outra, a sugestão de preço chegando entre as duas
      // deslocava a página e a conta falhava (lab 2f1fb872: 1073 < 1135).
      const [bde, bate] = await page.evaluate(() => {
        const ler = (id: string) => {
          const r = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        };
        return [ler("disponivel-de"), ler("disponivel-ate")];
      });
      if (largura === 390) {
        expect(bate.y).toBeGreaterThanOrEqual(bde.y + bde.height - 1);
        expect(Math.abs(bate.width - bde.width)).toBeLessThanOrEqual(1);
      } else {
        expect(Math.abs(bate.y - bde.y)).toBeLessThanOrEqual(1); // lado a lado e alinhados
      }
      // 61-B: o tipo de entrada é obrigatório para publicar o anúncio novo.
      await page.getByTestId("tipo-entrada-porteiro").check();
      // Negociação: aceita, só "meses"; 6% a partir de 6 meses; limite privado de R$ 2.950.
      await page.getByTestId("negociar-sim").click();
      await page.getByTestId("negociavel-meses").click();
      await page.getByTestId("adicionar-faixa").click();
      await page.getByLabel("Meses da faixa 1").fill("6");
      await page.getByLabel("Desconto da faixa 1").fill("6");
      await page.getByTestId("limite-valor-minimo").fill("2950");
      await camposDentroDoCartao(page, "etapa-preco");
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t186-5-regras-valores-${largura}.png`, fullPage: true });
      await page.getByTestId("cadastro-continuar").click();

      // ── Passo 6: Revisar e publicar ─────────────────────────────────────
      await expect(page.getByRole("heading", { name: "Revisar e publicar" })).toBeVisible();
      await expect(page.getByTestId("revisar-documento")).toHaveAttribute("data-estado", "aprovado");
      await expect(page.getByTestId("previa-anuncio")).toContainText("6% de desconto a partir de 6 meses");
      await expect(page.getByTestId("qualidade-anuncio")).toBeVisible();
      await page.screenshot({ path: `${SAIDA}/t186-6-revisar-${largura}.png`, fullPage: true });
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
      // Ao reabrir pelo rascunho, a qualificação vem do SERVIDOR (não do sessionStorage): grava o checklist
      // "Antes de anunciar" respondido, como a tela /qualificar deixaria, na linha que o envio do documento criou.
      const { data: qual } = await adm().from("qualification_checklists").select("id, formulario").eq("owner_id", donoId).eq("property_id", imovelId).maybeSingle();
      expect(qual, "o envio do documento ligou o checklist ao rascunho").toBeTruthy();
      const formulario = (qual!.formulario ?? {}) as { elig?: Record<string, unknown> };
      const { error: eQual } = await adm()
        .from("qualification_checklists")
        .update({
          formulario: { versao: 1, ...formulario, elig: { ...(formulario.elig ?? {}), furnished: true, accepts30days: true, iptuOk: true, habitable: true, isOwnerOrAgent: true, condoAllows: "yes" } },
        })
        .eq("id", qual!.id);
      expect(eQual).toBeNull();

      await page.goto(`/dashboard/imoveis/novo?draft=${imovelId}&etapa=5`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Revisar e publicar" })).toBeVisible({ timeout: 20_000 });
      await page.getByTestId("aceite-ia").getByRole("checkbox").check();
      // Sem o padrão mínimo confirmado, a revisão diz "Falta confirmar" e leva às Comodidades (Prompt 59-A): se o
      // rascunho reabrir sem ele, confirma por esse caminho e volta à revisão.
      const resolver = page.getByTestId("publicar-falta-conforto-resolver");
      const publicar = page.getByTestId("publicar-anuncio");
      await expect(publicar.and(page.locator(":enabled")).or(resolver)).toBeVisible({ timeout: 20_000 });
      if (await resolver.isVisible()) {
        await resolver.click();
        await page.getByTestId("conforto-marcar-todos").click();
        await expect(page.getByTestId("conforto-faltam")).toHaveText("Todos os itens confirmados.");
        await page.getByTestId("cadastro-continuar").click();
        await expect(page.getByRole("heading", { name: "Regras, valores e disponibilidade" })).toBeVisible();
        await page.getByTestId("cadastro-continuar").click();
        await expect(page.getByRole("heading", { name: "Revisar e publicar" })).toBeVisible();
      }
      await expect(publicar).toBeEnabled({ timeout: 20_000 });
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
      await p2.screenshot({ path: `${SAIDA}/t186-7-anuncio-publicado-${largura}.png`, fullPage: false });
      await publico.close();
      await page.context().close();
    });
  }
});
