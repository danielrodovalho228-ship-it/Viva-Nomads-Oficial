import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T657 — E235: o número do avaliador leva à página pública dele (/avaliadores/[numero]), nos DOIS pontos do painel do dono:
   1. bloco da avaliação, pedido designado: "Avaliador designado pela Viva: nº X" — o X é link.
   2. laudo aprovado: "Avaliado em … por avaliador credenciado nº X" — o X é link.
  O texto da linha não muda (restauração do desenho); clicar abre a página pública com o mesmo número. 390 e 1280.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t657.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const avA = { email: `ava.t657.${sufixo}@lab.vivanomads.test`, nome: "Caio Avaliador", role: "tenant" as const };
const ids: Record<string, string> = {};
let numero = "";

async function comChave(page: Page) {
  await page.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(page.url() === "about:blank" ? "http://localhost:3123" : page.url()).origin }]);
}

test.describe("T657 — E235: o nº do avaliador é link para a página pública", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.A = await criarConta(avA, senha);
    const { data: p, error: eP } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.A, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: avA.nome, slug: `aval-t657-${sufixo}`, categorias: ["fotografia"], cidades: ["Uberlândia"] })
      .select("id")
      .single();
    if (eP) throw eP;
    ids.parc = p.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    numero = n as string;
    const { data: c, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: ids.parc, cidade: "Uberlândia", numero_credenciado: numero, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t657", conduta_versao: "2026-10-23", ativado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (eC) throw eC;
    ids.cred = c.id as string;
    // Imóvel 1: pedido designado (o bloco mostra o avaliador designado).
    ids.im1 = await criarImovelPronto(ids.dono, `T657 designado ${sufixo}`, { ativo: true });
    const { error: e1 } = await adm()
      .from("vistoria_pedidos")
      .insert({ property_id: ids.im1, owner_id: ids.dono, cidade: "Uberlândia", porte: "q1_2", valor_tabela: 350, status: "designado", avaliador_id: ids.cred, designado_em: new Date().toISOString() });
    if (e1) throw e1;
    // Imóvel 2: laudo aprovado e vistoriado (o laudo mostra "Avaliado em … nº X").
    ids.im2 = await criarImovelPronto(ids.dono, `T657 laudo ${sufixo}`, { ativo: true });
    const { data: ped, error: e2 } = await adm()
      .from("vistoria_pedidos")
      .insert({ property_id: ids.im2, owner_id: ids.dono, cidade: "Uberlândia", porte: "q1_2", valor_tabela: 350, status: "laudo_emitido", avaliador_id: ids.cred, designado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (e2) throw e2;
    const { error: eL } = await adm()
      .from("vistoria_laudos")
      .insert({ pedido_id: ped.id, pedido_versao_id: ped.id, property_id: ids.im2, owner_id: ids.dono, avaliador_id: ids.cred, numero: `VIS-T657-${sufixo}`, resultado: "aprovado", nivel_sustentado: "conforto", vistoriado_em: new Date().toISOString(), teste: true });
    if (eL) throw eL;
  });

  test.afterAll(async () => {
    const imoveis = [ids.im1, ids.im2].filter(Boolean);
    if (imoveis.length) {
      await adm().from("vistoria_laudos").delete().in("property_id", imoveis);
      await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    }
    if (ids.cred) {
      await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.cred);
      await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    }
    await apagarContas([ids.A, ids.dono]);
  });

  for (const w of LARGURAS) {
    test(`${w} px — os dois pontos: o nº é link e abre /avaliadores/[numero]`, async ({ browser }) => {
      const d = await entrar(browser, dono.email, senha);
      await comChave(d);
      await d.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      const destino = `/avaliadores/${encodeURIComponent(numero)}`;

      // 1. Avaliador designado.
      await d.goto(`/dashboard/imoveis/${ids.im1}/nivel`, { waitUntil: "domcontentloaded" });
      const designado = d.getByTestId("avaliacao-dono").getByTestId("avaliador-designado");
      await expect(designado).toHaveText(`Avaliador designado pela Viva: nº ${numero}`, { timeout: 30_000 });
      const link1 = designado.getByRole("link", { name: numero });
      await expect(link1).toHaveAttribute("href", destino);
      await designado.scrollIntoViewIfNeeded();
      await d.screenshot({ path: `${SAIDA}/t657-designado-${w}.png` });
      await link1.click();
      await d.waitForURL(new RegExp(`/avaliadores/${numero}$`), { timeout: 30_000 });
      await expect(d.getByTestId("avaliador-numero")).toHaveText(numero, { timeout: 30_000 });

      // 2. Laudo aprovado.
      await d.goto(`/dashboard/imoveis/${ids.im2}/nivel`, { waitUntil: "domcontentloaded" });
      const linha = d.getByTestId("laudo-avaliado-em");
      await expect(linha).toHaveText(new RegExp(`^Avaliado em \\d{2}/\\d{2}/\\d{4} por avaliador credenciado nº ${numero}$`), { timeout: 30_000 });
      const link2 = linha.getByRole("link", { name: numero });
      await expect(link2).toHaveAttribute("href", destino);
      await linha.scrollIntoViewIfNeeded();
      await d.screenshot({ path: `${SAIDA}/t657-laudo-${w}.png` });
      await link2.click();
      await d.waitForURL(new RegExp(`/avaliadores/${numero}$`), { timeout: 30_000 });
      await expect(d.getByTestId("avaliador-numero")).toHaveText(numero, { timeout: 30_000 });
      await d.context().close();
    });
  }
});
