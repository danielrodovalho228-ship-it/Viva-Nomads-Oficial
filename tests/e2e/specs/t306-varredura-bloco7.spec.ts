import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, lerMassa, temContaVarredura, type ChaveConta, type Massa } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T306 — VARREDURA DA PÁGINA INTEIRA, BLOCO 7 (Pista C, 23/10). O mesmo protocolo da t274 e da t298 (seis classes,
  página toda rolada, 390 e 1280 px, carregamento real de cada imagem) em telas que nenhuma varredura cobria:
  - de visitante (sem sessão): entrar, recuperar senha, a porta dos sócios, excluir conta, conferir contrato, desligar
    alerta de busca e as boas-vindas do app;
  - as telas novas do Prompt 62-B1 (#1111): a rede de avaliadores no admin e o credenciamento do parceiro.
  As páginas internas dos sócios (/socios, /roi…) ficam de fora: pedem o cookie do código e a /acesso-socios é a porta.
  Só no laboratório.
  Rodadas fora do lab completo (teto L-5): no lab-crítico do PR que toca a spec; últimas, 23/10 com o bloco 11 (t329) e 23/10 à tarde, depois dos #1170 a #1173.
*/
type Conta = ChaveConta | "ADMIN" | "VISITANTE";
interface Tela {
  conta: Conta;
  papel: string;
  rota: (m: Massa) => string;
  nome: string;
}
const TELAS: Tela[] = [
  { conta: "VISITANTE", papel: "visitante", rota: () => "/auth", nome: "Entrar" },
  { conta: "VISITANTE", papel: "visitante", rota: () => "/auth/reset", nome: "Recuperar senha" },
  { conta: "VISITANTE", papel: "visitante", rota: () => "/acesso-socios", nome: "Porta dos sócios" },
  { conta: "VISITANTE", papel: "visitante", rota: () => "/excluir-conta", nome: "Excluir conta" },
  { conta: "VISITANTE", papel: "visitante", rota: () => "/conferir", nome: "Conferir contrato" },
  { conta: "VISITANTE", papel: "visitante", rota: () => "/alerta-busca/desligar", nome: "Desligar alerta de busca" },
  { conta: "VISITANTE", papel: "visitante", rota: () => "/app/boas-vindas", nome: "Boas-vindas do app" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/avaliadores", nome: "Avaliadores credenciados" },
  { conta: "PARCEIRO", papel: "parceiro", rota: () => "/dashboard/parceiro/avaliacao", nome: "Credenciamento de avaliador" },
];

const MASSA = lerMassa();
const SAIDA = "tests/laboratorio/saida/varredura-bloco7";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

test.describe("T306 — varredura da página inteira, bloco 7 (visitante e telas do 62-B1) (390 e 1280 px)", () => {
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
