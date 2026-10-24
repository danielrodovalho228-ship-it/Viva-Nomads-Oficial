import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, cpfAleatorio, criarConta, entrar, lerSaida, liberarLimiteChamados, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T441 — FISCAL-PARCEIRO-B (E24), laboratório (390 e 1280 px):
   1. cadastro PJ (CNPJ): a pergunta "Você emite nota fiscal de serviço para o cliente?" aparece e é OBRIGATÓRIA —
      sem resposta o pedido não sai (nada gravado); com "Sim" grava emite_nota = true. PF não vê a pergunta e grava null;
   2. banco: PF nunca guarda emite_nota (check em parceiros e em parceiro_solicitacoes); visitante não lê parceiros
      (RLS) e a view pública expõe só tipo_pessoa/emite_nota;
   3. PJ que já estava no ar com emite_nota null: pendência no painel, a página continua publicada; PJ em rascunho
      sem resposta não publica;
   4. busca: filtro "Emite nota fiscal" com contagem — só quem declarou Sim (PF e PJ sem resposta ficam fora);
   5. denúncia "Não emitiu a nota fiscal declarada" pela página do parceiro → chamado com contexto 'parceiro' → admin
      "Denúncia procedente" tira o selo (emite_nota = false), grava o motivo e avisa o parceiro UMA vez.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const cidade = `Notalândia ${sufixo}`;
const pj = { email: `pj.t441.${sufixo}@lab.vivanomads.test`, nome: "Clara Nota Serviços", role: "tenant" as const };
const pf = { email: `pf.t441.${sufixo}@lab.vivanomads.test`, nome: "Paulo Recibo Lima", role: "tenant" as const };
const antigo = { email: `antigo.t441.${sufixo}@lab.vivanomads.test`, nome: "Antônio Antigo Reparos", role: "tenant" as const };
const novato = { email: `novato.t441.${sufixo}@lab.vivanomads.test`, nome: "Nina Novata Limpeza", role: "tenant" as const };
const cliente = { email: `cli.t441.${sufixo}@lab.vivanomads.test`, nome: "Rita Cliente Souza", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};
const parceiro: Record<string, { id: string; slug: string }> = {};

function cnpjAleatorio(): string {
  const n = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).concat([0, 0, 0, 1]);
  const dv = (base: number[]) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = base.reduce((s, d, i) => s + d * pesos[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(n);
  const d2 = dv([...n, d1]);
  return [...n, d1, d2].join("");
}

function semDialogo(page: Page) {
  page.on("dialog", (d) => {
    throw new Error(`diálogo do navegador não permitido: ${d.type()} ${d.message()}`);
  });
}

async function abrir(browser: Browser, email: string, largura: number) {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  semDialogo(page);
  return page;
}

/** Parceiro direto no banco (o ciclo completo de publicação é o t236). */
async function semear(chave: string, userId: string, o: { tipo: "pf" | "pj"; emiteNota: boolean | null; status: "publicado" | "rascunho" }) {
  const slug = `t441-${chave}-${sufixo}`;
  const { data, error } = await adm()
    .from("parceiros")
    .insert({
      user_id: userId,
      tipo_pessoa: o.tipo,
      documento: o.tipo === "pf" ? cpfAleatorio() : cnpjAleatorio(),
      nome_publico: `${chave} ${sufixo}`,
      slug,
      categorias: ["limpeza"],
      cidades: [cidade],
      descricao: "Limpeza de saída e pós-obra em imóveis mobiliados, com material próprio.",
      emite_nota: o.emiteNota,
      status: o.status,
      publicado_em: o.status === "publicado" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) throw error;
  parceiro[chave] = { id: (data as { id: string }).id, slug };
}

test.describe("T441 — FISCAL-PARCEIRO-B: nota fiscal do parceiro PJ", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (Supabase local + integrações simuladas).");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    for (const [k, c] of Object.entries({ pj, pf, antigo, novato, cliente })) ids[k] = await criarConta(c, senha);
    await semear("antigo", ids.antigo!, { tipo: "pj", emiteNota: null, status: "publicado" });
    await semear("novato", ids.novato!, { tipo: "pj", emiteNota: null, status: "rascunho" });
  });

  test.afterAll(async () => {
    await adm().from("chamados").delete().eq("usuario_id", ids.cliente ?? "");
    await apagarContas(Object.values(ids));
  });

  test("1. cadastro PJ: a pergunta da nota é obrigatória; PF não vê a pergunta e grava null", async ({ browser }) => {
    const page = await abrir(browser, pj.email, 390);
    await page.goto("/parceiros#quero-ser-parceiro", { waitUntil: "domcontentloaded" });
    const form = page.getByTestId("seja-parceiro-form");
    await expect(form).toBeVisible({ timeout: 20_000 });
    // PF (padrão): sem a pergunta.
    await expect(page.getByTestId("sp-emite-nota")).toHaveCount(0);
    await form.getByText("Empresa ou MEI (CNPJ)").click();
    await expect(page.getByTestId("sp-emite-nota")).toContainText("Você emite nota fiscal de serviço para o cliente?");
    await form.locator("#sp-doc").fill(cnpjAleatorio());
    await page.getByTestId("sp-cat-limpeza").check();
    await form.locator("#sp-cidades").fill(cidade);
    await form.locator("#sp-descricao").fill("Limpeza de saída e pós-obra com nota fiscal.");
    await page.getByTestId("sp-aceite").check();
    await page.getByTestId("seja-parceiro-enviar").click();
    await expect(page.getByTestId("seja-parceiro-erro")).toContainText("Você emite nota fiscal de serviço para o cliente?");
    const { count } = await adm().from("parceiro_solicitacoes").select("id", { count: "exact", head: true }).eq("email", pj.email);
    expect(count, "sem resposta, o pedido PJ não sai").toBe(0);
    await form.getByText("Sim", { exact: true }).click();
    await page.getByTestId("seja-parceiro-enviar").click();
    await expect(page.getByTestId("seja-parceiro-recebido")).toBeVisible({ timeout: 20_000 });
    const { data: sol } = await adm().from("parceiro_solicitacoes").select("tipo_pessoa, emite_nota").eq("email", pj.email).single();
    expect(sol).toEqual({ tipo_pessoa: "pj", emite_nota: true });
    await page.context().close();

    // PF: mesmo formulário, sem a pergunta; grava null.
    const p2 = await abrir(browser, pf.email, 1280);
    await p2.goto("/parceiros#quero-ser-parceiro", { waitUntil: "domcontentloaded" });
    const f2 = p2.getByTestId("seja-parceiro-form");
    await expect(f2).toBeVisible({ timeout: 20_000 });
    await expect(p2.getByTestId("sp-emite-nota")).toHaveCount(0);
    await f2.locator("#sp-doc").fill(cpfAleatorio());
    await p2.getByTestId("sp-cat-limpeza").check();
    await f2.locator("#sp-cidades").fill(cidade);
    await f2.locator("#sp-descricao").fill("Limpeza de saída, emito recibo.");
    await p2.getByTestId("sp-aceite").check();
    await p2.getByTestId("seja-parceiro-enviar").click();
    await expect(p2.getByTestId("seja-parceiro-recebido")).toBeVisible({ timeout: 20_000 });
    const { data: solPf } = await adm().from("parceiro_solicitacoes").select("tipo_pessoa, emite_nota").eq("email", pf.email).single();
    expect(solPf).toEqual({ tipo_pessoa: "pf", emite_nota: null });
    await p2.context().close();
  });

  test("2. banco: PF nunca guarda emite_nota (check); visitante não lê parceiros (RLS); a view pública expõe a declaração", async () => {
    await semear("pf", ids.pf!, { tipo: "pf", emiteNota: null, status: "publicado" });
    await semear("pj", ids.pj!, { tipo: "pj", emiteNota: true, status: "publicado" });
    const { error: e1 } = await adm().from("parceiros").update({ emite_nota: true }).eq("id", parceiro.pf.id);
    expect(e1?.message ?? "").toMatch(/parceiros_emite_nota_so_pj/);
    const { error: e2 } = await adm().from("parceiro_solicitacoes").update({ emite_nota: false }).eq("email", pf.email);
    expect(e2?.message ?? "").toMatch(/parceiro_solicitacoes_emite_nota_so_pj/);
    // Selo removido exige emite_nota = false.
    const { error: e3 } = await adm().from("parceiros").update({ nota_selo_removido_em: new Date().toISOString() }).eq("id", parceiro.pj.id);
    expect(e3?.message ?? "").toMatch(/parceiros_selo_removido_sem_nota/);
    const anon = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const { data: direto } = await anon.from("parceiros").select("id, emite_nota").in("id", [parceiro.pf.id, parceiro.pj.id]);
    expect(direto ?? [], "visitante não lê a tabela").toHaveLength(0);
    const { data: pub } = await anon.from("parceiros_publicos").select("slug, tipo_pessoa, emite_nota").in("slug", [parceiro.pf.slug, parceiro.pj.slug]).order("slug");
    expect(pub).toEqual([
      { slug: parceiro.pf.slug, tipo_pessoa: "pf", emite_nota: null },
      { slug: parceiro.pj.slug, tipo_pessoa: "pj", emite_nota: true },
    ]);
  });

  test("3. PJ no ar sem resposta: pendência no painel e continua publicado; PJ em rascunho não publica sem responder", async ({ browser }) => {
    const page = await abrir(browser, antigo.email, 390);
    await page.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("painel-parceiro")).toHaveAttribute("data-status", "publicado", { timeout: 20_000 });
    await expect(page.getByTestId("parceiro-nota-pendente")).toBeVisible();
    await expect(page.getByTestId("parceiro-nota")).toHaveAttribute("data-pendente", "1");
    await page.getByTestId("parceiro-nota-nao").click();
    await expect(page.getByTestId("parceiro-nota")).toHaveAttribute("data-emite", "nao", { timeout: 15_000 });
    await expect(page.getByTestId("parceiro-nota-pendente")).toHaveCount(0);
    await expect(page.getByTestId("painel-parceiro")).toHaveAttribute("data-status", "publicado");
    await page.context().close();

    const p2 = await abrir(browser, novato.email, 1280);
    await p2.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
    await expect(p2.getByTestId("parceiro-falta")).toContainText("Responda se você emite nota fiscal de serviço para o cliente.", { timeout: 20_000 });
    await p2.getByTestId("parceiro-nota-sim").click();
    await expect(p2.getByTestId("parceiro-nota")).toHaveAttribute("data-emite", "sim", { timeout: 15_000 });
    await expect(p2.getByTestId("parceiro-falta")).not.toContainText("nota fiscal");
    await p2.context().close();
  });

  test("4. busca: 'Emite nota fiscal' com contagem — só quem declarou Sim", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/parceiros/buscar?cidade=${encodeURIComponent(cidade)}`, { waitUntil: "domcontentloaded" });
    const res = page.getByTestId("busca-parceiros-resultado");
    // No ar nesta cidade: pf (recibo), pj (Sim) e antigo (respondeu Não) — o novato segue em rascunho.
    await expect(res).toHaveAttribute("data-total", "3");
    await expect(page.getByTestId("busca-parceiros-nota")).toHaveAttribute("data-qtd", "1");
    await expect(page.getByTestId("busca-parceiros-nota")).toContainText("Emite nota fiscal (1)");
    await page.getByTestId("busca-parceiros-nota-check").check();
    await page.getByTestId("busca-parceiros-buscar").click();
    await expect(page).toHaveURL(/nota=1/);
    await expect(res).toHaveAttribute("data-total", "1");
    await expect(res.locator(`a[href^="/parceiros/${parceiro.pj.slug}"]`).first()).toBeVisible();
    await expect(res.locator(`a[href^="/parceiros/${parceiro.pf.slug}"]`)).toHaveCount(0);
  });

  test("5. denúncia procedente tira o selo, grava o motivo e avisa o parceiro uma vez", async ({ browser }) => {
    await liberarLimiteChamados();
    const page = await abrir(browser, cliente.email, 390);
    // PF não tem o "Problema com isto?" de nota; PJ com Sim tem.
    await page.goto(`/parceiros/${parceiro.pf.slug}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("pagina-parceiro")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("parceiro-problema")).toHaveCount(0);
    await page.goto(`/parceiros/${parceiro.pj.slug}`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("parceiro-problema").getByRole("link", { name: "Problema com isto?" }).click();
    await expect(page).toHaveURL(new RegExp(`/ajuda\\?contexto=parceiro&id=${parceiro.pj.id}`));
    await expect(page.getByText("Sobre este parceiro")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel("Assunto")).toHaveValue("nota_parceiro");
    await page.getByLabel("O que aconteceu?").fill("Paguei a limpeza e o parceiro não emitiu a nota fiscal que declarou.");
    await page.getByRole("button", { name: "Enviar chamado" }).click();
    await expect(page).toHaveURL(/chamado=/, { timeout: 20_000 });
    const { data: ch } = await adm().from("chamados").select("id, categoria, contexto_tipo, contexto_id").eq("usuario_id", ids.cliente!).single();
    expect(ch).toMatchObject({ categoria: "nota_parceiro", contexto_tipo: "parceiro", contexto_id: parceiro.pj.id });
    await page.context().close();

    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const a = await ctx.newPage();
    semDialogo(a);
    await a.goto(`/admin/atendimento/${(ch as { id: string }).id}`, { waitUntil: "domcontentloaded" });
    await a.getByTestId("denuncia-nota-procedente").click();
    await a.getByRole("button", { name: "Tirar o selo" }).click();
    await expect(a.getByTestId("denuncia-nota-feita")).toBeVisible({ timeout: 20_000 });
    const { data: p } = await adm().from("parceiros").select("emite_nota, nota_selo_motivo, nota_selo_removido_em").eq("id", parceiro.pj.id).single();
    expect(p).toMatchObject({ emite_nota: false, nota_selo_motivo: "Não emitiu a nota fiscal declarada" });
    expect((p as { nota_selo_removido_em: string | null }).nota_selo_removido_em).not.toBeNull();
    const avisos = async () => (await lerSaida()).filter((e) => e.para === pj.email && /O selo de nota fiscal saiu/.test(String(e.assunto))).length;
    await expect.poll(avisos, { timeout: 15_000 }).toBe(1);
    // Repetir não avisa de novo.
    await a.reload({ waitUntil: "domcontentloaded" });
    await expect(a.getByTestId("denuncia-nota-feita")).toBeVisible();
    expect(await avisos()).toBe(1);
    await ctx.close();

    // O parceiro vê o motivo e não religa o selo sozinho; a busca com o filtro fica vazia nesta cidade.
    const pp = await abrir(browser, pj.email, 390);
    await pp.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
    await expect(pp.getByTestId("parceiro-nota-removido")).toContainText("Não emitiu a nota fiscal declarada", { timeout: 20_000 });
    await expect(pp.getByTestId("parceiro-nota-sim")).toBeDisabled();
    await pp.goto(`/parceiros/buscar?cidade=${encodeURIComponent(cidade)}&nota=1`, { waitUntil: "domcontentloaded" });
    await expect(pp.getByTestId("busca-parceiros-nota")).toHaveAttribute("data-qtd", "0");
    await pp.context().close();
  });
});
