import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, cnpjAleatorio } from "../fixtures/laboratorio";

/*
  T1563 — E743 (#3532; L-107 do relatório 08/11): /dashboard/imoveis/<id>/nivel com laudo ASSINADO abre normalmente (a tela não cai em
  "Não conseguimos abrir esta tela"): o selo da assinatura é componente de servidor, sem onFocus, e o campo do hash inteiro seleciona tudo
  ao clicar (select-all). Laudo sem assinatura continua sem o selo. 390 e 1280 px. Só no laboratório. Mesma massa da t1429.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1563.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const avA = { email: `ava.t1563.${sufixo}@lab.vivanomads.test`, nome: "Caio Avaliador", role: "tenant" as const };
const ids: Record<string, string> = {};
const HASH = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

async function comChave(page: Page) {
  await page.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(page.url() === "about:blank" ? "http://localhost:3123" : page.url()).origin }]);
}

async function semearLaudo(propertyId: string, numero: string, assinado: boolean) {
  const { data: ped, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: propertyId, owner_id: ids.dono, cidade: "Uberlândia", porte: "q1_2", valor_tabela: 350, status: "laudo_emitido", avaliador_id: ids.cred, designado_em: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw error;
  const { error: eL } = await adm()
    .from("vistoria_laudos")
    .insert({ pedido_id: ped.id, pedido_versao_id: ped.id, property_id: propertyId, owner_id: ids.dono, avaliador_id: ids.cred, numero, resultado: "aprovado", nivel_sustentado: "conforto", vistoriado_em: new Date().toISOString(), teste: true, ...(assinado ? { assinatura_hash: HASH, assinado_em: new Date().toISOString() } : {}) });
  if (eL) throw eL;
}

test.describe("T1563 — E743: /nivel com laudo assinado abre", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.A = await criarConta(avA, senha);
    const { data: p, error: eP } = await adm().from("parceiros").insert({ user_id: ids.A, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: avA.nome, slug: `aval-t1563-${sufixo}`, categorias: ["fotografia"], cidades: ["Uberlândia"] }).select("id").single();
    if (eP) throw eP;
    ids.parc = p.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: c, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: ids.parc, cidade: "Uberlândia", numero_credenciado: n as string, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1563", conduta_versao: "2026-10-23", ativado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (eC) throw eC;
    ids.cred = c.id as string;
    ids.imAss = await criarImovelPronto(ids.dono, `T1563 assinado ${sufixo}`, { ativo: true });
    ids.imSem = await criarImovelPronto(ids.dono, `T1563 sem assinatura ${sufixo}`, { ativo: true });
    await semearLaudo(ids.imAss, `VIS-T1563-A-${sufixo}`, true);
    await semearLaudo(ids.imSem, `VIS-T1563-S-${sufixo}`, false);
  });
  test.afterAll(async () => {
    const imoveis = [ids.imAss, ids.imSem].filter(Boolean);
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

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: laudo assinado abre a tela, mostra o selo e o hash selecionável; sem assinatura não mostra a linha`, async ({ browser }) => {
      const d = await entrar(browser, dono.email, senha);
      await comChave(d);
      await d.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await d.goto(`/dashboard/imoveis/${ids.imAss}/nivel`, { waitUntil: "domcontentloaded" });
      await expect(d.getByText("Não conseguimos abrir esta tela")).toHaveCount(0);
      const linha = d.getByTestId("laudo-assinatura");
      await expect(linha).toBeVisible({ timeout: 30_000 });
      await expect(linha).toContainText(/Assinado pelo avaliador em \d{2}\/\d{2}\/\d{4}/);
      await expect(linha).toContainText(`laudo VIS-T1563-A-${sufixo}`);
      await expect(linha).toContainText(`${HASH.slice(0, 8)}…${HASH.slice(-8)}`);
      const campo = d.getByLabel("Hash completo da assinatura");
      await expect(campo).toHaveValue(HASH);
      expect(await campo.evaluate((el) => getComputedStyle(el).userSelect), "o clique seleciona o hash inteiro").toBe("all");
      expect(await d.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

      await d.goto(`/dashboard/imoveis/${ids.imSem}/nivel`, { waitUntil: "domcontentloaded" });
      await expect(d.getByText(`VIS-T1563-S-${sufixo}`).first()).toBeVisible({ timeout: 30_000 });
      await expect(d.getByTestId("laudo-assinatura")).toHaveCount(0);
      await d.context().close();
    });
  }
});
