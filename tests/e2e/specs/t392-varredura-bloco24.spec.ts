// Rodada 19 da vigia (Pista C, 25/10, lote B): varredura completa na main com o PROP-1 (#1337), a 390 e 1280 px.
import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, cliqueResponde, lerMassa, temContaVarredura, type ChaveConta, type Massa } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T392 — VARREDURA DA PÁGINA INTEIRA, BLOCO 24 (Pista C, 24/10). O protocolo do bloco 21 (t385): seis classes, página toda
  rolada, carregamento real de cada imagem, 390 e 1280 px, HTTP abaixo de 400 e o clique no primário com resposta
  visível em até 3 s. Cobre as telas que os merges depois do bloco 23 mexeram: destinos do admin e o destino pessoal na
  busca (#1256, #1264), edição e cadastro do anúncio com a detecção nas fotos (#1256, #1259), a visão geral do admin
  (#1259), avaliadores a decidir (#1260) e a Conta em conformidade com o mockup, com Papéis com fotos (#1261, #1263),
  da moradora e do dono. Sem o clique no admin (ações de verdade), na edição e no cadastro do anúncio (gravariam na
  massa) e em Papéis (troca o papel ativo da conta da massa). Só no laboratório.
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
  { conta: "VISITANTE", papel: "visitante", nome: "Buscar com destino pessoal (#1264)", rota: () => "/buscar" },
  { conta: "DONO17", papel: "proprietário", nome: "Editar anúncio (#1256, #1259)", rota: (m) => `/dashboard/imoveis/${m.imovel17}/editar`, clicar: false },
  { conta: "DONO17", papel: "proprietário", nome: "Cadastro do anúncio (#1256, #1259)", rota: () => "/dashboard/imoveis/novo", clicar: false },
  { conta: "ADMIN", papel: "admin", nome: "Visão geral do admin (#1259)", rota: () => "/admin", clicar: false },
  { conta: "ADMIN", papel: "admin", nome: "Destinos (#1256, #1264)", rota: () => "/admin/destinos", clicar: false },
  { conta: "ADMIN", papel: "admin", nome: "Avaliadores a decidir (#1260)", rota: () => "/admin/avaliadores", clicar: false },
  ...(["INQUILINA", "DONO17"] as const).flatMap((conta) =>
    (
      [
        ["", "Conta (resumo)"],
        ["/seguranca", "Segurança"],
        ["/avaliacoes", "Avaliações"],
        ["/papeis", "Papéis com fotos"],
      ] as const
    ).map(([secao, nome]): Tela => ({
      conta,
      papel: conta === "INQUILINA" ? "inquilina" : "proprietário",
      nome: `${nome} (#1261, #1263)`,
      rota: () => `/dashboard/conta${secao}`,
      ...(secao === "/papeis" ? { clicar: false } : {}),
    })),
  ),
];

/**
 * Achados do clique já registrados como defeito de produto (L-*): ficam anotados no relatório e não derrubam o teste;
 * qualquer outro achado derruba. Quando a pista dona corrigir, o achado some e a linha sai daqui.
 */
const CONHECIDOS: { rota: RegExp; achado: RegExp; l: string }[] = [
  { rota: /^\/buscar$/, achado: /"Aplicar nos filtros" desabilitado sem explicar o motivo/, l: "L-51" },
];
const conhecido = (rotulo: string, a: string) => CONHECIDOS.find((c) => c.rota.test(rotulo) && c.achado.test(a));

const MASSA = lerMassa();
const SAIDA = "tests/laboratorio/saida/varredura-bloco24";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
const CLIQUE = "clique no botão primário sem resposta visível em 3 s";

test.describe("T392 — varredura da página inteira, bloco 24 (telas dos merges depois do bloco 23) (390 e 1280 px)", () => {
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
          // Rota por tamanho: o clique do primário pode mudar o pedido, então cada tamanho abre um pedido novo.
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
                expect.soft(achados[classe], `${t.papel} — ${t.nome} @${tam.nome} — ${classe}: ${CLASSES[classe]}`).toEqual([]);
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
