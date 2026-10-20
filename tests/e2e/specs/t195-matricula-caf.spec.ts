import { test, expect, type Browser, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import {
  CHAVE_ANON,
  NO_LABORATORIO,
  URL_SUPABASE,
  adm,
  apagarContas,
  criarConta,
  criarImovelPronto,
  entrar,
  novaSenha,
  publicarPeloEditor,
  statusDoImovel,
} from "../fixtures/laboratorio";

/*
  T195 — Matrícula do imóvel cruzada com a CAF (prompt 19), com matrículas FICTÍCIAS de tests/fixtures/ (nenhum dado
  real) e a leitura e a CAF SIMULADAS no laboratório:
  A. CAF feita + CPF do perfil = CPF da matrícula → "Documentação conferida ✓" na hora, sem fila; a matrícula
     preenche unidade/área/vaga com "veio da matrícula"; o anúncio publica.
  C→A. sem CAF → "Documento recebido — falta confirmar sua identidade" + botão; confirmar → conferido.
  D. nome/CPF diferente → em revisão com as opções do caso; escolher "cônjuge" e anexar a certidão.
  Segurança: a API e a página públicas não mostram nº da matrícula, cartório nem CPF; outra conta não lê a conferência
  (RLS → 0 linhas). Admin: a fila mostra a matrícula com o resumo, o laudo (booleanos) e Pedir documento.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
// Só letras nos nomes (dígitos no nome viram "telefone" no filtro de contato).
const letras = () => Array.from(randomBytes(5), (b) => "abcdefghijklmnopqrstuvwxyz"[b % 26]).join("");
const sufixo = letras();
const ids: string[] = [];
const contas: Record<string, { email: string; id: string; nome: string }> = {};

/** A matrícula fictícia com bytes extras (o hash muda a cada envio: senão vira "arquivo já usado"). */
function matricula(caso: "dono" | "outro-dono"): Buffer {
  return Buffer.concat([readFileSync(`tests/fixtures/matricula-ficticia-${caso}.pdf`), Buffer.from(`% ${randomBytes(8).toString("hex")}\n`)]);
}

async function novaConta(chave: string, nome: string) {
  const email = `dono.mat.${chave}.${sufixo}@lab.vivanomads.test`;
  const id = await criarConta({ email, nome, role: "owner" }, senha);
  ids.push(id);
  contas[chave] = { email, id, nome };
}

/** Dono na etapa 1 com CEP + número (ViaCEP simulado) e o rascunho salvo. */
async function etapa1(browser: Browser, chave: string, largura: number): Promise<Page> {
  const page = await entrar(browser, contas[chave].email, senha);
  await page.setViewportSize({ width: largura, height: 900 });
  await page.route("https://viacep.com.br/ws/**", (r) =>
    r.fulfill({ json: { cep: "38400-100", logradouro: "Rua do Laboratório", bairro: "Centro", localidade: "Uberlândia", uf: "MG" } }),
  );
  await page.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Onde fica" })).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("cadastro-cep").fill("38400100");
  await expect(page.getByTestId("cadastro-rua")).toHaveValue("Rua do Laboratório", { timeout: 10_000 });
  await page.getByTestId("cadastro-numero").fill("102");
  await page.waitForTimeout(2_500);
  await expect(page.getByText(/Salvo/).first()).toBeVisible({ timeout: 15_000 });
  return page;
}

async function enviarMatricula(page: Page, arquivo: Buffer) {
  await page.getByTestId("documento-vinculo").locator('input[type="file"]').first().setInputFiles({ name: "matricula-ficticia.pdf", mimeType: "application/pdf", buffer: arquivo });
}

async function ultimaConferencia(userId: string) {
  const { data } = await adm()
    .from("property_ownership_checks")
    .select("id, property_id, resultado, motivo, caf_ok, caso, caso_documento_path, campos_extraidos, matricula_numero")
    .eq("user_id", userId)
    .order("criada_em", { ascending: false })
    .limit(1)
    .single();
  return data!;
}

async function cpfDoPerfil(userId: string): Promise<string> {
  return ((await adm().from("profiles").select("cpf").eq("id", userId).single()).data?.cpf as string) ?? "";
}

test.describe("T195 — matrícula + CAF", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (leitura e CAF simuladas).");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  test.beforeAll(async () => {
    for (const l of ["celular", "computador"]) {
      await novaConta(`a.${l}`, `Alice Matricula ${l === "celular" ? "Celular" : "Computador"} ${sufixo}`);
      await novaConta(`d.${l}`, `Diana Conjuge ${l === "celular" ? "Celular" : "Computador"} ${sufixo}`);
    }
    await novaConta("c", `Caio Identidade ${sufixo}`);
    await novaConta("intruso", `Ivo Intruso ${sufixo}`);
    await novaConta("etapa", `Elisa Etapa ${sufixo}`);
  });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const [largura, nome] of [[390, "celular"], [1280, "computador"]] as const) {
    test(`${largura}px — A: CAF feita + CPF igual → conferido na hora, preenche o anúncio com "veio da matrícula"`, async ({ browser }) => {
      const chave = `a.${nome}`;
      const page = await etapa1(browser, chave, largura);
      // CAF feita antes (laboratório: laudo simulado gravado e marcado).
      const caf = await page.request.post("/api/caf/verify");
      expect(caf.ok()).toBe(true);

      await expect(page.getByTestId("matricula-aviso-upload")).toHaveText(
        "A matrícula é usada só para confirmar que o imóvel é seu e preencher o anúncio. Fica guardada com segurança e não aparece no site.",
      );
      await enviarMatricula(page, matricula("dono"));
      await expect(page.getByTestId("documento-estado")).toHaveAttribute("data-estado", "aprovado", { timeout: 30_000 });
      await expect(page.getByTestId("documento-estado")).toContainText("Documentação conferida ✓");
      await expect(page.getByTestId("matricula-resultado")).toHaveAttribute("data-resultado", "conferido");
      // Preencheu a unidade (editável) com a etiqueta; área e vaga vão para o rascunho.
      await expect(page.getByTestId("cadastro-complemento")).toHaveValue("Apartamento 302");
      await expect(page.getByTestId("veio-da-matricula").first()).toBeVisible();
      await page.getByTestId("cadastro-complemento").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t195-matricula-preenche-${largura}.png`, fullPage: false });
      await page.getByTestId("documento-vinculo").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t195-conferido-${largura}.png`, fullPage: false });
      // Nada de CPF, nº da matrícula ou cartório na tela.
      await expect(page.locator("main")).not.toContainText(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}|00\.000-LAB|Cartório de Registro/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

      // Banco: conferido, CAF ok, sem fila e SEM o CPF inteiro gravado.
      const c = await ultimaConferencia(contas[chave].id);
      expect(c.resultado).toBe("conferido");
      expect(c.caf_ok).toBe(true);
      expect(JSON.stringify(c.campos_extraidos)).not.toContain(await cpfDoPerfil(contas[chave].id));
      const { data: q } = await adm()
        .from("qualification_checklists")
        .select("document_status, conferido_por, revisao_ate")
        .eq("owner_id", contas[chave].id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      expect(q).toMatchObject({ document_status: "approved", conferido_por: "automatico", revisao_ate: null });
      // A área da matrícula (68,5 m² privativos) foi para o rascunho (autosave).
      await expect
        .poll(async () => (await adm().from("properties").select("area_m2").eq("owner_id", contas[chave].id).maybeSingle()).data?.area_m2, { timeout: 20_000 })
        .toBe(69);
      await page.context().close();
    });
  }

  test("1280px — A publica sem fila; API e página públicas sem nº da matrícula, cartório ou CPF", async ({ browser }) => {
    const chave = "a.computador";
    const page = await entrar(browser, contas[chave].email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    // Imóvel pronto do laboratório, mas SEM documento aprovado: só a matrícula libera a publicação.
    const imovel = await criarImovelPronto(contas[chave].id, `Studio da matrícula ${sufixo}`);
    await adm().from("qualification_checklists").delete().eq("property_id", imovel);
    const form = { file: { name: "matricula-ficticia.pdf", mimeType: "application/pdf", buffer: matricula("dono") } };
    const up = await page.request.post("/api/upload/documento", { multipart: form });
    expect(up.ok()).toBe(true);
    const { path } = (await up.json()) as { path: string };
    const r = await page.request.post("/api/documentos/conferir", {
      data: { path, imovelId: imovel, endereco: { cep: "38400100", rua: "Rua do Laboratório", numero: "102", bairro: "Centro", cidade: "Uberlândia" }, operacao: "own" },
    });
    const corpo = (await r.json()) as { estado: string; matricula: { resultado: string } };
    expect(corpo.estado).toBe("aprovado");
    expect(corpo.matricula.resultado).toBe("conferido");
    // A resposta ao dono não traz CPF, número da matrícula nem cartório.
    expect(JSON.stringify(corpo)).not.toMatch(/00\.000-LAB|Cartório|(?<!\d)\d{11}(?!\d)/);

    await publicarPeloEditor(page, imovel);
    await expect.poll(() => statusDoImovel(imovel), { timeout: 20_000 }).toBe("active");

    const api = await page.request.get("/api/properties");
    const html = await (await page.request.get(`/imoveis/${imovel}`)).text();
    for (const texto of [JSON.stringify(await api.json()), html]) {
      expect(texto).not.toContain("00.000-LAB");
      expect(texto).not.toContain("Cartório de Registro de Imóveis Fictício");
      expect(texto).not.toContain(await cpfDoPerfil(contas[chave].id));
    }
    await page.context().close();
  });

  test("390px — C→A: sem CAF fica \"falta confirmar sua identidade\"; o botão confirma e confere", async ({ browser }) => {
    const page = await etapa1(browser, "c", 390);
    await enviarMatricula(page, matricula("dono"));
    const res = page.getByTestId("matricula-resultado");
    await expect(res).toHaveAttribute("data-motivo", "falta_identidade", { timeout: 30_000 });
    await expect(page.getByTestId("matricula-mensagem")).toHaveText("Documento recebido — falta confirmar sua identidade");
    await expect(page.getByTestId("documento-estado")).toHaveCount(0);
    await res.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SAIDA}/t195-falta-identidade-390.png`, fullPage: false });
    expect((await ultimaConferencia(contas.c.id)).resultado).toBe("em_revisao");

    await page.getByTestId("matricula-caf").click();
    await expect(page.getByTestId("matricula-resultado")).toHaveAttribute("data-resultado", "conferido", { timeout: 30_000 });
    await expect(page.getByTestId("documento-estado")).toContainText("Documentação conferida ✓");
    expect((await ultimaConferencia(contas.c.id)).resultado).toBe("conferido");
    await page.context().close();
  });

  for (const [largura, nome] of [[390, "celular"], [1280, "computador"]] as const) {
    test(`${largura}px — D: nome/CPF diferente → em revisão com as opções; cônjuge anexa a certidão`, async ({ browser }) => {
      const chave = `d.${nome}`;
      const page = await etapa1(browser, chave, largura);
      await enviarMatricula(page, matricula("outro-dono"));
      const res = page.getByTestId("matricula-resultado");
      await expect(res).toHaveAttribute("data-motivo", "dono_diferente", { timeout: 30_000 });
      await expect(page.getByTestId("matricula-mensagem")).toContainText("Escolha o seu caso e anexe o documento");
      const casos = page.getByTestId("matricula-casos");
      for (const c of ["conjuge", "heranca", "empresa", "gestor", "compra_nao_registrada"]) await expect(casos.getByTestId(`matricula-caso-${c}`)).toBeVisible();
      await expect(page.getByTestId("matricula-caf")).toBeVisible();
      await casos.getByTestId("matricula-caso-conjuge").click();
      await casos.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t195-opcoes-caso-${largura}.png`, fullPage: false });
      await page.getByTestId("matricula-caso-arquivo").setInputFiles({
        name: "certidao-casamento-ficticia.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.concat([readFileSync("tests/fixtures/certidao-casamento-ficticia.pdf"), Buffer.from(`% ${randomBytes(8).toString("hex")}\n`)]),
      });
      await expect(page.getByTestId("matricula-caso-enviado")).toContainText("Documento recebido", { timeout: 20_000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      const c = await ultimaConferencia(contas[chave].id);
      expect(c).toMatchObject({ resultado: "em_revisao", motivo: "dono_diferente", caso: "conjuge" });
      expect(c.caso_documento_path).toMatch(new RegExp(`^${contas[chave].id}/`));
      // CPF do outro proprietário: só os 3 últimos dígitos.
      expect(JSON.stringify(c.campos_extraidos)).toContain('"documento_final":"191"');
      expect(JSON.stringify(c.campos_extraidos)).not.toContain("00000000191");
      await page.context().close();
    });
  }

  for (const largura of [390, 1280]) {
    test(`${largura}px — etapa Identidade vem ANTES da matrícula e já aparece feita com laudo válido (12 meses)`, async ({ browser }) => {
      const page = await etapa1(browser, "etapa", largura);
      const passo = page.getByTestId("etapa-onde-fica");
      const ordem = await passo.evaluate((el) => {
        const ids = [...el.querySelectorAll("[data-testid]")].map((n) => n.getAttribute("data-testid"));
        return { identidade: ids.indexOf("etapa-identidade"), documento: ids.indexOf("documento-vinculo"), numero: ids.indexOf("cadastro-numero") };
      });
      expect(ordem.numero).toBeLessThan(ordem.identidade);
      expect(ordem.identidade).toBeLessThan(ordem.documento);
      if (largura === 390) {
        await expect(page.getByTestId("etapa-identidade")).toHaveAttribute("data-estado", "pendente", { timeout: 15_000 });
        await page.getByTestId("etapa-identidade").scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${SAIDA}/t195-etapa-identidade-${largura}.png`, fullPage: false });
        // Confirma pela própria etapa (laboratório: laudo simulado, gravado e marcado).
        await page.getByTestId("identidade-confirmar").click();
        await expect(page.getByTestId("identidade-confirmada")).toBeVisible({ timeout: 20_000 });
      } else {
        // Já tem laudo válido (feito a 390): a etapa vem concluída, sem botão.
        await expect(page.getByTestId("etapa-identidade")).toHaveAttribute("data-estado", "ok", { timeout: 15_000 });
        await expect(page.getByTestId("identidade-confirmar")).toHaveCount(0);
        await page.getByTestId("etapa-identidade").scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${SAIDA}/t195-etapa-identidade-feita-${largura}.png`, fullPage: false });
      }
      await page.context().close();
    });
  }

  test("RLS — outra conta não lê a conferência de ninguém; o dono lê só a dele", async () => {
    const entrarComo = async (chave: string) => {
      const cli = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
      const { error } = await cli.auth.signInWithPassword({ email: contas[chave].email, password: senha });
      expect(error).toBeNull();
      return cli;
    };
    const intruso = await entrarComo("intruso");
    const alvo = await ultimaConferencia(contas["d.celular"].id);
    const { data: viu } = await intruso.from("property_ownership_checks").select("id").eq("id", alvo.id);
    expect(viu ?? []).toHaveLength(0);
    const { data: todas } = await intruso.from("property_ownership_checks").select("id");
    expect(todas ?? []).toHaveLength(0);
    // O dono não grava (só o servidor).
    const dono = await entrarComo("d.celular");
    const { data: minhas } = await dono.from("property_ownership_checks").select("id, resultado");
    expect((minhas ?? []).map((m) => m.id)).toContain(alvo.id);
    await dono.from("property_ownership_checks").update({ resultado: "conferido" }).eq("id", alvo.id);
    expect((await ultimaConferencia(contas["d.celular"].id)).resultado).toBe("em_revisao");
  });

  test.describe("admin", () => {
    test.skip(!hasAccount("admin"), "conta admin do laboratório não configurada");
    test.use({ storageState: authFile("admin") });

    test("1280px — a fila mostra a matrícula com o resumo lido e o laudo (booleanos); Pedir documento", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/admin/documentos", { waitUntil: "domcontentloaded" });
      const secao = page.getByTestId("matriculas-admin");
      await expect(secao.getByTestId("matriculas-contadores")).toBeVisible({ timeout: 20_000 });
      await expect(secao.getByTestId("matriculas-contadores")).toContainText("Conferidos automático");
      await expect(secao.getByTestId("matriculas-contadores")).toContainText("Tempo médio da equipe");
      // As conferidas na hora (caminho A) não entram na fila.
      await expect(secao.getByTestId("matricula-card").filter({ hasText: "Alice" })).toHaveCount(0);
      const card = secao.getByTestId("matricula-card").filter({ hasText: "Diana" }).first();
      await expect(card).toBeVisible();
      await expect(card.getByTestId("matricula-resumo")).toContainText("Unidade: Apartamento 302");
      await expect(card.getByTestId("matricula-proprietarios")).toContainText("final 191 · não confere");
      await expect(card.getByTestId("matricula-caf-laudo")).toContainText("Ainda não feita");
      await expect(card.getByTestId("matricula-caso-admin")).toContainText("Sou cônjuge do proprietário");
      await expect(card).not.toContainText(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
      await card.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t195-admin-fila-1280.png`, fullPage: false });

      await card.getByTestId("matricula-pedir").click();
      await card.getByTestId("matricula-motivo").selectOption("titular_diverge");
      await card.getByTestId("matricula-confirmar").click();
      await expect(secao.getByTestId("matricula-card").filter({ hasText: "Diana" })).toHaveCount(1, { timeout: 10_000 });
    });
  });
});
