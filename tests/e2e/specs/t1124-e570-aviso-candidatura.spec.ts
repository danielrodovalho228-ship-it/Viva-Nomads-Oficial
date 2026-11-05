import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1124 — E570 (#2527, 04/11): o aviso de candidatura no sino do dono nomeia o morador (pela máscara: "Candidato(a)" até
  o aceite) e o imóvel, e o clique abre AQUELA candidatura. Antes era "Nova candidatura no seu imóvel" e o dono
  adivinhava pelo horário qual era. Entrou com o e570-aviso-candidatura.test.ts; aqui a candidatura sai pela tela (como a
  t678) e o aviso é conferido no banco e no sino, 390 e 1280:
   1. o aviso do dono (evento candidatura_nova): título "Nova candidatura de Candidato(a) para <imóvel>", ref_id = a
      candidatura e url = o cartão dela (/dashboard/leads#candidato-<id>); sem o nome nem o e-mail da moradora;
   2. no sino, o aviso aparece com esse título e o clique leva ao cartão #candidato-<id>.
  Nada é aprovado. As regras (máscara, filtro de contato) ficam com o teste de unidade.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1124.${sufixo}@lab.vivanomads.test`, nome: "Otto Aviso Prado", role: "owner" as const };
const inq = { email: `inq.t1124.${sufixo}@lab.vivanomads.test`, nome: "Beatriz Aviso Prado", role: "tenant" as const };
const titulo = `Studio do aviso E570 ${sufixo}`;
const TITULO_AVISO = `Nova candidatura de Candidato(a) para ${titulo}`;
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string } = {};

const maisDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Entrada e saída (30 dias) livres no calendário de Disponibilidade (como a t678). */
async function escolherNoCalendario(page: Page, dias: number) {
  const livres = page.locator('#disponibilidade button[data-estado-dia="disponivel"]');
  await expect(livres.first()).toBeVisible({ timeout: 20_000 });
  const todos = await livres.evaluateAll((els) => els.map((e) => e.getAttribute("data-dia") ?? ""));
  const livresSet = new Set(todos);
  const entrada = todos.find((d) => livresSet.has(maisDias(d, dias)));
  expect(entrada, "precisa haver um período livre no calendário").toBeTruthy();
  await page.locator(`#disponibilidade button[data-dia="${entrada}"]`).click();
  await page.locator(`#disponibilidade button[data-dia="${maisDias(entrada!, dias)}"]`).click();
}

test.describe("T1124 — E570: o aviso de candidatura nomeia o morador (máscara) e o imóvel e abre aquela candidatura", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, titulo, { ativo: true, preco: 3200 });
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.dono) {
      await adm().from("avisos").delete().eq("usuario_id", ids.dono);
      await adm().from("leads").delete().eq("owner_id", ids.dono);
    }
    if (ids.inq) await adm().from("emails_teste").delete().eq("usuario_id", ids.inq);
    if (ids.dono) await adm().from("emails_teste").delete().eq("usuario_id", ids.dono);
    await apagarContas([ids.inq, ids.dono]);
  });

  test("1. a moradora envia a candidatura pela tela; o aviso do dono nomeia a máscara e o imóvel e aponta o cartão", async ({ browser }) => {
    const page = await entrar(browser, inq.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    try {
      await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(titulo, { timeout: 20_000 });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await escolherNoCalendario(page, 30);
      const card = page.locator("#cartao-preco");
      const passo = page.getByTestId("solicitacao-passo");
      await expect(async () => {
        await card.getByRole("button", { name: "Pedir para morar", exact: true }).click();
        await expect(passo).toBeVisible({ timeout: 3_000 });
      }).toPass({ timeout: 30_000 });
      await passo.getByRole("button", { name: "Continuar" }).click();
      await passo.getByRole("button", { name: "Continuar" }).click();
      await passo.getByRole("button", { name: "Enviar candidatura" }).click();
      await expect(page.getByText("Candidatura enviada").first()).toBeVisible({ timeout: 20_000 });
    } finally {
      await page.context().close();
    }

    const { data: lead } = await adm().from("leads").select("id").eq("property_id", ids.imovel!).eq("tenant_id", ids.inq!).single();
    ids.lead = lead!.id as string;
    // O aviso sai em paralelo ao e-mail, depois da resposta: espera até 30 s.
    type Aviso = { titulo: string; url: string | null; ref_id: string | null };
    let aviso: Aviso | undefined;
    for (let i = 0; i < 30 && !aviso; i++) {
      const { data } = await adm().from("avisos").select("titulo, url, ref_id").eq("usuario_id", ids.dono!).eq("evento", "candidatura_nova").limit(1);
      aviso = (data ?? [])[0] as Aviso | undefined;
      if (!aviso) await new Promise((r) => setTimeout(r, 1000));
    }
    expect(aviso, "o aviso de candidatura do dono foi gravado").toBeTruthy();
    expect(aviso!.titulo).toBe(TITULO_AVISO);
    expect(aviso!.ref_id).toBe(ids.lead);
    expect(aviso!.url).toContain(`/dashboard/leads#candidato-${ids.lead}`);
    expect(aviso!.titulo).not.toMatch(/Beatriz|Prado|@/);
  });

  for (const w of [390, 1280] as const) {
    test(`2. no sino, o aviso tem o título novo e abre o cartão desta candidatura (${w})`, async ({ browser }) => {
      expect(ids.lead, "a candidatura do caso 1").toBeTruthy();
      // O clique da outra largura marcou o aviso como lido: volta a não lido para as duas larguras verem o mesmo.
      await adm().from("avisos").update({ lido_em: null }).eq("usuario_id", ids.dono!);
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      try {
        await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
        const topo = w === 390 ? p.getByTestId("topo-celular") : p.getByTestId("topo-dono");
        const px = w === 390 ? "dono-celular" : "dono";
        await topo.getByTestId(`sino-${px}`).click({ timeout: 30_000 });
        const item = topo.getByTestId(`sino-${px}-painel`).getByTestId("sino-aviso").filter({ hasText: TITULO_AVISO });
        await expect(item).toBeVisible({ timeout: 20_000 });
        await item.click();
        await expect(p).toHaveURL(new RegExp(`/dashboard/leads#candidato-${ids.lead}$`), { timeout: 20_000 });
        await expect(p.locator(`#candidato-${ids.lead}`)).toBeVisible({ timeout: 20_000 });
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await p.context().close();
      }
    });
  }
});
