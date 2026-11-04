import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T850 — Onda 5 (matriz admin-*): no admin, a aba/filtro ativo é pílula branca com texto colorido (E351 c, sem fundo
  colorido). Antes, Documentos, Atendimento, Eventos e o filtro de período pintavam a aba ativa de verde cheio — lia como
  um segundo botão cheio na tela. 390 e 1280, com a sessão de admin do laboratório.
*/
const TELAS = [
  { rota: "/admin/documentos", ativo: '[aria-label="Seções de documentos"] [aria-current="page"]' },
  { rota: "/admin/atendimento", ativo: '[aria-label="Seções do atendimento"] [aria-current="page"]' },
  { rota: "/admin/eventos", ativo: '[aria-label="Tipo de evento"] [aria-current="page"]' },
  { rota: "/admin/pedidos", ativo: '[role="tab"][aria-selected="true"]' },
];

test.describe("T850 — admin: aba ativa em pílula branca", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (sessão de admin)");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
  });

  for (const tela of TELAS) {
    test(`${tela.rota}: aba ativa branca com texto verde (390 e 1280)`, async ({ browser }) => {
      for (const largura of [1280, 390]) {
        const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
        const page = await ctx.newPage();
        await page.goto(tela.rota, { waitUntil: "domcontentloaded" });
        const ativo = page.locator(tela.ativo).filter({ visible: true }).first();
        await expect(ativo, `${tela.rota} @${largura}: aba ativa`).toBeVisible({ timeout: 30_000 });
        const cor = await ativo.evaluate((e) => {
          const cs = getComputedStyle(e);
          // O verde da casa (text-forest) lido de um elemento de referência.
          const ref = document.createElement("span");
          ref.className = "text-forest";
          document.body.appendChild(ref);
          const verde = getComputedStyle(ref).color;
          ref.remove();
          return { fundo: cs.backgroundColor, texto: cs.color, verde };
        });
        expect(cor.fundo, `${tela.rota} @${largura}: fundo da aba ativa`).toBe("rgb(255, 255, 255)");
        expect(cor.texto, `${tela.rota} @${largura}: texto da aba ativa`).toBe(cor.verde);
        await ctx.close();
      }
    });
  }
});
