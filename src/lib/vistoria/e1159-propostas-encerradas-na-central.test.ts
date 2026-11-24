import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TITULO_PROPOSTAS_ENCERRADAS, VAZIO_PROPOSTAS_ENCERRADAS, propostasEncerradas, rotuloDaPropostaEncerrada, type LinhaDaPropostaEncerrada } from "./propostas-encerradas.ts";
import { ROTULO_PROPOSTA_DESCARTADA, ROTULO_PROPOSTA_EXPIRADA } from "./relogio-do-pedido.ts";
import { DIAS_DA_JANELA_DE_RECUSAS, contagemDecisoes } from "./telas-exibicao.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

/*
  E1159 (ORDENS-DUET 658 e 679; linha Parceiros). A proposta que expirou sem o aceite do dono (E1142) e a que o dono
  descartou (E1146) saíram da lista "Recusas e ausências" da equipe — não são recusa do avaliador — e ficaram sem lugar
  nenhum: a equipe não as via. Passam a ter uma secção própria dentro do mesmo painel, "Propostas expiradas ou
  descartadas (30 dias)", com o avaliador, o imóvel e quando. É só leitura: não conta no "Para decidir".
  Roda: node --test src/lib/vistoria/e1159-propostas-encerradas-na-central.test.ts
*/
const ler = (p: string) => readFileSync(p, "utf8");
const DESDE = "2026-10-25T12:00:00.000Z";
const linha = (id: string, mais: Partial<LinhaDaPropostaEncerrada>): LinhaDaPropostaEncerrada => ({ id, avaliador_id: "cred-1", proposta_expirada_em: null, proposta_descartada_em: null, vistoria_pedidos: { property_id: "imovel-1", cidade: "Uberlândia" }, ...mais });

test("E1159: cada linha diz o motivo e quando — a expirada pela data da expiração, a descartada pela do descarte", () => {
  const r = propostasEncerradas(
    [
      linha("exp", { proposta_expirada_em: "2026-11-20T10:00:00.000Z" }),
      linha("desc", { proposta_descartada_em: "2026-11-22T09:00:00.000Z", avaliador_id: "cred-2", vistoria_pedidos: { property_id: "imovel-2", cidade: "Araguari" } }),
    ],
    DESDE,
  );
  // A mais recente primeiro.
  assert.deepEqual(r, [
    { id: "desc", avaliadorId: "cred-2", motivo: "descartada", quando: "2026-11-22T09:00:00.000Z", propertyId: "imovel-2", cidade: "Araguari" },
    { id: "exp", avaliadorId: "cred-1", motivo: "expirada", quando: "2026-11-20T10:00:00.000Z", propertyId: "imovel-1", cidade: "Uberlândia" },
  ]);
});

test("E1159: a janela conta pela data da expiração ou do descarte; fora dela, ou sem nenhuma das duas, a linha não entra", () => {
  const r = propostasEncerradas(
    [
      linha("no-limite", { proposta_expirada_em: DESDE }),
      linha("velha", { proposta_expirada_em: "2026-10-25T11:59:59.000Z" }),
      linha("descarte-velho", { proposta_descartada_em: "2026-09-01T00:00:00.000Z" }),
      linha("recusa-comum", {}),
    ],
    DESDE,
  );
  assert.deepEqual(r.map((x) => x.id), ["no-limite"]);
});

test("E1159: a mesma linha lida duas vezes (uma por coluna) entra uma vez só; com as duas datas vale a mais recente; o pedido apagado não parte a lista", () => {
  const dupla = linha("dupla", { proposta_expirada_em: "2026-11-10T00:00:00.000Z", proposta_descartada_em: "2026-11-12T00:00:00.000Z" });
  const r = propostasEncerradas([dupla, dupla, linha("orfa", { proposta_expirada_em: "2026-11-11T00:00:00.000Z", vistoria_pedidos: null })], DESDE);
  assert.deepEqual(r.map((x) => [x.id, x.motivo, x.quando]), [
    ["dupla", "descartada", "2026-11-12T00:00:00.000Z"],
    ["orfa", "expirada", "2026-11-11T00:00:00.000Z"],
  ]);
  assert.deepEqual([r[1].propertyId, r[1].cidade], [null, ""]);
  // Com teto, ficam as mais recentes.
  assert.deepEqual(propostasEncerradas([dupla, linha("orfa", { proposta_expirada_em: "2026-11-11T00:00:00.000Z" })], DESDE, 1).map((x) => x.id), ["dupla"]);
});

test("E1159: o título e o vazio leem a janela da fonte; os rótulos são os que a casa já tem para a proposta expirada e a descartada", () => {
  assert.equal(DIAS_DA_JANELA_DE_RECUSAS, 30);
  assert.equal(TITULO_PROPOSTAS_ENCERRADAS, "Propostas expiradas ou descartadas (30 dias)");
  assert.equal(VAZIO_PROPOSTAS_ENCERRADAS, "Nenhuma proposta expirada ou descartada nos últimos 30 dias.");
  assert.equal(rotuloDaPropostaEncerrada("expirada"), ROTULO_PROPOSTA_EXPIRADA);
  assert.equal(rotuloDaPropostaEncerrada("descartada"), ROTULO_PROPOSTA_DESCARTADA);
  const fonte = semComentarios(ler("src/lib/vistoria/propostas-encerradas.ts"));
  assert.match(fonte, /\$\{DIAS_DA_JANELA_DE_RECUSAS\} dias\)/);
  assert.doesNotMatch(fonte, /\b30\b/, "o número da janela não está escrito à mão");
  assert.doesNotMatch(fonte, /Proposta (expirada|recusada)/, "os rótulos não ganharam uma terceira cópia");
});

test("E1159: a página lê as duas colunas pela janela, cada uma da mais recente para a mais antiga, e a leitura que falha não vira lista vazia", () => {
  const pagina = semComentarios(ler("src/app/(dashboard)/admin/avaliadores/page.tsx"));
  const COLUNAS = 'select("id, avaliador_id, proposta_expirada_em, proposta_descartada_em, vistoria_pedidos(property_id, cidade)")';
  for (const coluna of ["proposta_expirada_em", "proposta_descartada_em"]) {
    assert.ok(pagina.includes(`admin.from("vistoria_designacoes").${COLUNAS}.gte("${coluna}", trintaDias).order("${coluna}", { ascending: false }).limit(TETO_PROPOSTAS_ENCERRADAS)`), coluna);
  }
  assert.match(pagina, /const trintaDias = new Date\(agora\.getTime\(\) - DIAS_DA_JANELA_DE_RECUSAS \* 86_400_000\)\.toISOString\(\);/);
  // As duas leituras passam pela guarda das leituras (achado 39), com a dos títulos dos imóveis.
  assert.match(pagina, /semFalhaDeLeitura\(\[recusasLeitura, perfisLeitura, expiradasLeitura, descartadasLeitura\] as const\)/);
  assert.match(pagina, /const propostasLista = propostasEncerradas\(\[\.\.\.\(expiradas \?\? \[\]\), \.\.\.\(descartadas \?\? \[\]\)\] as unknown as LinhaDaPropostaEncerrada\[\], trintaDias, TETO_PROPOSTAS_ENCERRADAS\);/);
  assert.match(pagina, /if \(titulosLeitura\.error\) throw new Error\(/);
  // A lista das recusas continua a deixá-las de fora: não são recusa do avaliador.
  assert.match(pagina, /\.in\("resposta", \["recusada", "expirada", "ausencia"\]\)\.is\("proposta_expirada_em", null\)\.is\("proposta_descartada_em", null\)/);
});

test("E1159: a secção fica dentro do painel das recusas, com o avaliador, o imóvel e quando", () => {
  const pagina = semComentarios(ler("src/app/(dashboard)/admin/avaliadores/page.tsx"));
  const painel = pagina.slice(pagina.indexOf('data-testid="avaliacoes-recusas"'), pagina.indexOf('<Panel id="contestacoes"'));
  assert.ok(painel.length > 200);
  assert.match(painel, /data-testid="propostas-expiradas"/);
  assert.match(painel, /\{TITULO_PROPOSTAS_ENCERRADAS\}/);
  assert.match(painel, /\{VAZIO_PROPOSTAS_ENCERRADAS\}/);
  assert.match(painel, /<li key=\{p\.id\} data-testid="proposta-encerrada-item" data-motivo=\{p\.motivo\}>/);
  // "nº <número> · <imóvel> · <rótulo> · <data>": o imóvel é o título do anúncio com o código VN (E1108), nunca a morada.
  assert.match(painel, /nº \{numeroDe\.get\(p\.avaliadorId\) \?\? "—"\} · \{imovelDaProposta\(p\)\} · \{rotuloDaPropostaEncerrada\(p\.motivo\)\} · \{dataBRT\(p\.quando\)\}/);
  assert.match(pagina, /const imovelDaProposta = \(p: PropostaEncerrada\) => \(p\.propertyId \? identificacaoDoImovel\(tituloDoImovel\.get\(p\.propertyId\), p\.propertyId\) : p\.cidade \|\| "imóvel removido"\);/);
  assert.doesNotMatch(painel, /address|endereco|morada/i);
});

test("E1159: é só leitura — não entra no número do topo 'Para decidir' (decisão da ORDEM-679)", () => {
  const pagina = semComentarios(ler("src/app/(dashboard)/admin/avaliadores/page.tsx"));
  assert.match(pagina, /recusasAusencias: recusasLista\.length,/);
  assert.doesNotMatch(pagina, /recusasAusencias: [^,]*propostasLista/);
  const numeros = contagemDecisoes({ credenciamentos: [], semAvaliador: 0, recusasAusencias: 2, cidadesProntas: 0, cidades: 1 });
  assert.deepEqual(numeros.map((n) => n.chave), ["credenciamentos", "sem-avaliador", "recusas", "chave"], "nenhuma chave nova no topo");
  assert.equal(numeros.find((n) => n.chave === "recusas")!.valor, 2);
});
