import { expect, type Locator } from "@playwright/test";

/*
  Calendário do dono no Passo 9 (Pista C, t484–t486): os dias livres da grade e a marcação de um período, com a espera
  da hidratação (o clique antes dela não marca o dia — run 40190996396, t425).
*/

/** Dias (AAAA-MM-DD) clicáveis da grade, em ordem. */
export async function diasLivres(etapa: Locator): Promise<string[]> {
  const grade = etapa.getByTestId("calendario-dono-grade");
  await expect(grade).toBeVisible({ timeout: 40_000 });
  const dias = await grade.locator("button[data-dia]:not([disabled])").evaluateAll((els) => els.map((e) => e.getAttribute("data-dia") ?? ""));
  return [...new Set(dias.filter(Boolean))].sort();
}

/** Marca o período ini→fim até o "Bloquear período" destravar; devolve o botão. */
export async function marcarPeriodo(etapa: Locator, ini: string, fim: string): Promise<Locator> {
  const bloquear = etapa.getByRole("button", { name: "Bloquear período" });
  await expect(async () => {
    await etapa.locator(`button[data-dia="${ini}"]`).first().click({ timeout: 5_000 });
    await etapa.locator(`button[data-dia="${fim}"]`).first().click({ timeout: 5_000 });
    await expect(bloquear, "o período marcado destrava o Bloquear").toBeEnabled({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  return bloquear;
}
