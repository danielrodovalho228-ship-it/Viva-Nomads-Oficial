import { test, expect, type Locator } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1113 — E561 (#2493, 04/11): em /admin/imoveis o estado do documento é o VIGENTE, a mesma fonte do dono
 * (statusPorImovel: a aprovada mais recente vale; um envio novo pendente não a rebaixa). Antes valia a 1ª linha que o
 * banco devolvia, sem ordem, e uma recusa antiga aparecia por cima do aprovado (o rascunho 4a693a63: o admin dizia
 * "Recusado" e o dono via o aprovado). Pela tela do admin, 390 e 1280, um dono de teste com dois imóveis:
 *   A. recusa antiga (15 dias) + aprovado novo → "documento: Aprovado", nunca "Recusado";
 *   B. aprovado + um envio novo pendente → "documento: Aprovado" (o vigente segue), e é o ÚNICO que o filtro
 *      "Documento em revisão" acha (o campo próprio documentoEmRevisao) — o A não entra.
 * As regras ficam com o e561-documento-admin.test.ts e o vigente.test.ts.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const NOME = `Vigente${sufixo}`;
const dono = { email: `dono.t1113.${sufixo}@lab.vivanomads.test`, nome: `${NOME} Documento Reis`, role: "owner" as const };
const T = { a: `Casa da recusa antiga ${sufixo}`, b: `Loft com envio novo ${sufixo}` };
const ids: Record<string, string> = {};
const dias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

function linha(lista: Locator, titulo: string): Locator {
  return lista.getByTestId("imovel-linha").filter({ hasText: titulo });
}

test.describe("T1113 — E561: o admin mostra o documento vigente (o mesmo do dono)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    // Os dois imóveis nascem com um documento aprovado (criarImovelPronto), gravado agora.
    ids.a = await criarImovelPronto(ids.dono, T.a);
    ids.b = await criarImovelPronto(ids.dono, T.b);
    const { error } = await adm()
      .from("qualification_checklists")
      .insert([
        // A: uma recusa ANTIGA, anterior ao aprovado (o caso do 4a693a63).
        { owner_id: ids.dono, property_id: ids.a, document_status: "rejected", document_review_reason: "Documento ilegível (envio antigo).", created_at: dias(-15), document_reviewed_at: dias(-15) },
        // B: um envio NOVO, ainda em revisão, depois do aprovado.
        { owner_id: ids.dono, property_id: ids.b, document_status: "pending", created_at: dias(0.001), document_uploaded_at: dias(0.001) },
      ]);
    expect(error, error?.message).toBeNull();
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`recusa antiga não cobre o aprovado; envio novo em revisão não rebaixa e só ele entra no filtro (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      try {
        await page.goto(`/admin/imoveis?dono=${encodeURIComponent(NOME)}`, { waitUntil: "domcontentloaded" });
        const lista = page.getByTestId("admin-imoveis");
        await expect(lista.getByTestId("lista-total")).toHaveText("2", { timeout: 30_000 });
        for (const t of [T.a, T.b]) {
          await expect(linha(lista, t)).toContainText("documento: Aprovado");
          await expect(linha(lista, t)).not.toContainText("documento: Recusado");
          await expect(linha(lista, t)).not.toContainText("documento: Em revisão");
        }

        // Filtro "Documento em revisão": só o B (o envio pendente), não o A.
        await page.goto(`/admin/imoveis?dono=${encodeURIComponent(NOME)}&documento=revisao`, { waitUntil: "domcontentloaded" });
        await expect(lista.getByTestId("lista-total")).toHaveText("1", { timeout: 30_000 });
        await expect(linha(lista, T.b)).toBeVisible();
        await expect(linha(lista, T.a)).toHaveCount(0);

        const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(sobra).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
