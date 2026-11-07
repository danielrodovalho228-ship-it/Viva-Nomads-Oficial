import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo, tornarContratoVigente } from "../fixtures/laboratorio";

/*
  T1358 — E669 (draft #3135, migração 0319): "Anexar laudo independente" na conferência de entrada.
   1. um PDF de 193 bytes (o do relato) é RECUSADO com mensagem de tamanho e nada é gravado;
   2. um PDF completo (%PDF … %%EOF, 2 KB) é aceito: o aviso do laudo aparece e o autor vê "Remover laudo";
   3. o autor remove (com confirmação): o laudo some, "Anexar laudo independente" volta e o ato fica registrado em
      conferencia_laudos_retirados; a outra parte (dono) não vê os controles de remover/trocar do laudo alheio.
  Inquilino autor, 390 e 1280 px. Spec preparada sobre a branch do draft; só roda verde com a migração 0319 e o E669.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1358.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona Laudo", role: "owner" as const };
const inq = { email: `inq.t1358.${sufixo}@lab.vivanomads.test`, nome: "Ivo Inquilino Laudo", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string; contrato?: string } = {};
const pdf = (kb: number) => Buffer.concat([Buffer.from("%PDF-1.4\n% laudo de teste\n"), Buffer.alloc(kb * 1024, 0x20), Buffer.from("\n%%EOF\n")]);
const laudos = async () => {
  const { data: confs } = await adm().from("conferencias").select("id").eq("contrato_id", ids.contrato!);
  const confIds = (confs ?? []).map((c) => c.id as string);
  if (!confIds.length) return { ativos: 0, retirados: 0, confIds };
  const a = await adm().from("conferencia_laudos").select("id", { count: "exact", head: true }).in("conferencia_id", confIds);
  const r = await adm().from("conferencia_laudos_retirados").select("conferencia_id", { count: "exact", head: true }).in("conferencia_id", confIds);
  return { ativos: a.count ?? 0, retirados: r.count ?? 0, confIds };
};

test.describe("T1358 — E669: laudo independente validado e removível", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio laudo ${sufixo}`, { ativo: true });
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel, true);
    const { data, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.imovel, tenant_id: ids.inq, lead_id: ids.lead, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, status: "ativo", garantia: "caucao" })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    await tornarContratoVigente(ids.contrato, ids.dono, 3200);
  });
  test.afterAll(async () => {
    if (ids.contrato) {
      const { confIds } = await laudos();
      if (confIds.length) {
        await adm().from("conferencia_laudos_retirados").delete().in("conferencia_id", confIds);
        for (const t of ["conferencia_laudos", "conferencia_respostas", "conferencia_itens"]) await adm().from(t).delete().in("conferencia_id", confIds);
        await adm().from("conferencias").delete().in("id", confIds);
      }
      await adm().from("pagamentos_bloco").delete().eq("contrato_id", ids.contrato);
      await adm().from("contrato_blocos").delete().eq("contrato_id", ids.contrato);
      await adm().from("contratos").delete().eq("id", ids.contrato);
    }
    if (ids.lead) await adm().from("leads").delete().eq("id", ids.lead);
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: PDF de 193 bytes é recusado; PDF completo é aceito e o autor remove`, async ({ browser }) => {
      const p = await entrar(browser, inq.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto(`/dashboard/locacoes/${ids.contrato}`, { waitUntil: "domcontentloaded" });
      const entrada = p.getByTestId("conferencia-entrada");
      await expect(entrada).toBeVisible({ timeout: 25_000 });
      const input = p.getByTestId("conferencia-entrada-laudo-input");

      await input.setInputFiles({ name: "teste.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n".padEnd(193, " ")) });
      await expect(p.getByTestId("conferencia-erro")).toContainText(/pequeno demais|incompleto/i, { timeout: 20_000 });
      expect((await laudos()).ativos, "o PDF recusado não é gravado").toBe(0);

      await input.setInputFiles({ name: "laudo.pdf", mimeType: "application/pdf", buffer: pdf(2) });
      await expect(p.getByTestId("conferencia-laudo")).toBeVisible({ timeout: 30_000 });
      expect((await laudos()).ativos).toBe(1);
      const remover = p.getByTestId("conferencia-entrada-laudo-remover");
      await expect(remover).toBeVisible();
      await remover.click(); // abre a confirmação
      await p.getByRole("button", { name: /^(sim|confirmar|remover)/i }).last().click();
      await expect(p.getByTestId("conferencia-laudo")).toHaveCount(0, { timeout: 30_000 });
      await expect(p.getByTestId("conferencia-entrada-laudo-botao")).toBeVisible();
      const depois = await laudos();
      expect(depois.ativos, "o laudo foi retirado").toBe(0);
      expect(depois.retirados, "a retirada ficou registrada").toBeGreaterThanOrEqual(1);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await p.context().close();
    });
  }
});
