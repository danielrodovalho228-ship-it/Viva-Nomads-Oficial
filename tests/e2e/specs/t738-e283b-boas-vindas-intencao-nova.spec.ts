import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { FOTO_TESTE, abrirCadastroNovo, noPasso } from "../fixtures/cadastro";

/*
  T738 — E283-B (relay nº 20): o boas-vindas de dono sai quando a conta REGISTRA uma intenção que estava vazia (o 1º
  rascunho registra "anunciar"), mesmo com papel gravado pelo uso. Uma vez por conta (chave boas_vindas:<conta>).
    A. conta zerada (sem papel, sem intenção): só navegar pelo painel (guarda de área → setPreferredMode) não manda
       nada; o 1º rascunho manda UM boas-vindas de dono; o 2º rascunho, nenhum.
    C. conta com papel_ativo 'morador' gravado pelo uso e sem boas-vindas (o caso da Ana, inquilino2): o 1º rascunho
       manda UM boas-vindas de dono.
    D. conta que já recebeu o boas-vindas de morador (chave gravada): o 1º rascunho registra "anunciar", nenhum e-mail.
  Contas do laboratório marcadas como de teste: o e-mail cai em emails_teste.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: string[] = [];
const ASSUNTO_DONO = "Boas-vindas: como anunciar o seu imóvel · Viva Nomads";

async function conta(quem: string, nome: string, perfil: Record<string, unknown>) {
  const email = `${quem}.t738.${sufixo}@lab.vivanomads.test`;
  const id = await criarConta({ email, nome, role: "tenant" }, senha);
  ids.push(id);
  const { error } = await adm().from("profiles").update({ is_teste: true, intencao: null, papel_ativo: null, preferred_mode: null, ...perfil }).eq("id", id);
  if (error) throw error;
  return { id, email };
}
const perfil = async (id: string) =>
  (await adm().from("profiles").select("intencao, papel_ativo, preferred_mode").eq("id", id).single()).data as { intencao: string[] | null; papel_ativo: string | null; preferred_mode: string | null };
const rascunhos = async (id: string) => (await adm().from("properties").select("id").eq("owner_id", id).eq("status", "draft")).data ?? [];
const boasVindas = async (id: string) => ((await adm().from("emails_teste").select("assunto").eq("usuario_id", id).eq("evento", "boas_vindas")).data ?? []) as { assunto: string }[];
const chave = async (id: string) => ((await adm().from("automacoes_envios").select("chave").eq("usuario_id", id).eq("tipo", "boas_vindas")).data ?? []) as { chave: string }[];

/** "Anunciar" → Passo 1 → Passo 2 com UMA foto: o autosave cria o rascunho (saveDraftData sem id). */
async function rascunhoPelaTela(page: Page, donoId: string, antes: number) {
  await abrirCadastroNovo(page);
  await page.getByTestId("cadastro-continuar").click();
  await noPasso(page, "fotos");
  await page.getByTestId("etapa-fotos").locator('input[type="file"]').first().setInputFiles([FOTO_TESTE]);
  await expect.poll(async () => (await rascunhos(donoId)).length, { timeout: 30_000, message: "o autosave deveria criar o rascunho" }).toBe(antes + 1);
}

test.describe("T738 — E283-B: boas-vindas de dono pela intenção nova", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas de teste).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.afterAll(async () => {
    if (ids.length) {
      await adm().from("emails_teste").delete().in("usuario_id", ids);
      await adm().from("automacoes_envios").delete().in("usuario_id", ids);
    }
    await apagarContas(ids);
  });

  test("A. conta zerada: navegar não manda nada; o 1º rascunho manda UM boas-vindas de dono; o 2º, nenhum", async ({ browser }) => {
    const c = await conta("zerada", "Zélia Zerada Sobrenome", {});
    const page = await entrar(browser, c.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    // Navegação pelas duas áreas (guarda de área → modo/papel pelo uso): nunca dispara.
    for (const rota of ["/dashboard/imoveis", "/dashboard/favoritos", "/dashboard"]) await page.goto(rota, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3_000);
    expect(await boasVindas(c.id)).toHaveLength(0);
    expect((await perfil(c.id)).intencao).toBeNull();

    await rascunhoPelaTela(page, c.id, 0);
    await expect.poll(async () => (await perfil(c.id)).intencao, { timeout: 20_000 }).toEqual(["anunciar"]);
    await expect.poll(async () => (await boasVindas(c.id)).length, { timeout: 30_000 }).toBe(1);
    expect((await boasVindas(c.id))[0].assunto).toBe(ASSUNTO_DONO);
    expect(await chave(c.id)).toEqual([{ chave: `boas_vindas:${c.id}` }]);

    // 2º rascunho de verdade (o 1º deixa de ser o "vazio recente" que o autosave reaproveitaria).
    const [primeiro] = await rascunhos(c.id);
    await adm().from("properties").update({ monthly_price: 3000 }).eq("id", primeiro.id);
    await rascunhoPelaTela(page, c.id, 1);
    await page.waitForTimeout(4_000);
    expect(await boasVindas(c.id), "o 2º rascunho não manda outro boas-vindas").toHaveLength(1);
    await page.context().close();
  });

  test("C. papel 'morador' gravado pelo uso, sem boas-vindas (o caso da Ana): o 1º rascunho manda UM boas-vindas de dono", async ({ browser }) => {
    const c = await conta("uso", "Úrsula Uso Sobrenome", { papel_ativo: "morador", preferred_mode: "tenant" });
    const page = await entrar(browser, c.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
    await rascunhoPelaTela(page, c.id, 0);
    await expect.poll(async () => (await perfil(c.id)).intencao, { timeout: 20_000 }).toEqual(["anunciar"]);
    await expect.poll(async () => (await boasVindas(c.id)).length, { timeout: 30_000 }).toBe(1);
    expect((await boasVindas(c.id))[0].assunto).toBe(ASSUNTO_DONO);
    await page.context().close();
  });

  test("D. já recebeu o boas-vindas de morador: o 1º rascunho registra 'anunciar' e não manda outro", async ({ browser }) => {
    const c = await conta("recebeu", "Rita Recebeu Sobrenome", { papel_ativo: "morador", preferred_mode: "tenant" });
    const { error } = await adm().from("automacoes_envios").insert({ chave: `boas_vindas:${c.id}`, tipo: "boas_vindas", usuario_id: c.id });
    expect(error).toBeNull();
    const page = await entrar(browser, c.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await rascunhoPelaTela(page, c.id, 0);
    await expect.poll(async () => (await perfil(c.id)).intencao, { timeout: 20_000 }).toEqual(["anunciar"]);
    await page.waitForTimeout(4_000);
    expect(await boasVindas(c.id)).toHaveLength(0);
    await page.context().close();
  });
});
