import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, novaSenha, novoSufixo, tornarContratoVigente } from "../fixtures/laboratorio";

/*
  T537 — E165, guarda permanente da Pista C: a lista e o DETALHE de contratos do admin dizem o mesmo sobre um
  contrato assinado como na regra real. E165 FECHADO em 25/10 (prova da Pista B): a regra do D-5 lê as COLUNAS
  contratos.assinado_*_em + status 'ativo' + contrato_blocos — nunca a tabela contrato_assinaturas. A assinatura pela
  tela (contrato-assinar-actions.ts) grava as duas coisas: a linha em contrato_assinaturas (quem, papel, quando, hash)
  e a coluna assinado_*_em. A versão anterior desta spec só gravava as colunas e cobrava as linhas da tabela no
  detalhe — media o que o fluxo real não produz (vermelho de 40207606596, agora sem valor).
   0. o contrato satisfaz a regra do D-5 campo a campo (colunas, status, bloco ativo);
   - a lista (/admin/contratos) diz "Assinado pelas duas partes";
   - o detalhe (/admin/contratos/[id]) mostra as duas assinaturas (Proprietário e Inquilino).
  A 1280 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t537.${sufixo}@lab.vivanomads.test`, nome: "Caio Contrato", role: "owner" as const };
const inquilino = { email: `inq.t537.${sufixo}@lab.vivanomads.test`, nome: "Iris Inquilina", role: "tenant" as const };
const ids: Record<string, string> = {};

test.describe("T537 — E165: assinaturas na lista e no detalhe do admin", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inquilino = await criarConta(inquilino, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio contrato t537 ${sufixo}`, { ativo: true });
    ids.lead = await criarLead(ids.dono, ids.inquilino, ids.imovel, true);
    const { data, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.imovel,
        tenant_id: ids.inquilino,
        lead_id: ids.lead,
        owner_plan: "essential",
        faixa: "temporada",
        prazo_total_dias: 60,
        aluguel_mensal: 3200,
        tamanho_bloco_meses: 2,
        comissao_percent: 0.08,
        comissao_valor: 512,
        qtd_ocupantes: 1,
        status: "ativo",
        garantia: "caucao",
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    // Regra do D-5: colunas assinado_*_em, status 'ativo' e o bloco 1 em vigência (tornarContratoVigente).
    await tornarContratoVigente(ids.contrato, ids.dono);
    // A assinatura pela tela grava também a linha de cada parte em contrato_assinaturas, no mesmo instante da coluna.
    const { data: c } = await adm().from("contratos").select("assinado_proprietario_em, assinado_inquilino_em").eq("id", ids.contrato).single();
    const { error: eAss } = await adm()
      .from("contrato_assinaturas")
      .insert([
        { contrato_id: ids.contrato, user_id: ids.dono, papel: "proprietario", assinado_em: c!.assinado_proprietario_em, ip: null, hash_documento: "a".repeat(64) },
        { contrato_id: ids.contrato, user_id: ids.inquilino, papel: "inquilino", assinado_em: c!.assinado_inquilino_em, ip: null, hash_documento: "b".repeat(64) },
      ]);
    if (eAss) throw eAss;
  });
  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.dono, ids.inquilino]);
  });

  test("lista e detalhe mostram as duas assinaturas", async ({ browser }) => {
    test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
    // 0. A regra do D-5, campo a campo.
    const { data: regra } = await adm().from("contratos").select("status, assinado_proprietario_em, assinado_inquilino_em, contrato_blocos(status)").eq("id", ids.contrato).single();
    expect(regra?.status).toBe("ativo");
    expect(regra?.assinado_proprietario_em).toBeTruthy();
    expect(regra?.assinado_inquilino_em).toBeTruthy();
    expect((regra?.contrato_blocos as { status: string }[] | null)?.some((b) => b.status === "ativo")).toBe(true);
    const page = await (await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } })).newPage();

    await page.goto(`/admin/contratos?tipo=todos&q=${ids.contrato.slice(0, 8)}`, { waitUntil: "domcontentloaded" });
    const linha = page.getByTestId("contrato-linha").filter({ has: page.locator(`a[href="/admin/contratos/${ids.contrato}"]`) });
    await expect(linha).toHaveCount(1, { timeout: 30_000 });
    const naLista = (await linha.getByTestId("contrato-assinatura").innerText()).trim();
    expect(naLista).toBe("Assinado pelas duas partes");

    await linha.getByTestId("abrir-contrato-admin").click();
    await expect(page).toHaveURL(new RegExp(`/admin/contratos/${ids.contrato}$`));
    const assinaturas = page.getByTestId("admin-contrato-assinaturas");
    await expect(assinaturas).toBeVisible({ timeout: 30_000 });
    const noDetalhe = (await assinaturas.innerText()).trim();
    await page.screenshot({ path: "tests/laboratorio/saida/t537-detalhe-1280.png", fullPage: true });
    console.log(`t537 lista="${naLista}" detalhe="${noDetalhe.replace(/\s+/g, " ")}"`);
    expect(noDetalhe, `lista: "${naLista}" × detalhe: "${noDetalhe}"`).not.toContain("Nenhuma assinatura ainda.");
    await expect(assinaturas).toContainText("Proprietário assinou");
    await expect(assinaturas).toContainText("Inquilino assinou");
    await page.context().close();
  });
});
