import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, cliqueResponde, lerMassa, temContaVarredura, type ChaveConta, type Massa } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T607 — VARREDURA DA PÁGINA INTEIRA, BLOCO 51 (Pista C, 29/10). O protocolo do bloco 21 (t385): seis classes (imagem
  vazia/quebrada, sobreposição de elemento fixo, texto cortado, grade desalinhada…), página toda rolada, carregamento
  real de cada imagem, 390 e 1280 px, HTTP abaixo de 400 e o clique no primário com resposta visível em até 3 s.
  Depois do bloco 50 não sobra página do produto sem varredura além do /ajuda/fale-com-a-viva (novo no E84, #1472); as
  ferramentas internas de QA (/qa/entrar, /dashboard/qa/emails, /dev/emails) ficam fora. O bloco 51 varre essa página e
  as telas que os merges depois da main 989bb5682 mudaram (#1472–#1479): a central de ajuda, os termos e a privacidade
  (página legal nova), as candidaturas, as mensagens (E200, conversa da estadia), a conta e as buscas salvas do morador
  e o Início do dono (casca e primitivas do painel).
*/
type Conta = ChaveConta | "ADMIN" | "VISITANTE";
interface Tela {
  conta: Conta;
  papel: string;
  nome: string;
  rota: (m: Massa) => string | Promise<string>;
  /** false: não clica no primário (ação com efeito fora da tela). */
  clicar?: boolean;
  /** Motivo para pular (dado que o laboratório não tem); null = varre. */
  pular?: () => string | null;
}

const TELAS: Tela[] = [
  { conta: "VISITANTE", papel: "visitante", nome: "Central de ajuda", rota: () => "/ajuda" },
  { conta: "VISITANTE", papel: "visitante", nome: "Fale com a Viva", rota: () => "/ajuda/fale-com-a-viva", clicar: false },
  { conta: "VISITANTE", papel: "visitante", nome: "Termos de uso", rota: () => "/termos" },
  { conta: "VISITANTE", papel: "visitante", nome: "Privacidade", rota: () => "/privacidade" },
  { conta: "INQUILINA", papel: "morador", nome: "Candidaturas", rota: () => "/dashboard/candidaturas" },
  { conta: "INQUILINA", papel: "morador", nome: "Mensagens", rota: () => "/dashboard/mensagens" },
  { conta: "INQUILINA", papel: "morador", nome: "Conta", rota: () => "/dashboard/conta" },
  { conta: "INQUILINA", papel: "morador", nome: "Buscas salvas", rota: () => "/dashboard/buscas" },
  { conta: "DONO17", papel: "proprietário", nome: "Início do painel", rota: () => "/dashboard" },
];

/**
 * Achados do clique já registrados como defeito de produto (L-*): ficam anotados no relatório e não derrubam o teste;
 * qualquer outro achado derruba. Quando a pista dona corrigir, o achado some e a linha sai daqui.
 */
const CONHECIDOS: { rota: RegExp; achado: RegExp; l: string; classe?: Classe }[] = [
  { rota: /^\/buscar(\?|$)/, achado: /"Aplicar nos filtros" desabilitado sem explicar o motivo/, l: "L-51" },
  { rota: /^\/admin$/, achado: /"Testar" desabilitado sem explicar o motivo/, l: "L-61" },
  // L-63 (Pista A + Daniel): as 7 fotos dos cartões de tipo do #1312 ainda não estão em public/images/imoveis/.
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "imagem", achado: /\/images\/imoveis\/(tipo-(casa|studio|loft|cobertura|casa-condominio|flat)|placeholder-imovel-chacara)\.webp/, l: "L-63" },
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "foto", achado: /área de foto vazia \(aspect-ratio 4 \/ 3\).*"Imagem ilustrativa"/, l: "L-63" },
  { rota: /^\/admin\/documentos\?aba=emitidos$/, classe: "estouro", achado: /além da direita: <label[^>]*> "Tipo/, l: "L-62" },
];
const conhecido = (rotulo: string, a: string, classe?: Classe) => CONHECIDOS.find((c) => c.classe === classe && c.rota.test(rotulo) && c.achado.test(a));

const MASSA = lerMassa();
const SAIDA = "tests/laboratorio/saida/varredura-bloco51";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
const CLIQUE = "clique no botão primário sem resposta visível em 3 s";

test.describe("T607 — varredura da página inteira, bloco 51 (Fale com a Viva e as telas dos merges #1472–#1479) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (contas da massa da varredura)");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
    expect(MASSA, "laboratório sem a massa da varredura (scripts/lab/massa-varredura.mjs)").not.toBeNull();
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes e o clique no primário, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      test.skip(t.conta !== "ADMIN" && t.conta !== "VISITANTE" && !temContaVarredura(t.conta), `sem a conta ${t.conta} na massa`);
      const motivo = t.pular?.() ?? null;
      test.skip(!!motivo, motivo ?? "");
      const limpar: (() => Promise<unknown>)[] = [];
      const relatorio: Record<string, Record<string, string[]>> = {};
      try {
        for (const tam of TAMANHOS) {
          const rota = await t.rota(MASSA!);
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
            const rotulo = rota.replace(/[0-9a-f-]{36}/g, ":id");
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
            let clique: string[] = [];
            if (t.clicar !== false) {
              await test.step(`clique @${tam.nome}`, async () => {
                const primario = page.locator('main [data-cta="primary"]:visible').first();
                if ((await primario.count()) === 0) {
                  console.log(`VARREDURA|clique|${tam.nome}|${t.papel}|${rotulo}|sem primário visível no main (nada a clicar)`);
                  return;
                }
                await primario.scrollIntoViewIfNeeded().catch(() => {});
                const nome = ((await primario.innerText().catch(() => "")) || (await primario.getAttribute("aria-label")) || "primário").trim().slice(0, 60);
                const href = await primario.evaluate((el) => (el instanceof HTMLAnchorElement ? el.href : null)).catch(() => null);
                if (href) {
                  // Primário que é link: a resposta é a navegação. O cliqueResponde lia a página no meio do
                  // redirecionamento (/para-proprietarios → /dashboard/imoveis/novo → /auth) e travava até o teto de 180 s.
                  const antes = page.url();
                  const textoAntes = await page.locator("main").first().innerText().catch(() => "");
                  await primario.click({ timeout: 5_000, noWaitAfter: true }).catch(() => {});
                  const navegou = await page
                    .waitForURL((u) => u.href !== antes, { timeout: 3_000, waitUntil: "commit" })
                    .then(() => true)
                    .catch(() => false);
                  // Link que troca a tela sem navegar (preventDefault, ex.: "Abrir chamado" da /ajuda abre a aba do
                  // formulário): também é resposta visível.
                  const mudou = navegou || (await page.locator("main").first().innerText().catch(() => textoAntes)) !== textoAntes;
                  clique = mudou ? [] : [`clique em "${nome}" (link) sem navegação nem mudança na tela em 3 s`];
                } else {
                  clique = await cliqueResponde(page, primario, nome);
                }
                for (const a of clique) console.log(`VARREDURA|clique|${tam.nome}|${t.papel}|${rotulo}|${a}`);
                for (const a of clique) {
                  const c = conhecido(rotulo, a);
                  if (c) test.info().annotations.push({ type: c.l, description: `${rotulo} @${tam.nome}: ${a}` });
                }
                const novos = clique.filter((a) => !conhecido(rotulo, a));
                expect.soft(novos, `${t.papel} — ${t.nome} @${tam.nome} — clique: ${CLIQUE}`).toEqual([]);
              });
            }
            relatorio[tam.nome] = { ...achados, clique };
          } finally {
            await page.context().close();
          }
        }
      } finally {
        for (const f of limpar) await f().catch(() => {});
      }
      mkdirSync(SAIDA, { recursive: true });
      writeFileSync(`${SAIDA}/${slug(`${t.papel}-${t.nome}`)}.json`, JSON.stringify({ papel: t.papel, tela: t.nome, achados: relatorio }, null, 2));
    });
  }
});
