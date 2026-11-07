import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1335 — E654 (#3060): em "Enviar código por e-mail" (página do contrato da inquilina) o botão nunca "gira e volta" sem
  resposta: depois do clique aparece a confirmação ("Enviamos 6 números…", assinar-codigo-enviado) OU uma mensagem de
  erro visível, o botão volta a ficar utilizável (rótulo "Enviar outro código") e o e-mail do código chega à caixa de
  testes. Laboratório, 390 e 1280 px, sessão real; o fluxo de assinar de ponta a ponta segue na t57.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1335.${sufixo}@lab.vivanomads.test`, nome: "Dora Tela", role: "owner" as const };
const inq = { email: `inq.t1335.${sufixo}@lab.vivanomads.test`, nome: "Ivo Tela", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; contrato?: string } = {};
const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

test.describe("T1335 — E654: o pedido do código de assinatura sempre responde", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, `Código assinatura ${sufixo}`, { ativo: true, preco: 3200 });
    const { data, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 256, qtd_ocupantes: 1, status: "ativo", garantia: "caucao" })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    const { error: eb } = await adm().from("contrato_blocos").insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: emDias(30), fim: emDias(90), meses: 2, valor: 6400, caucao: 3200, status: "ativo" });
    if (eb) throw eb;
    const { error: ec } = await adm().from("contratos_checkin").insert({ contrato_id: ids.contrato, horario: "14:00", instrucoes: "Chave na portaria, apto 12.", plantao: "34999990000" });
    if (ec) throw ec;
  });
  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: pedir o código termina em confirmação ou erro visível, nunca em silêncio`, async ({ browser }) => {
      const page = await entrar(browser, inq.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto(`/dashboard/locacoes/${ids.contrato}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("form-assinar")).toBeVisible({ timeout: 20_000 });
      const botao = page.getByTestId("assinar-pedir-codigo");
      await botao.click();
      const confirmacao = page.getByTestId("assinar-codigo-enviado");
      const erro = page.getByTestId("form-assinar").getByRole("alert");
      await expect(confirmacao.or(erro).first()).toBeVisible({ timeout: 45_000 });
      // No laboratório o envio funciona: a confirmação é a resposta esperada, e o botão volta a servir.
      await expect(confirmacao).toContainText("Enviamos 6 números");
      await expect(botao).toBeEnabled();
      await expect(botao).toContainText("Enviar outro código");
      await expect.poll(async () => (await adm().from("emails_teste").select("evento", { count: "exact", head: true }).eq("usuario_id", ids.inq!).eq("evento", "contract_signature_code")).count ?? 0, { timeout: 30_000 }).toBeGreaterThan(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await page.context().close();
    });
  }
});
