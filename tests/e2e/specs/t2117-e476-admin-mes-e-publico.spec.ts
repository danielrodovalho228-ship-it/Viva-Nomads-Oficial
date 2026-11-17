import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { gerarCodigoTotp } from "../fixtures/totp";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, apagarContas, criarAdmin, liberarLimiteLogin, liberarLimiteLoginIp, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2117 — E476 (ii) e (iii) (Pista 3; varredura "sem spec" das 142, lote I) @E476 — sem @ao-vivo-seguro: precisa de
  sessão de admin (2FA) e do laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E476; unitário e476-admin-acabamento.test.ts):
    (ii) Marketing: o mês do gasto é uma lista em português ("novembro de 2026"), do mês atual até janeiro de 2024 —
         nunca o campo nativo <input type="month">, que escrevia no idioma do navegador ("November 2026");
    (iii) Anúncios: o cabeçalho separa por tipo (reais "aparece(m) para o público", demonstração "aparece(m) como
          exemplo", teste "não aparece") e cada linha diz "sim"/"não"/"como exemplo" pelo mesmo critério.
  Os valores esperados são escritos aqui a partir da regra (não importados do código que se testa: partido o código, a
  spec tem de ficar vermelha). O navegador corre em inglês (locale en-US) de propósito: é onde o campo nativo escreveria "November 2026".
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const admin = { email: `equipe.t2117.${sufixo}@lab.vivanomads.test`, nome: "[TESTE QA] Mara Meses" };
const ids: (string | undefined)[] = [];
let segredoTotp = "";
const NOMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES = new RegExp(`^(${NOMES.join("|")}) de \\d{4}$`);
/** O rótulo esperado de "AAAA-MM", escrito aqui a partir da regra (não importado do código que se testa). */
const mesEsperado = (v: string) => `${NOMES[Number(v.slice(5, 7)) - 1]} de ${v.slice(0, 4)}`;
/** A palavra de cada linha pela regra do E476 (iii), escrita aqui: real sim/não, teste não, demonstração "como exemplo"/não. */
const publicoEsperado = (tipo: string, publico: boolean) => (tipo === "demonstracao" ? (publico ? "como exemplo" : "não") : tipo === "teste" ? "não" : publico ? "sim" : "não");
/** O cabeçalho pela regra, escrito aqui: cada tipo com a sua palavra; nenhum visível → "nenhum aparece para o público". */
function resumoEsperado(l: { tipo: string; publico: boolean }[]): string {
  const reais = l.filter((x) => x.tipo === "real" && x.publico).length;
  const demos = l.filter((x) => x.tipo === "demonstracao" && x.publico).length;
  const testes = l.filter((x) => x.tipo === "teste").length;
  const partes: string[] = [];
  if (reais) partes.push(`${reais} ${reais === 1 ? "real aparece" : "reais aparecem"} para o público`);
  if (demos) partes.push(`${demos} de demonstração ${demos === 1 ? "aparece" : "aparecem"} como exemplo`);
  if (testes) partes.push(`${testes} de teste não ${testes === 1 ? "aparece" : "aparecem"}`);
  return partes.length ? partes.join(" · ") : "nenhum aparece para o público";
}

async function entrarAdmin(page: Page) {
  await liberarLimiteLogin(admin.email);
  await liberarLimiteLoginIp();
  await page.goto("/auth?senha=1", { waitUntil: "domcontentloaded" });
  const campoEmail = page.locator('input[name="email"], input[type="email"]').first();
  const campoSenha = page.locator('input[name="password"], input[type="password"]').first();
  await expect(async () => {
    if (/verificar-codigo|\/dashboard|\/admin/.test(page.url())) return;
    if ((await campoEmail.inputValue({ timeout: 5_000 })) !== admin.email) await campoEmail.fill(admin.email, { timeout: 5_000 });
    if ((await campoSenha.inputValue({ timeout: 5_000 })) !== senha) await campoSenha.fill(senha, { timeout: 5_000 });
    await page.locator("form").getByRole("button", { name: /^entrar$/i }).click({ timeout: 5_000 });
    await page.waitForURL(/verificar-codigo|\/dashboard|\/admin/, { timeout: 15_000 });
  }).toPass({ timeout: 50_000 });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  if (/verificar-codigo/.test(page.url())) {
    await page.locator("#codigo-2fa").fill(gerarCodigoTotp(segredoTotp));
    await page.getByRole("button", { name: /confirmar e entrar/i }).click();
    await page.waitForURL(/\/admin(?!.*verificar)/, { timeout: 30_000 });
  }
}

test.describe("T2117 — E476: o mês do Marketing em português e o público dos Anúncios por tipo @E476", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.use({ locale: "en-US" });

  test.beforeAll(async () => {
    ids.push(await criarAdmin(admin.email, admin.nome, senha));
    const c = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const { error: eLogin } = await c.auth.signInWithPassword({ email: admin.email, password: senha });
    if (eLogin) throw eLogin;
    const { data: fator, error: eEnroll } = await c.auth.mfa.enroll({ factorType: "totp", friendlyName: "t2117" });
    if (eEnroll) throw eEnroll;
    segredoTotp = fator!.totp.secret;
    const { data: desafio } = await c.auth.mfa.challenge({ factorId: fator!.id });
    const { error: eVer } = await c.auth.mfa.verify({ factorId: fator!.id, challengeId: desafio!.id, code: gerarCodigoTotp(segredoTotp) });
    if (eVer) throw eVer;
  });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — Marketing: a lista de meses em português; Anúncios: o público por tipo, no cabeçalho e nas linhas`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await entrarAdmin(page);

      // (ii) Marketing.
      await page.goto("/admin/marketing", { waitUntil: "domcontentloaded" });
      const mes = page.locator("select").filter({ has: page.locator('option[value="2024-01"]') }).first();
      await expect(mes, "o mês é uma lista (select)").toBeAttached({ timeout: 30_000 });
      await expect(page.locator('input[type="month"]'), "sem o campo nativo de mês").toHaveCount(0);
      const opcoes = await mes.locator("option").evaluateAll((os) => os.map((o) => ({ valor: (o as HTMLOptionElement).value, rotulo: (o.textContent ?? "").trim() })));
      expect(opcoes.length, "do mês atual até janeiro de 2024").toBeGreaterThanOrEqual(35);
      expect(opcoes.at(-1)).toEqual({ valor: "2024-01", rotulo: "janeiro de 2024" });
      for (const o of opcoes) {
        expect(o.rotulo, `${o.valor}: o rótulo em português`).toMatch(MESES);
        expect(o.rotulo, `${o.valor}: o mês e o ano do valor`).toBe(mesEsperado(o.valor));
      }

      // (iii) Anúncios.
      await page.goto("/admin/imoveis", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("admin-imoveis")).toBeVisible({ timeout: 30_000 });
      const linhas = await page.getByTestId("imovel-linha").evaluateAll((ls) =>
        ls.map((l) => ({ tipo: l.getAttribute("data-tipo") ?? "", publico: l.getAttribute("data-publico") === "sim", rotulo: (l.querySelector('[data-testid="imovel-publico"]')?.textContent ?? "").trim() })),
      );
      const total = Number(await page.getByTestId("lista-total").innerText());
      expect(linhas.length, "todas as linhas da lista estão na tela").toBe(total);
      for (const l of linhas) expect(l.rotulo, `linha ${l.tipo}/${l.publico ? "pública" : "não"}`).toBe(publicoEsperado(l.tipo, l.publico));
      await expect(page.getByTestId("lista-publico")).toHaveText(resumoEsperado(linhas));
      // A demonstração nunca entra como "para o público".
      await expect(page.getByTestId("lista-publico")).not.toHaveText(/demonstração aparecem? para o público/);
    });
  }
});
