import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1724 — E1064 @E1064, perna 1 (ORDEM-DUET-392/406): o selo "Identidade pendente" da moradora com a identidade
  confirmada. A sequência da prova ao vivo de 20/11, refeita no laboratório com contas de teste:
   1. A moradora (sem CPF cadastrado) confirma a identidade → o dono vê "Identidade verificada" em Interessados e no
      Fechamento. Ela cadastra o CPF em Conta → Documento, como o Fechamento pede → o laudo CONTINUA válido e o dono
      continua a ver "Identidade verificada" nos dois lugares. (Antes: o laudo vencia na hora e o selo virava
      "pendente".)
   2. A regra decidida continua: TROCAR o CPF que já existia, ou trocar o nome, vence a identidade, e o dono passa a
      ver "Identidade pendente".
  As procuras são pelo texto que a tela mostra. Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1724.${sufixo}@lab.vivanomads.test`, nome: "Dora Selo Sobrenome", role: "owner" as const };
const inq = { email: `inq.t1724.${sufixo}@lab.vivanomads.test`, nome: "Iris Selo Sobrenome", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string } = {};

/** O laudo mais recente da moradora ainda vale? (lido no banco do laboratório) */
async function laudoVale(): Promise<boolean> {
  const { data } = await adm().from("tenant_verifications").select("valid_until").eq("tenant_id", ids.inq!).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return !!data?.valid_until && Date.parse(data.valid_until as string) > Date.now() + 300 * 86_400_000;
}
/** A moradora confirma a identidade (conta de teste: verificação simulada, sem CPF). */
async function confirmarIdentidade(page: Page) {
  const r = await page.request.post("/api/caf/verify");
  expect(r.ok(), "a verificação da conta de teste responde").toBeTruthy();
  await expect.poll(laudoVale, { timeout: 15_000 }).toBe(true);
}
/** O que o dono vê nos dois lugares. */
async function seloParaODono(browser: Browser, largura: 390 | 1280, esperado: "verificada" | "pendente", captura?: string) {
  const page = await entrar(browser, dono.email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await page.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
  // O dono desta trava só tem esta candidatura.
  await expect(page.getByTestId("cartao-candidato").getByTestId("candidato-identidade"), "Interessados").toHaveText(`Identidade ${esperado}`, { timeout: 30_000 });
  if (captura) await page.screenshot({ path: `${SAIDA}/${captura}-interessados-${largura}.png` });
  await page.goto(`/dashboard/fechamento?c=${ids.lead}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("fechamento-identidade-inquilino"), "Fechamento").toHaveText(`Identidade do morador: ${esperado}`, { timeout: 30_000 });
  if (captura) await page.screenshot({ path: `${SAIDA}/${captura}-fechamento-${largura}.png` });
  await page.context().close();
}

test.describe("T1724 — E1064: cadastrar o primeiro CPF não vence a identidade; trocar o nome ou o CPF, sim @E1064", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    // A moradora nasce SEM CPF, como a conta da prova (a verificação simulada da conta de teste não pede CPF).
    ids.inq = await criarConta(inq, senha, false);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Selo ${sufixo}`, { ativo: true, preco: 2600 });
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel, true);
  });

  test.afterAll(async () => {
    if (ids.lead) await adm().from("cobrancas_fechamento").delete().eq("lead_id", ids.lead);
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await adm().from("tenant_verifications").delete().in("tenant_id", [ids.dono, ids.inq].filter(Boolean) as string[]);
    await apagarContas([ids.inq, ids.dono]);
  });

  test("1. a moradora confirma a identidade e DEPOIS cadastra o CPF: o laudo continua válido e o dono continua a ver 'verificada'", async ({ browser }) => {
    const moradora = await entrar(browser, inq.email, senha);
    await confirmarIdentidade(moradora);
    await seloParaODono(browser, 1280, "verificada");

    // Ela cadastra o CPF em Conta → Documento (é o que o Fechamento pede ao morador).
    await moradora.goto("/dashboard/conta/dados", { waitUntil: "domcontentloaded" });
    const secao = moradora.getByTestId("documento-secao");
    await expect(secao).toBeVisible({ timeout: 20_000 });
    await secao.getByPlaceholder("000.000.000-00").fill(cpfAleatorio());
    await secao.getByRole("button", { name: "Salvar documento" }).click();
    await expect(secao.getByTestId("documento-cadastrado")).toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => ((await adm().from("profiles").select("cpf").eq("id", ids.inq!).single()).data?.cpf as string | null) ?? null, { timeout: 15_000 }).not.toBeNull();

    // O laudo de minutos antes continua a valer por 12 meses…
    expect(await laudoVale(), "cadastrar o primeiro CPF não vence a identidade").toBe(true);
    // …e o dono continua a ver "verificada" em Interessados e no Fechamento, a 390 e a 1280 px.
    await seloParaODono(browser, 390, "verificada", "t1724-1-depois-do-cpf");
    await seloParaODono(browser, 1280, "verificada", "t1724-1-depois-do-cpf");
    await moradora.context().close();
  });

  test("2. a regra continua: trocar o CPF que já existia, ou trocar o nome, vence a identidade", async ({ browser }) => {
    expect(await laudoVale(), "parte do laudo válido do caso 1").toBe(true);
    // Troca de CPF (só a equipe troca um CPF já cadastrado; aqui, direto no banco do laboratório).
    const { error } = await adm().from("profiles").update({ cpf: cpfAleatorio() }).eq("id", ids.inq!);
    if (error) throw error;
    await expect.poll(laudoVale, { timeout: 15_000 }).toBe(false);
    await seloParaODono(browser, 1280, "pendente");

    // Ela confirma de novo e depois troca o NOME: a identidade vence outra vez.
    const moradora = await entrar(browser, inq.email, senha);
    await confirmarIdentidade(moradora);
    await moradora.context().close();
    const { error: e2 } = await adm().from("profiles").update({ full_name: "Iris Selo Outro Sobrenome" }).eq("id", ids.inq!);
    if (e2) throw e2;
    await expect.poll(laudoVale, { timeout: 15_000 }).toBe(false);
    await adm().from("profiles").update({ full_name: inq.nome }).eq("id", ids.inq!);
    await seloParaODono(browser, 390, "pendente", "t1724-2-depois-da-troca");
  });
});
