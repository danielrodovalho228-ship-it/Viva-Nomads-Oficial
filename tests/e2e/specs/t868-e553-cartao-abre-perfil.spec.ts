import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T868 — E553 (parte VISUAL): em Interessados (/dashboard/leads), o nome do candidato é link (padrão dos títulos do
  painel: tinta, verde ao passar) e a foto/avatar abre o mesmo perfil completo (/dashboard/leads/<id>, rota da #2564).
  Clicar no nome leva ao perfil, com a mesma máscara do cartão. 390 e 1280, sessão real.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t868.${sufixo}@lab.vivanomads.test`, nome: "Dalva Dona", role: "owner" as const };
const inq = { email: `inq.t868.${sufixo}@lab.vivanomads.test`, nome: "Iara Sobrenomeoculto", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string } = {};

test.describe("T868 — cartão do candidato abre o perfil completo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio T868 ${sufixo}`, { ativo: true });
    const { data, error } = await adm().from("leads").insert({ property_id: ids.imovel, owner_id: ids.dono, tenant_id: ids.inq, status: "new" }).select("id").single();
    expect(error).toBeNull();
    ids.lead = data!.id as string;
  });
  test.afterAll(async () => {
    if (ids.lead) await adm().from("leads").delete().eq("id", ids.lead);
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: nome e foto levam ao perfil do candidato`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
      await p.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
      const cartao = p.locator(`#candidato-${ids.lead}`);
      await expect(cartao).toBeVisible({ timeout: 20_000 });
      const nome = cartao.getByTestId("candidato-perfil-link");
      await expect(nome).toHaveAttribute("href", `/dashboard/leads/${ids.lead}`);
      await expect(cartao.getByTestId("candidato-perfil-foto")).toHaveAttribute("href", `/dashboard/leads/${ids.lead}`);
      // Mesmo padrão dos títulos do painel: a cor do texto do título, sem sublinhado.
      const [corNome, corTitulo, sublinhado] = await nome.evaluate((a) => [getComputedStyle(a).color, getComputedStyle(a.closest("h2")!).color, getComputedStyle(a).textDecorationLine]);
      expect(corNome).toBe(corTitulo);
      expect(sublinhado).toBe("none");
      expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await cartao.screenshot({ path: `tests/laboratorio/saida/t868-cartao-${w}.png` });
      await nome.click();
      await p.waitForURL(new RegExp(`/dashboard/leads/${ids.lead}$`), { timeout: 20_000 });
      const perfil = p.getByTestId("perfil-candidato");
      await expect(perfil).toBeVisible({ timeout: 20_000 });
      await expect(perfil).toContainText("Candidato(a)");
      await expect(perfil).not.toContainText("Sobrenomeoculto");
      await ctx.close();
    });
  }
});
