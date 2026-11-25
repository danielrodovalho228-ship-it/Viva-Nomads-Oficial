import { test, expect, type Browser } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2225 — E1066, a perna dos e-mails de CONTRATO ASSINADO (linha Proposta e contrato; auditoria de travas da
  ORDEM-DUET-437). RASCUNHO.
  A trava da main (src/lib/notifications/e1066-emails-do-contrato.test.ts) confere a assinatura só pelo código-fonte
  ("a assinatura lê a mesma conta e a mesma caução", por expressão regular) e a t57 confere o imóvel, o período, o
  valor mensal e o próximo passo — nenhuma lê, no e-mail que sai, o "Total do contrato" da fonte única nem a linha da
  Caução. Aqui as duas partes assinam PELA TELA (o caminho da t57, código lido na caixa de teste) e os três e-mails de
  assinatura são lidos na caixa de teste:
    a) ao dono, depois da 1ª assinatura ("Falta a sua assinatura");
    b) ao morador, com as duas assinaturas ("assinado pelas duas partes");
    c) ao dono, que assinou por último, a sua cópia ("assinado pelas duas partes").
  Em cada um: "Total do contrato" é a conta da fonte única da proposta aceite (aluguel R$ 3.200 + contas R$ 150 =
  R$ 3.350 por mês, 1 mês), não só o aluguel (R$ 3.200); e há a linha "Caução: R$ 1.600" (a caução dos blocos).
  Simulação declarada: candidatura, proposta aceite, contrato aguardando assinatura e o check-in gravados pelo laboratório.
  Só contas de teste. Laboratório; não é prova ao vivo no site.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2225.${sufixo}@lab.vivanomads.test`, nome: "Dora Assinado", role: "owner" as const };
const inq = { email: `inq.t2225.${sufixo}@lab.vivanomads.test`, nome: "Ines Assinado", role: "tenant" as const };
const ids: Record<string, string> = {};
const dia = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const TOTAL_FONTE_UNICA = /Total do contrato:[^\n]*R\$\s?3\.350(,00)?(?!\d)/;
const TOTAL_SO_ALUGUEL = /Total do contrato:\s*1 × R\$\s?3\.200(,00)? = R\$\s?3\.200(,00)?(?!\d)/;
const CAUCAO = /Caução:\s*R\$\s?1\.600(,00)?(?!\d)/;

async function codigoDaCaixa(usuarioId: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const { data } = await adm().from("emails_teste").select("corpo").eq("usuario_id", usuarioId).eq("evento", "contract_signature_code").order("criado_em", { ascending: false }).limit(1);
    const m = /":\s*(\d{6})\s*$/m.exec(String(data?.[0]?.corpo ?? "").trim());
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("O código de assinatura não chegou à caixa de testes em 30 s.");
}
/** Todos os e-mails de contrato da caixa de teste da conta que casam com `re` (os avisos saem depois da resposta). */
async function emails(usuarioId: string, re: RegExp, quantos = 1): Promise<string[]> {
  for (let i = 0; i < 30; i++) {
    const { data } = await adm().from("emails_teste").select("corpo").eq("usuario_id", usuarioId).eq("evento", "contract_status").order("criado_em", { ascending: true });
    const achados = (data ?? []).map((d) => String(d.corpo ?? "")).filter((c) => re.test(c));
    if (achados.length >= quantos) return achados;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`e-mail de contrato com ${re} não chegou à caixa de ${usuarioId}`);
}
async function assinar(browser: Browser, email: string, usuarioId: string, rota: string) {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("form-assinar")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("assinar-pedir-codigo").click();
  const enviado = await page.getByText(/Enviamos 6 números/).waitFor({ timeout: 45_000 }).then(() => true, () => false);
  // Se o código não sair, a falha mostra o que o formulário diz (o motivo vem junto do botão — E1065).
  expect(enviado, `o código de assinatura sai (o formulário diz: ${(await page.getByTestId("form-assinar").innerText().catch(() => "sem formulário")).replace(/\s+/g, " ").slice(0, 400)})`).toBe(true);
  await page.getByTestId("assinar-aceite").check();
  await page.getByTestId("assinar-codigo").fill(await codigoDaCaixa(usuarioId));
  await page.getByTestId("assinar-enviar").click();
  await expect(page.getByTestId("form-assinar")).toHaveCount(0, { timeout: 45_000 });
  await page.context().close();
}
function confereQuadro(corpo: string, quem: string) {
  expect.soft(corpo, `${quem}: "Total do contrato" é a conta da fonte única (aluguel + contas = R$ 3.350)`).toMatch(TOTAL_FONTE_UNICA);
  expect.soft(corpo, `${quem}: o total não é só o aluguel`).not.toMatch(TOTAL_SO_ALUGUEL);
  expect.soft(corpo, `${quem}: a linha da Caução dos blocos (R$ 1.600)`).toMatch(CAUCAO);
}

test.describe("T2225 — E1066: os e-mails de contrato assinado trazem o total da fonte única e a caução @E1066", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 200_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    const { error: eT } = await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    if (eT) throw eT;
    ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Studio assinado ${sufixo}`, { ativo: true, preco: 3200 });
    const { error: e1 } = await adm()
      .from("properties")
      .update({ condo_fee: 0, utilities_mode: "fixed", utilities_estimate: 150, prep_fee: 0, checkout_cleaning_enabled: false, checkout_cleaning_fee: 0, limpeza_estadia: null, min_period_days: 30, max_period_days: 180 })
      .eq("id", ids.imovel);
    if (e1) throw e1;
    const { data: l, error: eL } = await adm().from("leads").insert({ owner_id: ids.dono, tenant_id: ids.inq, property_id: ids.imovel, status: "accepted", inicio_desejado: dia(10), fim_desejado: dia(39) }).select("id").single();
    if (eL) throw eL;
    ids.lead = l.id as string;
    const { data: p, error: eP } = await adm()
      .from("propostas")
      .insert({ numero: `ORC-T2225-${sufixo}`, lead_id: ids.lead, property_id: ids.imovel, owner_id: ids.dono, tenant_id: ids.inq, status: "aceita", versao_atual: 1, validade_dias: 7, valida_ate: new Date(Date.now() + 7 * 86_400_000).toISOString(), aceita_em: new Date().toISOString() })
      .select("id")
      .single();
    if (eP) throw eP;
    ids.proposta = p.id as string;
    const { error: eV } = await adm().from("proposta_versoes").insert({
      proposta_id: ids.proposta, versao: 1, autor: "owner", valor_base: 3200, valor_mensal: 3200, meses: 1, dias: 30, data_entrada: dia(10),
      consumo: 150, limpeza_unica: 0, total_mensal: 3350, total_contrato: 3350,
    });
    if (eV) throw eV;
    const { data: c, error: eC } = await adm()
      .from("contratos")
      .insert({
        lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "essential", faixa: "media_estadia", proposta_id: ids.proposta,
        prazo_total_dias: 30, aluguel_mensal: 3200, tamanho_bloco_meses: 1, comissao_percent: 0.1, comissao_valor: 320,
        qtd_ocupantes: 1, status: "ativo", garantia: "caucao",
      })
      .select("id")
      .single();
    if (eC) throw eC;
    ids.contrato = c.id as string;
    const { error: eB } = await adm().from("contrato_blocos").insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(10), fim: dia(39), meses: 1, valor: 3200, caucao: 1600, status: "ativo" });
    if (eB) throw eB;
    // Como na t57: o dono só assina com as instruções de entrada preenchidas ("Check-in garantido").
    const { error: eK } = await adm().from("contratos_checkin").insert({ contrato_id: ids.contrato, horario: "14:00", instrucoes: "Chave na portaria, apto 12.", plantao: "34999990000" });
    if (eK) throw eK;
  });
  test.afterAll(async () => {
    if (ids.contrato) {
      await adm().from("contratos_checkin").delete().eq("contrato_id", ids.contrato);
      await adm().from("contrato_blocos").delete().eq("contrato_id", ids.contrato);
      await adm().from("contratos").delete().eq("id", ids.contrato);
    }
    if (ids.lead) await adm().from("propostas").delete().eq("lead_id", ids.lead);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("a) 1ª assinatura (morador): o e-mail ao dono traz o total da fonte única e a caução", async ({ browser }) => {
    await assinar(browser, inq.email, ids.inq, `/dashboard/locacoes/${ids.contrato}`);
    const [doDono] = await emails(ids.dono, /Falta a sua assinatura/);
    confereQuadro(doDono, "dono, falta a assinatura");
  });

  test("b/c) 2ª assinatura (dono): os e-mails 'assinado pelas duas partes' ao morador e ao dono trazem o mesmo quadro", async ({ browser }) => {
    await assinar(browser, dono.email, ids.dono, `/dashboard/contratos/${ids.contrato}`);
    const [doMorador] = await emails(ids.inq, /assinado pelas duas partes/);
    confereQuadro(doMorador, "morador, assinado pelas duas partes");
    const [doDono] = await emails(ids.dono, /assinado pelas duas partes/);
    confereQuadro(doDono, "dono (assinou por último), a sua cópia");
  });
});
