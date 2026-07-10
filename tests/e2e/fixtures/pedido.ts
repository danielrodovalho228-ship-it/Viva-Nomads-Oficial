import type { Page } from "@playwright/test";

/**
 * Helpers do T5 (Pedido de Moradia) — criação e LIMPEZA idempotente.
 *
 * Como o formulário não tem título, usamos a CIDADE como marcador único e
 * reconhecível (`E2E-<ts>-<rnd>`): identifica o pedido do teste sem colidir com
 * dado real e permite encerrá-lo no teardown. "Encerrar" = Marcar atendido
 * (tira o pedido do mural ativo) — a plataforma não expõe exclusão dura.
 */
export function marcadorCidade(): string {
  return `E2E-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/** Marcador que identifica QUALQUER cidade de teste (varredura no teardown). */
export const MARCADOR_RE = /E2E-\d+/;

interface PreencherOpts {
  cidade: string;
  /** Texto da apresentação (para T5 com/sem contato). Vazio = deixa em branco. */
  apresentacao?: string;
}

/** Preenche o formulário /pedidos/novo (sem publicar). */
export async function preencherPedido(page: Page, opts: PreencherOpts): Promise<void> {
  await page.goto("/pedidos/novo", { waitUntil: "networkidle" });
  await page.locator('input[placeholder="Uberlândia"]').first().fill(opts.cidade);
  const dataFutura = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  await page.locator('input[type="date"]').first().fill(dataFutura);
  await page.locator('input[placeholder="3500"]').first().fill("3000");
  // Motivo é um seletor customizado (botão → listbox).
  await page.getByRole("button", { name: /Selecione o motivo/i }).click();
  await page.getByRole("option").first().click();
  if (opts.apresentacao !== undefined) {
    await page.locator("textarea").first().fill(opts.apresentacao);
  }
}

/** Encerra (Marca atendido) o pedido cuja cidade contém o marcador. Best-effort. */
export async function encerrarPedido(page: Page, cidade: string): Promise<void> {
  await page.goto("/dashboard/pedidos", { waitUntil: "networkidle" });
  const card = page.locator("section", { hasText: cidade });
  if ((await card.count()) === 0) return; // já limpo
  const btn = card.getByRole("button", { name: /Marcar atendido/i });
  if ((await btn.count()) === 0) return;
  await btn.first().click();
  await page.waitForTimeout(1500);
}
