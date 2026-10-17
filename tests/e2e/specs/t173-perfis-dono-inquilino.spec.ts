import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, fotosReais, novaSenha, novoSufixo, pngDeTeste } from "../fixtures/laboratorio";

/*
  T173 — Perfis do proprietário e do inquilino (prompt 6, 17/10), a 390 e 1280 px.
  1. Anúncio real: "Sobre o proprietário" com nome curto, cidade, desde, contagens, "Novo na Viva" (menos de 3
     conversas), idiomas, bio, selo REAL (e-mail confirmado) e os botões; página pública /proprietario/[id] certa.
  2. Candidato ANTES do aceite: "Candidato(a)", sem nome, foto ou contato; DEPOIS: nome curto e foto.
  3. Nenhum selo sem base (telefone/identidade) e nenhum telefone/e-mail na tela.
  4. Anúncio de exemplo: "Proprietário (exemplo)" e nenhum número.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.perfil.${sufixo}@lab.vivanomads.test`, nome: "Túlio Perfildono Sobrenomedono", role: "owner" as const };
const inq = { email: `inq.perfil.${sufixo}@lab.vivanomads.test`, nome: "Iara Perfilinq Sobrenomeoculto", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string } = {};
const SAIDA = "tests/laboratorio/saida";

test.describe("T173 — perfis do proprietário e do inquilino", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio do perfil ${sufixo}`, { ativo: true });
    await fotosReais(ids.imovel, ids.dono);
    const { error } = await adm()
      .from("profiles")
      .update({ bio: "Engenheiro, moro em Uberlândia e cuido pessoalmente dos meus imóveis.", idiomas: ["Português", "Inglês"], cidade: "Uberlândia (MG)" })
      .eq("id", ids.dono);
    expect(error).toBeNull();
    // Foto da inquilina no caminho canônico (só aparece ao dono depois do aceite).
    const caminho = `${ids.inq}/avatar.webp`;
    await adm().storage.from("avatars").upload(caminho, pngDeTeste(7, 200, 200), { contentType: "image/webp", upsert: true });
    await adm().from("profiles").update({ avatar_url: caminho }).eq("id", ids.inq);
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel, false);
  });

  test.afterAll(async () => {
    await apagarContas([ids.inq, ids.dono]);
  });

  for (const largura of [390, 1280]) {
    test(`${largura}px — anúncio: Sobre o proprietário e página pública`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: largura, height: 900 }, storageState: { cookies: [], origins: [] } });
      const page = await ctx.newPage();
      await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
      const card = page.getByTestId("sobre-proprietario");
      await expect(card).toBeVisible({ timeout: 20_000 });
      await expect(card.getByTestId("proprietario-nome")).toHaveText("Túlio S.");
      await expect(card).not.toContainText("Sobrenomedono");
      await expect(card).toContainText("Uberlândia (MG)");
      await expect(card).toContainText(/Na Viva desde \w+ de \d{4}/);
      await expect(card).toContainText("1 imóvel na Viva");
      await expect(card).toContainText("0 estadias concluídas");
      await expect(card.getByTestId("proprietario-resposta")).toHaveText("Novo na Viva");
      await expect(card).toContainText("Fala Português, Inglês");
      await expect(card).toContainText("cuido pessoalmente");
      await expect(card.getByTestId("proprietario-selos")).toHaveText("E-mail confirmado");
      await expect(card).not.toContainText(/Telefone verificado|Identidade verificada/);
      await expect(card).not.toContainText(dono.email);
      await expect(card).not.toContainText("99999");
      await expect(card.getByRole("button", { name: "Enviar mensagem" })).toBeVisible();
      await card.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t173-sobre-proprietario-${largura}.png`, fullPage: false });

      await card.getByRole("link", { name: "Ver perfil completo" }).click();
      await expect(page).toHaveURL(new RegExp(`/proprietario/${ids.dono}$`));
      const perfil = page.getByTestId("pagina-proprietario");
      await expect(perfil.getByRole("heading", { level: 1 })).toHaveText("Túlio S.");
      await expect(perfil).toContainText(`Studio do perfil ${sufixo}`);
      await expect(perfil).toContainText("Avaliações recebidas");
      await expect(perfil).not.toContainText(dono.email);
      // Com imóvel ativo, a página pode ir para o Google.
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index/);
      await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute("content", /noindex/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `${SAIDA}/t173-pagina-proprietario-${largura}.png`, fullPage: true });
      await ctx.close();
    });
  }

  test("candidato: antes do aceite sem nome, foto ou contato; depois, nome curto e foto (390 e 1280)", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await entrar(browser, dono.email, senha);
    for (const largura of [390, 1280]) {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/dashboard/leads", { waitUntil: "networkidle" });
      const cartao = page.getByTestId("cartao-candidato").first();
      await expect(cartao.getByTestId("candidato-nome")).toHaveText("Candidato(a)");
      await expect(cartao.getByTestId("candidato-foto")).toHaveCount(0);
      const corpo = await page.locator("main").innerText();
      expect(corpo).not.toMatch(/Iara|Perfilinq|Sobrenomeoculto/);
      expect(corpo).not.toContain(inq.email);
      await expect(cartao.getByTestId("candidato-sinais")).toContainText("E-mail confirmado");
      await expect(cartao.getByTestId("candidato-sinais")).toContainText(/Na Viva desde/);
      await page.screenshot({ path: `${SAIDA}/t173-candidato-antes-${largura}.png`, fullPage: false });
    }

    const { error } = await adm().from("leads").update({ status: "accepted" }).eq("id", ids.lead!);
    expect(error).toBeNull();
    for (const largura of [390, 1280]) {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/dashboard/leads", { waitUntil: "networkidle" });
      const cartao = page.getByTestId("cartao-candidato").first();
      await expect(cartao.getByTestId("candidato-nome")).toHaveText("Iara S.");
      await expect(cartao.getByTestId("candidato-foto")).toBeVisible();
      const corpo = await page.locator("main").innerText();
      expect(corpo).not.toMatch(/Sobrenomeoculto|Perfilinq/);
      expect(corpo).not.toContain(inq.email);
      expect(corpo).not.toMatch(/Telefone verificado|Identidade verificada/);
      await page.screenshot({ path: `${SAIDA}/t173-candidato-depois-${largura}.png`, fullPage: false });
    }
    await page.context().close();
  });

  test("segurança: a função 0149 só roda no servidor; cada um só altera a PRÓPRIA frase, idiomas e cidade", async () => {
    // Visitante (anon) e usuário logado NÃO executam a função; só o service_role.
    const anon = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const semLogin = await anon.rpc("perfil_publico_proprietario", { p_dono: ids.dono });
    expect(semLogin.error, "anon não pode executar").not.toBeNull();
    const logada = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const { error: eLogin } = await logada.auth.signInWithPassword({ email: inq.email, password: senha });
    expect(eLogin).toBeNull();
    const comLogin = await logada.rpc("perfil_publico_proprietario", { p_dono: ids.dono });
    expect(comLogin.error, "usuário logado não pode executar").not.toBeNull();
    const servidor = await adm().rpc("perfil_publico_proprietario", { p_dono: ids.dono });
    expect(servidor.error).toBeNull();
    expect((servidor.data as unknown[]).length).toBe(1);

    // A inquilina tenta mudar a frase, idiomas e cidade do DONO: nada muda.
    const antes = (await adm().from("profiles").select("bio, idiomas, cidade").eq("id", ids.dono!).single()).data!;
    const tentativa = await logada.from("profiles").update({ bio: "invadido", idiomas: ["Alemão"], cidade: "Outra" }).eq("id", ids.dono!).select("id");
    expect(tentativa.data ?? []).toHaveLength(0);
    const depois = (await adm().from("profiles").select("bio, idiomas, cidade").eq("id", ids.dono!).single()).data!;
    expect(depois).toEqual(antes);
    // E a própria inquilina consegue alterar os dela.
    const propria = await logada.from("profiles").update({ cidade: "Uberlândia (MG)" }).eq("id", ids.inq!).select("id");
    expect(propria.error).toBeNull();
    expect(propria.data).toHaveLength(1);
    await logada.auth.signOut();
  });

  test("anúncio de exemplo: 'Proprietário (exemplo)' sem números nem botões (390 e 1280)", async ({ browser }) => {
    for (const largura of [390, 1280]) {
      const ctx = await browser.newContext({ viewport: { width: largura, height: 900 }, storageState: { cookies: [], origins: [] } });
      const page = await ctx.newPage();
      await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
      const card = page.getByTestId("sobre-proprietario");
      await expect(card).toContainText("Proprietário (exemplo)", { timeout: 20_000 });
      await expect(card.getByTestId("proprietario-exemplo")).toBeVisible();
      await expect(card).not.toContainText(/\d/);
      await expect(card.getByRole("link", { name: "Ver perfil completo" })).toHaveCount(0);
      await ctx.close();
    }
  });

  test("Conta: 'Complete seu perfil' mostra o progresso e recusa bio com telefone (390 e 1280)", async ({ browser }) => {
    const page = await entrar(browser, inq.email, senha);
    for (const largura of [390, 1280]) {
      await page.setViewportSize({ width: largura, height: 900 });
      // Celular: subtela do app; computador: a página completa da Conta (site).
      await page.goto(largura === 390 ? "/dashboard/conta/perfil" : "/dashboard/conta", { waitUntil: "networkidle" });
      const bloco = page.getByTestId("complete-perfil");
      await expect(bloco).toBeVisible({ timeout: 20_000 });
      await expect(bloco.getByTestId("perfil-progresso")).toContainText("% completo");
      await page.locator("#perfil-bio").fill("me chama no 34 99999-8888");
      await expect(bloco).toContainText("Tire telefone, e-mail, @ ou link da bio");
      await expect(bloco.getByRole("button", { name: "Salvar perfil" })).toBeDisabled();
      await page.locator("#perfil-bio").fill("Pesquisadora, organizada e tranquila.");
      await bloco.getByRole("button", { name: "Português" }).click();
      await bloco.getByRole("button", { name: "Salvar perfil" }).click();
      await expect(bloco.getByRole("status")).toHaveText("Perfil salvo.");
      await page.screenshot({ path: `${SAIDA}/t173-complete-perfil-${largura}.png`, fullPage: false });
    }
    const { data } = await adm().from("profiles").select("bio, idiomas").eq("id", ids.inq!).single();
    expect(data?.bio).toBe("Pesquisadora, organizada e tranquila.");
    await page.context().close();
  });
});
