import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1609 — E796 (t373, regressão da rodada fatiada de 12/11): a data de nascimento digitada em Conta › Dados não pode ser
  apagada pela leitura da data gravada que chega DEPOIS. O campo só fica editável quando a data gravada chegou (como o
  telefone desde o E372), e o que a pessoa digita é o que se grava.
  Determinístico: as Server Actions da tela (leituras e gravações) respondem com 2,5 s de atraso.
*/
const ROTA = "/dashboard/conta/dados";
const ATRASO_MS = 2_500;

test.describe("T1609 — E796: data de nascimento não é apagada pela leitura atrasada", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 150_000 });
  const senha = novaSenha();
  const conta = { email: `inq.t1609.${novoSufixo()}@lab.vivanomads.test`, nome: "Nina Nascimento", role: "tenant" as const };
  let id = "";
  const nascimento = async () =>
    ((await adm().from("profiles").select("data_nascimento").eq("id", id).maybeSingle()).data as { data_nascimento?: string | null } | null)?.data_nascimento ?? null;

  test.beforeAll(async () => {
    id = await criarConta(conta, senha);
  });
  test.afterAll(async () => {
    await apagarContas([id]);
  });

  test("390 px: com as leituras atrasadas, o campo espera a data gravada e o que se digita é o que se grava", async ({ browser }) => {
    const p = await entrar(browser, conta.email, senha);
    // Atrasa toda Server Action desta tela (getNascimento, getMeusDados, salvar…): a leitura chega depois da digitação.
    await p.route(`**${ROTA}*`, async (rota) => {
      if (rota.request().method() === "POST" && rota.request().headers()["next-action"]) await new Promise((r) => setTimeout(r, ATRASO_MS));
      await rota.continue();
    });
    await p.goto(ROTA, { waitUntil: "domcontentloaded" });
    const campo = p.getByTestId("dados-nascimento");
    await campo.waitFor({ timeout: 20_000 });
    // Digita assim que o campo aceita (o fill espera o campo habilitado). Antes da correção ele aceitava logo — e a leitura
    // atrasada da data gravada (vazia) apagava o que foi digitado.
    await campo.fill("14031991", { timeout: 20_000 });
    await expect(campo).toHaveValue("14/03/1991");
    // Passado o atraso de todas as leituras (as Server Actions vão em fila: dados, nascimento, documento), o digitado continua lá.
    await p.waitForTimeout(3 * ATRASO_MS + 1_500);
    await expect(campo, "a leitura atrasada não apaga o que foi digitado").toHaveValue("14/03/1991");
    await p.getByTestId("dados-salvar").click();
    await expect(p.getByText("Dados salvos.")).toBeVisible({ timeout: 20_000 });
    await expect.poll(nascimento, { timeout: 15_000 }).toBe("1991-03-14");
    await p.context().close();
  });
});
