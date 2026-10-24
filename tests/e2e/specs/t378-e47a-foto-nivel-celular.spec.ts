import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, webkit, type Browser, type Page } from "@playwright/test";
import sharp from "sharp";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, definirPlano, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T378 — E47-A, PERNA DE LABORATÓRIO (Pista C, 24/10): diagnóstico do "clique em Enviar foto (prova de nível) → TELA
  BRANCA" que o Daniel viu no celular em 23/10. O QA do Muse (desktop, PNG pequeno) passou; a hipótese é a foto real de
  celular: arquivo GRANDE ou HEIC. Na página /dashboard/imoveis/:id/nivel, item "ar_quarto_principal", cada caso escolhe
  um arquivo no "Enviar a foto" e registra: erros de console e de página, a resposta de /api/upload/foto (status e
  corpo), a mensagem da linha e o estado da página depois (página viva ou branca). Roda no Chromium (390 px) e no WebKit
  (motor do Safari do iPhone, 390 px). Dois casos simulam na rede o que o laboratório não tem: a rede caindo no envio
  (o fetch rejeita) e o 413 da Vercel para corpo acima de 4,5 MB (corpo em texto). Não corrige nada: só mede. A página branca derruba o teste (é a reprodução);
  o resto fica no relatório tests/laboratorio/saida/e47a/.
*/
const ITEM = "ar_quarto_principal";
const SAIDA = "tests/laboratorio/saida/e47a";
const MB = 1024 * 1024;

/** JPEG de verdade com cara de foto de celular (4032×3024, ruído), completado com bytes depois do fim até `alvo`. */
async function jpegCelular(alvo: number, w = 4032, h = 3024, qualidade = 70): Promise<Buffer> {
  const base = await sharp({ create: { width: w, height: h, channels: 3, background: { r: 120, g: 140, b: 160 }, noise: { type: "gaussian", mean: 128, sigma: 40 } } })
    .jpeg({ quality: qualidade })
    .toBuffer();
  if (base.length >= alvo) return base;
  // Bytes depois do marcador de fim (EOI) não mudam a imagem: o decodificador para no EOI. Só o tamanho cresce.
  return Buffer.concat([base, Buffer.alloc(alvo - base.length, 0)]);
}
/** "HEIC" do iPhone: caixa ftyp heic de verdade no começo (o que o celular manda), conteúdo de enchimento. */
function heic(tamanho: number): Buffer {
  const ftyp = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00, 0x6d, 0x69, 0x66, 0x31, 0x68, 0x65, 0x69, 0x63]);
  return Buffer.concat([ftyp, Buffer.alloc(tamanho - ftyp.length, 7)]);
}

interface Caso {
  id: string;
  descricao: string;
  arquivo: () => Promise<{ name: string; mimeType: string; buffer: Buffer }>;
  /** Simula na rede o que o laboratório não tem (a Vercel, o celular perdendo o sinal). */
  rota?: "abortar" | "413-vercel";
}
const CASOS: Caso[] = [
  { id: "jpeg-5mb", descricao: "JPEG de celular 12 MP, ~5 MB (abaixo do limite de 8 MB)", arquivo: async () => ({ name: "IMG_0005.JPG", mimeType: "image/jpeg", buffer: await jpegCelular(5 * MB) }) },
  { id: "jpeg-10mb", descricao: "JPEG de celular 12 MP, ~10 MB (acima dos 8 MB do servidor, abaixo dos 10 MB do proxy)", arquivo: async () => ({ name: "IMG_0010.JPG", mimeType: "image/jpeg", buffer: await jpegCelular(10 * MB - 64 * 1024) }) },
  { id: "jpeg-14mb", descricao: "JPEG de celular, ~14 MB (acima dos 10 MB que o proxy guarda do corpo)", arquivo: async () => ({ name: "IMG_0014.JPG", mimeType: "image/jpeg", buffer: await jpegCelular(14 * MB) }) },
  { id: "jpeg-48mp", descricao: "JPEG 48 MP (8000×6000), ~4 MB: passa no limite de tamanho e pesa na decodificação do servidor", arquivo: async () => ({ name: "IMG_0048.JPG", mimeType: "image/jpeg", buffer: await jpegCelular(0, 8000, 6000, 20) }) },
  { id: "rede-caiu", descricao: "JPEG ~5 MB com a rede caindo no envio (o fetch rejeita, como no celular sem sinal)", rota: "abortar", arquivo: async () => ({ name: "IMG_0005.JPG", mimeType: "image/jpeg", buffer: await jpegCelular(5 * MB) }) },
  { id: "413-vercel", descricao: "JPEG ~5 MB com a resposta da Vercel acima de 4,5 MB (413, corpo em texto)", rota: "413-vercel", arquivo: async () => ({ name: "IMG_0005.JPG", mimeType: "image/jpeg", buffer: await jpegCelular(5 * MB) }) },
  { id: "heic-3mb", descricao: "HEIC do iPhone, ~3 MB (formato fora do accept)", arquivo: async () => ({ name: "IMG_0003.HEIC", mimeType: "image/heic", buffer: heic(3 * MB) }) },
];

const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.e47a.${sufixo}@lab.vivanomads.test`, nome: "Diana Diagnóstico", role: "owner" as const };
const ids: { dono?: string; chromium?: string; webkit?: string } = {};

/** Abre a página de nível e devolve os ouvintes de console, erro de página e da rota de upload. */
async function abrirNivel(page: Page, imovel: string) {
  const consoleErros: string[] = [];
  const paginaErros: string[] = [];
  const uploads: { status: number; corpo: string; ms: number }[] = [];
  const falhas: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") consoleErros.push(`${m.type()}: ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => paginaErros.push(`${e.name}: ${e.message.slice(0, 300)}`));
  page.on("requestfailed", (r) => {
    if (r.url().includes("/api/upload/foto")) falhas.push(`${r.failure()?.errorText ?? "falhou"}`);
  });
  const inicio = new Map<string, number>();
  page.on("request", (r) => {
    if (r.url().includes("/api/upload/foto")) inicio.set(r.url(), Date.now());
  });
  page.on("response", async (r) => {
    if (!r.url().includes("/api/upload/foto")) return;
    const corpo = await r.text().catch(() => "(sem corpo)");
    uploads.push({ status: r.status(), corpo: corpo.slice(0, 200), ms: Date.now() - (inicio.get(r.url()) ?? Date.now()) });
  });
  await page.goto(`/dashboard/imoveis/${imovel}/nivel`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId(`nivel-foto-${ITEM}`)).toBeAttached({ timeout: 30_000 });
  return { consoleErros, paginaErros, uploads, falhas };
}

/** Estado da página depois da escolha: viva (itens na tela) ou branca (sem os itens, quase sem texto, tela de erro). */
async function estadoDaPagina(page: Page) {
  return page.evaluate(() => {
    const texto = document.body?.innerText ?? "";
    return {
      itensNaTela: !!document.querySelector('[data-testid="nivel-itens"]'),
      caracteres: texto.trim().length,
      telaDeErro: /Application error|client-side exception|Algo deu errado|This page couldn.t load/i.test(texto),
      url: location.pathname,
    };
  });
}

async function rodarCaso(page: Page, imovel: string, c: Caso, motor: string) {
  const escuta = await abrirNivel(page, imovel);
  await page.unroute("**/api/upload/foto").catch(() => {});
  if (c.rota === "abortar") await page.route("**/api/upload/foto", (r) => r.abort("internetdisconnected"));
  if (c.rota === "413-vercel")
    await page.route("**/api/upload/foto", (r) => r.fulfill({ status: 413, contentType: "text/plain", body: "Request Entity Too Large\n\nFUNCTION_PAYLOAD_TOO_LARGE" }));
  const arquivo = await c.arquivo();
  const t0 = Date.now();
  await page.getByTestId(`nivel-foto-${ITEM}`).setInputFiles(arquivo);
  // Até 60 s por uma resposta da linha (mensagem ou "Foto em análise"), ou a página cair.
  const linha = page.getByTestId(`nivel-msg-${ITEM}`).or(page.getByTestId(`nivel-status-${ITEM}`));
  await linha.first().waitFor({ state: "visible", timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(1_500); // um respiro para um erro tardio de renderização aparecer
  const estado = await estadoDaPagina(page).catch((e) => ({ itensNaTela: false, caracteres: 0, telaDeErro: true, url: `(sem página: ${String(e).slice(0, 80)})` }));
  const mensagem = await page.getByTestId(`nivel-msg-${ITEM}`).innerText({ timeout: 1_000 }).catch(() => null);
  const status = await page.getByTestId(`nivel-status-${ITEM}`).innerText({ timeout: 1_000 }).catch(() => null);
  // WebKit relata como erro de página o prefetch RSC cancelado quando o teste navega para o próximo caso
  // ("Fetch API cannot load …?_rsc=… due to access control checks"): não derruba a tela (lab de 2496388).
  const errosReais = escuta.paginaErros.filter((e) => !/Fetch API cannot load .* due to access control checks/.test(e));
  const branca = !estado.itensNaTela || estado.telaDeErro || errosReais.length > 0;
  const r = {
    motor,
    caso: c.id,
    descricao: c.descricao,
    arquivo: { nome: arquivo.name, tipo: arquivo.mimeType, bytes: arquivo.buffer.length },
    ms: Date.now() - t0,
    upload: escuta.uploads,
    requisicaoFalhou: escuta.falhas,
    mensagemDaLinha: mensagem,
    statusDaFoto: status,
    estado,
    telaBranca: branca,
    consoleErros: escuta.consoleErros,
    paginaErros: escuta.paginaErros,
    paginaErrosReais: errosReais,
  };
  console.log(`E47A|${motor}|${c.id}|branca=${branca}|upload=${JSON.stringify(escuta.uploads)}|falhou=${JSON.stringify(escuta.falhas)}|msg=${mensagem}|status=${status}|console=${JSON.stringify(escuta.consoleErros)}|pagina=${JSON.stringify(escuta.paginaErros)}`);
  mkdirSync(SAIDA, { recursive: true });
  writeFileSync(`${SAIDA}/${motor}-${c.id}.json`, JSON.stringify(r, null, 2));
  await page.screenshot({ path: `${SAIDA}/${motor}-${c.id}.png`, fullPage: true }).catch(() => {});
  expect.soft(branca, `${motor} · ${c.descricao}: a página ficou branca (pageerror=${JSON.stringify(errosReais)}; estado=${JSON.stringify(estado)})`).toBe(false);
  await page.unroute("**/api/upload/foto").catch(() => {});
}

test.describe("T378 — E47-A: foto da prova de nível com arquivo de celular (grande e HEIC)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 600_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await definirPlano(ids.dono, "pro");
    ids.chromium = await criarImovelPronto(ids.dono, `E47A Chromium ${sufixo}`, { ativo: true });
    ids.webkit = await criarImovelPronto(ids.dono, `E47A WebKit ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    if (ids.dono) await apagarContas([ids.dono]);
  });

  test("Chromium 390 px: os sete casos", async ({ browser }, info) => {
    test.skip(info.project.name !== "chromium", "o motor sai dentro do teste");
    const page = await entrar(browser, dono.email, senha);
    try {
      for (const c of CASOS) await test.step(c.id, () => rodarCaso(page, ids.chromium!, c, "chromium"));
    } finally {
      await page.context().close();
    }
  });

  test("WebKit (Safari do iPhone) 390 px: os sete casos", async ({}, info) => {
    test.skip(info.project.name !== "chromium", "o motor sai dentro do teste");
    let wk: Browser | null = null;
    try {
      wk = await webkit.launch();
    } catch (e) {
      test.skip(true, `WebKit indisponível neste runner: ${String(e).slice(0, 120)}`);
    }
    const page = await entrar(wk!, dono.email, senha);
    try {
      for (const c of CASOS) await test.step(c.id, () => rodarCaso(page, ids.webkit!, c, "webkit"));
    } finally {
      await page.context().close();
      await wk!.close();
    }
  });
});
