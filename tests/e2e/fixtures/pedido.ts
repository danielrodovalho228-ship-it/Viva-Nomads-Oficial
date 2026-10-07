import type { Page } from "@playwright/test";

/**
 * Helpers do Pedido de Moradia (T5 e T11) — criação e LIMPEZA idempotente.
 *
 * A cidade agora vem da lista do IBGE (UF primeiro, depois a cidade; o servidor
 * confere), então o marcador único do teste vai na APRESENTAÇÃO — texto que
 * aparece no card de "Meus pedidos" e no mural do dono. Só letras: um marcador
 * com muitos dígitos poderia ser lido como telefone pela trava de contato.
 * "Encerrar" = Marcar atendido (tira o pedido do mural ativo).
 */
export function marcadorPedido(): string {
  const letras = "abcdefghjkmnpqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 8; i++) s += letras[Math.floor(Math.random() * letras.length)];
  return `teste${s}`;
}

/** Marcador que identifica QUALQUER pedido de teste (varredura no teardown). */
export const MARCADOR_RE = /\bteste[a-z]{8}\b/;

/** Data no formato do campo (dd/mm/aaaa), `dias` a partir de hoje. */
export function dataBRDaqui(dias: number): string {
  const d = new Date(Date.now() + dias * 86400000);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

interface PreencherOpts {
  /** Apresentação (marcador do teste, ou o texto com contato do T5). */
  apresentacao: string;
  cidade?: string;
  uf?: string;
  orcamento?: string;
}

/** Preenche o formulário /pedidos/novo (sem publicar). */
export async function preencherPedido(page: Page, opts: PreencherOpts): Promise<void> {
  await page.goto("/pedidos/novo", { waitUntil: "networkidle" });
  await page.locator("select").filter({ has: page.locator('option[value="MG"]') }).first().selectOption(opts.uf ?? "MG");
  await page.getByPlaceholder("Comece a digitar a cidade").fill(opts.cidade ?? "Uberlândia");
  await page.getByPlaceholder("dd/mm/aaaa").fill(dataBRDaqui(7));
  await page.getByPlaceholder("3500").fill(opts.orcamento ?? "3200");
  // Motivo é um seletor customizado (botão → listbox).
  await page.getByText(/Selecione o motivo da estadia/i).click();
  await page.getByRole("option").first().click();
  await page.getByPlaceholder(/Conte um pouco do seu perfil/i).fill(opts.apresentacao);
}

/** Publica (formulário já preenchido) e vai para "Meus pedidos". */
export async function publicarPreenchido(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Publicar pedido/i }).click();
  await page.getByRole("heading", { name: "Pedido publicado" }).waitFor({ timeout: 20_000 });
  await page.getByRole("button", { name: "Ver meus pedidos" }).click();
  await page.waitForURL(/\/dashboard\/pedidos/, { timeout: 20_000 });
}

/** Encerra (Marca atendido) o pedido que contém o marcador. Best-effort. */
export async function encerrarPedido(page: Page, marcador: string): Promise<void> {
  await page.goto("/dashboard/pedidos", { waitUntil: "networkidle" });
  const card = page.locator("section", { hasText: marcador });
  if ((await card.count()) === 0) return; // já limpo
  const btn = card.getByRole("button", { name: /Marcar atendido/i });
  if ((await btn.count()) === 0) return;
  await btn.first().click();
  await page.waitForTimeout(1500);
}
