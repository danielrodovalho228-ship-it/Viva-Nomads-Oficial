import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, entrar, fotosDoRoteiro, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { ITENS_CHECKLIST } from "../../../src/config/checklist-avaliacao";

/*
  T2221 — E1083 (ORDEM-DUET-402; decisões da ORDEM-DUET-397 ponto 1 e do Daniel, "Liberar no piloto"): a assinatura do
  laudo no piloto e o nível escolhido. Só no laboratório (a chave da avaliação liga só neste navegador, pelo cookie de
  laboratório). TRAVA EM RASCUNHO: vermelha na main de hoje; verde com o #4100 (o nível no laudo) e o #4101 (o piloto sem CNPJ).
  Dois avaliadores SEM CNPJ (parceiro pessoa física, com CPF — o cadastro nunca fica sem documento), cada um com um
  pedido agendado e o checklist preenchido (simulação declarada, como na t305):
    (a) P, na lista do piloto (vistoria_piloto): conclui a visita, escolhe "Conforto" e assina — o laudo sai;
    (b) F, fora do piloto (pedido real): conclui, escolhe o nível e tenta assinar — recusa com "Sem o CNPJ do avaliador no
        cadastro, o laudo não pode ser assinado." e nenhum laudo sai;
    (c) o laudo de P grava o nível ESCOLHIDO ("conforto"; o checklist todo conforme não o decide) e o dono lê "Conforto".
  Só contas de teste.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE = `Uberlândia t2221 ${sufixo}`;
const conta = (p: string, nome: string, role: "owner" | "tenant" = "tenant") => ({ email: `${p}.t2221.${sufixo}@lab.vivanomads.test`, nome, role });
const avP = conta("avp", "Paulo Piloto Teste");
const avF = conta("avf", "Fabio Fora Teste");
const dono = conta("dono", "Diana Dona Teste", "owner");
const ids: Record<string, string> = {};
const cred: Record<"P" | "F", string> = { P: "", F: "" };
const pedido: Record<"P" | "F", string> = { P: "", F: "" };
const IMOVEL = { lat: -18.9186, lng: -48.2772 };
const PERTO = { latitude: -18.9178, longitude: -48.2772 };
const MSG_SEM_CNPJ = "Sem o CNPJ do avaliador no cadastro, o laudo não pode ser assinado.";

const statusDo = async (id: string) => (await adm().from("vistoria_pedidos").select("status").eq("id", id).single()).data?.status as string | undefined;
const laudoDe = async (id: string) => (await adm().from("vistoria_laudos").select("nivel_sustentado").eq("pedido_id", id).order("versao", { ascending: false }).limit(1).maybeSingle()).data as { nivel_sustentado: string } | null;

async function abrir(browser: Browser, email: string): Promise<Page> {
  const p = await entrar(browser, email, senha);
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(p.url()).origin }]);
  await p.context().grantPermissions(["geolocation"]);
  await p.context().setGeolocation(PERTO);
  return p;
}
/** Conclui a visita, escolhe o nível e assina (o caminho do #4100: seletor no formulário "Enviar o laudo"). */
async function concluirEscolherAssinar(p: Page, pedidoId: string, nivel: "essencial" | "conforto" | "premium") {
  await fotosDoRoteiro(pedidoId); // E1079 (ORDEM-431): concluir exige a foto de cada ambiente do roteiro
  await p.goto(`/dashboard/parceiro/avaliacao/${pedidoId}`, { waitUntil: "domcontentloaded" });
  await p.getByTestId("concluir-visita").getByRole("button", { name: "Concluir a visita" }).click();
  await expect.poll(() => statusDo(pedidoId), { timeout: 20_000 }).toBe("realizada");
  await p.reload({ waitUntil: "domcontentloaded" });
  const form = p.getByTestId("enviar-laudo");
  await expect(form.getByTestId(`laudo-nivel-${nivel}`), "E1083: o formulário do laudo tem onde escolher o nível").toBeVisible({ timeout: 20_000 });
  await form.getByTestId(`laudo-nivel-${nivel}`).click();
  await p.getByTestId("assino-laudo").getByRole("checkbox").check();
  await form.getByRole("button", { name: "Assinar laudo" }).click();
}

test.describe("T2221 — E1083: no piloto o laudo assina-se sem CNPJ; fora dele não; o nível é o escolhido @E1083", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.P = await criarConta(avP, senha);
    ids.F = await criarConta(avF, senha);
    ids.dono = await criarConta(dono, senha);
    for (const l of ["P", "F"] as const) {
      const { data: parc, error } = await adm()
        .from("parceiros")
        .insert({ user_id: ids[l], tipo_pessoa: "pf", documento: cpfAleatorio().replace(/\D/g, ""), nome_publico: l === "P" ? avP.nome : avF.nome, slug: `aval-${l.toLowerCase()}-t2221-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
        .select("id")
        .single();
      if (error) throw error;
      const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
      const { data: c, error: eC } = await adm()
        .from("avaliadores_credenciamento")
        .insert({ parceiro_id: parc.id, cidade: CIDADE, numero_credenciado: n, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test", conduta_versao: "2026-10-23", ativado_em: new Date().toISOString() })
        .select("id")
        .single();
      if (eC) throw eC;
      cred[l] = c.id as string;
    }
    // Só P está no piloto (a marca do E1077, #4091).
    const { error: eP } = await adm().from("vistoria_piloto").upsert({ user_id: ids.P, nota: "laboratório t2221" }, { onConflict: "user_id" });
    if (eP) throw eP;
    const horas = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
    for (const l of ["P", "F"] as const) {
      ids[`im${l}`] = await criarImovelPronto(ids.dono, `Studio ${l} T2221 ${sufixo}`, { ativo: true });
      await adm().from("properties").update({ city: CIDADE, lat: IMOVEL.lat, lng: IMOVEL.lng, lat_exata: IMOVEL.lat, lng_exata: IMOVEL.lng }).eq("id", ids[`im${l}`]);
      // Pedido real (teste=false): o que distingue P de F é só a lista do piloto.
      const { data: p, error: eD } = await adm()
        .from("vistoria_pedidos")
        .insert({ property_id: ids[`im${l}`], owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 250, status: "agendado", avaliador_id: cred[l], designado_em: horas(-30), agendado_para: horas(-2), teste: false })
        .select("id")
        .single();
      if (eD) throw eD;
      pedido[l] = p.id as string;
      await adm().from("vistoria_designacoes").insert({ pedido_id: p.id, avaliador_id: cred[l], resposta: "aceita", respondido_em: horas(-29) });
      await adm().from("vistoria_checklist").upsert(
        ITENS_CHECKLIST.map((i) => ({ pedido_id: p.id, chave: i.chave, valor: "tipo" in i && i.tipo === "limpeza" ? "pronto" : "conforme", observacao: null })),
        { onConflict: "pedido_id,chave" },
      );
      await adm().from("vistoria_pedidos").update({ ruido_respostas: { via_intensa: false, noturno_obra_100m: false, aviao_ferrovia: false, isolamento_acustico: false } }).eq("id", p.id);
    }
  });

  test.afterAll(async () => {
    const ps = Object.values(pedido).filter(Boolean);
    if (ps.length) {
      await adm().from("vistoria_laudos").delete().in("pedido_id", ps);
      await adm().from("vistoria_checklist").delete().in("pedido_id", ps);
      await adm().from("vistoria_designacoes").delete().in("pedido_id", ps);
      await adm().from("vistoria_pedidos").delete().in("id", ps);
    }
    await adm().from("vistoria_piloto").delete().eq("user_id", ids.P ?? "");
    const cs = Object.values(cred).filter(Boolean);
    if (cs.length) await adm().from("avaliadores_credenciamento").delete().in("id", cs);
    await apagarContas([ids.P, ids.F, ids.dono].filter(Boolean));
  });

  test("(a) no piloto, sem CNPJ: o avaliador escolhe Conforto e assina — o laudo sai", async ({ browser }) => {
    const p = await abrir(browser, avP.email);
    await concluirEscolherAssinar(p, pedido.P, "conforto");
    await expect.poll(() => statusDo(pedido.P), { timeout: 30_000, message: "E1083 (a): no piloto o laudo sai sem CNPJ" }).toBe("laudo_emitido");
    await expect(p.getByText(MSG_SEM_CNPJ), "E1083 (a): no piloto não aparece a recusa por CNPJ").toHaveCount(0);
    await p.context().close();
  });

  test("(b) fora do piloto, sem CNPJ: a assinatura continua recusada e nenhum laudo sai", async ({ browser }) => {
    const p = await abrir(browser, avF.email);
    await concluirEscolherAssinar(p, pedido.F, "conforto");
    await expect(p.getByText(MSG_SEM_CNPJ), "E1083 (b): fora do piloto a recusa por CNPJ continua").toBeVisible({ timeout: 20_000 });
    expect(await statusDo(pedido.F), "E1083 (b): fora do piloto o pedido não passa a laudo emitido").toBe("realizada");
    expect(await laudoDe(pedido.F), "E1083 (b): nenhum laudo gravado").toBeNull();
    await p.context().close();
  });

  test("(c) o laudo grava o nível ESCOLHIDO e o dono o lê", async ({ browser }) => {
    expect((await laudoDe(pedido.P))?.nivel_sustentado, "E1083 (c): o nível gravado é o escolhido pelo avaliador").toBe("conforto");
    const d = await abrir(browser, dono.email);
    await d.goto(`/dashboard/imoveis/${ids.imP}/nivel`, { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("laudo-dono-resultado"), "E1083 (c): o dono lê o nível escolhido no laudo").toContainText(/Conforto/i, { timeout: 20_000 });
    await d.context().close();
  });
});
