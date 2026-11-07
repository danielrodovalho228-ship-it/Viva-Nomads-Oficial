import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1392 — E673 (draft Pista B, branch claude-b/e673-disponivel-a-partir): "Disponível a partir de" no anúncio público mostra a
  PRIMEIRA ENTRADA POSSÍVEL, olhando os períodos ocupados, e não só a data do cadastro do dono.
   - Imóvel LIVRE (sem contrato): a data é a do cadastro (available_from).
   - Imóvel com contrato ativo ocupando de hoje+10 a hoje+40: a data passa para depois do bloqueio (≥ hoje+41), igual no
     cabeçalho (data-desde) e no texto, e deixa de ser a do cadastro.
  Página pública, sem login, 390 e 1280 px. Spec preparada sobre a branch do draft; só roda verde com o E673 presente.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1392.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona Disponivel", role: "owner" as const };
const inq = { email: `inq.t1392.${sufixo}@lab.vivanomads.test`, nome: "Ivo Inquilino Disponivel", role: "tenant" as const };
const ids: { dono?: string; inq?: string; livre?: string; ocupado?: string; contrato?: string } = {};
const emDias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const br = (iso: string) => iso.split("-").reverse().join("/");

test.describe("T1392 — E673: 'Disponível a partir de' olha os períodos ocupados", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    for (const k of ["livre", "ocupado"] as const) {
      ids[k] = await criarImovelPronto(ids.dono, `Studio T1392 ${k} ${sufixo}`, { ativo: true });
      const { error } = await adm().from("properties").update({ available_from: emDias(10), min_period_days: 30, max_period_days: 180 }).eq("id", ids[k]!);
      if (error) throw error;
    }
    const { data, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.ocupado, tenant_id: ids.inq, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 30, aluguel_mensal: 3200, tamanho_bloco_meses: 1, comissao_percent: 0.08, comissao_valor: 256, qtd_ocupantes: 1, status: "ativo", garantia: "caucao" })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    const { error: eb } = await adm().from("contrato_blocos").insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: emDias(10), fim: emDias(40), meses: 1, valor: 3200, caucao: 3200, status: "ativo" });
    if (eb) throw eb;
  });
  test.afterAll(async () => {
    if (ids.contrato) {
      await adm().from("contrato_blocos").delete().eq("contrato_id", ids.contrato);
      await adm().from("contratos").delete().eq("id", ids.contrato);
    }
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: livre mostra a data do cadastro; ocupado mostra a primeira entrada depois do bloqueio`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      const p = await ctx.newPage();

      await p.goto(`/imoveis/${ids.livre}`, { waitUntil: "domcontentloaded" });
      const livre = p.getByTestId("disponivel-a-partir").first();
      await expect(livre).toBeVisible({ timeout: 30_000 });
      await expect(livre).toHaveText(br(emDias(10)));

      await p.goto(`/imoveis/${ids.ocupado}`, { waitUntil: "domcontentloaded" });
      const ocupado = p.getByTestId("disponivel-a-partir").first();
      await expect(ocupado).toBeVisible({ timeout: 30_000 });
      // O calendário carrega os dias ocupados depois do primeiro desenho: espera a data sair da do cadastro.
      await expect.poll(async () => (await ocupado.getAttribute("data-desde")) ?? "", { timeout: 30_000, message: "a data passa a olhar o bloqueio" }).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const desde = (await ocupado.getAttribute("data-desde"))!;
      expect(desde > emDias(40), `a primeira entrada (${desde}) vem depois do bloqueio que termina em ${emDias(40)}`).toBe(true);
      expect(desde).not.toBe(emDias(10));
      await expect(ocupado).toHaveText(br(desde));
      expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await ctx.close();
    });
  }
});
