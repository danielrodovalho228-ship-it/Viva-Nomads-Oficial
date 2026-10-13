/*
  Primeira resposta na hora: Viva inteira nas categorias simples; acolhimento +
  sugestão para aprovar nas sensíveis. Roda: node --test src/lib/atendimento/acolhimento.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prazoPrometido } from "../../config/atendimento.ts";
import { ehSensivel, notaSugestao, podeMarcarResolvido, quemAtende, respostaDaSugestao, statusAposRespostaDaViva, textoAcolhimento } from "./acolhimento.ts";
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

test("F22: a resposta da Viva não muda o status — chamado nasce e segue 'Aberto'; 'Aguardando você' é só de pessoa", () => {
  assert.equal(statusAposRespostaDaViva("aberto"), "aberto");
  assert.equal(statusAposRespostaDaViva("em_andamento"), "em_andamento");
  assert.equal(statusAposRespostaDaViva("aguardando_usuario"), "aberto"); // nunca devolve "Aguardando você"
  assert.equal(statusAposRespostaDaViva(null), "aberto");
  const fonte = ler("lib/atendimento/viva-servidor.ts");
  assert.doesNotMatch(fonte, /status\s*=\s*"aguardando_usuario"/, "a Viva não grava 'aguardando_usuario'");
  assert.doesNotMatch(fonte, /: "aguardando_usuario"/);
  // quem pede algo ao usuário é a equipe (atendimento-actions) e continua gravando
  assert.match(ler("lib/data/atendimento-actions.ts"), /status: "aguardando_usuario"/);
});

test("F22: 'Sim, resolveu' continua valendo quando só a Viva respondeu", () => {
  assert.ok(podeMarcarResolvido("aberto", "ia"));
  assert.ok(podeMarcarResolvido("aguardando_usuario", "humano"));
  assert.ok(!podeMarcarResolvido("aberto", "humano"));
  assert.ok(!podeMarcarResolvido("resolvido", "ia"));
});

test("F23: o cliente vê só a promessa pública (abertura + 24 h, Brasília), não o prazo interno de 12 h", () => {
  const criado = new Date("2026-10-12T23:39:00Z"); // 20:39 em Brasília
  const prazo = prazoPrometido(criado);
  assert.equal(prazo.toISOString(), "2026-10-13T23:39:00.000Z");
  const t = textoAcolhimento({ numero: "VN-000105", rotulo: "Conta", prazo });
  assert.match(t, /até 13\/10 às 20:39 \(horário de Brasília\)/);
  assert.doesNotMatch(t, /até 13\/10 às 08:39/); // p2 interno = 12 h
});

test("F25: /contato redireciona (permanente) para /ajuda e não está no sitemap", () => {
  const cfg = readFileSync(new URL("../../../next.config.ts", import.meta.url), "utf8");
  assert.match(cfg, /source: "\/contato", destination: "\/ajuda", permanent: true/);
  const sm = readFileSync(new URL("../../app/sitemap.ts", import.meta.url), "utf8");
  assert.doesNotMatch(sm, /"\/contato"/);
});
