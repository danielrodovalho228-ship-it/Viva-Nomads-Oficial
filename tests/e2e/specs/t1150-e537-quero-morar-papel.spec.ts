import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1150 — E537 (#2604, 05/11): em Conta › Papéis (/dashboard/conta/papeis), o interruptor "Quero morar" reflete o papel
 * de verdade. Antes lia só a intenção declarada: com o papel de morador EM USO e intenção ["anunciar"] (inquilino2,
 * qa-muse-2), aparecia desligado ao lado de Morador "Em uso". Agora liga com a intenção OU o papel em uso e, em uso,
 * fica travado com o texto de como trocar. Duas contas novas com intenção ["anunciar"], 390 e 1280:
 *   1. morador em uso: "Quero morar" ligado (aria-checked), desabilitado e com o aviso papel-morar-em-uso;
 *   2. proprietário em uso (controle): "Quero morar" desligado, habilitado e sem o aviso;
 *   3. sem estouro horizontal.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const morador = { email: `inq.t1150.${sufixo}@lab.vivanomads.test`, nome: "Mara Morar", role: "tenant" as const };
const dono = { email: `dono.t1150.${sufixo}@lab.vivanomads.test`, nome: "Dino Dono", role: "owner" as const };
const ids: { morador?: string; dono?: string } = {};

test.describe("T1150 — E537: 'Quero morar' segue o papel em uso, não só a intenção", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
    ids.dono = await criarConta(dono, senha);
    const { error: eM } = await adm().from("profiles").update({ intencao: ["anunciar"], papel_ativo: "morador", preferred_mode: "tenant" }).eq("id", ids.morador);
    expect(eM, eM?.message).toBeNull();
    const { error: eD } = await adm().from("profiles").update({ intencao: ["anunciar"], papel_ativo: "proprietario", preferred_mode: "owner" }).eq("id", ids.dono);
    expect(eD, eD?.message).toBeNull();
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.morador, ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`morador em uso: ligado e travado; proprietário em uso: desligado e livre (${w})`, async ({ browser }) => {
      for (const caso of [
        { conta: morador, ligado: "true", travado: true },
        { conta: dono, ligado: "false", travado: false },
      ]) {
        const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
        try {
          const p = await entrarNaPagina(await ctx.newPage(), caso.conta.email, senha);
          await p.goto("/dashboard/conta/papeis", { waitUntil: "domcontentloaded" });
          const chave = p.getByTestId("papel-morar-toggle");
          await expect(chave, caso.conta.nome).toBeVisible({ timeout: 30_000 });
          await expect(chave, caso.conta.nome).toHaveAttribute("aria-checked", caso.ligado, { timeout: 15_000 });
          if (caso.travado) {
            await expect(chave).toBeDisabled();
            await expect(p.getByTestId("papel-morar-em-uso")).toBeVisible();
          } else {
            await expect(chave).toBeEnabled();
            await expect(p.getByTestId("papel-morar-em-uso")).toHaveCount(0);
          }
          expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), caso.conta.nome).toBeLessThanOrEqual(1);
        } finally {
          await ctx.close();
        }
      }
    });
  }
});
