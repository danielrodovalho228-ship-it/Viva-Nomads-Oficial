// Rodada 19 da vigia (Pista C, 25/10, lote A): varredura completa na main com o PROP-1 (#1337), a 390 e 1280 px.
import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, lerMassa, temContaVarredura, type ChaveConta, type Massa } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T338 — VARREDURA DA PÁGINA INTEIRA, BLOCO 15 (Pista C, 24/10). O mesmo protocolo da t306 (seis classes, página
  toda rolada, 390 e 1280 px, carregamento real de cada imagem) nas telas que os merges da madrugada de 24/10 mudaram:
  o perfil público do proprietário e os interessados do dono, com as telas do LinkedIn do 63-A (#1189); o cadastro do
  anúncio, que ganhou o calendário na etapa do preço (E44, #1210); e /precos, com a taxa do E51 a E54 (#1208).
  Toda tela do bloco precisa responder HTTP abaixo de 400. Só no laboratório.
*/
type Conta = ChaveConta | "ADMIN" | "VISITANTE";
interface Tela {
  conta: Conta;
  papel: string;
  rota: (m: Massa) => string;
  nome: string;
}
const TELAS: Tela[] = [
  // Públicas primeiro.
  { conta: "VISITANTE", papel: "visitante", rota: (m) => `/proprietario/${m.ids.DONO17}`, nome: "Perfil público do proprietário (63-A)" },
  { conta: "VISITANTE", papel: "visitante", rota: () => "/precos", nome: "Preços (taxa E51 a E54)" },
  // Logadas.
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard/leads", nome: "Interessados (63-A)" },
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard/imoveis/novo", nome: "Cadastro do anúncio (calendário do E44)" },
];

const MASSA = lerMassa();
const SAIDA = "tests/laboratorio/saida/varredura-bloco15";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

test.describe("T338 — varredura da página inteira, bloco 15 (63-A, E44 e taxa) (390 e 1280 px)", () => {
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
