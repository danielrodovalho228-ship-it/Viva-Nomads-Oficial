import { test, expect, type Browser } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1788 — E1199 @E1199 (ORDEM-DUET-936; trava de tela dada na ORDEM-DUET-949). Família do E1141.
  Antes: o e-mail da assinatura montava o quadro (o "Total do contrato") com a proposta aceite MAIS RECENTE da
  candidatura, não com a proposta de que o contrato nasceu. Com duas estadias na mesma candidatura (o E1141 já gera o
  contrato de uma estadia anterior), o e-mail do contrato da estadia antiga mostraria o total da estadia nova.
  Massa de duas estadias, só no banco do laboratório e com contas de teste:
   - a proposta ANTIGA (a do contrato): aluguel R$ 3.200 + contas R$ 150 = R$ 3.350 por mês, 1 mês;
   - a proposta NOVA, aceite depois e sem contrato: aluguel R$ 4.000 + contas R$ 150 = R$ 4.150 por mês, 1 mês;
   - o contrato aguardando assinatura, com `proposta_id` = a antiga.
  O morador assina PELA TELA (o caminho da t2225, código lido na caixa de teste) e o e-mail ao dono ("Falta a sua
  assinatura") é lido na caixa de teste: o "Total do contrato" é o da proposta DO CONTRATO (R$ 3.350), nunca o da mais
  recente (R$ 4.150).
  Simulação declarada: candidatura, propostas, contrato e o check-in gravados pelo laboratório. Laboratório; não é
  prova ao vivo no site.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1788.${sufixo}@lab.vivanomads.test`, nome: "Dalva Duas Estadias", role: "owner" as const };
const inq = { email: `inq.t1788.${sufixo}@lab.vivanomads.test`, nome: "Iara Duas Estadias", role: "tenant" as const };
const ids: Record<string, string> = {};
const dia = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const TOTAL_DO_CONTRATO = /Total do contrato:[^\n]*R\$\s?3\.350(,00)?(?!\d)/;
const TOTAL_DA_MAIS_RECENTE = /R\$\s?4\.150(,00)?(?!\d)/;

async function codigoDaCaixa(usuarioId: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const { data } = await adm().from("emails_teste").select("corpo").eq("usuario_id", usuarioId).eq("evento", "contract_signature_code").order("criado_em", { ascending: false }).limit(1);
    const m = /":\s*(\d{6})\s*$/m.exec(String(data?.[0]?.corpo ?? "").trim());
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("O código de assinatura não chegou à caixa de testes em 30 s.");
}
async function emailDeContrato(usuarioId: string, re: RegExp): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const { data } = await adm().from("emails_teste").select("corpo").eq("usuario_id", usuarioId).eq("evento", "contract_status").order("criado_em", { ascending: true });
    const achado = (data ?? []).map((d) => String(d.corpo ?? "")).find((c) => re.test(c));
    if (achado) return achado;
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
  expect(enviado, `o código de assinatura sai (o formulário diz: ${(await page.getByTestId("form-assinar").innerText().catch(() => "sem formulário")).replace(/\s+/g, " ").slice(0, 400)})`).toBe(true);
  await page.getByTestId("assinar-aceite").check();
  await page.getByTestId("assinar-codigo").fill(await codigoDaCaixa(usuarioId));
  await page.getByTestId("assinar-enviar").click();
  await expect(page.getByTestId("form-assinar")).toHaveCount(0, { timeout: 45_000 });
  await page.context().close();
}
async function proposta(numero: string, valor: number, aceitaEm: string, status: string): Promise<string> {
  const { data: p, error: eP } = await adm()
    .from("propostas")
    .insert({ numero, lead_id: ids.lead, property_id: ids.imovel, owner_id: ids.dono, tenant_id: ids.inq, status, versao_atual: 1, validade_dias: 7, valida_ate: new Date(Date.now() + 7 * 86_400_000).toISOString(), aceita_em: aceitaEm })
    .select("id")
    .single();
  if (eP) throw eP;
  const { error: eV } = await adm().from("proposta_versoes").insert({
    proposta_id: p.id, versao: 1, autor: "owner", valor_base: valor, valor_mensal: valor, meses: 1, dias: 30, data_entrada: dia(10),
    consumo: 150, limpeza_unica: 0, total_mensal: valor + 150, total_contrato: valor + 150,
  });
  if (eV) throw eV;
  return p.id as string;
}

test.describe("T1788 — E1199: o e-mail da assinatura traz o total da proposta DO CONTRATO @E1199", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 200_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    const { error: eT } = await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    if (eT) throw eT;
    ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Studio duas estadias ${sufixo}`, { ativo: true, preco: 3200 });
    const { error: e1 } = await adm()
      .from("properties")
      .update({ condo_fee: 0, utilities_mode: "fixed", utilities_estimate: 150, prep_fee: 0, checkout_cleaning_enabled: false, checkout_cleaning_fee: 0, limpeza_estadia: null, min_period_days: 30, max_period_days: 180 })
      .eq("id", ids.imovel);
    if (e1) throw e1;
    const { data: l, error: eL } = await adm().from("leads").insert({ owner_id: ids.dono, tenant_id: ids.inq, property_id: ids.imovel, status: "accepted", inicio_desejado: dia(10), fim_desejado: dia(39) }).select("id").single();
    if (eL) throw eL;
    ids.lead = l.id as string;
    // A antiga (a do contrato) aceite ontem; a nova aceite agora — a mais recente da candidatura, sem contrato.
    ids.antiga = await proposta(`ORC-T1788A-${sufixo}`, 3200, new Date(Date.now() - 86_400_000).toISOString(), "em_contrato");
    ids.nova = await proposta(`ORC-T1788B-${sufixo}`, 4000, new Date().toISOString(), "aceita");
    const { data: c, error: eC } = await adm()
      .from("contratos")
      .insert({
        lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "essential", faixa: "media_estadia", proposta_id: ids.antiga,
        prazo_total_dias: 30, aluguel_mensal: 3200, tamanho_bloco_meses: 1, comissao_percent: 0.1, comissao_valor: 320,
        qtd_ocupantes: 1, status: "ativo", garantia: "caucao",
      })
      .select("id")
      .single();
    if (eC) throw eC;
    ids.contrato = c.id as string;
    const { error: eB } = await adm().from("contrato_blocos").insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(10), fim: dia(39), meses: 1, valor: 3200, caucao: 1600, status: "ativo" });
    if (eB) throw eB;
    const { error: eK } = await adm().from("contratos_checkin").insert({ contrato_id: ids.contrato, horario: "14:00", instrucoes: "Chave na portaria, apto 12.", plantao: "34999990000" });
    if (eK) throw eK;
  });
  test.afterAll(async () => {
    if (ids.contrato) {
      await adm().from("contratos_checkin").delete().eq("contrato_id", ids.contrato);
      await adm().from("contrato_blocos").delete().eq("contrato_id", ids.contrato);
      await adm().from("contratos").delete().eq("id", ids.contrato);
    }
    if (ids.lead) {
      await adm().from("propostas").delete().eq("lead_id", ids.lead);
      await adm().from("leads").delete().eq("id", ids.lead);
    }
    if (ids.imovel) await adm().from("properties").delete().eq("id", ids.imovel);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("o morador assina: o e-mail ao dono traz o total da proposta do contrato (R$ 3.350), nunca o da mais recente (R$ 4.150)", async ({ browser }) => {
    await assinar(browser, inq.email, ids.inq, `/dashboard/locacoes/${ids.contrato}`);
    const corpo = await emailDeContrato(ids.dono, /Falta a sua assinatura/);
    expect(corpo, "o total é o da proposta de que o contrato nasceu").toMatch(TOTAL_DO_CONTRATO);
    expect(corpo, "o total da estadia nova (a proposta aceite mais recente) não aparece").not.toMatch(TOTAL_DA_MAIS_RECENTE);
  });
});
