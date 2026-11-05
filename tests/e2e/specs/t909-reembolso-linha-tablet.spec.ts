import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T909 — Varredura (passada 15, 768 px): no Reembolso da caução, a linha "Motivo · Valor · Evidência · Adicionar" tinha 4
  colunas já a 640 px — no tablet os campos se sobrepunham e o "Adicionar" saía da tela (rolagem lateral de 101 px). Agora
  1 coluna no celular e 2 a partir do tablet: nenhuma rolagem lateral, nenhum campo sobre outro, nada fora da linha.
  390, 768 e 1280, sessão real (morador).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const mor = { email: `mor.t909.${sufixo}@lab.vivanomads.test`, nome: "Rosa Reembolso", role: "tenant" as const };
const ids: string[] = [];

test.describe("T909 — Reembolso: a linha de desconto cabe no celular, no tablet e no computador", () => {
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
      const linha = p.getByTestId("reembolso-linha-desconto");
      await expect(linha).toBeVisible({ timeout: 30_000 });
      const r = await linha.evaluate((el) => {
        const k = [...el.children].map((c) => c.getBoundingClientRect());
        let sobre = 0;
        for (let i = 0; i < k.length; i++)
          for (let j = i + 1; j < k.length; j++)
            if (!(k[i].right <= k[j].left || k[i].left >= k[j].right || k[i].bottom <= k[j].top || k[i].top >= k[j].bottom)) sobre++;
        const pr = el.getBoundingClientRect();
        return { lateral: document.documentElement.scrollWidth - innerWidth, sobre, fora: k.filter((c) => c.right > pr.right + 1).length };
      });
      expect({ sobre: r.sobre, fora: r.fora }, JSON.stringify(r)).toEqual({ sobre: 0, fora: 0 });
      expect(r.lateral, "rolagem lateral").toBeLessThanOrEqual(1);
      await linha.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `tests/laboratorio/saida/t909-reembolso-${w}.png` });
      await ctx.close();
    });
  }
});
