import { test, expect, type Browser, type Page } from "@playwright/test";
import { inflateSync } from "node:zlib";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2211 — E1074 (desdobramento do E1069; ORDEM-DUET-342/346): o pacote de provas, na secção PAGAMENTOS, nomeia cada
  documento pelo número e dá à caução uma linha própria. Só no laboratório. TRAVA EM RASCUNHO: nasce vermelha na main
  de hoje (a secção só traz os totais) e fica verde quando a correcção da Fable entrar.
  Tudo pela tela: o dono regista o 1º pagamento e a caução; a moradora confirma os dois; saem o recibo (REC-…) e o
  comprovante da caução (CAU-…). O pacote, baixado pelas duas partes, tem de trazer na secção PAGAMENTOS:
    1. o número do recibo do aluguel;
    2. o número do comprovante da caução;
    3. uma linha própria para a caução, com o valor (R$ 1.500,00).
  As três verificações são suaves: uma corrida mostra as três razões de uma vez. O texto exacto das linhas é da Fable;
  o spec só exige o que o item pede (o número e a linha da caução com o valor), não a redacção.
  Vizinha do E1072 (#4084, ORDEM-DUET-1095): corre também no portão do #4084, porque o registro do pagamento do bloco
  passou a conferir o teto também no 1º registro (não passa do que o contrato diz que o bloco custa).
  Vizinha do teto da caução (ORDENS-DUET 1098 e 1107): corre também no portão desse avulso, porque o registro da
  caução passou a não passar da soma das cauções dos blocos do contrato.
  Vizinha do E1225 (ORDENS-DUET 1120 e 1127): corre também no portão desse PR, porque a caução passou a ser
  registada por bloco (0367), com uma linha por bloco no cartão da caução.
  ORDEM-DUET-1134 (correção de fragilidade, não de comportamento): o caso 1 esperava a mensagem `recebimento-registrado`,
  que é TRANSITÓRIA — depois do sucesso, o router.refresh() troca o formulário pelo estado gravado e a mensagem some;
  com o refresh rápido, a espera não a via (flaky nas runs 8833 e 8838). Agora confere o registro GRAVADO no banco: o
  pagamento ativo do contrato, do tipo daquela volta (aluguel e caução), igual a 1 — o padrão da t230 desde o E1020.
  Vizinha do E1229 (ORDENS-DUET 1143 e 1160): corre também no portão desse PR, porque a tela do contrato ganhou a
  anulação dos registros e a conferência passou a dizer 'Anulado em {data}: {motivo}'.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2211.${sufixo}@lab.vivanomads.test`, nome: "Dalva Recibos", role: "owner" as const };
const mor = { email: `mor.t2211.${sufixo}@lab.vivanomads.test`, nome: "Moema Recibos", role: "tenant" as const };
const ids: { dono?: string; mor?: string; imovel?: string; lead?: string; contrato?: string } = {};
const dia = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
const CAUCAO = "R$ 1.500,00";

async function abrir(browser: Browser, email: string): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: 1280, height: 900 });
  return page;
}

/** O texto de um PDF do pdf-lib (fluxos Flate; texto em hex "<..> Tj", Helvetica WinAnsi). */
function textoDoPdf(buf: Buffer): string {
  const s = buf.toString("latin1");
  const out: string[] = [];
  for (const m of s.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let txt: string;
    try { txt = inflateSync(Buffer.from(m[1], "latin1")).toString("latin1"); } catch { txt = m[1]; }
    for (const t of txt.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) out.push(Buffer.from(t[1], "hex").toString("latin1"));
    for (const t of txt.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) out.push(t[1]);
  }
  return out.join("\n");
}

/** A secção PAGAMENTOS do pacote (entre "PAGAMENTOS" e a secção seguinte). */
function secaoPagamentos(texto: string): string {
  const i = texto.indexOf("PAGAMENTOS");
  if (i < 0) return "";
  const fim = texto.indexOf("CONFERÊNCIAS", i);
  return texto.slice(i, fim > i ? fim : undefined);
}

test.describe("T2211 — E1074: o pacote de provas nomeia os recibos pelo número e dá linha própria à caução @E1074", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.mor = await criarConta(mor, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.mor]);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio dos recibos ${sufixo}`, { ativo: true, preco: 3000 });
    ids.lead = await criarLead(ids.dono, ids.mor, ids.imovel, true);
    const agora = new Date().toISOString();
    // Simulação declarada: o contrato nasce assinado pelas duas partes (a assinatura tem prova própria, t2157 etapa 8).
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({
        lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.mor, owner_plan: "essential", faixa: "media_estadia",
        prazo_total_dias: 60, aluguel_mensal: 3000, tamanho_bloco_meses: 2, comissao_percent: 0.1, comissao_valor: 600,
        qtd_ocupantes: 1, capacidade_snapshot: 2, assinado_proprietario_em: agora, assinado_inquilino_em: agora,
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    const { error: e1 } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(8), fim: dia(67), meses: 2, valor: 6000, caucao: 1500, status: "ativo" });
    if (e1) throw e1;
  });
  test.afterAll(async () => {
    if (ids.contrato) await adm().from("documentos_fiscais").delete().eq("contrato_id", ids.contrato);
    await apagarContas([ids.dono!, ids.mor!].filter(Boolean));
  });

  test("1. o dono regista o 1º pagamento e a caução; a moradora confirma; saem o recibo e o comprovante", async ({ browser }) => {
    test.info().annotations.push({ type: "simulação", description: "contrato assinado pelas duas partes gravado pelo laboratório; pagamentos registados e confirmados pela tela" });
    const d = await abrir(browser, dono.email);
    for (const botao of ["registrar-recebimento", "registrar-caucao"] as const) {
      await d.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
      await d.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await d.getByTestId(botao).first().click();
      await d.getByTestId("confirmar-recebimento").click();
      // ORDEM-DUET-1134: o registro gravado, não a mensagem transitória que o router.refresh() troca pelo estado gravado.
      const tipo = botao === "registrar-caucao" ? "caucao" : "aluguel";
      await expect
        .poll(
          async () => ((await adm().from("pagamentos_bloco").select("id").eq("contrato_id", ids.contrato!).eq("tipo", tipo).is("anulado_em", null)).data ?? []).length,
          { timeout: 20_000, message: `o registro de ${tipo} grava` },
        )
        .toBe(1);
    }
    await d.context().close();

    const m = await abrir(browser, mor.email);
    await m.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    const confirmar = m.getByTestId("confirmar-pagamentos");
    await expect(confirmar.getByRole("button", { name: /Confirmar/ })).toHaveCount(2, { timeout: 20_000 });
    for (let i = 0; i < 2; i++) {
      await confirmar.getByRole("button", { name: /Confirmar/ }).first().click();
      await expect(confirmar.getByRole("button", { name: /Confirmar/ })).toHaveCount(1 - i, { timeout: 20_000 });
    }
    await m.context().close();

    await expect
      .poll(async () => ((await adm().from("documentos_fiscais").select("tipo").eq("contrato_id", ids.contrato!)).data ?? []).map((x) => x.tipo).sort(), {
        timeout: 60_000,
        message: "saem o recibo do aluguel e o comprovante da caução",
      })
      .toEqual(["comprovante_caucao", "recibo_aluguel"]);
  });

  test("2. o pacote de provas, nas duas partes: cada documento pelo número e a caução com linha própria", async ({ browser }) => {
    const { data: docs } = await adm().from("documentos_fiscais").select("tipo, numero").eq("contrato_id", ids.contrato!);
    const recibo = docs!.find((x) => x.tipo === "recibo_aluguel")!.numero as string;
    const comprovante = docs!.find((x) => x.tipo === "comprovante_caucao")!.numero as string;
    for (const quem of [dono, mor]) {
      const p = await abrir(browser, quem.email);
      const r = await p.request.get(`/api/contrato/${ids.contrato}/provas`);
      expect(r.status(), `${quem.nome}: a rota devolve o pacote`).toBe(200);
      const secao = secaoPagamentos(textoDoPdf(await r.body()));
      expect(secao, `${quem.nome}: o pacote tem a secção PAGAMENTOS`).toContain("PAGAMENTOS");
      expect.soft(secao, `${quem.nome}: E1074 — o recibo do aluguel aparece pelo número (${recibo})`).toContain(recibo);
      expect.soft(secao, `${quem.nome}: E1074 — o comprovante da caução aparece pelo número (${comprovante})`).toContain(comprovante);
      expect.soft(secao, `${quem.nome}: E1074 — a caução tem linha própria, com o valor`).toMatch(new RegExp(`Cau[cç][aã]o[^\\n]*${CAUCAO.replace(/[.$]/g, "\\$&").replace(" ", "[\\s\\u00a0]")}`));
      await p.context().close();
    }
  });
});
