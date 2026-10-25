import { test, expect, type Browser, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import {
  NO_LABORATORIO,
  adm,
  apagarContas,
  criarConta,
  criarImovelPronto,
  criarLead,
  definirPlano,
  entrar,
  novaSenha,
  novoSufixo,
  tornarContratoVigente,
} from "../fixtures/laboratorio";
import { celularComCamera, fotografarEUsar } from "../fixtures/camera";
import { AREAS, CHAVES_NIVEL_FOTO, MATRIZ } from "../../../src/config/niveis";

/*
  T296 — Adendo 59.1, Parte A (exibição dos níveis). Só no laboratório. Três anúncios de teste do mesmo dono —
  Essencial, Conforto e Premium — e um rascunho; tudo a 390 e 1280 px.
   1. Cartão: o nível abre a linha de fatos ("Conforto · 1 quarto · …"). Busca: o nível na pílula "Nível" (E105; antes na folha) de
      filtros, com a contagem de cada chip ao vivo; Premium mostra só o Premium.
   2. Página do imóvel: bloco "Nível …" com critério, "Acima do nível" (Conforto com a sala Premium), ruído, extras e
      "· vistoriado" no Premium; "Como funcionam os níveis" abre a explicação. O Essencial silencioso tem "Ruído: Premium".
   3. Cadastro, passo Comodidades: o nível de agora e, item a item, o que falta para o próximo; a foto de um item sai
      da lista ("já conta").
   4. Painel do dono: "não confere" no ar dos quartos derruba o Premium → "caiu de Premium para Conforto: corrija …".
   5. Admin: Central de Pendências com as decisões primeiro; "Fotos de nível para analisar" abre a fila com a foto do
      cadastro.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.nivelexib.${sufixo}@lab.vivanomads.test`, nome: "Lia Nível", role: "owner" as const };
const inquilino = { email: `inq.nivelexib.${sufixo}@lab.vivanomads.test`, nome: "Rui Nível", role: "tenant" as const };
const T = { e: `Studio Essencial exib ${sufixo}`, c: `Loft Conforto exib ${sufixo}`, p: `Casa Premium exib ${sufixo}`, r: `Rascunho nível exib ${sufixo}` };
const ids: { dono?: string; inquilino?: string; e?: string; c?: string; p?: string; r?: string; contrato?: string } = {};
const LARGURAS = [390, 1280] as const;

const deConforto = new Set<string>(AREAS.flatMap((a) => MATRIZ[a].conforto));
const SILENCIOSO = { via_intensa: false, noturno_obra_100m: false, aviao_ferrovia: false, isolamento_acustico: false, classe: "baixo" };

async function itensComFoto(propertyId: string, chaves: readonly string[]) {
  const { error } = await adm()
    .from("nivel_itens")
    .upsert(chaves.map((chave) => ({ property_id: propertyId, chave, declarado: true, foto_path: `${ids.dono}/${randomUUID()}.webp`, foto_status: "aceita", foto_origem: "camera", foto_capturada_em: new Date().toISOString() })), { onConflict: "property_id,chave" });
  if (error) throw error;
}
async function medidas(propertyId: string, trabalhoBoa: boolean) {
  const valido = new Date(Date.now() + 150 * 86_400_000).toISOString();
  const linha = (ponto: string, boa: boolean) => ({ property_id: propertyId, user_id: ids.dono, papel: "dono", download_mbps: boa ? 300 : 20, upload_mbps: boa ? 100 : 5, latencia_ms: boa ? 12 : 90, validada: true, origem: "edicao", valido_ate: valido, ponto });
  const { error } = await adm().from("internet_medicoes").insert([linha("quarto_principal", true), linha("trabalho", trabalhoBoa)]);
  if (error) throw error;
}
async function semRolagemLateral(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra, "sem rolagem lateral").toBeLessThanOrEqual(1);
}
async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
async function publica(browser: Browser, w: number): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
  return ctx.newPage();
}

test.describe("T296 — Adendo 59.1, Parte A: níveis na tela", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inquilino = await criarConta(inquilino, senha);
    await definirPlano(ids.dono, "pro");
    ids.e = await criarImovelPronto(ids.dono, T.e, { ativo: true });
    ids.c = await criarImovelPronto(ids.dono, T.c, { ativo: true });
    ids.p = await criarImovelPronto(ids.dono, T.p, { ativo: true });
    ids.r = await criarImovelPronto(ids.dono, T.r);
    // Conforto: os itens de Conforto + o ar da sala (a sala fica Premium: "Acima do nível"), medidas (trabalho sem
    // videochamada) e ruído baixo. Premium: tudo, medidas boas, ruído alto com isolamento e dois extras.
    await itensComFoto(ids.c, [...CHAVES_NIVEL_FOTO.filter((k) => deConforto.has(k)), "ar_sala"]);
    await medidas(ids.c, false);
    await itensComFoto(ids.p, CHAVES_NIVEL_FOTO);
    await medidas(ids.p, true);
    const { error: eR } = await adm()
      .from("imovel_ruido")
      .insert([
        { property_id: ids.e, ...SILENCIOSO },
        { property_id: ids.c, ...SILENCIOSO },
        { property_id: ids.p, via_intensa: true, noturno_obra_100m: true, aviao_ferrovia: false, isolamento_acustico: true, classe: "alto" },
      ]);
    if (eR) throw eR;
    await adm().from("imovel_extras").insert([{ property_id: ids.p, chave: "air_fryer" }, { property_id: ids.p, chave: "secador_cabelo" }]);
    // Contrato vigente no Premium (a pendência do caso 4).
    const lead = await criarLead(ids.dono, ids.inquilino, ids.p, true);
    const { data, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.p, tenant_id: ids.inquilino, lead_id: lead, owner_plan: "pro", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, status: "ativo", garantia: "caucao" })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    await tornarContratoVigente(ids.contrato, ids.dono, 3200);
  });

  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.dono, ids.inquilino]);
  });

  test("0. o servidor calcula e grava o nível dos três (página do nível do dono)", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    for (const [id, nivel] of [[ids.e!, "essencial"], [ids.c!, "conforto"], [ids.p!, "premium"]] as const) {
      await page.goto(`/dashboard/imoveis/${id}/nivel`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("nivel-atual")).toHaveAttribute("data-nivel", nivel, { timeout: 20_000 });
    }
    await page.context().close();
    // A vistoria marca o Premium.
    await adm().from("imovel_nivel").update({ nivel_vistoriado_em: new Date().toISOString() }).eq("property_id", ids.p!);
  });

  test("1. cartão com o nível na linha de fatos; filtro 'Nível a partir de' com contagem ao vivo", async ({ browser }) => {
    for (const w of LARGURAS) {
      const page = await publica(browser, w);
      await page.goto("/buscar", { waitUntil: "domcontentloaded" });
      for (const [titulo, rotulo] of [[T.e, "Essencial"], [T.c, "Conforto"], [T.p, "Premium"]] as const) {
        const card = page.getByTestId("cartao-imovel").filter({ has: page.getByTestId("cartao-titulo").filter({ hasText: titulo }) }).first();
        await expect(card.getByTestId("card-nivel")).toHaveText(rotulo, { timeout: 30_000 });
        await expect(card.getByTestId("cartao-sintese")).toContainText(new RegExp(`^${rotulo}\\s*·`));
      }
      await semRolagemLateral(page);
      await page.screenshot({ path: `tests/laboratorio/saida/t296-1-cartoes-${w}.png` });

      // E105: o nível mora só na pílula "Nível" da linha de cima (saiu da folha "Mais filtros"); a escolha vale na hora.
      await page.getByTestId("pilula-nivel").click();
      const grupo = page.getByTestId("painel-pilula-nivel");
      await expect(grupo).toBeVisible();
      const n = async (v: string) => Number(await grupo.getByTestId(`pilula-nivel-${v}`).getAttribute("data-n"));
      const [ne, nc, np] = [await n("essencial"), await n("conforto"), await n("premium")];
      expect(ne).toBeGreaterThanOrEqual(nc);
      expect(nc).toBeGreaterThanOrEqual(np);
      expect(np).toBeGreaterThanOrEqual(1);
      await grupo.screenshot({ path: `tests/laboratorio/saida/t296-1-folha-nivel-${w}.png` });
      await grupo.getByTestId("pilula-nivel-premium").click();
      await expect(page).toHaveURL(/nivel=premium/);
      await expect(page.getByTestId("cartao-titulo").filter({ hasText: T.p }).first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("cartao-titulo").filter({ hasText: T.c })).toHaveCount(0);
      await page.context().close();
    }
  });

  test("2. página do imóvel: bloco do nível com critério, diferenciais, ruído, extras e '· vistoriado'", async ({ browser }) => {
    for (const w of LARGURAS) {
      const page = await publica(browser, w);
      await page.goto(`/imoveis/${ids.c}`, { waitUntil: "domcontentloaded" });
      const c = page.getByTestId("nivel-imovel");
      await expect(c).toHaveAttribute("data-nivel", "conforto", { timeout: 30_000 });
      await expect(c.getByTestId("nivel-titulo")).toHaveText("Nível Conforto");
      await expect(c.getByTestId("nivel-criterio")).toContainText("Padrão mínimo e mais conforto");
      await expect(c.getByTestId("nivel-diferenciais")).toContainText("Sala: Premium");
      await expect(c.getByTestId("nivel-ruido")).toContainText("Ruído baixo");
      await expect(c.getByTestId("nivel-extras")).toHaveCount(0);
      await c.scrollIntoViewIfNeeded();
      await semRolagemLateral(page);
      await page.screenshot({ path: `tests/laboratorio/saida/t296-2-ficha-conforto-${w}.png` });

      await page.goto(`/imoveis/${ids.p}`, { waitUntil: "domcontentloaded" });
      const p = page.getByTestId("nivel-imovel");
      await expect(p.getByTestId("nivel-titulo")).toHaveText("Nível Premium · vistoriado", { timeout: 30_000 });
      await expect(p.getByTestId("nivel-ruido")).toContainText("Ruído alto, com janelas de isolamento acústico");
      await expect(p.getByTestId("nivel-extras")).toContainText("Secador de cabelo, Air fryer");
      await expect(p.getByTestId("nivel-diferenciais")).toHaveCount(0);
      await p.getByTestId("nivel-como-funciona").click();
      const folha = page.getByTestId("nivel-folha");
      await expect(folha).toBeVisible();
      for (const n of ["essencial", "conforto", "premium"]) await expect(page.getByTestId(`nivel-folha-${n}`)).toBeVisible();
      await page.screenshot({ path: `tests/laboratorio/saida/t296-2-como-funciona-${w}.png` });

      await page.goto(`/imoveis/${ids.e}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("nivel-titulo")).toHaveText("Nível Essencial", { timeout: 30_000 });
      // Sem fonte de ruído, a área "Ruído" atende até o Premium: acima do nível do imóvel (regra da Pista B).
      await expect(page.getByTestId("nivel-diferenciais")).toHaveText(/Ruído: Premium/);
      await expect(page.getByTestId("nivel-diferenciais")).not.toContainText("Sala");
      await page.context().close();
    }
  });

  test("3. cadastro: nível de agora e o que falta, item a item, com a foto de cada item", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    for (const w of LARGURAS) {
      await largura(page, w);
      await page.goto(`/dashboard/imoveis/novo?draft=${ids.r}&etapa=comodidades`, { waitUntil: "domcontentloaded" });
      const bloco = page.getByTestId("nivel-cadastro");
      await expect(bloco.getByTestId("nivel-cadastro-agora")).toHaveAttribute("data-nivel", "essencial", { timeout: 30_000 });
      await expect(bloco.getByTestId("nivel-cadastro-agora")).toContainText("Agora: Essencial");
      await expect(bloco.getByTestId("nivel-cadastro-falta")).toHaveAttribute("data-proximo", "conforto");
      // E141: subir de nível é opcional (antes, "Para chegar a Conforto").
      await expect(bloco).toContainText("Subir para Conforto · opcional");
      await expect(bloco.getByTestId("nivel-cadastro-item-ar_quarto_principal")).toContainText("Ar-condicionado no quarto principal");
      await bloco.scrollIntoViewIfNeeded();
      await semRolagemLateral(page);
      await page.screenshot({ path: `tests/laboratorio/saida/t296-3-cadastro-${w}.png`, fullPage: true });
    }
    // FOTO-NA-HORA-B: no computador, o item oferece "Fotografar pelo celular" (nunca arquivo nem webcam).
    await expect(page.getByTestId("nivel-cadastro-aviso-camera")).toContainText("Para provar o nível, a foto é feita na hora, pela câmera.");
    await expect(page.getByTestId("nivel-cadastro-foto-sono_dois_jogos-botao")).toHaveText("Fotografar pelo celular");
    await expect(page.getByTestId("nivel-cadastro").locator('input[type="file"]')).toHaveCount(0);
    await page.context().close();
    // A foto de um item, feita na hora no celular: sai da lista do que falta e entra "em análise" (conta enquanto isso).
    const cel = await celularComCamera({ email: dono.email, senha });
    try {
      await cel.page.goto(`/dashboard/imoveis/novo?draft=${ids.r}&etapa=comodidades`, { waitUntil: "domcontentloaded" });
      await expect(cel.page.getByTestId("nivel-cadastro-foto-sono_dois_jogos-botao")).toHaveText("Fotografar agora", { timeout: 30_000 });
      await cel.page.getByTestId("nivel-cadastro-foto-sono_dois_jogos-botao").click();
      await fotografarEUsar(cel.page);
      await expect(cel.page.getByTestId("nivel-cadastro-msg")).toHaveText("Foto de 2 jogos de roupa de cama recebida. O item já conta enquanto a foto é analisada.", { timeout: 30_000 });
      await expect(cel.page.getByTestId("nivel-cadastro-item-sono_dois_jogos")).toHaveCount(0);
      const { data } = await adm().from("nivel_itens").select("declarado, foto_status, foto_origem").eq("property_id", ids.r!).eq("chave", "sono_dois_jogos").single();
      expect(data).toMatchObject({ declarado: true, foto_status: "pendente", foto_origem: "camera" });
    } finally {
      await cel.fechar();
    }
  });

  test("4. painel do dono: 'não confere' derruba o Premium e a decisão diz o que corrigir, com o prazo", async ({ browser }) => {
    const { error } = await adm()
      .from("conforto_pendencias")
      .insert({ property_id: ids.p, contrato_id: ids.contrato, chave: "ar_todos_quartos", status: "aberta", prazo_ate: new Date(Date.now() + 72 * 3_600_000).toISOString(), texto_morador: "O quarto 2 não tem ar." });
    if (error) throw error;
    const page = await entrar(browser, dono.email, senha);
    for (const w of LARGURAS) {
      await largura(page, w);
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const linha = page.locator(`[data-decisao="nivel-queda-${ids.p}"]`);
      await expect(linha).toContainText(`${T.p} caiu de Premium para Conforto: corrija Ar-condicionado em todos os quartos`, { timeout: 30_000 });
      await expect(linha.getByTestId("decisao-prazo")).toContainText("Corrija até");
      await expect(linha).toHaveAttribute("href", `/dashboard/contratos/${ids.contrato}#pendencias-conforto`);
      await semRolagemLateral(page);
      await page.screenshot({ path: `tests/laboratorio/saida/t296-4-painel-queda-${w}.png` });
    }
    await page.context().close();
  });

  test("5. admin: Central de Pendências com as decisões primeiro; a fila de fotos de nível abre a foto do cadastro", async ({ browser }) => {
    for (const w of LARGURAS) {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: 900 } });
      const a = await ctx.newPage();
      await a.goto("/admin/pendencias", { waitUntil: "domcontentloaded" });
      const decisoes = a.getByTestId("central-decisoes");
      await expect(decisoes).toBeVisible({ timeout: 30_000 });
      await expect(decisoes.getByRole("heading", { level: 2 })).toContainText(/pendência/);
      // Decisões primeiro: o bloco vem antes da lista, e a equipe decide antes do que espera o proprietário.
      const yDecisoes = (await decisoes.boundingBox())!.y;
      const yLista = (await a.getByText("Todas as pendências", { exact: true }).first().boundingBox())!.y;
      expect(yDecisoes).toBeLessThan(yLista);
      const lados = await decisoes.locator("[data-testid^='central-lado-']").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
      expect(lados[0]).toBe("central-lado-equipe");
      const fotos = decisoes.getByTestId("central-filtro-fotos_nivel");
      expect(Number(await fotos.getAttribute("data-n"))).toBeGreaterThanOrEqual(1);
      await semRolagemLateral(a);
      await a.screenshot({ path: `tests/laboratorio/saida/t296-5-central-${w}.png` });
      await fotos.click();
      await expect(a).toHaveURL(/filtro=fotos_nivel/);
      await expect(a.getByTestId("central-linha").filter({ hasText: T.r }).first()).toBeVisible({ timeout: 30_000 });
      await expect(a.getByTestId("central-filtro-todos")).toBeVisible();
      await ctx.close();
    }
  });
});
