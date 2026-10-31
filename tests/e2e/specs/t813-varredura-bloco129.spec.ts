import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";
import { TAMANHOS, abrirComoConta, escutarErros, lerMassa, temContaVarredura, type ChaveConta, type Massa } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T813 — VARREDURA DA PÁGINA INTEIRA, BLOCO 129 (Pista C, 31/10), 4ª volta do ciclo. O protocolo do bloco 21 (t385):
  seis classes (imagem pelo carregamento real, elemento fixo sobre conteúdo, cartão sem foto, estouro horizontal, texto
  cortado, grade), página toda rolada, 390 e 1280 px, HTTP abaixo de 400; e o console (erro de console ou de página,
  régua da t249) no relatório. As telas varridas há mais tempo depois do bloco 128 (registro de cobertura: última
  varredura no bloco 115, t796): serviços e visitas do morador, visitas do proprietário, a visão geral, os eventos e o
  funil do admin, e as páginas públicas de parceiros (início, ativar, avaliadores, fotógrafos). Contas da massa da
  varredura e a sessão de admin do laboratório. Defeito novo entra como test.fail ligado a um item (L-84 / D-V11 são os
  próximos livres).
*/
type Conta = ChaveConta | "VISITANTE" | "SOCIO" | "ADMIN";
interface Tela {
  conta: Conta;
  papel: string;
  nome: string;
  rota: (m: Massa) => string;
}

const TELAS: Tela[] = [
  { conta: "INQUILINA", papel: "morador", nome: "Serviços", rota: () => "/dashboard/servicos" },
  { conta: "INQUILINA", papel: "morador", nome: "Visitas", rota: () => "/dashboard/visitas" },
  { conta: "DONO17", papel: "proprietário", nome: "Visitas", rota: () => "/dashboard/visitas" },
  { conta: "ADMIN", papel: "admin", nome: "Visão geral", rota: () => "/admin" },
  { conta: "ADMIN", papel: "admin", nome: "Eventos", rota: () => "/admin/eventos" },
  { conta: "ADMIN", papel: "admin", nome: "Funil", rota: () => "/admin/funil" },
  { conta: "VISITANTE", papel: "visitante", nome: "Parceiros", rota: () => "/parceiros" },
  { conta: "VISITANTE", papel: "visitante", nome: "Ativar parceiro", rota: () => "/parceiros/ativar" },
  { conta: "VISITANTE", papel: "visitante", nome: "Avaliadores", rota: () => "/parceiros/avaliadores" },
  { conta: "VISITANTE", papel: "visitante", nome: "Fotógrafos", rota: () => "/parceiros/fotografos" },
];

/** Achados já registrados como defeito de produto (L-*) ou que são o desenho pedido: ficam anotados e não derrubam o teste. */
const CONHECIDOS: { rota: RegExp; achado: RegExp; l: string; classe?: Classe }[] = [
  // L-63 (Pista A + Daniel): as fotos dos cartões de tipo do #1312 ainda não estão em public/images/imoveis/.
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "imagem", achado: /\/images\/imoveis\/(tipo-(casa|studio|loft|cobertura|casa-condominio|flat)|placeholder-imovel-chacara)\.webp/, l: "L-63" },
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "foto", achado: /área de foto vazia \(aspect-ratio 4 \/ 3\).*"Imagem ilustrativa"/, l: "L-63" },
  // Desenho do E248 (#1536): o "›" sólido da fileira que rola senta sobre o item da borda (t662).
  { rota: /^\/dashboard(\/|\?|$)/, classe: "fixo", achado: /coberto por button "Ver mais itens"$/, l: "E248-desenho" },
];
const conhecido = (rotulo: string, a: string, classe?: Classe) => CONHECIDOS.find((c) => c.classe === classe && c.rota.test(rotulo) && c.achado.test(a));

const CODIGO_SOCIOS = process.env.SOCIOS_ACCESS_CODE;
const MASSA = lerMassa();
const SAIDA = "tests/laboratorio/saida/varredura-bloco129";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

test.describe("T813 — varredura da página inteira, bloco 129 (4ª volta: serviços e visitas, admin, parceiros) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (contas da massa da varredura)");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
    expect(MASSA, "laboratório sem a massa da varredura (scripts/lab/massa-varredura.mjs)").not.toBeNull();
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      test.skip(t.conta !== "VISITANTE" && t.conta !== "SOCIO" && t.conta !== "ADMIN" && !temContaVarredura(t.conta as ChaveConta), `sem a conta ${t.conta} na massa`);
      test.skip(t.conta === "SOCIO" && !CODIGO_SOCIOS, "SOCIOS_ACCESS_CODE não definido neste ambiente");
      const rota = t.rota(MASSA!);
      const rotulo = rota.replace(/[0-9a-f-]{36}/g, ":id");
      const relatorio: Record<string, Record<string, string[]>> = {};
      mkdirSync(SAIDA, { recursive: true });
      for (const tam of TAMANHOS) {
        let page: Page;
        if (t.conta === "VISITANTE" || t.conta === "SOCIO") {
          const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: tam.width, height: tam.height } });
          page = await ctx.newPage();
          if (t.conta === "SOCIO") {
            // A porta única dos sócios: o código grava o cookie vn_socios e devolve para a página pedida (como na t307).
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
          // Console e erro de página (critério d da t249, com as exceções de terceiros de lá) também entram no relatório.
          const erros = escutarErros(page);
          const resposta = await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 40_000 });
          expect(resposta?.status() ?? 0, `${t.papel} — ${t.nome} @${tam.nome}: HTTP`).toBeLessThan(400);
          expect(new URL(page.url()).pathname, `${t.papel} — ${t.nome} @${tam.nome}: caiu fora da tela (login ou redirecionamento)`).toBe(rota.split(/[?#]/)[0]);
          await page.locator("main").first().waitFor({ timeout: 20_000 }).catch(() => {});
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
          const achados = await varrerPagina(page, respostas);
          for (const classe of Object.keys(CLASSES) as Classe[]) {
            await test.step(`${classe} @${tam.nome}`, async () => {
              for (const a of achados[classe]) console.log(`VARREDURA|${classe}|${tam.nome}|${t.papel}|${rotulo}|${a}`);
              for (const a of achados[classe]) {
                const c = conhecido(rotulo, a, classe);
                if (c) test.info().annotations.push({ type: c.l, description: `${rotulo} @${tam.nome} (${classe}): ${a}` });
              }
              const novos = achados[classe].filter((a) => !conhecido(rotulo, a, classe));
              expect.soft(novos, `${t.papel} — ${t.nome} @${tam.nome} — ${classe}: ${CLASSES[classe]}`).toEqual([]);
            });
          }
          await page.screenshot({ path: `${SAIDA}/${slug(`${t.papel}-${t.nome}`)}-${tam.width}.png`, fullPage: true }).catch(() => {});
          const consoleErros = erros.lista();
          await test.step(`console @${tam.nome}`, async () => {
            for (const a of consoleErros) console.log(`VARREDURA|console|${tam.nome}|${t.papel}|${rotulo}|${a}`);
            expect.soft(consoleErros, `${t.papel} — ${t.nome} @${tam.nome} — console: erro de console ou de página`).toEqual([]);
          });
          relatorio[tam.nome] = { ...achados, console: consoleErros };
        } finally {
          await page.context().close();
        }
      }
      writeFileSync(`${SAIDA}/${slug(`${t.papel}-${t.nome}`)}.json`, JSON.stringify({ papel: t.papel, tela: t.nome, achados: relatorio }, null, 2));
    });
  }
});
