import { test, expect, type Browser } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { addDiasISO } from "../../../src/lib/contrato-blocos";
import { dataHoraAssinatura } from "../../../src/lib/contrato-assinar";
import { textoDasPaginas } from "../../../src/lib/fiscal/pdf-texto";
import { hojeBR } from "../../../src/lib/utils";

/*
  T1710 — E1069 @E1069: o Pacote de provas (PDF) diz a hora certa na linha do tempo e o nome de quem assinou.
  Na prova ao vivo de 20/11 o pagamento marcado pelo proprietário aparecia sempre "às 09:00" (o dia do pagamento ia ao
  meio-dia UTC, que é 09:00 em Brasília) e as assinaturas diziam só "O proprietário" / "O inquilino".
   1. O dono registra o 1º pagamento pela tela. No PDF que a moradora baixa, a linha do pagamento traz a hora em que
      ele foi REGISTRADO (lida do banco), não 09:00.
   2. No PDF de cada parte, as assinaturas trazem "Nome completo (papel)": na seção ASSINATURAS (com hash e só com a
      data gravada no contrato) e na linha do tempo.
   3. A moradora confirma o pagamento pela tela: a confirmação entra na linha do tempo depois do registro, cada uma na
      sua hora.
  Não há captura de tela: o que muda é o texto de um PDF. O texto extraído do PDF fica em tests/laboratorio/saida.
  Laboratório; não é prova ao vivo no site.
  Vizinha do E1072 (#4084, ORDEM-DUET-1095): corre também no portão do #4084, porque o registro do pagamento do bloco
  passou a conferir o teto também no 1º registro (não passa do que o contrato diz que o bloco custa).
*/
const SAIDA = "tests/laboratorio/saida";
const INICIO = hojeBR();
const ASSINOU_DONO = "2026-10-01T17:32:00Z"; // 14:32 em Brasília
const ASSINOU_INQ = "2026-10-01T18:05:00Z"; // 15:05 em Brasília
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1710.${sufixo}@lab.vivanomads.test`, nome: "Dora Hora Sobrenome", role: "owner" as const };
const inq = { email: `inq.t1710.${sufixo}@lab.vivanomads.test`, nome: "Iris Hora Sobrenome", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; contrato?: string } = {};

/** O texto do PDF que a pessoa baixa, com os espaços e as quebras de linha reduzidos a um espaço. */
async function textoDoPacote(browser: Browser, email: string, nome: string): Promise<string> {
  const page = await entrar(browser, email, senha);
  const resp = await page.request.get(`/api/contrato/${ids.contrato}/provas`);
  expect(resp.status(), "a rota devolve o PDF").toBe(200);
  expect(resp.headers()["content-type"]).toContain("application/pdf");
  const paginas = await textoDasPaginas(new Uint8Array(await resp.body()));
  mkdirSync(SAIDA, { recursive: true });
  writeFileSync(`${SAIDA}/t1710-${nome}.txt`, paginas.join("\n"));
  await page.context().close();
  return paginas.join("\n").replace(/\s+/g, " ");
}

const pagamento = async () => {
  const { data, error } = await adm().from("pagamentos_bloco").select("created_at, confirmado_em, confirmado_pelo_inquilino").eq("contrato_id", ids.contrato!).eq("tipo", "aluguel");
  if (error) throw error;
  return (data ?? [])[0] as { created_at: string; confirmado_em: string | null; confirmado_pelo_inquilino: boolean } | undefined;
};

test.describe("T1710 — E1069: o pacote de provas diz a hora certa e o nome de quem assinou @E1069", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Studio hora ${sufixo}`, { ativo: true, preco: 3200 });
    const { data, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, status: "ativo", garantia: "caucao", assinado_proprietario_em: ASSINOU_DONO, assinado_inquilino_em: ASSINOU_INQ })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    const { error: eBloco } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: INICIO, fim: addDiasISO(INICIO, 59), meses: 2, valor: 6400, caucao: 3200, status: "ativo" });
    if (eBloco) throw eBloco;
    // O dono tem o registro da assinatura com hash; a moradora, só a data gravada no contrato (as duas formas do pacote).
    const { error: eAss } = await adm()
      .from("contrato_assinaturas")
      .insert({ contrato_id: ids.contrato, user_id: ids.dono, papel: "proprietario", assinado_em: ASSINOU_DONO, hash_documento: "a".repeat(64) });
    if (eAss) throw eAss;
  });

  test.afterAll(async () => {
    if (ids.contrato) {
      await adm().from("pagamentos_bloco").delete().eq("contrato_id", ids.contrato);
      await adm().from("contrato_assinaturas").delete().eq("contrato_id", ids.contrato);
      await adm().from("contratos").delete().eq("id", ids.contrato);
    }
    await apagarContas([ids.dono, ids.inq]);
  });

  test("1. o pagamento entra na linha do tempo na hora em que o dono o registrou, não às 09:00", async ({ browser }) => {
    const pd = await entrar(browser, dono.email, senha);
    await pd.setViewportSize({ width: 1280, height: 900 });
    await pd.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await pd.getByTestId("registrar-recebimento").first().click();
    await pd.getByRole("button", { name: "Confirmar recebimento" }).click();
    await expect.poll(async () => !!(await pagamento()), { timeout: 30_000, message: "o 1º pagamento grava" }).toBe(true);
    await pd.context().close();

    const registro = (await pagamento())!;
    const quando = dataHoraAssinatura(registro.created_at); // "DD/MM/AAAA às HH:MM", em Brasília
    const texto = await textoDoPacote(browser, inq.email, "1-moradora");
    expect(texto, "a linha do pagamento traz a hora do registro").toContain(`${quando} — Aluguel de R$ 6.400,00 marcado como pago pelo proprietário`);
    // A hora antiga era sempre 09:00 (meio-dia UTC). Só não se cobra a ausência dela se o registro for mesmo às 09:00.
    if (!quando.endsWith("às 09:00")) expect(texto).not.toContain("às 09:00 — Aluguel");
  });

  test("2. as assinaturas trazem o nome de quem assinou, para as duas partes", async ({ browser }) => {
    for (const [nome, email] of [["2-dono", dono.email], ["2-moradora", inq.email]] as const) {
      const texto = await textoDoPacote(browser, email, nome);
      expect(texto, `${nome}: a assinatura com hash traz o nome`).toContain("Dora Hora Sobrenome (proprietário) em 01/10/2026 às 14:32 — Hash do resumo assinado:");
      expect(texto, `${nome}: a data gravada no contrato traz o nome`).toContain("Iris Hora Sobrenome (inquilino) em 01/10/2026 às 15:05 — data gravada no contrato");
      expect(texto, `${nome}: a linha do tempo traz o nome`).toContain("01/10/2026 às 14:32 — Dora Hora Sobrenome (proprietário) assinou o resumo do contrato.");
      expect(texto, `${nome}: nenhuma assinatura só com o papel`).not.toContain("O proprietário em 01/10/2026");
      expect(texto).not.toContain("O inquilino em 01/10/2026");
      // O pacote continua sem contato: o e-mail das contas não aparece.
      expect(texto).not.toContain("@lab.vivanomads.test");
    }
  });

  test("3. a moradora confirma: registro e confirmação ficam na linha do tempo, cada um na sua hora", async ({ browser }) => {
    const pi = await entrar(browser, inq.email, senha);
    await pi.setViewportSize({ width: 1280, height: 900 });
    await pi.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    const confirmar = pi.getByTestId("confirmar-pagamentos");
    await expect(confirmar).toBeVisible({ timeout: 30_000 });
    await confirmar.getByRole("button", { name: /Confirmar/ }).first().click();
    await expect.poll(async () => !!(await pagamento())?.confirmado_pelo_inquilino, { timeout: 30_000 }).toBe(true);
    await pi.context().close();

    const p = (await pagamento())!;
    const texto = await textoDoPacote(browser, dono.email, "3-dono");
    const marcado = `${dataHoraAssinatura(p.created_at)} — Aluguel de R$ 6.400,00 marcado como pago pelo proprietário`;
    const confirmado = `${dataHoraAssinatura(p.confirmado_em!)} — Aluguel de R$ 6.400,00 confirmado pelo inquilino.`;
    expect(texto).toContain(marcado);
    expect(texto).toContain(confirmado);
    expect(texto.indexOf(marcado), "o registro vem antes da confirmação").toBeLessThan(texto.indexOf(confirmado));
  });
});
