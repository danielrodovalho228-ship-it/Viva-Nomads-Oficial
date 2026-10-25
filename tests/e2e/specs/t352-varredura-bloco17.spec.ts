// Rodada 19 da vigia (Pista C, 25/10, lote A): varredura completa na main com o PROP-1 (#1337), a 390 e 1280 px.
import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, lerMassa, temContaVarredura, type ChaveConta, type Massa } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T352 — VARREDURA DA PÁGINA INTEIRA, BLOCO 17 (Pista C, 24/10). O mesmo protocolo da t306 (seis classes: imagem
  vazia ou quebrada, elemento fixo por cima, estouro horizontal, texto cortado, grade desalinhada e carregamento real de
  cada imagem; página toda rolada, 390 e 1280 px). Cobre o que ainda não tinha varredura de página inteira (painel do
  dono e da moradora, imóveis e contratos do dono, Conta da moradora, admin: visão geral, imóveis e usuários) e o que os
  merges da madrugada de 24/10 mudaram: avaliações recebidas (#1219), a entrada do cadastro (E50, #1218) e, nas
  públicas, a home e a /buscar depois do FILTROS-1/2 (onde mora a L-48). Toda tela precisa responder HTTP abaixo de
  400. Só no laboratório.
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
  { conta: "VISITANTE", papel: "visitante", rota: () => "/", nome: "Home" },
  { conta: "VISITANTE", papel: "visitante", rota: () => "/buscar", nome: "Buscar (FILTROS-1/2)" },
  // Logadas.
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard", nome: "Painel do dono" },
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard/imoveis", nome: "Meus imóveis" },
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard/contratos", nome: "Contratos" },
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard/avaliacoes", nome: "Avaliações recebidas (#1219)" },
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard/imoveis/novo", nome: "Entrada do cadastro (E50)" },
  { conta: "INQUILINA", papel: "inquilina", rota: () => "/dashboard", nome: "Painel da moradora" },
  { conta: "INQUILINA", papel: "inquilina", rota: () => "/dashboard/conta", nome: "Conta (CONTA-A)" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin", nome: "Visão geral" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/imoveis", nome: "Imóveis" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/usuarios", nome: "Usuários" },
];

const MASSA = lerMassa();
const SAIDA = "tests/laboratorio/saida/varredura-bloco17";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

test.describe("T352 — varredura da página inteira, bloco 17 (painéis, admin e merges de 24/10) (390 e 1280 px)", () => {
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
