import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo, tornarContratoVigente } from "../fixtures/laboratorio";

/**
 * T1130 — E544 (#2543, 05/11): "Avaliar o morador" só aparece DENTRO da janela de avaliação (contrato encerrado, até 14
 * dias depois do fim — a regra do servidor, 0089). Antes, o botão aparecia em contrato em vigência e o servidor
 * recusava. Entrou com o e544-avaliacao-janela.test.ts; aqui é o cartão do contrato em Contratos, 390 e 1280:
 *   A. contrato em vigência → "A avaliação abre quando a estadia terminar e fica aberta por 14 dias." e NENHUM botão
 *      "Avaliar o morador";
 *   B. contrato concluído há 3 dias → o botão "Avaliar o morador" aparece e o aviso de janela fechada não.
 * Nada é avaliado.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1130.${sufixo}@lab.vivanomads.test`, nome: "Ivo Janela Costa", role: "owner" as const };
const morA = { email: `mora.t1130.${sufixo}@lab.vivanomads.test`, nome: "Ana Janela Costa", role: "tenant" as const };
const morB = { email: `morb.t1130.${sufixo}@lab.vivanomads.test`, nome: "Bia Janela Costa", role: "tenant" as const };
const FECHADA = "A avaliação abre quando a estadia terminar e fica aberta por 14 dias.";
const ids: Record<string, string> = {};
const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function contrato(imovel: string, morador: string, lead: string, status: string): Promise<string> {
  const { data, error } = await adm()
    .from("contratos")
    .insert({
      property_id: imovel,
      tenant_id: morador,
      lead_id: lead,
      owner_plan: "essential",
      faixa: "temporada",
      prazo_total_dias: 60,
      aluguel_mensal: 3200,
      tamanho_bloco_meses: 2,
      comissao_percent: 0.08,
      comissao_valor: 512,
      qtd_ocupantes: 1,
      status,
      garantia: "caucao",
    })
    .select("id")
    .single();
  expect(error, error?.message).toBeNull();
  return data!.id as string;
}

const cartao = (p: Page, id: string) => p.locator(`[data-testid="contrato-cartao"][data-contrato="${id}"]`);

test.describe("T1130 — E544: \"Avaliar o morador\" só dentro da janela de avaliação", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.a = await criarConta(morA, senha);
    ids.b = await criarConta(morB, senha);
    ids.imA = await criarImovelPronto(ids.dono, `Casa em vigência E544 ${sufixo}`, { ativo: true });
    ids.imB = await criarImovelPronto(ids.dono, `Casa encerrada E544 ${sufixo}`, { ativo: true });
    // A: em vigência.
    ids.cA = await contrato(ids.imA, ids.a, await criarLead(ids.dono, ids.a, ids.imA, true), "ativo");
    await tornarContratoVigente(ids.cA, ids.dono, 3200);
    // B: concluído há 3 dias (dentro da janela de 14), bloco no passado.
    ids.cB = await contrato(ids.imB, ids.b, await criarLead(ids.dono, ids.b, ids.imB, true), "ativo");
    const assinado = new Date(Date.now() - 70 * 86_400_000).toISOString();
    const { error: eBloco } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: ids.cB, numero_bloco: 1, inicio: dia(-63), fim: dia(-3), meses: 2, valor: 6400, caucao: 3200, status: "encerrado" });
    expect(eBloco, eBloco?.message).toBeNull();
    const { error: eFim } = await adm()
      .from("contratos")
      .update({ status: "concluido", encerrado_em: new Date(Date.now() - 3 * 86_400_000).toISOString(), assinado_proprietario_em: assinado, assinado_inquilino_em: assinado })
      .eq("id", ids.cB);
    expect(eFim, eFim?.message).toBeNull();
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono, ids.a, ids.b]);
  });

  for (const w of [390, 1280] as const) {
    test(`em vigência: janela fechada, sem botão; concluído há 3 dias: "Avaliar o morador" (${w})`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      try {
        await p.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
        const a = cartao(p, ids.cA);
        const b = cartao(p, ids.cB);
        await expect(a).toBeVisible({ timeout: 30_000 });
        await expect(b).toBeVisible({ timeout: 30_000 });
        await expect(a.getByTestId("avaliacao-fechada")).toHaveText(FECHADA);
        await expect(a.getByRole("button", { name: "Avaliar o morador" })).toHaveCount(0);
        await expect(b.getByRole("button", { name: "Avaliar o morador" })).toBeVisible();
        await expect(b.getByTestId("avaliacao-fechada")).toHaveCount(0);
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await p.context().close();
      }
    });
  }
});
