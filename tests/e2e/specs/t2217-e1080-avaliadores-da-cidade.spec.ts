import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2217 — E1080 (b) (ORDEM-DUET-385): a página pública de descoberta de avaliadores lista os CREDENCIADOS DA CIDADE.
  Só no laboratório. TRAVA EM RASCUNHO: nasce vermelha na main de hoje (/avaliadores redireciona para a página de
  recrutamento "Seja avaliador credenciado", sem lista) e fica verde quando o E1080 entrar.
  Massa (credenciamentos gravados pelo laboratório, como na t305; cidades só deste teste):
    A — ativo, na cidade C;  B — ativo, noutra cidade;  T — em_teste, na cidade C;  D — descredenciado, na cidade C.
  Condição do coordenador (DUET-1457, regra do Daniel "só piloto"): a descoberta fica DESLIGADA e fechada ao público
  até o Daniel a abrir. Por isso a trava tem duas pernas:
    1. fechada: o visitante sem sessão, sem nada ligado, abre /avaliadores?cidade=<C> e NÃO vê nenhum credenciado (nem
       A) — guarda que já é verde hoje e tem de continuar verde depois do E1080;
    2. aberta (PONTO DE LIGAÇÃO `abrirDescoberta`: no laboratório, o cookie `vn_lab_vistoria` da chave da avaliação, o
       mesmo atalho da t305/t341; se o E1080 escolher outra chave, é a única linha a mudar), o visitante lê:
       - o credenciado A, pelo número, a levar à página dele (/avaliadores/<nº>);
       - nem B (outra cidade), nem T (em teste), nem D (descredenciado);
       - nenhum telefone nem e-mail na lista (a regra das páginas públicas de avaliador, E1075/E1077).
  Referência: `docs/mockups-avaliadores/publico-avaliadores-{mobile,desktop}.webp` (E1079): "Avaliadores em <cidade>",
  cartões com foto, NOME, selo, cidade e avaliações — sem número. Por isso a trava procura cada avaliador pelo nome.
  A rota exacta é do E1080: a trava abre /avaliadores?cidade=<C> e lê a página onde ele cair. O formato dos cartões é
  dos mockups aprovados (E1079) e da trava (c), não desta. Só contas de teste; nenhuma foto de pessoa real.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE = `Uberlândia t2217 ${sufixo}`;
const OUTRA = `Araguari t2217 ${sufixo}`;
type L = "A" | "B" | "T" | "D";
const conta = (l: L) => ({ email: `av${l.toLowerCase()}.t2217.${sufixo}@lab.vivanomads.test`, nome: `Avaliador ${l} T2217`, role: "tenant" as const });
const ids: Partial<Record<L, string>> = {};
const cred: Partial<Record<L, { id: string; numero: string }>> = {};
const MASSA: Record<L, { cidade: string; status: string }> = {
  A: { cidade: CIDADE, status: "ativo" },
  B: { cidade: OUTRA, status: "ativo" },
  T: { cidade: CIDADE, status: "em_teste" },
  D: { cidade: CIDADE, status: "descredenciado" },
};
const CONTATO = /tel:|mailto:|wa\.me|api\.whatsapp|@lab\.vivanomads\.test/i;

test.describe("T2217 — E1080 (b): a descoberta pública lista os credenciados da cidade @E1080", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    for (const l of ["A", "B", "T", "D"] as const) {
      ids[l] = await criarConta(conta(l), senha);
      const { data: parc, error } = await adm()
        .from("parceiros")
        .insert({ user_id: ids[l], tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: conta(l).nome, slug: `aval-${l.toLowerCase()}-t2217-${sufixo}`, categorias: ["fotografia"], cidades: [MASSA[l].cidade] })
        .select("id")
        .single();
      if (error) throw error;
      const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
      const { data: c, error: eC } = await adm()
        .from("avaliadores_credenciamento")
        .insert({
          parceiro_id: parc.id, cidade: MASSA[l].cidade, numero_credenciado: n, status: MASSA[l].status,
          experiencia_link: "https://portfolio.lab.vivanomads.test", conduta_versao: "2026-10-23",
          ...(MASSA[l].status === "ativo" ? { ativado_em: new Date().toISOString() } : {}),
        })
        .select("id, numero_credenciado")
        .single();
      if (eC) throw eC;
      cred[l] = { id: c.id as string, numero: c.numero_credenciado as string };
    }
  });
  test.afterAll(async () => {
    const creds = Object.values(cred).map((c) => c!.id);
    if (creds.length) await adm().from("avaliadores_credenciamento").delete().in("id", creds);
    await apagarContas(Object.values(ids).filter(Boolean) as string[]);
  });

  /** PONTO DE LIGAÇÃO do E1080: abre a descoberta neste navegador (no laboratório, a chave da avaliação pelo cookie). */
  async function abrirDescoberta(page: import("@playwright/test").Page) {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(page.url()).origin }]);
  }
  const descoberta = `/avaliadores?cidade=${encodeURIComponent(CIDADE)}`;

  test("1. fechada ao público: sem nada ligado, nenhum credenciado aparece", async ({ page }) => {
    await page.goto(descoberta, { waitUntil: "domcontentloaded" });
    const main = page.locator("main");
    await expect(main).toBeVisible({ timeout: 30_000 });
    const texto = await main.innerText();
    for (const l of ["A", "B", "T", "D"] as const) expect(texto.includes(conta(l).nome) || texto.includes(cred[l]!.numero), `fechada: ${conta(l).nome} (nº ${cred[l]!.numero}) não aparece ao público`).toBe(false);
    await expect(main.locator(`a[href*="/avaliadores/${cred.A!.numero}"]`), "fechada: nenhum caminho para o credenciado").toHaveCount(0);
  });

  for (const largura of [390, 1280]) {
    test(`2. aberta, ${largura}: a cidade mostra o credenciado ativo dela, e só ele`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await abrirDescoberta(page);
      await page.goto(descoberta, { waitUntil: "domcontentloaded" });
      const main = page.locator("main");
      await expect(main).toBeVisible({ timeout: 30_000 });
      await expect(main.getByText(conta("A").nome).first(), `E1080 (b): o credenciado ativo da cidade (${conta("A").nome}) está na lista (url: ${page.url()})`).toBeVisible({ timeout: 20_000 });
      expect.soft(await main.locator(`a[href*="/avaliadores/${cred.A!.numero}"]`).count(), "E1080 (b): o cartão leva à página do avaliador").toBeGreaterThan(0);
      expect.soft(await main.getByRole("heading", { level: 1 }).innerText(), "E1080 (b): o título diz a cidade, como no mockup").toMatch(/Avaliadores em/i);
      const texto = await main.innerText();
      for (const l of ["B", "T", "D"] as const) expect.soft(texto.includes(conta(l).nome), `E1080 (b): ${conta(l).nome} (${MASSA[l].status}, ${MASSA[l].cidade === CIDADE ? "mesma cidade" : "outra cidade"}) não aparece`).toBe(false);
      expect.soft((await main.innerHTML()).match(CONTATO), "E1080 (b): nenhum telefone nem e-mail na lista").toBeNull();
    });
  }
});
