import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, lerMassa, temContaVarredura, type ChaveConta, type Massa } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T307 — VARREDURA DA PÁGINA INTEIRA, BLOCO 8 (Pista C, 23/10). O mesmo protocolo da t298 (seis classes, página toda
  rolada, 390 e 1280 px, carregamento real de cada imagem) no que ainda faltava:
  - as páginas internas dos sócios (/socios, /decisao, /modelodenegocio, /roi, /simulacao, /tributario), abertas pela
    porta /acesso-socios com o código do laboratório (SOCIOS_ACCESS_CODE; sem ele, pula);
  - as telas de detalhe com os ids da massa: o contrato visto pelos dois lados, a "Estadia confirmada" do 61-A (#1113,
    o contrato da massa é assinado pelos dois) e o perfil público do dono.
  Só no laboratório.
  Rodadas fora do lab completo (teto L-5): no lab-crítico do PR que toca a spec; última, 23/10 com o bloco 11 (t329).
*/
type Conta = ChaveConta | "ADMIN" | "VISITANTE" | "SOCIO";
interface Tela {
  conta: Conta;
  papel: string;
  rota: (m: Massa) => string;
  nome: string;
}
const CODIGO_SOCIOS = process.env.SOCIOS_ACCESS_CODE;
const TELAS: Tela[] = [
  { conta: "SOCIO", papel: "sócio", rota: () => "/socios", nome: "Início dos sócios" },
  { conta: "SOCIO", papel: "sócio", rota: () => "/decisao", nome: "Decisão" },
  { conta: "SOCIO", papel: "sócio", rota: () => "/modelodenegocio", nome: "Modelo de negócio" },
  { conta: "SOCIO", papel: "sócio", rota: () => "/roi", nome: "Retorno" },
  { conta: "SOCIO", papel: "sócio", rota: () => "/simulacao", nome: "Simulação" },
  { conta: "SOCIO", papel: "sócio", rota: () => "/tributario", nome: "Tributário" },
  { conta: "INQUILINA", papel: "morador", rota: (m) => `/dashboard/contratos/${m.contrato}`, nome: "Contrato (contrato completo)" },
  { conta: "DONO17", papel: "proprietário", rota: (m) => `/dashboard/contratos/${m.contrato}`, nome: "Contrato (contrato completo)" },
  { conta: "INQUILINA", papel: "morador", rota: (m) => `/dashboard/estadia/${m.contrato}/confirmada`, nome: "Estadia confirmada" },
  { conta: "VISITANTE", papel: "visitante", rota: (m) => `/proprietario/${m.ids.DONO17}`, nome: "Perfil público do proprietário" },
];

const MASSA = lerMassa();
const SAIDA = "tests/laboratorio/saida/varredura-bloco8";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

test.describe("T307 — varredura da página inteira, bloco 8 (sócios e telas de detalhe) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (contas da massa da varredura)");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
    expect(MASSA, "laboratório sem a massa da varredura (scripts/lab/massa-varredura.mjs)").not.toBeNull();
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      test.skip(t.conta !== "ADMIN" && t.conta !== "VISITANTE" && t.conta !== "SOCIO" && !temContaVarredura(t.conta), `sem a conta ${t.conta} na massa`);
      test.skip(t.conta === "SOCIO" && !CODIGO_SOCIOS, "SOCIOS_ACCESS_CODE não definido neste ambiente");
      const rota = t.rota(MASSA!);
      const relatorio: Record<string, Record<string, string[]>> = {};
      for (const tam of TAMANHOS) {
        let page: Page;
        if (t.conta === "VISITANTE" || t.conta === "SOCIO") {
          const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: tam.width, height: tam.height } });
          page = await ctx.newPage();
          if (t.conta === "SOCIO") {
            // A porta única dos sócios: o código grava o cookie vn_socios e devolve para a página pedida (como na t200).
            await page.goto(`/acesso-socios?next=${encodeURIComponent(rota)}`, { waitUntil: "domcontentloaded", timeout: 40_000 });
            await page.locator('input[name="codigo"]').fill(CODIGO_SOCIOS!);
            await page.getByRole("button", { name: "Entrar" }).click();
            await page.waitForURL((u) => u.pathname === rota, { timeout: 30_000 });
          }
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
