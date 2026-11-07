import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1432 — E679 (#3231, na main; migração 0322): o formulário de avaliação do morador para o proprietário tem CRITÉRIOS FIXOS
  (imóvel como no anúncio · limpeza na chegada · comunicação), etiquetas rápidas (no máximo 5) e "Recomendaria este imóvel?".
  O envio só habilita com a nota, os três critérios e o "recomendaria" preenchidos (caminho negativo: com a nota sozinha, o botão
  fica desabilitado). Não envia a avaliação (nada é gravado). Locação concluída há 1 dia (dentro dos 14 dias da janela),
  390 e 1280 px, sem estouro horizontal.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1432.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const morador = { email: `mor.t1432.${sufixo}@lab.vivanomads.test`, nome: "Moacir Morador", role: "tenant" as const };
const ids: { dono?: string; morador?: string; imovel?: string; lead?: string; contrato?: string } = {};
const dia = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
const CRITERIOS = ["Imóvel como no anúncio", "Limpeza na chegada", "Comunicação"];

test.describe("T1432 — E679: formulário de avaliação com critérios fixos", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio T1432 ${sufixo}`, { ativo: true, preco: 3000 });
    ids.lead = await criarLead(ids.dono, ids.morador, ids.imovel, true);
    const agora = new Date().toISOString();
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({ lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.morador, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3000, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 240, qtd_ocupantes: 1, status: "concluido", encerrado_em: new Date(Date.now() - 86_400_000).toISOString(), assinado_proprietario_em: agora, assinado_inquilino_em: agora })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    const { error: eb } = await adm().from("contrato_blocos").insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(-61), fim: dia(-2), meses: 2, valor: 6000, caucao: 3000, status: "ativo" });
    if (eb) throw eb;
  });
  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    if (ids.lead) await adm().from("leads").delete().eq("id", ids.lead);
    await apagarContas([ids.dono, ids.morador]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: critérios fixos, no máximo 5 etiquetas e envio só com tudo preenchido`, async ({ browser }) => {
      const p = await entrar(browser, morador.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
      const abrir = p.getByRole("button", { name: "Avaliar o proprietário" });
      await expect(async () => {
        await abrir.click();
        await expect(p.getByTestId("avaliacao-criterios")).toBeVisible({ timeout: 3_000 });
      }).toPass({ timeout: 40_000 });
      const form = p.getByTestId("avaliacao-criterios");
      for (const c of CRITERIOS) await expect(form).toContainText(c);
      expect(await form.getByRole("radiogroup").count()).toBe(3);

      const enviar = p.getByTestId("avaliacao-enviar");
      // Caminho negativo: só a nota → o envio segue desabilitado.
      await p.getByRole("radio", { name: "5 estrelas" }).click();
      await expect(enviar).toBeDisabled();
      // Três critérios sem o "recomendaria" → ainda desabilitado.
      for (const c of CRITERIOS) await p.getByRole("radio", { name: `${c}: 4` }).click();
      await expect(enviar).toBeDisabled();
      await p.getByRole("radiogroup", { name: "Recomendaria" }).getByRole("radio", { name: "Sim" }).click();
      await expect(enviar).toBeEnabled();

      // No máximo 5 etiquetas: a 6ª fica desabilitada.
      const etiquetas = p.getByLabel("Etiquetas rápidas").getByRole("button");
      const total = await etiquetas.count();
      expect(total).toBeGreaterThanOrEqual(6);
      for (let i = 0; i < 5; i++) await etiquetas.nth(i).click();
      await expect(etiquetas.nth(5)).toBeDisabled();
      expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await p.context().close();
    });
  }
});
