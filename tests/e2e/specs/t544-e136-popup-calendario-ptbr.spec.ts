// Portão pós-#1500 (Pista C, 29/10): o E193 (#1496) trocou listas e caixas por pílulas e cartões no assistente e no editor; roda no lab-crítico deste PR.
import { test, expect, devices, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T544 — E136, o POP-UP do seletor de datas (guarda permanente da Pista C): as t424/t476/t484 conferem os TEXTOS do
  Passo 9 e a t479 (Pista A, #1388) o pop-up do computador; aqui é o calendário que abre no campo "Disponível a partir
  de", com o navegador em INGLÊS (en-US), também no TOQUE.
  Esperado: um calendário em pt-BR na própria página — mês em português ("novembro de 2026"), dias da semana em
  português (dom/seg/ter…) e nenhum mês ou dia em inglês.
  1280 px (botão "Abrir calendário" do campo) e 390 px num iPhone (toque no campo).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t544.${sufixo}@lab.vivanomads.test`, nome: "Paula Pop-up", role: "owner" as const };
const ids: Record<string, string> = {};
const MES_PT = /\b(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/i;
// Dias da semana em pt-BR: abreviados (dom, seg…) ou as iniciais do calendário do site ("D S T Q Q S S").
const DIA_PT = /\b(dom|seg|ter|qua|qui|sex|sáb)\b|\bD S T Q Q S S\b/i;
const EM_INGLES = /\b(January|February|March|April|June|July|August|September|October|November|December|Sun|Mon|Tue|Wed|Thu|Fri|Sat|Today|Clear)\b/;

/** Elementos de calendário que apareceram na página depois do toque (fora da grade de bloqueios do Passo 9). */
async function calendariosNaPagina(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid$="-calendario-popup"], [role="dialog"], [role="grid"], [role="application"]'))
      .filter((e) => !e.closest('[data-testid="calendario-dono-grade"]') && (e as HTMLElement).offsetParent !== null)
      .map((e) => (e as HTMLElement).innerText.replace(/\s+/g, " ").slice(0, 200)),
  );
}

test.describe("T544 — E136: o pop-up do calendário em pt-BR com o navegador em inglês", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.r1280 = await prepararRascunho(ids.dono, `Studio t544 a ${sufixo}`, { minPeriod: "30" });
    ids.r390 = await prepararRascunho(ids.dono, `Studio t544 b ${sufixo}`, { minPeriod: "30" });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: o calendário que abre no campo de data é pt-BR`, async ({ browser }) => {
      // No computador, o #1388 (E136b) trocou o seletor nativo pelo calendário do site, em pt-BR: verde a 1280.
      // No TOQUE o campo continua sendo o <input type="date"> nativo (imoveis/novo/campos.tsx, CampoDataUnico, ramo
      // `toque`): o calendário é o do aparelho, no idioma dele (en-US → "October 2026", "Sun Mon…"); nenhum calendário
      // pt-BR abre na página (lab-crítico 40211777060, tentativa 2, antes do #1388: nenhum calendário em nenhuma
      // largura). Quem trouxer o calendário do site para o toque tira este test.fail.
      test.fail(w === 390, "E136: no toque, o calendário é o seletor nativo do aparelho, no idioma dele");
      const { defaultBrowserType: _t, ...iphone } = devices["iPhone 13"];
      void _t;
      const ctx = w === 390 ? { ...iphone, locale: "en-US" } : { locale: "en-US" };
      const page = await abrirPasso(browser, { email: dono.email, senha }, w === 390 ? ids.r390 : ids.r1280, "disponibilidade", w, ctx);
      const antes = await calendariosNaPagina(page);
      if (w === 1280) await page.getByTestId("disponivel-de-calendario").click();
      else await page.getByTestId("disponivel-de").tap();
      await page.waitForTimeout(800);
      const novos = (await calendariosNaPagina(page)).filter((t) => !antes.includes(t));
      await page.screenshot({ path: `tests/laboratorio/saida/t544-popup-${w}.png` });
      const tipo = await page.getByTestId("disponivel-de").getAttribute("type");
      console.log(`t544 ${w}: campo type=${tipo}; calendários novos na página: ${JSON.stringify(novos)}`);
      expect(novos.length, `nenhum calendário pt-BR abriu na página (o campo é type=${tipo}: o seletor nativo do navegador, no idioma do aparelho)`).toBeGreaterThan(0);
      const texto = novos.join(" ");
      expect(texto).toMatch(MES_PT);
      expect(texto).toMatch(DIA_PT);
      expect(texto.match(EM_INGLES)?.[0] ?? null, "mês/dia/botão em inglês no calendário").toBeNull();
      await page.context().close();
    });
  }
});
