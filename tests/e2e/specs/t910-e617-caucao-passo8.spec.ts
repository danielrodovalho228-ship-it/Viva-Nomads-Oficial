import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T910 — E617: no Passo 8 (Preço), a opção "Aceito Caução (depósito devolvível)" foi vista cortada na borda. No modo
  demonstração não se reproduz (medido de 320 a 1440 px: o texto quebra dentro da pílula, com a folga do respiro). Esta
  guarda roda com sessão real, num rascunho de verdade, a 320, 390 e 1280: o texto inteiro fica dentro da pílula (com o
  respiro) e a pílula dentro da coluna; nada rola de lado.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t910.${sufixo}@lab.vivanomads.test`, nome: "Clara Caução", role: "owner" as const };
const ids: { dono?: string; rascunho?: string } = {};

test.describe("T910 — E617: 'Aceito Caução (depósito devolvível)' inteiro no Passo 8", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.rascunho = await prepararRascunho(ids.dono, `Caução T910 ${sufixo}`, { propertyType: "apartamento" });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [320, 390, 1280] as const) {
    test(`a ${w} px`, async ({ browser }) => {
      const p = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho!, "preco", w);
      const pilula = p.getByRole("button", { name: /Aceito Caução \(depósito devolvível\)/ });
      await expect(pilula).toBeVisible({ timeout: 30_000 });
      await pilula.scrollIntoViewIfNeeded();
      for (const ligada of [false, true]) {
        if ((await pilula.getAttribute("aria-pressed")) !== String(ligada)) await pilula.click();
        const m = await pilula.evaluate((el) => {
          const b = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          // O texto do botão pode morar num <span> filho: acha o 1º nó de texto com conteúdo em qualquer profundidade.
          const andador = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let texto: Node | null = null;
          while (andador.nextNode()) if (andador.currentNode.textContent?.trim()) { texto = andador.currentNode; break; }
          const r = document.createRange();
          r.selectNodeContents(texto!);
          const linhas = [...r.getClientRects()];
          const dentro = (x: number) => x >= b.left + parseFloat(s.paddingLeft) - 1 && x <= b.right - parseFloat(s.paddingRight) + 1;
          const coluna = el.parentElement!.getBoundingClientRect();
          return {
            textoDentro: linhas.every((l) => dentro(l.left) && dentro(l.right)),
            pilulaNaColuna: b.left >= coluna.left - 1 && b.right <= coluna.right + 1,
            lateral: document.documentElement.scrollWidth - innerWidth,
          };
        });
        expect({ textoDentro: m.textoDentro, pilulaNaColuna: m.pilulaNaColuna }, `ligada=${ligada} ${JSON.stringify(m)}`).toEqual({ textoDentro: true, pilulaNaColuna: true });
        expect(m.lateral, "rolagem lateral").toBeLessThanOrEqual(1);
      }
      await pilula.screenshot({ path: `tests/laboratorio/saida/t910-caucao-${w}.png` });
      await p.context().close();
    });
  }
});
