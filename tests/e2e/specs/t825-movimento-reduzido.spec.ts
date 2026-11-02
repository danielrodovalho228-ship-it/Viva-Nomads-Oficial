import { test, expect } from "@playwright/test";

/*
  T825 — movimento reduzido (02/11, Pista A): com "reduzir movimento" no aparelho, os blocos que pulsam (animate-pulse)
  ficam parados; sem a preferência, continuam pulsando. Os giradores (animate-spin) seguem nos dois casos.
*/
async function animacao(page: import("@playwright/test").Page, classe: string) {
  return page.evaluate((c) => {
    const el = document.createElement("div");
    el.className = c;
    el.style.width = el.style.height = "20px";
    document.body.appendChild(el);
    const nome = getComputedStyle(el).animationName;
    el.remove();
    return nome;
  }, classe);
}

for (const preferencia of ["reduce", "no-preference"] as const) {
  test(`T825 — animate-pulse com prefers-reduced-motion: ${preferencia}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: preferencia });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible({ timeout: 30_000 });
    const pulso = await animacao(page, "animate-pulse");
    if (preferencia === "reduce") expect(pulso).toBe("none");
    else expect(pulso).not.toBe("none");
    expect(await animacao(page, "animate-spin")).not.toBe("none");
  });
}
