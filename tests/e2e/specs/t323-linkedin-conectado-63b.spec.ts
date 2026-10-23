import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, CHAVE_ANON, URL_SUPABASE, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T323 — 63-B: selo "LinkedIn conectado" com o OIDC simulado do laboratório (scripts/lab/linkedin-falso.mjs).
 *   1. nome divergente → "O nome no LinkedIn não confere com o nome da sua conta." e nada gravado;
 *   2. conectar → "Conectado em dd/mm/aaaa" na Conta; o banco guarda só o hash do sub, com validade de 12 meses;
 *   3. o dono vê o selo na candidatura e no cabeçalho da conversa (sem link, nome ou foto do LinkedIn); com a chave
 *      desligada, nada aparece; a avaliação do morador mostra o selo na página do imóvel;
 *   4. o mesmo LinkedIn em outra conta é recusado ("Este LinkedIn já está conectado a outra conta.");
 *   5. desconectar apaga a linha e o selo some na hora, para o dono também.
 */
const SAIDA = "tests/laboratorio/saida";
const LAB_LINKEDIN = process.env.LAB_LINKEDIN_URL ?? "http://127.0.0.1:3997";

async function identidade(sub: string, given_name: string, family_name: string) {
  await fetch(`${LAB_LINKEDIN}/__identidade`, { method: "POST", body: JSON.stringify({ sub, given_name, family_name }) });
}
/** A chave LINKEDIN_CONECTAR_ATIVO liga só neste navegador (cookie do laboratório; em produção não vale nada). */
async function ligarChave(page: Page) {
  if (page.url() === "about:blank") await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.context().addCookies([{ name: "vn_lab_linkedin", value: "1", url: new URL(page.url()).origin }]);
}
async function conectar(page: Page): Promise<string> {
  await page.goto("/dashboard/conta#confianca", { waitUntil: "domcontentloaded" });
  const linha = page.getByTestId("confianca-linkedin");
  await expect(linha).toHaveAttribute("data-situacao", "falta", { timeout: 20_000 });
  await linha.getByTestId("confianca-linkedin-acao").click();
  await page.waitForURL(/linkedin=/, { timeout: 30_000 });
  return new URL(page.url()).searchParams.get("linkedin") ?? "";
}
const linhaDe = async (uid: string) => (await adm().from("confianca_linkedin").select("sub_hash, conectado_em, valido_ate").eq("user_id", uid).maybeSingle()).data;

test.describe("T323 — selo LinkedIn conectado (63-B)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (OIDC simulado).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const ana = { email: `ana.t323.${sufixo}@lab.vivanomads.test`, nome: "Ana Clara Souza", role: "tenant" as const };
  const outra = { email: `outra.t323.${sufixo}@lab.vivanomads.test`, nome: "Ana Souza", role: "tenant" as const };
  const dono = { email: `dono.t323.${sufixo}@lab.vivanomads.test`, nome: "Otávio Dono", role: "owner" as const };
  const SUB = `sub-t323-${sufixo}`;
  const ids: Record<string, string> = {};

  test.beforeAll(async () => {
    ids.ana = await criarConta(ana, senha);
    ids.outra = await criarConta(outra, senha);
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `LinkedIn t323 ${sufixo}`, { ativo: true });
    await criarLead(ids.dono, ids.ana, ids.imovel);
    await gravarMensagem(ids.ana, ids.dono, ids.imovel, "Olá! Tenho interesse no imóvel.", conversationId(ids.ana, ids.dono, ids.imovel));
  });

  test.afterAll(async () => {
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.ana, ids.outra, ids.dono]);
  });

  test("1. nome divergente: mensagem clara e nada gravado", async ({ browser }) => {
    const p = await entrar(browser, ana.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await ligarChave(p);
    await identidade(SUB, "Ana", "Lima");
    expect(await conectar(p)).toBe("nome");
    await expect(p.getByTestId("linkedin-aviso")).toHaveText("O nome no LinkedIn não confere com o nome da sua conta.");
    await expect(p.getByTestId("confianca-linkedin")).toHaveAttribute("data-situacao", "falta");
    expect(await linhaDe(ids.ana)).toBeNull();
    await p.context().close();
  });

  test("2. conectar: 'Conectado em' na Conta; o banco guarda só o hash do sub, por 12 meses", async ({ browser }) => {
    const p = await entrar(browser, ana.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await ligarChave(p);
    await identidade(SUB, "Ana", "Souza");
    expect(await conectar(p)).toBe("conectado");
    const linha = p.getByTestId("confianca-linkedin");
    await expect(linha).toHaveAttribute("data-situacao", "ok", { timeout: 20_000 });
    await expect(linha).toContainText(/Conectado em \d{2}\/\d{2}\/\d{4}/);
    await p.screenshot({ path: `${SAIDA}/t323-conta-conectado-390.png`, fullPage: true });
    const l = await linhaDe(ids.ana);
    expect(l?.sub_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(l?.sub_hash).not.toContain(SUB);
    const meses = (Date.parse(l!.valido_ate) - Date.parse(l!.conectado_em)) / (30.4 * 86_400_000);
    expect(meses).toBeGreaterThan(11.5);
    expect(meses).toBeLessThan(12.5);
    await p.context().close();
  });

  test("3. o dono vê o selo na candidatura e na conversa; a chave desligada esconde; a avaliação mostra o selo", async ({ browser }) => {
    const semChave = await entrar(browser, dono.email, senha);
    await semChave.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
    await expect(semChave.getByTestId("candidato-sinais").first()).toBeVisible({ timeout: 20_000 });
    await expect(semChave.getByText("LinkedIn conectado")).toHaveCount(0);
    await semChave.context().close();

    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await ligarChave(p);
    await p.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("candidato-sinais").first()).toContainText("LinkedIn conectado", { timeout: 20_000 });
    // Só o selo: nenhum link ou foto do LinkedIn na tela do dono.
    await expect(p.locator('a[href*="linkedin.com"], img[src*="licdn"]')).toHaveCount(0);
    await p.screenshot({ path: `${SAIDA}/t323-candidatura-1280.png`, fullPage: true });

    await p.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
    await p.getByRole("button", { name: /LinkedIn t323/ }).first().click();
    await expect(p.getByTestId("selo-linkedin").first()).toBeVisible({ timeout: 20_000 });
    await expect(p.locator('a[href*="linkedin.com"]')).toHaveCount(0);
    await p.context().close();

    // Avaliação publicada da Ana sobre o imóvel (as duas partes avaliam → publica): o selo aparece com o autor.
    const base = { property_id: ids.imovel, tenant_id: ids.ana, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3000, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 240, qtd_ocupantes: 1, status: "concluido", garantia: "caucao" };
    const { data: ct, error } = await adm().from("contratos").insert({ ...base, encerrado_em: new Date(Date.now() - 24 * 3600_000).toISOString() }).select("id").single();
    if (error) throw error;
    ids.contrato = ct!.id as string;
    const cliente = async (email: string) => {
      const sb = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
      await sb.auth.signInWithPassword({ email, password: senha });
      return sb;
    };
    await (await cliente(ana.email)).from("avaliacoes").insert({ contrato_id: ids.contrato, alvo_id: ids.dono, papel_autor: "inquilino", nota_geral: 5, comentario_publico: "Imóvel muito bem cuidado.", status: "enviada" });
    await (await cliente(dono.email)).from("avaliacoes").insert({ contrato_id: ids.contrato, alvo_id: ids.ana, papel_autor: "proprietario", nota_geral: 5, status: "enviada" });
    const visitante = await browser.newPage();
    await ligarChave(visitante);
    await expect
      .poll(async () => {
        await visitante.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
        return visitante.getByTestId("avaliacao-real").getByTestId("selo-linkedin").count();
      }, { timeout: 45_000 })
      .toBeGreaterThan(0);
    await visitante.close();
  });

  test("4. o mesmo LinkedIn em outra conta é recusado", async ({ browser }) => {
    const p = await entrar(browser, outra.email, senha);
    await ligarChave(p);
    await identidade(SUB, "Ana", "Souza");
    expect(await conectar(p)).toBe("outra");
    await expect(p.getByTestId("linkedin-aviso")).toHaveText("Este LinkedIn já está conectado a outra conta.");
    expect(await linhaDe(ids.outra)).toBeNull();
    expect(await linhaDe(ids.ana)).not.toBeNull();
    await p.context().close();
  });

  test("5. desconectar apaga a linha e o selo some na hora (para o dono também)", async ({ browser }) => {
    const p = await entrar(browser, ana.email, senha);
    await ligarChave(p);
    await p.goto("/dashboard/conta#confianca", { waitUntil: "domcontentloaded" });
    const linha = p.getByTestId("confianca-linkedin");
    await expect(linha).toHaveAttribute("data-situacao", "ok", { timeout: 20_000 });
    await linha.getByTestId("confianca-linkedin-botao").click();
    // 63-A: confirmação de 1 passo antes de desconectar.
    await linha.getByTestId("linkedin-desconectar-confirma").click();
    await expect(linha).toHaveAttribute("data-situacao", "falta", { timeout: 20_000 });
    await expect.poll(() => linhaDe(ids.ana)).toBeNull();
    await p.context().close();

    const d = await entrar(browser, dono.email, senha);
    await ligarChave(d);
    await d.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("candidato-sinais").first()).toBeVisible({ timeout: 20_000 });
    await expect(d.getByText("LinkedIn conectado")).toHaveCount(0);
    await d.context().close();
  });
});
