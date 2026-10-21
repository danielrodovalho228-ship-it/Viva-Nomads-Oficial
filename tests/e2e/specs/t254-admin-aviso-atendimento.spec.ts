import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { adm, NO_LABORATORIO } from "../fixtures/laboratorio";

/**
 * T254 — Admin: a linha vermelha no topo do /admin conta só chamados REAIS esperando a equipe
 * há 2 h ou mais (ordem 7436a29a, item 5). Chamado de teste (simulacao=true) não entra na conta.
 */
test.describe("T254 — Admin: aviso de atendimento no topo", () => {
  test.use({ storageState: authFile("admin") });
  // Em série: o cenário 1 cria e o afterAll apaga chamados reais, o que mexe na contagem que o cenário 2 compara.
  test.describe.configure({ mode: "serial" });
  const marca = `Lab T254 ${Date.now()}`;
  const ids: string[] = [];

  const chamado = (simulacao: boolean) => {
    const agora = Date.now();
    return {
      visitante_email: "lab-t254@lab.vivanomads.test",
      visitante_nome: "Lab T254",
      tipo: "suporte",
      categoria: "outro",
      prioridade: "p3",
      status: "aberto",
      canal: "site",
      assunto: marca,
      responsavel_tipo: "humano",
      prazo_primeira_resposta: new Date(agora + 3_600_000).toISOString(),
      prazo_resolucao: new Date(agora + 86_400_000).toISOString(),
      criado_em: new Date(agora - 3 * 3_600_000).toISOString(),
      simulacao,
    };
  };

  test.afterAll(async () => {
    if (NO_LABORATORIO && ids.length) await adm().from("chamados").delete().in("id", ids);
  });

  test("chamado real sem resposta há 3 h acende a linha; a 390 px não rola de lado", async ({ page }) => {
    test.skip(!NO_LABORATORIO, "Precisa do banco do laboratório.");
    const { data, error } = await adm().from("chamados").insert(chamado(false)).select("id").single();
    if (error) throw error;
    ids.push(data.id as string);
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    const aviso = page.getByTestId("aviso-atendimento-admin");
    await expect(aviso).toBeVisible({ timeout: 20_000 });
    await expect(aviso).toContainText("sem resposta da equipe há 2 h ou mais");
    await expect(aviso.getByRole("link", { name: "Abrir a fila" })).toHaveAttribute("href", "/admin/atendimento");
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra).toBeLessThanOrEqual(0);
  });

  test("a contagem não muda por causa de chamado de teste (simulacao=true)", async ({ page }) => {
    test.skip(!NO_LABORATORIO, "Precisa do banco do laboratório.");
    const lerContagem = async () => {
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      const aviso = page.getByTestId("aviso-atendimento-admin");
      await expect(aviso).toBeVisible({ timeout: 20_000 });
      return (await aviso.innerText()).split("\n")[0];
    };
    // O aviso só aparece com chamado real atrasado. Os testes rodam em paralelo, então este cria o seu próprio
    // em vez de depender do cenário de cima.
    const real = await adm().from("chamados").insert(chamado(false)).select("id").single();
    if (real.error) throw real.error;
    ids.push(real.data.id as string);
    const antes = await lerContagem();
    const { data, error } = await adm().from("chamados").insert(chamado(true)).select("id").single();
    if (error) throw error;
    ids.push(data.id as string);
    expect(await lerContagem()).toBe(antes);
  });
});
