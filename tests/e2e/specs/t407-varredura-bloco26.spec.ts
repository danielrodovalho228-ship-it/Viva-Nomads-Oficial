import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, cliqueResponde, lerMassa, temContaVarredura, type ChaveConta, type Massa } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T407 — VARREDURA DA PÁGINA INTEIRA, BLOCO 26 (Pista C, 24/10). O protocolo do bloco 21 (t385): seis classes, página toda
  rolada, carregamento real de cada imagem, 390 e 1280 px, HTTP abaixo de 400 e o clique no primário com resposta
  visível em até 3 s. Cobre só as telas que os merges depois do bloco 25 criaram ou mudaram e que nenhuma varredura viu
  depois da mudança: o aviso do link do celular da prova de nível (#1289, tela nova, nas duas variantes), a câmera da
  página de nível (#1289, #1293), a aba "Emitidos" dos documentos do admin (#1278), o /admin no celular (E73, #1283),
  Pagamentos com o bloco do dono (E70, #1293), o passo Fotos do cadastro e as fotos da edição (#1292), a busca com o km
  até o local digitado (E79 #1270, E94 #1291) e "O que tem por perto" na página do imóvel (#1286). Sem o clique onde ele
  gravaria na massa ou mandaria e-mail (Emitidos reenvia; Pagamentos grava o "Avise-me"; cadastro e edição gravam). Só
  no laboratório.
*/
type Conta = ChaveConta | "ADMIN" | "VISITANTE";
interface Tela {
  conta: Conta;
  papel: string;
  nome: string;
  rota: (m: Massa) => string;
  /** false: não clica no primário (ação com efeito fora da tela). */
  clicar?: boolean;
}

const TELAS: Tela[] = [
  { conta: "VISITANTE", papel: "visitante", nome: "Aviso do link do celular, vencido ou usado (#1289)", rota: () => "/prova/celular/aviso" },
  { conta: "VISITANTE", papel: "visitante", nome: "Aviso do link do celular, outra conta (#1289)", rota: () => "/prova/celular/aviso?m=outra-conta" },
  {
    conta: "VISITANTE",
    papel: "visitante",
    nome: "Buscar com o km até o local digitado (#1270, #1291)",
    rota: () => "/buscar?dlat=-18.919&dlng=-48.277&drot=Rua+da+Varredura+%E2%80%94+Centro&modo=carro",
  },
  { conta: "VISITANTE", papel: "visitante", nome: "Página do imóvel, O que tem por perto (#1286)", rota: (m) => `/imoveis/${m.imovel17}` },
  { conta: "ADMIN", papel: "admin", nome: "Painel do admin no celular (#1283)", rota: () => "/admin" },
  { conta: "ADMIN", papel: "admin", nome: "Documentos, aba Emitidos (#1278)", rota: () => "/admin/documentos?aba=emitidos", clicar: false },
  { conta: "DONO17", papel: "proprietário", nome: "Nível do imóvel, câmera da prova (#1289, #1293)", rota: (m) => `/dashboard/imoveis/${m.imovel17}/nivel` },
  { conta: "DONO17", papel: "proprietário", nome: "Conta, Pagamentos do dono (#1293)", rota: () => "/dashboard/conta/pagamentos", clicar: false },
  { conta: "DONO17", papel: "proprietário", nome: "Cadastro, passo Fotos (#1292)", rota: (m) => `/dashboard/imoveis/novo?draft=${m.rascunho1}&etapa=fotos`, clicar: false },
  { conta: "DONO17", papel: "proprietário", nome: "Editar anúncio, fotos (#1292)", rota: (m) => `/dashboard/imoveis/${m.imovel17}/editar`, clicar: false },
];

/**
 * Achados do clique já registrados como defeito de produto (L-*): ficam anotados no relatório e não derrubam o teste;
 * qualquer outro achado derruba. Quando a pista dona corrigir, o achado some e a linha sai daqui.
 */
const CONHECIDOS: { rota: RegExp; achado: RegExp; l: string; classe?: Classe }[] = [
  { rota: /^\/buscar(\?|$)/, achado: /"Aplicar nos filtros" desabilitado sem explicar o motivo/, l: "L-51" },
  { rota: /^\/admin$/, achado: /"Testar" desabilitado sem explicar o motivo/, l: "L-61" },
  { rota: /^\/admin\/documentos\?aba=emitidos$/, classe: "estouro", achado: /além da direita: <label[^>]*> "Tipo/, l: "L-62" },
];
const conhecido = (rotulo: string, a: string, classe?: Classe) => CONHECIDOS.find((c) => c.classe === classe && c.rota.test(rotulo) && c.achado.test(a));

const MASSA = lerMassa();
const SAIDA = "tests/laboratorio/saida/varredura-bloco26";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
const CLIQUE = "clique no botão primário sem resposta visível em 3 s";

test.describe("T407 — varredura da página inteira, bloco 26 (telas dos merges depois do bloco 25) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (contas da massa da varredura)");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
    expect(MASSA, "laboratório sem a massa da varredura (scripts/lab/massa-varredura.mjs)").not.toBeNull();
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes e o clique no primário, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      test.skip(t.conta !== "ADMIN" && t.conta !== "VISITANTE" && !temContaVarredura(t.conta), `sem a conta ${t.conta} na massa`);
      const limpar: (() => Promise<unknown>)[] = [];
      const relatorio: Record<string, Record<string, string[]>> = {};
      try {
        for (const tam of TAMANHOS) {
          const rota = t.rota(MASSA!);
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
                  await primario.click({ timeout: 5_000, noWaitAfter: true }).catch(() => {});
                  const navegou = await page
                    .waitForURL((u) => u.href !== antes, { timeout: 3_000, waitUntil: "commit" })
                    .then(() => true)
                    .catch(() => false);
                  clique = navegou ? [] : [`clique em "${nome}" (link) sem navegação em 3 s`];
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
