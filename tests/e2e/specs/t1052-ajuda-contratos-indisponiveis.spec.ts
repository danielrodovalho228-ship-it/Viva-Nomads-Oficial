import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, tornarContratoVigente } from "../fixtures/laboratorio";

/**
 * T1052 — Estados vazios, Central de Ajuda (#2352, 02/11): quando a leitura dos contratos do morador falha
 * (meusContratosAtivos), a tela "Abrir chamado" avisa "Não conseguimos carregar seus contratos agora. Para pedir
 * manutenção, tente de novo em instantes." com "Tentar de novo" — antes a falha virava "sem contrato" e "Manutenção no
 * imóvel" sumia sem explicação. Pela tela real /ajuda/fale-com-a-viva?novo=1, 390 e 1280, morador com contrato vigente:
 *   1. a ação dos contratos falha (simulada: a resposta da server action que traz o imóvel do contrato vira 500) → o
 *      aviso aparece e "Manutenção no imóvel" não é oferecida;
 *   2. a leitura volta e "Tentar de novo" é clicado → o aviso some, "Manutenção no imóvel" aparece e o contrato do
 *      morador está na lista de imóveis;
 *   3. controle — sem falha: nenhum aviso e "Manutenção no imóvel" direto.
 * O servidor que lança em vez de devolver lista vazia fica com o vazio-contratos-ajuda.test.ts.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1052.${sufixo}@lab.vivanomads.test`, nome: "Dario Ajuda Souza", role: "owner" as const };
const morador = { email: `morador.t1052.${sufixo}@lab.vivanomads.test`, nome: "Marta Ajuda Lima", role: "tenant" as const };
const TITULO = `Studio da ajuda t1052 ${sufixo}`;
const AVISO = "Não conseguimos carregar seus contratos agora. Para pedir manutenção, tente de novo em instantes.";
const MANUTENCAO = "Manutenção no imóvel";
const ids: Record<string, string> = {};

/** A server action cuja resposta traz o título do imóvel do contrato (meusContratosAtivos) responde 500. */
async function falharContratos(p: Page) {
  await p.route("**/ajuda/fale-com-a-viva**", async (r) => {
    const req = r.request();
    if (req.method() !== "POST" || !req.headers()["next-action"]) return r.fallback();
    const resp = await r.fetch();
    const corpo = await resp.text();
    if (corpo.includes(TITULO)) return r.fulfill({ status: 500, contentType: "text/plain", body: "falha simulada" });
    return r.fulfill({ response: resp, body: corpo });
  });
}

test.describe("T1052 — Central de Ajuda: a falha ao ler os contratos avisa e deixa tentar de novo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true, preco: 3200 });
    const { data, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.imovel,
        tenant_id: ids.morador,
        owner_plan: "free",
        faixa: "temporada",
        prazo_total_dias: 60,
        aluguel_mensal: 3200,
        tamanho_bloco_meses: 2,
        comissao_percent: 0.12,
        comissao_valor: 768,
        qtd_ocupantes: 1,
        status: "ativo",
        garantia: "caucao",
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    await tornarContratoVigente(ids.contrato, ids.dono, 3200);
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("pagamentos_bloco").delete().eq("contrato_id", ids.contrato ?? "");
    await adm().from("contrato_blocos").delete().eq("contrato_id", ids.contrato ?? "");
    await adm().from("contratos").delete().eq("id", ids.contrato ?? "");
    await apagarContas([ids.dono, ids.morador]);
  });

  for (const w of [390, 1280] as const) {
    test(`falha → aviso sem Manutenção; Tentar de novo → Manutenção com o contrato; controle sem aviso (${w})`, async ({ browser }) => {
      const p = await entrar(browser, morador.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      const assunto = p.locator("label", { hasText: "Assunto" }).locator("select");
      const aviso = p.getByTestId("contratos-indisponiveis");

      await falharContratos(p);
      await p.goto("/ajuda/fale-com-a-viva?novo=1", { waitUntil: "domcontentloaded" });
      await expect(aviso).toBeVisible({ timeout: 30_000 });
      await expect(aviso).toContainText(AVISO);
      await expect(assunto.locator("option", { hasText: MANUTENCAO })).toHaveCount(0);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

      await p.unrouteAll({ behavior: "wait" });
      await aviso.getByRole("button", { name: "Tentar de novo" }).click();
      await expect(aviso).toHaveCount(0, { timeout: 30_000 });
      await expect(assunto.locator("option", { hasText: MANUTENCAO })).toHaveCount(1);
      const valor = await assunto.locator("option", { hasText: MANUTENCAO }).getAttribute("value");
      await assunto.selectOption(valor!);
      await expect(p.locator("select option", { hasText: TITULO })).toHaveCount(1);

      await p.goto("/ajuda/fale-com-a-viva?novo=1", { waitUntil: "domcontentloaded" });
      await expect(assunto.locator("option", { hasText: MANUTENCAO })).toHaveCount(1, { timeout: 30_000 });
      await expect(aviso).toHaveCount(0);
      await p.context().close();
    });
  }
});
