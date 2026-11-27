import { test, expect, type Browser, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1721 — E1079 @E1079, fatia 2 (ORDEM-DUET-385/386/397): o painel do avaliador pelo mockup aprovado (avaliador-painel).
  Massa própria, só contas de teste: um avaliador ATIVO com foto de perfil e três pedidos (um à espera de resposta, uma
  visita agendada para hoje, um laudo emitido com o valor marcado como recebido — R$ 250, o da tabela da cidade), e um
  avaliador EM TESTE sem foto e sem pedidos.
   1. Com foto e pedidos, a 390 e a 1280 px: "Olá, <primeiro nome>!", "Você tem 1 visita hoje", a FOTO de perfil no
      cabeçalho, a faixa "1 visita para hoje" com "Ver pedidos" e os quatro cartões com o que o sistema tem.
      "Ver pedidos" leva à lista "Para responder". Sem rolagem lateral.
   2. Sem foto e sem pedidos: as INICIAIS no círculo (nunca vazio), os textos de quem não tem nada hoje; o que já
      existia na página continua (situação do credenciamento, listas).
   3. Quem ainda não recebe pedidos (pedido em análise) continua com o título de antes, sem painel.
  As procuras são pelo texto que a tela mostra. Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Uberlândia";
const senha = novaSenha();
const sufixo = novoSufixo();
const comFoto = { email: `av.foto.t1721.${sufixo}@lab.vivanomads.test`, nome: "Renato Teste Avaliador", role: "tenant" as const };
const semFoto = { email: `av.iniciais.t1721.${sufixo}@lab.vivanomads.test`, nome: "Ana Teste Avaliadora", role: "tenant" as const };
const dono = { email: `dono.t1721.${sufixo}@lab.vivanomads.test`, nome: "Dora Painel Sobrenome", role: "owner" as const };
const ids: { comFoto?: string; semFoto?: string; dono?: string } = {};
const cred: { comFoto?: string; semFoto?: string } = {};
const numeros: { comFoto?: string; semFoto?: string } = {};
const imoveis: string[] = [];

/** Hoje ao meio-dia de Brasília (o dia de Brasília, nunca o de UTC). */
function hojeAoMeioDiaDeBrasilia(): string {
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  return `${dia}T15:00:00Z`;
}

async function painel(browser: Browser, email: string, largura: 390 | 1280): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await page.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("credenciamento-situacao")).toBeVisible({ timeout: 30_000 });
  return page;
}

test.describe("T1721 — E1079: o painel do avaliador pelo mockup (saudação, foto, visitas de hoje, cartões) @E1079", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    for (const [chave, conta, status] of [["comFoto", comFoto, "ativo"], ["semFoto", semFoto, "em_teste"]] as const) {
      const id = await criarConta(conta, senha);
      ids[chave] = id;
      const { data: parc, error } = await adm()
        .from("parceiros")
        .insert({ user_id: id, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: conta.nome, slug: `aval-${chave.toLowerCase()}-t1721-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
        .select("id")
        .single();
      if (error) throw error;
      const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
      numeros[chave] = n as string;
      const { data: c, error: e2 } = await adm()
        .from("avaliadores_credenciamento")
        .insert({ parceiro_id: parc.id, user_id: id, cidade: CIDADE, numero_credenciado: n, status, experiencia_link: "https://portfolio.lab.vivanomads.test", conduta_versao: "2026-10-23", ativado_em: status === "ativo" ? new Date().toISOString() : null })
        .select("id")
        .single();
      if (e2) throw e2;
      cred[chave] = c.id as string;
    }
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.comFoto, ids.semFoto]);
    // A foto de perfil da conta (a mesma que a pessoa envia em Conta): bucket privado, caminho canónico.
    const up = await adm().storage.from("avatars").upload(`${ids.comFoto}/avatar.webp`, readFileSync("public/images/home/persona-saude.webp"), { contentType: "image/webp", upsert: true });
    if (up.error) throw up.error;
    const { error: e3 } = await adm().from("profiles").update({ avatar_url: `${ids.comFoto}/avatar.webp` }).eq("id", ids.comFoto!);
    if (e3) throw e3;
    // Três pedidos do avaliador com foto, cada um num imóvel (só pode haver um pedido aberto por imóvel).
    const agora = new Date().toISOString();
    const pedidos = [
      { extra: { status: "designado" }, resposta: null }, // novo: à espera da resposta dele
      { extra: { status: "agendado", agendado_para: hojeAoMeioDiaDeBrasilia() }, resposta: "aceita" }, // visita de hoje
      { extra: { status: "laudo_emitido", recebido_marcado_em: agora }, resposta: "aceita" }, // recebido: R$ 250
    ];
    for (const [i, p] of pedidos.entries()) {
      const imovel = await criarImovelPronto(ids.dono!, `[TESTE QA] Painel ${i + 1} ${sufixo}`, { ativo: true, preco: 2500 });
      imoveis.push(imovel);
      const { data, error } = await adm()
        .from("vistoria_pedidos")
        .insert({ property_id: imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 250, avaliador_id: cred.comFoto, designado_em: agora, ...p.extra })
        .select("id")
        .single();
      if (error) throw error;
      const { error: e4 } = await adm().from("vistoria_designacoes").insert({ pedido_id: data.id, avaliador_id: cred.comFoto, resposta: p.resposta, respondido_em: p.resposta ? agora : null });
      if (e4) throw e4;
    }
  });

  test.afterAll(async () => {
    if (imoveis.length) await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    await adm().from("vistoria_designacoes").delete().in("avaliador_id", [cred.comFoto, cred.semFoto].filter(Boolean) as string[]);
    await adm().from("avaliadores_credenciamento").delete().in("id", [cred.comFoto, cred.semFoto].filter(Boolean) as string[]);
    if (ids.comFoto) await adm().storage.from("avatars").remove([`${ids.comFoto}/avatar.webp`]);
    await apagarContas([ids.comFoto, ids.semFoto, ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`1. com foto e pedidos, a ${largura} px: saudação, foto de perfil, visitas de hoje e os quatro cartões`, async ({ browser }) => {
      const page = await painel(browser, comFoto.email, largura);
      const p = page.getByTestId("painel-avaliador");
      await expect(p.getByRole("heading", { level: 1, name: "Olá, Renato!" })).toBeVisible();
      await expect(p.getByTestId("painel-visitas-hoje")).toHaveText("Você tem 1 visita hoje");
      // A foto de perfil da conta no cabeçalho.
      const foto = p.getByTestId("painel-foto");
      await expect(foto).toHaveAttribute("data-foto", "sim");
      await expect.poll(async () => foto.locator("img").evaluate((el) => (el as HTMLImageElement).naturalWidth), { timeout: 20_000 }).toBeGreaterThan(0);
      await expect(p.getByTestId("painel-faixa")).toHaveText("1 visita para hoje");
      // Os quatro cartões, na ordem do desenho, com o que o sistema tem.
      await expect(p.getByTestId("painel-cartoes").getByRole("link")).toHaveText([/^Pedidos\s*1 novo$/, /^Agenda\s*Hoje • 1 visita$/, /^Recebidos\s*R\$\s?250,00$/, /^Credenciamento\s*Ativo$/]);
      // A faixa é o verde-escuro do desenho.
      expect(await p.getByTestId("painel-faixa").locator("xpath=..").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(18, 53, 38)");
      // O nome é "Avaliador credenciado" (ORDEM-397) e o número continua na página.
      await expect(page.getByTestId("credenciamento-linha")).toHaveText(`Avaliador credenciado nº ${numeros.comFoto} · ${CIDADE}`);
      await expect(page.locator("main")).not.toContainText(/vistoriador/i);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${largura} px: sem rolagem lateral`).toBeLessThanOrEqual(1);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${SAIDA}/t1721-1-painel-${largura}.png` });
      await p.screenshot({ path: `${SAIDA}/t1721-1-painel-bloco-${largura}.png` });
      // "Ver pedidos" leva à lista "Para responder", onde está o pedido novo.
      await p.getByTestId("painel-ver-pedidos").click();
      const lista = page.getByTestId("avaliacoes-designadas");
      await expect(lista).toBeInViewport({ timeout: 10_000 });
      await expect(lista.getByTestId("avaliacao-designada")).toHaveCount(1);
      await page.context().close();
    });
  }

  test("2. sem foto e sem pedidos: as iniciais no círculo e os textos de quem não tem nada hoje; o resto da página continua", async ({ browser }) => {
    const page = await painel(browser, semFoto.email, 390);
    const p = page.getByTestId("painel-avaliador");
    await expect(p.getByRole("heading", { level: 1, name: "Olá, Ana!" })).toBeVisible();
    await expect(p.getByTestId("painel-visitas-hoje")).toHaveText("Você não tem visita hoje");
    const foto = p.getByTestId("painel-foto");
    await expect(foto).toHaveAttribute("data-foto", "nao");
    await expect(foto.locator("img"), "sem foto não há imagem quebrada").toHaveCount(0);
    // As iniciais da casa: primeiro e último nome ("Ana Teste Avaliadora" → AA).
    await expect(foto.locator('[data-rosto="iniciais"]')).toHaveText("AA");
    await expect(p.getByTestId("painel-faixa")).toHaveText("Nenhuma visita para hoje");
    await expect(p.getByTestId("painel-cartoes").getByRole("link")).toHaveText([/^Pedidos\s*Nenhum novo$/, /^Agenda\s*Hoje • sem visita$/, /^Recebidos\s*R\$\s?0,00$/, /^Credenciamento\s*Em teste$/]);
    // O que já existia continua na página.
    await expect(page.getByTestId("credenciamento-estado")).toHaveText("Em teste");
    await expect(page.getByTestId("credenciamento-passos")).toBeVisible();
    await expect(page.getByTestId("avaliacoes-designadas")).toContainText("Nenhuma avaliação esperando a sua resposta.");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "390 px: sem rolagem lateral").toBeLessThanOrEqual(1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${SAIDA}/t1721-2-painel-iniciais-390.png` });
    await page.context().close();
  });

  test("3. pedido de credenciamento ainda em análise: o título de antes, sem painel", async ({ browser }) => {
    await adm().from("avaliadores_credenciamento").update({ status: "solicitado" }).eq("id", cred.semFoto!);
    const page = await painel(browser, semFoto.email, 390);
    await expect(page.getByRole("heading", { level: 1, name: "Avaliação de imóveis" })).toBeVisible();
    await expect(page.getByTestId("painel-avaliador")).toHaveCount(0);
    await expect(page.getByTestId("credenciamento-estado")).toHaveText("Em análise");
    await page.context().close();
  });
});
