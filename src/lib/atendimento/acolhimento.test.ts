/*
  Primeira resposta na hora: Viva inteira nas categorias simples; acolhimento +
  sugestão para aprovar nas sensíveis. Roda: node --test src/lib/atendimento/acolhimento.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ehSensivel, notaSugestao, quemAtende, respostaDaSugestao, textoAcolhimento } from "./acolhimento.ts";
import { validarResposta } from "./viva-regras.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const base = { vivaAtiva: true, emergencia: false, prioridade: "p3", pedePessoa: false, categoria: "duvida" };

test("simples → Viva atende; sensível, P1 e 'falar com uma pessoa' → equipe com acolhimento; emergência → só equipe", () => {
  for (const cat of ["duvida", "anuncio", "conta", "sugestao"]) assert.equal(quemAtende({ ...base, categoria: cat }), "viva", cat);
  for (const cat of ["caucao", "contrato", "cobranca", "conflito", "imovel", "documentos", "seguranca", "acesso_imovel", "manutencao"]) {
    assert.ok(ehSensivel(cat), cat);
    assert.equal(quemAtende({ ...base, categoria: cat }), "equipe_com_acolhimento", cat);
  }
  assert.equal(quemAtende({ ...base, pedePessoa: true }), "equipe_com_acolhimento");
  assert.equal(quemAtende({ ...base, prioridade: "p1" }), "equipe_com_acolhimento");
  assert.equal(quemAtende({ ...base, vivaAtiva: false }), "equipe_com_acolhimento"); // acolhimento não depende da IA
  assert.equal(quemAtende({ ...base, emergencia: true }), "equipe");
});

test("acolhimento: número, prazo em Brasília, sem promessa e passa nas regras de texto da Viva", () => {
  const t = textoAcolhimento({ numero: "VN-000101", rotulo: "Caução", prazo: new Date("2026-10-08T05:57:51Z") });
  assert.match(t, /VN-000101/);
  assert.match(t, /Caução/);
  assert.match(t, /até 08\/10 às 02:57 \(horário de Brasília\)/);
  assert.doesNotMatch(t, /apartamento|garantimos|com certeza|reembols|devolv/i);
  assert.ok(validarResposta(t).ok, "regras da Viva");
});

test("nota de sugestão: o botão 'Aprovar e enviar' lê só a resposta", () => {
  const n = notaSugestao("Olá, Ana! Conferimos a Caução do seu contrato…", ["Contratos", "Caução"]);
  assert.match(n, /Consultou: Contratos, Caução\./);
  assert.equal(respostaDaSugestao(n), "Olá, Ana! Conferimos a Caução do seu contrato…");
  assert.equal(respostaDaSugestao("nota qualquer da equipe"), null);
});

test("ligações: site e e-mail usam a mesma regra; aprovar pega o texto do banco, não do navegador", () => {
  const acoes = ler("lib/data/atendimento-actions.ts");
  assert.match(acoes, /const atende = quemAtende\(/);
  assert.match(acoes, /else if \(atende === "equipe_com_acolhimento"\) after\(\(\) => responderNaEquipe\(c\.id, "abertura"\)\)/);
  // Nova mensagem num chamado com a equipe: a Viva sugere/responde e avisa o Daniel com a sugestão.
  assert.match(acoes, /else if \(comEquipe\) after\(\(\) => responderNaEquipe\(c\.id as string, "mensagem"\)\)/);
  assert.match(acoes, /export async function aprovarSugestao\(chamadoId: string, mensagemId: number\)/);
  const email = ler("app/api/atendimento/email/route.ts");
  assert.match(email, /const catKey = triagem\("duvida"/);
  assert.match(email, /responderNaEquipe\(novo\.id as string, "abertura"\)/);
  assert.match(email, /responderNaEquipe\(c\.id as string, "mensagem"\)/);
  const serv = ler("lib/atendimento/viva-servidor.ts");
  assert.match(serv, /if \(momento === "abertura" && publicas\.some\(\(m\) => m\.autor === "ia" \|\| m\.autor === "admin"\)\) return; \/\/ idempotente/);
  assert.match(serv, /vivaAtiva\(\) && \(await consumirLimite\("viva:dia", limiteDia\(\), DIA\)\)/);
});
