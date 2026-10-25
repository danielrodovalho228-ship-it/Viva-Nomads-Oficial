/*
  Prompt 42, item 1 — "Hoje você tem N decisões".
  Roda: node --test src/lib/painel/decisoes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decisoesDoMorador, decisoesDoProprietario, ordenarDecisoes, tituloDecisoes, type DadosDecisoes, type Decisao } from "./decisoes.ts";
import { prontidaoAnuncio, type FatosAnuncio } from "../anuncio/prontidao.ts";

const agora = new Date("2026-10-22T12:00:00Z");
const emH = (h: number) => new Date(agora.getTime() + h * 3_600_000).toISOString();

const fatos = (documento: FatosAnuncio["documento"]): FatosAnuncio => ({
  enderecoOk: true,
  detalhesOk: true,
  periodoOk: true,
  fotos: 8,
  titulo: "Studio Centro",
  preco: 3200,
  garantiaOk: true,
  sublocacaoOk: true,
  privacidadeOk: true,
  documento,
  limitePlanoOk: true,
  descricao: "x".repeat(80),
  selo: false,
  video: false,
});

test("título: singular, plural e zero", () => {
  assert.equal(tituloDecisoes(0), "Nada pede sua decisão hoje");
  assert.equal(tituloDecisoes(1), "Hoje você tem 1 decisão");
  assert.equal(tituloDecisoes(4), "Hoje você tem 4 decisões");
});

test("proprietário sem dados: nenhuma decisão", () => {
  assert.deepEqual(decisoesDoProprietario({}, agora), []);
  assert.deepEqual(decisoesDoMorador({}, agora), []);
});

test("proposta: só a que espera esta pessoa, com valor, imóvel, prazo e link para responder", () => {
  const d: DadosDecisoes = {
    propostas: [
      { id: "p1", imovel: "Studio Centro", valorMensal: 3200, validaAte: emH(72), papel: "owner", aguardandoVoce: true },
      { id: "p2", imovel: "Casa Jardim", valorMensal: 4000, validaAte: emH(24), papel: "owner", aguardandoVoce: false },
      { id: "p3", imovel: "Loft", valorMensal: 2500, validaAte: emH(48), papel: "tenant", aguardandoVoce: true },
    ],
  };
  const dono = decisoesDoProprietario(d, agora);
  assert.equal(dono.length, 1);
  assert.match(dono[0].texto, /^Contraproposta de R\$\s?3\.200 por mês para Studio Centro$/);
  assert.equal(dono[0].href, "/dashboard/propostas/p1");
  assert.equal(dono[0].prazoTexto, "vence em 3 dias");
  const morador = decisoesDoMorador(d, agora);
  assert.equal(morador.length, 1);
  assert.match(morador[0].texto, /^Proposta de R\$\s?2\.500 por mês para Loft$/);
  assert.equal(morador[0].href, "/dashboard/propostas/p3");
});

test("contrato: pela fonte única do estado — falta a assinatura de quem olha", () => {
  const d: DadosDecisoes = {
    contratos: [
      { id: "c1", imovel: "Studio Centro", status: "ativo", assinado_proprietario_em: null, assinado_inquilino_em: null },
      { id: "c2", imovel: "Casa Jardim", status: "ativo", assinado_proprietario_em: "2026-10-20T10:00:00Z", assinado_inquilino_em: null },
      { id: "c3", imovel: "Loft", status: "cancelado", assinado_proprietario_em: null, assinado_inquilino_em: null },
    ],
  };
  const dono = decisoesDoProprietario(d, agora);
  assert.deepEqual(dono.map((x) => x.href), ["/dashboard/contratos/c1"]);
  assert.equal(dono[0].texto, "Contrato de Studio Centro aguarda sua assinatura");
  const morador = decisoesDoMorador(d, agora);
  assert.deepEqual(morador.map((x) => x.href).sort(), ["/dashboard/contratos/c1", "/dashboard/contratos/c2"]);
});

test("visita: o dono decide o pedido; o morador decide o horário remarcado", () => {
  const d: DadosDecisoes = {
    visitas: [
      { id: "v1", imovel: "Studio Centro", status: "pedido", modalidade: "video", horarios: [emH(-2), emH(30), emH(10)], horarioProposto: null },
      { id: "v2", imovel: "Casa Jardim", status: "remarcar", modalidade: "presencial", horarios: [emH(5)], horarioProposto: emH(20) },
      { id: "v3", imovel: "Loft", status: "confirmado", modalidade: "video", horarios: [emH(5)], horarioProposto: null },
    ],
  };
  const dono = decisoesDoProprietario(d, agora);
  assert.equal(dono.length, 1);
  assert.equal(dono[0].texto, "Pedido de visita por vídeo para Studio Centro");
  assert.equal(dono[0].prazo, emH(10), "o 1º horário futuro é o prazo");
  assert.match(dono[0].prazoTexto!, /^1º horário: /);
  assert.equal(dono[0].href, "/dashboard/visitas");
  const morador = decisoesDoMorador(d, agora);
  assert.equal(morador.length, 1);
  assert.equal(morador[0].texto, "Novo horário para a visita em Casa Jardim");
  assert.equal(morador[0].prazo, emH(20));
});

test("manutenção: sem resposta entra com o prazo do proprietário; vencida vira 'atrasada'; respondida não entra", () => {
  const d: DadosDecisoes = {
    manutencoes: [
      { id: "m1", imovel: "Studio Centro", priority: "urgente", status: "aberto", openedAt: emH(-30) },
      { id: "m2", imovel: "Casa Jardim", priority: "baixa", status: "aberto", openedAt: emH(-1) },
      { id: "m3", imovel: "Loft", priority: "media", status: "em_andamento", openedAt: emH(-1), firstResponseAt: emH(0) },
    ],
  };
  const dono = decisoesDoProprietario(d, agora);
  assert.deepEqual(dono.map((x) => x.id), ["manutencao-m1", "manutencao-m2"]);
  assert.equal(dono[0].texto, "Manutenção atrasada em Studio Centro");
  assert.equal(dono[0].atrasada, true);
  assert.equal(dono[1].texto, "Manutenção pedida em Casa Jardim");
  assert.match(dono[1].prazoTexto!, /^Responder até /);
  assert.equal(dono[1].href, "/dashboard/solicitacoes");
});

test("estadia: as decisões do card do Prompt 32, com o imóvel e o link da própria decisão", () => {
  const d: DadosDecisoes = {
    estadias: [{ contratoId: "e1", imovel: "Studio Centro", decisoes: [{ id: "preencher_instrucoes", rotulo: "Preencher as instruções de chegada", href: "/dashboard/estadia/e1#instrucoes" }] }],
  };
  const [x] = decisoesDoProprietario(d, agora);
  assert.equal(x.texto, "Preencher as instruções de chegada — Studio Centro");
  assert.equal(x.href, "/dashboard/estadia/e1#instrucoes");
});

test("candidaturas novas: uma linha por imóvel, só status 'new'", () => {
  const d: DadosDecisoes = {
    candidaturas: [
      { id: "l1", propertyId: "a", imovel: "Studio Centro", status: "new" },
      { id: "l2", propertyId: "a", imovel: "Studio Centro", status: "new" },
      { id: "l3", propertyId: "b", imovel: "Casa Jardim", status: "new" },
      { id: "l4", propertyId: "c", imovel: "Loft", status: "accepted" },
    ],
  };
  const textos = decisoesDoProprietario(d, agora).map((x) => x.texto);
  assert.deepEqual(textos, ["2 candidaturas novas para Studio Centro", "Nova candidatura para Casa Jardim"].sort((a, b) => a.localeCompare(b, "pt-BR")));
});

test("documento reprovado: pela prontidão do rascunho, com o link da etapa do documento", () => {
  const reprovado = decisoesDoProprietario({ rascunho: { id: "r1", titulo: "Studio Centro", prontidao: prontidaoAnuncio(fatos("rejected")) } }, agora);
  assert.equal(reprovado.length, 1);
  assert.equal(reprovado[0].texto, "Documento de Studio Centro reprovado — envie de novo");
  assert.match(reprovado[0].href, /^\/dashboard\/imoveis\/novo\?draft=r1&etapa=\d$/);
  for (const st of ["pending", "approved", "none"] as const) {
    assert.deepEqual(decisoesDoProprietario({ rascunho: { id: "r1", titulo: "x", prontidao: prontidaoAnuncio(fatos(st)) } }, agora), [], st);
  }
});

test("ordem: prazo mais próximo primeiro (vencido no topo), sem prazo depois, empate pela prioridade do tipo", () => {
  const d = (id: string, tipo: Decisao["tipo"], prazo: string | null): Decisao => ({ id, tipo, texto: id, href: "/dashboard", prazo, prazoTexto: null, atrasada: false });
  const ordem = ordenarDecisoes([
    d("cand", "candidatura", null),
    d("prop-3d", "proposta", emH(72)),
    d("contrato", "contrato", null),
    d("manut-vencida", "manutencao", emH(-5)),
    d("visita-1d", "visita", emH(24)),
    d("estadia", "estadia", null),
  ]).map((x) => x.id);
  assert.deepEqual(ordem, ["manut-vencida", "visita-1d", "prop-3d", "contrato", "estadia", "cand"]);
});

test("todo link aponta para a tela da decisão dentro do painel (nunca decide na Visão geral)", () => {
  const todas = decisoesDoProprietario(
    {
      propostas: [{ id: "p1", imovel: "A", valorMensal: 1, validaAte: emH(1), papel: "owner", aguardandoVoce: true }],
      contratos: [{ id: "c1", imovel: "A", status: "ativo" }],
      visitas: [{ id: "v1", imovel: "A", status: "pedido", modalidade: "video", horarios: [], horarioProposto: null }],
      manutencoes: [{ id: "m1", imovel: "A", priority: "media", status: "aberto", openedAt: emH(0) }],
      candidaturas: [{ id: "l1", propertyId: "a", imovel: "A", status: "new" }],
    },
    agora,
  );
  assert.equal(todas.length, 5);
  for (const x of todas) assert.match(x.href, /^\/dashboard\/(propostas|contratos|visitas|solicitacoes|leads)(\/|$)/, x.href);
});

test("a Visão geral monta as decisões no servidor e o navegador não chama server action para o rascunho", () => {
  const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
  const pagina = ler("src/app/(dashboard)/dashboard/page.tsx");
  assert.match(pagina, /decisoesDoProprietario\(/);
  assert.match(pagina, /decisoesDoMorador\(/);
  assert.match(pagina, /getLatestDraft\(\)/);
  const cliente = ler("src/app/(dashboard)/dashboard/visao-geral-client.tsx");
  assert.doesNotMatch(cliente, /getLatestDraft|from "@\/lib\/data\/actions"/);
  // Prompt 43: um título só, com as decisões de todos os papéis juntas.
  assert.match(cliente, /title=\{tituloDecisoes\(decisoes\.length\)\}/);
  assert.match(cliente, /juntarDecisoes\(decisoesDono, decisoesMorador\)/);
  // Linha = link para a tela da decisão (nunca botão de decidir na Visão geral).
  const linha = cliente.slice(cliente.indexOf("function ListaDecisoes"), cliente.indexOf("function CartaoEstadias"));
  assert.match(linha, /<Link\s+href=\{d\.href\}/);
  assert.doesNotMatch(linha, /<button|onClick/);
});

test("Prompt 43: o Início junta as decisões dos papéis, com o rótulo do papel, sem repetir e na ordem do prazo", async () => {
  const { juntarDecisoes } = await import("./decisoes.ts");
  const base = { prazoTexto: null, atrasada: false, href: "/x" } as const;
  const dono = [{ ...base, id: "a", tipo: "proposta" as const, texto: "Proposta", prazo: "2026-10-30T00:00:00Z" }];
  const morador = [
    { ...base, id: "b", tipo: "contrato" as const, texto: "Contrato", prazo: "2026-10-25T00:00:00Z" },
    { ...base, id: "a", tipo: "proposta" as const, texto: "Proposta", prazo: "2026-10-30T00:00:00Z" },
  ];
  const j = juntarDecisoes(dono, morador);
  assert.deepEqual(j.map((d) => [d.id, d.papel]), [["b", "morador"], ["a", "proprietario"]]);
});

test("59.1: foto de nível recusada vira decisão do dono, com o motivo e o link da página do nível", () => {
  const d = decisoesDoProprietario({ fotosNivelRecusadas: [{ propertyId: "p1", imovel: "Studio Centro", chave: "ar_sala", motivo: "Não mostra o item." }] }, new Date("2026-10-23T12:00:00Z"));
  const f = d.find((x) => x.id === "foto-nivel-p1-ar_sala")!;
  assert.equal(f.texto, 'Envie outra foto de "Ar-condicionado na sala" em Studio Centro');
  assert.equal(f.href, "/dashboard/imoveis/p1/nivel");
  assert.equal(f.prazoTexto, "Recusada: Não mostra o item.");
});
