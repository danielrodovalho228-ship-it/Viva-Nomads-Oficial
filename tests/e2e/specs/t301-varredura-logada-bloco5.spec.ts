// Rodada 19 da vigia (Pista C, 25/10, lote A): varredura completa na main com o PROP-1 (#1337), a 390 e 1280 px.
import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, lerMassa, temContaVarredura, type ChaveConta, type Massa } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T301 — VARREDURA DA PÁGINA INTEIRA, BLOCO 5 das telas logadas (Pista C, 23/10). O mesmo protocolo da t274, t279, t297
  e t298 (seis classes, página toda rolada, 390 e 1280 px, carregamento real de cada imagem) nas telas do admin que
  nenhuma varredura cobria: agentes, ajuda na publicação, avaliações, cidades, fotógrafos, marketing, pedidos, Caixa dos
  Sócios, serviços, eventos, pedidos de parceiros, encerramentos, destinos e retenção (só abre e rola; nenhum clique).
  Fica à parte das outras pelo teto de tempo do laboratório. Só no laboratório.
  Rodadas fora do lab completo (teto L-5): no lab-crítico do PR que toca a spec; últimas, 23/10 com o bloco 11 (t329) e 23/10 à tarde, depois dos #1170 a #1173.
*/
type Conta = ChaveConta | "ADMIN";
interface Tela {
  conta: Conta;
  papel: string;
  rota: (m: Massa) => string;
  nome: string;
}
const TELAS: Tela[] = [
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/agentes", nome: "Agentes" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/ajuda-publicacao", nome: "Ajuda na publicação" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/avaliacoes", nome: "Avaliações" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/cidades", nome: "Cidades" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/fotografos", nome: "Fotógrafos" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/marketing", nome: "Marketing" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/pedidos", nome: "Pedidos de moradia" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/socios", nome: "Caixa dos Sócios" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/servicos", nome: "Serviços" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/eventos", nome: "Eventos" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/parceiros/pedidos", nome: "Pedidos de parceiros" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/contratos/encerramentos", nome: "Encerramentos de contrato" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/destinos", nome: "Destinos" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/retencao", nome: "Retenção" },
];

const MASSA = lerMassa();
const SAIDA = "tests/laboratorio/saida/varredura-logada-bloco5";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

test.describe("T301 — varredura da página inteira, bloco 5 das telas logadas (390 e 1280 px)", () => {
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
