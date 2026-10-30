import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T682 — E258 (travessia 1→10 do QA, 30/10). 1280 e 390, com prints.
   (a) Endereço "feito" sem CEP: a lista diz que o "O que tem por perto" fica de fora; com CEP, a nota some. O Passo 5
       diz a mesma regra (CEP e rua, no Passo 3; o CEP não segura a publicação).
   (b) Disponibilidade "feito" sem "Disponível a partir de": a lista diz "Disponível agora (sem data de início)"; com a
       data, "Disponível a partir de dd/mm/aaaa".
   (c) Passo 5: cada bloco diz como grava — Ruído e Extras no botão; acessibilidade a cada toque.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t682.${sufixo}@lab.vivanomads.test`, nome: "Nina Conferencia", role: "owner" as const };
const ids: { dono?: string; semCep?: string; comCep?: string } = {};
const BASE = { street: "Rua Santos Dumont", numero: "100", neighborhood: "Centro", city: "Uberlândia", uf: "MG", minPeriod: "30", maxPeriod: "180", monthlyPrice: "3200", bathrooms: "1", areaM2: "40", bedrooms: "1", etapaMax: 9 };

test.describe("T682 — E258: a conferência explica o opcional vazio; o Passo 5 diz como cada bloco grava", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    ids.semCep = await prepararRascunho(ids.dono, `Studio sem CEP ${sufixo}`, { ...BASE, cep: "" });
    ids.comCep = await prepararRascunho(ids.dono, `Studio com CEP ${sufixo}`, { ...BASE, cep: "38400-060", availableFrom: "2026-12-01" });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [1280, 390] as const) {
    test(`(a)(b) ${w} px — Passo 10: as notas dos itens feitos`, async ({ browser }) => {
      const p = await abrirPasso(browser, { email: dono.email, senha }, ids.semCep!, "revisao", w);
      const lista = p.getByTestId("lista-conferencia");
      await expect(lista).toBeVisible({ timeout: 30_000 });
      await expect(p.getByTestId("conferencia-endereco")).toHaveAttribute("data-ok", "1");
      await expect(p.getByTestId("conferencia-nota-endereco")).toHaveText("Sem CEP: o “O que tem por perto” fica de fora do anúncio.");
      await expect(p.getByTestId("conferencia-disponibilidade")).toHaveAttribute("data-ok", "1");
      await expect(p.getByTestId("conferencia-nota-disponibilidade")).toHaveText("Disponível agora (sem data de início).");
      await lista.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t682-conferencia-sem-${w}.png`, fullPage: w === 390 });
      await p.context().close();

      const q = await abrirPasso(browser, { email: dono.email, senha }, ids.comCep!, "revisao", w);
      await expect(q.getByTestId("lista-conferencia")).toBeVisible({ timeout: 30_000 });
      await expect(q.getByTestId("conferencia-nota-endereco")).toHaveCount(0);
      await expect(q.getByTestId("conferencia-nota-disponibilidade")).toHaveText("Disponível a partir de 01/12/2026.");
      await q.getByTestId("lista-conferencia").scrollIntoViewIfNeeded();
      await q.screenshot({ path: `${SAIDA}/t682-conferencia-com-${w}.png`, fullPage: w === 390 });
      await q.context().close();
    });

    test(`(a)(c) ${w} px — Passo 5: o aviso do por perto e a regra de gravar de cada bloco`, async ({ browser }) => {
      const p = await abrirPasso(browser, { email: dono.email, senha }, ids.semCep!, "comodidades", w);
      await expect(p.getByTestId("proximidades-aguardando")).toContainText("quando o endereço tiver CEP e rua (Passo 3). O CEP não segura a publicação", { timeout: 30_000 });
      for (const b of ["bloco-nivel-ruido-toggle", "bloco-nivel-extras-toggle", "bloco-estrutura-toggle"]) {
        const t = p.getByTestId(b);
        if ((await t.getAttribute("aria-checked")) === "false") {
          await t.evaluate((el) => el.scrollIntoView({ block: "center" }));
          await t.click({ timeout: 10_000 });
        }
      }
      await expect(p.getByTestId("ruido-como-salva")).toHaveText("Vale depois de “Salvar ruído”. Sem nada marcado, salva “não” nas quatro.");
      await expect(p.getByTestId("extras-como-salva")).toHaveText("Vale depois de “Salvar extras”.");
      await expect(p.getByTestId("estrutura-como-salva")).toHaveText("Cada toque salva na hora.");
      await p.getByTestId("ruido-form").scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t682-passo5-${w}.png` });
      await p.context().close();
    });
  }
});
