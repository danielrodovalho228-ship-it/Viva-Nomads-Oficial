import { expect, type Page } from "@playwright/test";

/**
 * P3 (ORDEM-DUET-668): o esqueleto de carregamento saiu da tela. Os esqueletos da casa (src/components/ui/skeleton.tsx,
 * usados pelos loading.tsx do painel e do admin) são `role="status"` com `aria-label` a começar por "Carregando". Uma
 * trava que lê a tela antes de ele sair lê o esqueleto, não a página (a causa da t2219 a piscar, ORDEM-DUET-662).
 * Uso: depois do goto e antes de ler o conteúdo — `await esperarSemEsqueleto(page, "o painel do avaliador")`.
 */
export async function esperarSemEsqueleto(page: Page, tela = "a tela", timeout = 30_000): Promise<void> {
  await expect(page.locator('[role="status"][aria-label^="Carregando"]'), `${tela}: o esqueleto de carregamento saiu`).toHaveCount(0, { timeout });
}
