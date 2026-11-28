import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPortaoDaIdentidade } from "../fixtures/fechamento-identidade";

/*
  T2222 — E1086 (ORDEM-DUET-421): cada proposta aceite gera o SEU contrato — nunca é religada a um contrato assinado
  de outras datas. Só no laboratório. TRAVA EM RASCUNHO: vermelha na main de hoje e verde com a correcção da Fable.
  O defeito: registrarContrato (src/lib/data/actions.ts:1487) devolve o contrato que já existe para a candidatura
  (só pelo lead_id; o índice único contratos_lead_id_key, 0057, é "um contrato por candidatura"). Uma segunda proposta
  aceite do MESMO morador no MESMO imóvel, com outras datas, volta ao contrato antigo e nenhum e-mail sai.
  Massa (simulação declarada para o que é antigo; o novo é pela tela):
    - a candidatura, a proposta 1 (contrato assinado) e o contrato 1, assinado pelas duas partes, de dia+5 a dia+34;
    - a proposta 2, ACEITE agora, com outras datas (entrada dia+90) e outro valor (R$ 3.000).
  Pela tela, o dono percorre o Fechamento da candidatura e gera o contrato (o caminho da t863). Fica cobrado:
    1. o Fechamento leva até "Gerar contrato para assinatura" e gera (sem voltar ao contrato antigo);
    2. existe um contrato da proposta 2 (contratos.proposta_id = proposta 2), diferente do contrato 1, com a entrada
       da proposta 2;
    3. o contrato 1 fica intacto (a proposta 1 e as duas assinaturas);
    4. sai o e-mail de geração ("contrato está pronto para assinar") ao morador, com o valor da proposta 2.
  Só contas de teste.
*/
const dono = { email: `dono.t2222.${novoSufixo()}@lab.vivanomads.test`, nome: "Dalia Dona Teste", role: "owner" as const };
const inq = { email: `inq.t2222.${novoSufixo()}@lab.vivanomads.test`, nome: "Ines Moradora Teste", role: "tenant" as const };
const ids: Partial<Record<"dono" | "inq" | "imovel" | "lead" | "p1" | "p2" | "c1", string>> = {};
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

test.describe("T2222 — E1086: cada proposta aceite gera o seu contrato, nunca religa a um contrato assinado de outras datas @E1086", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 240_000 });

  test.beforeAll(async () => {
    await massaBase("E1086");
    await candidatura("accepted", dia(5), dia(34));
    const antes = new Date(Date.now() - 10 * 86_400_000).toISOString();
    ids.p1 = await proposta(`ORC-T2222A-${sufixo}`, "contrato_assinado", antes, { valor: 2800, entrada: dia(5), consumo: 150 });
    // Simulação declarada: o contrato 1, da proposta 1, assinado pelas duas partes.
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({
        lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "essential", faixa: "media_estadia", proposta_id: ids.p1,
        prazo_total_dias: 30, aluguel_mensal: 2800, tamanho_bloco_meses: 1, comissao_percent: 0.1, comissao_valor: 280,
        qtd_ocupantes: 1, capacidade_snapshot: 2, assinado_proprietario_em: antes, assinado_inquilino_em: antes,
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.c1 = c.id as string;
    const { error: eb } = await adm().from("contrato_blocos").insert({ contrato_id: ids.c1, numero_bloco: 1, inicio: dia(5), fim: dia(34), meses: 1, valor: 2800, caucao: 0, status: "ativo" });
    if (eb) throw eb;
    // A proposta 2: o mesmo morador, o mesmo imóvel, outras datas e outro valor, aceite agora.
    ids.p2 = await proposta(`ORC-T2222B-${sufixo}`, "aceita", new Date().toISOString(), { valor: 3000, entrada: dia(90), consumo: 150 });
  });
  test.afterAll(limpar);

  test("a 2.ª proposta aceite gera um contrato novo, com as suas datas e o e-mail de geração; o contrato 1 fica intacto", async ({ browser }) => {
    const antesDoClique = new Date().toISOString();
    const d = await abrirComo(browser, dono.email);
    const travou = await gerarPeloFechamento(d);
    expect.soft(travou, "E1086: o Fechamento leva a proposta aceite nova até gerar o contrato (sem voltar ao contrato antigo)").toBeNull();
    await d.context().close();

    await expect
      .poll(async () => ((await adm().from("contratos").select("id").eq("proposta_id", ids.p2!)).data ?? []).length, {
        timeout: 30_000,
        message: "E1086: a proposta aceite nova gera o SEU contrato (contratos.proposta_id = proposta 2)",
      })
      .toBe(1);
    const { data: c2 } = await adm().from("contratos").select("id").eq("proposta_id", ids.p2!).single();
    expect(c2!.id, "E1086: o contrato da proposta 2 não é o contrato 1").not.toBe(ids.c1);
    const { data: blocos } = await adm().from("contrato_blocos").select("inicio").eq("contrato_id", c2!.id).order("numero_bloco");
    expect.soft(blocos?.[0]?.inicio, "E1086: o contrato novo começa na entrada da proposta 2").toBe(dia(90));

    const { data: c1 } = await adm().from("contratos").select("proposta_id, assinado_proprietario_em, assinado_inquilino_em").eq("id", ids.c1!).single();
    expect.soft(c1!.proposta_id, "o contrato 1 continua da proposta 1").toBe(ids.p1);
    expect.soft(Boolean(c1!.assinado_proprietario_em && c1!.assinado_inquilino_em), "o contrato 1 continua assinado pelas duas partes").toBe(true);

    await expect
      .poll(async () => (await emailsDoContrato(ids.inq!)).filter((m) => m.criado_em >= antesDoClique && /pronto para assinar/i.test(m.assunto)).length, {
        timeout: 30_000,
        message: "E1086: sai o e-mail de geração do contrato novo ao morador",
      })
      .toBeGreaterThan(0);
    const novo = (await emailsDoContrato(ids.inq!)).find((m) => m.criado_em >= antesDoClique && /pronto para assinar/i.test(m.assunto));
    expect.soft(novo?.corpo ?? "", "o e-mail é do contrato novo: o valor mensal da proposta 2").toMatch(/R\$\s*3\.000(,00)?(?!\d)/);
  });
});
