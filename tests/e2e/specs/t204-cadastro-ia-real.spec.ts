import { test, expect, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo, pdf, pngDeTeste } from "../fixtures/laboratorio";

/*
  T204 — Prompt 22 (QA do Muse no cadastro, 18/10), a 390 e 1280 px:
  1. CEP: o autofill do navegador (simulado por script, sem inputType) NÃO prende mais o endereço — 38408-000 troca
     tudo para Santa Mônica, Uberlândia/MG; o que a pessoa digitou fica; 99999-999 → "Não encontramos esse CEP —
     buscar pelo endereço" com o link. Campos de endereço com autocomplete="off".
  2. IA das fotos: falha mostra o motivo e "Tentar de novo" (nunca o silencioso "sem sugestões"); de novo → sugestões.
     "Adicionar" abre a escolha de arquivos e a galeria aceita arrastar e soltar.
  3. Portão único: "Antes de anunciar" pendente já no passo 1 (Tipo, com "Responder agora"; nos 10 passos o cartão
     recolhível "Pronto para publicar" do topo saiu) e abre no painel lateral, sem sair do cadastro; na revisão, uma
     lista só (sem o aviso separado).
  4. Datas: no computador digita dd/mm/aaaa e cola; no celular (toque) segue o seletor nativo.
  5. Matrícula sem leitura: a tentativa fica gravada em property_ownership_checks (em revisão, com o motivo).
  6. /admin: painel "IA do cadastro" com ligada/desligada e o último erro (sem dado pessoal).
*/
const SAIDA = "tests/laboratorio/saida";
const LARGURAS = [390, 1280] as const;
const VIACEP = "https://viacep.com.br/ws/**";
const BRASILAPI = "https://brasilapi.com.br/api/cep/**";

test.describe.configure({ mode: "serial" });

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

/** Dono novo, logado pela tela num contexto próprio (opções: toque, largura). */
async function novoDono(browser: Browser, largura: number, opcoes: BrowserContextOptions = {}) {
  const senha = novaSenha();
  const email = `dono.t204.${novoSufixo()}@lab.vivanomads.test`;
  const id = await criarConta({ email, nome: "Dora Cadastro Sobrenome", role: "owner" }, senha);
  const ctx = await browser.newContext({ viewport: { width: largura, height: 900 }, ...opcoes });
  const page = await ctx.newPage();
  await page.goto("/auth?senha=1", { waitUntil: "domcontentloaded" });
  // A tela pode hidratar depois do preenchimento e zerar o e-mail: preenche até os dois valores ficarem.
  const campoEmail = page.locator('input[name="email"], input[type="email"]').first();
  const campoSenha = page.locator('input[name="password"], input[type="password"]').first();
  await expect(async () => {
    await campoEmail.fill(email);
    await campoSenha.fill(senha);
    await expect(campoEmail).toHaveValue(email, { timeout: 1_000 });
    await expect(campoSenha).toHaveValue(senha, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  // O envio pode se perder se a tela hidratar no meio (lab 39456130138): repete o clique até sair de /auth.
  // Se o envio nativo recarregou /auth vazio, preenche de novo antes do clique (lab de c5bcce9: 60 s clicando em branco).
  await expect(async () => {
    if (/\/dashboard/.test(page.url())) return;
    if ((await campoEmail.inputValue()) !== email) await campoEmail.fill(email, { timeout: 5_000 });
    if ((await campoSenha.inputValue()) !== senha) await campoSenha.fill(senha, { timeout: 5_000 });
    await page.locator("form").getByRole("button", { name: /^entrar$/i }).click({ timeout: 5_000 });
    await page.waitForURL(/\/dashboard/, { timeout: 15_000, waitUntil: "commit" });
  }).toPass({ timeout: 60_000 });
  await page.evaluate(() => localStorage.setItem("vivanomads-role-asked", "1"));
  return { page, id, fechar: () => ctx.close() };
}

/** Rascunho no servidor (o cadastro abre por ?draft=<id>&etapa=<nome do passo>). */
async function rascunho(donoId: string, dados: Record<string, unknown>): Promise<string> {
  const { data, error } = await adm()
    .from("properties")
    .insert({
      owner_id: donoId, title: "Rascunho do T204", description: "Rascunho de teste do laboratório (T204).", property_type: "Apartamento",
      address: "Santa Mônica", city: "Uberlândia", state: "MG", bedrooms: 1, bathrooms: 1, area_m2: 40,
      min_period_days: 30, max_period_days: 180, monthly_price: 0, status: "draft", draft_data: dados,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** O que o preenchimento automático do Chrome faz: troca o valor e dispara um "input" SEM inputType. */
async function autofill(page: Page, valores: Record<string, string>) {
  await page.evaluate((v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    for (const [testid, valor] of Object.entries(v)) {
      const el = document.querySelector<HTMLInputElement>(`[data-testid="${testid}"]`)!;
      setter.call(el, valor);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, valores);
}

async function simularCep(page: Page) {
  await page.route(VIACEP, async (r) => {
    const url = r.request().url();
    if (url.includes("/38408000/")) {
      return r.fulfill({ json: { cep: "38408-000", logradouro: "Avenida João Naves de Ávila", bairro: "Santa Mônica", localidade: "Uberlândia", uf: "MG" } });
    }
    return r.fulfill({ json: { erro: "true" } });
  });
  await page.route(BRASILAPI, (r) => r.fulfill({ status: 404, json: { message: "CEP não encontrado" } }));
}

test.describe("T204 — cadastro com a IA de verdade e o QA do Muse (prompt 22)", () => {
  test.skip(!NO_LABORATORIO, "cria contas e rascunhos: só no laboratório");
  const ids: string[] = [];
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const largura of LARGURAS) {
    test(`${largura}px — CEP: autofill não prende o endereço; digitado fica; 99999-999 mostra o link`, async ({ browser }) => {
      test.setTimeout(120_000);
      const d = await novoDono(browser, largura);
      ids.push(d.id);
      const { page } = d;
      await simularCep(page);
      await page.goto("/dashboard/imoveis/novo?etapa=endereco", { waitUntil: "domcontentloaded" });
      const cep = page.getByTestId("cadastro-cep");
      await expect(cep).toBeVisible({ timeout: 30_000 });
      for (const t of ["cadastro-cep", "cadastro-rua", "cadastro-numero", "cadastro-bairro", "cadastro-cidade"]) {
        await expect(page.getByTestId(t)).toHaveAttribute("autocomplete", "off");
      }

      // O Chrome preenche o endereço SALVO (outra cidade) antes do CEP: o CEP substitui tudo.
      await autofill(page, { "cadastro-rua": "Avenida das Torres", "cadastro-bairro": "Centro", "cadastro-cidade": "Sarandi" });
      await expect(page.getByTestId("cadastro-cidade")).toHaveValue("Sarandi");
      await cep.pressSequentially("38408000");
      await expect(page.getByTestId("cep-resultado")).toContainText("Endereço encontrado");
      await expect(page.getByTestId("cadastro-rua")).toHaveValue("Avenida João Naves de Ávila");
      await expect(page.getByTestId("cadastro-bairro")).toHaveValue("Santa Mônica");
      await expect(page.getByTestId("cadastro-cidade")).toHaveValue("Uberlândia");
      await page.screenshot({ path: `${SAIDA}/t204-cep-autofill-${largura}.png`, fullPage: false });

      // O que a pessoa DIGITOU fica (mesmo trocando o CEP).
      await page.getByTestId("cadastro-rua").fill("Rua que eu digitei");
      await cep.fill("");
      await cep.pressSequentially("38408000");
      await expect(page.getByTestId("cep-resultado")).toContainText("Endereço encontrado");
      await expect(page.getByTestId("cadastro-rua")).toHaveValue("Rua que eu digitei");

      // CEP inexistente: a mensagem e o link aparecem sempre.
      await cep.fill("");
      await cep.pressSequentially("99999999");
      const r = page.getByTestId("cep-resultado");
      await expect(r).toHaveAttribute("data-tipo", "nao_encontrado");
      await expect(r).toContainText("Não encontramos esse CEP — buscar pelo endereço");
      await expect(page.getByTestId("cep-buscar-endereco")).toBeVisible();
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t204-cep-nao-encontrado-${largura}.png`, fullPage: false });
      await d.fechar();
    });

    test(`${largura}px — portão único (E132-A): Passo 1 só com o tipo; as declarações moram no "Antes de publicar" da revisão`, async ({ browser }) => {
      test.setTimeout(120_000);
      const d = await novoDono(browser, largura);
      ids.push(d.id);
      const { page } = d;
      // E132-A: a caixa "Antes de anunciar" e o painel saíram do Passo 1 (a Qualificação vem antes, como etapa própria).
      await page.goto("/dashboard/imoveis/novo?etapa=tipo", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("passo-titulo")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("tipo-qualificacao")).toHaveCount(0);
      await expect(page.getByTestId("painel-qualificacao")).toHaveCount(0);
      await expect(page.getByTestId("checklist-publicar")).toHaveCount(0);
      await page.screenshot({ path: `${SAIDA}/t204-portao-passo1-${largura}.png`, fullPage: false });

      // Revisão: uma lista só, e os requisitos legais viram declarações de um toque no "Antes de publicar".
      const id = await rascunho(d.id, { title: "Rascunho do T204", street: "Avenida João Naves de Ávila", numero: "100", cep: "38408-000", neighborhood: "Santa Mônica", city: "Uberlândia" });
      await page.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=revisao`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("etapa-revisar")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("aviso-qualificacao")).toHaveCount(0);
      await expect(page.getByTestId("declaracoes-passo10")).toBeVisible();
      await semRolagemLateral(page);
      await d.fechar();
    });

    test(`${largura}px — datas: digitar e colar no computador; fotos: Adicionar, arrastar e soltar, IA com motivo e "Tentar de novo"`, async ({ browser }) => {
      test.setTimeout(240_000);
      const d = await novoDono(browser, largura);
      ids.push(d.id);
      const { page } = d;
      const id = await rascunho(d.id, { title: "Rascunho do T204" });

      // Datas (computador, sem toque): campo de texto com máscara, colar e o calendário num botão (passo Disponibilidade).
      await page.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=disponibilidade`, { waitUntil: "domcontentloaded" });
      const de = page.getByTestId("disponivel-de");
      await expect(de).toHaveAttribute("type", "text", { timeout: 30_000 });
      await expect(page.getByTestId("disponivel-de-calendario")).toBeVisible();
      await de.pressSequentially("01112026");
      await expect(de).toHaveValue("01/11/2026");
      await de.fill("");
      await de.evaluate((el) => {
        const dt = new DataTransfer();
        dt.setData("text/plain", "2026-12-15");
        el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
      });
      await expect(de).toHaveValue("15/12/2026");
      await page.screenshot({ path: `${SAIDA}/t204-datas-${largura}.png`, fullPage: false });

      // Fotos: a IA falha (simulado) → motivo + "Tentar de novo"; de novo → sugestões.
      await page.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=fotos`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("etapa-fotos")).toBeVisible({ timeout: 30_000 });
      let falhar = true;
      await page.route("**/api/ai/fotos", (r) =>
        falhar
          ? r.fulfill({ status: 503, json: { error: "Leitura indisponível agora — tente de novo em alguns minutos.", motivo: "indisponivel" } })
          : r.fallback(),
      );
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByTestId("fotos-adicionar").click()]);
      await chooser.setFiles([1, 2, 3, 4, 5, 6, 7].map((n) => ({ name: `foto-${n}.png`, mimeType: "image/png", buffer: pngDeTeste(n + 20 * largura) })));
      await expect(page.getByTestId("etapa-fotos")).toContainText("7 / 8 fotos", { timeout: 60_000 });
      // Arrastar e soltar um arquivo na galeria.
      const png8 = pngDeTeste(8 + 20 * largura).toString("base64");
      await page.getByTestId("fotos-galeria").evaluate((alvo, b64) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const dt = new DataTransfer();
        dt.items.add(new File([bytes], "foto-8.png", { type: "image/png" }));
        alvo.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true }));
        alvo.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
      }, png8);
      await expect(page.getByTestId("etapa-fotos")).toContainText("8 / 8 fotos", { timeout: 60_000 });
      const falha = page.getByTestId("ia-fotos-falha");
      await expect(falha).toBeVisible({ timeout: 60_000 });
      await expect(falha).toContainText("indisponível agora — tente de novo");
      await expect(page.getByText("Sem sugestões automáticas agora")).toHaveCount(0);
      await page.screenshot({ path: `${SAIDA}/t204-ia-falha-${largura}.png`, fullPage: false });
      falhar = false;
      await page.getByTestId("ia-fotos-tentar-de-novo").click();
      await expect(page.getByTestId("ia-fotos")).toHaveAttribute("data-estado", "feita", { timeout: 60_000 });
      await semRolagemLateral(page);
      await d.fechar();
    });
  }

  test("390px celular (toque) — a data segue o seletor nativo", async ({ browser }) => {
    test.setTimeout(120_000);
    const d = await novoDono(browser, 390, { hasTouch: true, isMobile: true });
    ids.push(d.id);
    const id = await rascunho(d.id, { title: "Rascunho do T204" });
    await d.page.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=disponibilidade`, { waitUntil: "domcontentloaded" });
    await expect(d.page.getByTestId("disponivel-de")).toHaveAttribute("type", "date", { timeout: 30_000 });
    await expect(d.page.getByTestId("disponivel-de-calendario")).toHaveCount(0);
    await d.fechar();
  });

  test("1280px — matrícula que não deu para ler: tentativa gravada em revisão, com o motivo", async ({ browser }) => {
    test.setTimeout(120_000);
    const d = await novoDono(browser, 1280);
    ids.push(d.id);
    const id = await rascunho(d.id, { title: "Rascunho do T204", street: "Avenida João Naves de Ávila", numero: "100", cep: "38408-000", neighborhood: "Santa Mônica", city: "Uberlândia" });
    // E104: a matrícula fica no "Antes de publicar" da Revisão.
    await d.page.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=revisao`, { waitUntil: "domcontentloaded" });
    await expect(d.page.getByTestId("documento-vinculo")).toBeVisible({ timeout: 30_000 });
    // PDF sem o marcador do laboratório: ninguém consegue ler (como um arquivo ilegível em produção).
    await d.page.getByTestId("documento-vinculo").locator('input[type="file"]').setInputFiles({ name: "matricula.pdf", mimeType: "application/pdf", buffer: pdf() });
    const res = d.page.getByTestId("matricula-resultado");
    await expect(res).toHaveAttribute("data-resultado", "em_revisao", { timeout: 60_000 });
    await expect(res).toHaveAttribute("data-motivo", /falha_/);
    const { data } = await adm().from("property_ownership_checks").select("resultado, motivo, matricula_numero").eq("user_id", d.id);
    expect(data?.length).toBe(1);
    expect(data![0]).toMatchObject({ resultado: "em_revisao", matricula_numero: null });
    expect(String(data![0].motivo)).toMatch(/^falha_/);
    await d.page.screenshot({ path: `${SAIDA}/t204-matricula-em-revisao-1280.png`, fullPage: false });
    await d.fechar();
  });

  test.describe("admin", () => {
    test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
    test.use({ storageState: authFile("admin") });
    test("1280px — painel 'IA do cadastro': ligada/desligada, última chamada e último erro (sem dado pessoal)", async ({ page }) => {
      await adm().from("ia_chamadas").insert({ rota: "matricula", ok: false, status: 400, tipo_erro: "invalid_request_error", motivo: "arquivo_grande", modelo: "lab", arquivo_mime: "image/jpeg", arquivo_bytes: 6_200_000 });
      await page.setViewportSize({ width: 1280, height: 900 });
      // ADMIN-3/4 (#1354): o painel da IA do cadastro mora em /admin/sistema.
      await page.goto("/admin/sistema", { waitUntil: "domcontentloaded" });
      const p = page.getByTestId("painel-ia-cadastro");
      await expect(p).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("painel-ia-estado")).toHaveText(/Ligada|Desligada/);
      await expect(page.getByTestId("painel-ia-ultimo-erro")).toContainText("invalid_request_error");
      await expect(page.getByTestId("painel-ia-ultimo-erro")).toContainText("arquivo grande demais", { ignoreCase: true });
      await p.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t204-admin-ia-1280.png` });
      await adm().from("ia_chamadas").delete().eq("modelo", "lab");
    });
  });
});
