import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPortaoDaIdentidade } from "../fixtures/fechamento-identidade";

/*
  T2223 — E1085 (ORDEM-DUET-421): os e-mails do contrato têm LINHA PRÓPRIA para as contas/consumo, da fonte única.
  Só no laboratório. TRAVA EM RASCUNHO: vermelha na main de hoje e verde com o PR da Code 2.
  O defeito: linhasContrato (src/lib/notifications/dados-negociacao.ts:130) mostra Imóvel, Período, Valor mensal, Total
  do contrato e Caução; o consumo só entra dobrado dentro da conta do total (precoDaProposta, "Consumo estimado").
  Massa: uma candidatura com a proposta ACEITE (R$ 2.800/mês, consumo R$ 150, 30 dias — proposta_versoes.consumo, a
  fonte única do valor). Pela tela, o dono percorre o Fechamento e gera o contrato (o caminho da t863). O e-mail de
  geração ("contrato está pronto para assinar"), ao morador e ao dono, tem de trazer uma linha própria para as contas
  ou o consumo com R$ 150,00 — o valor da proposta, não outro.
  O rótulo exacto da linha é do PR da Code 2: a trava aceita "Contas…", "Consumo…" ou "Água, luz e gás…".
  O e-mail "Contrato assinado" (contrato-assinar-actions.ts:636, o mesmo linhasContrato) fica para a re-prova dirigida
  do Muse do E1066; se o Gerente o quiser nesta trava, junta-se o passo das duas assinaturas.
  Só contas de teste.
*/
const dono = { email: `dono.t2223.${novoSufixo()}@lab.vivanomads.test`, nome: "Dora Dona Teste", role: "owner" as const };
const inq = { email: `inq.t2223.${novoSufixo()}@lab.vivanomads.test`, nome: "Iris Moradora Teste", role: "tenant" as const };
const ids: Partial<Record<"dono" | "inq" | "imovel" | "lead" | "p1", string>> = {};
const LINHA_CONTAS = /(^|\n)\s*(Contas|Consumo|Água, luz e gás)[^\n]{0,60}R\$\s*150,00/i;
const senha = novaSenha();
const sufixo = novoSufixo();
const dia = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);

async function abrirComo(browser: Browser, email: string): Promise<Page> {
  const p = await entrar(browser, email, senha);
  await p.setViewportSize({ width: 1280, height: 900 });
  return p;
}
/** Insere uma proposta (com a sua versão 1) para a candidatura. */
async function proposta(numero: string, status: string, aceitaEm: string, v: { valor: number; entrada: string; consumo: number }) {
  const { data: p, error } = await adm()
    .from("propostas")
    .insert({ numero, lead_id: ids.lead, property_id: ids.imovel, owner_id: ids.dono, tenant_id: ids.inq, status, versao_atual: 1, validade_dias: 7, valida_ate: new Date(Date.now() + 7 * 86_400_000).toISOString(), aceita_em: aceitaEm })
    .select("id")
    .single();
  if (error) throw error;
  const total = v.valor + v.consumo;
  const { error: ev } = await adm().from("proposta_versoes").insert({
    proposta_id: p.id, versao: 1, autor: "owner", valor_base: v.valor, valor_mensal: v.valor, meses: 1, dias: 30, data_entrada: v.entrada,
    consumo: v.consumo, limpeza_unica: 0, total_mensal: total, total_contrato: total,
  });
  if (ev) throw ev;
  return p.id as string;
}
/** O dono percorre o Fechamento até "Gerar contrato para assinatura" (o caminho da t863) e gera. Devolve o que travou, se travou. */
async function gerarPeloFechamento(page: Page): Promise<string | null> {
  try {
    await page.goto(`/dashboard/fechamento?c=${ids.lead}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Candidatura e verificação" })).toBeVisible({ timeout: 20_000 });
    await abrirPortaoDaIdentidade(page);
    const continuar = page.getByRole("button", { name: /continuar/i });
    await expect(continuar).toBeEnabled({ timeout: 20_000 });
    await continuar.click();
    await page.getByRole("radio").and(page.locator(":not([disabled])")).first().click({ timeout: 15_000 });
    await page.getByTestId("ciente-protecao").check({ timeout: 15_000 });
    await continuar.click();
    await expect(page.getByRole("heading", { name: /serviços adicionais/i })).toBeVisible({ timeout: 15_000 });
    await continuar.click();
    await page.getByRole("button", { name: /Seguir sem seguro patrimonial/ }).click({ timeout: 15_000 });
    await continuar.click();
    await expect(page.getByTestId("marca-minuta")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("fechamento-gerar-contrato").click({ timeout: 15_000 });
    await expect(page.getByTestId("fechamento-abrir-contrato")).toBeVisible({ timeout: 30_000 });
    return null;
  } catch (e) {
    const aviso = await page.getByTestId("fechamento-contrato-existente").innerText().catch(() => "");
    return `${String((e as Error).message).split("\n")[0]}${aviso ? ` — a tela diz: "${aviso.replace(/\s+/g, " ").slice(0, 160)}"` : ""}`;
  }
}
/** Os e-mails de contrato (contract_status) de uma conta de teste, do mais novo para o mais velho. */
const emailsDoContrato = async (usuarioId: string) =>
  ((await adm().from("emails_teste").select("assunto, corpo, criado_em").eq("usuario_id", usuarioId).eq("evento", "contract_status").order("criado_em", { ascending: false })).data ?? []) as { assunto: string; corpo: string; criado_em: string }[];

async function massaBase(tag: string) {
  ids.dono = await criarConta(dono, senha);
  ids.inq = await criarConta(inq, senha);
  await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
  ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Studio ${tag} ${sufixo}`, { ativo: true, preco: 2800 });
  const { error: e1 } = await adm()
    .from("properties")
    .update({ condo_fee: 0, utilities_mode: "fixed", utilities_estimate: 150, prep_fee: 0, checkout_cleaning_enabled: false, checkout_cleaning_fee: 0, limpeza_estadia: null, min_period_days: 30, max_period_days: 180 })
    .eq("id", ids.imovel);
  if (e1) throw e1;
}
async function candidatura(status: string, inicio: string, fim: string) {
  const { data, error } = await adm()
    .from("leads")
    .insert({ owner_id: ids.dono, tenant_id: ids.inq, property_id: ids.imovel, status, inicio_desejado: inicio, fim_desejado: fim })
    .select("id")
    .single();
  if (error) throw error;
  ids.lead = data.id as string;
  for (const tipo of ["identidade", "vinculo"]) {
    const u = () => crypto.randomUUID();
    const { error: e2 } = await adm().from("documentos_inquilino").insert({ lead_id: ids.lead, tenant_id: ids.inq, tipo, caminho: `${u()}/${u()}/${u()}.pdf`, hash_sha256: "a".repeat(64) });
    if (e2) throw e2;
  }
}
async function limpar() {
  if (ids.lead) {
    const { data: cs } = await adm().from("contratos").select("id").eq("lead_id", ids.lead);
    const { data: cs2 } = await adm().from("contratos").select("id").eq("property_id", ids.imovel ?? "");
    const todos = [...new Set([...(cs ?? []), ...(cs2 ?? [])].map((c) => c.id as string))];
    if (todos.length) await adm().from("contrato_blocos").delete().in("contrato_id", todos);
    await adm().from("cobrancas_fechamento").delete().eq("lead_id", ids.lead);
    if (todos.length) await adm().from("contratos").delete().in("id", todos);
    await adm().from("propostas").delete().eq("lead_id", ids.lead);
  }
  if (ids.imovel) await adm().from("messages").delete().eq("property_id", ids.imovel);
  await apagarContas([ids.dono, ids.inq].filter(Boolean) as string[]);
}

test.describe("T2223 — E1085: o e-mail do contrato tem linha própria para as contas/consumo, da proposta @E1085", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 240_000 });

  test.beforeAll(async () => {
    await massaBase("E1085");
    await candidatura("accepted", dia(20), dia(49));
    ids.p1 = await proposta(`ORC-T2223-${sufixo}`, "aceita", new Date().toISOString(), { valor: 2800, entrada: dia(20), consumo: 150 });
  });
  test.afterAll(limpar);

  test("o e-mail de geração do contrato, ao morador e ao dono, traz a linha das contas com R$ 150,00", async ({ browser }) => {
    const antesDoClique = new Date().toISOString();
    const d = await abrirComo(browser, dono.email);
    const travou = await gerarPeloFechamento(d);
    expect(travou, "o Fechamento gera o contrato (o caminho da t863)").toBeNull();
    await d.context().close();
    for (const [quem, id] of [["morador", ids.inq!], ["dono", ids.dono!]] as const) {
      await expect
        .poll(async () => (await emailsDoContrato(id)).filter((m) => m.criado_em >= antesDoClique && /pronto para assinar/i.test(m.assunto)).length, { timeout: 30_000, message: `o e-mail de geração chega ao ${quem}` })
        .toBeGreaterThan(0);
      const m = (await emailsDoContrato(id)).find((x) => x.criado_em >= antesDoClique && /pronto para assinar/i.test(x.assunto))!;
      expect.soft(m.corpo, `E1085: o e-mail ao ${quem} tem linha própria para as contas/consumo com R$ 150,00 (corpo: ${m.corpo.slice(0, 400).replace(/\n/g, " ⏎ ")})`).toMatch(LINHA_CONTAS);
    }
  });
});
