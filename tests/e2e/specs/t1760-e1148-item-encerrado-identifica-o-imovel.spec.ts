import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1760 — E1148 @E1148 (ORDENS-DUET 634, 678 e 679; linha Parceiros, classe B): no histórico do avaliador, o item
  encerrado que já não é dele dizia só "rótulo · cidade · porte · data" — dois itens da mesma cidade e do mesmo porte
  eram indistinguíveis. O item passa a dizer de que imóvel é: o título do anúncio, o código VN e o bairro.
  SEM a morada completa (nestes itens o dono não aceitou) e SEM ligação.
  Três pedidos do mesmo dono, na mesma cidade e do mesmo porte, que já não são do avaliador:
   · a proposta dele expirou sem o aceite do proprietário;
   · o proprietário descartou a proposta dele;
   · ele recusou o pedido.
  Cada imóvel tem título, bairro e morada (rua e número) próprios. Só contas de teste; cidade própria do spec.
  Laboratório; não é prova ao vivo no site.
   1. Cada item mostra o título e o código VN do imóvel, e o bairro junto da cidade; os três distinguem-se.
      Print a 390 e a 1280 px.
   2. Nenhum item mostra a rua nem o número, e nenhum tem ligação.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Tupaciguara";
const HORA = 3_600_000;
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1760.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const avaliador = { email: `aval.t1760.${sufixo}@lab.vivanomads.test`, nome: "Abel Avaliador", role: "tenant" as const };
const ids: Record<string, string> = {};
type Caso = "expirada" | "descartada" | "recusada";
const CASOS: Record<Caso, { titulo: string; bairro: string; rua: string; rotulo: string; resposta: string }> = {
  expirada: { titulo: `Lar das Acácias ${sufixo}`, bairro: "Jardim Ipê", rua: "Rua Reservada Um, 111", rotulo: "Proposta expirada sem o aceite do proprietário", resposta: "expirada" },
  descartada: { titulo: `Lar dos Buritis ${sufixo}`, bairro: "Vila Aurora", rua: "Rua Reservada Dois, 222", rotulo: "Proposta recusada pelo proprietário", resposta: "recusada" },
  recusada: { titulo: `Lar das Copaíbas ${sufixo}`, bairro: "Alto da Serra", rua: "Rua Reservada Três, 333", rotulo: "Você recusou", resposta: "recusada" },
};
const ORDEM: Caso[] = ["expirada", "descartada", "recusada"];
/** O código VN que o imóvel já tem em todo o site: "VN-" + os 6 primeiros caracteres do id, em maiúsculas. */
const codigoVN = (id: string) => `VN-${id.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase()}`;

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
const semRolagemLateral = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.describe("T1760 — E1148: o item encerrado do avaliador diz de que imóvel é (título, código VN e bairro) @E1148", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    for (const [k, c] of [["dono", dono], ["avaliador", avaliador]] as const) {
      ids[k] = await criarConta(c, senha);
      const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids[k]);
      if (t.error) throw t.error;
    }
    const { data: parc, error: eP } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.avaliador, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: avaliador.nome, slug: `aval-t1760-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (eP) throw eP;
    ids.parc = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: cred, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: ids.parc, cidade: CIDADE, numero_credenciado: n as string, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1760", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (eC) throw eC;
    ids.cred = cred.id as string;

    for (const [i, caso] of ORDEM.entries()) {
      const c = CASOS[caso];
      const imovel = await criarImovelPronto(ids.dono, c.titulo, { ativo: true });
      ids[`imovel_${caso}`] = imovel;
      // O bairro fica em `address`; a rua e o número em `exact_address` (o que o item NÃO pode mostrar).
      const u = await adm().from("properties").update({ city: CIDADE, address: c.bairro, exact_address: c.rua }).eq("id", imovel);
      if (u.error) throw u.error;
      // O pedido voltou ao dono (já não é deste avaliador): mesma cidade e mesmo porte nos três.
      const { data: ped, error: ePed } = await adm()
        .from("vistoria_pedidos")
        .insert({ property_id: imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, status: "pedido", teste: true })
        .select("id")
        .single();
      if (ePed) throw ePed;
      ids[`pedido_${caso}`] = ped.id as string;
      const quando = new Date(Date.now() - (i + 2) * 24 * HORA).toISOString();
      const d = await adm().from("vistoria_designacoes").insert({
        pedido_id: ped.id,
        avaliador_id: ids.cred,
        designado_em: new Date(Date.parse(quando) - 80 * HORA).toISOString(),
        resposta: c.resposta,
        respondido_em: new Date(Date.parse(quando) - 75 * HORA).toISOString(),
        proposta_expirada_em: caso === "expirada" ? quando : null,
        proposta_descartada_em: caso === "descartada" ? quando : null,
      });
      if (d.error) throw d.error;
    }
  });

  test.afterAll(async () => {
    const imoveis = ORDEM.map((c) => ids[`imovel_${c}`]).filter(Boolean);
    const contas = [ids.dono, ids.avaliador].filter(Boolean);
    if (ids.cred) await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.cred);
    if (imoveis.length) await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    if (ids.cred) await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    if (ids.parc) await adm().from("parceiros").delete().eq("id", ids.parc);
    if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
    await apagarContas(contas);
  });

  test("1. cada item encerrado mostra o título e o código VN do imóvel, e o bairro junto da cidade", async ({ browser }) => {
    const a = await entrar(browser, avaliador.email, senha);
    for (const w of LARGURAS) {
      await largura(a, w);
      await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
      const historico = a.getByTestId("avaliacoes-historico");
      await expect(historico.getByTestId("avaliacao-fora"), `a ${w} px: os três itens`).toHaveCount(3, { timeout: 30_000 });
      const vistos: string[] = [];
      for (const caso of ORDEM) {
        const c = CASOS[caso];
        const item = historico.locator(`[data-testid="avaliacao-fora"][data-pedido="${ids[`pedido_${caso}`]}"]`);
        await expect(item, `${caso} a ${w} px`).toHaveCount(1);
        await expect(item).toHaveAttribute("data-resposta", c.resposta);
        // De que imóvel é: o título do anúncio e o código VN.
        const imovel = item.getByTestId("pedido-imovel");
        await expect(imovel).toHaveText(`${c.titulo} · ${codigoVN(ids[`imovel_${caso}`])}`);
        expect(await imovel.locator("span").evaluate((el) => el.getClientRects().length), "o código VN numa linha só").toBe(1);
        // O que aconteceu, o bairro junto da cidade, o porte e a data.
        const linha = item.getByTestId("avaliacao-fora-linha");
        await expect(linha).toHaveText(new RegExp(`^${c.rotulo} · ${c.bairro} · ${CIDADE} · 1 ou 2 quartos · \\d{2}/\\d{2}/\\d{4}$`));
        vistos.push((await imovel.textContent()) ?? "");
      }
      expect(new Set(vistos).size, "os três itens distinguem-se pelo imóvel").toBe(3);
      expect(await semRolagemLateral(a), `a ${w} px: sem rolagem lateral`).toBe(true);
      await historico.scrollIntoViewIfNeeded();
      await a.screenshot({ path: `${SAIDA}/t1760-1-itens-encerrados-${w}.png` });
    }
    await a.context().close();
  });

  test("2. nenhum item mostra a rua nem o número, e nenhum tem ligação", async ({ browser }) => {
    const a = await entrar(browser, avaliador.email, senha);
    await largura(a, 390);
    await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    const historico = a.getByTestId("avaliacoes-historico");
    await expect(historico.getByTestId("avaliacao-fora")).toHaveCount(3, { timeout: 30_000 });
    // A massa tem mesmo a morada gravada — é isso que a tela não pode mostrar.
    const { data: gravados, error } = await adm().from("properties").select("id, exact_address").in("id", ORDEM.map((c) => ids[`imovel_${c}`]));
    if (error) throw error;
    expect((gravados ?? []).map((g) => g.exact_address).sort()).toEqual(ORDEM.map((c) => CASOS[c].rua).sort());
    const pagina = (await a.locator("main").innerText()).replace(/\s+/g, " ");
    for (const caso of ORDEM) {
      const c = CASOS[caso];
      expect(pagina, `${caso}: o título está na página`).toContain(c.titulo);
      expect(pagina, `${caso}: a rua não aparece`).not.toContain(c.rua);
      expect(pagina, `${caso}: nem a rua sem o número`).not.toContain(c.rua.split(",")[0]);
    }
    expect(pagina).not.toContain("Rua Reservada");
    // Sem ligação: nem para a tela do pedido (que já não abre para ele), nem para a página pública do anúncio.
    await expect(historico.locator('[data-testid="avaliacao-fora"] a')).toHaveCount(0);
    await expect(historico.locator('[data-testid="avaliacao-fora"] button')).toHaveCount(0);
    for (const caso of ORDEM) {
      await expect(a.locator(`a[href*="${ids[`pedido_${caso}`]}"]`), `${caso}: nenhuma ligação para o pedido`).toHaveCount(0);
      await expect(a.locator(`a[href*="${ids[`imovel_${caso}`]}"]`), `${caso}: nenhuma ligação para o imóvel`).toHaveCount(0);
    }
    await a.context().close();
  });
});
