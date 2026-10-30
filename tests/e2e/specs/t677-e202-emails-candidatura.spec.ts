import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T677 — E202 reaberto (QA do Muse, 29/10): o caminho da CANDIDATURA (Solicitar → Interessados → Aprovar) usa os
  modelos com dados do pacote E202–E206. Contas do laboratório marcadas como de teste (is_teste): os e-mails caem na
  caixa de teste (emails_teste), lida aqui.
   1. A moradora escolhe entrada e saída (30 dias) no calendário e envia a candidatura (tela). A saída vai ao banco
      (leads.fim_desejado, 0258).
   2. E-mail ao DONO ("Nova candidatura no seu imóvel"): imóvel, interessado, entrada, saída, valor mensal, total por
      mês, total da estadia e o link do cartão desta candidatura — nada do corpo antigo.
   3. E-mail à MORADORA no envio (confirmação, antes inexistente): os mesmos dados e o link de Minhas candidaturas.
   4. O dono aprova pela tela → e-mail à moradora ("Sua candidatura foi aceita") com imóvel, datas e valores, e o link
      da conversa desta candidatura.
   5. (b) O Fechamento abre com o prazo da candidatura (1 mês), não 4.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t677.${sufixo}@lab.vivanomads.test`, nome: "Daniel Candidatura Sobrenome", role: "owner" as const };
const inq = { email: `inq.t677.${sufixo}@lab.vivanomads.test`, nome: "Ana Candidatura Sobrenome", role: "tenant" as const };
const titulo = `Premium da candidatura ${sufixo}`;
const ALUGUEL = 3200;
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string } = {};
const periodo: { entrada?: string; saida?: string } = {};
const SAIDA = "tests/laboratorio/saida";

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

function confereQuadro(c: string) {
  expect(c).toContain(`Imóvel: ${titulo}`);
  expect(c).toContain("Interessado: Ana");
  expect(c).toContain(`Entrada: ${br(periodo.entrada!)}`);
  expect(c).toContain(`Saída: ${br(periodo.saida!)} (30 dias)`);
  expect(c).toContain(`Valor mensal: R$ 3.200`);
  expect(c).toMatch(/Total por mês: R\$ [\d.]+/);
  expect(c).toMatch(/Total da estadia: R\$ [\d.]+ em 1 mês/);
  expect(c).not.toContain("A combinar com o proprietário");
}

test.describe("T677 — E202: os e-mails da candidatura trazem o imóvel, as datas e os valores", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    // Contas de teste: os e-mails vão para a caixa de teste (e o contrato/caução ficam simulados).
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, titulo, { ativo: true, preco: ALUGUEL });
  });

  test.afterAll(async () => {
    if (ids.imovel) await adm().from("messages").delete().eq("property_id", ids.imovel);
    if (ids.dono) await adm().from("leads").delete().eq("owner_id", ids.dono);
    await adm().from("emails_teste").delete().in("usuario_id", [ids.dono, ids.inq].filter(Boolean) as string[]);
    await apagarContas([ids.inq, ids.dono]);
  });

  test("1–3. a moradora envia a candidatura com o período; dono e moradora recebem os dados", async ({ browser }) => {
    test.setTimeout(150_000);
    const page = await entrar(browser, inq.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(titulo, { timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    Object.assign(periodo, await escolherNoCalendario(page, 30));

    const card = page.locator("#cartao-preco");
    const passo = page.getByTestId("solicitacao-passo");
    await expect(async () => {
      await card.getByRole("button", { name: "Solicitar", exact: true }).click();
      await expect(passo).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await expect(passo.getByTestId("solicitacao-saida")).toHaveValue(br(periodo.saida!));
    await passo.getByRole("button", { name: "Continuar" }).click();
    await passo.getByRole("button", { name: "Continuar" }).click();
    await passo.getByRole("button", { name: "Enviar candidatura" }).click();
    await expect(page.getByText("Candidatura enviada").first()).toBeVisible({ timeout: 20_000 });
    await page.context().close();

    const { data: lead } = await adm().from("leads").select("id, inicio_desejado, fim_desejado").eq("property_id", ids.imovel!).eq("tenant_id", ids.inq!).single();
    ids.lead = lead!.id as string;
    expect(String(lead!.inicio_desejado).slice(0, 10)).toBe(periodo.entrada);
    expect(String(lead!.fim_desejado).slice(0, 10), "a saída da candidatura vai ao banco (0258)").toBe(periodo.saida);

    // 2. Ao dono: o modelo com dados e o link do cartão desta candidatura.
    const aoDono = await corpo(ids.dono!, "candidatura_nova");
    expect(aoDono.assunto).toContain("Nova candidatura no seu imóvel");
    expect(aoDono.corpo).toContain(`Ana enviou uma candidatura para ${titulo}`);
    confereQuadro(aoDono.corpo);
    expect(aoDono.corpo).toContain("Próximo passo: aprove ou recuse a candidatura em Interessados");
    expect(aoDono.corpo).toContain(`/dashboard/leads#candidato-${ids.lead}`);
    expect(aoDono.corpo).not.toContain("você recebeu uma candidatura para o seu imóvel");

    // 3. À moradora no envio: a confirmação (antes, nenhum e-mail).
    const aMorador = await corpo(ids.inq!, "application_received");
    expect(aMorador.assunto).toContain("Candidatura enviada");
    expect(aMorador.corpo).toContain(`sua candidatura para ${titulo} foi enviada`);
    confereQuadro(aMorador.corpo);
    expect(aMorador.corpo).toContain(`/dashboard/candidaturas#candidatura-${ids.lead}`);
  });

  test("4–5. o dono aprova: a moradora recebe o aceite com os dados, e o Fechamento abre em 1 mês", async ({ browser }) => {
    test.setTimeout(150_000);
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    // O link do e-mail leva ao cartão desta candidatura.
    await page.goto(`/dashboard/leads#candidato-${ids.lead}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(`#candidato-${ids.lead}`)).toBeVisible({ timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await page.locator(`#candidato-${ids.lead}`).getByRole("button", { name: /Aprovar e responder/i }).click();
    await expect.poll(async () => (await adm().from("leads").select("status").eq("id", ids.lead!).single()).data?.status, { timeout: 20_000 }).toBe("accepted");

    const aceite = await corpo(ids.inq!, "candidatura_aceita");
    expect(aceite.assunto).toContain("Sua candidatura foi aceita");
    expect(aceite.corpo).toContain(`o proprietário aceitou sua candidatura para ${titulo}`);
    confereQuadro(aceite.corpo);
    expect(aceite.corpo).toContain("/dashboard/mensagens?conversa=");

    // (b) O Fechamento herda o período da candidatura aceita: 1 mês (antes, 4 meses).
    await page.goto(`/dashboard/fechamento?c=${ids.lead}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel(/Prazo total em meses/i)).toHaveValue("1", { timeout: 20_000 });
    await page.screenshot({ path: `${SAIDA}/t677-fechamento-1-mes-1280.png` });
    await page.context().close();
  });
});
