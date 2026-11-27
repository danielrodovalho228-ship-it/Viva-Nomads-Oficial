import { test, expect, type Page } from "@playwright/test";
import { MIN_FOTOS } from "../../../src/lib/anuncio/prontidao";
import { ETAPA } from "../../../src/lib/anuncio/etapas-ids";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";
import { prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T2139 — E1024 @E1024. Trava escrita antes da correção (DUET-1519, item 2; a correção é da Fable). Registado de início
  como E1014, que no repositório já era a instabilidade do t108 (Code 2); o Gerente renumerou para E1024 (DUET-1619).
  Regra: o cartão "Continue seu anúncio" do Início do dono mostra a FOTO PRINCIPAL confirmada pelo dono, a mesma da
  pré-visualização do assistente (que já está certa). O defeito é só o cartão do painel.
  Montagem: rascunho com 8 fotos reais no Storage local (endereços públicos, no draft_data e em property_photos, na
  mesma ordem). No Passo 2 (Fotos), o dono escolhe a 3.ª foto com "Usar como foto principal" logo ao abrir o passo,
  como faz quem entra para trocar a capa. A escolha tem de ficar gravada no rascunho (é dele que o cartão lê).
  1.ª prova no laboratório (run 44180945855): a escolha não chegou a ser gravada, nem com "Salvo às". O clique não é
  evento input/change (editouRef), e nos primeiros segundos depois de abrir o rascunho o autosave toma o estado novo
  como base, sem gravar. A pré-visualização lê o estado da tela, por isso está certa; o cartão lê o banco.
    1. O rascunho gravado tem a foto escolhida em 1.º lugar, e a pré-visualização (1280 px) mostra essa foto.
    2. Em /dashboard, o cartão "Continue seu anúncio" mostra essa MESMA foto (o mesmo arquivo do Storage), e não a
       antiga 1.ª foto.
  390 e 1280 px.
  E1041 (ORDEM-DUET-217): a entrada pelo cartão. Os dois casos acima esperam a rede parar (networkidle) antes de trocar a
  foto, e por isso passaram sem apanhar o defeito: o dono que chega pelo botão "Continuar de onde parou" do cartão e
  troca a principal logo que o Passo 2 aparece (medido pelo Gerente na main 0a752753: 0,1 s e 1,1 s não grava; 2,1 s em
  diante grava) cai na janela da base (E516) e a troca não vai para o banco. O ponto cego era desta spec, e é ela que o
  fecha:
    3. Rascunho com MIN_FOTOS - 1 fotos (o 1.º item que falta é "fotos", por isso o botão do cartão leva ao Passo 2).
       Pelo botão do cartão, a 3.ª foto vira a principal SEM esperar a rede parar; o rascunho grava a troca e o cartão
       mostra a foto escolhida. Correção: o #3971.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
// Um dono por teste: os testes do arquivo correm em paralelo, e o cartão mostra o rascunho mais novo DO DONO.
const donoDe = (largura: number) => ({ email: `dono.t2139.${largura}.${sufixo}@lab.vivanomads.test`, nome: "Clara Capa", role: "owner" as const });
const ids: Record<string, string> = {};

type Foto = { path: string; url: string } & Record<string, unknown>;

/** O arquivo do Storage por trás de um endereço de foto (o caminho dentro do bucket, sem parâmetros). */
const arquivo = (src: string | null) => decodeURIComponent(src ?? "").split("/property-photos/")[1]?.split("?")[0] ?? "";

async function fotosDoRascunho(id: string): Promise<Foto[]> {
  const { data, error } = await adm().from("properties").select("draft_data").eq("id", id).single();
  if (error) throw error;
  return (((data?.draft_data as { photos?: Foto[] } | null)?.photos ?? []) as Foto[]);
}

/** Endereços públicos do Storage local no draft_data e em property_photos (o navegador carrega a imagem). */
async function fotosReaisNoRascunho(id: string) {
  const { data, error } = await adm().from("properties").select("draft_data").eq("id", id).single();
  if (error) throw error;
  const d = data!.draft_data as { photos: Foto[] } & Record<string, unknown>;
  const photos = d.photos.map((f) => ({ ...f, url: adm().storage.from("property-photos").getPublicUrl(f.path).data.publicUrl }));
  const { error: e2 } = await adm().from("properties").update({ draft_data: { ...d, photos } }).eq("id", id);
  if (e2) throw e2;
  await adm().from("property_photos").delete().eq("property_id", id);
  const { error: e3 } = await adm().from("property_photos").insert(photos.map((f, i) => ({ property_id: id, url: f.url, sort_order: i })));
  if (e3) throw e3;
  return photos;
}

async function fotoDoCartao(page: Page): Promise<string> {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  const bloco = page.getByTestId("inicio-dono-principal");
  await expect(bloco).toHaveAttribute("data-tipo", "rascunho", { timeout: 30_000 });
  await expect(bloco).toContainText("Continue seu anúncio");
  const foto = bloco.getByTestId("inicio-dono-foto");
  await expect(foto, "o cartão mostra uma foto (não o espaço desenhado)").toBeVisible({ timeout: 20_000 });
  return arquivo(await foto.getAttribute("src"));
}

test.describe("T2139 — E1024: o \"Continue seu anúncio\" mostra a foto principal confirmada @E1024", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "default", timeout: 180_000 });

  test.afterAll(async () => {
    for (const k of Object.keys(ids).filter((k) => k.startsWith("r"))) await adm().from("properties").delete().eq("id", ids[k]);
    await apagarContas(Object.keys(ids).filter((k) => k.startsWith("dono")).map((k) => ids[k]));
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — a 3.ª foto vira a principal no Passo 2; o cartão do Início mostra essa foto`, async ({ browser }) => {
      const dono = donoDe(largura);
      const donoId = (ids[`dono${largura}`] = await criarConta(dono, senha));
      await adm().from("profiles").update({ is_teste: true, preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", donoId);
      const id = (ids[`r${largura}`] = await prepararRascunho(donoId, `Rascunho T2139 ${largura} ${sufixo}`, {}, 8));
      const antes = await fotosReaisNoRascunho(id);
      const antigaPrincipal = antes[0].path;
      const escolhida = antes[2].path;

      const contexto = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await entrarNaPagina(await contexto.newPage(), dono.email, senha);

      // Antes da troca, o cartão mostra a 1.ª foto (o caminho que a pré-visualização também segue).
      expect(await fotoDoCartao(page), "antes da troca, o cartão mostra a 1.ª foto").toBe(antigaPrincipal);

      // No Passo 2, "Usar como foto principal" na 3.ª foto; o rascunho grava a nova ordem.
      await page.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=fotos`, { waitUntil: "domcontentloaded" });
      await noPasso(page, "fotos", 30_000);
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      const terceira = page.getByTestId("foto-miniatura").filter({ has: page.locator(`img[src*="${escolhida.split("/").pop()}"]`) });
      await expect(terceira).toHaveCount(1, { timeout: 20_000 });
      await terceira.hover().catch(() => {});
      await terceira.getByRole("button", { name: "Usar como foto principal" }).click();
      await expect
        .poll(async () => (await fotosDoRascunho(id))[0]?.path, { timeout: 20_000, message: "o rascunho grava a foto escolhida em 1.º lugar" })
        .toBe(escolhida);

      // A pré-visualização (coluna ao lado, a 1280 px) já mostra a escolhida: é a referência que está certa.
      if (largura === 1280) {
        await expect.poll(async () => arquivo(await page.getByTestId("previa-foto").getAttribute("src")), { timeout: 20_000, message: "a pré-visualização mostra a foto principal escolhida" }).toBe(escolhida);
      }

      // O cartão do Início mostra a MESMA foto principal.
      const noCartao = await fotoDoCartao(page);
      expect(noCartao, `o cartão mostra a foto principal confirmada (${escolhida}), não a antiga 1.ª (${antigaPrincipal})`).toBe(escolhida);
      await contexto.close();
    });
  }

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — E1041: pelo "Continuar de onde parou" do cartão, a troca da principal logo que o Passo 2 aparece fica gravada`, async ({ browser }) => {
      const dono = { ...donoDe(largura), email: `dono.t2139.cartao.${largura}.${sufixo}@lab.vivanomads.test` };
      const donoId = (ids[`donoCartao${largura}`] = await criarConta(dono, senha));
      await adm().from("profiles").update({ is_teste: true, preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", donoId);
      // MIN_FOTOS - 1 fotos: o 1.º item que falta é "fotos", e o botão do cartão leva direto ao Passo 2.
      const id = (ids[`rCartao${largura}`] = await prepararRascunho(donoId, `Rascunho T2139 cartão ${largura} ${sufixo}`, {}, MIN_FOTOS - 1));
      const antes = await fotosReaisNoRascunho(id);
      const antigaPrincipal = antes[0].path;
      const escolhida = antes[2].path;

      const contexto = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await entrarNaPagina(await contexto.newPage(), dono.email, senha);
      expect(await fotoDoCartao(page), "antes da troca, o cartão mostra a 1.ª foto").toBe(antigaPrincipal);

      // A entrada é pelo botão do cartão, como faz o dono no Início.
      const botao = page.getByTestId("inicio-dono-principal").getByTestId("inicio-dono-botao");
      await expect(botao).toHaveText(/Continuar de onde parou/);
      await expect(botao, "pré-condição: o botão do cartão leva ao Passo 2 (Fotos)").toHaveAttribute("href", new RegExp(`draft=${id}&etapa=${ETAPA.fotos}$`));
      await botao.click();
      await noPasso(page, "fotos", 30_000);
      const apareceu = Date.now();

      // Logo que o passo aparece: sem esperar a rede parar (é a janela em que o defeito acontece).
      const terceira = page.getByTestId("foto-miniatura").filter({ has: page.locator(`img[src*="${escolhida.split("/").pop()}"]`) });
      await expect(terceira).toHaveCount(1, { timeout: 20_000 });
      await terceira.hover().catch(() => {});
      await terceira.getByRole("button", { name: "Usar como foto principal" }).click();
      const aposMs = Date.now() - apareceu;
      test.info().annotations.push({ type: "E1041", description: `troca feita ${aposMs} ms depois de o Passo 2 aparecer` });
      console.log(`T2139 E1041 ${largura} px: troca feita ${aposMs} ms depois de o Passo 2 aparecer`);

      await expect
        .poll(async () => (await fotosDoRascunho(id))[0]?.path, { timeout: 20_000, message: `o rascunho grava a foto escolhida em 1.º lugar (troca ${aposMs} ms depois de o passo aparecer)` })
        .toBe(escolhida);
      const noCartao = await fotoDoCartao(page);
      expect(noCartao, `o cartão mostra a foto principal confirmada (${escolhida}), não a antiga 1.ª (${antigaPrincipal})`).toBe(escolhida);
      await contexto.close();
    });
  }
});
