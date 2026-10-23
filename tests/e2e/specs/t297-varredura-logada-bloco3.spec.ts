import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, lerMassa, temContaVarredura, type ChaveConta, type Massa } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T297 — VARREDURA DA PÁGINA INTEIRA, BLOCO 3 das telas logadas (Pista C, 23/10). O mesmo protocolo da t274 e da t279
  (seis classes, página toda rolada, 390 e 1280 px, carregamento real de cada imagem) nas telas que nenhuma varredura
  cobria: as telas do anúncio que o Prompt 59 trouxe (padrão mínimo, nível, cartão, parceiros), segurança e verificação
  da conta, candidaturas e avisos da inquilina e as filas do admin ligadas ao Prompt 59 (só abre e rola; nenhum clique).
  Fica numa spec à parte da t279 para não alongar uma só spec no teto de tempo do laboratório. Só no laboratório.
*/
type Conta = ChaveConta | "ADMIN";
interface Tela {
  conta: Conta;
  papel: string;
  rota: (m: Massa) => string;
  nome: string;
}
const TELAS: Tela[] = [
  { conta: "DONO17", papel: "proprietário", rota: (m) => `/dashboard/imoveis/${m.imovel17}/conforto`, nome: "Padrão mínimo do anúncio" },
  { conta: "DONO17", papel: "proprietário", rota: (m) => `/dashboard/imoveis/${m.imovel17}/nivel`, nome: "Nível do anúncio" },
  { conta: "DONO17", papel: "proprietário", rota: (m) => `/dashboard/imoveis/${m.imovel17}/cartao`, nome: "Cartão do anúncio" },
  { conta: "DONO17", papel: "proprietário", rota: (m) => `/dashboard/imoveis/${m.imovel17}/parceiros`, nome: "Parceiros do anúncio" },
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard/visitas", nome: "Visitas" },
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard/verificacao", nome: "Verificação" },
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard/conta/seguranca", nome: "Conta · segurança" },
  { conta: "INQUILINA", papel: "morador", rota: () => "/dashboard/candidaturas", nome: "Candidaturas" },
  { conta: "INQUILINA", papel: "morador", rota: () => "/dashboard/notificacoes", nome: "Avisos" },
  { conta: "INQUILINA", papel: "morador", rota: () => "/dashboard/conta/seguranca", nome: "Conta · segurança" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/conforto", nome: "Padrão mínimo" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/pendencias", nome: "Pendências" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/candidaturas", nome: "Candidaturas" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/solicitacoes", nome: "Solicitações" },
];

const MASSA = lerMassa();
const SAIDA = "tests/laboratorio/saida/varredura-logada-bloco3";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

test.describe("T297 — varredura da página inteira, bloco 3 das telas logadas (390 e 1280 px)", () => {
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
