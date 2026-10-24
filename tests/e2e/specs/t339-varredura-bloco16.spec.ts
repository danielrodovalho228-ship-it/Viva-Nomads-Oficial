import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, lerMassa, temContaVarredura, type ChaveConta, type Massa } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T339 — VARREDURA DA PÁGINA INTEIRA, BLOCO 16 (Pista C, 24/10). O mesmo protocolo da t306 (seis classes, página
  toda rolada, 390 e 1280 px, carregamento real de cada imagem) nas telas logadas que nenhuma spec de página inteira
  cobria (conferido contra o tests/e2e/cobertura.json e as specs que usam fixtures/varredura-pagina): cinco do morador
  (buscas salvas, favoritos, carteira, ferramentas, solicitações) e três do admin (financeiro, parceiros, atendimento).
  As públicas já estão todas varridas; as que sobram redirecionam (/auth/intencao, /avaliadores) ou pedem um avaliador
  credenciado na massa (/avaliadores/[numero]). Toda tela precisa responder HTTP abaixo de 400. Só no laboratório.
*/
type Conta = ChaveConta | "ADMIN" | "VISITANTE";
interface Tela {
  conta: Conta;
  papel: string;
  rota: (m: Massa) => string;
  nome: string;
}
const TELAS: Tela[] = [
  { conta: "INQUILINA", papel: "inquilina", rota: () => "/dashboard/buscas", nome: "Buscas salvas" },
  { conta: "INQUILINA", papel: "inquilina", rota: () => "/dashboard/favoritos", nome: "Favoritos" },
  { conta: "INQUILINA", papel: "inquilina", rota: () => "/dashboard/carteira", nome: "Carteira" },
  { conta: "INQUILINA", papel: "inquilina", rota: () => "/dashboard/ferramentas", nome: "Ferramentas" },
  { conta: "INQUILINA", papel: "inquilina", rota: () => "/dashboard/solicitacoes", nome: "Solicitações" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/financeiro", nome: "Financeiro" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/parceiros", nome: "Parceiros" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/atendimento", nome: "Atendimento" },
];

const MASSA = lerMassa();
const SAIDA = "tests/laboratorio/saida/varredura-bloco16";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

test.describe("T339 — varredura da página inteira, bloco 16 (telas logadas sem varredura) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (contas da massa da varredura)");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
    expect(MASSA, "laboratório sem a massa da varredura (scripts/lab/massa-varredura.mjs)").not.toBeNull();
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      test.skip(t.conta !== "ADMIN" && t.conta !== "VISITANTE" && !temContaVarredura(t.conta), `sem a conta ${t.conta} na massa`);
      const rota = t.rota(MASSA!);
      const relatorio: Record<string, Record<string, string[]>> = {};
      for (const tam of TAMANHOS) {
        let page: Page;
        if (t.conta === "VISITANTE") {
          const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: tam.width, height: tam.height } });
          page = await ctx.newPage();
        } else if (t.conta === "ADMIN") {
          const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: tam.width, height: tam.height } });
          page = await ctx.newPage();
        } else {
          page = (await abrirComoConta(browser, t.conta, tam.nome)).page;
        }
        try {
          const respostas = escutarImagens(page);
          const resposta = await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 40_000 });
          expect(resposta?.status() ?? 0, `${t.papel} — ${t.nome} @${tam.nome}: HTTP`).toBeLessThan(400);
          expect(new URL(page.url()).pathname, `${t.papel} — ${t.nome} @${tam.nome}: caiu fora da tela (login ou redirecionamento)`).toBe(rota.split(/[?#]/)[0]);
          await page.locator("main").first().waitFor({ timeout: 20_000 }).catch(() => {});
          const achados = await varrerPagina(page, respostas);
          relatorio[tam.nome] = achados;
          for (const classe of Object.keys(CLASSES) as Classe[]) {
            await test.step(`${classe} @${tam.nome}`, async () => {
              for (const a of achados[classe]) console.log(`VARREDURA|${classe}|${tam.nome}|${t.papel}|${rota.replace(/[0-9a-f-]{36}/g, ":id")}|${a}`);
              expect.soft(achados[classe], `${t.papel} — ${t.nome} @${tam.nome} — ${classe}: ${CLASSES[classe]}`).toEqual([]);
            });
          }
        } finally {
          await page.context().close();
        }
      }
      mkdirSync(SAIDA, { recursive: true });
      writeFileSync(`${SAIDA}/${slug(`${t.papel}-${t.nome}`)}.json`, JSON.stringify({ papel: t.papel, tela: t.nome, achados: relatorio }, null, 2));
    });
  }
});
