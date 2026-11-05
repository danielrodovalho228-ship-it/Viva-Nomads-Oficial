/*
  E574 — filtro "Emite nota fiscal" na busca de imóveis (decisão do Daniel, 04/11), espelho do E24 dos parceiros (#1302).
  O filtro devolve os imóveis cujo dono é PJ/MEI e DECLAROU emitir nota fiscal da locação. Desenho fiscal (não muda):
  dono PF não emite nota de locação (a plataforma gera o Recibo de Locação); a Viva emite NFS-e só da própria taxa.
  (1) a pergunta no documento do PJ (obrigatória para concluir; quem já tem o documento vê como pendência, sem bloquear);
  (2) o filtro com contador na busca; (3) o motivo de denúncia "Não emitiu a nota fiscal declarada".
  Roda: node --test src/lib/fiscal/e574-nota-locacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { documentoDaLocacao, donoEmiteNota, emiteNotaLocacaoParaGravar, faltaRespostaNotaLocacao, MOTIVO_NOTA_NAO_EMITIDA, ROTULO_FILTRO_NOTA_LOCACAO } from "./nota-locacao.ts";
import { FILTROS_PAINEL_VAZIOS, contarFiltrosPainel, passaNoPainel, resumoFiltros } from "../busca/painel-filtros.ts";
import { imovelBateComBusca } from "../busca/alerta-busca.ts";
import { MOTIVOS_DENUNCIA, motivoDenunciaValido, motivosDenunciaDoAnuncio } from "../saida/regras.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
type Imovel = Parameters<typeof passaNoPainel>[0] & { id: string };
const im = (id: string, extra: Partial<Imovel>) => ({ id, monthlyPrice: 3000, bedrooms: 1, tagHomeOffice: false, ...extra }) as Imovel;

test("documento da locação: PF → recibo; PJ que declarou → nota; PJ sem resposta ou 'não' → nada", () => {
  assert.equal(documentoDaLocacao({ tipoPessoa: "pf", emiteNota: null }), "recibo");
  assert.equal(documentoDaLocacao({ tipoPessoa: "pf", emiteNota: true }), "recibo");
  assert.equal(documentoDaLocacao({ tipoPessoa: "pj", emiteNota: true }), "nota");
  assert.equal(documentoDaLocacao({ tipoPessoa: "pj", emiteNota: false }), null);
  assert.equal(documentoDaLocacao({ tipoPessoa: "pj", emiteNota: null }), null);
  assert.equal(donoEmiteNota({ tipoPessoa: "pj", emiteNota: true }), true);
  assert.equal(donoEmiteNota({ tipoPessoa: "pf", emiteNota: true }), false);
});

test("(1) a pergunta: PJ só conclui respondendo Sim/Não; PF grava null; pendência só para PJ sem resposta", () => {
  assert.deepEqual(emiteNotaLocacaoParaGravar("pj", true), { ok: true, valor: true });
  assert.deepEqual(emiteNotaLocacaoParaGravar("pj", false), { ok: true, valor: false });
  assert.equal(emiteNotaLocacaoParaGravar("pj", undefined).ok, false);
  assert.equal(emiteNotaLocacaoParaGravar("pj", null).ok, false);
  assert.deepEqual(emiteNotaLocacaoParaGravar("pf", true), { ok: true, valor: null });
  assert.equal(faltaRespostaNotaLocacao({ tipoPessoa: "pj", emiteNota: null }), true);
  assert.equal(faltaRespostaNotaLocacao({ tipoPessoa: "pj", emiteNota: false }), false);
  assert.equal(faltaRespostaNotaLocacao({ tipoPessoa: "pf", emiteNota: null }), false);
  const acoes = ler("src/lib/data/perfil-actions.ts");
  const salvar = acoes.slice(acoes.indexOf("export async function salvarMeuDocumento"), acoes.indexOf("export async function salvarMinhaNotaLocacao"));
  assert.match(salvar, /const nota = emiteNotaLocacaoParaGravar\(tipo, input\.emiteNotaLocacao\);\n\s+if \(!nota\.ok\) return \{ ok: false, error: nota\.erro \};/);
  assert.match(salvar, /emite_nota_locacao: nota\.valor/);
  const pendencia = acoes.slice(acoes.indexOf("export async function salvarMinhaNotaLocacao"));
  assert.match(pendencia, /if \(atual\.person_type !== "pj"\)/);
  assert.match(acoes, /faltaNotaLocacao: completo && faltaRespostaNotaLocacao/);
  const tela = ler("src/components/account/conta-secoes.tsx");
  assert.match(tela, /<PerguntaNotaLocacao valor=\{notaLoc\} onChange=\{setNotaLoc\} \/>/);
  assert.match(tela, /<PerguntaNotaLocacao valor=\{doc\.emiteNotaLocacao\} onChange=\{salvarNota\} pendente=\{doc\.faltaNotaLocacao\}/);
});

test("(2) o filtro: só o dono PJ/MEI que declarou; o selo antigo do imóvel (issues_invoice) não conta mais", () => {
  const LISTA = [
    im("pj-sim", { emiteNotaDono: true }),
    im("pj-nao", { emiteNotaDono: false }),
    im("sem-dado", {}),
    im("so-issues", { issuesInvoice: true }),
  ];
  const f = { ...FILTROS_PAINEL_VAZIOS, notaOnly: true };
  assert.deepEqual(LISTA.filter((p) => passaNoPainel(p, f)).map((p) => p.id), ["pj-sim"]);
  assert.equal(LISTA.filter((p) => passaNoPainel(p, FILTROS_PAINEL_VAZIOS)).length, 4);
  assert.equal(contarFiltrosPainel(f), contarFiltrosPainel(FILTROS_PAINEL_VAZIOS) + 1);
  assert.match(resumoFiltros(f), /Emite nota fiscal/);
  assert.equal(ROTULO_FILTRO_NOTA_LOCACAO, "Emite nota fiscal");
  // O alerta de busca salva usa o mesmo critério.
  const base = { id: "x", city: "Uberlândia", state: "MG", propertyType: "apartment", monthlyPrice: 3000, bedrooms: 1, minPeriodDays: 30, tagHomeOffice: false } as unknown as Parameters<typeof imovelBateComBusca>[1];
  assert.equal(imovelBateComBusca("nota=1", { ...base, emiteNotaDono: true }), true);
  assert.equal(imovelBateComBusca("nota=1", { ...base, issuesInvoice: true }), false);
});

test("(2) servidor: a busca carrega a declaração do dono pelo cliente de serviço (só o booleano)", () => {
  const dados = ler("src/lib/data/properties.ts");
  // E579: o dono vem das linhas do banco (o Property da busca não leva o ownerId — com ele ausente, o filtro dava 0).
  assert.match(dados, /await attachNotaDono\(mapped, donoPorImovelDasLinhas\(data as unknown as PropertyRow\[\]\)\);/);
  const fn = dados.slice(dados.indexOf("async function attachNotaDono"));
  assert.match(fn, /select\("id, person_type, emite_nota_locacao"\)/);
  assert.match(fn, /p\.emiteNotaDono = donoEmiteNota\(/);
  assert.doesNotMatch(fn.slice(0, 1200), /cnpj|cpf/);
  // Contador: o chip da folha usa a mesma contagem dos outros interruptores.
  assert.match(ler("src/components/busca/painel-filtros-celular.tsx"), /facetaInterruptor\(contar, rascunho, "notaOnly"\)/);
});

test("(3) denúncia 'Não emitiu a nota fiscal declarada': só no anúncio com a declaração; servidor confere", () => {
  assert.equal(motivoDenunciaValido("nota_nao_emitida"), true);
  assert.equal(MOTIVOS_DENUNCIA.find((m) => m.chave === "nota_nao_emitida")?.rotulo, MOTIVO_NOTA_NAO_EMITIDA);
  assert.equal(motivosDenunciaDoAnuncio(false).some((m) => m.chave === "nota_nao_emitida"), false);
  assert.equal(motivosDenunciaDoAnuncio(true).some((m) => m.chave === "nota_nao_emitida"), true);
  const acoes = ler("src/lib/saida/acoes.ts");
  assert.match(acoes, /if \(motivo === "nota_nao_emitida"\) \{/);
  assert.match(ler("src/app/(public)/imoveis/[id]/property-detail.tsx"), /<DenunciarAnuncio propertyId=\{property\.id\} notaDeclarada=\{property\.emiteNotaDono === true\} \/>/);
});

test("migração 0294: coluna só para PJ, motivo novo, aplicar idempotente e rollback", () => {
  const m = ler("supabase/migrations/0294_dono_emite_nota_locacao.sql");
  assert.match(m, /add column if not exists emite_nota_locacao boolean/);
  assert.match(m, /check \(person_type = 'pj' or emite_nota_locacao is null\)/);
  assert.match(m, /'nota_nao_emitida'/);
  const a = ler("supabase/producao/aplicar-0294.sql");
  assert.match(a, /^begin;/m);
  assert.match(a, /^commit;/m);
  assert.match(a, /'0294_dono_emite_nota_locacao'/);
  assert.match(a, /where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261105000294'\)/);
  const r = ler("supabase/producao/rollback/0294_rollback.sql");
  assert.match(r, /update public\.denuncias_anuncio set motivo = 'outro' where motivo = 'nota_nao_emitida';/);
  assert.match(r, /drop column if exists emite_nota_locacao/);
});
