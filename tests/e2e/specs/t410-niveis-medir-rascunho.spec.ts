import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, definirPlano, entrar, novaSenha, novoSufixo, publicarPeloEditor } from "../fixtures/laboratorio";
import { celularComCamera } from "../fixtures/camera";
import { noPasso } from "../fixtures/cadastro";
import { CHAVES_NIVEL_FOTO } from "../../../src/config/niveis";

/*
  T410 — NIVEIS-MEDIR-B (E25b): medir a internet ANTES de publicar. Só no laboratório (motor simulado 328/42/12 ms,
  geolocalização emulada pelo navegador — E34-C).
   1. Celular, no cadastro (passo Comodidades): o item de internet mostra "Meça agora, no imóvel"; o dono mede no quarto
      principal e no ponto de trabalho (mesmas validações: localização, raio, Wi-Fi); o nível recalcula na hora e o
      rascunho com as fotos do Premium aceitas chega a Premium (a videochamada sai do "o que falta" sem foto nenhuma).
      Publica direto como Premium.
   2. Computador: o mesmo botão abre o QR e o link de uso único do FOTO-NA-HORA; o link, aberto no celular, cai na
      medição do ponto. Sem medição, o rascunho publica como Essencial e o nível mostra o que falta.
   3. Medição vencida: a rotina dos prazos recalcula e o nível cai para o que os outros itens sustentam.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.medir.${sufixo}@lab.vivanomads.test`, nome: "Mila Medida", role: "owner" as const };
const ids: { dono?: string; p?: string; s?: string } = {};
const IMOVEL = { lat: -18.9186, lng: -48.2772 };
const PERTO = { latitude: -18.9178, longitude: -48.2772 }; // ~90 m
const SILENCIOSO = { via_intensa: false, noturno_obra_100m: false, aviao_ferrovia: false, isolamento_acustico: false, classe: "baixo" };

const nivelGravado = async (id: string) => ((await adm().from("imovel_nivel").select("nivel").eq("property_id", id).maybeSingle()).data?.nivel as string | undefined) ?? null;
const statusDo = async (id: string) => ((await adm().from("properties").select("status").eq("id", id).single()).data?.status as string) ?? null;

/** Rascunho completo do cadastro (o estado que o editor deixa), no ponto do mapa, com todas as fotos do Premium aceitas. */
async function prepararRascunho(id: string, titulo: string) {
  const fotos = Array.from({ length: 8 }, (_, i) => {
    const caminho = `${ids.dono}/${id}-${i}.png`;
    return { id: `lab-${i}`, url: `https://lab.vivanomads.test/storage/v1/object/public/property-photos/${caminho}`, name: "", path: caminho, demo: false };
  });
  const { error } = await adm()
    .from("properties")
    .update({
      lat: IMOVEL.lat,
      lng: IMOVEL.lng,
      lat_exata: IMOVEL.lat,
      lng_exata: IMOVEL.lng,
      tag_home_office: true,
      draft_data: {
        title: titulo,
        description: "Studio mobiliado no Centro, com home office, internet rápida e cozinha completa. Pronto para morar.",
        propertyType: "studio",
        tipoEntrada: "porteiro",
        internetMbps: "300",
        bedrooms: "1",
        bathrooms: "1",
        areaM2: "40",
        maxGuests: "2",
        minPeriod: "30",
        maxPeriod: "180",
        monthlyPrice: "3200",
        street: "Rua Santos Dumont",
        numero: "100",
        neighborhood: "Centro",
        city: "Uberlândia",
        uf: "MG",
        cep: "38400-060",
        garantias: { caucao: true },
        privacidade: { semCamerasInterior: true, camerasExternas: false, tipoAcesso: "chave", senhaTrocadaEstadia: false },
        ownershipType: "own",
        subleaseAuthorized: false,
        photos: fotos,
        iaAnalisadas: fotos.map((f) => f.url),
        step: 4,
        ordemEtapas: 5,
        etapaMax: 9,
      },
    })
    .eq("id", id);
  if (error) throw error;
  const { error: eR } = await adm().from("imovel_ruido").upsert({ property_id: id, ...SILENCIOSO, origem: "proprietario", respondido_em: new Date().toISOString() }, { onConflict: "property_id" });
  if (eR) throw eR;
  const { error: eI } = await adm()
    .from("nivel_itens")
    .upsert(
      CHAVES_NIVEL_FOTO.map((chave) => ({ property_id: id, chave, declarado: true, foto_path: `${ids.dono}/${randomUUID()}.webp`, foto_status: "aceita", foto_origem: "camera", foto_capturada_em: new Date().toISOString() })),
      { onConflict: "property_id,chave" },
    );
  if (eI) throw eI;
}

async function abrirComodidades(page: Page, id: string) {
  await page.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=comodidades`, { waitUntil: "domcontentloaded" });
  await noPasso(page, "comodidades", 30_000);
  await expect(page.getByTestId("nivel-cadastro")).toBeVisible({ timeout: 30_000 });
}

/** No celular, o item de internet: "Meça agora, no imóvel" → a medição do ponto abre ali mesmo. */
async function medirItem(page: Page, item: string, ponto: string) {
  const botao = page.getByTestId(`nivel-cadastro-medir-${item}-botao`);
  await expect(botao).toHaveText("Meça agora, no imóvel", { timeout: 20_000 });
  await expect(botao).toHaveAttribute("data-modo", "celular");
  await botao.click();
  const bloco = page.getByTestId(`nivel-cadastro-medir-${item}-medir`).getByTestId("medir-internet");
  await expect(bloco).toBeVisible({ timeout: 20_000 });
  // E193 (#1496): o ponto da medição virou pílulas de escolha única (antes, lista suspensa).
  await expect(bloco.getByTestId(`medir-internet-ponto-${ponto}`)).toHaveAttribute("aria-checked", "true");
  await bloco.getByTestId("medir-internet-wifi").check();
  await bloco.getByTestId("medir-internet-botao").click();
  await expect(bloco.getByTestId("medir-internet-resultado")).toHaveAttribute("data-validada", "1", { timeout: 30_000 });
}

test.describe("T410 — NIVEIS-MEDIR-B: medir a internet antes de publicar", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await definirPlano(ids.dono, "pro");
    ids.p = await criarImovelPronto(ids.dono, `Studio Premium Medido ${sufixo}`);
    ids.s = await criarImovelPronto(ids.dono, `Studio Sem Medicao ${sufixo}`);
    await prepararRascunho(ids.p, `Studio Premium Medido ${sufixo}`);
    await prepararRascunho(ids.s, `Studio Sem Medicao ${sufixo}`);
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("internet_medicoes").delete().in("property_id", [ids.p, ids.s].filter(Boolean) as string[]);
    await apagarContas([ids.dono]);
  });

  test("1. celular: mede no quarto e no ponto de trabalho ainda no rascunho → Premium; publica direto como Premium", async ({ browser }) => {
    const cel = await celularComCamera({ email: dono.email, senha });
    try {
      await cel.ctx.grantPermissions(["geolocation"]);
      await cel.ctx.setGeolocation(PERTO);
      await abrirComodidades(cel.page, ids.p!);
      await expect(cel.page.getByTestId("nivel-cadastro")).toHaveAttribute("data-nivel", "essencial");
      await expect(cel.page.getByTestId("nivel-cadastro")).not.toContainText("depois de publicar");
      await medirItem(cel.page, "internet_medida_quarto", "quarto_principal");
      await medirItem(cel.page, "internet_medida_trabalho", "trabalho");
      // O nível recalcula na hora (servidor e tela), sem cron; a videochamada sai do "o que falta" sem foto.
      await expect(cel.page.getByTestId("nivel-cadastro")).toHaveAttribute("data-nivel", "premium", { timeout: 30_000 });
      await expect(cel.page.getByTestId("nivel-cadastro-item-internet_videochamada_trabalho")).toHaveCount(0);
      await expect.poll(() => nivelGravado(ids.p!), { timeout: 30_000 }).toBe("premium");
      expect(await statusDo(ids.p!)).toBe("draft");
      const { data } = await adm().from("internet_medicoes").select("ponto, validada, origem, papel, distancia_m").eq("property_id", ids.p!).order("medido_em");
      expect(data?.map((m) => [m.ponto, m.validada, m.origem, m.papel])).toEqual([
        ["quarto_principal", true, "cadastro", "dono"],
        ["trabalho", true, "cadastro", "dono"],
      ]);
      for (const m of data ?? []) expect(m.distancia_m).toBeLessThanOrEqual(300);
      await cel.page.screenshot({ path: "tests/laboratorio/saida/t410-1-rascunho-premium-390.png", fullPage: true });
    } finally {
      await cel.fechar();
    }
    // Publica direto como Premium (a medição do rascunho vale ao publicar).
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await publicarPeloEditor(page, ids.p!);
    await expect.poll(() => statusDo(ids.p!), { timeout: 60_000 }).toBe("active");
    expect(await nivelGravado(ids.p!)).toBe("premium");
    await page.goto(`/dashboard/imoveis/${ids.p}/nivel`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("nivel-atual")).toHaveAttribute("data-nivel", "premium", { timeout: 20_000 });
    await page.context().close();
  });

  test("2. computador: QR e link de uso único levam à medição no celular; sem medição publica como Essencial e mostra o que falta", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await abrirComodidades(page, ids.s!);
    const botao = page.getByTestId("nivel-cadastro-medir-internet_medida_quarto-botao");
    await expect(botao).toHaveText("Meça agora, no imóvel", { timeout: 20_000 });
    await expect(botao).toHaveAttribute("data-modo", "computador");
    await botao.click();
    await expect(page.getByTestId("nivel-cadastro-medir-internet_medida_quarto-qr")).toBeVisible({ timeout: 20_000 });
    const link = await page.getByTestId("nivel-cadastro-medir-internet_medida_quarto-link").getAttribute("href");
    expect(link).toMatch(/\/prova\/celular\?t=/);
    await page.screenshot({ path: "tests/laboratorio/saida/t410-2-qr-1280.png", fullPage: false });
    // O link abre no celular (sem login) já como o dono, na medição do ponto pedido.
    const cel = await celularComCamera();
    try {
      await cel.page.goto(link!, { waitUntil: "domcontentloaded" });
      await expect(cel.page).toHaveURL(new RegExp(`/dashboard/imoveis/${ids.s}/nivel\\?medir=quarto_principal`), { timeout: 30_000 });
      await expect(cel.page.getByTestId("nivel-medir").getByTestId("medir-internet-ponto-quarto_principal")).toHaveAttribute("aria-checked", "true", { timeout: 20_000 });
    } finally {
      await cel.fechar();
    }
    // Sem medir: publica como Essencial e o nível diz o que falta.
    await publicarPeloEditor(page, ids.s!);
    await expect.poll(() => statusDo(ids.s!), { timeout: 60_000 }).toBe("active");
    await page.goto(`/dashboard/imoveis/${ids.s}/nivel`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("nivel-atual")).toHaveAttribute("data-nivel", "essencial", { timeout: 20_000 });
    await expect(page.getByTestId("nivel-falta")).toContainText("Internet medida no quarto principal");
    await expect(page.getByTestId("nivel-falta")).toContainText("Internet medida no ponto de trabalho");
    await page.context().close();
  });

  test.describe("rotina dos prazos (admin)", () => {
    test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");

    test("3. medição vencida: a rotina recalcula e o nível cai para o que os outros itens sustentam", async ({ browser }) => {
      expect(await nivelGravado(ids.p!)).toBe("premium");
      // A medição "envelhece": feita há ~6 meses e vencida há 1 h (o banco exige valido_ate > medido_em).
      const vencida = new Date(Date.now() - 3600_000).toISOString();
      const medidaEm = new Date(Date.now() - 183 * 24 * 3600_000).toISOString();
      const { error } = await adm().from("internet_medicoes").update({ medido_em: medidaEm, valido_ate: vencida }).eq("property_id", ids.p!);
      if (error) throw error;
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
      const a = await ctx.newPage();
      await a.goto("/admin/conforto", { waitUntil: "domcontentloaded" });
      await a.getByTestId("rodar-prazos-imovel").fill(ids.p!);
      await a.getByTestId("rodar-prazos").click();
      await expect(a.getByTestId("rodar-prazos-resultado")).toContainText("Feito:", { timeout: 60_000 });
      await ctx.close();
      // Todas as fotos do Premium continuam; sem internet medida, a área de internet sustenta só o Essencial.
      await expect.poll(() => nivelGravado(ids.p!), { timeout: 30_000 }).toBe("essencial");
    });
  });
});

