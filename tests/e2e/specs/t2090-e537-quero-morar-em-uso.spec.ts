import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2090 — E537 (Pista 3; varredura "sem spec" do mapa das 142, ronda 08:24Z) @E537 — sem @ao-vivo-seguro: precisa de
  sessão e do laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E537): em Conta › Papéis, "Quero morar" fica LIGADO quando a intenção tem "morar" OU o papel de
  morador está EM USO (a mesma regra do "Em uso"). Em uso, o interruptor fica travado ligado, com a frase de como trocar
  de papel. O caso do QA: conta no modo morador com a intenção só ["anunciar"] — antes o interruptor aparecia desligado.
  O unitário e537-quero-morar-papel.test.ts fixa a regra; esta spec prova na tela.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `inq.t2090.${sufixo}@lab.vivanomads.test`, nome: "Ines Papel", role: "tenant" as const };
const ids: Record<string, string> = {};

test.describe("T2090 — E537: Quero morar ligado e travado quando o papel de morador está em uso @E537", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
    // Em uso como morador, mas a intenção declarada é só "anunciar" (o caso que mostrava o interruptor desligado).
    await adm().from("profiles").update({ preferred_mode: "tenant", intencao: ["anunciar"] }).eq("id", ids.conta);
  });
  test.afterAll(async () => {
    await apagarContas([ids.conta]);
  });

  for (const largura of [390, 1280]) {
    test(`${largura} px — Conta › Papéis: Quero morar ligado, travado, com a frase do Em uso`, async ({ browser }) => {
      const p = await entrar(browser, conta.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/conta/papeis", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("tela-papeis")).toBeVisible({ timeout: 30_000 });
      const morar = p.getByTestId("papel-morar-toggle");
      await expect(morar).toHaveAttribute("aria-checked", "true");
      await expect(morar).toBeDisabled();
      await expect(p.getByTestId("papel-morar-em-uso")).toContainText("Em uso");
      await p.context().close();
    });
  }
});
