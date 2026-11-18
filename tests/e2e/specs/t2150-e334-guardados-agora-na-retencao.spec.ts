import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm } from "../fixtures/laboratorio";

/*
  T2150 — E334 @E334: em Admin → Retenção, a coluna "Guardados agora" é a contagem de AGORA, não o retrato da rodada.
  Regra decidida (E334; unitário src/lib/admin/contagens.test.ts): "Guardados" usa a mesma contagem da caixa de e-mails de
  teste (contarGuardados), lida no momento em que a página abre. Antes mostrava o número gravado pela rodada das 10h, que
  ficava para trás (188 na Retenção × 190 na caixa).
  A prova: a rodada de hoje (eliminacoes_simulado, dia de Brasília) passa a dizer que a tabela emails_teste guarda um número
  impossível (987.654). A linha "emails_teste" da tela tem de mostrar a contagem real da tabela, lida pela chave de serviço
  antes e depois de abrir a página (outras specs gravam e apagam e-mails de teste em paralelo: o número da tela tem de
  estar entre as duas leituras). No fim, a linha da rodada volta ao que era (ou sai, se não existia). 390 e 1280 px.
*/
const VELHO = 987_654;
const ITEM = "emails_teste";
const hojeBRT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
type Linha = { dia: string; item: string; guardados: number | null; vencidos: number; vencidos_teste: number; real: boolean; prazo: string; base: string; gerado_em: string };
let original: Linha | null = null;
let dia = "";

const contar = async () => {
  const { count, error } = await adm().from(ITEM).select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
};
const semear = async () => {
  const { error } = await adm()
    .from("eliminacoes_simulado")
    .upsert({ dia, item: ITEM, guardados: VELHO, vencidos: 0, vencidos_teste: 0, real: false, prazo: original?.prazo ?? "sem prazo", base: original?.base ?? "pendente" }, { onConflict: "dia,item" });
  if (error) throw error;
};

test.describe("T2150 — E334: 'Guardados agora' na Retenção é a contagem de agora, não a da rodada @E334", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (chave de serviço e admin com 2FA).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ storageState: authFile("admin") });

  test.beforeAll(async () => {
    dia = hojeBRT();
    const { data } = await adm().from("eliminacoes_simulado").select("*").eq("dia", dia).eq("item", ITEM).maybeSingle();
    original = (data as Linha | null) ?? null;
  });

  test.afterAll(async () => {
    if (original) await adm().from("eliminacoes_simulado").upsert(original, { onConflict: "dia,item" });
    else await adm().from("eliminacoes_simulado").delete().eq("dia", dia).eq("item", ITEM).eq("guardados", VELHO);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — a linha emails_teste mostra a contagem real da tabela, não os ${VELHO.toLocaleString("pt-BR")} da rodada`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      // A rotina de automações (2.º servidor de outras specs) pode regravar a rodada de hoje: semeia-se de novo em cada volta.
      await expect
        .poll(
          async () => {
            await semear();
            const antes = await contar();
            await page.goto("/admin/retencao", { waitUntil: "domcontentloaded" });
            const celula = page.locator(`[data-testid="retencao-relatorio"] tr[data-item="${ITEM}"] td`).nth(1);
            await expect(celula, "a linha emails_teste está na rodada de hoje").toBeVisible({ timeout: 30_000 });
            const texto = (await celula.innerText()).trim();
            const depois = await contar();
            const mostrado = Number(texto.replace(/\./g, ""));
            return { velho: mostrado === VELHO, dentro: mostrado >= Math.min(antes, depois) && mostrado <= Math.max(antes, depois), texto, antes, depois };
          },
          { timeout: 90_000, intervals: [1_000, 2_000, 5_000], message: "Guardados agora = a contagem real de emails_teste (entre a leitura de antes e a de depois)" },
        )
        .toMatchObject({ velho: false, dentro: true });
    });
  }
});
