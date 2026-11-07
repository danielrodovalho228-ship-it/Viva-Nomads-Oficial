import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1395 — E676 (#3167): a faixa de crítico "assinar o contrato" só vale enquanto a pessoa ainda precisa assinar.
  Aviso crítico (contract_status, ref_id = contrato) com a assinatura da inquilina pendente: a faixa aparece com o botão
  "Assinar o contrato". Depois que ela assina (o banco passa a dizer que não falta nada), mesmo com o aviso sem
  resolvido_em, a faixa some e o sino deixa de pintar de crítico. 390 e 1280 px, sem estouro.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1395.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const inq = { email: `inq.t1395.${sufixo}@lab.vivanomads.test`, nome: "Ivo Inquilino", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; contrato?: string } = {};
const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

test.describe("T1395 — E676: faixa de crítico confere a situação real do contrato", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio T1395 ${sufixo}`, { ativo: true });
    const { data, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 30, aluguel_mensal: 3200, tamanho_bloco_meses: 1, comissao_percent: 0.08, comissao_valor: 256, qtd_ocupantes: 1, status: "ativo", garantia: "caucao", periodo: `[${dia(10)},${dia(41)})`, assinado_proprietario_em: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
  });
  test.afterAll(async () => {
    await adm().from("avisos").delete().eq("usuario_id", ids.inq ?? "");
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: a faixa some quando não falta assinatura`, async ({ browser }) => {
      await adm().from("contratos").update({ assinado_inquilino_em: null }).eq("id", ids.contrato!);
      await adm().from("avisos").delete().eq("usuario_id", ids.inq!);
      const { error } = await adm().from("avisos").insert({ usuario_id: ids.inq, evento: "contract_status", prioridade: "critico", titulo: "Seu contrato está pronto para assinar", url: "/dashboard/contratos", ref_id: ids.contrato });
      expect(error).toBeNull();
      const p = await entrar(browser, inq.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      // Falta a assinatura dela: a faixa aparece.
      await expect(p.getByTestId("faixa-critico")).toContainText("Seu contrato está pronto para assinar", { timeout: 30_000 });
      await expect(p.getByTestId("faixa-critico-acao")).toHaveText("Assinar o contrato");
      expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      // As duas partes assinaram; o aviso segue sem resolvido_em no banco: a faixa confere a situação e some.
      await adm().from("contratos").update({ assinado_inquilino_em: new Date().toISOString() }).eq("id", ids.contrato!);
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("faixa-critico")).toHaveCount(0, { timeout: 30_000 });
      expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await p.context().close();
    });
  }
});
