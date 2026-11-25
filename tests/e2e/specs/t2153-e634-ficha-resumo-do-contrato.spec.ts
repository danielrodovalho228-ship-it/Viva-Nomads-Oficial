import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2153 — E634 @E634: a ficha-resumo do contrato (/dashboard/contratos/[id]/ficha), atrás da chave de build FICHA_RESUMO_ATIVA.
  Regra decidida (E634, migração 0308; unitário src/lib/e634-ficha-resumo-contrato.test.ts): as duas partes do contrato veem
  a ficha (datas de início e fim, aluguel mensal, vencimento e conta de recebimento); só o PROPRIETÁRIO vê o formulário
  "Vencimento e conta de recebimento" e só ele grava (pelo servidor, service_role); quem não é parte recebe 404. Conta de
  TERCEIRO exige a autorização expressa do proprietário, registrada em contrato_ficha_resumo (quem, quando e a versão do texto);
  a Viva guarda só o FINAL do documento e da conta/Pix, nunca o dado inteiro.
  A prova: contrato assinado com um bloco, criado pela chave de serviço; cada pessoa entra pela tela.
    1. Dono e inquilino veem a ficha com as datas e o valor do contrato; só o dono vê o formulário.
    2. Outra conta (nem dono nem inquilino) recebe 404 e não vê a ficha.
    3. O dono salva conta de terceiro: sem a autorização, recusa e nada é gravado; com a autorização, grava quem/quando/versão
       e só os finais (documento e conta), e a ficha mostra a autorização registrada.
  A chave é de build (NEXT_PUBLIC_, embutida na compilação): só corre no job do laboratório que compila com as chaves ligadas.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: Record<string, string> = {};
const INICIO = "2027-03-01";
const FIM = "2027-04-29";

// Contas por teste: os testes do arquivo correm em paralelo (fullyParallel).
async function conta(quem: string, nome: string, role: "owner" | "tenant") {
  const email = `${quem}.t2153.${sufixo}@lab.vivanomads.test`;
  const id = await criarConta({ email, nome, role }, senha);
  ids[`pessoa_${quem}`] = id;
  await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  return { id, email };
}

/** Contrato "ativo", assinado pelos dois, com um bloco de INICIO a FIM e aluguel de R$ 3.200. */
async function cenario(chave: string) {
  const dono = await conta(`dono${chave}`, "Xênia Dona", "owner");
  const inq = await conta(`inq${chave}`, "Yuri Morador", "tenant");
  const imovel = await criarImovelPronto(dono.id, `Apto da ficha ${chave} ${sufixo}`, { ativo: true, preco: 3200 });
  const lead = await criarLead(dono.id, inq.id, imovel, true);
  const agora = new Date().toISOString();
  const { data: c, error } = await adm()
    .from("contratos")
    .insert({ property_id: imovel, tenant_id: inq.id, lead_id: lead, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, capacidade_snapshot: 2, status: "ativo", garantia: "caucao", assinado_proprietario_em: agora, assinado_inquilino_em: agora })
    .select("id")
    .single();
  if (error) throw error;
  const { error: e1 } = await adm().from("contrato_blocos").insert({ contrato_id: c.id, numero_bloco: 1, inicio: INICIO, fim: FIM, meses: 2, valor: 6400, caucao: 3200, status: "agendado", aceite_proprietario_em: agora, aceite_inquilino_em: agora });
  if (e1) throw e1;
  ids[`contrato_${chave}`] = c.id as string;
  return { dono, inq, contratoId: c.id as string };
}

const lerFicha = async (contratoId: string) =>
  (await adm().from("contrato_ficha_resumo").select("*").eq("contrato_id", contratoId).maybeSingle()).data as Record<string, unknown> | null;

test.describe("T2153 — E634: ficha-resumo do contrato, com a autorização expressa para conta de terceiro @E634 @chave-build", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (chave de serviço e banco local).");
  test.skip(process.env.NEXT_PUBLIC_FICHA_RESUMO_ATIVA !== "on", "Só no job do laboratório com as chaves de build ligadas.");
  test.describe.configure({ mode: "default", timeout: 120_000 });

  test.afterAll(async () => {
    for (const k of Object.keys(ids).filter((k) => k.startsWith("contrato_"))) {
      await adm().from("contrato_ficha_resumo").delete().eq("contrato_id", ids[k]);
      await adm().from("contrato_eventos").delete().eq("contrato_id", ids[k]);
      await adm().from("contrato_blocos").delete().eq("contrato_id", ids[k]);
      await adm().from("contratos").delete().eq("id", ids[k]);
    }
    const pessoas = Object.keys(ids).filter((k) => k.startsWith("pessoa_")).map((k) => ids[k]);
    for (const p of pessoas) await adm().from("leads").delete().eq("owner_id", p);
    await apagarContas(pessoas);
  });

  test("1. dono e inquilino veem a ficha com datas e valor; só o dono vê o formulário da conta de recebimento", async ({ browser }) => {
    const { dono, inq, contratoId } = await cenario("partes");
    for (const [pessoa, ehDono] of [[dono, true], [inq, false]] as const) {
      const p = await entrar(browser, pessoa.email, senha);
      await p.goto(`/dashboard/contratos/${contratoId}/ficha`, { waitUntil: "domcontentloaded" });
      const ficha = p.getByTestId("ficha-resumo");
      await expect(ficha, "a parte do contrato vê a ficha").toBeVisible({ timeout: 20_000 });
      await expect(ficha).toContainText("01/03/2027");
      // Asserção alterada (ORDEM-DUET-843; E1089, #4126): a ficha diz "Entrada" e "Saída", e a saída é o dia seguinte ao
      // fim gravado no bloco (a última noite, 29/04) — a lei da data única de saída. Antes a ficha mostrava o fim (29/04).
      await expect(ficha).toContainText("Saída30/04/2027");
      await expect(ficha).toContainText(/R\$\s*3\.200/);
      // Sem vencimento informado: a ficha diz "a informar" e lista a pendência.
      await expect(ficha).toContainText("a informar");
      await expect(p.getByTestId("ficha-pendencias")).toContainText("Falta o dia de vencimento do aluguel.");
      await expect(p.getByTestId("form-conta-recebimento"), ehDono ? "o dono informa a conta" : "o inquilino não vê o formulário").toHaveCount(ehDono ? 1 : 0);
      await expect(p.getByText("Vencimento e conta de recebimento")).toHaveCount(ehDono ? 1 : 0);
      await p.context().close();
    }
  });

  test("2. outra conta, que não é parte do contrato, recebe 404 e não vê a ficha", async ({ browser }) => {
    const { contratoId } = await cenario("alheio");
    const outro = await conta("outro", "Zara Alheia", "owner");
    const p = await entrar(browser, outro.email, senha);
    const r = await p.goto(`/dashboard/contratos/${contratoId}/ficha`, { waitUntil: "domcontentloaded" });
    // notFound(): 404 (ou a página de "não encontrada" já em streaming, por causa do loading do painel).
    expect([200, 404]).toContain(r?.status());
    await expect(p.getByText("Página não encontrada")).toBeVisible({ timeout: 20_000 });
    await expect(p.getByTestId("ficha-resumo")).toHaveCount(0);
    await p.context().close();
  });

  test("3. conta de terceiro: sem a autorização expressa é recusada; com ela, grava quem/quando/versão e só os finais", async ({ browser }) => {
    const { dono, contratoId } = await cenario("terceiro");
    const p = await entrar(browser, dono.email, senha);
    await p.goto(`/dashboard/contratos/${contratoId}/ficha`, { waitUntil: "domcontentloaded" });
    const form = p.getByTestId("form-conta-recebimento");
    await expect(form).toBeVisible({ timeout: 20_000 });
    await form.getByLabel("Dia de vencimento do aluguel (1 a 28)").fill("10");
    await form.getByLabel("Nome do titular da conta").fill("Ana Terceira Souza");
    await form.getByLabel("CPF ou CNPJ do titular").fill("987.654.321-00");
    await form.getByLabel("Banco ou instituição").fill("Banco do Laboratório");
    await form.getByLabel("Conta ou chave Pix").fill("0012345-6");
    await form.getByLabel("A conta é de outra pessoa (terceiro)").check();
    await expect(form.getByTestId("autorizacao-terceiro")).toContainText("autorizo expressamente");

    // Sem marcar a autorização: o servidor recusa e nada vai para o banco.
    await form.getByRole("button", { name: "Salvar" }).click();
    await expect(form.getByRole("alert")).toContainText("Conta de terceiro precisa da autorização expressa do proprietário.", { timeout: 20_000 });
    expect(await lerFicha(contratoId), "sem autorização, nada é gravado").toBeNull();

    // Com a autorização: grava, com quem autorizou, quando e a versão do texto aceito.
    await form.getByTestId("autorizacao-terceiro").getByRole("checkbox").check();
    await form.getByRole("button", { name: "Salvar" }).click();
    await expect(form.getByRole("status")).toContainText("Salvo.", { timeout: 20_000 });
    const linha = await lerFicha(contratoId);
    expect(linha?.dia_vencimento).toBe(10);
    expect(linha?.conta_titular_proprio).toBe(false);
    expect(linha?.autorizacao_terceiro_por, "quem autorizou é o dono").toBe(dono.id);
    expect(linha?.autorizacao_terceiro_em, "quando autorizou fica registrado").toBeTruthy();
    expect(linha?.autorizacao_texto_versao).toBe("ficha-resumo-v1");
    // Só os finais: nunca o documento nem a conta inteiros.
    expect(linha?.conta_titular_documento_final).toBe("2100");
    expect(linha?.conta_referencia_final).toBe("3456");
    expect(JSON.stringify(linha)).not.toContain("98765432100");
    expect(JSON.stringify(linha)).not.toContain("0012345");

    // A ficha mostra a conta pelos finais e a autorização registrada.
    const ficha = p.getByTestId("ficha-resumo");
    await expect(ficha).toContainText("todo dia 10", { timeout: 20_000 });
    await expect(ficha).toContainText("documento final 2100");
    await expect(ficha).toContainText("Conta de terceiro, com autorização expressa do proprietário registrada em");
    await p.context().close();
  });
});
