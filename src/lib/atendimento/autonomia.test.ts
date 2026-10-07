/*
  Viva com autonomia (decisão do Daniel, 07/10) e escalonamento 2 h / 6 h.
  Roda: node --test src/lib/atendimento/autonomia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { motivoParaAprovacao, nivelEscalonamento, textoAcolhimento } from "./acolhimento.ts";
import { sugestaoPorRegra } from "./resumo.ts";

const VN101 = "Sou proprietário e quero entender como funciona o Caução. Vocês oferecem seguro para o imóvel?";
const ok = sugestaoPorRegra(VN101, "Paulo", false);

test("Caução simples com resposta oficial → a Viva responde sozinha", () => {
  assert.equal(motivoParaAprovacao(VN101, ok), null);
  assert.equal(motivoParaAprovacao("Como funciona a devolução da Caução no fim do contrato?", sugestaoPorRegra("caução", null, true)), null);
});

test("dinheiro, reembolso, disputa, jurídico, dado pessoal e golpe → aprovação do Daniel", () => {
  const casos: [string, string][] = [
    ["Já paguei o primeiro aluguel e não apareceu", "dinheiro já pago"],
    ["Quero o reembolso da taxa", "reembolso ou estorno"],
    ["Minha caução ainda não foi devolvida depois da saída", "reembolso ou estorno"],
    ["A devolução da caução está atrasada", "reembolso ou estorno"],
    ["O proprietário me enganou, briga sobre a vistoria", "disputa ou conflito"],
    ["Vou falar com meu advogado e entrar no Procon", "ameaça jurídica"],
    ["Meu CPF é 123.456.789-00, podem conferir?", "dado pessoal"],
    ["O dono pediu Pix por fora", "golpe ou pagamento por fora"],
  ];
  for (const [t, m] of casos) assert.equal(motivoParaAprovacao(t, ok), m, t);
});

test("sem sugestão, regra de texto apontando algo ou a Viva sem a informação → aprovação", () => {
  assert.equal(motivoParaAprovacao(VN101, null), "sem sugestão da Viva");
  assert.match(motivoParaAprovacao(VN101, ok, "promessa de prazo") ?? "", /regras de texto/);
  assert.equal(motivoParaAprovacao("Qual o CNPJ de vocês?", "Ainda não tenho essa informação; vou verificar com a equipe."), "a Viva não tem a informação oficial");
});

test("acolhimento muda quando a Viva já respondeu", () => {
  const t = textoAcolhimento({ numero: "VN-000101", rotulo: "Caução", prazo: new Date("2026-10-08T05:57:00Z"), respondidoPelaViva: true });
  assert.match(t, /A Viva já respondeu logo abaixo com a informação oficial/);
  assert.match(t, /uma pessoa da equipe continua daqui até 08\/10 às 02:57/);
});

test("escalonamento: 2 h → aviso; 6 h → vermelho; só com a vez da equipe e sem resposta humana", () => {
  const agora = new Date("2026-10-07T21:00:00Z");
  const base = { status: "aberto", responsavel_tipo: "humano", respondidoPorPessoa: false };
  assert.equal(nivelEscalonamento({ ...base, criado_em: "2026-10-07T19:30:00Z" }, agora), 0);
  assert.equal(nivelEscalonamento({ ...base, criado_em: "2026-10-07T18:59:00Z" }, agora), 2);
  assert.equal(nivelEscalonamento({ ...base, criado_em: "2026-10-07T14:57:00Z" }, agora), 6);
  assert.equal(nivelEscalonamento({ ...base, status: "aguardando_aprovacao", criado_em: "2026-10-07T14:57:00Z" }, agora), 6);
  assert.equal(nivelEscalonamento({ ...base, status: "aguardando_usuario", criado_em: "2026-10-07T14:57:00Z" }, agora), 0);
  assert.equal(nivelEscalonamento({ ...base, respondidoPorPessoa: true, criado_em: "2026-10-07T14:57:00Z" }, agora), 0);
  assert.equal(nivelEscalonamento({ ...base, responsavel_tipo: "ia", criado_em: "2026-10-07T14:57:00Z" }, agora), 0);
});

test("ligações: cron avisa 1× por nível; Central mostra vermelho; Moacir vê a marca", () => {
  const cron = readFileSync(new URL("../../app/api/cron/atendimento/route.ts", import.meta.url), "utf8");
  assert.match(cron, /const acao = `escalado_\$\{nivel\}h`;/);
  assert.match(readFileSync(new URL("../../app/(dashboard)/admin/agentes/central-client.tsx", import.meta.url), "utf8"), /data-testid="chamados-vermelhos"/);
  assert.match(readFileSync(new URL("../agentes/servidor.ts", import.meta.url), "utf8"), /"VERMELHO" : "ATENÇÃO"/);
  const viva = readFileSync(new URL("./viva-servidor.ts", import.meta.url), "utf8");
  assert.match(viva, /registrarAcaoViva\(admin, c, "respondido_viva"/);
});
