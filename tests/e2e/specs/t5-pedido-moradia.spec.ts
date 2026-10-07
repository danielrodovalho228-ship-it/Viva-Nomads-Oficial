import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { PROD_HOST } from "../fixtures/accounts";
import { marcadorPedido, preencherPedido, publicarPreenchido, encerrarPedido } from "../fixtures/pedido";

// Trecho estável do aviso de contato (lib/pedidos/pedidos.ts → CONTATO_AVISO).
const CONTATO_AVISO_RE = /o contato acontece pela plataforma/i;

/**
 * T5 — PEDIDO DE MORADIA. Bloqueio de contato na apresentação + publicação
 * limpa (idempotente: o pedido criado é encerrado ao final).
 *
 * Segurança do banco: se o alvo for a PRODUÇÃO, os testes que ESCREVEM são
 * pulados por padrão (rode contra o preview, ou libere com
 * TESTES_ALLOW_PROD_WRITES=1). O teste de bloqueio não escreve nada.
 */
const baseHost = (() => {
  try {
    return new URL(process.env.TESTES_BASE_URL || "http://localhost:3000").host;
  } catch {
    return "localhost";
  }
})();
const isProd = baseHost.includes(PROD_HOST);
const podeEscrever = !isProd || process.env.TESTES_ALLOW_PROD_WRITES === "1";

test.describe("T5 — Pedido de moradia", () => {
  test.use({ storageState: authFile("inquilino") });

  test("telefone na apresentação → bloqueio visível e publicação impedida", async ({ page }) => {
    await preencherPedido(page, {
      apresentacao: "Oi, me chama no 34 99999-8888 pra combinar a visita.",
    });
    // Aviso de contato visível…
    await expect(page.locator("body")).toContainText(CONTATO_AVISO_RE);
    // …e o botão de publicar fica desabilitado (publicação impedida).
    await expect(page.getByRole("button", { name: /Publicar pedido/i })).toBeDisabled();
  });

  test("sem contato → publica com sucesso e é encerrado ao final", async ({ page }) => {
    test.skip(!podeEscrever, "Alvo é produção; escrita pulada (rode contra o preview).");
    const marcador = marcadorPedido();
    try {
      await preencherPedido(page, {
        apresentacao: `Profissional em mudança de cidade, perfil tranquilo, sem pets. ${marcador}`,
      });
      // Sucesso: "Pedido publicado" → lista de pedidos com o recém-criado.
      await publicarPreenchido(page);
      await expect(page.locator("section", { hasText: marcador })).toBeVisible();
    } finally {
      await encerrarPedido(page, marcador); // limpeza idempotente
    }
  });
});
