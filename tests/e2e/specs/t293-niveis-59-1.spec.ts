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
  pngDeTeste,
  tornarContratoVigente,
} from "../fixtures/laboratorio";
import { AREAS, CHAVES_NIVEL_FOTO, MATRIZ, type ChaveNivel } from "../../../src/config/niveis";

/*
  T293 — Adendo 59.1 (parte funcional): níveis Essencial / Conforto / Premium. Só no laboratório.
  Três anúncios do mesmo dono — Essencial, Conforto e Premium — com as fotos de cada item, as medidas por ponto e o ruído.
   1. Cada um no nível certo (calculado pelo servidor); declarar item sem foto é recusado; a foto pelo upload entra "em análise".
   2. Elo mais fraco: o Premium com uma área em Conforto (tira o ar da sala) vira Conforto; volta ao repor.
   3. Foto recusada pelo atendimento (Central de pendências) tira o item: Premium → Conforto; foto nova → Premium.
   4. Conferência de entrada: o morador marca "não confere" no ar-condicionado dos quartos → exibido como Conforto →
      o dono corrige com foto → volta a Premium.
   5. Filtro "a partir de Conforto" (`?nivel=conforto`) mostra o Conforto e o Premium, não o Essencial.
  Cartão e ficha com o nível e os extras são da exibição (Pista A).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.nivel.${sufixo}@lab.vivanomads.test`, nome: "Nina Nível", role: "owner" as const };
const inquilino = { email: `inq.nivel.${sufixo}@lab.vivanomads.test`, nome: "Ivo Nível", role: "tenant" as const };
const T = { e: `Studio Essencial ${sufixo}`, c: `Apartamento Conforto ${sufixo}`, p: `Casa Premium ${sufixo}` };
const ids: { dono?: string; inquilino?: string; e?: string; c?: string; p?: string; contrato?: string } = {};

const deConforto = new Set<string>(AREAS.flatMap((a) => MATRIZ[a].conforto));
const SILENCIOSO = { via_intensa: false, noturno_obra_100m: false, aviao_ferrovia: false, isolamento_acustico: false, classe: "baixo" };

async function itensComFoto(propertyId: string, chaves: readonly string[]) {
  const { error } = await adm()
    .from("nivel_itens")
    .upsert(chaves.map((chave) => ({ property_id: propertyId, chave, declarado: true, foto_path: `${ids.dono}/${randomUUID()}.webp`, foto_status: "aceita" })), { onConflict: "property_id,chave" });
  if (error) throw error;
}
async function medidas(propertyId: string, trabalhoBoa: boolean) {
  const valido = new Date(Date.now() + 150 * 86_400_000).toISOString();
  const linha = (ponto: string, boa: boolean) => ({ property_id: propertyId, user_id: ids.dono, papel: "dono", download_mbps: boa ? 300 : 20, upload_mbps: boa ? 100 : 5, latencia_ms: boa ? 12 : 90, validada: true, origem: "edicao", valido_ate: valido, ponto });
  const { error } = await adm().from("internet_medicoes").insert([linha("quarto_principal", true), linha("trabalho", trabalhoBoa)]);
  if (error) throw error;
}
async function nivelGravado(id: string): Promise<string | null> {
  return ((await adm().from("imovel_nivel").select("nivel").eq("property_id", id).maybeSingle()).data?.nivel as string | undefined) ?? null;
}
async function paginaNivel(page: Page, id: string, esperado: string) {
  await page.goto(`/dashboard/imoveis/${id}/nivel`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("nivel-atual")).toHaveAttribute("data-nivel", esperado, { timeout: 20_000 });
}
async function semRolagemLateral(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra, "sem rolagem lateral").toBeLessThanOrEqual(1);
}
async function admin(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
  return ctx.newPage();
}

test.describe("T293 — Adendo 59.1: níveis Essencial / Conforto / Premium", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inquilino = await criarConta(inquilino, senha);
    await definirPlano(ids.dono, "pro");
    ids.e = await criarImovelPronto(ids.dono, T.e, { ativo: true });
    ids.c = await criarImovelPronto(ids.dono, T.c, { ativo: true });
    ids.p = await criarImovelPronto(ids.dono, T.p, { ativo: true });
    // Conforto: os itens de Conforto com foto, as duas medidas (trabalho sem videochamada) e ruído baixo.
    await itensComFoto(ids.c, CHAVES_NIVEL_FOTO.filter((k) => deConforto.has(k)));
    await medidas(ids.c, false);
    // Premium: todos os itens com foto, as duas medidas boas e ruído baixo; dois extras.
    await itensComFoto(ids.p, CHAVES_NIVEL_FOTO);
    await medidas(ids.p, true);
    const { error: eR } = await adm().from("imovel_ruido").insert([{ property_id: ids.c, ...SILENCIOSO }, { property_id: ids.p, ...SILENCIOSO }]);
    if (eR) throw eR;
    await adm().from("imovel_extras").insert([{ property_id: ids.p, chave: "air_fryer" }, { property_id: ids.p, chave: "cafeteira" }]);
    // Contrato vigente no Premium (conferência de entrada do caso 4).
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

  test("1. os três anúncios no nível certo; item sem foto não conta; a foto pelo upload entra em análise", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await paginaNivel(page, ids.e!, "essencial");
    await paginaNivel(page, ids.c!, "conforto");
    await expect(page.getByTestId("nivel-area-trabalho")).toHaveAttribute("data-nivel", "conforto");
    await paginaNivel(page, ids.p!, "premium");
    await semRolagemLateral(page);
    await page.screenshot({ path: "tests/laboratorio/saida/t293-1-premium-390.png", fullPage: true });

    // No Essencial: declarar sem foto é recusado; com a foto enviada pelo upload, o item fica "em análise".
    await paginaNivel(page, ids.e!, "essencial");
    const item: ChaveNivel = "ar_quarto_principal";
    await page.getByTestId(`nivel-tenho-${item}`).check();
    await expect(page.getByTestId(`nivel-msg-${item}`)).toContainText("Envie a foto", { timeout: 20_000 });
    await page.getByTestId(`nivel-foto-${item}`).setInputFiles({ name: "ar.png", mimeType: "image/png", buffer: pngDeTeste(3) });
    await expect(page.getByTestId(`nivel-status-${item}`)).toHaveText("Foto em análise", { timeout: 30_000 });
    const { data: linha } = await adm().from("nivel_itens").select("declarado, foto_status, foto_path").eq("property_id", ids.e!).eq("chave", item).single();
    expect(linha).toMatchObject({ declarado: true, foto_status: "pendente" });
    expect(String(linha?.foto_path)).toMatch(new RegExp(`^${ids.dono}/[0-9a-f-]{36}\\.webp$`));
    // Um item só não muda o nível (elo mais fraco).
    await paginaNivel(page, ids.e!, "essencial");
    await page.context().close();
  });

  test("2. elo mais fraco: o Premium sem o ar da sala vira Conforto; ao repor, volta a Premium", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await paginaNivel(page, ids.p!, "premium");
    await page.getByTestId("nivel-tenho-ar_sala").uncheck();
    await expect(page.getByTestId("nivel-atual")).toHaveAttribute("data-nivel", "conforto", { timeout: 20_000 });
    await expect(page.getByTestId("nivel-area-clima")).toHaveAttribute("data-nivel", "conforto");
    await expect(page.getByTestId("nivel-area-sono")).toHaveAttribute("data-nivel", "premium");
    expect(await nivelGravado(ids.p!)).toBe("conforto");
    await page.getByTestId("nivel-tenho-ar_sala").check();
    await expect(page.getByTestId("nivel-atual")).toHaveAttribute("data-nivel", "premium", { timeout: 20_000 });
    expect(await nivelGravado(ids.p!)).toBe("premium");
    await page.context().close();
  });

  test("3. foto recusada pelo atendimento tira o item (Premium → Conforto); foto nova volta a Premium", async ({ browser }) => {
    const a = await admin(browser);
    await a.goto("/admin/pendencias?filtro=fotos_nivel", { waitUntil: "domcontentloaded" });
    const linha = a.getByTestId("central-linha").filter({ hasText: T.p }).filter({ has: a.locator('[data-chave="ar_todos_quartos"]') });
    // As fotos do Premium vieram aceitas; a do caso 1 está em análise. Volta uma do Premium para análise e recarrega.
    await adm().from("nivel_itens").update({ foto_status: "pendente" }).eq("property_id", ids.p!).eq("chave", "ar_todos_quartos");
    await a.reload({ waitUntil: "domcontentloaded" });
    await expect(linha).toHaveCount(1, { timeout: 20_000 });
    await linha.getByTestId("foto-nivel-recusar").click();
    await linha.getByTestId("foto-nivel-motivo").fill("Não mostra o aparelho do quarto 2.");
    await linha.getByTestId("foto-nivel-confirmar-recusa").click();
    await expect.poll(() => nivelGravado(ids.p!), { timeout: 20_000 }).toBe("conforto");
    await a.context().close();

    const page = await entrar(browser, dono.email, senha);
    await paginaNivel(page, ids.p!, "conforto");
    await expect(page.getByTestId("nivel-status-ar_todos_quartos")).toContainText("Foto recusada: Não mostra o aparelho do quarto 2.");
    // O painel do dono espelha a pendência.
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(`Envie outra foto de "Ar-condicionado em todos os quartos" em ${T.p}`).first()).toBeVisible({ timeout: 20_000 });
    await page.goto(`/dashboard/imoveis/${ids.p}/nivel`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("nivel-foto-ar_todos_quartos").setInputFiles({ name: "ar2.png", mimeType: "image/png", buffer: pngDeTeste(5) });
    await expect(page.getByTestId("nivel-status-ar_todos_quartos")).toHaveText("Foto em análise", { timeout: 30_000 });
    await expect(page.getByTestId("nivel-atual")).toHaveAttribute("data-nivel", "premium", { timeout: 20_000 });
    await page.context().close();
  });

  test("4. 'não confere' no ar-condicionado dos quartos → Conforto; o dono corrige com foto → volta a Premium", async ({ browser }) => {
    const morador = await entrar(browser, inquilino.email, senha);
    await morador.goto(`/dashboard/locacoes/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    const form = morador.getByTestId("conforto-entrada-form");
    await expect(form).toBeVisible({ timeout: 30_000 });
    // A seção traz os itens do nível (Premium) e a pergunta do ruído, depois dos 12 do mínimo.
    await expect(morador.getByTestId("conforto-nao-confere-ar_todos_quartos")).toBeVisible();
    await expect(morador.getByTestId("conforto-confere-ruido_controlado")).toBeVisible();
    for (const r of await morador.locator('[data-testid^="conforto-confere-"]').all()) await r.check();
    await morador.getByTestId("conforto-nao-confere-ar_todos_quartos").check();
    await morador.getByTestId("conforto-texto-ar_todos_quartos").fill("O quarto 2 não tem ar-condicionado.");
    await morador.getByTestId("conforto-entrada-enviar").click();
    await expect(morador.getByTestId("conforto-entrada-respondida")).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => nivelGravado(ids.p!), { timeout: 20_000 }).toBe("conforto");
    await semRolagemLateral(morador);
    await morador.context().close();

    const donoPg = await entrar(browser, dono.email, senha);
    await donoPg.goto(`/dashboard/contratos/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    const pend = donoPg.locator('[data-testid="pendencia-conforto"][data-chave="ar_todos_quartos"]');
    await expect(pend).toHaveAttribute("data-status", "aberta", { timeout: 20_000 });
    await pend.getByTestId("pendencia-foto-corrigido").setInputFiles({ name: "ar3.png", mimeType: "image/png", buffer: pngDeTeste(7) });
    await expect(pend).toHaveAttribute("data-status", "corrigida", { timeout: 30_000 });
    await expect.poll(() => nivelGravado(ids.p!), { timeout: 20_000 }).toBe("premium");
    const { data: item } = await adm().from("nivel_itens").select("foto_status, foto_path").eq("property_id", ids.p!).eq("chave", "ar_todos_quartos").single();
    expect(item?.foto_status).toBe("pendente");
    await donoPg.context().close();
  });

  test("5. filtro 'a partir de Conforto' mostra o Conforto e o Premium, não o Essencial", async ({ page }) => {
    await page.goto("/buscar?nivel=conforto", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(T.c).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(T.p).first()).toBeVisible();
    await expect(page.getByText(T.e)).toHaveCount(0);
    expect(page.url()).toMatch(/nivel=conforto/);
    await page.goto("/buscar?nivel=premium", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(T.p).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(T.c)).toHaveCount(0);
  });
});
