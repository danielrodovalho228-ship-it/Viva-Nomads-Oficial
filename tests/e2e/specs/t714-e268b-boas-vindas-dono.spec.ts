import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { FOTO_TESTE, abrirCadastroNovo, noPasso } from "../fixtures/cadastro";

/*
  T714 — E268-B (#1607): quem vira dono pelo anúncio recebe o boas-vindas de DONO. O 1º rascunho de anúncio
  (saveDraftData novo) passa pelo mesmo caminho da tela de intenção (intencao-servidor.ts): grava "anunciar" na
  intenção e, SÓ no primeiro acesso da conta (intenção e papel ativo ainda vazios), o papel inicial e UM boas-vindas.
  A t186 já cobre a conta de DONO zerada (1280) e a de dono que já tinha "morar" (390); aqui, a conta de MORADOR:
    A. conta de morador que nunca respondeu a tela de intenção abre "Anunciar" (/dashboard/imoveis/novo): abrir a
       tela não manda nada; o 1º rascunho (uma foto no Passo 2) manda UM boas-vindas de dono, com o corpo que nomeia
       a pessoa e diz o que vem (Qualificação → Cadastro → Publicar, "Anunciar meu imóvel"); a intenção vira
       ["anunciar"], o papel ativo vira proprietário e o modo, owner — o role de cadastro não muda (nunca role).
       O 2º rascunho (um anúncio novo de verdade, não o vazio reaproveitado) não manda outro.
    B. conta que já era dona (papel ativo proprietário, intenção nunca respondida): o 1º rascunho só grava "anunciar";
       nenhum boas-vindas.
    C. moradora que já respondeu "Quero morar" (390): ganha "anunciar" na intenção, sem boas-vindas (não é o 1º acesso,
       mesmo sem a chave de envio gravada).
  Contas do laboratório marcadas como de teste: o e-mail cai em emails_teste (o texto do e-mail), lido aqui.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: string[] = [];

async function conta(quem: string, nome: string, role: "owner" | "tenant", perfil: Record<string, unknown>) {
  const email = `${quem}.t714.${sufixo}@lab.vivanomads.test`;
  const id = await criarConta({ email, nome, role }, senha);
  ids.push(id);
  const { error } = await adm().from("profiles").update({ is_teste: true, intencao: null, papel_ativo: null, preferred_mode: null, ...perfil }).eq("id", id);
  if (error) throw error;
  return { id, email };
}

async function perfil(id: string) {
  const { data } = await adm().from("profiles").select("role, intencao, papel_ativo, preferred_mode").eq("id", id).single();
  return data as { role: string; intencao: string[] | null; papel_ativo: string | null; preferred_mode: string | null };
}

const rascunhos = async (id: string) => (await adm().from("properties").select("id").eq("owner_id", id).eq("status", "draft")).data ?? [];

async function boasVindas(id: string) {
  const { data } = await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", id).eq("evento", "boas_vindas");
  return (data ?? []) as { assunto: string; corpo: string }[];
}

/** "Anunciar" → Passo 1 → Passo 2 com UMA foto: o autosave cria o rascunho no servidor (saveDraftData sem id). */
async function rascunhoPelaTela(page: Page, donoId: string, antes: number) {
  await abrirCadastroNovo(page);
  await page.getByTestId("cadastro-continuar").click();
  await noPasso(page, "fotos");
  await page.getByTestId("etapa-fotos").locator('input[type="file"]').first().setInputFiles([FOTO_TESTE]);
  await expect.poll(async () => (await rascunhos(donoId)).length, { timeout: 30_000, message: "o autosave deveria criar o rascunho" }).toBe(antes + 1);
}

test.describe("T714 — E268-B: boas-vindas de dono para quem vira dono pelo anúncio", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas de teste).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.afterAll(async () => {
    if (ids.length) {
      await adm().from("emails_teste").delete().in("usuario_id", ids);
      await adm().from("automacoes_envios").delete().in("usuario_id", ids);
    }
    await apagarContas(ids);
  });

  test("A. morador sem intenção: o 1º rascunho manda UM boas-vindas de dono (corpo com o nome e os passos); o 2º não repete", async ({ browser }) => {
    const c = await conta("morador", "Tainá Morador Sobrenome", "tenant", {});
    const page = await entrar(browser, c.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });

    await abrirCadastroNovo(page);
    // Abrir o "Anunciar" não é anunciar: nada de e-mail nem de intenção antes do rascunho.
    await page.waitForTimeout(3_000);
    expect(await boasVindas(c.id)).toHaveLength(0);
    expect((await perfil(c.id)).intencao).toBeNull();

    await rascunhoPelaTela(page, c.id, 0);
    await expect.poll(async () => (await perfil(c.id)).intencao, { timeout: 20_000 }).toEqual(["anunciar"]);
    await expect.poll(async () => (await boasVindas(c.id)).length, { timeout: 30_000, message: "UM boas-vindas de dono no 1º rascunho (primeiro acesso da conta)" }).toBe(1);
    const [e] = await boasVindas(c.id);
    expect(e.assunto).toBe("Boas-vindas: como anunciar o seu imóvel · Viva Nomads");
    expect(e.corpo, "nomeia a pessoa (primeiro nome)").toContain("Olá Tainá, a sua conta no Viva Nomads está pronta. Anunciar leva três passos.");
    expect(e.corpo).not.toContain("Tainá Morador Sobrenome");
    expect(e.corpo, "o que vem a seguir").toContain("Como anunciar");
    expect(e.corpo).toMatch(/1\. Qualificação[\s\S]*2\. Cadastro[\s\S]*3\. Publicar/);
    expect(e.corpo).toContain("A Viva não recebe nem guarda dinheiro: o pagamento é direto entre vocês.");
    expect(e.corpo).toContain("Anunciar meu imóvel");
    expect(e.corpo, "não é o boas-vindas de morador").not.toContain("Começar a buscar");
    const { data: chave } = await adm().from("automacoes_envios").select("chave").eq("usuario_id", c.id).eq("tipo", "boas_vindas");
    expect(chave).toEqual([{ chave: `boas_vindas:${c.id}` }]);
    // O papel: ativo proprietário e modo owner; o role de cadastro continua o de morador (a intenção não mexe em permissão).
    expect(await perfil(c.id)).toMatchObject({ role: "tenant", papel_ativo: "proprietario", preferred_mode: "owner" });

    // 2º rascunho de verdade: o 1º deixa de ser o "vazio recente" que o autosave reaproveitaria.
    const [primeiro] = await rascunhos(c.id);
    await adm().from("properties").update({ monthly_price: 3000 }).eq("id", primeiro.id);
    await rascunhoPelaTela(page, c.id, 1);
    await page.waitForTimeout(4_000);
    expect(await boasVindas(c.id), "o 2º rascunho não manda outro boas-vindas").toHaveLength(1);
    expect((await perfil(c.id)).intencao).toEqual(["anunciar"]);
    await page.context().close();
  });

  test("B. conta que já era dona (papel proprietário, intenção nunca respondida): só grava 'anunciar', sem boas-vindas", async ({ browser }) => {
    const c = await conta("dona", "Olívia Dona Sobrenome", "owner", { papel_ativo: "proprietario", preferred_mode: "owner" });
    const page = await entrar(browser, c.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await rascunhoPelaTela(page, c.id, 0);
    await expect.poll(async () => (await perfil(c.id)).intencao, { timeout: 20_000 }).toEqual(["anunciar"]);
    await page.waitForTimeout(4_000);
    expect(await boasVindas(c.id)).toHaveLength(0);
    const { data: chave } = await adm().from("automacoes_envios").select("chave").eq("usuario_id", c.id).eq("tipo", "boas_vindas");
    expect(chave ?? []).toHaveLength(0);
    expect(await perfil(c.id)).toMatchObject({ role: "owner", papel_ativo: "proprietario", preferred_mode: "owner" });
    await page.context().close();
  });

  test("C. moradora que já respondeu 'Quero morar' (390): ganha 'anunciar' na intenção, sem boas-vindas", async ({ browser }) => {
    const c = await conta("moradora", "Iara Moradora Sobrenome", "tenant", { intencao: ["morar"], papel_ativo: "morador", preferred_mode: "tenant" });
    const page = await entrar(browser, c.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
    await rascunhoPelaTela(page, c.id, 0);
    await expect.poll(async () => (await perfil(c.id)).intencao, { timeout: 20_000 }).toEqual(["morar", "anunciar"]);
    await page.waitForTimeout(4_000);
    expect(await boasVindas(c.id), "não é o primeiro acesso: nenhum boas-vindas novo").toHaveLength(0);
    // Abrir a área de dono troca o papel ativo (PAPEL-B); o role de cadastro continua o de morador.
    expect(await perfil(c.id)).toMatchObject({ role: "tenant", papel_ativo: "proprietario" });
    await page.context().close();
  });
});
