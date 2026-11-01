/*
  E375-B — resumo semanal de recomendações: seleção sem repetição, absorção da fila, teto, sem novidade = sem envio,
  motivo só com fatos, assunto com a contagem real e vocabulário da casa.
  Roda: node --test src/lib/notifications/resumo-semanal.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assuntoResumo,
  chaveResumo,
  cidadeComum,
  ehTercaEmBrasilia,
  fatosDaBusca,
  motivoDaBusca,
  motivoDaQueda,
  motivoDoPedido,
  origemDoResumo,
  palavrasProibidas,
  resumoRodaHoje,
  selecionarResumo,
  temNovidade,
  type CandidatoNovo,
  type CandidatoQueda,
} from "./resumo-semanal.ts";
import { montarEmailResumoSemanal, ASSINATURA_RESUMO } from "./email-resumo-semanal.ts";
import { podeEnviarProativo } from "./proativos.ts";
import { comMarca, problemasDoAssunto } from "./assuntos.ts";

const novo = (id: string, origem: "pedido" | "busca", extra: Partial<CandidatoNovo> = {}): CandidatoNovo => ({ imovelId: id, origem, motivo: `motivo ${id}`, cidade: "Uberlândia", ...extra });
const queda = (id: string, quedaId: string, antigo: number, novoTotal: number, em = "2026-11-02T12:00:00Z"): CandidatoQueda => ({ imovelId: id, quedaId, totalAntigo: antigo, totalNovo: novoTotal, registradaEm: em });
const vazio = new Set<string>();

test("só às terças (dia de Brasília) e só com a chave ligada", () => {
  // 03/11/2026 é terça. 02:00 UTC de terça ainda é segunda em Brasília.
  assert.equal(ehTercaEmBrasilia(new Date("2026-11-03T11:00:00Z")), true);
  assert.equal(ehTercaEmBrasilia(new Date("2026-11-03T02:00:00Z")), false);
  assert.equal(ehTercaEmBrasilia(new Date("2026-11-04T02:00:00Z")), true);
  assert.equal(resumoRodaHoje(new Date("2026-11-03T11:00:00Z"), false), false);
  assert.equal(resumoRodaHoje(new Date("2026-11-03T11:00:00Z"), true), true);
  assert.equal(resumoRodaHoje(new Date("2026-11-02T11:00:00Z"), true), false);
});

test("seleção sem repetição: o que já saiu em qualquer proativo não volta; um cartão por imóvel", () => {
  const s = selecionarResumo({
    candidatos: [novo("A", "pedido"), novo("B", "busca"), novo("A", "busca"), novo("C", "busca")],
    pendentesFila: [],
    quedas: [],
    jaEnviados: new Set(["C"]),
    quedasJaEnviadas: vazio,
  });
  assert.deepEqual(s.novos.map((n) => [n.imovelId, n.origem]), [["A", "pedido"], ["B", "busca"]]);
});

test("absorção da fila: pendentes do E264-B entram e saem marcados; o repetido não vira dois cartões", () => {
  const s = selecionarResumo({
    candidatos: [novo("A", "pedido")],
    pendentesFila: [novo("A", "pedido", { linhaFila: "L1" }), novo("D", "busca", { linhaFila: "L2" }), novo("E", "pedido", { linhaFila: "L3" })],
    quedas: [],
    jaEnviados: new Set(["E"]),
    quedasJaEnviadas: vazio,
  });
  assert.deepEqual(s.novos.map((n) => n.imovelId), ["A", "D"]);
  // L1 (mesmo imóvel do candidato) e L2 saem neste resumo; L3 já tinha saído por outro e-mail e fica fora.
  assert.deepEqual(s.filaAbsorvida.sort(), ["L1", "L2"]);
});

test("baixou o valor: a queda mais recente de cada favorito; nunca a mesma queda duas vezes; nunca o imóvel já nos novos", () => {
  const s = selecionarResumo({
    candidatos: [novo("A", "pedido")],
    pendentesFila: [],
    quedas: [queda("F", "q1", 3600, 3400, "2026-10-30T12:00:00Z"), queda("F", "q2", 3400, 3300, "2026-11-01T12:00:00Z"), queda("G", "q3", 3000, 2800), queda("A", "q4", 3500, 3300), queda("H", "q5", 3000, 3100)],
    jaEnviados: new Set(["F", "G"]),
    quedasJaEnviadas: new Set(["q3"]),
  });
  // F: já saiu antes como novo, mas a QUEDA é fato novo (exceção da regra). G: a queda q3 já saiu. A: está nos novos.
  // H: "queda" que é alta não entra.
  assert.deepEqual(s.baixas.map((b) => b.quedaId), ["q2"]);
});

test("sem novidade = sem envio", () => {
  const s = selecionarResumo({ candidatos: [novo("A", "busca")], pendentesFila: [], quedas: [], jaEnviados: new Set(["A"]), quedasJaEnviadas: vazio });
  assert.equal(temNovidade(s), false);
  assert.equal(temNovidade(selecionarResumo({ candidatos: [], pendentesFila: [], quedas: [queda("F", "q", 2, 1)], jaEnviados: vazio, quedasJaEnviadas: vazio })), true);
});

test("teto: o resumo é um proativo (1 por dia, 3 em 7, silêncio das 22h às 7h)", () => {
  const terca = new Date("2026-11-03T11:00:00Z"); // 08:00 em Brasília
  assert.equal(podeEnviarProativo([], terca), "ok");
  assert.equal(podeEnviarProativo(["2026-11-03T10:30:00Z"], terca), "teto");
  assert.equal(podeEnviarProativo(["2026-10-30T12:00:00Z", "2026-11-01T12:00:00Z", "2026-11-02T12:00:00Z"], terca), "teto");
  assert.equal(podeEnviarProativo([], new Date("2026-11-03T02:00:00Z")), "silencio");
});

test("chave da fila: uma linha por pessoa, imóvel e semana; a queda leva o próprio id", () => {
  assert.equal(chaveResumo("u", "i", "2026-11-03"), "proativo:resumo_semanal:u:i:2026-11-03");
  assert.equal(chaveResumo("u", "i", "2026-11-03", "q9"), "proativo:resumo_semanal:u:i:queda-q9");
});

test("motivo do pedido: só fatos verdadeiros do par (o que não bate não entra)", () => {
  const m = motivoDoPedido({ total_mensal: 3350, orcamento: 4000, vagas: 4, ocupantes: 2, entrada: "2026-12-15", disponivel_desde: "2026-11-01" });
  assert.equal(m, "Combina com o seu pedido: R$ 3.350 por mês, dentro do seu limite de R$ 4.000; para 2 pessoas; livre desde 01/11, antes da sua entrada em 15/12.");
  // Total acima do limite e vagas a menos: nada disso é dito.
  const n = motivoDoPedido({ total_mensal: 4200, orcamento: 4000, vagas: 1, ocupantes: 2, entrada: "2026-12-15", disponivel_desde: "2027-01-10" });
  assert.equal(n, "Combina com o seu pedido de moradia.");
});

test("motivo da busca: só os critérios que a busca usou E o imóvel cumpre", () => {
  assert.equal(motivoDaBusca({ local: "Santa Mônica", limite: 3500, totalMes: 3350, quartosMin: 2, quartos: 2, pet: true }), "Combina com a sua busca: em Santa Mônica; R$ 3.350 por mês, dentro do seu limite de R$ 3.500; 2 quartos; aceita pet.");
  assert.equal(motivoDaBusca({ limite: 3000, totalMes: 3350, quartosMin: 3, quartos: 2 }), "Combina com a sua busca salva.");
  assert.equal(motivoDaQueda({ totalAntigo: 3550, totalNovo: 3350 }), "Baixou de R$ 3.550 para R$ 3.350 por mês.");
});

test("assunto: contagem real, variantes para pedido, busca, os dois e baixa de valor; sempre na régua", () => {
  assert.equal(assuntoResumo({ nome: "Ana Teste", novos: 3, origem: "pedido", cidade: "Uberlândia", baixas: 1 }), "Ana, 3 imóveis novos para o seu pedido em Uberlândia");
  assert.equal(assuntoResumo({ nome: "Ana", novos: 1, origem: "busca", cidade: "Uberlândia", baixas: 0 }), "Ana, 1 imóvel novo para a sua busca em Uberlândia");
  assert.equal(assuntoResumo({ nome: "Ana", novos: 2, origem: "ambos", cidade: "", baixas: 0 }), "Ana, 2 imóveis novos para você");
  assert.equal(assuntoResumo({ nome: null, novos: 0, origem: "pedido", cidade: "Uberlândia", baixas: 2 }), "2 imóveis que você favoritou baixaram de valor");
  assert.equal(assuntoResumo({ nome: "Ana", novos: 0, origem: "pedido", baixas: 1 }), "Ana, 1 imóvel que você favoritou baixou de valor");
  // Nome e cidade longos: a cidade sai antes do nome; nunca passa de 70 com a marca.
  const longo = assuntoResumo({ nome: "Maximiliano", novos: 12, origem: "pedido", cidade: "São José dos Campos do Norte de Minas", baixas: 0 });
  assert.equal(longo, "Maximiliano, 12 imóveis novos para o seu pedido");
  for (const a of [longo, assuntoResumo({ nome: "Ana", novos: 3, origem: "pedido", cidade: "Uberlândia", baixas: 0 })]) assert.deepEqual(problemasDoAssunto(comMarca(a)), [], a);
  assert.equal(origemDoResumo([{ origem: "pedido" }, { origem: "busca" }]), "ambos");
  assert.equal(origemDoResumo([{ origem: "busca" }]), "busca");
  assert.equal(cidadeComum(["Uberlândia", " Uberlândia ", null]), "Uberlândia");
  assert.equal(cidadeComum(["Uberlândia", "Araguari"]), "");
});

const imovel = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  titulo: `Apto ${id}`,
  bairro: "Santa Mônica",
  cidade: "Uberlândia",
  uf: "MG",
  totalMes: 3350,
  fotoCapa: `https://abc.supabase.co/storage/v1/object/public/property-photos/x/${id}.webp`,
  areaM2: 62,
  quartos: 2,
  vagas: 1,
  motivo: "Combina com o seu pedido: para 2 pessoas.",
  ...extra,
});

test("e-mail: 2 seções, 3 cartões cada, 'ver os N', ficha completa, motivo, descadastro visível e assinatura", () => {
  const m = montarEmailResumoSemanal({
    siteUrl: "https://vivanomads.com.br",
    nome: "Ana",
    origem: "pedido",
    novos: ["1", "2", "3", "4", "5"].map((i) => imovel(i)),
    baixas: [imovel("9", { motivo: "Baixou de R$ 3.550 para R$ 3.350 por mês." })],
    descadastroUrl: "https://vivanomads.com.br/avisos/desligar?u=x&t=y",
  });
  assert.equal(m.assunto, "Ana, 5 imóveis novos para o seu pedido em Uberlândia");
  assert.equal(m.cartoes, 4);
  assert.equal((m.detailsHtml.match(/data-cartao="imovel"/g) ?? []).length, 4);
  assert.match(m.detailsHtml, /data-secao="novos"[^>]*>Novos para o seu pedido</);
  assert.match(m.detailsHtml, /data-secao="baixas"[^>]*>Baixou o valor</);
  assert.match(m.detailsHtml, /Ver os 5 imóveis →/);
  assert.match(m.detailsHtml, /href="https:\/\/vivanomads\.com\.br\/dashboard\/pedidos"/);
  assert.match(m.detailsHtml, /62 m² · 2 quartos · 1 vaga/);
  assert.match(m.detailsHtml, /Total por mês \(com contas\)/);
  assert.match(m.detailsHtml, /_next\/image\?url=/);
  assert.match(m.detailsHtml, /Santa Mônica, Uberlândia/);
  assert.match(m.detailsHtml, />Ver o imóvel</);
  assert.match(m.detailsHtml, /data-motivo[^>]*>Baixou de R\$ 3\.550 para R\$ 3\.350 por mês\.</);
  assert.match(m.detailsHtml, /Não quero mais este tipo de e-mail/);
  assert.ok(m.detailsHtml.trim().endsWith(`${ASSINATURA_RESUMO}</p>`));
  assert.match(m.detailsText, /Um abraço, equipe Viva Nomads$/);
  assert.equal(m.abertura("Ana"), "Olá Ana, este é o seu resumo da semana: 5 imóveis novos para o seu pedido de moradia e 1 imóvel que você favoritou baixou de valor.");
});

test("e-mail: nunca a rua nem o endereço exato (o cartão só tem bairro e cidade)", () => {
  const m = montarEmailResumoSemanal({ siteUrl: "https://vivanomads.com.br", origem: "busca", novos: [imovel("1", { rua: "Avenida Ana Godoy de Sousa, 210" })], baixas: [], descadastroUrl: null });
  assert.doesNotMatch(m.detailsHtml + m.detailsText, /Avenida|Godoy|210/);
});

test("vocabulário: nada de aluguel, comissão, inquilino ou temporada no assunto e no corpo", () => {
  assert.deepEqual(palavrasProibidas("O aluguel da Temporada"), ["aluguel", "temporada"]);
  const casos = [
    { origem: "pedido" as const, novos: [imovel("1")], baixas: [imovel("2")] },
    { origem: "busca" as const, novos: [imovel("1"), imovel("3")], baixas: [] },
    { origem: "ambos" as const, novos: [imovel("1")], baixas: [] },
    { origem: "pedido" as const, novos: [], baixas: [imovel("2"), imovel("4")] },
  ];
  for (const c of casos) {
    const m = montarEmailResumoSemanal({ siteUrl: "https://vivanomads.com.br", nome: "Ana", descadastroUrl: "https://vivanomads.com.br/avisos/desligar?u=x&t=y", ...c });
    const tudo = [m.assunto, m.abertura("Ana"), m.detailsHtml, m.detailsText].join("\n");
    assert.deepEqual(palavrasProibidas(tudo), [], c.origem);
  }
  // Os textos fixos do módulo (motivos e títulos) também.
  const fonte = readFileSync(new URL("./resumo-semanal.ts", import.meta.url), "utf8").split("PALAVRAS_PROIBIDAS")[0];
  assert.deepEqual(palavrasProibidas(fonte.replace(/inquilino_id/g, "")), []);
});

test("fatos da busca: lidos da mesma query string do alerta; só o que a busca pediu", () => {
  const f = fatosDaBusca("local=Santa+M%C3%B4nica%2C+Uberl%C3%A2ndia&orcamento=3500&quartos=2&pet=1", { preco: 3350, quartos: 2, aceitaPet: true });
  assert.deepEqual(f, { local: "Santa Mônica", limite: 3500, totalMes: 3350, quartosMin: 2, quartos: 2, pet: true });
  assert.equal(motivoDaBusca(f), "Combina com a sua busca: em Santa Mônica; R$ 3.350 por mês, dentro do seu limite de R$ 3.500; 2 quartos; aceita pet.");
  const g = fatosDaBusca("tipo=apartamento", { preco: 3350, quartos: 2, aceitaPet: false });
  assert.equal(motivoDaBusca(g), "Combina com a sua busca salva.");
});
