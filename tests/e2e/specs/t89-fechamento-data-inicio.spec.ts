import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { hojeBR } from "../../../src/lib/utils";
import { addDiasISO } from "../../../src/lib/contrato-blocos";

/**
 * T89 — Fechamento: "Data de início da estadia" (ordem 02d4c903 / c4530769, F37).
 * Campo obrigatório na etapa 1, sem data passada, e a data aparece no resumo; a 390 px.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.ini.${sufixo}@lab.vivanomads.test`, nome: "Dora Início", role: "owner" as const };
const inq = { email: `inq.ini.${sufixo}@lab.vivanomads.test`, nome: "Ivo Início", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string } = {};

test.describe("T89 — data de início no Fechamento", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha, true);
    ids.inq = await criarConta(inq, senha, true);
    ids.imovel = await criarImovelPronto(ids.dono, `Início da estadia ${sufixo}`, { ativo: true, preco: 3000 });
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel, true);
  });

  test.afterAll(async () => {
    if (ids.lead) await adm().from("contratos").delete().eq("lead_id", ids.lead);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("o campo nasce com hoje, não aceita data passada e aceita data futura", async ({ browser }) => {
    test.setTimeout(120_000);
    const hoje = hojeBR();
    const futura = addDiasISO(hoje, 20);
    const pagina = await entrar(browser, dono.email, senha);
    await pagina.goto(`/dashboard/fechamento?c=${ids.lead}`, { waitUntil: "networkidle" });
    const campo = pagina.getByTestId("inicio-estadia");
    await expect(campo).toBeVisible({ timeout: 15_000 });
    await expect(campo).toHaveValue(hoje);
    await expect(campo).toHaveAttribute("min", hoje);

    await campo.fill(addDiasISO(hoje, -3));
    await expect(pagina.getByTestId("inicio-estadia-erro")).toContainText(/passado/i);
    await expect(pagina.getByRole("button", { name: /continuar/i })).toBeDisabled();

    await campo.fill(futura);
    await expect(pagina.getByTestId("inicio-estadia-erro")).toHaveCount(0);
    expect(await pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await pagina.context().close();
  });
  test("o contrato registrado com início futuro mostra a data no resumo do inquilino (390 px)", async ({ browser }) => {
    test.setTimeout(120_000);
    const inicio = addDiasISO(hojeBR(), 20);
    const fim = addDiasISO(inicio, 59);
    const { data: contrato, error } = await adm().from("contratos").insert({
      lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "essential", faixa: "media_estadia",
      prazo_total_dias: 60, aluguel_mensal: 3000, tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 720,
      qtd_ocupantes: 1,
    }).select("id").single();
    expect(error).toBeNull();
    const { error: e2 } = await adm().from("contrato_blocos").insert({
      contrato_id: contrato!.id, numero_bloco: 1, inicio, fim, meses: 2, valor: 6000, caucao: 3000, status: "agendado",
    });
    expect(e2).toBeNull();
    const [a, m, d] = inicio.split("-");
    const pagina = await entrar(browser, inq.email, senha);
    await pagina.goto(`/dashboard/locacoes/${contrato!.id}`, { waitUntil: "networkidle" });
    await expect(pagina.getByTestId("contrato-resumo")).toContainText(`Início da estadia: ${d}/${m}/${a}`, { timeout: 15_000 });
    expect(await pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await pagina.context().close();
  });

  test("a data que o inquilino pôs na candidatura já vem preenchida; data que já passou volta para hoje", async ({ browser }) => {
    test.setTimeout(120_000);
    const hoje = hojeBR();
    const desejada = addDiasISO(hoje, 12);
    const { error } = await adm().from("leads").update({ inicio_desejado: desejada }).eq("id", ids.lead!);
    expect(error).toBeNull();
    const pagina = await entrar(browser, dono.email, senha);
    await pagina.goto(`/dashboard/fechamento?c=${ids.lead}`, { waitUntil: "networkidle" });
    await expect(pagina.getByTestId("inicio-estadia")).toHaveValue(desejada, { timeout: 15_000 });

    // Data guardada que já passou não vira data inválida no Fechamento: abre em hoje.
    await adm().from("leads").update({ inicio_desejado: addDiasISO(hoje, -5) }).eq("id", ids.lead!);
    await pagina.goto(`/dashboard/fechamento?c=${ids.lead}`, { waitUntil: "networkidle" });
    await expect(pagina.getByTestId("inicio-estadia")).toHaveValue(hoje, { timeout: 15_000 });
    await pagina.context().close();
  });

  test("contrato com início futuro: o bloco 1 e o resumo do inquilino mostram a data escolhida", async ({ browser }) => {
    test.setTimeout(120_000);
    const futura = addDiasISO(hojeBR(), 20);
    const fim = addDiasISO(futura, 89);
    // O teste anterior já registrou um contrato para este lead (lead_id é único): começa limpo.
    await adm().from("contratos").delete().eq("lead_id", ids.lead!);
    const { data: contrato, error } = await adm()
      .from("contratos")
      .insert({
        lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "essential", faixa: "media_estadia",
        prazo_total_dias: 90, aluguel_mensal: 3000, tamanho_bloco_meses: 3, comissao_percent: 0.12, comissao_valor: 1080,
        qtd_ocupantes: 1,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    const { error: e2 } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: contrato!.id, numero_bloco: 1, inicio: futura, fim, meses: 3, valor: 9000, caucao: 4500, status: "agendado" });
    expect(e2).toBeNull();

    const [d, m, a] = [futura.slice(8, 10), futura.slice(5, 7), futura.slice(0, 4)];
    const pagina = await entrar(browser, inq.email, senha);
    await pagina.goto(`/dashboard/locacoes/${contrato!.id}`, { waitUntil: "domcontentloaded" });
    await expect(pagina.getByTestId("contrato-inicio-estadia")).toContainText(`${d}/${m}/${a}`, { timeout: 15_000 });
    expect(await pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await pagina.context().close();
  });
});
