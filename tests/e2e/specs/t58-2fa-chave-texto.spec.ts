import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { account } from "../fixtures/accounts";
import { NO_LABORATORIO, adm } from "../fixtures/laboratorio";
import { gerarCodigoTotp } from "../fixtures/totp";
import type { Page } from "@playwright/test";

/**
 * Laboratório: apaga pela API de admin qualquer fator TOTP que uma rodada anterior deixou na conta de teste
 * (lab de 20/10: o "cenário obrigatório" a 360 px ativou o fator e a limpeza dele saiu cedo, então o teste
 * de 390 px abriu a tela já "Ativada" e não achou "Ativar duas etapas"). Fora do laboratório não faz nada.
 */
async function zerarFatoresNoLab(papel: "proprietario") {
  if (!NO_LABORATORIO) return;
  const email = account(papel).email.toLowerCase();
  const { data } = await adm().auth.admin.listUsers({ perPage: 1000 });
  const usuario = data?.users.find((u) => u.email?.toLowerCase() === email);
  if (!usuario) return;
  const { data: fatores } = await adm().auth.admin.mfa.listFactors({ userId: usuario.id });
  for (const f of fatores?.factors ?? []) await adm().auth.admin.mfa.deleteFactor({ id: f.id, userId: usuario.id });
}

/** Remove o fator TOTP da conta de teste se ele estiver ativo (código de outra janela de 30 s). Nunca lança. */
async function removerFator(page: Page, segredo: string) {
  try {
    await page.goto("/dashboard/conta/seguranca");
    const remover = page.getByRole("button", { name: "Remover verificação" });
    // isVisible() não espera (o timeout é ignorado): logo após o goto o estado do fator ainda não carregou e a
    // limpeza saía sem remover nada. Espera de verdade o botão aparecer.
    if (!(await remover.waitFor({ state: "visible", timeout: 10_000 }).then(() => true).catch(() => false))) return;
    const contador = Math.floor(Date.now() / 30000);
    await remover.click();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.waitForFunction((c) => Math.floor(Date.now() / 30000) > c, contador, { timeout: 35000 });
    await page.locator("#codigo-remover").fill(gerarCodigoTotp(segredo));
    await page.getByRole("button", { name: "Confirmar remoção" }).click();
    await page.getByRole("button", { name: /Ativar duas etapas/ }).waitFor({ timeout: 10000 });
  } catch {
    /* limpeza best-effort: o erro do teste original é o que importa */
  }
}

/** Clique antes da hidratação não abre a ativação: repete até a chave em texto aparecer (e não gasta os 240 s à toa). */
async function abrirAtivacao(page: Page) {
  await expect(async () => {
    await page.getByRole("button", { name: /Ativar duas etapas/ }).click({ timeout: 5_000 });
    await expect(page.getByTestId("chave-2fa")).toBeVisible({ timeout: 4_000 });
  }).toPass({ timeout: 45_000 });
}

/**
 * T58 — ativação do 2FA no celular (ordens 33c943b4 item 3/4 e 1d1967f4):
 * chave em texto agrupada de 4 em 4, "Copiar código" e link otpauth:// ANTES do QR,
 * sem nada sobrepondo campos ou botões a 360/390 px.
 */
// Série: 360 e 390 px usam a MESMA conta proprietário; em paralelo cadastrariam/verificariam fatores ao mesmo tempo.
test.describe.configure({ mode: "serial" });
test.beforeEach(async () => {
  await zerarFatoresNoLab("proprietario");
});

for (const largura of [360, 390]) {
  test.describe(`T58 — 2FA chave em texto (${largura}px)`, () => {
    test.use({ storageState: authFile("proprietario"), viewport: { width: largura, height: 800 }, permissions: ["clipboard-read", "clipboard-write"] });

    test("mostra a chave, copia e oferece o link do app antes do QR", async ({ page }) => {
      // O prazo vale desde o início: antes ele só era ampliado depois do goto/clique e o teste estourava os 45 s.
      test.setTimeout(240000);
      await page.goto("/dashboard/conta/seguranca");
      await abrirAtivacao(page);

      const chave = page.getByTestId("chave-2fa");
      await expect(chave).toBeVisible();
      const texto = (await chave.textContent())?.trim() ?? "";
      const segredo = texto.replace(/\s/g, "");
      expect(texto).toMatch(/^([A-Z2-7]{4} )*[A-Z2-7]{1,4}$/);

      const link = page.getByRole("link", { name: "Abrir no app autenticador" });
      await expect(link).toHaveAttribute("href", /^otpauth:\/\/totp\/.*secret=[A-Z2-7]+/);
      const qr = page.getByAltText("QR code para o app autenticador");
      expect((await link.boundingBox())!.y).toBeLessThan((await qr.boundingBox())!.y);

      await page.getByRole("button", { name: "Copiar código" }).click();
      await expect(page.getByRole("button", { name: "Copiado!" })).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(texto.replace(/\s/g, ""));

      // Nenhum botão/campo da tela é coberto por outro elemento (elementFromPoint no centro).
      // Numa leitura só (antes eram 3 idas ao navegador por alvo e o teste estourava os 150 s no lab).
      const cobertos = await page.evaluate(() => {
        const ruins: number[] = [];
        document.querySelectorAll("main button, main input, main a[href]").forEach((e, i) => {
          const el = e as HTMLElement;
          const caixa = el.getBoundingClientRect();
          if (caixa.width === 0 || caixa.height === 0) return;
          el.scrollIntoView({ block: "center", behavior: "instant" });
          const r = el.getBoundingClientRect();
          const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          if (!topo || !(el === topo || el.contains(topo))) ruins.push(i);
        });
        return ruins;
      });
      expect(cobertos, `alvos cobertos: ${cobertos.join(",")}`).toEqual([]);

      // Estado ATIVO (ordem 7d4cb427): confirma o código e mede o botão "Remover verificação".
      try {
        const contador = Math.floor(Date.now() / 30000);
        await page.locator("#codigo-ativar").fill(gerarCodigoTotp(segredo));
        await page.getByRole("button", { name: "Confirmar código e ativar" }).click();
        const remover = page.getByRole("button", { name: "Remover verificação" });
        await expect(remover).toBeVisible();
        const caixa = (await remover.boundingBox())!;
        expect(caixa.height).toBeGreaterThanOrEqual(44);
        expect(caixa.x + caixa.width).toBeLessThanOrEqual(largura);
        const livreAtivo = await remover.evaluate((e) => {
          e.scrollIntoView({ block: "center", behavior: "instant" });
          const r = e.getBoundingClientRect();
          const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return !!topo && (e === topo || e.contains(topo));
        });
        expect(livreAtivo, "Remover verificação coberto").toBe(true);

        // Limpeza: remove o fator para não acumular a cada rodada (código de outra janela de 30 s).
        await remover.click();
        await page.getByRole("button", { name: "Continuar", exact: true }).click();
        await page.waitForFunction((c) => Math.floor(Date.now() / 30000) > c, contador, { timeout: 35000 });
        await page.locator("#codigo-remover").fill(gerarCodigoTotp(segredo));
        await page.getByRole("button", { name: "Confirmar remoção" }).click();
        await expect(page.getByRole("button", { name: /Ativar duas etapas/ })).toBeVisible();
      } finally {
        // Limpeza garantida: mesmo se o teste falhar no meio, remove o fator para a conta não ficar com 2FA.
        await removerFator(page, segredo);
      }
    });
    // Ordem c09fadd5 item 3 (achado do Moacir, 458dd4ad): no cenário obrigatório (admin) o botão
    // "Continuar para o destino" aparece sozinho na linha, com fonte ≥ 12 px e altura ≥ 44 px.
    test("cenário obrigatório: 'Continuar para o destino' tem 44 px e fonte legível", async ({ page }) => {
      test.setTimeout(240000);
      await page.goto("/dashboard/conta/seguranca?obrigatorio=admin&redirect=%2Fadmin");
      await abrirAtivacao(page);
      const segredo = ((await page.getByTestId("chave-2fa").textContent()) ?? "").replace(/\s/g, "");
      try {
        await page.locator("#codigo-ativar").fill(gerarCodigoTotp(segredo));
        await page.getByRole("button", { name: "Confirmar código e ativar" }).click();
        const continuar = page.getByRole("link", { name: "Continuar para o destino" });
        await expect(continuar).toBeVisible();
        const caixa = (await continuar.boundingBox())!;
        expect(caixa.height).toBeGreaterThanOrEqual(44);
        expect(caixa.x + caixa.width).toBeLessThanOrEqual(largura);
        const fonte = await continuar.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
        expect(fonte).toBeGreaterThanOrEqual(12);
        // Um por linha: nenhum outro link/botão da tela divide a faixa vertical do botão.
        const outros = await page.locator("main a[href], main button").evaluateAll((els, alvo) => {
          return els.filter((e) => {
            const r = e.getBoundingClientRect();
            return r.width > 0 && !(e as HTMLElement).innerText.includes("Continuar para o destino") &&
              r.top < alvo.bottom && r.bottom > alvo.top;
          }).length;
        }, { top: caixa.y, bottom: caixa.y + caixa.height });
        expect(outros, "outro alvo na mesma linha do botão").toBe(0);
      } finally {
        await removerFator(page, segredo);
      }
    });
  });
}
