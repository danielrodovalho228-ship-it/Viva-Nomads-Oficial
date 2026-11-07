import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1394 — E670 (#3148): a linha sob o nome do candidato nunca mostra traço solto ("— · atenção") nem "atenção" sem motivo.
  Candidata sem categoria profissional e sem ficha de risco: a lista do dono (/dashboard/leads) e o perfil
  (/dashboard/leads/[id]) ou escondem a linha de resumo ou a mostram sem "—" e sem "atenção" vazia. "Enviada em" segue na tela.
  390 e 1280 px, sem estouro horizontal.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1394.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const inq = { email: `inq.t1394.${sufixo}@lab.vivanomads.test`, nome: "Ivo Inquilino", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string } = {};

test.describe("T1394 — E670: resumo do candidato sem traço solto", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio T1394 ${sufixo}`, { ativo: true });
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel);
  });
  test.afterAll(async () => {
    if (ids.lead) await adm().from("leads").delete().eq("id", ids.lead);
    await apagarContas([ids.dono, ids.inq]);
  });

  const semTracoSolto = (t: string) => {
    expect(t.trim()).not.toMatch(/^[—-]\s*(·|$)/);
    expect(t).not.toMatch(/(^|·\s*)atenção\s*$/);
  };

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: lista e perfil do candidato sem "— · atenção"`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
      await p.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
      await expect(p.getByText(`Studio T1394 ${sufixo}`).first()).toBeVisible({ timeout: 20_000 });
      for (const el of await p.getByTestId("candidato-resumo").all()) semTracoSolto((await el.textContent()) ?? "");
      expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

      await p.goto(`/dashboard/leads/${ids.lead}`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("perfil-candidato")).toBeVisible({ timeout: 20_000 });
      for (const el of await p.getByTestId("perfil-candidato-resumo").all()) semTracoSolto((await el.textContent()) ?? "");
      await expect(p.getByTestId("lead-enviada-em")).toContainText("Enviada em");
      expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await ctx.close();
    });
  }
});
