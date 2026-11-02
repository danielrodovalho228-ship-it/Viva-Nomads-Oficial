import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1036 — #2327 (ordem do Daniel, 02/11: "preservar o vínculo atual — nunca apagar"; migração 0283): um pedido novo de
 * vínculo profissional NUNCA apaga, troca nem rebaixa o selo confirmado. Pela tela real (Conta › Segurança e
 * verificações), 390 e 1280, uma conta por largura com o selo confirmado em vivanomads.com.br:
 *   1. pede um vínculo novo (e-mail em lab.vivanomads.com.br, o domínio da t608): o formulário do código abre e,
 *      enquanto isso, a linha segue com "Vínculo profissional confirmado · vivanomads.com.br" e o aviso "Seu vínculo
 *      atual (vivanomads.com.br) continua até você confirmar este código…"; no banco, dominio e confirmado_em intactos
 *      e o pedido em pedido_dominio;
 *   2. código ERRADO: recusado e o selo segue o mesmo (tela e banco);
 *   3. "Manter o atual": volta ao selo atual, sem o formulário; recarregada, o selo continua.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const ATUAL = "vivanomads.com.br";
const NOVO = "lab.vivanomads.com.br";
const CONFIRMADO = `Vínculo profissional confirmado · ${ATUAL}`;
const MANTEM = `Seu vínculo atual (${ATUAL}) continua até você confirmar este código. Se o código vencer ou for recusado, nada muda.`;
const ids: string[] = [];

async function linha(uid: string) {
  const { data } = await adm().from("vinculo_profissional").select("dominio, confirmado_em, pedido_dominio").eq("user_id", uid).single();
  return data as { dominio: string; confirmado_em: string | null; pedido_dominio: string | null };
}
async function abrirFormulario(p: Page) {
  const l = p.getByTestId("confianca-vinculo");
  await expect(l).toHaveAttribute("data-situacao", "ok", { timeout: 30_000 });
  await expect(async () => {
    if (!(await p.getByTestId("vinculo-form-email").isVisible())) await l.getByTestId("vinculo-abrir").click({ timeout: 5_000 });
    await expect(p.getByTestId("vinculo-form-email")).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
}

test.describe("T1036 — #2327: pedido novo de vínculo nunca apaga o vínculo atual", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 150_000 });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("vinculo_profissional").delete().in("user_id", ids);
    await adm().from("emails_teste").delete().in("usuario_id", ids);
    await apagarContas(ids);
  });

  for (const w of [390, 1280] as const) {
    test(`selo confirmado segue com o pedido novo, o código errado e o "Manter o atual" (${w})`, async ({ browser }) => {
      const conta = { email: `vin.t1036.${w}.${sufixo}@lab.vivanomads.test`, nome: `Valéria Vínculo ${w}`, role: "owner" as const };
      const uid = await criarConta(conta, senha);
      ids.push(uid);
      await adm().from("profiles").update({ is_teste: true }).eq("id", uid);
      const confirmadoEm = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { error } = await adm()
        .from("vinculo_profissional")
        .insert({ user_id: uid, dominio: ATUAL, codigo_hash: "t1036-antigo", expira_em: new Date(Date.now() - 29 * 86_400_000).toISOString(), tentativas: 5, confirmado_em: confirmadoEm });
      if (error) throw error;

      const p = await entrar(browser, conta.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/dashboard/conta/seguranca", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("vinculo-detalhe")).toHaveText(CONFIRMADO, { timeout: 30_000 });

      // 1. Pedido novo: o selo atual fica na tela e no banco.
      await abrirFormulario(p);
      const form = p.getByTestId("vinculo-form-email");
      await form.locator("#vinculo-email").fill(`valeria.t1036.${w}.${sufixo}@${NOVO}`);
      await form.getByRole("button", { name: "Enviar código" }).click();
      await expect(p.getByTestId("vinculo-form-codigo")).toBeVisible({ timeout: 20_000 });
      await expect(p.getByTestId("vinculo-detalhe")).toHaveText(CONFIRMADO);
      await expect(p.getByTestId("confianca-vinculo")).toHaveAttribute("data-situacao", "ok");
      await expect(p.getByTestId("vinculo-mantem-atual")).toHaveText(MANTEM);
      let l = await linha(uid);
      expect(l.dominio, "o selo não troca no pedido").toBe(ATUAL);
      expect(l.confirmado_em, "o selo não é rebaixado").toBeTruthy();
      expect(l.pedido_dominio, "o pedido fica separado").toBe(NOVO);

      // 2. Código errado: recusado, o selo segue o mesmo.
      const fc = p.getByTestId("vinculo-form-codigo");
      await fc.locator("#vinculo-codigo").fill("000000");
      await fc.getByRole("button").first().click();
      await expect(p.getByTestId("vinculo-erro")).toBeVisible({ timeout: 20_000 });
      await expect(p.getByTestId("vinculo-detalhe")).toHaveText(CONFIRMADO);
      l = await linha(uid);
      expect(l.dominio).toBe(ATUAL);
      expect(l.confirmado_em).toBeTruthy();

      // 3. "Manter o atual": volta ao selo, sem o formulário; recarregada, continua.
      await p.getByTestId("vinculo-manter-atual").click();
      await expect(p.getByTestId("vinculo-form-codigo")).toHaveCount(0);
      await expect(p.getByTestId("vinculo-detalhe")).toHaveText(CONFIRMADO);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await p.reload({ waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("vinculo-detalhe")).toHaveText(CONFIRMADO, { timeout: 30_000 });
      l = await linha(uid);
      expect(l.dominio).toBe(ATUAL);
      expect(l.confirmado_em).toBeTruthy();
      await p.context().close();
    });
  }
});
