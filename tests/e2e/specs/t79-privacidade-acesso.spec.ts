import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, publicarPeloEditor, statusDoImovel, tornarContratoVigente } from "../fixtures/laboratorio";
import { ROTULO_FALTA_PRIVACIDADE } from "../../../src/lib/anuncio/prontidao";
import { LEMBRETE_SENHA_ENTRADA } from "../../../src/lib/anuncio/privacidade";

/**
 * T79 — Privacidade e acesso ao imóvel (ordem f92bc582, itens 1 a 3; cobra o Moacir em 8c269920/9a49e14c):
 *  1. sem a declaração "sem câmeras dentro" o editor não deixa publicar e diz o que falta;
 *  2. com a declaração, publica e o anúncio público mostra o bloco Privacidade e o tipo de acesso;
 *  3. fechadura com senha: o inquilino vê o lembrete de senha nova na entrada do contrato (e o dono não).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.priv79.${sufixo}@lab.vivanomads.test`, nome: "Priscila Privacidade", role: "owner" as const };
const inquilino = { email: `inq.priv79.${sufixo}@lab.vivanomads.test`, nome: "Iara Inquilina", role: "tenant" as const };
const ids: { dono?: string; inquilino?: string; semDeclaracao?: string; comSenha?: string; contrato?: string } = {};

test.describe("T79 — Privacidade e acesso ao imóvel", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inquilino = await criarConta(inquilino, senha);
    ids.semDeclaracao = await criarImovelPronto(ids.dono, `Studio sem declaração ${sufixo}`, { semDeclaracaoCameras: true });
    ids.comSenha = await criarImovelPronto(ids.dono, `Studio com senha ${sufixo}`, { semDeclaracaoCameras: true });
  });
  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.dono, ids.inquilino]);
  });

  test("1. sem a declaração: Publicar travado e a lista diz o que falta", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, dono.email, senha);
    await page.goto(`/dashboard/imoveis/${ids.semDeclaracao}/editar`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("prontidao")).toContainText("% completo", { timeout: 15_000 });
    await expect(page.getByText(ROTULO_FALTA_PRIVACIDADE).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Publicar", exact: true })).toBeDisabled();
    expect(await statusDoImovel(ids.semDeclaracao!)).toBe("draft");
    await page.context().close();
  });

  test("2. com a declaração, fechadura com senha e câmera externa: publica e o anúncio mostra o bloco Privacidade", async ({ browser, request }) => {
    test.setTimeout(120_000);
    const { error } = await adm()
      .from("properties")
      .update({ sem_cameras_interior: true, cameras_externas: "portaria do prédio", tipo_acesso: "fechadura_senha", senha_trocada_estadia: true })
      .eq("id", ids.comSenha!);
    expect(error).toBeNull();
    const page = await entrar(browser, dono.email, senha);
    await publicarPeloEditor(page, ids.comSenha!);
    await expect(page.getByTestId("prontidao")).toHaveText("Anúncio publicado", { timeout: 20_000 });
    expect(await statusDoImovel(ids.comSenha!)).toBe("active");
    await page.context().close();

    const r = await request.get(`/imoveis/${ids.comSenha}`);
    expect(r.status()).toBe(200);
    const html = await r.text();
    expect(html).toContain('data-testid="bloco-privacidade"');
    expect(html).toContain("Sem câmeras no interior (declarado pelo anunciante)");
    expect(html).toContain("Câmeras externas: portaria do prédio");
    expect(html).toContain("Acesso: Fechadura com senha");
    expect(html).toContain("A senha é trocada antes de cada nova estadia");
  });

  test("3. contrato em vigência: o inquilino vê o lembrete de senha nova; o proprietário não", async ({ browser }) => {
    test.setTimeout(120_000);
    const { data, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.comSenha,
        tenant_id: ids.inquilino,
        owner_plan: "essential",
        faixa: "temporada",
        prazo_total_dias: 60,
        aluguel_mensal: 3200,
        tamanho_bloco_meses: 2,
        comissao_percent: 0.08,
        comissao_valor: 256,
        qtd_ocupantes: 1,
        status: "ativo",
        garantia: "caucao",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    ids.contrato = data!.id as string;
    await tornarContratoVigente(ids.contrato, ids.dono!);

    const inq = await entrar(browser, inquilino.email, senha);
    await inq.goto(`/dashboard/locacoes/${ids.contrato}`, { waitUntil: "networkidle" });
    await expect(inq.getByTestId("lembrete-senha-entrada")).toContainText(LEMBRETE_SENHA_ENTRADA, { timeout: 15_000 });
    await inq.context().close();

    const prop = await entrar(browser, dono.email, senha);
    await prop.goto(`/dashboard/contratos/${ids.contrato}`, { waitUntil: "networkidle" });
    await expect(prop.getByTestId("contrato-resumo")).toBeVisible();
    await expect(prop.getByTestId("lembrete-senha-entrada")).toHaveCount(0);
    await expect(prop.getByTestId("checklist-cameras")).toHaveCount(0); // item 5: o checklist é só do inquilino
    await prop.context().close();
  });

  test("4. acesso por chave: sem lembrete de senha", async ({ browser }) => {
    test.setTimeout(90_000);
    await adm().from("properties").update({ tipo_acesso: "chave", senha_trocada_estadia: false }).eq("id", ids.comSenha!);
    const inq = await entrar(browser, inquilino.email, senha);
    await inq.goto(`/dashboard/locacoes/${ids.contrato}`, { waitUntil: "networkidle" });
    await expect(inq.getByTestId("contrato-resumo")).toBeVisible({ timeout: 15_000 });
    await expect(inq.getByTestId("lembrete-senha-entrada")).toHaveCount(0);
    await inq.context().close();
  });
});
