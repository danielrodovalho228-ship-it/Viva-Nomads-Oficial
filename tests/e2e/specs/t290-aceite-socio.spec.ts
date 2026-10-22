import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { adm, NO_LABORATORIO } from "../fixtures/laboratorio";

/**
 * T290 — ACEITE DO SÓCIO (ordem 3c3d8a9e, parte 1): pedido → o Moacir entrega → "Aguardando seu aceite" →
 * "Reabrir" (com o que falta) volta a "Em andamento" → entrega de novo → "Aceito" vira "Feito". Outro sócio não aceita.
 * Só no laboratório (precisa do banco local para fazer o papel do Moacir).
 */
test.describe("T290 — Aceite do sócio", () => {
  test.skip(!NO_LABORATORIO, "Só roda no laboratório (banco local).");
  test.use({ storageState: authFile("admin") });

  test("pedido → aguardando aceite → reabrir → aceito, e quem não pediu não aceita", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    const msg = `Pedido do aceite ${Date.now()}`;
    await page.goto("/admin/socios", { waitUntil: "networkidle" });
    await page.getByLabel("Mensagem").fill(msg);
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Enviado" })).toBeVisible();

    const { data: linha } = await adm().from("caixa_socios").select("id").eq("texto", msg).single();
    const id = linha!.id as string;

    // O Moacir entrega dizendo "feito": a função converte para aguardando_aceite (ninguém fecha pelo sócio).
    await adm().rpc("responder_caixa_socios", { p_id: id, p_status: "feito", p_resposta: "Entregue." });
    expect((await adm().from("caixa_socios").select("status").eq("id", id).single()).data?.status).toBe("aguardando_aceite");

    await page.goto("/admin/socios", { waitUntil: "networkidle" });
    const cartao = page.locator("li").filter({ hasText: msg });
    await expect(cartao.getByText("Aguardando seu aceite").first()).toBeVisible();

    // Reabrir exige o que falta.
    await cartao.getByRole("button", { name: "Reabrir", exact: true }).click();
    await expect(cartao.getByRole("button", { name: "Reabrir com este texto" })).toBeDisabled();
    await cartao.getByLabel("O que falta?").fill("Faltou o print da tela.");
    await cartao.getByRole("button", { name: "Reabrir com este texto" }).click();
    await expect(cartao.getByText("Reaberto: Faltou o print da tela.")).toBeVisible();
    const aberto = (await adm().from("caixa_socios").select("status, reaberto_motivo").eq("id", id).single()).data;
    expect(aberto).toMatchObject({ status: "em_andamento", reaberto_motivo: "Faltou o print da tela." });

    // O Moacir enxerga o item reaberto, com o motivo.
    const { data: pend } = await adm().rpc("caixa_socios_pendentes");
    expect((pend as Array<{ id: string; reaberto_motivo: string }>).find((p) => p.id === id)?.reaberto_motivo).toBe("Faltou o print da tela.");

    // Nova entrega e aceite.
    await adm().rpc("responder_caixa_socios", { p_id: id, p_status: "aguardando_aceite", p_resposta: "Agora com o print." });
    await page.goto("/admin/socios", { waitUntil: "networkidle" });
    await cartao.getByRole("button", { name: "Aceito", exact: true }).click();
    await expect(cartao.getByText("Feito", { exact: true })).toBeVisible();
    const aceito = (await adm().from("caixa_socios").select("status, aceito_por, aceito_em").eq("id", id).single()).data;
    expect(aceito?.status).toBe("feito");
    expect(aceito?.aceito_por).toBeTruthy();
    expect(aceito?.aceito_em).toBeTruthy();

    // Outro autor: o item aguarda o aceite de quem pediu, sem botões para mim.
    const { data: outro } = await adm().from("profiles").select("id").neq("role", "admin").limit(1).single();
    await adm().from("caixa_socios").update({ autor: outro!.id, status: "aguardando_aceite" }).eq("id", id);
    await page.goto("/admin/socios", { waitUntil: "networkidle" });
    await expect(cartao.getByText(/Aguardando o aceite de/)).toBeVisible();
    await expect(cartao.getByRole("button", { name: "Aceito", exact: true })).toHaveCount(0);

    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sobra).toBeLessThanOrEqual(1);
    await adm().from("caixa_socios").delete().eq("id", id);
  });
});
