import { test, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { prepararRascunho } from "../fixtures/rascunho-cadastro";

/* SONDA (ORDEM-DUET-180, item 2), NUNCA MERGEAR: a barra de progresso da /novo leu 7 e depois 0 na ronda das 06:00.
   Regista o aria-valuenow da barra do rodapé (e da qualificação) ao longo do tempo, em três cenários. */
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: string[] = [];

async function gravar(page: Page, rotulo: string, ms = 8_000) {
  const seq: string[] = [];
  const t0 = Date.now();
  let ultimo = "";
  while (Date.now() - t0 < ms) {
    const v = await page.evaluate(() =>
      [...document.querySelectorAll('[role="progressbar"]')].map((e) => `${e.getAttribute("aria-label") ?? "?"}=${e.getAttribute("aria-valuenow")}`).join(" | "),
    );
    if (v !== ultimo) {
      seq.push(`${Date.now() - t0}ms ${v || "(sem barra)"}`);
      ultimo = v;
    }
    await page.waitForTimeout(100);
  }
  console.log(`SONDA-BARRA | ${rotulo} | ${seq.join(" → ")}`);
}

test.describe("sonda barra /novo", () => {
  test.skip(!NO_LABORATORIO, "lab");
  test.setTimeout(180_000);
  test.afterAll(async () => apagarContas(ids));

  test("A: dono sem rascunho abre /novo", async ({ browser }) => {
    const email = `dono.sondabarra.a.${sufixo}@lab.vivanomads.test`;
    ids.push(await criarConta({ email, nome: "Sonda Barra A", role: "owner" }, senha));
    const page = await entrar(browser, email, senha);
    await page.goto("/dashboard/imoveis/novo", { waitUntil: "commit" });
    await gravar(page, "A sem rascunho");
  });

  test("B: dono com rascunho parcial abre /novo; depois 'Começar outro'", async ({ browser }) => {
    const email = `dono.sondabarra.b.${sufixo}@lab.vivanomads.test`;
    const id = await criarConta({ email, nome: "Sonda Barra B", role: "owner" }, senha);
    ids.push(id);
    await prepararRascunho(id, `Sonda barra B ${sufixo}`, { propertyType: "apartamento", street: "Rua A", numero: "1", city: "Uberlândia", step: 2 }, 2);
    const page = await entrar(browser, email, senha);
    await page.goto("/dashboard/imoveis/novo", { waitUntil: "commit" });
    await gravar(page, "B com rascunho (aviso)");
    const outro = page.getByRole("button", { name: "Começar outro" });
    if (await outro.isVisible().catch(() => false)) {
      await outro.click();
      await gravar(page, "B depois de Começar outro");
    } else console.log("SONDA-BARRA | B | sem botão Começar outro");
  });

  test("C: rascunho com draft_data nulo reaberto por ?draft=", async ({ browser }) => {
    const email = `dono.sondabarra.c.${sufixo}@lab.vivanomads.test`;
    const id = await criarConta({ email, nome: "Sonda Barra C", role: "owner" }, senha);
    ids.push(id);
    const imovel = await prepararRascunho(id, `Sonda barra C ${sufixo}`, { propertyType: "apartamento", step: 3 }, 3);
    await adm().from("properties").update({ draft_data: null }).eq("id", imovel);
    const page = await entrar(browser, email, senha);
    await page.goto(`/dashboard/imoveis/novo?draft=${imovel}`, { waitUntil: "commit" });
    await gravar(page, "C draft_data nulo");
  });
});
