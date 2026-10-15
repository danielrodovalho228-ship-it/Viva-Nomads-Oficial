import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, statusDoImovel, tornarContratoVigente } from "../fixtures/laboratorio";

/**
 * T80 — Chamado "Encontrei câmera ou dispositivo de gravação" (ordem f92bc582, item 4):
 *  o inquilino do contrato abre o chamado → anúncio sai da busca (paused) e a orientação aparece;
 *  chamado de quem não tem contrato não mexe em anúncio nenhum.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.cam80.${sufixo}@lab.vivanomads.test`, nome: "Cíntia Câmera", role: "owner" as const };
const inquilino = { email: `inq.cam80.${sufixo}@lab.vivanomads.test`, nome: "Ivo Inquilino", role: "tenant" as const };
const ids: { dono?: string; inquilino?: string; imovel?: string; contrato?: string } = {};

test.describe("T80 — Câmera escondida tira o anúncio da busca", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inquilino = await criarConta(inquilino, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio câmera ${sufixo}`, {});
    await adm().from("properties").update({ status: "active" }).eq("id", ids.imovel);
    const { data, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.imovel, tenant_id: ids.inquilino, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 256, qtd_ocupantes: 1, status: "ativo", garantia: "caucao" })
      .select("id")
      .single();
    expect(error).toBeNull();
    ids.contrato = data!.id as string;
    await tornarContratoVigente(ids.contrato, ids.dono);
  });
  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.dono, ids.inquilino]);
  });

  test("inquilino do contrato abre o chamado: anúncio sai da busca e a orientação aparece", async ({ browser }) => {
    test.setTimeout(120_000);
    expect(await statusDoImovel(ids.imovel!)).toBe("active");
    const page = await entrar(browser, inquilino.email, senha);
    await page.goto("/ajuda?novo=1", { waitUntil: "networkidle" });
    await page.getByLabel("Assunto").selectOption({ label: "Encontrei câmera ou dispositivo de gravação" });
    await page.getByTestId("camera-contrato").locator("select").selectOption(ids.contrato!);
    await page.getByLabel("O que aconteceu?").fill("Achei um aparelho estranho no detector de fumaça da sala.");
    await page.getByRole("button", { name: "Enviar chamado" }).click();
    await expect(page.getByText(/Não mexa no aparelho/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/anúncio saiu da busca/)).toBeVisible();
    expect(await statusDoImovel(ids.imovel!)).toBe("paused");
    await page.context().close();
  });

  test("chamado de câmera sem contrato não mexe em anúncio", async ({ browser }) => {
    test.setTimeout(90_000);
    await adm().from("properties").update({ status: "active" }).eq("id", ids.imovel!);
    const page = await entrar(browser, dono.email, senha);
    await page.goto("/ajuda?novo=1", { waitUntil: "networkidle" });
    await page.getByLabel("Assunto").selectOption({ label: "Encontrei câmera ou dispositivo de gravação" });
    await page.getByLabel("O que aconteceu?").fill("Teste do dono: achei um aparelho estranho no corredor.");
    await page.getByRole("button", { name: "Enviar chamado" }).click();
    await expect(page.getByText(/Não mexa no aparelho/)).toBeVisible({ timeout: 20_000 });
    expect(await statusDoImovel(ids.imovel!)).toBe("active");
    await page.context().close();
  });
});
