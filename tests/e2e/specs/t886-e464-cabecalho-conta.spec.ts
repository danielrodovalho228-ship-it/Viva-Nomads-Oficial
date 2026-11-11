import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo, cnpjAleatorio } from "../fixtures/laboratorio";

/*
  T886 — E464 + E534: cabeçalho estável e com o sino nas páginas de Conta. Conta com os papéis de proprietário (um anúncio) e parceiro
  aprovado, com o papel ATIVO = parceiro. Abrindo Perfil, Privacidade, Pagamentos, Notificações e Ajuda (cada uma por carga nova de página):
    1) o cabeçalho é o do parceiro do 1º quadro ao último — nunca passa pelo do dono (antes nascia "dono" e trocava);
    2) o sino aparece em todas elas (antes sumia nas telas da Conta, no computador);
    3) o menu Conta tem os mesmos itens em todas.
  390 e 1280, sessão real.
  Complemento (#2603 → este PR): o 1º lab-critico viu "topo:proprietario" — o ModeInitializer desligava o parceiro a cada carga.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const pessoa = { email: `conta.t886.${sufixo}@lab.vivanomads.test`, nome: "Clara Contas", role: "owner" as const };
const ids: Record<string, string> = {};
// E534: o sino em TODAS as telas da Conta (Conta/Perfil, Privacidade, Pagamentos, Ajuda e Notificações).
const TELAS = ["/dashboard/conta/perfil", "/dashboard/conta/privacidade", "/dashboard/conta/pagamentos", "/dashboard/notificacoes", "/dashboard/conta/ajuda"];

test.describe("T886 — cabeçalho estável nas páginas de Conta", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.beforeAll(async () => {
    ids.pessoa = await criarConta(pessoa, senha);
    await criarImovelPronto(ids.pessoa, `Studio T886 ${sufixo}`, { ativo: true });
    const { data, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.pessoa, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: `Clara Limpeza ${sufixo}`, slug: `clara-t886-${sufixo}`, categorias: ["limpeza"], cidades: ["Uberlândia"], descricao_curta: "Parceiro de laboratório.", status: "publicado", publicado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    ids.parceiro = data.id as string;
    // E668 (migração 0318): o papel "parceiro" só vale se foi ESCOLHIDO — grava também o carimbo da escolha.
    await adm().from("profiles").update({ papel_ativo: "parceiro", papel_ativo_escolhido_em: new Date().toISOString() }).eq("id", ids.pessoa);
  });
  test.afterAll(async () => {
    if (ids.parceiro) await adm().from("parceiros").delete().eq("id", ids.parceiro);
    await apagarContas([ids.pessoa]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: telas da Conta com o mesmo cabeçalho de parceiro e o sino`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      // Registra, desde o 1º quadro de cada carga, os papéis que o cabeçalho mostrou (topo do computador e sino do celular).
      await ctx.addInitScript(() => {
        const g = window as unknown as { __papeis: string[] };
        g.__papeis = [];
        const anota = () => {
          for (const e of document.querySelectorAll<HTMLElement>("header[data-papel]")) if (e.offsetParent) g.__papeis.push(`topo:${e.dataset.papel}`);
          for (const e of document.querySelectorAll<HTMLElement>('[data-testid^="sino-"][data-testid$="-celular"]')) if (e.offsetParent) g.__papeis.push(`sino:${e.dataset.testid}`);
        };
        new MutationObserver(anota).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-papel", "data-testid"] });
      });
      const p = await entrarNaPagina(await ctx.newPage(), pessoa.email, senha);
      const menus: string[][] = [];
      for (const rota of TELAS) {
        await p.goto(rota, { waitUntil: "domcontentloaded" });
        const sino = w === 1280 ? p.getByTestId("topo-parceiro").getByTestId("sino-parceiro") : p.getByTestId("topo-celular").getByTestId("sino-parceiro-celular");
        await expect(sino, `${rota}: sino`).toBeVisible({ timeout: 20_000 });
        await p.waitForTimeout(2500);
        const vistos = [...new Set(await p.evaluate(() => (window as unknown as { __papeis: string[] }).__papeis))];
        expect(vistos.filter((v) => !v.endsWith("parceiro") && !v.endsWith("parceiro-celular")), `${rota}: cabeçalho de outro papel`).toEqual([]);
        // Menu Conta: abre pelo avatar e anota os itens.
        const id = w === 390 ? "conta-parceiro-celular" : "conta-parceiro";
        const botao = w === 390 ? p.getByTestId("topo-celular").getByTestId(id) : p.getByTestId(id);
        await botao.click();
        menus.push(await p.getByTestId(`menu-${id}`).getByRole("menuitem").allInnerTexts());
        await p.keyboard.press("Escape");
        await p.screenshot({ path: `tests/laboratorio/saida/t886${rota.replace(/\//g, "-")}-${w}.png` });
      }
      expect(menus.length).toBe(TELAS.length);
      for (const m of menus) expect(m, "menu Conta igual em todas as telas").toEqual(menus[0]);
      await ctx.close();
    });
  }
});
