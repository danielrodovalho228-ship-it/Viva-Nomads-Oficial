import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, pngDeTeste } from "../fixtures/laboratorio";

/*
  T389 — DETECTA-B: o que as fotos da galeria mostram, como SUGESTÃO. Só no laboratório (resposta fixa, nada sai).
  A galeria tem 4 fotos: a 1ª mostra micro-ondas e máquina de lavar (e uma chave inventada, descartada); a 2ª tem uma
  pessoa; a 3ª devolve JSON inválido; a 4ª, nada.
   1. Chave desligada (sem o cookie do laboratório): o passo Comodidades fica como hoje e nenhuma foto é analisada.
   2. Ligada: as sugestões aparecem (micro-ondas, máquina de lavar), a chave inventada não; o aviso "Foto com pessoa
      não serve de prova"; o nível NÃO muda e nenhum item é gravado; o micro-ondas sai do "o que falta"; a JSON
      inválida não quebra a tela.
   3. Cache: voltar ao passo não analisa de novo (as mesmas 4 linhas, mesmas datas).
   4. Confirmar: o micro-ondas vai pelo salvarItemNivel (foto da galeria, "em análise"); a máquina de lavar é marcada
      nas comodidades do anúncio pelo salvar de sempre.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.detecta.${sufixo}@lab.vivanomads.test`, nome: "Dora Detecta", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};
const caminhos: string[] = [];
const LARGURAS = [390, 1280] as const;

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
async function ligarNoLaboratorio(page: Page) {
  await page.context().addCookies([{ name: "vn_lab_deteccao", value: "1", url: new URL(page.url()).origin }]);
}
const passo = (page: Page) => page.goto(`/dashboard/imoveis/novo?draft=${ids.imovel}&etapa=comodidades`, { waitUntil: "domcontentloaded" });
async function analises() {
  const { data } = await adm().from("deteccao_fotos_analises").select("caminho, pessoa, valida, analisada_em").eq("property_id", ids.imovel!).order("caminho");
  return data ?? [];
}

test.describe("T389 — DETECTA-B: sugestões a partir das fotos", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio Detecta ${sufixo}`);
    // Galeria com caminhos no formato do envio de hoje (dono/uuid.webp), que o item de nível aceita.
    for (let i = 0; i < 4; i++) {
      const c = `${ids.dono}/${randomUUID()}.webp`;
      const { error } = await adm().storage.from("property-photos").upload(c, pngDeTeste(i), { contentType: "image/png", upsert: true });
      if (error) throw error;
      caminhos.push(c);
    }
    // Endereço https (a regra do editor só guarda https na pasta do dono; o Supabase local é http) — o mesmo da
    // fixture criarImovelPronto. O rascunho leva as mesmas fotos: o autosave do cadastro regrava a galeria a partir dele.
    const urls = caminhos.map((c) => `https://lab.vivanomads.test/storage/v1/object/public/property-photos/${c}`);
    await adm().from("property_photos").delete().eq("property_id", ids.imovel);
    const { error } = await adm()
      .from("property_photos")
      .insert(urls.map((url, i) => ({ property_id: ids.imovel, url, sort_order: i })));
    if (error) throw error;
    const { error: eRasc } = await adm()
      .from("properties")
      .update({ draft_data: { title: `Studio Detecta ${sufixo}`, city: "Uberlândia", photos: urls.map((url) => ({ url })), amenityKeys: {} } })
      .eq("id", ids.imovel);
    if (eRasc) throw eRasc;
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1. desligada: o passo fica como hoje e nenhuma foto é analisada", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await passo(page);
    await expect(page.getByTestId("nivel-cadastro-agora")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    await expect(page.getByTestId("deteccao-fotos")).toHaveCount(0);
    expect(await analises()).toHaveLength(0);
    await page.context().close();
  });

  test("2. ligada: sugestões, aviso de pessoa, nível igual e o micro-ondas fora do 'o que falta'", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await ligarNoLaboratorio(page);
    for (const w of LARGURAS) {
      await largura(page, w);
      await passo(page);
      const bloco = page.getByTestId("deteccao-fotos");
      await expect(bloco.getByTestId("deteccao-sugestao-cozinha_microondas")).toBeVisible({ timeout: 30_000 });
      await expect(bloco.getByTestId("deteccao-sugestao-cozinha_microondas")).toContainText("Micro-ondas");
      await expect(bloco.getByTestId("deteccao-sugestao-cozinha_microondas")).toContainText("93%");
      await expect(bloco.getByTestId("deteccao-sugestao-maquina_lavar")).toHaveAttribute("data-tipo", "comodidade");
      await expect(bloco.getByTestId("deteccao-sugestao-piscina_aquecida")).toHaveCount(0);
      await expect(bloco.getByTestId("deteccao-sugestao-sala_assentos")).toHaveCount(0);
      await expect(bloco.getByTestId("deteccao-pessoa")).toContainText("Foto com pessoa não serve de prova");
      // Sugestão não conta: o nível segue Essencial e o micro-ondas sai do "o que falta"; a sala (foto com pessoa) fica.
      await expect(page.getByTestId("nivel-cadastro-agora")).toHaveAttribute("data-nivel", "essencial");
      await expect(page.getByTestId("nivel-cadastro-item-cozinha_microondas")).toHaveCount(0);
      await expect(page.getByTestId("nivel-cadastro-item-sala_assentos")).toBeVisible();
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sobra, "sem rolagem lateral").toBeLessThanOrEqual(1);
      await bloco.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `tests/laboratorio/saida/t389-2-sugestoes-${w}.png`, fullPage: true });
    }
    const a = await analises();
    expect(a).toHaveLength(4);
    expect(a.filter((x) => x.pessoa)).toHaveLength(1);
    expect(a.filter((x) => !x.valida)).toHaveLength(1);
    const { data: itens } = await adm().from("nivel_itens").select("chave").eq("property_id", ids.imovel!);
    expect(itens ?? []).toHaveLength(0);
    await page.context().close();
  });

  test("3. cache: voltar ao passo não analisa de novo", async ({ browser }) => {
    const antes = await analises();
    const page = await entrar(browser, dono.email, senha);
    await ligarNoLaboratorio(page);
    await passo(page);
    await expect(page.getByTestId("deteccao-sugestao-cozinha_microondas")).toBeVisible({ timeout: 30_000 });
    expect(await analises()).toEqual(antes);
    await page.context().close();
  });

  test("4. confirmar: item de nível pelo caminho de hoje; comodidade pelo salvar do anúncio", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await ligarNoLaboratorio(page);
    await passo(page);
    await page.getByTestId("deteccao-confirmar-cozinha_microondas").click({ timeout: 30_000 });
    await expect(page.getByTestId("deteccao-msg")).toContainText('Foto de "Micro-ondas" enviada', { timeout: 30_000 });
    const { data: item } = await adm().from("nivel_itens").select("declarado, foto_path, foto_status").eq("property_id", ids.imovel!).eq("chave", "cozinha_microondas").single();
    expect(item).toMatchObject({ declarado: true, foto_path: caminhos[0], foto_status: "pendente" });
    await expect(page.getByTestId("deteccao-sugestao-cozinha_microondas")).toHaveCount(0);

    await page.getByTestId("deteccao-confirmar-maquina_lavar").click();
    await expect(page.getByTestId("deteccao-msg")).toContainText('"Máquina de lavar" marcada nas comodidades');
    await expect(page.getByTestId("deteccao-sugestao-maquina_lavar")).toHaveCount(0);
    await expect
      .poll(async () => {
        const { data } = await adm().from("properties").select("draft_data").eq("id", ids.imovel!).single();
        const k = (data?.draft_data as { amenityKeys?: Record<string, boolean> } | null)?.amenityKeys ?? {};
        return k.maquina_lavar === true;
      }, { timeout: 30_000 })
      .toBe(true);
    const { data: sug } = await adm().from("deteccao_sugestoes").select("chave, status").eq("property_id", ids.imovel!).order("chave");
    expect(sug).toEqual(
      expect.arrayContaining([
        { chave: "cozinha_microondas", status: "aceita" },
        { chave: "maquina_lavar", status: "aceita" },
        { chave: "sala_assentos", status: "descartada" },
      ]),
    );
    await page.screenshot({ path: "tests/laboratorio/saida/t389-4-confirmado-1280.png", fullPage: true });
    await page.context().close();
  });
});
