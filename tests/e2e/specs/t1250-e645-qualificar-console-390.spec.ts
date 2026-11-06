import { test, expect } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, escutarErros, lerMassa, temContaVarredura, type ChaveConta } from "../fixtures/varredura";

/*
  T1250 — E645: "erro de console reproduzível em /qualificar como dono a 390 px". Triagem pelo CI (o ambiente de trabalho da Pista B
  não tem Docker nem sessão de dono para reproduzir). Nenhuma spec varria `/qualificar` SEM parâmetro com a régua de console:
  o bloco 355 (t1242) visita `/qualificar?imovel=<id>` (anúncio publicado → editor) e a t249 visita o cadastro com `?draft=`.
  `/qualificar` puro só redireciona para o início do cadastro (destinoQualificarSemImovel), que é o que o dono abre pelo link
  antigo. Esta spec abre exatamente essa rota, como dono, a 390 e a 1280 px, e imprime cada erro de console ou de página na
  linha `VARREDURA|console|<tamanho>|dono|/qualificar|…` (o mesmo formato do relatório da Pista C), para o log do CI trazer a
  mensagem real. Sem erro, a spec passa e fica como prova permanente de que o console está limpo; com erro, o log tem o texto
  e a correção é feita em cima dele (nada de correção às cegas).
  Roda: npx playwright test t1250 (no laboratório, com a massa da varredura).
*/
const CONTAS: { conta: ChaveConta; papel: string }[] = [
  { conta: "DONO17", papel: "dono com imóveis e rascunho" },
  { conta: "DONO0", papel: "dono com rascunho sem fotos" },
];

test.describe("T1250 — E645: /qualificar (sem parâmetro) como dono, console limpo (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (contas da massa da varredura)");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
    expect(lerMassa(), "laboratório sem a massa da varredura (scripts/lab/massa-varredura.mjs)").not.toBeNull();
  });

  for (const { conta, papel } of CONTAS) {
    test(`${papel}: /qualificar redireciona ao início do cadastro sem erro de console`, async ({ browser }) => {
      test.setTimeout(120_000);
      test.skip(!temContaVarredura(conta), `sem a conta ${conta} na massa`);
      for (const tam of TAMANHOS) {
        const { context, page } = await abrirComoConta(browser, conta, tam.nome);
        try {
          const erros = escutarErros(page);
          const resposta = await page.goto("/qualificar", { waitUntil: "domcontentloaded", timeout: 40_000 });
          expect(resposta?.status() ?? 0, `${papel} @${tam.nome}: HTTP`).toBeLessThan(400);
          // O destino é o início do cadastro (E132-A item 10); com rascunho em andamento ele oferece retomar.
          await page.waitForURL((u) => u.pathname.startsWith("/dashboard/imoveis/novo"), { timeout: 30_000 });
          await page.locator("main").first().waitFor({ timeout: 20_000 }).catch(() => {});
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
          const lista = erros.lista();
          for (const a of lista) console.log(`VARREDURA|console|${tam.nome}|dono|/qualificar|${a}`);
          expect.soft(lista, `${papel} @${tam.nome}: erro de console ou de página em /qualificar → ${page.url()}`).toEqual([]);
        } finally {
          await context.close();
        }
      }
    });
  }
});
