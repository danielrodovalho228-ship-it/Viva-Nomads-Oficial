import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, lerMassa, temContaVarredura, type ChaveConta, type Massa } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T298 — VARREDURA DA PÁGINA INTEIRA, BLOCO 4 das telas logadas (Pista C, 23/10). O mesmo protocolo da t274, t279 e t297
  (seis classes, página toda rolada, 390 e 1280 px, carregamento real de cada imagem) nas telas que nenhuma varredura
  cobria: as Ferramentas e telas de negócio do proprietário (agenda, orçamentos, pedidos da cidade, interessados,
  tributação, viabilidade, retorno, indicações, serviços) e as propostas e serviços da inquilina. Fica à parte da t297
  pelo mesmo motivo (teto de tempo do laboratório). Só no laboratório.
*/
type Conta = ChaveConta | "ADMIN";
interface Tela {
  conta: Conta;
  papel: string;
  rota: (m: Massa) => string;
  nome: string;
}
const TELAS: Tela[] = [
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard/agenda", nome: "Agenda" },
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard/orcamentos", nome: "Orçamentos" },
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard/pedidos-cidade", nome: "Pedidos de moradia da cidade" },
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard/leads", nome: "Interessados" },
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard/tributacao", nome: "Tributação" },
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard/viabilidade", nome: "Viabilidade" },
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard/roi-imovel", nome: "Retorno do imóvel" },
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard/indicacoes", nome: "Indicações" },
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard/servicos", nome: "Serviços" },
  { conta: "INQUILINA", papel: "morador", rota: () => "/dashboard/propostas", nome: "Propostas" },
  { conta: "INQUILINA", papel: "morador", rota: () => "/dashboard/servicos", nome: "Serviços" },
];

const MASSA = lerMassa();
const SAIDA = "tests/laboratorio/saida/varredura-logada-bloco4";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

test.describe("T298 — varredura da página inteira, bloco 4 das telas logadas (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (contas da massa da varredura)");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
    expect(MASSA, "laboratório sem a massa da varredura (scripts/lab/massa-varredura.mjs)").not.toBeNull();
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      test.skip(t.conta !== "ADMIN" && !temContaVarredura(t.conta), `sem a conta ${t.conta} na massa`);
      const rota = t.rota(MASSA!);
      const relatorio: Record<string, Record<string, string[]>> = {};
      for (const tam of TAMANHOS) {
        let page: Page;
        if (t.conta === "ADMIN") {
          const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: tam.width, height: tam.height } });
          page = await ctx.newPage();
        } else {
          page = (await abrirComoConta(browser, t.conta, tam.nome)).page;
        }
        try {
          const respostas = escutarImagens(page);
          await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 40_000 });
          expect(new URL(page.url()).pathname, `${t.papel} — ${t.nome} @${tam.nome}: caiu fora da tela (login ou redirecionamento)`).toBe(rota.split("?")[0]);
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
