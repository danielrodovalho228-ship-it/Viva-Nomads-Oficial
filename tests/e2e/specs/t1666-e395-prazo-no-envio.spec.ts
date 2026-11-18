import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { PRAZO_RESPOSTA_DONO } from "../../../src/lib/candidaturas/status";

/*
  T1666 — E395 @E395: o prazo oficial do proprietário ("em até 1 dia útil") aparece DESDE O ENVIO da candidatura —
  tela de sucesso, os 2 e-mails do envio (caixa de teste do laboratório: ao dono e à moradora) e a lista de
  Candidaturas (abertura + cartão "Enviada"). Mesmo caminho do t678 (Solicitar → Enviar). 390 e 1280 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1666.${sufixo}@lab.vivanomads.test`, nome: "Dono Prazo Sobrenome", role: "owner" as const };
const inq = { email: `inq.t1666.${sufixo}@lab.vivanomads.test`, nome: "Ana Prazo Sobrenome", role: "tenant" as const };
const titulo = `Studio do prazo ${sufixo}`;
const ids: { dono?: string; inq?: string; imovel?: string } = {};
const SAIDA = "tests/e2e/.artifacts/t1666";

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

test.describe("T1666 — E395: o prazo do proprietário desde o envio @E395", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

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

  test("390px — envio: tela de sucesso e os 2 e-mails dizem o prazo", async ({ browser }) => {
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
    await expect(ok).toContainText(PRAZO_RESPOSTA_DONO);
    await page.screenshot({ path: `${SAIDA}/preview-sucesso-390.png` });
    await page.context().close();

    expect((await corpo(ids.dono!, "candidatura_nova")).corpo).toContain(`aprove ou recuse a candidatura em Interessados ${PRAZO_RESPOSTA_DONO}`);
    expect((await corpo(ids.inq!, "application_received")).corpo).toContain(`O proprietário já foi avisado e responde ${PRAZO_RESPOSTA_DONO}`);
  });

  for (const largura of [390, 1280]) {
    test(`${largura}px — lista de Candidaturas: abertura e cartão "Enviada" dizem o prazo`, async ({ browser }) => {
      const page = await entrar(browser, inq.email, senha);
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/dashboard/candidaturas", { waitUntil: "domcontentloaded" });
      await expect(page.getByText(`o proprietário responde ${PRAZO_RESPOSTA_DONO}`).first()).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(`O proprietário recebeu a sua candidatura e responde ${PRAZO_RESPOSTA_DONO}.`).first()).toBeVisible();
      await page.screenshot({ path: `${SAIDA}/preview-candidaturas-${largura}.png`, fullPage: true });
      await page.context().close();
    });
  }
});
