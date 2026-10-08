import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { PLANOS } from "../../../src/config/planos";
import {
  NO_LABORATORIO,
  adm,
  apagarContas,
  criarConta,
  cpfAleatorio,
  criarImovelPronto,
  definirPlano,
  entrar,
  fotosReais,
  novaSenha,
  novoSufixo,
  pdf,
  publicarPeloEditor,
  statusDoImovel,
} from "../fixtures/laboratorio";

/**
 * T36 — CADASTRO COMPLETO DE PONTA A PONTA (laboratório). Contas NOVAS.
 * Dono pessoa física (plano Essencial) e inquilina, sem tocar nas personas:
 *  1. CPF do dono pela tela Conta → Documento (válido, mascarado).
 *  2. Imóvel (8 fotos geradas aqui) com o documento do imóvel NA FILA: o dono
 *     não consegue publicar (documento em análise).
 *  3. Admin: pré-conferência "Parece OK" → checklist → Aprovar.
 *  4. Dono publica pelo editor.
 *  5. Inquilina se candidata; o dono vê só o primeiro nome (identidade oculta).
 *  6. Dono aceita: nome completo aparece, comissão do Essencial (8%) congelada
 *     no aceite — continua 8% depois de o dono subir para o Profissional.
 *  7. Inquilina envia os documentos (identidade e vínculo) depois do aceite.
 *  8. Fechamento: documentos completos, sem aviso pendente; contrato (ZapSign
 *     simulado) gerado uma vez só — a segunda tentativa é recusada.
 * Limite desta versão: o contrato é gerado pela rota /api/contrato (a mesma que
 * a tela chama); o passo a passo visual do Fechamento tem seus próprios testes.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const CPF_NUM = cpfAleatorio(); // válido e único: o T31 e o T33 usam outros números
const CPF_DONO = `${CPF_NUM.slice(0, 3)}.${CPF_NUM.slice(3, 6)}.${CPF_NUM.slice(6, 9)}-${CPF_NUM.slice(9)}`;
const CPF_MASCARADO = `***.${CPF_NUM.slice(3, 6)}.${CPF_NUM.slice(6, 9)}-**`;
const dono = { email: `dono.ponta.${sufixo}@lab.vivanomads.test`, nome: "Pedro Ponta a Ponta", role: "owner" as const };
const inquilina = { email: `inq.ponta.${sufixo}@lab.vivanomads.test`, nome: "Iara Sobrenomeoculto", role: "tenant" as const };
const titulo = `Studio ponta a ponta ${sufixo}`;
const ids: { dono?: string; inquilina?: string; imovel?: string; lead?: string } = {};

test.describe("T36 — Cadastro completo, do CPF ao fechamento", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha, false);
    ids.inquilina = await criarConta(inquilina, senha, true);
    await definirPlano(ids.dono, "essential");
    ids.imovel = await criarImovelPronto(ids.dono, titulo, { documentoPendente: dono.nome });
  });

  test.afterAll(async () => {
    const { data } = await adm().from("documentos_inquilino").select("caminho").eq("lead_id", ids.lead ?? "");
    if (data?.length) await adm().storage.from("inquilino-docs").remove(data.map((d) => d.caminho as string));
    if (ids.lead) await adm().from("cobrancas_fechamento").delete().eq("lead_id", ids.lead);
    await apagarContas([ids.dono, ids.inquilina]);
  });

  test("1 a 4: CPF, documento do imóvel em análise, aprovação do admin e publicação", async ({ browser }) => {
    test.setTimeout(180_000);

    // 1) CPF do dono pela tela (mascarado depois de salvo).
    const donoPage = await entrar(browser, dono.email, senha);
    await donoPage.goto("/dashboard/conta#documento", { waitUntil: "networkidle" });
    const secao = donoPage.locator("#documento");
    await secao.getByLabel("CPF").fill(CPF_DONO);
    await secao.getByRole("button", { name: "Salvar documento" }).click();
    await expect(donoPage.getByTestId("documento-cadastrado")).toBeVisible({ timeout: 15_000 });
    await expect(donoPage.getByTestId("documento-cadastrado").getByLabel("CPF")).toHaveValue(CPF_MASCARADO);

    // 2) Documento do imóvel em análise: o editor não deixa publicar.
    await donoPage.goto(`/dashboard/imoveis/${ids.imovel}/editar`, { waitUntil: "networkidle" });
    await expect(donoPage.getByText(/Documento do imóvel aprovado \(em análise pela equipe/).first()).toBeVisible({ timeout: 15_000 });
    await expect(donoPage.getByRole("button", { name: "Publicar", exact: true })).toBeDisabled();
    expect(await statusDoImovel(ids.imovel!)).toBe("draft");
    await donoPage.screenshot({ path: "tests/laboratorio/saida/t36-1-documento-em-analise.png", fullPage: true });

    // 3) Admin: pré-conferência, checklist, aprovar.
    const ctxAdmin = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 390, height: 844 } });
    const admin = await ctxAdmin.newPage();
    await admin.goto("/admin/documentos", { waitUntil: "networkidle" });
    const card = admin.locator(`[data-testid="doc-card"][data-imovel="${titulo}"]`);
    await expect(card.getByTestId("pre-conferencia-veredito")).toHaveText("Parece OK", { timeout: 15_000 });
    const caixas = card.getByRole("checkbox");
    for (let i = 0; i < (await caixas.count()); i++) await caixas.nth(i).check();
    await card.getByRole("button", { name: /Aprovar/ }).click();
    await expect.poll(async () => (await adm().from("qualification_checklists").select("document_status").eq("property_id", ids.imovel!).single()).data?.document_status, { timeout: 20_000 }).toBe("approved");
    await ctxAdmin.close();

    // 4) Dono publica (documento aprovado + CPF).
    await publicarPeloEditor(donoPage, ids.imovel!);
    await expect(donoPage.getByTestId("prontidao")).toHaveText("Anúncio publicado", { timeout: 20_000 });
    expect(await statusDoImovel(ids.imovel!)).toBe("active");
    await fotosReais(ids.imovel!, ids.dono!); // a página pública carrega as imagens geradas
    await donoPage.screenshot({ path: "tests/laboratorio/saida/t36-2-publicado.png", fullPage: true });
    await donoPage.context().close();
  });

  test("5 e 6: candidatura (identidade oculta), aceite e comissão do Essencial congelada", async ({ browser }) => {
    test.setTimeout(150_000);

    // 5) Inquilina se candidata pela página pública do imóvel.
    const inq = await entrar(browser, inquilina.email, senha);
    await inq.goto(`/imoveis/${ids.imovel}`, { waitUntil: "networkidle" });
    await inq.getByRole("button", { name: /Candidatar-se/ }).click();
    await expect(inq.getByText("Candidatura enviada")).toBeVisible({ timeout: 20_000 });
    await inq.screenshot({ path: "tests/laboratorio/saida/t36-3-candidatura-enviada.png", fullPage: true });
    await inq.context().close();
    const { data: lead } = await adm().from("leads").select("id, status").eq("property_id", ids.imovel!).eq("tenant_id", ids.inquilina!).single();
    ids.lead = lead!.id as string;
    expect(lead!.status).toBe("new");

    // O dono vê só o primeiro nome (e nenhum contato) enquanto não aceita.
    const donoPage = await entrar(browser, dono.email, senha);
    await donoPage.goto("/dashboard/leads", { waitUntil: "networkidle" });
    const antes = await donoPage.locator("body").innerText();
    expect(antes).toContain("Iara");
    expect(antes).not.toContain("Sobrenomeoculto");
    expect(antes).not.toContain(inquilina.email);
    await donoPage.screenshot({ path: "tests/laboratorio/saida/t36-4-dono-ve-primeiro-nome.png", fullPage: true });

    // 6) Aceite: nome completo aparece; comissão do plano (Essencial) fica congelada.
    await donoPage.getByRole("button", { name: /Aprovar e responder/i }).first().click();
    await expect.poll(async () => (await adm().from("leads").select("status").eq("id", ids.lead!).single()).data?.status, { timeout: 20_000 }).toBe("accepted");
    await expect(donoPage.getByTestId("aceite-erro")).toHaveCount(0);
    const essencial = PLANOS.find((p) => p.id === "essential")!;
    const aceito = (await adm().from("leads").select("accepted_commission_rate, accepted_plan").eq("id", ids.lead!).single()).data!;
    expect(Number(aceito.accepted_commission_rate)).toBe(essencial.comissao);
    expect(aceito.accepted_plan).toBe("essential");
    await donoPage.reload({ waitUntil: "networkidle" });
    expect(await donoPage.locator("body").innerText()).toContain(inquilina.nome);
    expect(await donoPage.content()).not.toContain(inquilina.email);

    // Subir de plano depois do aceite NÃO muda a comissão deste contrato.
    await definirPlano(ids.dono!, "pro");
    const depois = (await adm().from("leads").select("accepted_commission_rate, accepted_plan").eq("id", ids.lead!).single()).data!;
    expect(Number(depois.accepted_commission_rate)).toBe(essencial.comissao);
    expect(depois.accepted_plan).toBe("essential");
    await donoPage.context().close();
  });

  test("7 e 8: documentos do inquilino, fechamento e contrato gerado uma vez", async ({ browser }) => {
    test.setTimeout(150_000);

    // 7) Inquilina envia identidade (pela tela) e vínculo (pela rota).
    const inq = await entrar(browser, inquilina.email, senha);
    await inq.goto("/dashboard/candidaturas", { waitUntil: "networkidle" });
    const bloco = inq.getByTestId("docs-inquilino");
    await bloco.getByLabel("Enviar documento de identidade").setInputFiles({ name: "rg.pdf", mimeType: "application/pdf", buffer: pdf() });
    await expect(inq.getByTestId("doc-inquilino-identidade")).toContainText("enviado", { timeout: 20_000 });
    const res = await inq.request.post("/api/upload/inquilino-doc", {
      multipart: { leadId: ids.lead!, tipo: "vinculo", file: { name: "vinculo.pdf", mimeType: "application/pdf", buffer: pdf() } },
    });
    expect(res.status()).toBe(200);
    await inq.screenshot({ path: "tests/laboratorio/saida/t36-5-inquilino-documentos.png", fullPage: true });
    await inq.context().close();

    // 8) Fechamento do dono: documentos completos, nenhum aviso pendente.
    const donoPage = await entrar(browser, dono.email, senha);
    await donoPage.goto(`/dashboard/fechamento?c=${ids.lead}`, { waitUntil: "networkidle" });
    await expect(donoPage.getByTestId("docs-inquilino-completos")).toBeVisible({ timeout: 15_000 });
    await expect(donoPage.getByTestId("documento-pendente")).toHaveCount(0);
    await donoPage.screenshot({ path: "tests/laboratorio/saida/t36-6-fechamento.png", fullPage: true });

    // Contrato (ZapSign simulado): sai uma vez; a segunda tentativa é recusada.
    const corpo = { leadId: ids.lead, termMonths: 2, guarantee: "Caução", costSplit: {} };
    const primeira = await donoPage.request.post("/api/contrato", { data: corpo });
    expect(primeira.status()).toBe(200);
    const segunda = await donoPage.request.post("/api/contrato", { data: corpo });
    expect(segunda.status()).toBe(409);
    const { data: reservas } = await adm().from("cobrancas_fechamento").select("tipo").eq("lead_id", ids.lead!);
    expect((reservas ?? []).filter((r) => r.tipo === "contrato")).toHaveLength(1);
    await donoPage.context().close();
  });
});
