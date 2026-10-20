import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { adm, NO_LABORATORIO } from "../fixtures/laboratorio";

/**
 * T238 — Admin › cartão "Backup e recuperação" (Resiliência 2). O cartão lê public.backups_execucoes (0191):
 * verde com cópia < 36 h e teste de restauração < 8 dias; vermelho se a última cópia falhou, se a cópia tem mais de
 * 36 h ou o teste mais de 8 dias; acima de 10 GB na pasta do Drive sugere o Google One. 390 e 1280 px, sem rolagem
 * lateral. As linhas são inseridas com o cliente de serviço e apagadas no fim.
 */
const LARGURAS = [390, 1280];
const H = 3_600_000;

test.describe("T238 — Admin: cartão Backup e recuperação", () => {
  test.use({ storageState: authFile("admin") });
  test.describe.configure({ mode: "serial" });
  test.skip(!NO_LABORATORIO, "Precisa do banco do laboratório.");

  const ids: string[] = [];
  const agora = Date.now();
  const em = (horasAtras: number) => new Date(agora - horasAtras * H).toISOString();

  async function inserir(linhas: Record<string, unknown>[]): Promise<void> {
    const { data, error } = await adm().from("backups_execucoes").insert(linhas).select("id");
    if (error) throw error;
    ids.push(...(data ?? []).map((l) => l.id as string));
  }
  async function apagarMinhas(): Promise<void> {
    if (ids.length) await adm().from("backups_execucoes").delete().in("id", ids.splice(0));
  }
  async function abrir(page: Page, largura: number) {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    const cartao = page.getByTestId("cartao-backup");
    await expect(cartao).toBeVisible({ timeout: 30_000 });
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra, `rolagem lateral a ${largura}px`).toBeLessThanOrEqual(0);
    return cartao;
  }

  test.afterAll(async () => {
    if (NO_LABORATORIO) await apagarMinhas();
  });

  test("verde: cópia de 1 h e teste de 2 dias, com tamanhos, duração e o passo a passo", async ({ page }) => {
    await inserir([
      { tipo: "copia", inicio: em(1.1), fim: em(1), ok: true, bytes_banco: 34 * 1024 ** 2, objetos_storage: 812, bytes_storage: 35 * 1024 ** 2, bytes_pasta: 2 * 1024 ** 3 },
      { tipo: "drill", inicio: em(48.1), fim: em(48), ok: true, bytes_banco: 34 * 1024 ** 2, duracao_restauracao_s: 252 },
    ]);
    for (const largura of LARGURAS) {
      const cartao = await abrir(page, largura);
      await expect(cartao).toHaveAttribute("data-estado", "verde");
      await expect(page.getByTestId("cartao-backup-estado")).toHaveText("Em dia");
      await expect(page.getByTestId("backup-copia")).toContainText("Banco: 34 MB");
      await expect(page.getByTestId("backup-copia")).toContainText("Arquivos: 812 (35 MB)");
      await expect(page.getByTestId("backup-teste")).toContainText("Duração da restauração: 4 min 12 s");
      await expect(page.getByTestId("backup-copia")).toContainText("(horário de Brasília)");
      await expect(page.getByTestId("cartao-backup-pasta")).toContainText("2,0 GB de 15 GB");
      await expect(page.getByTestId("cartao-backup-pasta")).not.toContainText("Google One");
      await expect(page.getByTestId("cartao-backup-restauracao")).toHaveAttribute("href", /\/blob\/main\/docs\/RESTAURACAO\.md$/);
    }
  });

  test("vermelho: a última cópia falhou (com o motivo curto)", async ({ page }) => {
    await inserir([{ tipo: "copia", inicio: em(0.2), fim: em(0.1), ok: false, motivo: "falha na etapa: dump do banco" }]);
    for (const largura of LARGURAS) {
      const cartao = await abrir(page, largura);
      await expect(cartao).toHaveAttribute("data-estado", "vermelho");
      await expect(page.getByTestId("cartao-backup-estado")).toHaveText("Atenção");
      await expect(page.getByTestId("backup-copia")).toHaveAttribute("data-estado", "vermelho");
      await expect(page.getByTestId("backup-copia-porque")).toHaveText("A última cópia falhou.");
      await expect(page.getByTestId("backup-copia-motivo")).toContainText("falha na etapa: dump do banco");
      await expect(page.getByTestId("backup-teste")).toHaveAttribute("data-estado", "verde");
    }
  });

  test("vermelho: cópia com mais de 36 h, teste com mais de 8 dias e pasta acima de 10 GB", async ({ page }) => {
    await apagarMinhas();
    await inserir([
      { tipo: "copia", inicio: em(40.1), fim: em(40), ok: true, bytes_banco: 34 * 1024 ** 2, objetos_storage: 812, bytes_storage: 35 * 1024 ** 2, bytes_pasta: 11 * 1024 ** 3 },
      { tipo: "drill", inicio: em(9 * 24 + 0.1), fim: em(9 * 24), ok: true, duracao_restauracao_s: 300 },
    ]);
    for (const largura of LARGURAS) {
      const cartao = await abrir(page, largura);
      await expect(cartao).toHaveAttribute("data-estado", "vermelho");
      await expect(page.getByTestId("backup-copia-porque")).toHaveText("A última cópia tem mais de 36 h.");
      await expect(page.getByTestId("backup-teste-porque")).toHaveText("O último teste de restauração tem mais de 8 dias.");
      await expect(page.getByTestId("cartao-backup-pasta")).toContainText("Passou de 10 GB: avalie o Google One.");
    }
  });
});
