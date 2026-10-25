import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { entrarNaPagina } from "./laboratorio";

/*
  FOTO-NA-HORA-B — o CELULAR do laboratório: Chromium com câmera falsa (--use-fake-device-for-media-stream e
  --use-fake-ui-for-media-stream, que aceita a permissão sozinho) mostrando um quadro fixo gerado aqui (grade 8×8 de
  cinzas aleatórios, em .y4m). Cada celular novo tem um quadro novo → hash perceptual novo (nunca bate com outra prova
  do laboratório). Duas fotos no MESMO celular são a mesma imagem: é assim que o caso da foto repetida é provado.
  Toque + tela de celular: a tela escolhe a câmera (no computador, o caminho é o QR).
*/
const BASE_URL = (process.env.TESTES_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

/** Um quadro .y4m (YUV 4:2:0) 320×240 com uma grade 8×8 de cinzas aleatórios. */
export function quadroFalso(): string {
  const w = 320;
  const h = 240;
  const blocos = randomBytes(64);
  const y = Buffer.alloc(w * h);
  for (let l = 0; l < h; l++) for (let c = 0; c < w; c++) y[l * w + c] = blocos[Math.floor((l * 8) / h) * 8 + Math.floor((c * 8) / w)];
  const uv = Buffer.alloc((w / 2) * (h / 2) * 2, 128);
  const dir = join(tmpdir(), "vn-camera-falsa");
  mkdirSync(dir, { recursive: true });
  const arquivo = join(dir, `${randomBytes(6).toString("hex")}.y4m`);
  writeFileSync(arquivo, Buffer.concat([Buffer.from(`YUV4MPEG2 W${w} H${h} F1:1 Ip A1:1 C420jpeg\n`), Buffer.from("FRAME\n"), y, uv]));
  return arquivo;
}

export interface Celular {
  browser: Browser;
  ctx: BrowserContext;
  page: Page;
  fechar: () => Promise<void>;
}

/** Abre um celular (390 px, toque) com câmera falsa. Com e-mail e senha, já entra na conta. */
export async function celularComCamera(conta?: { email: string; senha: string }): Promise<Celular> {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-video-capture=${quadroFalso()}`],
  });
  const ctx = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    ...(BYPASS ? { extraHTTPHeaders: { "x-vercel-protection-bypass": BYPASS, "x-vercel-set-bypass-cookie": "true" } } : {}),
  });
  const page = await ctx.newPage();
  if (conta) await entrarNaPagina(page, conta.email, conta.senha);
  return { browser, ctx, page, fechar: () => browser.close() };
}

/** Na câmera aberta: Fotografar → prévia → Usar esta foto. Devolve o que a tela mostrou (aviso ou erro). */
export async function fotografarEUsar(page: Page): Promise<void> {
  const cam = page.getByTestId("camera-prova");
  await expect(cam).toHaveAttribute("data-etapa", "ao_vivo", { timeout: 20_000 });
  await expect(page.getByTestId("camera-dica")).toHaveText("Mostre o item inteiro, sem pessoas, com boa luz.");
  await page.getByTestId("camera-fotografar").click();
  await expect(page.getByTestId("camera-previa")).toBeVisible();
  await page.getByTestId("camera-usar").click();
}
