// Portão pós-#1500 (Pista C, 29/10): o E193 (#1496) trocou listas e caixas por pílulas e cartões no assistente e no editor; roda no lab-crítico deste PR.
import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso, abrirSecoesPasso10 } from "../fixtures/cadastro";
import { prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T548 — E132-A (#1396), guarda permanente da Pista C: as declarações de um toque do "Antes de publicar" (Passo 10) não
  se perdem. A t481 da Pista A cobre as 5 telas, o Resultado e os toggles; aqui, a PERSISTÊNCIA:
   1. a qualificação do servidor já diz "IPTU em dia" e "Água, luz e gás" (qualification_checklists.formulario.elig) e
      o rascunho tem as declarações EM BRANCO → o Passo 10 abre com as duas marcadas (o rascunho em branco não apaga a
      qualificação — a correção afd58455 do #1396) e continua assim depois de recarregar;
   2. as declarações marcadas no Passo 10 ficam gravadas no rascunho (draft_data.declaracoesPasso10) e voltam marcadas
      depois de recarregar.
  A 1280 e 390 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t548.${sufixo}@lab.vivanomads.test`, nome: "Dalva Declara", role: "owner" as const };
const ids: Record<string, string> = {};
const EM_BRANCO = { iptuOk: false, habitavel: false, convencao: "" };

async function abrirRevisao(page: import("@playwright/test").Page, id: string) {
  await page.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=revisao`, { waitUntil: "domcontentloaded" });
  await noPasso(page, "revisao", 30_000);
  await abrirSecoesPasso10(page, ["declaracoes"]); // E251: as seções são um acordeão
  await expect(page.getByTestId("declaracoes-passo10")).toBeVisible({ timeout: 20_000 });
}

test.describe("T548 — E132-A: as declarações do Passo 10 não se perdem", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    for (const w of [1280, 390]) {
      ids[`servidor${w}`] = await prepararRascunho(ids.dono, `Apto declarado t548 ${w} ${sufixo}`, { propertyType: "apartamento", declaracoesPasso10: EM_BRANCO }, 0);
      const { error } = await adm()
        .from("qualification_checklists")
        .update({ formulario: { versao: 1, elig: { iptuOk: true, habitable: true, condoAllows: "yes" } } })
        .eq("property_id", ids[`servidor${w}`]);
      if (error) throw error;
      ids[`toque${w}`] = await prepararRascunho(ids.dono, `Apto tocado t548 ${w} ${sufixo}`, { propertyType: "apartamento" }, 0);
    }
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [1280, 390] as const) {
    test(`1. a ${w} px: rascunho em branco não apaga a qualificação do servidor`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      for (const rodada of ["abrir", "recarregar"]) {
        await abrirRevisao(page, ids[`servidor${w}`]);
        await expect(page.getByTestId("declaracao-iptu"), `IPTU (${rodada})`).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });
        await expect(page.getByTestId("declaracao-habitavel"), `água/luz/gás (${rodada})`).toHaveAttribute("aria-checked", "true");
      }
      await page.getByTestId("declaracoes-passo10").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `tests/laboratorio/saida/t548-servidor-${w}.png` });
      await page.context().close();
    });

    test(`2. a ${w} px: o que se marca no Passo 10 fica no rascunho e volta marcado`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      const id = ids[`toque${w}`];
      await abrirRevisao(page, id);
      const iptu = page.getByTestId("declaracao-iptu");
      const habitavel = page.getByTestId("declaracao-habitavel");
      await expect(iptu).toHaveAttribute("aria-checked", "false", { timeout: 15_000 });
      await iptu.click();
      await habitavel.click();
      await expect(iptu).toHaveAttribute("aria-checked", "true");
      await expect
        .poll(async () => ((await adm().from("properties").select("draft_data").eq("id", id).single()).data?.draft_data as Record<string, { iptuOk?: boolean; habitavel?: boolean }> | null)?.declaracoesPasso10 ?? null, { timeout: 20_000 })
        .toMatchObject({ iptuOk: true, habitavel: true });
      await page.reload({ waitUntil: "domcontentloaded" });
      await noPasso(page, "revisao", 30_000);
      await abrirSecoesPasso10(page, ["declaracoes"]);
      await expect(page.getByTestId("declaracao-iptu")).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });
      await expect(page.getByTestId("declaracao-habitavel")).toHaveAttribute("aria-checked", "true");
      await page.context().close();
    });
  }
});
