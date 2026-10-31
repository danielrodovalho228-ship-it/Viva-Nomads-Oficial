import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T774 — Painel 404 (#1690, Pista B): o notFound() das telas com id do painel (visita, proposta, estadia, pedido de
  serviço…) cai na 404 DO PAINEL, não na 404 pública de marketing. Pista C, bloco 102. Pela tela de verdade, com uma
  moradora de teste, a 1280 e a 390 px: um link de visita e um de proposta que não existem (ou de outra conta) dão HTTP
  404, o bloco "painel-nao-encontrado" com "Página não encontrada", o motivo sem dizer de quem é, "Voltar ao painel"
  (/dashboard) e "Falar com a Viva" (/ajuda) — e nada da vitrine pública (cartões de imóvel, convite para anunciar).
  Os ajustes do mesmo dia na tela de erro do painel (#1689, "Tentar de novo") e no erro da raiz em português (#1691)
  pedem um erro do servidor para aparecer; o laboratório não tem rota que o provoque, e os dois ficam com o teste
  unitário que veio com eles.
*/
const senha = novaSenha();
const conta = { email: `mor.t774.${novoSufixo()}@lab.vivanomads.test`, nome: "Nadia Painel", role: "tenant" as const };
let id = "";

test.describe("T774 — a 404 das telas com id fica dentro do painel", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });
  test.beforeAll(async () => {
    id = await criarConta(conta, senha);
    await adm().from("profiles").update({ intencao: ["morar"] }).eq("id", id);
  });
  test.afterAll(async () => {
    await apagarContas([id]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px: visita e proposta inexistentes mostram a 404 do painel`, async ({ browser }) => {
      const p = await entrar(browser, conta.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      for (const rota of [`/dashboard/visitas/${randomUUID()}`, `/dashboard/propostas/${randomUUID()}`]) {
        const r = await p.goto(rota, { waitUntil: "domcontentloaded" });
        expect(r?.status(), `${rota}: HTTP`).toBe(404);
        const bloco = p.getByTestId("painel-nao-encontrado");
        await expect(bloco, rota).toBeVisible({ timeout: 20_000 });
        await expect(bloco.getByRole("heading", { level: 1 })).toHaveText("Página não encontrada");
        await expect(bloco).toContainText("Este endereço não existe mais ou não é desta conta.");
        await expect(bloco.getByRole("link", { name: "Voltar ao painel" })).toHaveAttribute("href", "/dashboard");
        await expect(bloco.getByRole("link", { name: "Falar com a Viva" })).toHaveAttribute("href", "/ajuda");
        // Nada da 404 pública de marketing.
        await expect(p.getByTestId("card-resultado")).toHaveCount(0);
        await expect(p.locator('main a[href="/para-proprietarios"]')).toHaveCount(0);
        const sobra = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(sobra, "sem rolagem lateral").toBeLessThanOrEqual(1);
      }
      await p.context().close();
    });
  }
});
