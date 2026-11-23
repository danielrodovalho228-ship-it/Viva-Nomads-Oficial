import { test, expect, type Locator, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2232 — E1133 (ORDEM-DUET-586): a recusa de contacto no "Sobre você" da área do avaliador fica À VISTA @E1133
  Só no laboratório. A t2231 continua a ser a trava do E1099; esta é a trava nomeada do E1133, no padrão da t2230 pós-E1131:
   - o avaliador desce só até o botão "Salvar texto" (o botão no fim do ecrã do celular, acima da barra de baixo),
     escreve um telefone ou um e-mail no "Sobre" e salva;
   - o aviso da casa aparece junto do botão, como alerta, e está à vista: dentro do ecrã e não tapado (o ponto do meio
     do aviso é o próprio aviso);
   - nada é gravado.
  Antes do E1133 a trava cai: o aviso nascia abaixo do botão, fora da vista (ou atrás da barra de baixo).
*/
const AVISO = "Para sua segurança e registro, o contato acontece pela plataforma — remova telefone, e-mail ou apps de mensagem do texto.";
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE = "Araguari";
const avaliador = { email: `aval.t2232.${sufixo}@lab.vivanomads.test`, nome: "Rita Avaliadora Teste", role: "tenant" as const };
const ids: Record<string, string> = {};
const cred = { id: "" };
const SOBRE = "Avalio imóveis mobiliados há oito anos, com foco em conforto acústico e iluminação.";

const sobreNoBanco = async () => (await adm().from("avaliadores_credenciamento").select("sobre").eq("id", cred.id).single()).data?.sobre ?? null;

/** Desce só até o botão ficar no fim do ecrã, logo acima de uma barra fixa de baixo (se houver): como quem rola até ele. */
async function botaoNoFimDoEcra(page: Page, botao: Locator) {
  await botao.evaluate((el) => {
    const barras = [...document.querySelectorAll<HTMLElement>("body *")].filter((n) => {
      const st = getComputedStyle(n);
      return st.position === "fixed" && n.getBoundingClientRect().bottom >= window.innerHeight - 1 && n.getBoundingClientRect().height < window.innerHeight / 3;
    });
    const limite = Math.min(window.innerHeight, ...barras.map((b) => b.getBoundingClientRect().top));
    window.scrollBy(0, el.getBoundingClientRect().bottom - limite + 2);
  });
}

/** O aviso está à vista de quem salvou: o ponto do meio dele está no ecrã e não está tapado por outra coisa. */
async function avisoAVista(aviso: Locator): Promise<boolean> {
  return aviso.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (y < 0 || y > window.innerHeight || x < 0 || x > window.innerWidth) return false;
    const noPonto = document.elementFromPoint(x, y);
    return !!noPonto && (noPonto === el || el.contains(noPonto));
  });
}

test.describe("T2232 — E1133: o aviso do \"Sobre\" do avaliador fica à vista @E1133", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.av = await criarConta(avaliador, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.av);
    const { error: ePil } = await adm().from("vistoria_piloto").insert({ user_id: ids.av, nota: "T2232 (laboratório)" });
    if (ePil) throw ePil;
    const { data: parc, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.av, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: avaliador.nome, slug: `aval-t2232-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (error) throw error;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: c, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: parc.id, cidade: CIDADE, numero_credenciado: n, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test", conduta_versao: "2026-10-23", ativado_em: new Date().toISOString(), sobre: SOBRE })
      .select("id")
      .single();
    if (eC) throw eC;
    cred.id = c.id as string;
  });
  test.afterAll(async () => {
    if (cred.id) await adm().from("avaliadores_credenciamento").delete().eq("id", cred.id);
    if (ids.av) await adm().from("vistoria_piloto").delete().eq("user_id", ids.av);
    await apagarContas([ids.av]);
  });

  test("telefone ou e-mail no \"Sobre\": o aviso da casa junto do botão, à vista, e nada gravado", async ({ browser }) => {
    const page = await entrar(browser, avaliador.email, senha);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(page.url()).origin }]);
    for (const contacto of ["Fale comigo no (34) 99876-5432", "Escreva para rita.avalia@exemplo.com.br"]) {
      await page.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("meu-sobre"), "a área do avaliador tem o \"Sobre\"").toBeVisible({ timeout: 30_000 });
      const form = page.getByTestId("salvar-sobre");
      const botao = form.getByRole("button", { name: "Salvar texto" });
      await form.locator('textarea[name="sobre"]').fill(`${SOBRE} ${contacto}`);
      await botaoNoFimDoEcra(page, botao);
      await botao.click();
      const aviso = form.getByTestId("acao-erro");
      await expect(aviso, `${contacto}: o aviso da casa`).toHaveText(AVISO, { timeout: 20_000 });
      await expect(aviso, `${contacto}: é um alerta`).toHaveAttribute("role", "alert");
      // E1133: o aviso aparece junto do botão — dentro do ecrã de quem acabou de salvar, e não tapado pela barra de baixo.
      await expect(aviso, `${contacto}: o aviso está no ecrã`).toBeInViewport();
      await expect.poll(() => avisoAVista(aviso), { message: `${contacto}: o aviso não está tapado`, timeout: 5_000 }).toBe(true);
      expect(await sobreNoBanco(), `${contacto}: nada gravado`).toBe(SOBRE);
    }
    await page.context().close();
  });
});
