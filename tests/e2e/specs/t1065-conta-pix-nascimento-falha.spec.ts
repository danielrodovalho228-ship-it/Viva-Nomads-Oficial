import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1065 — Estados vazios da Conta (#2374 e #2375, 02/11): a leitura que falha não vira "dado vazio". Pela tela real,
 * 390 e 1280, proprietária com chave Pix e data de nascimento gravadas:
 *   1. #2374, Conta › Pagamentos: a leitura da chave Pix falha (simulada: a resposta da server action que traz a chave
 *      vira 500) → "Não conseguimos ler a sua chave Pix agora…" com "Tentar de novo", SEM o formulário vazio de
 *      cadastrar; a leitura volta e "Tentar de novo" mostra a chave salva (mascarada);
 *   2. #2375, Conta › Dados: a leitura da data de nascimento falha → o campo fica travado com "Não carregou agora —
 *      recarregue a página para alterar"; salvar os dados (nome trocado) grava o nome e NÃO apaga a data gravada.
 *   3. controle — sem falha: a chave aparece direto e a data vem preenchida e editável.
 * O servidor que lança em vez de devolver vazio fica com o vazio-chave-pix.test.ts e o vazio-nascimento.test.ts.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dona = { email: `dona.t1065.${sufixo}@lab.vivanomads.test`, nome: "Paula Pixdata Souza", role: "owner" as const };
const CHAVE = `pix.t1065.${sufixo}@lab.vivanomads.test`;
const MASCARADA = `p***@lab.vivanomads.test`;
const DATA_TELA = "07/03/1991";
const DATA_BANCO = "1991-03-07";
const AVISO_PIX = "Não conseguimos ler a sua chave Pix agora.";
const AVISO_NASC = "Não carregou agora — recarregue a página para alterar";
let id = "";

/** A server action cuja resposta traz `marca` responde 500 (as outras passam). */
async function falharAcaoCom(p: Page, caminho: string, marca: string) {
  await p.route(`**${caminho}**`, async (r) => {
    const req = r.request();
    if (req.method() !== "POST" || !req.headers()["next-action"]) return r.fallback();
    const resp = await r.fetch();
    const corpo = await resp.text();
    if (corpo.includes(marca)) return r.fulfill({ status: 500, contentType: "text/plain", body: "falha simulada" });
    return r.fulfill({ response: resp, body: corpo });
  });
}
const sobra = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe("T1065 — Conta: a leitura que falha não vira chave Pix nem data de nascimento vazias", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    id = await criarConta(dona, senha);
    const pix = await adm().from("recebimento_pix").upsert({ user_id: id, tipo: "email", chave: CHAVE });
    if (pix.error) throw pix.error;
    const nasc = await adm().from("profiles").update({ data_nascimento: DATA_BANCO }).eq("id", id);
    if (nasc.error) throw nasc.error;
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("recebimento_pix").delete().eq("user_id", id);
    await apagarContas([id]);
  });

  for (const w of [390, 1280] as const) {
    test(`Pagamentos: falha → aviso sem formulário; Tentar de novo → a chave; controle direto (${w})`, async ({ browser }) => {
      const p = await entrar(browser, dona.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      const falhou = p.getByTestId("conta-pix-falhou");
      const salva = p.getByTestId("conta-pix-salva");

      await falharAcaoCom(p, "/dashboard/conta/pagamentos", CHAVE);
      await p.goto("/dashboard/conta/pagamentos", { waitUntil: "domcontentloaded" });
      await expect(falhou).toBeVisible({ timeout: 30_000 });
      await expect(falhou).toContainText(AVISO_PIX);
      await expect(salva).toHaveCount(0);
      await expect(p.locator(':has(> #pag-recebe-titulo)').locator("input"), "sem o formulário vazio de cadastrar").toHaveCount(0);
      expect(await sobra(p)).toBeLessThanOrEqual(1);

      await p.unrouteAll({ behavior: "wait" });
      await p.getByTestId("conta-pix-tentar").click();
      await expect(salva).toContainText(MASCARADA, { timeout: 30_000 });
      await expect(falhou).toHaveCount(0);

      await p.goto("/dashboard/conta/pagamentos", { waitUntil: "domcontentloaded" });
      await expect(salva).toContainText(MASCARADA, { timeout: 30_000 });
      await expect(falhou).toHaveCount(0);
      await p.context().close();
    });

    test(`Dados: falha → data travada; salvar troca o nome e não apaga a data; controle editável (${w})`, async ({ browser }) => {
      const p = await entrar(browser, dona.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      const campo = p.getByTestId("dados-nascimento");
      const nome = p.getByTestId("meus-dados").getByLabel("Nome completo");

      await falharAcaoCom(p, "/dashboard/conta/dados", DATA_TELA);
      await p.goto("/dashboard/conta/dados", { waitUntil: "domcontentloaded" });
      await expect(campo).toBeDisabled({ timeout: 30_000 });
      await expect(campo).toHaveAttribute("placeholder", AVISO_NASC);
      await expect(campo).toHaveValue("");
      expect(await sobra(p)).toBeLessThanOrEqual(1);

      await p.unrouteAll({ behavior: "wait" });
      const novoNome = `Paula Pixdata ${w} Souza`;
      await expect(nome).not.toHaveValue("", { timeout: 30_000 });
      await nome.fill(novoNome);
      await p.getByTestId("dados-salvar").click();
      await expect(p.getByTestId("meus-dados").getByRole("status")).toContainText("Dados salvos.", { timeout: 30_000 });
      const { data } = await adm().from("profiles").select("full_name, data_nascimento").eq("id", id).single();
      expect(data?.full_name).toBe(novoNome);
      expect(String(data?.data_nascimento ?? ""), "a data gravada não foi apagada").toContain(DATA_BANCO);

      await p.goto("/dashboard/conta/dados", { waitUntil: "domcontentloaded" });
      await expect(campo).toHaveValue(DATA_TELA, { timeout: 30_000 });
      await expect(campo).toBeEnabled();
      await p.context().close();
    });
  }
});
