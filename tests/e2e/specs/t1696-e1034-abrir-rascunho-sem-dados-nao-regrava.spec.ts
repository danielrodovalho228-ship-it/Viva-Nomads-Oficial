import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1696 — E1034 (ORDEM-DUET-174 e 175, 19/11/2026): a t296 (caso 5) ficou vermelha na corrida manual 44495944766. O caso 3 dela
  abre o assistente num rascunho que tem as colunas e as fotos mas não tem `draft_data`; desde o E614 (#4004), o rascunho
  que já existe no servidor grava mesmo com o formulário vazio, e essa abertura regravava a linha inteira: título
  "Rascunho de anúncio", preço 0, bairro, quartos, banheiros, área e descrição a zero, e as 8 fotos apagadas. No caso 5 a
  Central de Pendências já não achava a linha pelo título.
  Regra: abrir o assistente num rascunho sem `draft_data`, sem preencher nada, não grava nada. Só no laboratório.
    1. 1280 px: abre no passo Comodidades (o caminho da t296) e espera o autosave: a linha e as fotos ficam como estavam.
    2. 390 px: abre sem passo na URL, recarrega e espera de novo: a linha e as fotos ficam como estavam.
  O caso do E614 (o rascunho só com o tipo grava o passo) segue coberto pela t1693.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1696.${sufixo}@lab.vivanomads.test`, nome: "Rosa Rascunho", role: "owner" as const };
const TITULO = `[teste-lab] t1696 rascunho ${sufixo}`;
const ESPERA_DO_AUTOSAVE_MS = 6_000; // o autosave espera 2 s; a janela cobre a gravação e a volta do servidor
let donoId = "";

type Linha = Record<string, unknown> & { fotos: string[] };

async function linha(id: string): Promise<Linha> {
  const { data, error } = await adm()
    .from("properties")
    .select("title, city, address, monthly_price, bedrooms, bathrooms, area_m2, description, status, draft_data")
    .eq("id", id)
    .single();
  if (error) throw error;
  const fotos = await adm().from("property_photos").select("url").eq("property_id", id).order("sort_order");
  if (fotos.error) throw fotos.error;
  return { ...(data as Record<string, unknown>), fotos: (fotos.data ?? []).map((f) => f.url as string) };
}

test.describe("T1696 — E1034: abrir o rascunho sem draft_data não regrava a linha @E1034", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    donoId = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    if (donoId) await apagarContas([donoId]);
  });

  for (const [largura, rotulo, comPasso] of [[1280, "abre no passo Comodidades", true], [390, "abre sem passo e recarrega", false]] as const) {
    test(`${largura} px, ${rotulo}: a linha e as fotos do rascunho ficam como estavam`, async ({ browser }) => {
      const id = await criarImovelPronto(donoId, `${TITULO} ${largura}`);
      const antes = await linha(id);
      // O rascunho do teste é o que a regra descreve: colunas e fotos preenchidas, sem o estado do editor.
      expect(antes.draft_data, "o rascunho do teste não tem draft_data").toBeNull();
      expect(antes.fotos, "o rascunho do teste tem 8 fotos").toHaveLength(8);

      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/dashboard/imoveis/novo?draft=${id}${comPasso ? "&etapa=comodidades" : ""}`, { waitUntil: "domcontentloaded" });
      if (comPasso) await expect(page.getByTestId("nivel-cadastro")).toBeVisible({ timeout: 30_000 });
      else await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(ESPERA_DO_AUTOSAVE_MS);
      expect(await linha(id), "depois de abrir o assistente, sem preencher nada").toEqual(antes);

      if (!comPasso) {
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(ESPERA_DO_AUTOSAVE_MS);
        expect(await linha(id), "depois de recarregar, sem preencher nada").toEqual(antes);
      }
      await page.context().close();
    });
  }
});
