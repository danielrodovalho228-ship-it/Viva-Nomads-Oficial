import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, CHAVE_ANON, URL_SUPABASE, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * Rodada da vigia 24/10 (Pista C): a lista de confiança mudou para /dashboard/conta/seguranca (E66, #1263); o retorno
 *   do LinkedIn que ainda cai em Privacidade fica anotado como L-56.
 * Rodada da vigia 24/10 (Pista C): confirmação dos merges no lab-crítico do bloco 19 (t354).
 * Rodada da vigia 24/10 (Pista C): confirmação do merge no lab-crítico do bloco 15 (t338).
 * T351 — 63-A: telas do selo "LinkedIn conectado" (laboratório; a chave liga só no navegador do teste, pelo cookie).
 * Matriz do Muse, a 390 e 1280 px:
 *   1. chave desligada: a Conta não tem a linha do LinkedIn nem o retorno, mesmo com ?linkedin=…;
 *   2. Conta desconectada ("Opcional", o que é, "Conectar") e o retorno com as 3 falhas (causa + "Tentar de novo");
 *   3. fluxo de verdade (OIDC simulado): nome que não confere; conectar → "LinkedIn conectado" e "Conectado em";
 *      desconectar com a confirmação de 1 passo ("Manter conectado" não muda nada);
 *   4. o selo na candidatura, na conversa, na avaliação e no perfil do proprietário — nunca link, nunca no cartão.
 */
const SAIDA = "tests/laboratorio/saida";
const LAB_LINKEDIN = process.env.LAB_LINKEDIN_URL ?? "http://127.0.0.1:3997";
const LARGURAS = [390, 1280] as const;
/** E66 (#1263): a lista de confiança, com a linha do LinkedIn e o aviso do retorno, mora em Segurança e verificações. */
const SEGURANCA = "/dashboard/conta/seguranca";
const altura = (w: number) => (w === 390 ? 844 : 900);

async function identidade(sub: string, given_name: string, family_name: string) {
  await fetch(`${LAB_LINKEDIN}/__identidade`, { method: "POST", body: JSON.stringify({ sub, given_name, family_name }) });
}
async function ligarChave(page: Page) {
  if (page.url() === "about:blank") await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.context().addCookies([{ name: "vn_lab_linkedin", value: "1", url: new URL(page.url()).origin }]);
}
async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}
/** O selo nunca é link: nem <a>, nem dentro de um. */
async function seloSemLink(page: Page) {
  const selos = page.getByTestId("selo-linkedin");
  const n = await selos.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) expect(await selos.nth(i).evaluate((el) => !!el.closest("a") || el.tagName === "A")).toBe(false);
  await expect(page.locator('a[href*="linkedin.com"], img[src*="licdn"]')).toHaveCount(0);
}

test.describe("T351 — telas do selo LinkedIn conectado (63-A)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (OIDC simulado).");
  test.describe.configure({ mode: "serial", timeout: 240_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const ana = { email: `ana.t351.${sufixo}@lab.vivanomads.test`, nome: "Ana Clara Souza", role: "tenant" as const };
  const dono = { email: `dono.t351.${sufixo}@lab.vivanomads.test`, nome: "Otávio Dono", role: "owner" as const };
  const ids: Record<string, string> = {};

  async function comoAna(browser: Browser, w: number) {
    const p = await entrar(browser, ana.email, senha);
    await p.setViewportSize({ width: w, height: altura(w) });
    return p;
  }
  /** O selo sem passar pelo fluxo (o fluxo é coberto no passo 3 e no t323). */
  async function seloNoBanco(uid: string) {
    const agora = new Date();
    const vale = new Date(agora);
    vale.setUTCMonth(vale.getUTCMonth() + 12);
    const { error } = await adm()
      .from("confianca_linkedin")
      .upsert({ user_id: uid, sub_hash: randomBytes(32).toString("hex"), conectado_em: agora.toISOString(), valido_ate: vale.toISOString(), aviso_em: null }, { onConflict: "user_id" });
    if (error) throw error;
  }

  test.beforeAll(async () => {
    ids.ana = await criarConta(ana, senha);
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `LinkedIn t351 ${sufixo}`, { ativo: true });
    await criarLead(ids.dono, ids.ana, ids.imovel);
    await gravarMensagem(ids.ana, ids.dono, ids.imovel, "Olá! Tenho interesse no imóvel.", conversationId(ids.ana, ids.dono, ids.imovel));
    // Avaliação publicada da Ana (as duas partes avaliam → publica), para o selo com o autor na página do imóvel.
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
  });

  test.afterAll(async () => {
    await adm().from("confianca_linkedin").delete().in("user_id", [ids.ana, ids.dono].filter(Boolean));
    await adm().from("avaliacoes").delete().eq("contrato_id", ids.contrato ?? "");
    await adm().from("contratos").delete().eq("id", ids.contrato ?? "");
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.ana, ids.dono]);
  });

  for (const w of LARGURAS) {
    test(`1-2. a ${w} px: chave desligada esconde; desconectado e o retorno com as 3 falhas`, async ({ browser }) => {
      const p = await comoAna(browser, w);
      // Chave desligada: nada do LinkedIn, nem com o parâmetro de retorno.
      await p.goto("/dashboard/conta/seguranca?linkedin=nome", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("confianca-email")).toBeVisible({ timeout: 20_000 });
      await expect(p.getByTestId("confianca-linkedin")).toHaveCount(0);
      await expect(p.getByTestId("linkedin-retorno")).toHaveCount(0);

      await ligarChave(p);
      await p.goto(SEGURANCA, { waitUntil: "domcontentloaded" });
      const linha = p.getByTestId("confianca-linkedin");
      await expect(linha).toHaveAttribute("data-situacao", "falta", { timeout: 20_000 });
      await expect(linha).toContainText("Opcional");
      await expect(p.getByTestId("confianca-linkedin-descricao")).toHaveText("Mostra aos outros que você tem um LinkedIn com o mesmo nome desta conta. Ninguém vê seu perfil do LinkedIn.");
      await expect(p.getByTestId("confianca-linkedin-acao")).toHaveText("Conectar");
      await expect(p.getByTestId("confianca-linkedin-acao")).toHaveAttribute("href", "/api/conta/linkedin/conectar");
      await semRolagemLateral(p);
      await linha.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t351-conta-desconectado-${w}.png` });

      const falhas = {
        nome: "O nome no LinkedIn não confere com o nome da sua conta.",
        outra: "Este LinkedIn já está conectado a outra conta.",
        cancelado: "Você cancelou a conexão com o LinkedIn. Nada foi gravado.",
      } as const;
      for (const [k, causa] of Object.entries(falhas)) {
        await p.goto(`/dashboard/conta/seguranca?linkedin=${k}`, { waitUntil: "domcontentloaded" });
        const r = p.getByTestId("linkedin-retorno");
        await expect(r).toHaveAttribute("data-ok", "nao", { timeout: 20_000 });
        await expect(p.getByTestId("linkedin-aviso")).toHaveText(causa);
        await expect(r.getByTestId("linkedin-tentar-de-novo")).toHaveText("Tentar de novo");
        await expect(r.getByTestId("linkedin-tentar-de-novo")).toHaveAttribute("href", "/api/conta/linkedin/conectar");
        await semRolagemLateral(p);
        await r.scrollIntoViewIfNeeded();
        await p.screenshot({ path: `${SAIDA}/t351-retorno-${k}-${w}.png` });
      }
      await p.context().close();
    });
  }

  test("3. fluxo de verdade: nome que não confere; conectar; desconectar com confirmação de 1 passo (390 e 1280)", async ({ browser }) => {
    const p = await comoAna(browser, 390);
    await ligarChave(p);
    const conectar = async () => {
      await p.goto(SEGURANCA, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("confianca-linkedin")).toHaveAttribute("data-situacao", "falta", { timeout: 20_000 });
      await p.getByTestId("confianca-linkedin-acao").click();
      await p.waitForURL(/linkedin=/, { timeout: 30_000 });
      const volta = new URL(p.url());
      if (volta.pathname === "/dashboard/conta/privacidade") {
        // L-56 (Pista A): o retorno do LinkedIn ainda cai em Privacidade, onde a lista (e o aviso do retorno) não está mais.
        test.info().annotations.push({ type: "L-56", description: `retorno do LinkedIn em ${volta.pathname}${volta.search}` });
        await p.goto(`${SEGURANCA}${volta.search}`, { waitUntil: "domcontentloaded" });
      }
      return volta.searchParams.get("linkedin");
    };
    await identidade(`sub-t351-nome-${sufixo}`, "Bruno", "Lima");
    expect(await conectar()).toBe("nome");
    await expect(p.getByTestId("linkedin-aviso")).toHaveText("O nome no LinkedIn não confere com o nome da sua conta.");

    await identidade(`sub-t351-${sufixo}`, "Ana", "Souza");
    expect(await conectar()).toBe("conectado");
    await expect(p.getByTestId("linkedin-retorno-titulo")).toHaveText("LinkedIn conectado");
    await expect(p.getByTestId("linkedin-tentar-de-novo")).toHaveCount(0);
    const linha = p.getByTestId("confianca-linkedin");
    await expect(linha).toHaveAttribute("data-situacao", "ok", { timeout: 20_000 });
    await expect(linha).toContainText(/Conectado em \d{2}\/\d{2}\/\d{4}/);
    await linha.scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${SAIDA}/t351-retorno-sucesso-390.png` });

    for (const w of LARGURAS) {
      await p.setViewportSize({ width: w, height: altura(w) });
      await p.goto(SEGURANCA, { waitUntil: "domcontentloaded" });
      await expect(linha).toHaveAttribute("data-situacao", "ok", { timeout: 20_000 });
      await linha.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t351-conta-conectado-${w}.png` });
      // 1º clique: a confirmação aparece na própria tela; "Manter conectado" não muda nada.
      await linha.getByTestId("confianca-linkedin-botao").click();
      const conf = p.getByTestId("linkedin-confirmar-desconexao");
      await expect(conf).toContainText("O selo sai do seu perfil agora. Você pode conectar de novo quando quiser.");
      await semRolagemLateral(p);
      await p.screenshot({ path: `${SAIDA}/t351-conta-desconectar-${w}.png` });
      await conf.getByTestId("linkedin-desconectar-cancela").click();
      await expect(conf).toHaveCount(0);
      await expect(linha).toHaveAttribute("data-situacao", "ok");
    }
    await linha.getByTestId("confianca-linkedin-botao").click();
    await p.getByTestId("linkedin-desconectar-confirma").click();
    await expect(linha).toHaveAttribute("data-situacao", "falta", { timeout: 20_000 });
    await expect.poll(async () => (await adm().from("confianca_linkedin").select("user_id").eq("user_id", ids.ana).maybeSingle()).data).toBeNull();
    await p.context().close();
  });

  test("4. o selo na candidatura, na conversa, na avaliação e no perfil do proprietário — nunca link, nunca no cartão (390 e 1280)", async ({ browser }) => {
    await seloNoBanco(ids.ana);
    await seloNoBanco(ids.dono);
    for (const w of LARGURAS) {
      const d = await entrar(browser, dono.email, senha);
      await d.setViewportSize({ width: w, height: altura(w) });
      await ligarChave(d);
      // Candidatura (tela do dono).
      await d.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
      const sinais = d.getByTestId("candidato-sinais").first();
      await expect(sinais.getByTestId("selo-linkedin")).toBeVisible({ timeout: 20_000 });
      await seloSemLink(d);
      await semRolagemLateral(d);
      await sinais.scrollIntoViewIfNeeded();
      await d.screenshot({ path: `${SAIDA}/t351-selo-candidatura-${w}.png` });
      // Cabeçalho da conversa.
      await d.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
      await d.getByRole("button", { name: /LinkedIn t351/ }).first().click();
      await expect(d.getByTestId("selo-linkedin").first()).toBeVisible({ timeout: 20_000 });
      await seloSemLink(d);
      await d.screenshot({ path: `${SAIDA}/t351-selo-conversa-${w}.png` });
      await d.context().close();

      const v = await (await browser.newContext({ viewport: { width: w, height: altura(w) } })).newPage();
      await ligarChave(v);
      // Autor da avaliação, na página do imóvel.
      await expect
        .poll(async () => {
          await v.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
          return v.getByTestId("avaliacao-real").getByTestId("selo-linkedin").count();
        }, { timeout: 90_000, intervals: [3_000, 10_000, 20_000] })
        .toBeGreaterThan(0);
      const av = v.getByTestId("avaliacao-real").first();
      await av.scrollIntoViewIfNeeded();
      await seloSemLink(v);
      await v.screenshot({ path: `${SAIDA}/t351-selo-avaliacao-${w}.png` });
      // Perfil público do proprietário: o selo em pílula, como os vizinhos; nunca no cartão do imóvel.
      await v.goto(`/proprietario/${ids.dono}`, { waitUntil: "domcontentloaded" });
      const selo = v.getByTestId("selo-linkedin").first();
      await expect(selo).toBeVisible({ timeout: 20_000 });
      await expect(selo).toHaveAttribute("data-formato", "pilula");
      await seloSemLink(v);
      await expect(v.getByTestId("cartao-imovel").getByTestId("selo-linkedin")).toHaveCount(0);
      await semRolagemLateral(v);
      await v.screenshot({ path: `${SAIDA}/t351-selo-perfil-proprietario-${w}.png` });
      await v.context().close();
    }
  });
});
