import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1331 — E657 (#3057): em "Minhas candidaturas" (/dashboard/candidaturas), o "Enviada em" segue o calendário de Brasília,
  não o de UTC. Uma candidatura criada às 01:30 UTC de 07/11 foi enviada às 22:30 de 06/11 em Brasília e tem de mostrar
  06/11/2026; às 03:30 UTC de 07/11 já é 00:30 de 07/11 em Brasília e mostra 07/11/2026 (os dois lados da meia-noite de
  Brasília). Comportamento central (a data exibida), a 390 e 1280 px, sessão real da inquilina.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1331.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const inq = { email: `inq.t1331.${sufixo}@lab.vivanomads.test`, nome: "Ivo Inquilino", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovelA?: string; imovelB?: string; imovelC?: string; leads: string[] } = { leads: [] };

test.describe("T1331 — E657: data de envio da candidatura em horário de Brasília", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovelA = await criarImovelPronto(ids.dono, `Studio T1331 A ${sufixo}`, { ativo: true });
    ids.imovelB = await criarImovelPronto(ids.dono, `Studio T1331 B ${sufixo}`, { ativo: true });
    ids.imovelC = await criarImovelPronto(ids.dono, `Studio T1331 C ${sufixo}`, { ativo: true });
    for (const [imovel, criadoEm] of [
      [ids.imovelA, "2026-11-07T01:30:00+00:00"],
      [ids.imovelB, "2026-11-07T03:30:00+00:00"],
    ] as const) {
      const { data, error } = await adm().from("leads").insert({ property_id: imovel, owner_id: ids.dono, tenant_id: ids.inq, status: "new", created_at: criadoEm }).select("id").single();
      expect(error).toBeNull();
      ids.leads.push(data!.id as string);
    }
    // E657 (#3083, migração 0315): candidatura criada em 04/11 e REENVIADA em 06/11 (15:00 UTC = 12:00 em Brasília) mostra o reenvio.
    const { data: reenv, error: eReenv } = await adm().from("leads").insert({ property_id: ids.imovelC, owner_id: ids.dono, tenant_id: ids.inq, status: "new", created_at: "2026-11-04T12:00:00+00:00", reenviada_em: "2026-11-06T15:00:00+00:00" }).select("id").single();
    expect(eReenv).toBeNull();
    ids.leads.push(reenv!.id as string);
  });
  test.afterAll(async () => {
    if (ids.leads.length) await adm().from("leads").delete().in("id", ids.leads);
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: "Enviada em" mostra o dia de Brasília nos dois lados da meia-noite`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      const p = await entrarNaPagina(await ctx.newPage(), inq.email, senha);
      await p.goto("/dashboard/candidaturas", { waitUntil: "domcontentloaded" });
      const a = p.locator(`#candidatura-${ids.leads[0]}`);
      const b = p.locator(`#candidatura-${ids.leads[1]}`);
      await expect(a).toBeVisible({ timeout: 20_000 });
      await expect(b).toBeVisible();
      // 01:30 UTC de 07/11 = 22:30 de 06/11 em Brasília (antes do conserto mostrava 07/11).
      await expect(a).toContainText("Enviada em 06/11/2026");
      await expect(a).not.toContainText("Enviada em 07/11/2026");
      // 03:30 UTC de 07/11 = 00:30 de 07/11 em Brasília.
      await expect(b).toContainText("Enviada em 07/11/2026");
      // Reenvio: a data mostrada é a do último envio (06/11), com a marca "Reenviada"; as outras duas não são reenvios.
      const c = p.locator(`#candidatura-${ids.leads[2]}`);
      await expect(c).toContainText("Enviada em 06/11/2026");
      await expect(c).not.toContainText("Enviada em 04/11/2026");
      await expect(c.getByTestId("candidatura-reenviada")).toBeVisible();
      await expect(a.getByTestId("candidatura-reenviada")).toHaveCount(0);
      await expect(b.getByTestId("candidatura-reenviada")).toHaveCount(0);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await ctx.close();
    });
  }
});
