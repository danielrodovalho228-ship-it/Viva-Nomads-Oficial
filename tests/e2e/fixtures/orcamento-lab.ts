import { expect, type Browser, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { adm, criarConta, criarImovelPronto, criarLead, entrar } from "./laboratorio";

/*
  Apoio dos specs de orçamentos da Pista 3 (t2028 D3, t2031 D6, t2040 F1-orçamentos). Mesmo cenário do t193 (contas
  novas, imóvel de R$ 3.200, negociação com "ficar mais tempo" 6 meses/6%), com o condomínio do anúncio opcional.
  Só no laboratório (INTEGRACOES_SIMULADAS=on).
*/
export const NEGOCIA = { aceita: true, itens: ["valor_mensal", "meses", "data_entrada", "limpeza"], descontos: [{ mesesMin: 6, pct: 6 }] };
export const emDias = (d: number): string => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
export const texto = (s: string | null | undefined): string => (s ?? "").replace(/\s+/g, " ").trim();

export interface Pessoa { id: string; email: string; nome: string }
export interface CenarioOrcamento { dono: Pessoa; imovel: string; titulo: string; moradores: (Pessoa & { lead: string })[] }

/** Dono + imóvel ativo + N moradores, cada um com a sua candidatura (nova). */
export async function cenarioOrcamento(nome: string, senha: string, o: { moradores?: number; condominio?: number } = {}): Promise<CenarioOrcamento> {
  const tag = `${nome}.${randomBytes(3).toString("hex")}`;
  const dono: Pessoa = { id: "", email: `dono.${tag}@lab.vivanomads.test`, nome: `Dona ${nome}` };
  dono.id = await criarConta({ email: dono.email, nome: `${dono.nome} Sobrenome`, role: "owner" }, senha);
  const titulo = `Studio orcamento ${nome} ${tag.split(".")[1]}`;
  const imovel = await criarImovelPronto(dono.id, titulo, { ativo: true, preco: 3200 });
  await adm()
    .from("properties")
    .update({ negociacao: NEGOCIA, min_period_days: 30, max_period_days: 180, condo_fee: o.condominio ?? 0, utilities_mode: "real", prep_fee: 0, checkout_cleaning_enabled: false, limpeza_estadia: null })
    .eq("id", imovel);
  const moradores: CenarioOrcamento["moradores"] = [];
  for (let k = 0; k < (o.moradores ?? 1); k++) {
    const m = { id: "", email: `inq${k}.${tag}@lab.vivanomads.test`, nome: `Ines${"ABCDEFG"[k]} ${nome}`, lead: "" };
    m.id = await criarConta({ email: m.email, nome: `${m.nome} Sobrenome`, role: "tenant" }, senha);
    m.lead = await criarLead(dono.id, m.id, imovel);
    moradores.push(m);
  }
  return { dono, imovel, titulo, moradores };
}

export async function abrirComo(browser: Browser, email: string, senha: string, largura = 1280): Promise<Page> {
  const p = await entrar(browser, email, senha);
  await p.setViewportSize({ width: largura, height: 900 });
  return p;
}

/** O dono monta e envia pela tela (valor, entrada em +10 dias, saída em +10+dias); devolve o id e o texto do resumo. */
export async function enviarPelaTela(p: Page, lead: string, v: { valor: number; dias: number }): Promise<{ id: string; resumoConta: string }> {
  await abrirMontagem(p, lead, v);
  const resumoConta = texto(await p.getByTestId("resumo-conta").textContent());
  await p.getByTestId("enviar-proposta").click();
  await p.waitForURL(/\/dashboard\/propostas\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  return { id: p.url().split("/").pop()!, resumoConta };
}

export async function abrirMontagem(p: Page, lead: string, v: { valor: number; dias: number }): Promise<void> {
  await p.goto(`/dashboard/orcamentos/nova?interessado=${lead}`, { waitUntil: "domcontentloaded" });
  await expect(p.getByTestId("montagem-proposta")).toBeVisible({ timeout: 20_000 });
  await p.getByTestId("proposta-valor").fill(String(v.valor));
  await p.getByTestId("proposta-data").fill(emDias(10));
  await p.getByTestId("proposta-saida").fill(emDias(10 + v.dias));
  await p.getByTestId("proposta-validade").selectOption("7");
}
