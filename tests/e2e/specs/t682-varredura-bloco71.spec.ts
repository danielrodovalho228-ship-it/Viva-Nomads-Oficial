import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, lerMassa, temContaVarredura, type ChaveConta, type Massa } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T682 — VARREDURA DA PÁGINA INTEIRA, BLOCO 71 (Pista C, 30/10). O protocolo do bloco 21 (t385): seis classes, página
  toda rolada, carregamento real de cada imagem, 390 e 1280 px, HTTP abaixo de 400. As próximas telas do painel
  varridas há mais tempo (blocos 33, 35, 38 e 39), revistas sobre o topo, as barras e o rodapé de hoje:
    · proprietário: Fechamento, Garantias, Recibos e notas, Ferramentas e Excluir minha conta;
    · morador (contrato vigente da massa): Estadia (linha do tempo), Ferramentas e Excluir minha conta.
  Contas e contrato da massa (scripts/lab/massa-varredura.mjs), como a t679. Sem clique no primário (nada é excluído).
  Só no laboratório.
*/
interface Tela {
  conta: ChaveConta;
  papel: string;
  nome: string;
  rota: (m: Massa) => string;
}

const TELAS: Tela[] = [
  { conta: "DONO17", papel: "proprietário", nome: "Fechamento", rota: () => "/dashboard/fechamento" },
  { conta: "DONO17", papel: "proprietário", nome: "Garantias", rota: () => "/dashboard/garantias" },
  { conta: "DONO17", papel: "proprietário", nome: "Recibos e notas", rota: () => "/dashboard/recibos" },
  { conta: "DONO17", papel: "proprietário", nome: "Ferramentas", rota: () => "/dashboard/ferramentas" },
  { conta: "DONO17", papel: "proprietário", nome: "Excluir minha conta", rota: () => "/dashboard/conta/excluir" },
  { conta: "INQUILINA", papel: "morador", nome: "Estadia, linha do tempo", rota: (m) => `/dashboard/estadia/${m.contrato}` },
  { conta: "INQUILINA", papel: "morador", nome: "Ferramentas", rota: () => "/dashboard/ferramentas" },
  { conta: "INQUILINA", papel: "morador", nome: "Excluir minha conta", rota: () => "/dashboard/conta/excluir" },
];

/** Achados já registrados como defeito de produto (L-*) ou que são o desenho pedido: ficam anotados e não derrubam o teste. */
const CONHECIDOS: { rota: RegExp; achado: RegExp; l: string; classe?: Classe }[] = [
  // Desenho do E248 (#1536): o "›" sólido da fileira que rola senta sobre o item da borda (t662).
  { rota: /^\/dashboard(\/|\?|$)/, classe: "fixo", achado: /coberto por button "Ver mais itens"$/, l: "E248-desenho" },
];
const conhecido = (rotulo: string, a: string, classe?: Classe) => CONHECIDOS.find((c) => c.classe === classe && c.rota.test(rotulo) && c.achado.test(a));

const SAIDA = "tests/laboratorio/saida/varredura-bloco71";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

const MASSA = lerMassa();

test.describe("T682 — varredura da página inteira, bloco 71 (fechamento, garantias, recibos, ferramentas, excluir conta, estadia) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
    expect(MASSA, "laboratório sem a massa da varredura (scripts/lab/massa-varredura.mjs)").not.toBeNull();
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      test.skip(!temContaVarredura(t.conta), `sem a conta ${t.conta} na massa`);
      const relatorio: Record<string, Record<string, string[]>> = {};
      mkdirSync(SAIDA, { recursive: true });
      for (const tam of TAMANHOS) {
        const rota = t.rota(MASSA!);
        const page: Page = (await abrirComoConta(browser, t.conta, tam.nome)).page;
        try {
          const respostas = escutarImagens(page);
          const resposta = await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 40_000 });
          expect(resposta?.status() ?? 0, `${t.papel} — ${t.nome} @${tam.nome}: HTTP`).toBeLessThan(400);
          expect(new URL(page.url()).pathname, `${t.papel} — ${t.nome} @${tam.nome}: caiu fora da tela (login ou redirecionamento)`).toBe(rota.split(/[?#]/)[0]);
          await page.locator("main").first().waitFor({ timeout: 20_000 }).catch(() => {});
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
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
          await page.screenshot({ path: `${SAIDA}/${slug(`${t.papel}-${t.nome}`)}-${tam.width}.png`, fullPage: true }).catch(() => {});
          relatorio[tam.nome] = achados;
        } finally {
          await page.context().close();
        }
      }
      writeFileSync(`${SAIDA}/${slug(`${t.papel}-${t.nome}`)}.json`, JSON.stringify({ papel: t.papel, tela: t.nome, achados: relatorio }, null, 2));
    });
  }
});
