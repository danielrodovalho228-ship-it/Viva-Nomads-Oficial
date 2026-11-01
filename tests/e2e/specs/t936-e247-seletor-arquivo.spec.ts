import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, pngDeTeste } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T936 — E247 resíduo (#2031, Pista A): o seletor de arquivo do site (SeletorArquivo) nas telas que ainda mostravam o nativo
  ("Choose File / No file chosen" num navegador em inglês). Na tela de verdade, a 390 e a 1280 px, em duas delas:
   - Admin → Sistema, "Testar leitura" (testar-leitura-arquivo), com a sessão de admin;
   - Conferir documento pelo código (conferir-arquivo), como visitante — com um código de verdade de documentos_fiscais
     (se o laboratório não tiver nenhum, esse caso pula: sem documento, a tela não mostra o seletor).
  Em cada uma: o campo nativo continua no formulário mas fica escondido (sr-only: ≤ 1×1 px), o botão visível fala
  português ("Escolher arquivo" no Testar leitura; "Escolher o PDF" no Conferir), ao lado aparece "Nenhum arquivo
  escolhido"; nenhum "Choose File"/"No file chosen" na
  tela; ao escolher um arquivo, o nome dele aparece no lugar. Nada é gravado.
*/
const SAIDA = "tests/laboratorio/saida";
let codigo = "";

async function conferirSeletor(page: Page, testid: string, onde: string, largura: number, rotulo: string, arquivo: { name: string; mimeType: string; buffer: Buffer }) {
  const campo = page.getByTestId(testid);
  await expect(campo).toBeAttached({ timeout: 30_000 });
  const seletor = page.locator("[data-seletor-arquivo]").filter({ has: campo });
  await seletor.scrollIntoViewIfNeeded();
  const m = await campo.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { tipo: (e as HTMLInputElement).type, w: Math.round(r.width), h: Math.round(r.height), sr: e.classList.contains("sr-only") };
  });
  const textoAntes = (await seletor.innerText()).replace(/\s+/g, " ").trim();
  console.log(`t936|${onde}|${largura}|campo=${JSON.stringify(m)}|antes=${textoAntes}`);
  expect(m.tipo).toBe("file");
  expect(m.sr, `${onde}: o campo nativo fica escondido (sr-only)`).toBe(true);
  expect(m.w <= 1 && m.h <= 1, `${onde}: o nativo não aparece (${m.w}×${m.h})`).toBe(true);
  expect(textoAntes, `${onde}: o botão em português`).toContain(rotulo);
  expect(textoAntes).toContain("Nenhum arquivo escolhido");
  expect((await page.locator("body").innerText())).not.toMatch(/Choose File|No file chosen/);
  await campo.setInputFiles(arquivo);
  await expect(seletor).toContainText(arquivo.name);
  await expect(seletor).not.toContainText("Nenhum arquivo escolhido");
}

test.describe("T936 — E247 resíduo (#2031): o seletor de arquivo do site (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");

  test.beforeAll(async () => {
    const { data } = await adm().from("documentos_fiscais").select("codigo_verificacao").limit(1);
    codigo = String((data?.[0] as { codigo_verificacao?: string } | undefined)?.codigo_verificacao ?? "");
  });

  for (const largura of [390, 1280] as const) {
    test(`Admin → Sistema (Testar leitura) @${largura}`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      await page.goto("/admin/sistema", { waitUntil: "domcontentloaded" });
      await conferirSeletor(page, "testar-leitura-arquivo", "admin-sistema", largura, "Escolher arquivo", { name: `prova-t936-${largura}.png`, mimeType: "image/png", buffer: pngDeTeste(3) });
      await page.screenshot({ path: `${SAIDA}/t936-sistema-${largura}.png` });
      await ctx.close();
    });

    test(`Conferir documento pelo código @${largura}`, async ({ browser }) => {
      test.skip(!codigo, "laboratório sem documento em documentos_fiscais: a tela não mostra o seletor");
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      await page.goto(`/conferir/${codigo}`, { waitUntil: "domcontentloaded" });
      await conferirSeletor(page, "conferir-arquivo", "conferir", largura, "Escolher o PDF", { name: `prova-t936-${largura}.pdf`, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% prova t936\n") });
      await page.screenshot({ path: `${SAIDA}/t936-conferir-${largura}.png` });
      await ctx.close();
    });
  }
});
