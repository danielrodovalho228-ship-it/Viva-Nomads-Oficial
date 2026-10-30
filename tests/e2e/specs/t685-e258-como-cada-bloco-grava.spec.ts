import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T685 — E258 (#1574): spec permanente da Pista C. A t682 (Pista A) confere os TEXTOS da conferência do Passo 10 e do
  "como grava" de cada bloco do Passo 5; esta prova que o que o texto promete é verdade, sem nenhum "Salvar" a mais:
   1. Ruído — "Vale depois de 'Salvar ruído'": marcado e NÃO salvo, some ao recarregar e nada vai para imovel_ruido;
   2. Extras — "Vale depois de 'Salvar extras'": marcado e não salvo some; marcado e salvo volta e está em imovel_extras;
   3. Acessibilidade — "Cada toque salva na hora.": um toque e recarregar, sem botão nenhum, e o item segue marcado (e
      gravado em imovel_estrutura); outro toque desmarca e também fica.
  Lê também os textos uma vez (390 e 1280), para a prova falar do mesmo bloco que a t682. Conta de teste e rascunho
  semeados aqui e apagados no fim. Só no laboratório.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t685.${sufixo}@lab.vivanomads.test`, nome: "Rita Gravacao", role: "owner" as const };
const conta = { email: dono.email, senha };
const ids: { dono?: string; rascunho?: string } = {};
const BASE = { street: "Rua Santos Dumont", numero: "100", neighborhood: "Centro", city: "Uberlândia", uf: "MG", cep: "", minPeriod: "30", maxPeriod: "180", monthlyPrice: "3200", bathrooms: "1", areaM2: "40", bedrooms: "1", etapaMax: 9 };

/** Liga um bloco opcional pelo toggle (padrão E56) se estiver desligado. */
async function ligar(p: Page, toggle: string) {
  const t = p.getByTestId(toggle);
  await t.evaluate((el) => el.scrollIntoView({ block: "center" }));
  if ((await t.getAttribute("aria-checked")) === "false") await t.click({ timeout: 10_000 });
  await expect(t).toHaveAttribute("aria-checked", "true");
}

test.describe("T685 — E258: cada bloco do Passo 5 grava como diz (Ruído e Extras no botão; acessibilidade a cada toque)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    ids.rascunho = await prepararRascunho(ids.dono, `Studio grava t685 ${sufixo}`, BASE);
  });
  test.afterAll(async () => {
    if (ids.rascunho) {
      await adm().from("imovel_ruido").delete().eq("property_id", ids.rascunho);
      await adm().from("imovel_extras").delete().eq("property_id", ids.rascunho);
      await adm().from("imovel_estrutura").delete().eq("property_id", ids.rascunho);
    }
    await apagarContas([ids.dono]);
  });

  test("1–2. 1280 px — Ruído e Extras: marcado sem salvar some ao recarregar; salvo, volta", async ({ browser }) => {
    const p = await abrirPasso(browser, conta, ids.rascunho!, "comodidades", 1280);
    await ligar(p, "bloco-nivel-ruido-toggle");
    await expect(p.getByTestId("ruido-como-salva")).toHaveText("Vale depois de “Salvar ruído”. Sem nada marcado, salva “não” nas quatro.");
    await p.getByTestId("ruido-via_intensa").click();
    await expect(p.getByTestId("ruido-via_intensa")).toHaveAttribute("aria-checked", "true");

    await ligar(p, "bloco-nivel-extras-toggle");
    await expect(p.getByTestId("extras-como-salva")).toHaveText("Vale depois de “Salvar extras”.");
    const extra = p.locator('[data-testid^="extra-"][role=checkbox]').first();
    const chaveExtra = ((await extra.getAttribute("data-testid")) ?? "").replace(/^extra-/, "");
    await extra.click();
    await expect(extra).toHaveAttribute("aria-checked", "true");
    await p.screenshot({ path: `${SAIDA}/t685-marcado-sem-salvar-1280.png` });

    // Recarrega SEM salvar: nada foi gravado, os blocos nascem desligados e os cartões, desmarcados.
    await p.reload({ waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("assistente-rodape")).toBeVisible({ timeout: 30_000 });
    expect((await adm().from("imovel_ruido").select("property_id").eq("property_id", ids.rascunho!)).data ?? []).toEqual([]);
    expect((await adm().from("imovel_extras").select("chave").eq("property_id", ids.rascunho!)).data ?? []).toEqual([]);
    await ligar(p, "bloco-nivel-ruido-toggle");
    await expect(p.getByTestId("ruido-via_intensa")).toHaveAttribute("aria-checked", "false");
    await ligar(p, "bloco-nivel-extras-toggle");
    await expect(p.getByTestId(`extra-${chaveExtra}`)).toHaveAttribute("aria-checked", "false");

    // Agora marca e salva o Extra: volta marcado e está no banco.
    await p.getByTestId(`extra-${chaveExtra}`).click();
    await p.getByTestId("extras-salvar").click();
    await expect(p.getByTestId("extras-resultado")).toHaveAttribute("role", "status", { timeout: 20_000 });
    await expect
      .poll(async () => ((await adm().from("imovel_extras").select("chave").eq("property_id", ids.rascunho!)).data ?? []).map((r) => r.chave), { timeout: 20_000 })
      .toEqual([chaveExtra]);
    await p.reload({ waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("bloco-nivel-extras-toggle")).toHaveAttribute("aria-checked", "true", { timeout: 30_000 });
    await expect(p.getByTestId(`extra-${chaveExtra}`)).toHaveAttribute("aria-checked", "true");
    await p.context().close();
  });

  test("3. 390 px — Acessibilidade: cada toque grava na hora, sem botão", async ({ browser }) => {
    const p = await abrirPasso(browser, conta, ids.rascunho!, "comodidades", 390);
    await ligar(p, "bloco-estrutura-toggle");
    await expect(p.getByTestId("estrutura-como-salva")).toHaveText("Cada toque salva na hora.");
    const item = p.getByTestId("estrutura-item-entradaSemDegrauOuRampa");
    await item.scrollIntoViewIfNeeded();
    await item.click();
    await expect(item).toHaveAttribute("aria-checked", "true");
    const gravado = async () => ((await adm().from("imovel_estrutura").select("checklist").eq("property_id", ids.rascunho!).maybeSingle()).data?.checklist as Record<string, boolean> | undefined)?.entradaSemDegrauOuRampa ?? null;
    await expect.poll(gravado, { timeout: 20_000 }).toBe(true);
    await expect(p.getByTestId("estrutura-como-salva")).toHaveText("Cada toque salva na hora.", { timeout: 20_000 });

    // Recarrega sem tocar em botão nenhum: o bloco nasce ligado (tem dado) e o item segue marcado.
    await p.reload({ waitUntil: "domcontentloaded" });
    const deNovo = p.getByTestId("estrutura-item-entradaSemDegrauOuRampa");
    await expect(p.getByTestId("bloco-estrutura-toggle")).toHaveAttribute("aria-checked", "true", { timeout: 30_000 });
    await deNovo.scrollIntoViewIfNeeded();
    await expect(deNovo).toHaveAttribute("aria-checked", "true");
    await p.screenshot({ path: `${SAIDA}/t685-acessibilidade-gravada-390.png` });

    // Outro toque desmarca, e isso também grava na hora.
    await deNovo.click();
    await expect(deNovo).toHaveAttribute("aria-checked", "false");
    await expect.poll(gravado, { timeout: 20_000 }).not.toBe(true);
    await p.reload({ waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("assistente-rodape")).toBeVisible({ timeout: 30_000 });
    if ((await p.getByTestId("bloco-estrutura-toggle").getAttribute("aria-checked")) === "true") {
      await expect(p.getByTestId("estrutura-item-entradaSemDegrauOuRampa")).toHaveAttribute("aria-checked", "false");
    }
    await p.context().close();
  });
});
