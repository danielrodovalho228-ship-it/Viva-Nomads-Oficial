import { test, expect, type Locator, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T709 — E263-A (PR #1598), a ida e volta das condições de pets que a t705 não percorre. Só no laboratório.
   1. Editor → banco → editor → página pública (1280 e 390): o que o dono marca no editor (espécie, porte, quantidade,
      valor pet, taxa mensal, regra do condomínio, observação) volta igual ao reabrir o editor e aparece na MESMA linha
      nas "Regras da estadia" e no "Bom saber" da página pública. Sem espécie marcada vale "qualquer animal" (a espécie
      some da linha e, ao reabrir, as três voltam marcadas); "3 ou mais animais".
   2. Validação no SERVIDOR (1280): sem o limite da tela, uma observação de 141 caracteres é recusada pelo
      updateProperty com a mensagem em português e o banco não muda; com 140, salva.
   3. Desligar (390): "Aceita pets" desligado grava pets_regras nulo, a página pública diz "Não aceita animais" e
      "Sem pets"; religado depois, as condições antigas não voltam (campos vazios, as três espécies marcadas).
   4. Proposta (1280): a taxa mensal salva NO EDITOR pré-preenche a taxa pet da proposta de quem tem pet; com o anúncio
      sem pets (mesmo com condições antigas no banco), a proposta abre sem taxa pet.
   5. Candidatura (1280 e 390): as condições salvas no editor chegam ao aviso do morador — "Confira com o dono" com os
      motivos (quantidade e espécie) para quem não cabe, "dentro das condições" para quem cabe, e o valor pet à parte.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t709.${sufixo}@lab.vivanomads.test`, nome: "Paula Petdona", role: "owner" as const };
const doisPets = { email: `inq.dois.t709.${sufixo}@lab.vivanomads.test`, nome: "Lia Doispets", role: "tenant" as const };
const umPet = { email: `inq.um.t709.${sufixo}@lab.vivanomads.test`, nome: "Rui Umpet", role: "tenant" as const };
const ids: { dono?: string; doisPets?: string; umPet?: string; imovel: Record<number, string>; proposta?: string } = { imovel: {} };
const LARGURAS = [1280, 390] as const;

const OBS_1280 = "Cão de coleira nas áreas comuns.";
const COND_1280 = "Só pelo elevador de serviço";
/** O que cada largura grava no editor e a linha pública esperada (linhaPetsPublica). */
const CENARIO = {
  1280: {
    linha: `Aceita pets · cão · porte até pequeno · até 1 animal · Caução pet R$ 300,00 — devolvida no fim · Condomínio: ${COND_1280} · ${OBS_1280}`,
    banco: { especies: ["cao"], porteMax: "P", qtdMax: 1, valorPet: 300, valorPetTipo: "reembolsavel", regrasCondominio: COND_1280, observacao: OBS_1280 },
  },
  390: {
    linha: "Aceita pets · 3 ou mais animais · Taxa pet R$ 95,00/mês · Gatos castrados.",
    banco: { especies: ["cao", "gato", "outro"], qtdMax: 3, taxaMensal: 95, observacao: "Gatos castrados." },
  },
} as const;

async function pets(id: string) {
  return (await adm().from("properties").select("pets_allowed, pets_regras").eq("id", id).single()).data as { pets_allowed: boolean | null; pets_regras: Record<string, unknown> | null } | null;
}

/** Abre o editor na largura pedida, com a seção "Regras da casa" aberta. */
async function abrirRegras(p: Page, id: string, largura: number) {
  await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await p.goto(`/dashboard/imoveis/${id}/editar`, { waitUntil: "domcontentloaded" });
  const secao = p.getByTestId("secao-regras");
  await expect(secao).toBeVisible({ timeout: 30_000 });
  if ((await secao.getAttribute("data-aberta")) !== "true") await secao.getByRole("button", { name: /Regras da casa/ }).click();
  await expect(secao).toHaveAttribute("data-aberta", "true");
  return secao;
}

const especie = (bloco: Locator, nome: "cão" | "gato" | "outro animal") => bloco.getByRole("checkbox", { name: nome, exact: true });
const cartaoPets = (secao: Locator) => secao.getByText("Aceita animais de estimação?").locator("..").locator("..");

async function salvar(p: Page, secao: Locator) {
  await secao.getByRole("button", { name: "Salvar seção" }).click();
  await expect(secao.getByText("Alterações salvas.")).toBeVisible({ timeout: 20_000 });
}

/** A linha "Animais" das Regras da estadia e o item de pets do "Bom saber" (folha). */
async function conferirPublica(p: Page, id: string, linha: string, itemBomSaber: string, print: string) {
  await p.goto(`/imoveis/${id}`, { waitUntil: "domcontentloaded" });
  const animais = p.locator("#regras-da-estadia li").filter({ hasText: /^Animais/ });
  await expect(animais).toHaveCount(1, { timeout: 20_000 });
  await expect(animais).toContainText(linha);
  await animais.scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${SAIDA}/${print}` });
  await p.getByTestId("bom-saber-regras").click();
  await expect(p.getByTestId("regra-casa-pets")).toHaveText(itemBomSaber, { timeout: 10_000 });
  await p.keyboard.press("Escape");
}

test.describe("T709 — E263-A: condições de pets, ida e volta (editor, página, proposta e candidatura)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    ids.doisPets = await criarConta(doisPets, senha);
    ids.umPet = await criarConta(umPet, senha);
    const { error } = await adm()
      .from("pets_inquilino")
      .insert([
        { user_id: ids.doisPets, nome: "Mimi", especie: "gato", porte: "P", idade_anos: 2, castrado: true, vacinas_em_dia: true },
        { user_id: ids.doisPets, nome: "Bob", especie: "cao", porte: "P", idade_anos: 4, castrado: true, vacinas_em_dia: true },
        { user_id: ids.umPet, nome: "Tico", especie: "cao", porte: "P", idade_anos: 1, castrado: false, vacinas_em_dia: true },
      ]);
    expect(error).toBeNull();
    // Estado no banco ANTES da 1ª visita (a página pública guarda cache por 60 s): aceita pets, sem condições.
    for (const l of LARGURAS) {
      ids.imovel[l] = await criarImovelPronto(ids.dono, `Studio ida e volta ${l} ${sufixo}`, { ativo: true });
      await adm().from("properties").update({ pets_allowed: true, pets_regras: null }).eq("id", ids.imovel[l]);
    }
    ids.proposta = await criarImovelPronto(ids.dono, `Studio taxa pet ${sufixo}`, { ativo: true });
    await adm().from("properties").update({ pets_allowed: true, pets_regras: null }).eq("id", ids.proposta);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono, ids.doisPets, ids.umPet]);
  });

  for (const largura of LARGURAS) {
    test(`1. ${largura} px: editor → banco → editor de novo → página pública (Regras da estadia e Bom saber)`, async ({ browser }) => {
      const id = ids.imovel[largura];
      const p = await entrar(browser, dono.email, senha);
      const secao = await abrirRegras(p, id, largura);
      const bloco = secao.getByTestId("pets-regras");
      await expect(bloco).toBeVisible({ timeout: 20_000 });
      // Sem condições gravadas: as três espécies chegam marcadas, o resto vazio.
      for (const e of ["cão", "gato", "outro animal"] as const) await expect(especie(bloco, e)).toBeChecked();
      if (largura === 1280) {
        await especie(bloco, "gato").uncheck();
        await especie(bloco, "outro animal").uncheck();
        await bloco.getByTestId("pets-porte").selectOption("P");
        await bloco.getByTestId("pets-qtd").selectOption("1");
        await bloco.getByTestId("valor-pet").fill("300");
        await bloco.getByTestId("valor-pet-tipo").selectOption("reembolsavel");
        await bloco.getByLabel("Regra do condomínio sobre pets (opcional)").fill(COND_1280);
        await bloco.getByTestId("pets-observacao").fill(OBS_1280);
      } else {
        // Nenhuma espécie marcada = qualquer animal (a tela avisa; não é erro).
        for (const e of ["cão", "gato", "outro animal"] as const) await especie(bloco, e).uncheck();
        await expect(bloco.getByText("Sem nenhum marcado, vale qualquer animal.")).toBeVisible();
        await bloco.getByTestId("pets-qtd").selectOption("3");
        await bloco.getByTestId("pets-taxa-mensal").fill("95");
        await bloco.getByTestId("pets-observacao").fill("Gatos castrados.");
      }
      await salvar(p, secao);
      await expect.poll(async () => (await pets(id))?.pets_regras, { timeout: 20_000 }).toMatchObject(CENARIO[largura].banco);
      const gravado = (await pets(id))!.pets_regras!;
      if (largura === 390) expect(gravado.porteMax, "sem porte informado, nada de porte no banco").toBeUndefined();

      // Volta: o editor reaberto mostra exatamente o que foi gravado.
      const s2 = await abrirRegras(p, id, largura);
      const b2 = s2.getByTestId("pets-regras");
      await expect(b2).toBeVisible({ timeout: 20_000 });
      if (largura === 1280) {
        await expect(especie(b2, "cão")).toBeChecked();
        await expect(especie(b2, "gato")).not.toBeChecked();
        await expect(especie(b2, "outro animal")).not.toBeChecked();
        await expect(b2.getByTestId("pets-porte")).toHaveValue("P");
        await expect(b2.getByTestId("pets-qtd")).toHaveValue("1");
        await expect(b2.getByTestId("valor-pet")).toHaveValue(/^300(,00)?$/);
        await expect(b2.getByTestId("valor-pet-tipo")).toHaveValue("reembolsavel");
        await expect(b2.getByLabel("Regra do condomínio sobre pets (opcional)")).toHaveValue(COND_1280);
        await expect(b2.getByTestId("pets-observacao")).toHaveValue(OBS_1280);
        await expect(b2.getByTestId("pets-taxa-mensal")).toHaveValue("");
      } else {
        // "Qualquer animal" volta como as três marcadas; porte sem limite; "3 ou mais".
        for (const e of ["cão", "gato", "outro animal"] as const) await expect(especie(b2, e)).toBeChecked();
        await expect(b2.getByTestId("pets-porte")).toHaveValue("");
        await expect(b2.getByTestId("pets-qtd")).toHaveValue("3");
        await expect(b2.getByTestId("pets-taxa-mensal")).toHaveValue(/^95(,00)?$/);
        await expect(b2.getByTestId("pets-observacao")).toHaveValue("Gatos castrados.");
        await expect(b2.getByTestId("pets-observacao-conta")).toHaveText("16/140");
      }
      await b2.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t709-editor-volta-${largura}.png` });

      // Página pública: a mesma linha nas Regras da estadia e no Bom saber.
      await conferirPublica(p, id, CENARIO[largura].linha, CENARIO[largura].linha, `t709-publica-${largura}.png`);
      const sobra = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sobra).toBeLessThanOrEqual(1);
      await p.context().close();
    });
  }

  test("2. 1280 px: o servidor recusa observação acima de 140 (sem o limite da tela) e aceita 140", async ({ browser }) => {
    const id = ids.imovel[1280];
    const antes = (await pets(id))!.pets_regras;
    const p = await entrar(browser, dono.email, senha);
    const secao = await abrirRegras(p, id, 1280);
    const obs = secao.getByTestId("pets-regras").getByTestId("pets-observacao");
    await expect(obs).toHaveValue(OBS_1280, { timeout: 20_000 });
    // Tira o maxLength do campo: o que chega ao updateProperty passa do limite.
    await obs.evaluate((el) => el.removeAttribute("maxlength"));
    await obs.fill("x".repeat(141));
    await expect(obs).toHaveValue("x".repeat(141));
    await expect(secao.getByTestId("pets-observacao-conta")).toHaveText("141/140");
    await secao.getByRole("button", { name: "Salvar seção" }).click();
    await expect(p.getByText("A observação sobre pets aceita até 140 caracteres.")).toBeVisible({ timeout: 20_000 });
    await expect(secao.getByText("Alterações salvas.")).toHaveCount(0);
    await p.screenshot({ path: `${SAIDA}/t709-servidor-recusa-1280.png` });
    expect((await pets(id))!.pets_regras, "recusado: o banco fica como estava").toEqual(antes);
    // No limite (140), salva.
    await obs.fill("y".repeat(140));
    await salvar(p, secao);
    await expect.poll(async () => ((await pets(id))?.pets_regras?.observacao as string | undefined)?.length, { timeout: 20_000 }).toBe(140);
    // O resto das condições não se perde ao corrigir.
    expect((await pets(id))!.pets_regras).toMatchObject({ especies: ["cao"], porteMax: "P", qtdMax: 1, valorPet: 300 });
    await p.context().close();
  });

  test("3. 390 px: desligar 'Aceita pets' apaga as condições na página pública; religar não traz as antigas", async ({ browser }) => {
    const id = ids.imovel[390];
    const p = await entrar(browser, dono.email, senha);
    const secao = await abrirRegras(p, id, 390);
    await expect(secao.getByTestId("pets-regras")).toBeVisible({ timeout: 20_000 });
    await cartaoPets(secao).getByRole("button", { name: "Não" }).click();
    await expect(secao.getByTestId("pets-regras")).toHaveCount(0);
    await salvar(p, secao);
    await expect.poll(async () => await pets(id), { timeout: 20_000 }).toEqual({ pets_allowed: false, pets_regras: null });

    await conferirPublica(p, id, "Não aceita animais", "Sem pets", "t709-publica-sem-pets-390.png");
    await expect(p.getByText("Gatos castrados.")).toHaveCount(0);

    // Religado num editor novo: nada das condições antigas.
    const s2 = await abrirRegras(p, id, 390);
    await cartaoPets(s2).getByRole("button", { name: "Sim" }).click();
    const b2 = s2.getByTestId("pets-regras");
    await expect(b2).toBeVisible();
    for (const e of ["cão", "gato", "outro animal"] as const) await expect(especie(b2, e)).toBeChecked();
    await expect(b2.getByTestId("pets-porte")).toHaveValue("");
    await expect(b2.getByTestId("pets-qtd")).toHaveValue("");
    await expect(b2.getByTestId("pets-taxa-mensal")).toHaveValue("");
    await expect(b2.getByTestId("pets-observacao")).toHaveValue("");
    await expect(b2.getByTestId("pets-observacao-conta")).toHaveText("0/140");
    await b2.scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${SAIDA}/t709-religado-390.png` });
    await p.context().close();
  });

  test("4. 1280 px: taxa mensal salva no editor entra na proposta de quem tem pet; anúncio sem pets, proposta sem taxa", async ({ browser }) => {
    const id = ids.proposta!;
    const p = await entrar(browser, dono.email, senha);
    const secao = await abrirRegras(p, id, 1280);
    const bloco = secao.getByTestId("pets-regras");
    await expect(bloco).toBeVisible({ timeout: 20_000 });
    await bloco.getByTestId("pets-taxa-mensal").fill("120");
    await salvar(p, secao);
    await expect.poll(async () => (await pets(id))?.pets_regras, { timeout: 20_000 }).toMatchObject({ taxaMensal: 120 });

    const leadComPet = await criarLead(ids.dono!, ids.doisPets!, id, true);
    await p.goto(`/dashboard/orcamentos/nova?interessado=${leadComPet}`, { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("proposta-taxa-pet")).toHaveValue(/^120(,00)?$/, { timeout: 30_000 });
    await p.getByTestId("proposta-taxa-pet").scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${SAIDA}/t709-proposta-taxa-1280.png` });

    // Anúncio deixa de aceitar pets, mas a coluna antiga (com taxa) fica: o servidor não usa a taxa.
    await adm().from("properties").update({ pets_allowed: false }).eq("id", id);
    expect((await pets(id))!.pets_regras).toMatchObject({ taxaMensal: 120 });
    const leadSemAceite = await criarLead(ids.dono!, ids.umPet!, id, true);
    await p.goto(`/dashboard/orcamentos/nova?interessado=${leadSemAceite}`, { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("montagem-proposta")).toBeVisible({ timeout: 30_000 });
    await expect(p.getByTestId("proposta-taxa-pet")).toHaveValue("");
    await p.context().close();
  });

  for (const largura of LARGURAS) {
    test(`5. ${largura} px: as condições do editor chegam à candidatura — fora ("Confira com o dono") e dentro`, async ({ browser }) => {
      const id = ids.imovel[1280]; // cão, porte pequeno, até 1 animal, Caução pet R$ 300 — gravado pelo editor (1 e 2)
      const fora = await entrar(browser, doisPets.email, senha);
      await fora.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await fora.goto(`/imoveis/${id}`, { waitUntil: "domcontentloaded" });
      const aviso = fora.getByTestId("pet-candidatura").first();
      const compat = aviso.getByTestId("pet-compatibilidade");
      await expect(compat).toHaveAttribute("data-dentro", "0", { timeout: 20_000 });
      await expect(compat).toContainText("Confira com o dono:");
      await expect(compat).toContainText("O imóvel aceita até 1 animal; você informou 2.");
      await expect(compat).toContainText("O imóvel não aceita gato.");
      await expect(aviso).toContainText("Seus pets vão na candidatura");
      await expect(aviso.getByTestId("pet-candidatura-valor")).toHaveText("Valor pet: Caução pet R$ 300,00 — devolvida no fim");
      if (await aviso.isVisible()) {
        await aviso.scrollIntoViewIfNeeded();
        await fora.screenshot({ path: `${SAIDA}/t709-candidatura-fora-${largura}.png` });
      }
      await fora.context().close();

      const dentro = await entrar(browser, umPet.email, senha);
      await dentro.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await dentro.goto(`/imoveis/${id}`, { waitUntil: "domcontentloaded" });
      const linha = dentro.getByTestId("pet-candidatura").first().getByTestId("pet-compatibilidade");
      await expect(linha).toHaveAttribute("data-dentro", "1", { timeout: 20_000 });
      await expect(linha).toHaveText("Seus pets estão dentro das condições do dono.");
      await dentro.context().close();
    });
  }
});
