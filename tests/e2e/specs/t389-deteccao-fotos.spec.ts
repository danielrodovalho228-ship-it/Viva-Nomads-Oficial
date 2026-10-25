import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, pngDeTeste } from "../fixtures/laboratorio";
import { celularComCamera, fotografarEUsar } from "../fixtures/camera";

/*
  T389 — DETECTA-B: o que as fotos da galeria mostram, como SUGESTÃO. Só no laboratório (resposta fixa, nada sai).
  A galeria tem 4 fotos: a 1ª mostra micro-ondas e máquina de lavar (e uma chave inventada, descartada); a 2ª tem uma
  pessoa; a 3ª devolve JSON inválido; a 4ª, nada.
   1. Chave desligada (sem o cookie do laboratório): o passo Comodidades fica como hoje e nenhuma foto é analisada.
   2. Ligada: as sugestões aparecem (micro-ondas, máquina de lavar), a chave inventada não; o aviso "Foto com pessoa
      não serve de prova"; o nível NÃO muda e nenhum item é gravado; o micro-ondas sai do "o que falta"; a JSON
      inválida não quebra a tela.
   3. Cache: voltar ao passo não analisa de novo (as mesmas 4 linhas, mesmas datas).
   4. FOTO-NA-HORA-B: a foto da galeria NÃO vira prova. "Parece que você tem isto: fotografe agora para comprovar" →
      "Fotografar pelo celular" (no computador) confirma a sugestão como "Confirmada, falta a foto" e o item NÃO conta
      (nada em nivel_itens); a miniatura fica só como referência. No celular, "Fotografar agora" → câmera → o item conta
      com a foto feita na hora (outra, não a da galeria) e a sugestão fecha. A máquina de lavar (comodidade) segue
      marcada pelo salvar de sempre.
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

  test("4. item de nível: a foto da galeria não vira prova; confirmar abre a câmera e só a foto feita na hora conta", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await ligarNoLaboratorio(page);
    await largura(page, 1280);
    await passo(page);
    const linha = page.getByTestId("deteccao-sugestao-cozinha_microondas");
    await expect(linha.getByTestId("deteccao-texto-cozinha_microondas")).toHaveText("Parece que você tem isto: fotografe agora para comprovar", { timeout: 30_000 });
    // E142: a explicação vem uma vez, no topo do bloco; cada sugestão diz de onde veio.
    await expect(page.getByTestId("deteccao-referencia")).toHaveText("As fotos do anúncio servem de pista, não de prova: para subir de nível, a foto de cada item é feita na hora.");
    await expect(linha.getByTestId("deteccao-origem-cozinha_microondas")).toHaveText("Da sua galeria");
    await expect(linha.getByTestId("deteccao-confirmar-cozinha_microondas")).toHaveCount(0);
    const botao = linha.getByTestId("deteccao-fotografar-cozinha_microondas-botao");
    await expect(botao).toHaveText("Fotografar pelo celular");
    await botao.click();
    await expect(page.getByTestId("prova-celular-cozinha_microondas")).toBeVisible({ timeout: 20_000 });
    await expect(linha.getByTestId("deteccao-texto-cozinha_microondas")).toHaveText("Confirmada, falta a foto");
    // Confirmada sem foto: não conta (nada gravado em nivel_itens; a foto da galeria nunca vira prova).
    await expect
      .poll(async () => (await adm().from("deteccao_sugestoes").select("status").eq("property_id", ids.imovel!).eq("chave", "cozinha_microondas").limit(1).single()).data?.status, { timeout: 20_000 })
      .toBe("confirmada_sem_foto");
    expect((await adm().from("nivel_itens").select("chave").eq("property_id", ids.imovel!).eq("chave", "cozinha_microondas")).data ?? []).toHaveLength(0);
    await expect(page.getByTestId("nivel-cadastro-agora")).toHaveAttribute("data-nivel", "essencial");

    // A comodidade segue como antes: marcada pelo salvar do anúncio.
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
    await page.screenshot({ path: "tests/laboratorio/saida/t389-4-falta-a-foto-1280.png", fullPage: true });
    await page.context().close();

    // No celular: "Fotografar agora" → câmera → a foto feita na hora conta; a sugestão fecha.
    const cel = await celularComCamera({ email: dono.email, senha });
    try {
      await ligarNoLaboratorio(cel.page);
      await passo(cel.page);
      const noCel = cel.page.getByTestId("deteccao-sugestao-cozinha_microondas");
      await expect(noCel).toHaveAttribute("data-status", "confirmada_sem_foto", { timeout: 30_000 });
      await expect(noCel.getByTestId("deteccao-fotografar-cozinha_microondas-botao")).toHaveText("Fotografar agora");
      await noCel.getByTestId("deteccao-fotografar-cozinha_microondas-botao").click();
      await fotografarEUsar(cel.page);
      await expect(cel.page.getByTestId("deteccao-msg")).toHaveText("Foto de Micro-ondas recebida. O item já conta enquanto a foto é analisada.", { timeout: 30_000 });
      await expect(cel.page.getByTestId("deteccao-sugestao-cozinha_microondas")).toHaveCount(0, { timeout: 20_000 });
      const { data: item } = await adm().from("nivel_itens").select("declarado, foto_path, foto_status, foto_origem").eq("property_id", ids.imovel!).eq("chave", "cozinha_microondas").single();
      expect(item).toMatchObject({ declarado: true, foto_status: "pendente", foto_origem: "camera" });
      expect(caminhos).not.toContain(item?.foto_path);
      const { data: sug } = await adm().from("deteccao_sugestoes").select("chave, status").eq("property_id", ids.imovel!).order("chave");
      expect(sug).toEqual(
        expect.arrayContaining([
          { chave: "cozinha_microondas", status: "aceita" },
          { chave: "maquina_lavar", status: "aceita" },
          { chave: "sala_assentos", status: "descartada" },
        ]),
      );
      await cel.page.screenshot({ path: "tests/laboratorio/saida/t389-4-camera-390.png", fullPage: true });
    } finally {
      await cel.fechar();
    }
  });
});
