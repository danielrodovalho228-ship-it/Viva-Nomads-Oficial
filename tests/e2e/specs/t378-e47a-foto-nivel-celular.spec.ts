import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, webkit, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, definirPlano, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { celularComCamera } from "../fixtures/camera";

/*
  T378 — E47-A, PERNA DE LABORATÓRIO (Pista C, 24/10): o "clique em Enviar foto (prova de nível) → TELA BRANCA" que o
  Daniel viu no celular em 23/10. FOTO-NA-HORA-B (decisão do Daniel, 24/10): a prova de nível deixou de aceitar arquivo
  (o caso do arquivo grande/HEIC da galeria não existe mais nesta tela) — a foto é feita na hora, pela câmera. O
  diagnóstico continua o mesmo: em cada caso, registra os erros de console e de página, a resposta de /api/upload/prova,
  a mensagem da tela e o estado da página depois (viva ou branca). A página branca derruba o teste; o resto fica no
  relatório tests/laboratorio/saida/e47a/.
   • Chromium 390 px com câmera falsa: foto normal, rede caindo no envio (o fetch rejeita) e o 413 da Vercel (corpo em
     texto).
   • WebKit (motor do Safari do iPhone) 390 px, sem câmera no laboratório: o botão leva ao caminho sem câmera (QR para o
     celular) e a página segue viva.
*/
const ITEM = "ar_quarto_principal";
const SAIDA = "tests/laboratorio/saida/e47a";

const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.e47a.${sufixo}@lab.vivanomads.test`, nome: "Diana Diagnóstico", role: "owner" as const };
const ids: { dono?: string; chromium?: string; webkit?: string } = {};

interface Escuta {
  consoleErros: string[];
  paginaErros: string[];
  uploads: { status: number; corpo: string }[];
  falhas: string[];
}

async function abrirNivel(page: Page, imovel: string): Promise<Escuta> {
  const e: Escuta = { consoleErros: [], paginaErros: [], uploads: [], falhas: [] };
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") e.consoleErros.push(`${m.type()}: ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (x) => e.paginaErros.push(`${x.name}: ${x.message.slice(0, 300)}`));
  page.on("requestfailed", (r) => {
    if (r.url().includes("/api/upload/prova")) e.falhas.push(r.failure()?.errorText ?? "falhou");
  });
  page.on("response", async (r) => {
    if (r.url().includes("/api/upload/prova")) e.uploads.push({ status: r.status(), corpo: (await r.text().catch(() => "(sem corpo)")).slice(0, 200) });
  });
  await page.goto(`/dashboard/imoveis/${imovel}/nivel`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId(`nivel-foto-${ITEM}-botao`)).toBeEnabled({ timeout: 30_000 });
  return e;
}

async function estadoDaPagina(page: Page) {
  return page.evaluate(() => {
    const texto = document.body?.innerText ?? "";
    return {
      itensNaTela: !!document.querySelector('[data-testid="nivel-itens"]'),
      caracteres: texto.trim().length,
      telaDeErro: /Application error|client-side exception|Algo deu errado|This page couldn.t load|Não conseguimos abrir esta tela/i.test(texto),
      url: location.pathname,
    };
  });
}

async function registrar(page: Page, e: Escuta, motor: string, caso: string, mensagem: string | null) {
  await page.waitForTimeout(1_500); // um respiro para um erro tardio de renderização aparecer
  const estado = await estadoDaPagina(page).catch((x) => ({ itensNaTela: false, caracteres: 0, telaDeErro: true, url: `(sem página: ${String(x).slice(0, 80)})` }));
  // WebKit relata como erro de página o prefetch RSC cancelado na navegação ("… due to access control checks").
  const errosReais = e.paginaErros.filter((x) => !/Fetch API cannot load .* due to access control checks/.test(x));
  const branca = !estado.itensNaTela || estado.telaDeErro || errosReais.length > 0;
  const r = { motor, caso, upload: e.uploads, requisicaoFalhou: e.falhas, mensagem, estado, telaBranca: branca, consoleErros: e.consoleErros, paginaErros: e.paginaErros };
  console.log(`E47A|${motor}|${caso}|branca=${branca}|upload=${JSON.stringify(e.uploads)}|falhou=${JSON.stringify(e.falhas)}|msg=${mensagem}`);
  mkdirSync(SAIDA, { recursive: true });
  writeFileSync(`${SAIDA}/${motor}-${caso}.json`, JSON.stringify(r, null, 2));
  await page.screenshot({ path: `${SAIDA}/${motor}-${caso}.png`, fullPage: true }).catch(() => {});
  expect.soft(branca, `${motor} · ${caso}: a página ficou branca (pageerror=${JSON.stringify(errosReais)}; estado=${JSON.stringify(estado)})`).toBe(false);
}

test.describe("T378 — E47-A: foto da prova de nível no celular (câmera)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await definirPlano(ids.dono, "pro");
    ids.chromium = await criarImovelPronto(ids.dono, `E47A Chromium ${sufixo}`, { ativo: true });
    ids.webkit = await criarImovelPronto(ids.dono, `E47A WebKit ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    if (ids.dono) await apagarContas([ids.dono]);
  });

  test("Chromium 390 px com câmera: normal, rede caindo e 413 da Vercel", async ({}, info) => {
    test.skip(info.project.name !== "chromium", "o motor sai dentro do teste");
    for (const caso of ["rede-caiu", "413-vercel", "normal"] as const) {
      await test.step(caso, async () => {
        // Um celular por caso: cada um tem o seu quadro (hash novo), então a foto normal nunca bate com outra.
        const cel = await celularComCamera({ email: dono.email, senha });
        try {
          const e = await abrirNivel(cel.page, ids.chromium!);
          if (caso === "rede-caiu") await cel.page.route("**/api/upload/prova", (r) => r.abort("internetdisconnected"));
          if (caso === "413-vercel") await cel.page.route("**/api/upload/prova", (r) => r.fulfill({ status: 413, contentType: "text/plain", body: "Request Entity Too Large\n\nFUNCTION_PAYLOAD_TOO_LARGE" }));
          await cel.page.getByTestId(`nivel-foto-${ITEM}-botao`).click();
          await expect(cel.page.getByTestId("camera-prova")).toHaveAttribute("data-etapa", "ao_vivo", { timeout: 20_000 });
          await cel.page.getByTestId("camera-fotografar").click();
          await cel.page.getByTestId("camera-usar").click();
          const msg = caso === "normal" ? cel.page.getByTestId(`nivel-msg-${ITEM}`) : cel.page.getByTestId("camera-msg");
          await msg.waitFor({ state: "visible", timeout: 60_000 }).catch(() => {});
          const texto = await msg.innerText({ timeout: 1_000 }).catch(() => null);
          if (caso !== "normal") await cel.page.getByTestId("camera-fechar").click().catch(() => {});
          await registrar(cel.page, e, "chromium", caso, texto);
          if (caso === "normal") expect(texto).toBe("Foto de Ar-condicionado no quarto principal recebida. O item já conta enquanto a foto é analisada.");
        } finally {
          await cel.fechar();
        }
      });
    }
  });

  test("WebKit (Safari do iPhone) 390 px, sem câmera no laboratório: caminho do QR e página viva", async ({}, info) => {
    test.skip(info.project.name !== "chromium", "o motor sai dentro do teste");
    let wk: Browser | null = null;
    try {
      wk = await webkit.launch();
    } catch (e) {
      test.skip(true, `WebKit indisponível neste runner: ${String(e).slice(0, 120)}`);
    }
    const page = await entrar(wk!, dono.email, senha);
    try {
      const e = await abrirNivel(page, ids.webkit!);
      await page.getByTestId(`nivel-foto-${ITEM}-botao`).click();
      const painel = page.getByTestId(`prova-celular-${ITEM}`).or(page.getByTestId("camera-prova"));
      await painel.first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
      await registrar(page, e, "webkit", "sem-camera", await painel.first().innerText({ timeout: 1_000 }).catch(() => null));
    } finally {
      await page.context().close();
      await wk!.close();
    }
  });
});
