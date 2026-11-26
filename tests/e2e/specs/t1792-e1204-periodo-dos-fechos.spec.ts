import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1792 — E1204 @E1204 (ORDEM-DUET-972/973; trava de tela dada na ORDEM-DUET-973). Linha Proposta e contrato.
  Antes: em "Seus fechamentos", o período de cada linha era "X a Y" com o fim INCLUSIVO (a última noite) como segundo
  termo, contra a regra do E1089. A linha da candidatura por fechar (C) ainda punha a SAÍDA (`fim_desejado`) no lugar do
  fim inclusivo: a mesma estadia tinha contas diferentes conforme a linha.
  Depois: as três linhas dizem "Entrada DD/MM/AAAA · Saída DD/MM/AAAA · N diárias", e a mesma estadia dá o mesmo texto.
  Massa só no laboratório, contas de teste, uma dona com três candidaturas aceitas e a mesma estadia de 31 noites:
   - C: candidatura sem proposta nem contrato, com a janela (entrada, saída) gravada;
   - A: candidatura com a proposta acordada (31 dias), sem contrato;
   - B: candidatura com um contrato sem proposta, de período [entrada, última noite].
  Pela tela (1280 px): cada linha mostra Entrada, Saída (entrada + 31) e "31 diárias"; nenhuma mostra "X a Y".
  Laboratório; não é prova ao vivo no site.
*/
const SAIDA_PRINTS = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = (nome: string, quem: string, role: "owner" | "tenant") => ({ email: `${quem}.t1792.${sufixo}@lab.vivanomads.test`, nome, role });
const D = conta("Dina Periodo Sobrenome", "dona", "owner");
const M1 = conta("Mara Periodo Sobrenome", "mora1", "tenant");
const M2 = conta("Mila Periodo Sobrenome", "mora2", "tenant");
const M3 = conta("Mona Periodo Sobrenome", "mora3", "tenant");

const ids: Record<string, string> = {};
const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const haDias = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const NOITES = 31;
const ENTRADA = emDias(40);
const SAIDA = emDias(40 + NOITES);
const ULTIMA_NOITE = emDias(40 + NOITES - 1);
const ESPERADO = `Entrada ${br(ENTRADA)} · Saída ${br(SAIDA)} · ${NOITES} diárias`;

async function aceitar(lead: string, quando: string) {
  const { error } = await adm().from("leads").update({ accepted_at: quando, accepted_plan: "essential", accepted_commission_rate: 0.12 }).eq("id", lead);
  if (error) throw error;
}

async function noFechamento(browser: Browser): Promise<Page> {
  const page = await entrar(browser, D.email, senha);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dashboard/fechamento", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("seus-fechamentos")).toBeVisible({ timeout: 30_000 });
  return page;
}
const linha = (page: Page, lead: string) => page.locator(`[data-testid="fecho-linha"][data-candidatura="${lead}"]`);

test.beforeAll(async () => {
  if (!NO_LABORATORIO) return;
  for (const [k, c] of Object.entries({ D, M1, M2, M3 })) ids[k] = await criarConta(c, senha);
  await adm().from("profiles").update({ is_teste: true }).in("id", Object.values(ids));
  ids.imC = await criarImovelPronto(ids.D, `[TESTE QA] Periodo C ${sufixo}`, { ativo: true, preco: 2800 });
  ids.imA = await criarImovelPronto(ids.D, `[TESTE QA] Periodo A ${sufixo}`, { ativo: true, preco: 2800 });
  ids.imB = await criarImovelPronto(ids.D, `[TESTE QA] Periodo B ${sufixo}`, { ativo: true, preco: 2800 });

  // C: só a candidatura aceita, com a janela (entrada, SAÍDA) que o morador pediu.
  ids.leadC = await criarLead(ids.D, ids.M1, ids.imC, true);
  await aceitar(ids.leadC, haDias(3));
  const { error: eJ } = await adm().from("leads").update({ inicio_desejado: ENTRADA, fim_desejado: SAIDA }).eq("id", ids.leadC);
  if (eJ) throw eJ;

  // A: a proposta acordada de 31 dias, sem contrato.
  ids.leadA = await criarLead(ids.D, ids.M2, ids.imA, true);
  await aceitar(ids.leadA, haDias(4));
  const { data: numero } = await adm().rpc("next_document_number", { p_type: "orcamento", p_year: new Date().getFullYear() });
  const { data: p, error: eP } = await adm()
    .from("propostas")
    .insert({ numero, lead_id: ids.leadA, property_id: ids.imA, owner_id: ids.D, tenant_id: ids.M2, status: "aceita", versao_atual: 1, validade_dias: 7, valida_ate: `${emDias(7)}T23:00:00Z`, aceita_em: haDias(4) })
    .select("id")
    .single();
  if (eP) throw eP;
  const { error: eV } = await adm().from("proposta_versoes").insert({
    proposta_id: p.id, versao: 1, autor: "owner", valor_base: 2800, valor_mensal: 2800, meses: 1, dias: NOITES, data_entrada: ENTRADA, total_mensal: 2800, total_contrato: 2893, mensagem: "Proposta da t1792.",
  });
  if (eV) throw eV;

  // B: um contrato sem proposta, com o período gravado [entrada, última noite].
  ids.leadB = await criarLead(ids.D, ids.M3, ids.imB, true);
  await aceitar(ids.leadB, haDias(5));
  const { error: eC } = await adm()
    .from("contratos")
    .insert({ lead_id: ids.leadB, property_id: ids.imB, tenant_id: ids.M3, proposta_id: null, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: NOITES, aluguel_mensal: 2800, tamanho_bloco_meses: 1, comissao_percent: 0.12, comissao_valor: 347, qtd_ocupantes: 1, garantia: "caucao", status: "ativo", periodo: `[${ENTRADA},${ULTIMA_NOITE}]`, created_at: haDias(5), assinado_proprietario_em: haDias(5), assinado_inquilino_em: haDias(5) });
  if (eC) throw eC;
});

test.afterAll(async () => {
  const leads = [ids.leadC, ids.leadA, ids.leadB].filter(Boolean);
  if (leads.length) {
    await adm().from("contratos").delete().in("lead_id", leads);
    await adm().from("propostas").delete().in("lead_id", leads);
    await adm().from("leads").delete().in("id", leads);
  }
  const imoveis = [ids.imC, ids.imA, ids.imB].filter(Boolean);
  if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
  await apagarContas([ids.D, ids.M1, ids.M2, ids.M3]);
});

test.describe("T1792 — E1204: o período das linhas de Seus fechamentos @E1204", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test("as três linhas da mesma estadia dizem Entrada · Saída · 31 diárias; nenhuma diz 'X a Y'", async ({ browser }) => {
    const page = await noFechamento(browser);
    for (const [tipo, lead] of [["C", ids.leadC], ["A", ids.leadA], ["B", ids.leadB]] as const) {
      const periodo = linha(page, lead).getByTestId("fecho-periodo");
      await expect(periodo, `linha ${tipo}`).toContainText(ESPERADO);
      // O formato antigo: "DD/MM/AAAA a DD/MM/AAAA" (uma string " a " seria aparada pelo Playwright e casaria "Entrada").
      await expect(periodo, `linha ${tipo}: nunca a última noite como segundo termo`).not.toHaveText(/\d{2}\/\d{2}\/\d{4} a \d{2}\/\d{2}\/\d{4}/);
    }
    await page.screenshot({ path: `${SAIDA_PRINTS}/t1792-periodo-1280.png`, fullPage: true });
    await page.context().close();
  });
});
