import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";
import { prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T2123 — E614 @E614: o "N% pronto" do assistente anda com o que o dono faz.
  Regra decidida (E614; unitário e614-percentual.test.ts): o preço sugerido, a garantia e o período padrão NÃO contam no
  número só por estarem preenchidos. Contam quando o dono os confirma: o "Continuar" do Passo 8 confirma o preço e a
  garantia, e eles ficam gravados no rascunho (draft_data.confirmados).
  Rascunho com preço, caução e período preenchidos, ainda sem nada confirmado:
    1. no Passo 8, o "N% pronto" é P0, e reabrir o passo não muda o número (entrar não conta como fazer);
    2. o "Continuar" leva ao Passo 9 com P1 > P0, e o rascunho grava "preco" e "garantia" como confirmados;
    3. reaberto o Passo 8, o número segue P1 (vem do rascunho, não da tela).
  390 e 1280 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2123.${sufixo}@lab.vivanomads.test`, nome: "Paulo Percentual", role: "owner" as const };
const ids: Record<string, string> = {};
const DADOS = {
  propertyType: "apartamento", bedrooms: "2", bathrooms: "1", areaM2: "58", neighborhood: "Santa Mônica",
  minPeriod: "30", monthlyPrice: "3200", garantias: { caucao_avista: true, caucao_parcelada: false, seguro_fianca: false },
  confirmados: [],
};

async function pronto(page: Page): Promise<number> {
  const detalhe = page.getByTestId("passo-detalhe");
  await expect(detalhe).toHaveText(/^\d+% pronto$/, { timeout: 20_000 });
  return parseInt((await detalhe.textContent()) ?? "", 10);
}

async function abrir(page: Page, id: string, passo: "preco" | "disponibilidade") {
  await page.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=${passo}`, { waitUntil: "domcontentloaded" });
  await noPasso(page, passo, 30_000);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

test.describe("T2123 — E614: o N% pronto sobe quando o dono confirma, não ao entrar no passo @E614", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — Passo 8: entrar não muda o número; Continuar confirma preço e garantia e o número sobe`, async ({ browser }) => {
      const id = await prepararRascunho(ids.dono, `Rascunho T2123 ${largura} ${sufixo}`, DADOS, 8);
      const contexto = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await entrarNaPagina(await contexto.newPage(), dono.email, senha);

      // 1. entrar no Passo 8 (duas vezes) não muda o número
      await abrir(page, id, "preco");
      const p0 = await pronto(page);
      await abrir(page, id, "preco");
      expect(await pronto(page), "reabrir o Passo 8 sem fazer nada não mexe no número").toBe(p0);

      // 2. Continuar confirma preço e garantia: o número sobe e o rascunho grava a confirmação
      await page.getByTestId("cadastro-continuar").click();
      await noPasso(page, "disponibilidade", 30_000);
      const p1 = await pronto(page);
      expect(p1, `Continuar no Passo 8 faz o número subir (${p0}% → ${p1}%)`).toBeGreaterThan(p0);
      await expect
        .poll(async () => {
          const { data } = await adm().from("properties").select("draft_data").eq("id", id).single();
          return ((data?.draft_data as { confirmados?: string[] } | null)?.confirmados ?? []).slice().sort().join(",");
        }, { timeout: 15_000, message: "o rascunho grava preco e garantia como confirmados" })
        .toContain("garantia,preco");

      // 3. reaberto o Passo 8, o número vem do rascunho
      await abrir(page, id, "preco");
      expect(await pronto(page), "reaberto, o Passo 8 mostra o número já confirmado").toBe(p1);

      await contexto.close();
      await adm().from("properties").delete().eq("id", id);
    });
  }
});
