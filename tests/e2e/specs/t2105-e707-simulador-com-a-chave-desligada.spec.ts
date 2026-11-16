import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2105 — E707 (Pista 3; varredura "sem spec" das 142, lote E) @E707 — sem @ao-vivo-seguro: precisa de sessão e do
  laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E707 resíduo; unitário e707-simulador-reembolso.test.ts): o simulador /dashboard/reembolsos lê a
  chave CAUCAO_PRAZOS_ATIVA. Com a chave DESLIGADA — como está em produção e no laboratório, à espera do parecer da
  Dra. Beatriz — "nada muda": o prazo é de 30 dias a partir de hoje, não há campo de check-out e o texto fala do prazo
  legal após a entrega das chaves. Esta spec trava esse ramo (o único alcançável hoje); o ramo da chave ligada fica
  com o unitário até a chave ligar.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2105.${sufixo}@lab.vivanomads.test`, nome: "Rosa Reembolso", role: "owner" as const };
const ids: Record<string, string> = {};

/** A data de hoje (UTC, como a tela a lê) mais `dias`, em dd/mm/aaaa. */
function maisDias(hojeISO: string, dias: number): string {
  const d = new Date(`${hojeISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10).split("-").reverse().join("/");
}

test.describe("T2105 — E707: com a chave dos prazos desligada, o simulador dá 30 dias a partir de hoje @E707", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão).");
  test.skip(process.env.NEXT_PUBLIC_CAUCAO_PRAZOS_ATIVA === "on", "Esta spec trava o ramo da chave desligada.");
  test.describe.configure({ mode: "serial", timeout: 90_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — sem campo de check-out; Notificar registra hoje + 30 dias e libera o comprovante`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/reembolsos", { waitUntil: "domcontentloaded" });
      await expect(p.getByRole("heading", { name: "Reembolso da caução" }).first()).toBeVisible({ timeout: 30_000 });

      await expect(p.getByTestId("reembolso-checkout"), "chave desligada: não pede o check-out").toHaveCount(0);
      await expect(p.getByText("registra o prazo legal (devolução em até 30 dias após a entrega das chaves)", { exact: false })).toBeVisible();
      await expect(p.getByText("devida de imediato"), "o texto da chave ligada não aparece").toHaveCount(0);

      const comprovante = p.getByRole("button", { name: /Gerar comprovante/ });
      await expect(comprovante, "sem prazo registrado, sem comprovante").toBeDisabled();

      const hojeISO = await p.evaluate(() => new Date().toISOString().slice(0, 10));
      await p.getByRole("button", { name: /Notificar as partes/ }).click();
      await expect(p.getByText(/Prazo limite de devolução:/)).toContainText(maisDias(hojeISO, 30));
      await expect(comprovante).toBeEnabled();
      await p.context().close();
    });
  }
});
