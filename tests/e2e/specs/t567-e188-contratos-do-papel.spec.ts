import { test, expect } from "@playwright/test";
import { AVISO_CAUCAO_DE_MORADOR, AVISO_CONTRATOS_DE_MORADOR } from "../../../src/lib/contratos/area-dono";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T567 — E188: a conta que é dona (sem contrato como dona) e moradora (com contrato em outro imóvel). No modo
  proprietário, "Contratos" mostra só o lado do dono (o vazio do dono sem nenhuma lista de morador embaixo) e o aviso de
  onde ficam os contratos de morador; a Caução vazia diz onde fica a caução de morador. No modo morador, o contrato de
  morador aparece. Comportamento do #1424; este teste é a cobertura E2E (390 e 1280).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const ambos = { email: `ambos.t567.${sufixo}@lab.vivanomads.test`, nome: "Bia Dois Papeis", role: "owner" as const };
const outro = { email: `outro.t567.${sufixo}@lab.vivanomads.test`, nome: "Caio Outro Dono", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T567 — E188: Contratos e Caução só com os dados do papel", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.ambos = await criarConta(ambos, senha);
    ids.outro = await criarConta(outro, senha);
    ids.meuImovel = await criarImovelPronto(ids.ambos, `Meu anúncio t567 ${sufixo}`, { ativo: true });
    ids.imovelDoOutro = await criarImovelPronto(ids.outro, `Estadia t567 ${sufixo}`, { ativo: true });
    const base = { property_id: ids.imovelDoOutro, tenant_id: ids.ambos, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 90, aluguel_mensal: 3000, tamanho_bloco_meses: 3, comissao_percent: 0.08, comissao_valor: 720, qtd_ocupantes: 1, status: "ativo", garantia: "caucao" };
    const { data, error } = await adm().from("contratos").insert(base).select("id").single();
    if (error) throw error;
    ids.contrato = data!.id as string;
  });
  test.afterAll(async () => {
    await adm().from("contratos").delete().eq("id", ids.contrato ?? "00000000-0000-0000-0000-000000000000");
    await apagarContas([ids.ambos, ids.outro]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — modo proprietário: só o lado do dono; modo morador: o contrato de morador`, async ({ browser }) => {
      const p = await entrar(browser, ambos.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("contratos-modo-dono")).toBeVisible({ timeout: 30_000 });
      await expect(p.getByText("Nenhum contrato ainda")).toBeVisible();
      await expect(p.getByTestId("contrato-inquilino")).toHaveCount(0);
      await expect(p.getByTestId("secao-contratos-inquilino")).toHaveCount(0);
      await expect(p.getByTestId("contratos-aviso-morador")).toHaveText(AVISO_CONTRATOS_DE_MORADOR);
      await p.screenshot({ path: `${SAIDA}/t567-contratos-dono-${largura}.png`, fullPage: true });

      await p.goto("/dashboard/garantias", { waitUntil: "domcontentloaded" });
      await expect(p.getByText("Nenhuma caução ainda")).toBeVisible({ timeout: 30_000 });
      await expect(p.getByText(AVISO_CAUCAO_DE_MORADOR)).toBeVisible();
      await p.screenshot({ path: `${SAIDA}/t567-caucao-dono-${largura}.png`, fullPage: true });

      await p.context().close();

      // Modo morador (o mesmo que a troca de modo grava): o contrato de morador aparece, sem o vazio do dono.
      await adm().from("profiles").update({ preferred_mode: "tenant", papel_ativo: "morador" }).eq("id", ids.ambos);
      const m = await entrar(browser, ambos.email, senha);
      await m.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await m.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
      await expect(m.getByTestId("contratos-modo-morador")).toBeVisible({ timeout: 30_000 });
      await expect(m.getByTestId("contrato-inquilino")).toHaveCount(1);
      await expect(m.getByText("Nenhum contrato ainda")).toHaveCount(0);
      await m.screenshot({ path: `${SAIDA}/t567-contratos-morador-${largura}.png`, fullPage: true });
      await m.context().close();
      await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.ambos);
    });
  }
});
