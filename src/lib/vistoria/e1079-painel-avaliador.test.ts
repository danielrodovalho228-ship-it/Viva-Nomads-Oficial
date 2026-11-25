/*
  E1079 (ORDEM-DUET-385/386), fatia 2 — o painel do avaliador pelo mockup aprovado (avaliador-painel): a saudação, as
  visitas de hoje, a foto de perfil da conta no cabeçalho (ou as iniciais) e os quatro cartões.
  O que o desenho mostra como exemplo (nome, contagens, valor) vem sempre do sistema.
  Decisões da ORDEM-DUET-397 aplicadas: o nome é "Avaliador credenciado"; o valor é o da tabela da cidade para o porte.
  Roda: node --test src/lib/vistoria/e1079-painel-avaliador.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CARTOES_DO_PAINEL, faixaVisitasHoje, fraseVisitasHoje, resumoDoPainel, saudacaoDoAvaliador, valorDoPedido, type PedidoDoPainel } from "./painel-avaliador.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const AGORA = new Date("2026-11-22T15:00:00Z"); // 12:00 de 22/11 em Brasília
const p = (x: Partial<PedidoDoPainel>): PedidoDoPainel => ({ status: "designado", agendado_para: null, recebido_marcado_em: null, valor_tabela: 250, valor_proposto: null, proposta_aceita_em: null, teste: false, ...x });

test("saudação: o primeiro nome da conta; sem nome, saúda sem inventar", () => {
  assert.equal(saudacaoDoAvaliador("Renato Teste Avaliador"), "Olá, Renato!");
  assert.equal(saudacaoDoAvaliador("[TESTE QA] Ana Souza"), "Olá, Ana!");
  assert.equal(saudacaoDoAvaliador(""), "Olá!");
  assert.equal(saudacaoDoAvaliador("alguem@exemplo.test"), "Olá!");
});

test("visitas de hoje: as frases do desenho, no singular, no plural e sem visita", () => {
  assert.equal(fraseVisitasHoje(1), "Você tem 1 visita hoje");
  assert.equal(fraseVisitasHoje(2), "Você tem 2 visitas hoje");
  assert.equal(fraseVisitasHoje(0), "Você não tem visita hoje");
  assert.equal(faixaVisitasHoje(1), "1 visita para hoje");
  assert.equal(faixaVisitasHoje(3), "3 visitas para hoje");
  assert.equal(faixaVisitasHoje(0), "Nenhuma visita para hoje");
});

test("resumo: visita de hoje é a agendada para o dia de Brasília; 'novo' é o pedido à espera de resposta", () => {
  const r = resumoDoPainel(
    [
      p({ status: "agendado", agendado_para: "2026-11-22T18:00:00Z" }), // 15:00 de hoje
      p({ status: "agendado", agendado_para: "2026-11-23T02:30:00Z" }), // 23:30 de hoje em Brasília (já é dia 23 em UTC)
      p({ status: "agendado", agendado_para: "2026-11-23T12:00:00Z" }), // amanhã
      p({ status: "realizada", agendado_para: "2026-11-22T12:00:00Z" }), // já feita: não é mais visita por fazer
      p({ status: "cancelada", agendado_para: "2026-11-22T19:00:00Z" }),
    ],
    2,
    AGORA,
  );
  assert.equal(r.visitasHoje, 2);
  assert.equal(r.novos, 2);
});

test("recebidos: soma só o que o avaliador marcou como recebido; o valor é o da tabela da cidade (ORDEM-397)", () => {
  assert.equal(valorDoPedido(p({ valor_tabela: "250.00" })), 250);
  // Pedido antigo com proposta aceita pelo proprietário: vale o que foi combinado naquele pedido.
  assert.equal(valorDoPedido(p({ valor_tabela: 250, valor_proposto: 300, proposta_aceita_em: "2026-11-01T12:00:00Z" })), 300);
  // Proposta que o proprietário não aceitou não é valor combinado.
  assert.equal(valorDoPedido(p({ valor_tabela: 250, valor_proposto: 300 })), 250);
  const r = resumoDoPainel(
    [
      p({ status: "laudo_emitido", recebido_marcado_em: "2026-11-20T12:00:00Z", valor_tabela: 250 }),
      p({ status: "realizada", recebido_marcado_em: "2026-11-21T12:00:00Z", valor_tabela: 150.5 }),
      p({ status: "laudo_emitido", valor_tabela: 350 }), // ainda não marcou recebido
      p({ status: "laudo_emitido", recebido_marcado_em: "2026-11-21T12:00:00Z", valor_tabela: 350, teste: true }), // avaliação de teste não tem valor
    ],
    0,
    AGORA,
  );
  assert.equal(r.recebido, 400.5);
});

test("os quatro cartões, na ordem do desenho, com o texto que vem do sistema", () => {
  const c = CARTOES_DO_PAINEL({ visitasHoje: 1, novos: 1, recebido: 250 }, "Ativo");
  assert.deepEqual(c, [
    { id: "pedidos", titulo: "Pedidos", texto: "1 novo", destaque: true, href: "#pedidos" },
    { id: "agenda", titulo: "Agenda", texto: "Hoje • 1 visita", destaque: false, href: "#agenda" },
    { id: "recebidos", titulo: "Recebidos", texto: "R$ 250,00", destaque: false, href: "#historico" },
    { id: "credenciamento", titulo: "Credenciamento", texto: "Ativo", destaque: false, href: "#credenciamento" },
  ]);
  const vazio = CARTOES_DO_PAINEL({ visitasHoje: 0, novos: 0, recebido: 0 }, "Em teste");
  assert.deepEqual(vazio.map((x) => x.texto), ["Nenhum novo", "Hoje • sem visita", "R$ 0,00", "Em teste"]);
  assert.equal(vazio[0].destaque, false);
  assert.equal(CARTOES_DO_PAINEL({ visitasHoje: 2, novos: 3, recebido: 1250.5 }, "Ativo").map((x) => x.texto).join(" | "), "3 novos | Hoje • 2 visitas | R$ 1.250,50 | Ativo");
});

test("a página do avaliador abre com o painel e mantém os pontos de apoio das travas que já existem", () => {
  const pg = ler("app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx");
  assert.match(pg, /<PainelAvaliador\s/);
  assert.match(pg, /fotosDePerfil\(\[user\.id\]\)/, "a foto é a de perfil da conta (fonte única)");
  // As seções para onde os cartões levam.
  for (const id of ["pedidos", "agenda", "historico", "credenciamento"]) assert.match(pg, new RegExp(`id="${id}"`), id);
  // O que já existia continua: situação, passos, listas e o texto da taxa.
  for (const t of ["credenciamento-situacao", "avaliacoes-designadas", "avaliacoes-visitas", "avaliacoes-historico", "meus-termos"]) assert.match(pg, new RegExp(`data-testid="${t}"`), t);
  // E1158 (2; ORDEM-DUET-654): na tela do avaliador, o texto da taxa fala com ele ("vai direto para você").
  assert.match(pg, /textoTaxaServicoAoParceiro\(PAGAMENTO_PARCEIROS_ATIVO\)/);
  // O nome é "Avaliador credenciado" (ORDEM-397), nunca "Vistoriador".
  assert.match(pg, /Avaliador credenciado nº/);
  assert.doesNotMatch(pg + ler("components/avaliadores/painel.tsx") + ler("lib/vistoria/painel-avaliador.ts"), /[Vv]istoriador/);
});

test("foto: a de perfil da conta no cabeçalho; sem foto, as iniciais no círculo (nunca vazio, nunca obrigatória)", () => {
  const c = ler("components/avaliadores/painel.tsx");
  assert.match(c, /fotoUrl \?/);
  assert.match(c, /<Avatar name=\{nome\} size=\{96\}/, "sem foto: o Avatar da casa, com as iniciais");
  assert.doesNotMatch(c, /required|obrigat/i);
  // Os estilos do desenho vêm do arquivo de exceção que já existe; nada de cor ou sombra escrita no componente.
  assert.match(c, /from "@\/lib\/conta\/visual-mockup"/);
  assert.doesNotMatch(c, /bg-\[#|text-\[#|shadow-\[/);
  assert.match(ler("lib/conta/visual-mockup.ts"), /Painel do avaliador \(E1079, fatia 2\)/);
});
