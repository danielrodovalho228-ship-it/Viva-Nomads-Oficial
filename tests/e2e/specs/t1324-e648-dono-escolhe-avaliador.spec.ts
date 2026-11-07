import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1324 — E648 parte 1 (#2964, na main desde 06/11): REDESENHO DO AVALIADOR. O sistema SUGERE avaliadores e o DONO ESCOLHE (fim do
  rodízio designado); o avaliador propõe o PRÓPRIO valor e prazo; o dono aceita. Tudo atrás da chave VISTORIA_ATIVA, ligada só
  no navegador do teste pelo cookie de laboratório (vn_lab_vistoria). Entrou só com teste de unidade; aqui é a tela do dono
  (/dashboard/imoveis/<id>/nivel), a 390 e 1280 px, seguindo o pedido de ponta a ponta:
   1. pedido em aberto: "Escolha o avaliador", a faixa de referência diz que cada avaliador define o próprio valor e prazo,
      e a avaliadora aparece como sugerida, com o botão "Escolher este avaliador" (a Viva não designa sozinha);
   2. o dono escolhe: "Avaliador escolhido por você: nº …" e "O avaliador tem 24 horas para responder com o valor e o prazo dele";
   3. o avaliador propõe (gravado no banco, como a tela dele faria): "Proposta do avaliador: R$ … · laudo em N dias", com
      "Aceitar valor e prazo" e "Escolher outro avaliador";
   4. o dono aceita: "Combinado com o avaliador: R$ … · laudo em N dias".
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1324.${sufixo}@lab.vivanomads.test`, nome: "Dora Escolhe Sobrenome", role: "owner" as const };
const aval = { email: `aval.t1324.${sufixo}@lab.vivanomads.test`, nome: "Augusto Avalia Sobrenome", role: "tenant" as const };
const ids: Record<string, string> = {};

test.describe("T1324 — E648: o dono escolhe o avaliador e aceita a proposta", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    ids.dono = await criarConta(dono, senha);
    ids.aval = await criarConta(aval, senha);
    await adm().from("profiles").update({ is_teste: true, preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    const { data: parc, error: eP } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.aval, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: aval.nome, slug: `aval-t1324-${sufixo}`, categorias: ["fotografia"], cidades: ["Uberlândia"], status: "publicado", publicado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (eP) throw eP;
    ids.parceiro = parc.id as string;
    const { data: numero } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: cr, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: ids.parceiro, cidade: "Uberlândia", numero_credenciado: numero as string, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1324", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id, numero_credenciado")
      .single();
    if (eC) throw eC;
    ids.cred = cr.id as string;
    ids.numero = cr.numero_credenciado as string;
  });
  test.afterAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    const imoveis = [ids.imovelA, ids.imovelB].filter((x): x is string => !!x);
    if (imoveis.length) await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    if (ids.cred) {
      await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.cred);
      await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    }
    if (ids.parceiro) await adm().from("parceiros").delete().eq("id", ids.parceiro);
    await apagarContas([ids.aval, ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: sugere, o dono escolhe, o avaliador propõe e o dono aceita`, async ({ browser }, info) => {
      test.skip(info.project.name !== "chromium", "roda só no chromium (os dois tamanhos saem dentro do teste)");
      const chave = w === 390 ? "imovelA" : "imovelB";
      ids[chave] = await criarImovelPronto(ids.dono, `Imovel escolha avaliador t1324 ${w} ${sufixo}`, { ativo: true });
      const { data: ped, error } = await adm()
        .from("vistoria_pedidos")
        .insert({ property_id: ids[chave], owner_id: ids.dono, cidade: "Uberlândia", porte: "q1_2", valor_tabela: 350, status: "pedido" })
        .select("id")
        .single();
      if (error) throw error;
      const pedidoId = ped.id as string;

      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
      try {
        const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
        await ctx.addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(p.url()).origin }]);
        const abrir = () => p.goto(`/dashboard/imoveis/${ids[chave]}/nivel`, { waitUntil: "domcontentloaded" });

        // 1. A Viva sugere; o dono escolhe.
        await abrir();
        const escolha = p.getByTestId("avaliacao-escolha");
        await expect(escolha).toContainText("Escolha o avaliador", { timeout: 30_000 });
        await expect(p.getByTestId("avaliacao-faixa")).toContainText("Cada avaliador define o próprio valor e prazo");
        const sugerido = p.getByTestId("avaliacao-sugerido").filter({ hasText: ids.numero });
        await expect(sugerido).toBeVisible();
        await sugerido.getByRole("button", { name: "Escolher este avaliador" }).click();

        // 2. Escolhido: o avaliador tem 24 h para propor.
        await expect(p.getByTestId("avaliador-designado")).toContainText(`Avaliador escolhido por você: nº ${ids.numero}`, { timeout: 30_000 });
        await expect(p.getByTestId("avaliacao-aguarda-proposta")).toContainText("24 horas");
        await expect.poll(async () => (await adm().from("vistoria_pedidos").select("status, avaliador_id").eq("id", pedidoId).single()).data).toMatchObject({ status: "designado", avaliador_id: ids.cred });

        // 3. O avaliador propõe o próprio valor e prazo (o que a tela dele grava).
        const agora = new Date().toISOString();
        expect((await adm().from("vistoria_pedidos").update({ valor_proposto: 420, prazo_proposto_dias: 5, proposta_em: agora }).eq("id", pedidoId)).error).toBeNull();
        await abrir();
        const proposta = p.getByTestId("avaliacao-proposta");
        await expect(proposta).toContainText("Proposta do avaliador");
        await expect(proposta).toContainText("420");
        await expect(proposta).toContainText("laudo em 5 dias");
        await expect(proposta.getByRole("button", { name: "Escolher outro avaliador" })).toBeVisible();

        // 4. O dono aceita.
        await proposta.getByRole("button", { name: "Aceitar valor e prazo" }).click();
        await expect(p.getByTestId("avaliacao-proposta-aceita")).toContainText("laudo em 5 dias", { timeout: 30_000 });
        expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      } finally {
        await ctx.close();
      }
    });
  }
});
