import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, aceitarTermoIaSePreciso, adm, apagarContas, criarConta, entrar, fotosReais, novaSenha, novoSufixo, pngDeTeste } from "../fixtures/laboratorio";
import { abrirSecoesPasso10, noPasso } from "../fixtures/cadastro";
import { emDiasBR } from "../fixtures/rascunho-cadastro";
import { codigoDoImovel } from "../../../src/lib/imovel-pagina";
import { CHAVES_CONFORTO, VERSAO_CONFORTO } from "../../../src/config/conforto-minimo";

/*
  T717 — E273/E275 (#1611): a massa de QA "rascunho publicável" (migração 0264, receita em
  docs/qa-receita-rascunho-publicavel.md) nasce 100% publicável pelo editor e cada anúncio tem o seu código público.
  A 0264 é um NO-OP no laboratório: ela só age com a conta proprietario1@vivanomads.com.br marcada is_teste, um documento
  aprovado de anúncio de teste dela e as 8 fotos do anúncio da 0259 — nada disso existe no Supabase local (o caso 0
  registra o que achou). Por isso esta spec REPRODUZ A RECEITA com massa descartável: uma conta de teste e dois
  rascunhos com os MESMOS campos que a 0264 grava (draft_data E colunas, conforto lido da própria migração, qualificação
  com documento aprovado), mudando só o que o laboratório exige:
    • fotos: os 8 PNGs no Storage local, com o endereço https na pasta do dono no draft_data (o editor só aceita https;
      o Supabase local é http — como a t693); a página pública recebe os endereços reais (fotosReais) depois;
    • o documento aprovado: um PNG no bucket property-docs deste dono (a 0264 reaproveita o de outro anúncio de teste);
    • "disponível a partir de": daqui a 10 dias (a 0264 fixa 01/11/2026, que envelhece);
    • os ids: UUID aleatório, sorteados até os 6 primeiros caracteres diferirem (E275 — a 0264 usa a0264a00/a0264b00).
  Nada é preenchido na tela: o dono só abre o Passo 10, aceita o termo da IA (o aceite é da pessoa, fora da massa, como
  diz a receita) e publica.
    0. A 0264 no laboratório: os ids fixos dela (presentes ou não) e os códigos VN-A0264A/VN-A0264B diferentes.
    1. Lista de rascunhos (1280): os dois mostram "100% · Pronto para publicar", sem "Falta para publicar".
    2–3. Rascunho A e B (1280): Passo 10 sem nada faltando (lista de conferência "Tudo certo para publicar", 0 pendentes,
       nenhuma seção "falta", sem motivo de trava) → "Publicar anúncio" → o anúncio fica "active".
    4. Páginas públicas (390): cada uma mostra "Código VN-…" do próprio id, e nunca o código da outra.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t717.${sufixo}@lab.vivanomads.test`, nome: "Muse Receita Sobrenome", role: "owner" as const };
const IDS_0264 = ["a0264a00-0000-4000-8000-000000000001", "a0264b00-0000-4000-8000-000000000001"];
const RASCUNHOS = [
  { letra: "A", numero: "210" },
  { letra: "B", numero: "230" },
] as const;
const titulo = (letra: string) => `[TESTE QA] Publicável t717 ${letra} ${sufixo}`;
const ids: { dono?: string; imoveis: string[] } = { imoveis: [] };
const disponivel = emDiasBR(10);

/** Os 12 itens do padrão mínimo exatamente como a 0264 grava (lidos da migração). */
function confortoDa0264(): string[] {
  const sql = readFileSync("supabase/migrations/0264_qa_rascunhos_publicaveis.sql", "utf8");
  return /c_conforto constant text\[\] := array\[([\s\S]*?)\];/.exec(sql)![1].match(/'([a-z_]+)'/g)!.map((s) => s.slice(1, -1));
}

/** E275: ids cujo código público (6 primeiros caracteres) difere. */
function idsComCodigosProprios(n: number): string[] {
  const out: string[] = [];
  while (out.length < n) {
    const id = randomUUID();
    if (!out.some((x) => codigoDoImovel(x) === codigoDoImovel(id))) out.push(id);
  }
  return out;
}

/** O rascunho da receita 0264 (draft_data + colunas + fotos + conforto + qualificação aprovada). */
async function rascunhoDaReceita(id: string, letra: string, numero: string, documento: { caminho: string; hash: string; enviadoEm: string }) {
  const t = titulo(letra);
  const fotos: { id: string; url: string; path: string; name: string; demo: boolean }[] = [];
  for (let i = 0; i < 8; i++) {
    const caminho = `${ids.dono}/${id}-${i}.png`;
    const { error } = await adm().storage.from("property-photos").upload(caminho, pngDeTeste(i), { contentType: "image/png", upsert: true });
    if (error) throw error;
    fotos.push({ id: `lab-${i}`, url: `https://lab.vivanomads.test/storage/v1/object/public/property-photos/${caminho}`, path: caminho, name: "", demo: false });
  }
  const descricao =
    "Apartamento mobiliado de 2 quartos no Santa Mônica para estadias de 30 a 180 dias, com home office, internet de 300 Mbps, cozinha completa e portaria. Anúncio de teste do QA.";
  const dados = {
    title: t, propertyType: "apartamento", city: "Uberlândia", uf: "MG", neighborhood: "Santa Mônica",
    street: "Avenida Ana Godoy de Sousa", numero, complemento: "", cep: "38408-290",
    bedrooms: "2", bathrooms: "1", maxGuests: "4", areaM2: "62", parkingSpots: "1", internetMbps: "300",
    monthlyPrice: "3200", utilitiesMode: "fixed", utilitiesEstimate: 150, prepFee: 0, condoFee: "",
    minPeriod: "30", maxPeriod: "180", availableFrom: disponivel, availableUntil: "",
    faixas: { temporada: false, media_estadia: true },
    garantias: { caucao_avista: true, caucao_parcelada: false, seguro_fianca: false },
    negociacao: { aceita: false, itens: [], descontos: [] },
    furnished: true, petsOk: false, smokingAllowed: false, childrenAllowed: true, issuesInvoice: false,
    ownershipType: "own", subleaseAuthorized: false, subleaseDoc: [], subleaseDocTipo: "",
    privacidade: { tipoAcesso: "porteiro", camerasExternas: "", semCamerasInterior: true, senhaTrocadaEstadia: false },
    // L-79: a 0264 não grava `tipoEntrada` (a resposta do Passo 6 desde o E259-2); a réplica põe, para provar o resto da
    // receita. O caso "0b" cobra o campo do próprio arquivo da migração.
    tipoEntrada: "porteiro",
    declaracoesPasso10: { iptuOk: true, habitavel: true, convencao: "yes" },
    qualificacaoConforto: { status: "pulada", respostas: {} },
    description: descricao,
    photos: fotos,
  };
  const { error: eProp } = await adm().from("properties").insert({
    id, owner_id: ids.dono, status: "draft", title: t, description: descricao, property_type: "apartamento", city: "Uberlândia", state: "MG",
    address: "Santa Mônica", exact_address: `Avenida Ana Godoy de Sousa, ${numero}`, cep_proximidades: "38408290",
    lat: -18.909872, lng: -48.259454, lat_exata: -18.9113, lng_exata: -48.2622, bedrooms: 2, bathrooms: 1, max_guests: 4, area_m2: 62,
    parking_spots: 1, monthly_price: 3200, utilities_mode: "fixed", utilities_estimate: 150, min_period_days: 30, max_period_days: 180,
    available_from: disponivel, faixas_aceitas: ["media_estadia"], garantias_aceitas: ["caucao_avista"], internet_mbps: 300, tipo_entrada: "porteiro",
    sem_cameras_interior: true, furnished: true, ownership_type: "own", draft_data: dados,
  });
  if (eProp) throw eProp;
  const { error: eFotos } = await adm().from("property_photos").insert(fotos.map((f, i) => ({ property_id: id, url: f.url, sort_order: i })));
  if (eFotos) throw eFotos;
  const agora = new Date().toISOString();
  const { error: eConf } = await adm()
    .from("conforto_declaracoes")
    .insert(confortoDa0264().map((chave) => ({ property_id: id, chave, confirmado: true, confirmado_por: ids.dono, confirmado_em: agora, versao_lista: 2 })));
  if (eConf) throw eConf;
  const { error: eQ } = await adm().from("qualification_checklists").insert({
    owner_id: ids.dono, property_id: id, document_path: documento.caminho, document_hash_sha256: documento.hash, document_uploaded_at: documento.enviadoEm,
    document_status: "approved", document_reviewed_at: agora, status: "pending",
  });
  if (eQ) throw eQ;
}

async function publicarDoPasso10(page: Page, id: string, letra: string) {
  await page.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=revisao`, { waitUntil: "domcontentloaded" });
  await noPasso(page, "revisao", 30_000);
  // Nada a fazer nos passos 1–9: a lista de conferência já vem toda feita.
  const lista = page.getByTestId("lista-conferencia");
  await expect(lista).toBeVisible({ timeout: 20_000 });
  // Se algo faltar, o erro diz o quê (a 1ª rodada no lab só viu data-faltam="1").
  await expect
    .poll(async () => lista.locator('[data-ok="0"]').evaluateAll((els) => els.map((e) => `${e.getAttribute("data-testid")}: ${(e.textContent ?? "").replace(/\s+/g, " ").trim()}`)), { timeout: 20_000, message: `rascunho ${letra}: itens que faltam` })
    .toEqual([]);
  await expect(lista).toHaveAttribute("data-faltam", "0");
  await expect(lista.getByRole("heading", { name: "Tudo certo para publicar" })).toBeVisible();
  await expect(lista.locator('[data-ok="0"]')).toHaveCount(0);
  await expect(lista.getByText(/^Falta:/)).toHaveCount(0);
  // As seções do Passo 10 (quem opera, identidade, documento, declarações): nenhuma "falta"; o documento aprovado.
  await abrirSecoesPasso10(page);
  await expect(page.getByTestId("documento-estado")).toHaveAttribute("data-estado", "aprovado", { timeout: 30_000 });
  await expect(page.getByTestId("antes-de-publicar").locator('li[data-estado="falta"]')).toHaveCount(0);
  await expect(page.getByTestId("antes-de-publicar").getByTestId("sinal-falta")).toHaveCount(0);
  await page.screenshot({ path: `${SAIDA}/t717-passo10-${letra}-1280.png`, fullPage: true });
  // O único gesto da pessoa: o termo da IA (fora da massa, como diz a receita). Depois, nada trava.
  await aceitarTermoIaSePreciso(page);
  const publicar = page.getByTestId("publicar-anuncio");
  await expect(publicar).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByTestId("publicar-motivo")).toHaveCount(0);
  await publicar.click();
  await expect
    .poll(
      async () => {
        if (new URL(page.url()).pathname === "/dashboard/imoveis") return "publicou";
        const motivos = (await page.locator("p.text-red-600, [data-testid=publicar-motivo]").allTextContents()).map((t) => t.trim()).filter(Boolean);
        return motivos.length ? `recusou: ${motivos.join(" | ")}` : "esperando";
      },
      { timeout: 45_000, intervals: [1_000] },
    )
    .toBe("publicou");
  const { data } = await adm().from("properties").select("status, title").eq("id", id).single();
  expect(data).toMatchObject({ status: "active", title: titulo(letra) });
}

test.describe("T717 — E273/E275: rascunho da receita 0264 publica sem nada faltando e cada anúncio tem o seu código público", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (integrações simuladas).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true, preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    // Um arquivo aprovado no bucket do dono (a 0264 reaproveita o de um anúncio de teste do mesmo dono, nos dois).
    const caminho = `${ids.dono}/${randomBytes(6).toString("hex")}.png`;
    const { error: eUp } = await adm().storage.from("property-docs").upload(caminho, pngDeTeste(7), { contentType: "image/png" });
    if (eUp) throw eUp;
    const documento = { caminho, hash: randomBytes(32).toString("hex"), enviadoEm: new Date().toISOString() };
    ids.imoveis = idsComCodigosProprios(2);
    for (const [n, r] of RASCUNHOS.entries()) await rascunhoDaReceita(ids.imoveis[n], r.letra, r.numero, documento);
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("0. a 0264 no laboratório (no-op sem a conta proprietario1) e os códigos fixos dela diferentes", async () => {
    // O padrão mínimo da 0264 é a lista vigente (v2, 12 itens): a receita reproduzida aqui é a mesma da tela.
    expect(VERSAO_CONFORTO).toBe(2);
    expect([...confortoDa0264()].sort()).toEqual([...CHAVES_CONFORTO].sort());
    // E275: os ids fixos da 0264 dão códigos diferentes (a 0263 repetia VN-A02630).
    expect(IDS_0264.map(codigoDoImovel)).toEqual(["VN-A0264A", "VN-A0264B"]);
    const { data } = await adm().from("properties").select("id, status, owner_id").in("id", IDS_0264);
    test.info().annotations.push({ type: "0264", description: data?.length ? `massa presente no laboratório: ${JSON.stringify(data)}` : "no-op no laboratório (sem a conta proprietario1 de teste)" });
    // Se existir, nunca nasce publicada (o QA publica pela tela).
    for (const r of data ?? []) expect(["draft", "active"]).toContain(r.status);
    // A massa desta spec: dois códigos diferentes.
    expect(codigoDoImovel(ids.imoveis[0])).not.toBe(codigoDoImovel(ids.imoveis[1]));
  });

  test("0b. a receita da 0264 grava a resposta do Passo 6 (draft_data.tipoEntrada), que o assistente lê", async () => {
    // L-79 (Pista C, 30/10; fonte: lab-crítico 41111750706 — "Regras — falta: Tipo de entrada" no Passo 10 da receita):
    // a 0264 grava só privacidade.tipoAcesso e a coluna tipo_entrada (0264_qa_rascunhos_publicaveis.sql:87/95); o
    // assistente lê draft_data.tipoEntrada (formDeRascunho, chegada-e-pedido-campos.tsx:147). Vira verde quando a
    // migração (e o docs/qa-receita-rascunho-publicavel.md) passarem a gravar 'tipoEntrada'.
    test.fail(true, "L-79: rascunhos da 0264 não trazem draft_data.tipoEntrada e o Passo 10 acusa 'Tipo de entrada'");
    const sql = readFileSync("supabase/migrations/0264_qa_rascunhos_publicaveis.sql", "utf8");
    const dados = sql.slice(sql.indexOf("v_dados := jsonb_build_object("), sql.indexOf("insert into public.properties"));
    expect(dados).toMatch(/'tipoEntrada',\s*'[a-z_]+'/);
  });

  test("1. 1280 px — a lista de rascunhos mostra os dois 100% prontos para publicar", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    for (const r of RASCUNHOS) {
      const cartao = page.locator("div").filter({ hasText: titulo(r.letra) }).filter({ has: page.getByTestId("prontidao") }).last();
      await expect(cartao.getByTestId("prontidao")).toContainText("100% · Pronto para publicar", { timeout: 30_000 });
      await expect(cartao.getByTestId("prontidao")).not.toContainText("Falta para publicar");
    }
    await page.screenshot({ path: `${SAIDA}/t717-rascunhos-1280.png`, fullPage: true });
    await page.context().close();
  });

  for (const [n, r] of RASCUNHOS.entries()) {
    test(`${n + 2}. 1280 px — rascunho ${r.letra}: Passo 10 sem nada faltando e "Publicar anúncio" põe no ar`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: 1280, height: 900 });
      await publicarDoPasso10(page, ids.imoveis[n], r.letra);
      await page.context().close();
    });
  }

  test("4. 390 px — cada página pública mostra o código do próprio id, nunca o da outra", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: { cookies: [], origins: [] } });
    const p = await ctx.newPage();
    for (const [n, r] of RASCUNHOS.entries()) {
      const id = ids.imoveis[n];
      const outro = ids.imoveis[1 - n];
      await fotosReais(id, ids.dono!);
      await p.goto(`/imoveis/${id}`, { waitUntil: "domcontentloaded" });
      await expect(p.getByRole("heading", { level: 1 })).toHaveText(titulo(r.letra), { timeout: 20_000 });
      const sinais = p.getByTestId("sinais-confianca");
      await expect(sinais).toContainText(`Código ${codigoDoImovel(id)}`);
      await expect(p.getByText(`Código ${codigoDoImovel(outro)}`)).toHaveCount(0);
      await p.screenshot({ path: `${SAIDA}/t717-publico-${r.letra}-390.png`, fullPage: false });
    }
    await ctx.close();
  });
});
