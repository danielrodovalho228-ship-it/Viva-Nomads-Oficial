import { test, expect, type Browser } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1167 — E570 (#2649, 05/11): o aviso de candidatura do dono nomeia o candidato pelo PRIMEIRO nome ("Nova candidatura de
 * Lucas para …"); antes saía sempre "Candidato(a)" e, com 2+ candidaturas no mesmo anúncio, o dono não sabia quem chegou.
 * O sobrenome não vai ao aviso (a máscara do cartão segue até o aceite). O E570 entrou só com teste de unidade; aqui é o
 * caminho real: duas moradoras candidatam-se pela tela ao MESMO anúncio, uma a 1280 (cartão de preço) e outra a 390
 * (barra fixa):
 *   1. o dono recebe dois avisos de candidatura, um com cada primeiro nome e o título do imóvel;
 *   2. nenhum aviso traz o sobrenome nem "Candidato(a)".
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1167.${sufixo}@lab.vivanomads.test`, nome: "Hugo Anfitrião", role: "owner" as const };
const lucas = { email: `inq.t1167.a.${sufixo}@lab.vivanomads.test`, nome: "Lucas Sobrenomeoculto", role: "tenant" as const };
const marta = { email: `inq.t1167.b.${sufixo}@lab.vivanomads.test`, nome: "Marta Sobrenomeoculto", role: "tenant" as const };
const TITULO = `Casa das candidaturas ${sufixo}`;
const ids: { dono?: string; imovel?: string; lucas?: string; marta?: string } = {};

const hoje = new Date();
const iso = (n: number) => new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() + n)).toISOString().slice(0, 10);

async function candidatar(browser: Browser, email: string, largura: 390 | 1280) {
  const page = await entrar(browser, email, senha);
  try {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
    const card = page.locator("#cartao-preco");
    await card.getByTestId("candidatura-inicio").fill(iso(40));
    await card.getByTestId("candidatura-saida").fill(iso(100));
    // Abaixo de 1024 px o "Pedir para morar" mora na barra fixa (prompt 41, como na t181); no computador, no cartão.
    const botao = largura < 1024 ? page.getByTestId("barra-fixa-imovel").getByRole("button", { name: "Pedir para morar", exact: true }) : card.getByRole("button", { name: "Pedir para morar", exact: true });
    const passo = page.getByTestId("solicitacao-passo");
    await expect(async () => {
      await botao.click();
      await expect(passo).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await passo.getByRole("button", { name: "Continuar" }).click();
    await passo.getByRole("button", { name: "Continuar" }).click();
    await passo.getByRole("button", { name: "Enviar candidatura" }).click();
    await expect(page.getByText("Candidatura enviada").first()).toBeVisible({ timeout: 20_000 });
  } finally {
    await page.context().close();
  }
}

test.describe("T1167 — E570: o aviso de candidatura nomeia quem se candidatou pelo primeiro nome", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.lucas = await criarConta(lucas, senha);
    ids.marta = await criarConta(marta, senha);
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true, preco: 2800 });
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.dono) await adm().from("avisos").delete().eq("usuario_id", ids.dono);
    if (ids.imovel) await adm().from("messages").delete().eq("property_id", ids.imovel);
    if (ids.dono) await adm().from("leads").delete().eq("owner_id", ids.dono);
    await apagarContas([ids.lucas, ids.marta, ids.dono]);
  });

  test("duas candidaturas pela tela (1280 e 390): um aviso com cada primeiro nome, sem sobrenome", async ({ browser }) => {
    await candidatar(browser, lucas.email, 1280);
    await candidatar(browser, marta.email, 390);

    let titulos: string[] = [];
    await expect(async () => {
      const { data } = await adm().from("avisos").select("titulo").eq("usuario_id", ids.dono!).ilike("titulo", "%candidatura%");
      titulos = ((data ?? []) as { titulo: string }[]).map((a) => a.titulo);
      expect(titulos.length, `avisos de candidatura: ${titulos.join(" | ")}`).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 30_000 });
    expect(titulos.some((t) => t.includes("Lucas") && t.includes(TITULO)), titulos.join(" | ")).toBe(true);
    expect(titulos.some((t) => t.includes("Marta") && t.includes(TITULO)), titulos.join(" | ")).toBe(true);
    for (const t of titulos) {
      expect(t, "sem sobrenome no aviso").not.toContain("Sobrenomeoculto");
      expect(t, "o nome no lugar da máscara").not.toContain("Candidato(a)");
    }
  });
});
