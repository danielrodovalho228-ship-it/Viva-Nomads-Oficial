import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { TAMANHOS } from "../fixtures/varredura";
import { CLASSES, PAGINAS_PUBLICAS as PAGINAS, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T274 — VARREDURA DA PÁGINA INTEIRA, visitante (ordem do Muse, 22/10). O protocolo do Daniel: em cada página pública,
  em 390 e em 1280 px, rolar a página TODA e caçar seis classes de defeito (fixtures/varredura-pagina.ts):
    imagem  vazia, quebrada ou 404, pelo carregamento real (naturalWidth) e pelo HTTP da resposta
    fixo    elemento fixo/flutuante sobre conteúdo que a rolagem não revela (régua do Muse, 21/10)
    foto    cartão sem foto ou com a área da foto vazia (no laboratório, a foto fictícia semeada por outra spec não conta)
    estouro conteúdo vazando pela borda da tela (por elemento: html/body usam overflow-x: clip e escondem a rolagem)
    texto   texto cortado sem reticências
    grade   grade desalinhada ou cartões da mesma linha fora do tamanho uniforme
  Cada classe é uma conferência própria (test.step + expect.soft) em cada página e tamanho; a evidência sai no erro e
  numa linha "VARREDURA|classe|largura|rota|achado" no log, além de tests/laboratorio/saida/varredura-paginas/.
  Roda contra qualquer alvo: produção (npm run testes:publico) ou o laboratório. As páginas com id/slug saem do
  sitemap do próprio alvo; se a família não existir lá, o teste se pula dizendo isso.
  Telas logadas: produção não tem as contas de teste (scripts/ci/e2e-alvo.sh); elas ficam com a t249 no laboratório.
*/
const SAIDA = "tests/laboratorio/saida/varredura-paginas";
/**
  Defeitos conhecidos (página|classe), com o código do registro (tests/laboratorio/registro-defeitos.md): o achado que
  casa vira anotação e linha "conhecido" no log, sem reprovar. Se nenhum achado casar nos dois tamanhos, o defeito saiu:
  o teste reprova pedindo para tirar a entrada daqui (mesma catraca do test.fail da t249).
*/
const CONHECIDOS: Record<string, { codigo: string; casa: RegExp }> = {
  // L-7 (lab de 82b4d9b, 22/10): cartões com fotoPronta false em src/lib/cartoes-secao.ts mostram só o fundo neutro.
  "Empresas|foto": { codigo: "L-7", casa: /\[cartao-foto-pendente\]/ },
  "Para proprietários|foto": { codigo: "L-7", casa: /\[cartao-foto-pendente\]/ },
};
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

test.describe("T274 — varredura da página inteira (visitante, 390 e 1280 px)", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)"));

  for (const p of PAGINAS) {
    test(`${p.nome}: as seis classes, rolando a página inteira`, async ({ browser, request }) => {
      test.setTimeout(150_000);
      const rota = typeof p.rota === "string" ? p.rota : await p.rota(request);
      test.skip(!rota, `${p.nome}: não existe neste alvo (sitemap/links sem essa família)`);
      const relatorio: Record<string, Record<string, string[]>> = {};
      const conhecidosVistos = new Set<string>();
      for (const tam of TAMANHOS) {
        const ctx = await browser.newContext({ viewport: { width: tam.width, height: tam.height } });
        const page = await ctx.newPage();
        try {
          const respostas = escutarImagens(page);
          const resp = await page.goto(rota!, { waitUntil: "domcontentloaded", timeout: 40_000 });
          expect(resp?.status() ?? 0, `${p.nome} @${tam.nome}: HTTP da página`).toBeLessThan(400);
          await page.locator("main").first().waitFor({ timeout: 20_000 }).catch(() => {});
          const achados = await varrerPagina(page, respostas);
          relatorio[tam.nome] = achados;
          for (const classe of Object.keys(CLASSES) as Classe[]) {
            await test.step(`${classe} @${tam.nome}`, async () => {
              const conhecido = CONHECIDOS[`${p.nome}|${classe}`];
              const novos: string[] = [];
              for (const a of achados[classe]) {
                if (conhecido?.casa.test(a)) {
                  conhecidosVistos.add(classe);
                  console.log(`VARREDURA|${classe}|${tam.nome}|${rota}|conhecido ${conhecido.codigo}: ${a}`);
                  test.info().annotations.push({ type: conhecido.codigo, description: `${p.nome} @${tam.nome} — ${a}` });
                } else {
                  console.log(`VARREDURA|${classe}|${tam.nome}|${rota}|${a}`);
                  novos.push(a);
                }
              }
              expect.soft(novos, `${p.nome} @${tam.nome} — ${classe}: ${CLASSES[classe]} (${rota})`).toEqual([]);
            });
          }
        } finally {
          await ctx.close();
        }
      }
      for (const classe of Object.keys(CLASSES) as Classe[]) {
        const conhecido = CONHECIDOS[`${p.nome}|${classe}`];
        if (conhecido) expect.soft(conhecidosVistos.has(classe), `${conhecido.codigo} não apareceu em ${p.nome} (${classe}): corrigido? Tire a entrada de CONHECIDOS`).toBe(true);
      }
      mkdirSync(SAIDA, { recursive: true });
      writeFileSync(`${SAIDA}/${slug(p.nome)}.json`, JSON.stringify({ pagina: p.nome, rota, achados: relatorio }, null, 2));
    });
  }

  // Defeito conhecido (o Daniel viu no celular): o selo "Internet para home office" da home vaza pela direita.
  test("Início: o selo 'Internet para home office' cabe na tela (360, 390 e 1280 px)", async ({ browser }) => {
    test.setTimeout(90_000);
    const medidas: string[] = [];
    for (const largura of [360, 390, 1280]) {
      const ctx = await browser.newContext({ viewport: { width: largura, height: 844 } });
      const page = await ctx.newPage();
      await page.goto("/", { waitUntil: "domcontentloaded", timeout: 40_000 });
      const selo = page.getByText("Internet para home office", { exact: true }).locator("xpath=..");
      await selo.scrollIntoViewIfNeeded();
      const m = await selo.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { esquerda: Math.round(r.left), direita: Math.round(r.right), tela: window.innerWidth };
      });
      const sobra = m.direita - m.tela;
      console.log(`VARREDURA|estouro|${largura}|/|selo "Internet para home office": x=${m.esquerda}..${m.direita}, tela=${m.tela}, sobra=${sobra}px`);
      if (sobra > 0 || m.esquerda < 0) medidas.push(`${largura}px: vaza ${Math.max(sobra, -m.esquerda)}px (x=${m.esquerda}..${m.direita}, tela ${m.tela})`);
      await ctx.close();
    }
    expect(medidas, "o selo deve caber inteiro dentro da tela").toEqual([]);
  });
});
