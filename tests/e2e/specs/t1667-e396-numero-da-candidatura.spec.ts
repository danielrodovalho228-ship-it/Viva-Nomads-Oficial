import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { numeroPublicoPedido } from "../../../src/lib/pedido-ref";

/*
  T1667 — E396 @E396: a candidatura é citável desde o envio pelo número que já existe (VN-PD-…, numeroPublicoPedido do
  id da candidatura). Confere a tela de sucesso e a caixa simulada do laboratório (os 2 e-mails: dono e moradora) com o
  número do lead gravado; e o cartão da candidatura nas duas áreas (Minhas candidaturas e Interessados). 390 e 1280 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1667.${sufixo}@lab.vivanomads.test`, nome: "Dono Numero Sobrenome", role: "owner" as const };
const inq = { email: `inq.t1667.${sufixo}@lab.vivanomads.test`, nome: "Ana Numero Sobrenome", role: "tenant" as const };
const titulo = `Studio do número ${sufixo}`;
const ids: { dono?: string; inq?: string; imovel?: string } = {};
const SAIDA = "tests/e2e/.artifacts/t1667";

const maisDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const br = (iso: string) => iso.split("-").reverse().join("/");

async function escolherNoCalendario(page: Page, dias: number) {
  const livres = page.locator('#disponibilidade button[data-estado-dia="disponivel"]');
  await expect(livres.first()).toBeVisible({ timeout: 20_000 });
  const todos = await livres.evaluateAll((els) => els.map((e) => e.getAttribute("data-dia") ?? ""));
  const livresSet = new Set(todos);
  const entrada = todos.find((d) => livresSet.has(maisDias(d, dias)));
  expect(entrada, "precisa haver um período livre no calendário").toBeTruthy();
  const saida = maisDias(entrada!, dias);
  await page.locator(`#disponibilidade button[data-dia="${entrada}"]`).click();
  await page.locator(`#disponibilidade button[data-dia="${saida}"]`).click();
  await expect(page.getByTestId("calendario-selecao")).toContainText(`${br(entrada!)} → ${br(saida)}`);
  return { entrada: entrada!, saida };
}

/** O corpo (texto) do e-mail `evento` mais recente da caixa de teste de `usuarioId` (os avisos saem depois da resposta). */
async function corpo(usuarioId: string, evento: string): Promise<{ assunto: string; corpo: string }> {
  for (let i = 0; i < 30; i++) {
    const { data } = await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", usuarioId).eq("evento", evento).order("criado_em", { ascending: false }).limit(1);
    const r = (data ?? [])[0] as { assunto: string; corpo: string } | undefined;
    if (r) return { assunto: String(r.assunto ?? ""), corpo: String(r.corpo ?? "") };
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error(`e-mail ${evento} não chegou à caixa de ${usuarioId}`);
}

test.describe("T1667 — E396: o número da candidatura desde o envio @E396", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  let numero = "";

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, titulo, { ativo: true, preco: 3200 });
  });

  test.afterAll(async () => {
    if (ids.imovel) await adm().from("messages").delete().eq("property_id", ids.imovel);
    if (ids.dono) await adm().from("leads").delete().eq("owner_id", ids.dono);
    await adm().from("emails_teste").delete().in("usuario_id", [ids.dono, ids.inq].filter(Boolean) as string[]);
    await apagarContas([ids.inq, ids.dono]);
  });

  test("390px — envio: a tela de sucesso e os 2 e-mails trazem o mesmo VN-PD-…", async ({ browser }) => {
    test.setTimeout(150_000);
    const page = await entrar(browser, inq.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(titulo, { timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await escolherNoCalendario(page, 30);
    const passo = page.getByTestId("solicitacao-passo");
    await expect(async () => {
      await page.getByRole("button", { name: "Pedir para morar", exact: true }).first().click();
      await expect(passo).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await passo.getByRole("button", { name: "Continuar" }).click();
    await passo.getByRole("button", { name: "Continuar" }).click();
    await passo.getByRole("button", { name: "Enviar candidatura" }).click();
    const ok = page.getByTestId("candidatura-confirmada");
    await expect(ok).toBeVisible({ timeout: 20_000 });

    const { data: lead } = await adm().from("leads").select("id").eq("property_id", ids.imovel!).eq("tenant_id", ids.inq!).single();
    numero = numeroPublicoPedido(lead!.id as string)!;
    expect(numero).toMatch(/^VN-PD-[0-9A-F]{8}$/);
    await expect(ok.getByTestId("candidatura-numero")).toHaveText(`Pedido nº ${numero}`);
    await page.screenshot({ path: `${SAIDA}/preview-sucesso-numero-390.png` });
    await page.context().close();

    expect((await corpo(ids.dono!, "candidatura_nova")).corpo).toContain(`Pedido: ${numero}`);
    expect((await corpo(ids.inq!, "application_received")).corpo).toContain(`Pedido: ${numero}`);
  });

  for (const largura of [390, 1280]) {
    test(`${largura}px — o cartão da candidatura nas duas áreas mostra o mesmo número`, async ({ browser }) => {
      const morador = await entrar(browser, inq.email, senha);
      await morador.setViewportSize({ width: largura, height: 900 });
      await morador.goto("/dashboard/candidaturas", { waitUntil: "domcontentloaded" });
      await expect(morador.getByText(`Pedido nº ${numero}`).first()).toBeVisible({ timeout: 20_000 });
      await morador.screenshot({ path: `${SAIDA}/preview-candidaturas-numero-${largura}.png`, fullPage: true });
      await morador.context().close();

      const proprietario = await entrar(browser, dono.email, senha);
      await proprietario.setViewportSize({ width: largura, height: 900 });
      await proprietario.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
      await expect(proprietario.getByTestId("candidato-numero").first()).toHaveText(`Pedido nº ${numero}`, { timeout: 20_000 });
      await proprietario.screenshot({ path: `${SAIDA}/preview-interessados-numero-${largura}.png`, fullPage: true });
      await proprietario.context().close();
    });
  }
});
