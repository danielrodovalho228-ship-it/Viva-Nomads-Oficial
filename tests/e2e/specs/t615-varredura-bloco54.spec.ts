import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { gerarCodigoTotp } from "../fixtures/totp";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, criarConta, liberarLimiteLogin, liberarLimiteLoginIp, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TAMANHOS } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T615 — VARREDURA DA PÁGINA INTEIRA, BLOCO 54 (Pista C, 29/10). O protocolo do bloco 21 (t385): seis classes, página
  toda rolada, carregamento real de cada imagem, 390 e 1280 px, HTTP abaixo de 400. O bloco 54 cobre o que falta dos
  merges #1479–#1490: o E216 (#1479) trocou a barra do admin para o observador da QA (profiles.qa_admin), que não vê a
  Caixa dos Sócios. Os outros merges já têm bloco (#1483 → t599, #1484/#1489 → t613, #1488 → t614; #1487 e #1490 só
  mexeram em spec). Aqui o observador entra como a QA entra (senha + autenticador) e varre as telas do admin que ele
  abre, com a barra nova: no computador a barra lateral está na página; no celular a barra abre por cima e é conferida à
  parte (cabe na largura, nenhum rótulo cortado, nada da Caixa). Sem clique no primário (ações do admin têm efeito fora
  da tela; o observador não tem os botões). Só no laboratório.
*/
const TELAS: { nome: string; rota: string }[] = [
  { nome: "Visão geral", rota: "/admin" },
  { nome: "Central de Agentes", rota: "/admin/agentes" },
  { nome: "Atendimento", rota: "/admin/atendimento" },
  { nome: "Documentos", rota: "/admin/documentos" },
  { nome: "Sistema (sem os botões)", rota: "/admin/sistema" },
];

/** Achados já registrados como defeito de produto (L-*): ficam anotados e não derrubam o teste. */
const CONHECIDOS: { rota: RegExp; achado: RegExp; l: string; classe?: Classe }[] = [
  { rota: /^\/admin\/documentos\?aba=emitidos$/, classe: "estouro", achado: /além da direita: <label[^>]*> "Tipo/, l: "L-62" },
];
const conhecido = (rotulo: string, a: string, classe?: Classe) => CONHECIDOS.find((c) => c.classe === classe && c.rota.test(rotulo) && c.achado.test(a));

const SAIDA = "tests/laboratorio/saida/varredura-bloco54";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
const senha = novaSenha();
const sufixo = novoSufixo();
const emailObs = `qa+t615${sufixo}-observador@lab.vivanomads.test`;
const ids: Record<string, string> = {};
let segredo = "";

/** Login por senha (aal1) e o código do autenticador no admin (aal2), como a QA entra (o mesmo da t604). */
async function entrarObservador(browser: Browser, width: number, height: number): Promise<Page> {
  await liberarLimiteLogin(emailObs);
  await liberarLimiteLoginIp();
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await page.goto("/auth?senha=1", { waitUntil: "domcontentloaded" });
  const campoEmail = page.locator('input[name="email"], input[type="email"]').first();
  const campoSenha = page.locator('input[name="password"], input[type="password"]').first();
  await expect(async () => {
    if (/verificar-codigo|\/dashboard|\/admin/.test(page.url())) return;
    if ((await campoEmail.inputValue({ timeout: 5_000 })) !== emailObs) await campoEmail.fill(emailObs, { timeout: 5_000 });
    if ((await campoSenha.inputValue({ timeout: 5_000 })) !== senha) await campoSenha.fill(senha, { timeout: 5_000 });
    await page.locator("form").getByRole("button", { name: /^entrar$/i }).click({ timeout: 5_000 });
    await page.waitForURL(/verificar-codigo|\/dashboard|\/admin/, { timeout: 15_000 });
  }).toPass({ timeout: 50_000 });
  await page.goto("/admin/agentes", { waitUntil: "domcontentloaded" });
  if (/verificar-codigo/.test(page.url())) {
    await page.locator("#codigo-2fa").fill(gerarCodigoTotp(segredo));
    await page.getByRole("button", { name: /confirmar e entrar/i }).click();
    await page.waitForURL(/\/admin\/agentes/, { timeout: 30_000 });
  }
  return page;
}

test.describe("T615 — varredura da página inteira, bloco 54 (admin do observador da QA depois do E216) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  // As telas usam a mesma conta (o autenticador é dela): um trabalhador só, em ordem.
  test.describe.configure({ mode: "default" });

  test.beforeAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    ids.obs = await criarConta({ email: emailObs, nome: "Olívia Observadora", role: "tenant" }, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.obs);
    const { error } = await adm().rpc("promover_qa_admin", { p_id: ids.obs });
    if (error) throw error;
    const c = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const { error: eLogin } = await c.auth.signInWithPassword({ email: emailObs, password: senha });
    if (eLogin) throw eLogin;
    const { data: fator, error: eEnroll } = await c.auth.mfa.enroll({ factorType: "totp", friendlyName: "qa-observador-t615" });
    if (eEnroll) throw eEnroll;
    segredo = fator!.totp.secret;
    const { data: desafio } = await c.auth.mfa.challenge({ factorId: fator!.id });
    const { error: eVer } = await c.auth.mfa.verify({ factorId: fator!.id, challengeId: desafio!.id, code: gerarCodigoTotp(segredo) });
    if (eVer) throw eVer;
  });
  test.afterAll(async () => {
    if (!ids.obs) return;
    await adm().rpc("revogar_qa_admin", { p_id: ids.obs });
    await apagarContas([ids.obs]);
  });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
  });

  for (const t of TELAS) {
    test(`observador da QA — ${t.nome}: as seis classes, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      const relatorio: Record<string, Record<string, string[]>> = {};
      for (const tam of TAMANHOS) {
        const page = await entrarObservador(browser, tam.width, tam.height);
        try {
          const respostas = escutarImagens(page);
          const resposta = await page.goto(t.rota, { waitUntil: "domcontentloaded", timeout: 40_000 });
          expect(resposta?.status() ?? 0, `${t.nome} @${tam.nome}: HTTP`).toBeLessThan(400);
          expect(new URL(page.url()).pathname, `${t.nome} @${tam.nome}: caiu fora da tela (login ou redirecionamento)`).toBe(t.rota);
          await page.locator("main").first().waitFor({ timeout: 20_000 }).catch(() => {});
          const achados = await varrerPagina(page, respostas);
          for (const classe of Object.keys(CLASSES) as Classe[]) {
            await test.step(`${classe} @${tam.nome}`, async () => {
              for (const a of achados[classe]) console.log(`VARREDURA|${classe}|${tam.nome}|observador|${t.rota}|${a}`);
              for (const a of achados[classe]) {
                const c = conhecido(t.rota, a, classe);
                if (c) test.info().annotations.push({ type: c.l, description: `${t.rota} @${tam.nome} (${classe}): ${a}` });
              }
              const novos = achados[classe].filter((a) => !conhecido(t.rota, a, classe));
              expect.soft(novos, `observador — ${t.nome} @${tam.nome} — ${classe}: ${CLASSES[classe]}`).toEqual([]);
            });
          }
          const barra: string[] = [];
          await test.step(`barra do admin @${tam.nome}`, async () => {
            if (tam.width < 768) await page.getByTestId("admin-abrir-menu").click();
            const menu = page.getByTestId("menu-cascata").filter({ visible: true });
            await expect(menu).toHaveCount(1, { timeout: 30_000 });
            // Abre todos os grupos para medir cada rótulo.
            for (const g of await menu.locator("li[data-menu-grupo] > button[aria-expanded='false']").all()) await g.click().catch(() => {});
            const medida = await menu.evaluate((el) => {
              const r = el.getBoundingClientRect();
              const cortados = [...el.querySelectorAll<HTMLElement>("a, button")]
                .filter((x) => x.offsetParent !== null && x.scrollWidth > x.clientWidth + 1 && getComputedStyle(x).overflow !== "visible")
                .map((x) => (x.textContent ?? "").trim().slice(0, 40));
              return { direita: r.right, largura: window.innerWidth, cortados };
            });
            if (medida.direita > medida.largura + 1) barra.push(`barra passa da direita da tela (${Math.round(medida.direita)} > ${medida.largura})`);
            for (const c of medida.cortados) barra.push(`rótulo cortado na barra: "${c}"`);
            if ((await menu.locator('a[href="/admin/socios"]').count()) > 0) barra.push('a barra do observador mostra "Caixa dos Sócios" (E216)');
            for (const a of barra) console.log(`VARREDURA|barra|${tam.nome}|observador|${t.rota}|${a}`);
            expect.soft(barra, `observador — ${t.nome} @${tam.nome} — barra do admin`).toEqual([]);
          });
          relatorio[tam.nome] = { ...achados, barra };
        } finally {
          await page.context().close();
        }
      }
      mkdirSync(SAIDA, { recursive: true });
      writeFileSync(`${SAIDA}/${slug(`observador-${t.nome}`)}.json`, JSON.stringify({ papel: "observador da QA", tela: t.nome, achados: relatorio }, null, 2));
    });
  }
});
