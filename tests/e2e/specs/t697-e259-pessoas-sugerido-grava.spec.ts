import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T697 — E259 (6) (#1587), o que a t691 não grava nem varia. Pista C, 30/10. A t691 prova o "2" de um rascunho sem
  quartos; esta prova a conta e o que acontece depois:
   1. Rascunho com 3 quartos e "Pessoas" vazio: do Passo 3, "Continuar" leva ao Passo 4 com 6 (2 por quarto), marcado
      "Sugerido · confira", e o autosave grava o 6 no rascunho (draft_data.maxGuests). 390 e 1280.
   2. Rascunho com 3 quartos e "Pessoas" = 5 já respondido: chega 5, sem a marca de sugestão, e o rascunho segue 5.
   3. Mexer no número tira a marca: com a sugestão na tela, o dono troca para 3 e a marca some; o rascunho grava 3.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t697.${sufixo}@lab.vivanomads.test`, nome: "Iris Pessoas", role: "owner" as const };
const ids: Record<string, string> = {};
const END = { cep: "38400-060", street: "Rua Santos Dumont", numero: "100", neighborhood: "Centro", city: "Uberlândia", uf: "MG" };

async function maxGuestsDoRascunho(id: string): Promise<string | undefined> {
  const { data, error } = await adm().from("properties").select("draft_data").eq("id", id).single();
  if (error) throw error;
  const v = (data?.draft_data as { maxGuests?: unknown } | null)?.maxGuests;
  return v === undefined || v === null ? undefined : String(v);
}

test.describe("T697 — E259 (6): Pessoas sugerido pela conta dos quartos, grava no rascunho e respeita o que o dono pôs", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    for (const w of [1280, 390]) ids[`vazio${w}`] = await prepararRascunho(ids.dono, `Casa Tres Quartos ${w} ${sufixo}`, { ...END, bedrooms: "3" });
    ids.respondido = await prepararRascunho(ids.dono, `Casa Respondida ${sufixo}`, { ...END, bedrooms: "3", maxGuests: "5" });
    ids.mexe = await prepararRascunho(ids.dono, `Casa Mexe ${sufixo}`, { ...END, bedrooms: "3" });
    for (const k of ["vazio1280", "vazio390", "mexe"]) expect(await maxGuestsDoRascunho(ids[k])).toBeUndefined();
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [1280, 390] as const) {
    test(`1. ${w} px — 3 quartos e Pessoas vazio: chega 6, marcado sugerido, e o rascunho grava 6`, async ({ browser }) => {
      const p = await abrirPasso(browser, { email: dono.email, senha }, ids[`vazio${w}`], "endereco", w);
      await p.getByTestId("cadastro-continuar").click();
      const campo = p.getByTestId("cadastro-capacidade");
      await expect(campo).toHaveValue("6", { timeout: 20_000 });
      await expect(p.getByTestId("linha-cadastro-capacidade").getByTestId("marca-sugerido")).toBeVisible();
      await expect.poll(() => maxGuestsDoRascunho(ids[`vazio${w}`]), { timeout: 30_000 }).toBe("6");
      await p.getByTestId("linha-cadastro-capacidade").scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t697-sugerido-${w}.png` });
      await p.context().close();
    });
  }

  test("2. 1280 px — Pessoas já respondido (5): chega 5, sem a marca, e o rascunho segue 5", async ({ browser }) => {
    const p = await abrirPasso(browser, { email: dono.email, senha }, ids.respondido, "endereco", 1280);
    await p.getByTestId("cadastro-continuar").click();
    await expect(p.getByTestId("cadastro-capacidade")).toHaveValue("5", { timeout: 20_000 });
    await expect(p.getByTestId("linha-cadastro-capacidade").getByTestId("marca-sugerido")).toHaveCount(0);
    // Dá tempo ao autosave e confere que nada trocou o 5.
    await p.waitForTimeout(3_000);
    expect(await maxGuestsDoRascunho(ids.respondido)).toBe("5");
    await p.context().close();
  });

  test("3. 1280 px — trocar o número tira a marca e o rascunho grava o novo", async ({ browser }) => {
    const p = await abrirPasso(browser, { email: dono.email, senha }, ids.mexe, "endereco", 1280);
    await p.getByTestId("cadastro-continuar").click();
    const campo = p.getByTestId("cadastro-capacidade");
    await expect(campo).toHaveValue("6", { timeout: 20_000 });
    await campo.fill("3");
    await expect(p.getByTestId("linha-cadastro-capacidade").getByTestId("marca-sugerido")).toHaveCount(0);
    await expect.poll(() => maxGuestsDoRascunho(ids.mexe), { timeout: 30_000 }).toBe("3");
    await p.context().close();
  });
});
