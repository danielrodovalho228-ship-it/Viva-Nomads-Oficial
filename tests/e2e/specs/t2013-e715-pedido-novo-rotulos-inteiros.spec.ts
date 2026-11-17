import { test, expect } from "@playwright/test";

/*
  T2013 — E715 (Pista 3, testes dos itens "sem spec"). Comportamento decidido:
  "/pedidos/novo a 390px: rótulos dos botões inteiros, sem corte com '…'".
  Correção: d6fb7922 (merge do #3360). Antes dela, o rótulo dos botões de marca ("Mobiliado completo", "300 Mbps" …)
  ficava numa linha só com reticências dentro do botão de 48 px.

  O teste mede o que a pessoa vê: para cada botão de marca/escolha do formulário, o rótulo cabe na própria caixa
  (largura e altura renderizadas >= largura e altura do conteúdo). Um rótulo cortado com "…" tem conteúdo maior que a
  caixa, qualquer que seja a classe que o corte.
  Página pública, sem login e sem gravar nada: segura para rodar contra produção.
*/

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("T2013 — /pedidos/novo a 390 px @E715 @ao-vivo-seguro", () => {
  test("todo rótulo de botão de escolha aparece inteiro, sem '…'", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/pedidos/novo", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Publique seu pedido" })).toBeVisible();

    const grupos = ["pedido-quartos", "pedido-necessidades", "pedido-internet"];
    for (const g of grupos) await expect(page.getByTestId(g)).toBeVisible();

    const rotulos = await page.locator("form button[aria-pressed]").evaluateAll((botoes) =>
      botoes
        .filter((b) => (b as HTMLElement).offsetParent !== null)
        .map((b) => {
          const texto = (b.textContent ?? "").replace(/\s+/g, " ").trim();
          const span = Array.from(b.querySelectorAll("span")).find((s) => (s.textContent ?? "").trim() === texto) as
            | HTMLElement
            | undefined;
          const el = span ?? (b as HTMLElement);
          return {
            texto,
            testid: b.getAttribute("data-testid"),
            sobraLargura: el.scrollWidth - el.clientWidth,
            sobraAltura: el.scrollHeight - el.clientHeight,
          };
        }),
    );

    // Os botões das três grades do formulário estão todos na conta (quartos, necessidades e internet).
    for (const g of grupos) expect(rotulos.some((r) => r.testid?.startsWith(g.replace("necessidades", "nec"))), g).toBe(true);
    expect(rotulos.length).toBeGreaterThanOrEqual(8);

    const cortados = rotulos.filter((r) => r.sobraLargura > 1 || r.sobraAltura > 1);
    expect(cortados, `rótulos cortados: ${cortados.map((c) => `"${c.texto}" (${c.testid})`).join(", ")}`).toEqual([]);
  });
});
