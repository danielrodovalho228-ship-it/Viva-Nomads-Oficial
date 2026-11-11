import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T909 — Varredura (passada 15, 768 px): no Reembolso da caução, a linha "Motivo · Valor · Evidência · Adicionar" tinha 4
  colunas já a 640 px — no tablet os campos se sobrepunham e o "Adicionar" saía da tela (rolagem lateral de 101 px). Agora
  1 coluna no celular e 2 a partir do tablet: nenhuma rolagem lateral, nenhum campo sobre outro, nada fora da linha.
  390, 768 e 1280, sessão real (morador). A linha só existe no exemplo do modo demonstração (admin); a conta real vê o
  estado honesto, sem rolagem lateral — é isso que esta spec confere (rodada 5eb1fad9). O desenho da linha fica no
  unitário src/app/(dashboard)/dashboard/reembolsos/linha-desconto-768.test.ts.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const mor = { email: `mor.t909.${sufixo}@lab.vivanomads.test`, nome: "Rosa Reembolso", role: "tenant" as const };
const ids: string[] = [];

test.describe("T909 — Reembolso: a conta real vê o estado honesto no celular, no tablet e no computador", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    const id = await criarConta(mor, senha);
    ids.push(id);
    await adm().from("profiles").update({ is_teste: true, preferred_mode: "tenant", papel_ativo: "morador" }).eq("id", id);
  });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const w of [390, 768, 1280] as const) {
    test(`a ${w} px`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: 1024 } });
      const p = await entrarNaPagina(await ctx.newPage(), mor.email, senha);
      await p.goto("/dashboard/reembolsos", { waitUntil: "domcontentloaded" });
      // A linha "Motivo · Valor · Evidência · Adicionar" é do exemplo (ReembolsoPreview), que só o admin vê no modo
      // demonstração. A conta real vê o estado honesto; o desenho da linha fica no unitário linha-desconto-768.test.ts.
      await expect(p.getByText("A devolução da caução fica no contrato")).toBeVisible({ timeout: 30_000 });
      await expect(p.getByRole("link", { name: "Ver contratos e locações" })).toBeVisible();
      await expect(p.getByTestId("reembolso-linha-desconto")).toHaveCount(0);
      const lateral = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(lateral, "rolagem lateral").toBeLessThanOrEqual(1);
      await p.screenshot({ path: `tests/laboratorio/saida/t909-reembolso-${w}.png` });
      await ctx.close();
    });
  }
});
