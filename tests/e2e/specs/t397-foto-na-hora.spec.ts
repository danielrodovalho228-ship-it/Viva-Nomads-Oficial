import { test, expect, type Browser, type Page } from "@playwright/test";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, definirPlano, entrar, novaSenha, novoSufixo, pngDeTeste } from "../fixtures/laboratorio";
import { celularComCamera, fotografarEUsar } from "../fixtures/camera";
import { AREAS, CHAVES_NIVEL_FOTO, MATRIZ } from "../../../src/config/niveis";

/*
  T397 — FOTO-NA-HORA-B (decisão do Daniel, 24/10): a foto que PROVA um item de nível é feita na hora, pela câmera.
  Celular = Chromium com câmera falsa (--use-fake-device-for-media-stream + --use-fake-ui-for-media-stream).
   1. Prova sem token, com token vencido ou já usado: /api/upload/prova recusa com "Esta foto não foi feita na hora…".
      As fotos do ANÚNCIO seguem aceitando envio da galeria (/api/upload/foto).
   2. salvarItemNivel com o caminho de uma foto da galeria (pedido adulterado no meio do caminho, com ou sem o token):
      recusado; nada gravado.
   3. Celular: "Fotografar agora" → câmera → "Usar esta foto" → o item conta (origem câmera). A mesma imagem para outro
      item: "Esta foto já foi usada. Fotografe o item agora."
   4. Computador: "Fotografar pelo celular" → QR e "Continuar no celular" (link de uso único); o link abre a câmera do item
      no celular já logado; o item do computador se atualiza sozinho. O link usado não abre de novo; celular com outra
      conta aberta é recusado (sem gastar o link).
   5. Prova anterior à regra: conta com a marca "Foto anterior à regra" e o item pendente na prontidão até o prazo;
      vencido, deixa de contar (o nível cai) e a rotina avisa o dono uma vez.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.nahora.${sufixo}@lab.vivanomads.test`, nome: "Hora Dona", role: "owner" as const };
const outro = { email: `outro.nahora.${sufixo}@lab.vivanomads.test`, nome: "Otto Outro", role: "owner" as const };
const ids: { dono?: string; outro?: string; imovel?: string; antigo?: string } = {};
const ERRO_SEM_TOKEN = "Esta foto não foi feita na hora. Abra a câmera e fotografe o item agora.";
const deConforto = new Set<string>(AREAS.flatMap((a) => MATRIZ[a].conforto));
const SILENCIOSO = { via_intensa: false, noturno_obra_100m: false, aviao_ferrovia: false, isolamento_acustico: false, classe: "baixo" };

const tokenHash = (t: string) => createHash("sha256").update(t).digest("hex");
async function capturaNoBanco(o: { expira: number; usado?: boolean; chave?: string }): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const agora = Date.now();
  const { error } = await adm()
    .from("prova_capturas")
    .insert({
      token_hash: tokenHash(token),
      owner_id: ids.dono,
      property_id: ids.imovel,
      chave: o.chave ?? "cozinha_microondas",
      criado_em: new Date(agora - 20 * 60_000).toISOString(),
      expira_em: new Date(agora + o.expira).toISOString(),
      ...(o.usado ? { foto_path: `${ids.dono}/${randomUUID()}.webp`, capturada_em: new Date(agora - 60_000).toISOString(), usado_em: new Date(agora - 30_000).toISOString() } : {}),
    });
  if (error) throw error;
  return token;
}
async function itemNoBanco(propertyId: string, chave: string) {
  return (await adm().from("nivel_itens").select("declarado, foto_path, foto_status, foto_origem, foto_hash, refazer_ate, vencida_avisada_em").eq("property_id", propertyId).eq("chave", chave).maybeSingle()).data;
}
async function paginaNivel(page: Page, id: string) {
  await page.goto(`/dashboard/imoveis/${id}/nivel`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("nivel-itens")).toBeVisible({ timeout: 30_000 });
}

test.describe("T397 — FOTO-NA-HORA-B: prova de nível só com a foto feita na hora", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.outro = await criarConta(outro, senha);
    await definirPlano(ids.dono, "pro");
    ids.imovel = await criarImovelPronto(ids.dono, `Studio Na Hora ${sufixo}`, { ativo: true });
    ids.antigo = await criarImovelPronto(ids.dono, `Loft Foto Antiga ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono, ids.outro]);
  });

  test("1. sem token, vencido ou usado: recusado; a foto do anúncio segue aceitando a galeria", async ({}, info) => {
    test.skip(info.project.name !== "chromium", "o celular com câmera sai dentro do teste");
    const cel = await celularComCamera({ email: dono.email, senha });
    try {
      const enviar = (token?: string) =>
        cel.page.request.post("/api/upload/prova", { multipart: { ...(token ? { token } : {}), file: { name: "galeria.png", mimeType: "image/png", buffer: pngDeTeste(4) } } });
      for (const [caso, token] of [
        ["sem token", undefined],
        ["vencido", await capturaNoBanco({ expira: -60_000 })],
        ["usado", await capturaNoBanco({ expira: 5 * 60_000, usado: true })],
      ] as const) {
        const r = await enviar(token);
        expect(r.status(), caso).toBe(403);
        expect((await r.json()).error, caso).toBe(ERRO_SEM_TOKEN);
      }
      expect(await itemNoBanco(ids.imovel!, "cozinha_microondas")).toBeNull();
      // Fotos do anúncio: a galeria continua valendo (sem token).
      const g = await cel.page.request.post("/api/upload/foto", { multipart: { file: { name: "sala.png", mimeType: "image/png", buffer: pngDeTeste(6) } } });
      expect(g.status()).toBe(200);
      expect((await g.json()).path).toMatch(new RegExp(`^${ids.dono}/[0-9a-f-]{36}\\.webp$`));
    } finally {
      await cel.fechar();
    }
  });

  test("2. salvarItemNivel com a foto da galeria (com ou sem token) é recusado", async ({}, info) => {
    test.skip(info.project.name !== "chromium", "o celular com câmera sai dentro do teste");
    const item = "cozinha_microondas";
    // Um celular por tentativa: cada um fotografa um quadro novo (senão a 2ª seria recusada antes, como foto repetida).
    for (const semToken of [true, false]) {
      const cel = await celularComCamera({ email: dono.email, senha });
      const { page } = cel;
      try {
        const g = await page.request.post("/api/upload/foto", { multipart: { file: { name: "micro.png", mimeType: "image/png", buffer: pngDeTeste(semToken ? 8 : 9) } } });
        const galeria = (await g.json()).path as string;
        await paginaNivel(page, ids.imovel!);
        // Adultera a chamada do salvarItemNivel que a câmera faz: troca a foto pela da galeria (e, no 1º caso, tira o token).
        await page.route("**/*", async (r) => {
          const req = r.request();
          const corpo = req.postData();
          if (req.method() !== "POST" || !req.headers()["next-action"] || !corpo?.includes(".webp")) return r.continue();
          let novo = corpo.replace(/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp/i, galeria);
          try {
            const args = JSON.parse(corpo);
            if (Array.isArray(args) && args.length >= 5) {
              args[3] = galeria;
              if (semToken) args[4] = null;
              novo = JSON.stringify(args);
            }
          } catch {
            /* corpo não é JSON: fica a troca do caminho */
          }
          return r.continue({ postData: novo });
        });
        await page.getByTestId(`nivel-foto-${item}-botao`).click();
        await fotografarEUsar(page);
        await expect(page.getByTestId("camera-msg")).toHaveText(ERRO_SEM_TOKEN, { timeout: 30_000 });
        await page.unroute("**/*");
        if (!semToken) await page.screenshot({ path: "tests/laboratorio/saida/t397-2-galeria-recusada-390.png", fullPage: true });
        expect(await itemNoBanco(ids.imovel!, item), semToken ? "galeria sem token" : "galeria com o token de outra foto").toBeNull();
      } finally {
        await cel.fechar();
      }
    }
  });

  test("3. celular: foto feita na hora conta; a mesma imagem em outro item é recusada", async ({}, info) => {
    test.skip(info.project.name !== "chromium", "o celular com câmera sai dentro do teste");
    const cel = await celularComCamera({ email: dono.email, senha });
    const { page } = cel;
    try {
      await paginaNivel(page, ids.imovel!);
      await expect(page.getByTestId("prova-na-hora-aviso")).toHaveText(
        "Para provar o nível, a foto é feita na hora, pela câmera. Fotos da galeria não valem para comprovação, mas continuam valendo para as fotos do anúncio.",
      );
      await expect(page.getByTestId("nivel-itens").locator('input[type="file"]')).toHaveCount(0);
      const botao = page.getByTestId("nivel-foto-cozinha_microondas-botao");
      await expect(botao).toHaveText("Fotografar agora");
      await botao.click();
      await expect(page.getByTestId("camera-trocar")).toBeVisible({ timeout: 20_000 });
      await fotografarEUsar(page);
      await expect(page.getByTestId("nivel-msg-cozinha_microondas")).toHaveText("Foto de Micro-ondas recebida. O item já conta enquanto a foto é analisada.", { timeout: 30_000 });
      await expect(page.getByTestId("nivel-item-cozinha_microondas")).toHaveAttribute("data-origem", "camera", { timeout: 20_000 });
      const item = await itemNoBanco(ids.imovel!, "cozinha_microondas");
      expect(item).toMatchObject({ declarado: true, foto_status: "pendente", foto_origem: "camera", refazer_ate: null });
      expect(item?.foto_hash).toMatch(/^[0-9a-f]{16}$/);
      await page.screenshot({ path: "tests/laboratorio/saida/t397-3-recebida-390.png", fullPage: true });

      // O mesmo quadro (mesma imagem) para outro item: foto repetida.
      await page.getByTestId("nivel-foto-mesa_jantar_todos-botao").click();
      await fotografarEUsar(page);
      await expect(page.getByTestId("camera-msg")).toHaveText("Esta foto já foi usada. Fotografe o item agora.", { timeout: 30_000 });
      await page.screenshot({ path: "tests/laboratorio/saida/t397-3-repetida-390.png", fullPage: true });
      await page.getByTestId("camera-fechar").click();
      expect(await itemNoBanco(ids.imovel!, "mesa_jantar_todos")).toBeNull();
    } finally {
      await cel.fechar();
    }
  });

  test("4. computador: QR e link de uso único; o celular abre já logado e o item do computador se atualiza sozinho", async ({ browser }, info) => {
    test.skip(info.project.name !== "chromium", "o celular com câmera sai dentro do teste");
    const item = "sono_dois_jogos";
    const pc = await entrar(browser, dono.email, senha);
    await pc.setViewportSize({ width: 1280, height: 900 });
    await paginaNivel(pc, ids.imovel!);
    const botao = pc.getByTestId(`nivel-foto-${item}-botao`);
    await expect(botao).toHaveText("Fotografar pelo celular");
    await botao.click();
    const painel = pc.getByTestId(`prova-celular-${item}`);
    await expect(painel.getByTestId("prova-celular-qr")).toBeVisible({ timeout: 20_000 });
    await expect(painel.getByTestId("prova-celular-link")).toHaveText("Continuar no celular");
    await expect(painel.getByTestId("prova-celular-email")).toBeVisible();
    await expect(pc.getByTestId("camera-prova")).toHaveCount(0); // a webcam não é oferecida
    const link = (await painel.getByTestId("prova-celular-link").getAttribute("href"))!;
    expect(link).toMatch(/\/prova\/celular\?t=[A-Za-z0-9_-]{43}$/);
    await pc.screenshot({ path: "tests/laboratorio/saida/t397-4-qr-1280.png", fullPage: true });

    // O celular (sem login) abre o link: entra como a dona, na câmera do item.
    const cel = await celularComCamera();
    try {
      await cel.page.goto(new URL(link).pathname + new URL(link).search, { waitUntil: "domcontentloaded" });
      await expect(cel.page).toHaveURL(new RegExp(`/dashboard/imoveis/${ids.imovel}/nivel\\?fotografar=${item}`), { timeout: 30_000 });
      await fotografarEUsar(cel.page);
      await expect(cel.page.getByTestId(`nivel-msg-${item}`)).toHaveText("Foto de 2 jogos de roupa de cama recebida. O item já conta enquanto a foto é analisada.", { timeout: 30_000 });
      // O computador se atualiza sozinho.
      await expect(pc.getByTestId(`nivel-msg-${item}`)).toHaveText("Foto de 2 jogos de roupa de cama recebida. O item já conta enquanto a foto é analisada.", { timeout: 30_000 });
      await expect(pc.getByTestId(`nivel-item-${item}`)).toHaveAttribute("data-origem", "camera", { timeout: 20_000 });
      // Link usado não abre de novo.
      await cel.page.goto(new URL(link).pathname + new URL(link).search, { waitUntil: "domcontentloaded" });
      await expect(cel.page.getByTestId("prova-celular-aviso")).toHaveAttribute("data-motivo", "invalido", { timeout: 20_000 });
    } finally {
      await cel.fechar();
    }
    const { data: links } = await adm().from("prova_links_celular").select("usado_em").eq("owner_id", ids.dono!);
    expect((links ?? []).filter((l) => l.usado_em)).toHaveLength(1);

    // Celular com OUTRA conta aberta: recusado, e o link não é gasto.
    await pc.reload({ waitUntil: "domcontentloaded" });
    await pc.getByTestId("nivel-foto-sono_dois_travesseiros-botao").click();
    const link2 = (await pc.getByTestId("prova-celular-sono_dois_travesseiros").getByTestId("prova-celular-link").getAttribute("href", { timeout: 20_000 }))!;
    const alheio = await celularComCamera({ email: outro.email, senha });
    try {
      await alheio.page.goto(new URL(link2).pathname + new URL(link2).search, { waitUntil: "domcontentloaded" });
      await expect(alheio.page.getByTestId("prova-celular-aviso")).toHaveAttribute("data-motivo", "outra-conta", { timeout: 20_000 });
      await alheio.page.screenshot({ path: "tests/laboratorio/saida/t397-4-outra-conta-390.png", fullPage: true });
    } finally {
      await alheio.fechar();
    }
    const { data: l2 } = await adm().from("prova_links_celular").select("usado_em").eq("token_hash", tokenHash(new URL(link2).searchParams.get("t")!)).single();
    expect(l2?.usado_em).toBeNull();
    await pc.context().close();
  });

  test("5. prova anterior à regra: conta com a marca até o prazo; vencida, o item deixa de contar", async ({ browser }) => {
    // Loft no Conforto: todos os itens de Conforto com foto da câmera, menos o micro-ondas, que é anterior à regra.
    const agora = new Date().toISOString();
    const ate = new Date(Date.now() + 10 * 86_400_000).toISOString();
    const chaves = CHAVES_NIVEL_FOTO.filter((k) => deConforto.has(k));
    expect(chaves).toContain("cozinha_microondas");
    const { error } = await adm()
      .from("nivel_itens")
      .upsert(
        chaves.map((chave) => ({
          property_id: ids.antigo,
          chave,
          declarado: true,
          foto_path: `${ids.dono}/${randomUUID()}.webp`,
          foto_status: "aceita",
          ...(chave === "cozinha_microondas" ? { foto_origem: "arquivo", refazer_ate: ate } : { foto_origem: "camera", foto_capturada_em: agora }),
        })),
        { onConflict: "property_id,chave" },
      );
    if (error) throw error;
    const valido = new Date(Date.now() + 150 * 86_400_000).toISOString();
    const medida = (ponto: string) => ({ property_id: ids.antigo, user_id: ids.dono, papel: "dono", download_mbps: 300, upload_mbps: 100, latencia_ms: 12, validada: true, origem: "edicao", valido_ate: valido, ponto });
    await adm().from("internet_medicoes").insert([medida("quarto_principal"), medida("trabalho")]);
    await adm().from("imovel_ruido").insert({ property_id: ids.antigo, ...SILENCIOSO });

    const page = await entrar(browser, dono.email, senha);
    await paginaNivel(page, ids.antigo!);
    await expect(page.getByTestId("nivel-atual")).toHaveAttribute("data-nivel", "conforto", { timeout: 20_000 });
    const dataBr = new Date(Date.parse(ate) - 3 * 3600_000).toISOString().slice(0, 10).split("-").reverse().join("/");
    await expect(page.getByTestId("nivel-anterior-cozinha_microondas")).toHaveText(`Foto anterior à regra · Refaça a foto de Micro-ondas pela câmera até ${dataBr}.`);
    await page.screenshot({ path: "tests/laboratorio/saida/t397-5-anterior-390.png", fullPage: true });
    // Prontidão (Meus imóveis): o item pendente com o prazo, que leva à câmera do item.
    await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("melhorar-refazer_foto_cozinha_microondas").first()).toHaveText(`Refaça a foto de Micro-ondas pela câmera até ${dataBr}`, { timeout: 30_000 });

    // Prazo vencido: o item deixa de contar e o nível cai.
    await adm().from("nivel_itens").update({ refazer_ate: new Date(Date.now() - 60_000).toISOString() }).eq("property_id", ids.antigo!).eq("chave", "cozinha_microondas");
    await paginaNivel(page, ids.antigo!);
    await expect(page.getByTestId("nivel-atual")).toHaveAttribute("data-nivel", "essencial", { timeout: 20_000 });
    await expect(page.getByTestId("nivel-anterior-cozinha_microondas")).toHaveCount(0);
    await page.context().close();
    expect(((await adm().from("imovel_nivel").select("nivel").eq("property_id", ids.antigo!).single()).data?.nivel as string) ?? null).toBe("essencial");
  });

  test.describe("rotina dos prazos (admin)", () => {
    test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");

    test("6. a rotina marca a prova vencida e avisa a dona uma vez só", async ({ browser }) => {
      const rodar = async (b: Browser) => {
        const ctx = await b.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
        const a = await ctx.newPage();
        await a.goto("/admin/conforto", { waitUntil: "domcontentloaded" });
        await a.getByTestId("rodar-prazos-imovel").fill(ids.antigo!);
        await a.getByTestId("rodar-prazos").click();
        await expect(a.getByTestId("rodar-prazos-resultado")).toContainText("Feito:", { timeout: 60_000 });
        await ctx.close();
      };
      await rodar(browser);
      const depois = await itemNoBanco(ids.antigo!, "cozinha_microondas");
      expect(depois?.vencida_avisada_em).toBeTruthy();
      await rodar(browser);
      expect((await itemNoBanco(ids.antigo!, "cozinha_microondas"))?.vencida_avisada_em).toBe(depois?.vencida_avisada_em);
    });
  });
});
