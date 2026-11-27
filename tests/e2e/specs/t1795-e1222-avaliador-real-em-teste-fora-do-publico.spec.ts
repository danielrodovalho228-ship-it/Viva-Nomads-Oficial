import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo, cnpjAleatorio } from "../fixtures/laboratorio";

/*
  T1795 — E1222 @E1222 (ORDEM-DUET-1075, prompt do coordenador). Parceiros, página pública e vitrine do avaliador.
  Antes: um credenciado REAL (conta que não é de teste) com status em_teste e sem linha curada publicada tinha a página
  /avaliadores/<nº> no ar para qualquer visitante, e aparecia na listagem da cidade (o caso da Kellen, UBE-002).
  Depois (regra única avaliadorVisivelEmPublico): essa página responde 404 sem sessão e o credenciado não aparece na
  listagem; o real em teste COM linha curada publicada (a forma do UDI-003) continua com a página completa; a conta de
  teste em teste continua visível, na página e na listagem. (O real ativo é caso de unidade.)
  Massa só no laboratório, criada e apagada aqui: três credenciamentos em_teste em Uberlândia com números do contador.
  Visitante sem sessão, 1280 px. Laboratório; não é prova ao vivo no site.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE = "Uberlândia";
const LISTA = "/avaliadores/uberlandia";
const CURADO = { nome: "Rosa Curada da t1795", selo: "Selo curado da t1795" };
type Caso = { chave: "real" | "curado" | "teste"; nome: string; teste: boolean };
const CASOS: Caso[] = [
  { chave: "real", nome: "Kelly Real Semcurada", teste: false },
  { chave: "curado", nome: "Rosa Real Comcurada", teste: false },
  { chave: "teste", nome: "Tina Conta Deteste", teste: true },
];
const ids: Record<string, { conta?: string; parceiro?: string; cred?: string; numero?: string }> = {};

test.describe("T1795 — E1222: o avaliador real em teste sai do público @E1222", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    for (const c of CASOS) {
      const r: (typeof ids)[string] = (ids[c.chave] = {});
      r.conta = await criarConta({ email: `aval.t1795.${c.chave}.${sufixo}@lab.vivanomads.test`, nome: c.nome, role: "tenant" }, senha);
      await adm().from("profiles").update({ is_teste: c.teste }).eq("id", r.conta);
      const { data: p, error: eP } = await adm()
        .from("parceiros")
        .insert({ user_id: r.conta, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: c.nome, slug: `aval-t1795-${c.chave}-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE], status: "publicado", publicado_em: new Date().toISOString() })
        .select("id")
        .single();
      if (eP) throw eP;
      r.parceiro = p.id as string;
      const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
      r.numero = n as string;
      const { data: cr, error: eC } = await adm()
        .from("avaliadores_credenciamento")
        .insert({ parceiro_id: p.id, user_id: r.conta, cidade: CIDADE, numero_credenciado: r.numero, status: "em_teste", experiencia_link: "https://portfolio.lab.vivanomads.test/t1795", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
        .select("id")
        .single();
      if (eC) throw eC;
      r.cred = cr.id as string;
    }
    // A forma do UDI-003: a linha curada publicada, ligada ao credenciamento.
    const { error: eL } = await adm().from("avaliadores_perfil_publico").insert({ numero: ids.curado.numero, nome_publico: CURADO.nome, cidade: CIDADE, selo: CURADO.selo, publicado: true, credenciamento_id: ids.curado.cred });
    if (eL) throw eL;
  });

  test.afterAll(async () => {
    if (ids.curado?.numero) await adm().from("avaliadores_perfil_publico").delete().eq("numero", ids.curado.numero);
    for (const r of Object.values(ids)) {
      if (r.cred) await adm().from("avaliadores_credenciamento").delete().eq("id", r.cred);
      if (r.parceiro) await adm().from("parceiros").delete().eq("id", r.parceiro);
    }
    await apagarContas(Object.values(ids).map((r) => r.conta));
  });

  test("1. o credenciado REAL em teste, sem linha curada publicada: 404 sem sessão, e fora da listagem da cidade", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const r = await page.goto(`/avaliadores/${ids.real.numero}`, { waitUntil: "domcontentloaded" });
    expect(r?.status(), "a página da pessoa real em teste não está no ar").toBe(404);
    await expect(page.getByTestId("avaliador-publico")).toHaveCount(0);
    await expect(page.getByText("Kelly")).toHaveCount(0);
    await page.goto(LISTA, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("vitrine-avaliadores")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(`[data-testid="vitrine-cartao"][data-numero="${ids.real.numero}"]`)).toHaveCount(0);
  });

  test("2. o real em teste COM linha curada publicada (a forma do UDI-003): a página completa, com o nome e o selo curados", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const r = await page.goto(`/avaliadores/${ids.curado.numero}`, { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(200);
    await expect(page.getByTestId("avaliador-nome")).toHaveText(CURADO.nome, { timeout: 30_000 });
    await expect(page.getByTestId("avaliador-rotulo")).toHaveText(CURADO.selo);
    await expect(page.getByTestId("avaliador-numero")).toHaveText(ids.curado.numero!);
    await page.goto(LISTA, { waitUntil: "domcontentloaded" });
    await expect(page.locator(`[data-testid="vitrine-cartao"][data-numero="${ids.curado.numero}"]`)).toHaveCount(1, { timeout: 30_000 });
  });

  test("3. a conta de TESTE em teste continua visível: a página e o cartão na listagem", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const r = await page.goto(`/avaliadores/${ids.teste.numero}`, { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(200);
    await expect(page.getByTestId("avaliador-numero")).toHaveText(ids.teste.numero!, { timeout: 30_000 });
    await expect(page.getByTestId("avaliador-teste")).toBeVisible();
    await page.goto(LISTA, { waitUntil: "domcontentloaded" });
    await expect(page.locator(`[data-testid="vitrine-cartao"][data-numero="${ids.teste.numero}"]`)).toHaveCount(1, { timeout: 30_000 });
  });
});
