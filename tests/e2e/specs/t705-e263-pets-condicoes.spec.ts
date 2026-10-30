import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T705 — E263-A (decisão do coordenador, 30/10): "Aceita pets" abre as condições do dono.
   1. Passo 6 (1280 e 390): desligado, nenhuma condição; ligado, abre porte máximo, quantidade (1, 2, 3 ou mais), taxa
      mensal de pet e observação (até 140) — tudo opcional; o rascunho guarda o que foi preenchido.
   2. Editor + página pública (1280 e 390): as condições salvas (validadas no servidor) aparecem numa linha só
      ("Aceita pets · porte até médio · até 2 animais · Taxa pet R$ 80,00/mês · …"); desligar apaga as condições.
   3. Proposta: a taxa mensal do anúncio pré-preenche a taxa pet SÓ para quem tem pet no perfil.
   4. Compatibilidade neutra (não bloqueia): dentro, "confira com o dono", e nenhuma linha sem porte e quantidade.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t705.${sufixo}@lab.vivanomads.test`, nome: "Pet Dona", role: "owner" as const };
const comPet = { email: `inq.pet.t705.${sufixo}@lab.vivanomads.test`, nome: "Lia Compet", role: "tenant" as const };
const semPet = { email: `inq.sem.t705.${sufixo}@lab.vivanomads.test`, nome: "Rui Sempet", role: "tenant" as const };
const ids: { dono?: string; comPet?: string; semPet?: string; rascunho?: Record<number, string>; ativo?: Record<number, string>; prop?: string; semPorte?: string } = { rascunho: {}, ativo: {} };
const LARGURAS = [1280, 390] as const;

test.describe("T705 — E263-A: condições de pets do dono", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.comPet = await criarConta(comPet, senha);
    ids.semPet = await criarConta(semPet, senha);
    const { error } = await adm().from("pets_inquilino").insert({ user_id: ids.comPet, nome: "Mimi", especie: "gato", porte: "P", idade_anos: 2, castrado: true, vacinas_em_dia: true });
    expect(error).toBeNull();
    for (const l of LARGURAS) {
      ids.rascunho![l] = await prepararRascunho(ids.dono, `Studio pets ${l} ${sufixo}`);
      ids.ativo![l] = await criarImovelPronto(ids.dono, `Studio pets ativo ${l} ${sufixo}`, { ativo: true });
      await adm().from("properties").update({ pets_allowed: true, pets_regras: null }).eq("id", ids.ativo![l]);
    }
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono!, ids.comPet!, ids.semPet!]);
  });

  for (const largura of LARGURAS) {
    test(`1. ${largura} px: Passo 6 — desligado sem condições; ligado abre as condições (opcionais) e o rascunho guarda`, async ({ browser }) => {
      const p = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho![largura], "regras", largura);
      const toggle = p.getByRole("button", { name: /^Aceita pets/ });
      if ((await toggle.getAttribute("aria-pressed")) === "true") await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "false");
      await expect(p.getByTestId("pets-regras")).toHaveCount(0);
      await toggle.click();
      const bloco = p.getByTestId("pets-regras");
      await expect(bloco).toBeVisible();
      // Tudo opcional: chega sem porte e sem quantidade.
      await expect(bloco.getByTestId("pets-porte")).toHaveValue("");
      await expect(bloco.getByTestId("pets-qtd")).toHaveValue("");
      await expect(bloco.getByTestId("pets-qtd").locator("option")).toHaveText(["Sem limite", "1", "2", "3 ou mais"]);
      await bloco.getByTestId("pets-porte").selectOption("M");
      await bloco.getByTestId("pets-qtd").selectOption("2");
      await bloco.getByTestId("pets-taxa-mensal").fill("80");
      await bloco.getByTestId("pets-observacao").fill("x".repeat(150));
      await expect(bloco.getByTestId("pets-observacao")).toHaveValue("x".repeat(140));
      await bloco.getByTestId("pets-observacao").fill("Gatos castrados.");
      await expect(bloco.getByTestId("pets-observacao-conta")).toHaveText("16/140");
      await bloco.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t705-passo6-${largura}.png` });
      // O rascunho guarda (salva sozinho): ao reabrir, as condições voltam.
      await expect.poll(async () => {
        const { data } = await adm().from("properties").select("draft_data").eq("id", ids.rascunho![largura]).single();
        return (data?.draft_data as { petsRegras?: { observacao?: string } } | null)?.petsRegras?.observacao;
      }, { timeout: 20_000 }).toBe("Gatos castrados.");
      await p.reload({ waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("pets-regras").getByTestId("pets-porte")).toHaveValue("M", { timeout: 30_000 });
      await expect(p.getByTestId("pets-regras").getByTestId("pets-observacao")).toHaveValue("Gatos castrados.");
      await p.context().close();
    });
  }

  for (const largura of LARGURAS) {
    test(`2. ${largura} px: editor salva as condições (servidor valida) e a página pública mostra numa linha só`, async ({ browser }) => {
      const id = ids.ativo![largura];
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto(`/dashboard/imoveis/${id}/editar`, { waitUntil: "domcontentloaded" });
      const secao = p.getByTestId("secao-regras");
      await secao.getByRole("button", { name: /Regras da casa/ }).click();
      const bloco = secao.getByTestId("pets-regras");
      await expect(bloco).toBeVisible({ timeout: 20_000 });
      await bloco.getByTestId("pets-porte").selectOption("M");
      await bloco.getByTestId("pets-qtd").selectOption("2");
      await bloco.getByTestId("pets-taxa-mensal").fill("80");
      await bloco.getByTestId("pets-observacao").fill("Gatos castrados.");
      await secao.getByRole("button", { name: "Salvar seção" }).click();
      await expect(secao.getByText("Alterações salvas.")).toBeVisible({ timeout: 20_000 });
      await expect
        .poll(async () => (await adm().from("properties").select("pets_regras").eq("id", id).single()).data?.pets_regras as Record<string, unknown> | null, { timeout: 20_000 })
        .toMatchObject({ porteMax: "M", qtdMax: 2, taxaMensal: 80, observacao: "Gatos castrados." });

      await p.goto(`/imoveis/${id}`, { waitUntil: "domcontentloaded" });
      const linha = p.getByText("Aceita pets · porte até médio · até 2 animais · Taxa pet R$ 80,00/mês · Gatos castrados.").first();
      await expect(linha).toBeVisible({ timeout: 20_000 });
      await linha.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t705-publica-${largura}.png` });

      if (largura === 1280) {
        // Desligar "Aceita pets" apaga as condições.
        await p.goto(`/dashboard/imoveis/${id}/editar`, { waitUntil: "domcontentloaded" });
        const s2 = p.getByTestId("secao-regras");
        await s2.getByRole("button", { name: /Regras da casa/ }).click();
        await s2.getByText("Aceita animais de estimação?").locator("..").locator("..").getByRole("button", { name: "Não" }).click();
        await expect(s2.getByTestId("pets-regras")).toHaveCount(0);
        await s2.getByRole("button", { name: "Salvar seção" }).click();
        await expect(s2.getByText("Alterações salvas.")).toBeVisible({ timeout: 20_000 });
        await expect.poll(async () => (await adm().from("properties").select("pets_allowed, pets_regras").eq("id", id).single()).data, { timeout: 20_000 }).toEqual({ pets_allowed: false, pets_regras: null });
      }
      await p.context().close();
    });
  }

  test("3. proposta: a taxa mensal de pet entra só para quem tem pet no perfil", async ({ browser }) => {
    ids.prop = await criarImovelPronto(ids.dono!, `Studio proposta pet ${sufixo}`, { ativo: true });
    await adm().from("properties").update({ pets_allowed: true, pets_regras: { especies: ["cao", "gato"], porteMax: "M", qtdMax: 2, taxaMensal: 80 } }).eq("id", ids.prop);
    const leadCom = await criarLead(ids.dono!, ids.comPet!, ids.prop, true);
    const leadSem = await criarLead(ids.dono!, ids.semPet!, ids.prop, true);
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto(`/dashboard/orcamentos/nova?interessado=${leadCom}`, { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("proposta-taxa-pet")).toHaveValue(/^80(,00)?$/, { timeout: 30_000 });
    await p.goto(`/dashboard/orcamentos/nova?interessado=${leadSem}`, { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("montagem-proposta")).toBeVisible({ timeout: 30_000 });
    await expect(p.getByTestId("proposta-taxa-pet")).toHaveValue("");
    await p.context().close();
  });

  test("4. compatibilidade neutra: dentro, 'confira com o dono' e nenhuma linha sem porte e quantidade", async ({ browser }) => {
    ids.semPorte = await criarImovelPronto(ids.dono!, `Studio sem porte ${sufixo}`, { ativo: true });
    await adm().from("properties").update({ pets_allowed: true, pets_regras: { especies: ["cao", "gato"], taxaMensal: 50 } }).eq("id", ids.semPorte);
    const p = await entrar(browser, comPet.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    // Dentro: gato pequeno, porte até médio, até 2.
    await p.goto(`/imoveis/${ids.prop}`, { waitUntil: "networkidle" });
    const dentro = p.getByTestId("pet-candidatura").first().getByTestId("pet-compatibilidade");
    await expect(dentro).toHaveAttribute("data-dentro", "1", { timeout: 20_000 });
    await expect(dentro).toHaveText("Seus pets estão dentro das condições do dono.");
    // Fora (só cão): "confira com o dono", sem bloquear o pedido.
    const fora = await criarImovelPronto(ids.dono!, `Studio só cão ${sufixo}`, { ativo: true });
    await adm().from("properties").update({ pets_allowed: true, pets_regras: { especies: ["cao"], porteMax: "M", qtdMax: 1 } }).eq("id", fora);
    await p.goto(`/imoveis/${fora}`, { waitUntil: "networkidle" });
    const linhaFora = p.getByTestId("pet-candidatura").first().getByTestId("pet-compatibilidade");
    await expect(linhaFora).toHaveAttribute("data-dentro", "0", { timeout: 20_000 });
    await expect(linhaFora).toContainText("Confira com o dono:");
    await expect(p.getByTestId("pet-candidatura").first()).not.toHaveClass(/amber/);
    // Sem porte e quantidade do dono: nenhuma linha de compatibilidade.
    await p.goto(`/imoveis/${ids.semPorte}`, { waitUntil: "networkidle" });
    await expect(p.getByTestId("pet-candidatura").first()).toBeVisible({ timeout: 20_000 });
    await expect(p.getByTestId("pet-compatibilidade")).toHaveCount(0);
    await p.context().close();
  });
});
