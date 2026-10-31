import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T766 — L-54 (#1674, Pista B): "Dados salvos." só aparece quando a data de nascimento foi gravada de verdade. O defeito
  era a tela dizer "salvo" com profiles.data_nascimento ainda null (o update da sessão devolvia 0 linhas sem erro); o
  #1674 passou a conferir a linha devolvida. Pista C, bloco 99. Pela tela de verdade (Conta › Meus dados), a 1280 e a
  390 px, cada largura com uma conta própria e uma data diferente: a mensagem de salvo aparece, o banco tem a data no
  mesmo instante (sem espera) e a tela devolve a data depois de recarregar.
*/
const ROTA = "/dashboard/conta/dados";
const senha = novaSenha();
const sufixo = novoSufixo();
const CASOS = [
  { largura: 1280, digitar: "14031991", tela: "14/03/1991", iso: "1991-03-14" },
  { largura: 390, digitar: "02111988", tela: "02/11/1988", iso: "1988-11-02" },
] as const;
const ids: Record<number, string> = {};

test.describe("T766 — L-54: a data de nascimento grava quando a tela diz salvo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    for (const c of CASOS) ids[c.largura] = await criarConta({ email: `nasc.t766.${c.largura}.${sufixo}@lab.vivanomads.test`, nome: "Nara Nascimento", role: "tenant" }, senha);
  });
  test.afterAll(async () => {
    await apagarContas(Object.values(ids));
  });

  for (const c of CASOS) {
    test(`${c.largura} px: "Dados salvos." vem com a data no banco e a data volta depois de recarregar`, async ({ browser }) => {
      const nascimento = async () => ((await adm().from("profiles").select("data_nascimento").eq("id", ids[c.largura]).maybeSingle()).data as { data_nascimento?: string | null } | null)?.data_nascimento ?? null;
      expect(await nascimento()).toBeNull();
      const p = await entrar(browser, `nasc.t766.${c.largura}.${sufixo}@lab.vivanomads.test`, senha);
      await p.setViewportSize({ width: c.largura, height: c.largura === 390 ? 844 : 900 });
      await p.goto(ROTA, { waitUntil: "domcontentloaded" });
      const campo = p.getByTestId("dados-nascimento");
      await campo.waitFor({ timeout: 20_000 });
      await campo.fill(c.digitar);
      await expect(campo).toHaveValue(c.tela);
      await p.getByTestId("dados-salvar").click();
      await expect(p.getByText("Dados salvos.")).toBeVisible({ timeout: 20_000 });
      await expect(p.getByTestId("meus-dados").getByRole("alert")).toHaveCount(0);
      // O "salvo" só sai depois do update conferido: a data já está no banco quando a mensagem aparece.
      expect(await nascimento()).toBe(c.iso);
      await p.reload({ waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("dados-nascimento")).toHaveValue(c.tela, { timeout: 20_000 });
      await p.context().close();
    });
  }
});
