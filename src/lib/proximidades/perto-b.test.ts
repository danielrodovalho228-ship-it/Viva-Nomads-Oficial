/*
  PERTO-B — "O que tem por perto" automático: busca na edição, recarga quando o endereço muda, teto por categoria,
  nenhum minuto sem provedor de rotas, oculto e manual sem endereço fora da página, chips da mesma lista, migração 0238.
  Roda: node --test src/lib/proximidades/perto-b.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cepComHifen, chaveBuscaPerto, OVERPASS_SERVIDORES, PROXIMIDADES_LAB, tentativasNominatim } from "./osm.ts";
import { manualSemEndereco, proximidadesVisiveis, servicosPorPerto, textoDistancia, textoProximidade } from "../anuncio/proximidades.ts";
import { prontidaoAnuncio, ROTULO_PROXIMIDADES_SEM_ENDERECO } from "../anuncio/prontidao.ts";
import type { Proximity } from "../types.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("distância arredondada como o prompt pede ('a 600 m', 'a 1,4 km') e nenhum minuto sem tempo do motor", () => {
  assert.equal(textoDistancia(40), "a 100 m");
  assert.equal(textoDistancia(620), "a 600 m");
  assert.equal(textoDistancia(1430), "a 1,4 km");
  assert.equal(textoDistancia(2000), "a 2 km");
  assert.equal(textoProximidade({ category: "saude", name: "X", distanciaM: 620 }), "a 600 m");
  // Nota antiga em texto livre ("10 min a pé") NUNCA vai à tela.
  assert.equal(textoProximidade({ category: "saude", name: "X", note: "10 min a pé" }), null);
  // Minuto só com o tempo do motor de rotas (tempoMin + modo).
  assert.equal(textoProximidade({ category: "saude", name: "X", distanciaM: 620, tempoMin: 7.6, tempoModo: "a_pe" }), "8 min a pé");
  assert.equal(textoProximidade({ category: "saude", name: "X", distanciaM: 620, tempoMin: 7.6 }), "a 600 m", "minuto sem modo não conta");
});

test("sem provedor de rotas: a lista do laboratório não traz minuto nenhum; osm.ts não exporta fórmula de tempo", () => {
  for (const l of PROXIMIDADES_LAB) assert.ok(!("tempo" in l));
  const osm = ler("src/lib/proximidades/osm.ts");
  assert.doesNotMatch(osm, /export function tempoEstimado|min a pé|min de carro/);
  const vis = proximidadesVisiveis(PROXIMIDADES_LAB.map((l) => ({ category: l.categoria, name: l.nome, tipo: l.tipo, origem: "osm" as const, distanciaM: l.distanciaM })));
  for (const v of vis) assert.doesNotMatch(v.texto, /min/);
});

test("até 3 por categoria, os mais próximos primeiro, na ordem Saúde → Transporte", () => {
  const lista: Proximity[] = [
    ...[900, 100, 500, 300].map((d, i) => ({ category: "saude" as const, name: `Saúde ${i}`, distanciaM: d })),
    { category: "transporte", name: "Parada", distanciaM: 50 },
    { category: "educacao", name: "Escola", distanciaM: 700 },
  ];
  const v = proximidadesVisiveis(lista);
  assert.deepEqual(v.map((x) => x.nome), ["Saúde 1", "Saúde 3", "Saúde 2", "Escola", "Parada"]);
});

test("oculto ('não mostrar') e manual antigo sem endereço não aparecem; o manual sem endereço vira pendência", () => {
  const lista: Proximity[] = [
    { category: "mercado", name: "Mercado oculto", tipo: "mercado", origem: "osm", distanciaM: 200, oculto: true },
    { category: "saude", name: "Farmácia antiga", note: "5 min a pé", origem: "manual" },
    { category: "saude", name: "Clínica nova", origem: "manual", endereco: "Rua A, 10", distanciaM: 700 },
  ];
  assert.deepEqual(proximidadesVisiveis(lista).map((x) => x.nome), ["Clínica nova"]);
  assert.equal(lista.filter(manualSemEndereco).length, 1);
  const base = { enderecoOk: true, detalhesOk: true, periodoOk: true, fotos: 10, titulo: "Apto", preco: 1, garantiaOk: true, sublocacaoOk: true, privacidadeOk: true, documento: "approved" as const, limitePlanoOk: null, descricao: "x".repeat(200), selo: true, video: true };
  const p = prontidaoAnuncio({ ...base, proximidadesSemEndereco: 1 });
  assert.ok(p.melhorar.includes(ROTULO_PROXIMIDADES_SEM_ENDERECO));
  assert.equal(p.podePublicar, true, "pendência não trava a publicação: o lugar só fica fora da página");
  assert.ok(!prontidaoAnuncio({ ...base, proximidadesSemEndereco: 0 }).melhorar.includes(ROTULO_PROXIMIDADES_SEM_ENDERECO));
});

test("os 3 chips vêm da MESMA lista visível de 'O que tem por perto'", () => {
  const vis = proximidadesVisiveis([
    { category: "transporte", name: "Parada", tipo: "onibus", distanciaM: 90 },
    { category: "mercado", name: "Mercado", tipo: "mercado", distanciaM: 350, oculto: true },
    { category: "saude", name: "Farmácia", tipo: "farmacia", distanciaM: 220 },
  ]);
  assert.deepEqual(servicosPorPerto(vis).map((s) => s.tipo), ["onibus", "farmacia"]);
  const pagina = ler("src/components/property/location-nearby.tsx");
  assert.match(pagina, /const todosProximities = proximidadesVisiveis\(proximidadesDoImovel\(property\)\);/);
  assert.match(pagina, /<ServicosPorPerto visiveis=\{todosProximities\} \/>/);
  assert.match(ler("src/lib/data/proximidades.ts"), /export async function proximidadesDoAnuncio[\s\S]*proximidadesVisiveis\(proximidadesDoImovel/);
});

test("a edição chama a busca (pelo endereço guardado) e mudar CEP, rua ou número recarrega", () => {
  assert.notEqual(chaveBuscaPerto("38400-100", "Rua A", "10"), chaveBuscaPerto("38400-100", "Rua A", "12"));
  assert.notEqual(chaveBuscaPerto("38400-100", "Rua A", "10"), chaveBuscaPerto("38400-200", "Rua A", "10"));
  assert.equal(chaveBuscaPerto("38400-100", " Rua A ", "10"), chaveBuscaPerto("38400100", "rua a", "10"));
  const pagina = ler("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  assert.match(pagina, /if \(!editingId \|\| cepValido\(cep\) \|\| proxBuscadoRef\.current\) return;[\s\S]*?buscarPerto\(\{ propertyId: editingId \}\)/);
  assert.match(pagina, /const chave = chaveBuscaPerto\(cep, street, numero\);[\s\S]*?proxBuscadoRef\.current === chave/);
  // A edição não exige mais o número para buscar (o publicado não tem o rascunho com o número).
  assert.doesNotMatch(pagina, /!numero\.trim\(\) \|\| proxBuscadoRef/);
  const rota = ler("src/app/api/proximidades/route.ts");
  assert.match(rota, /enderecoDoAnuncio\(admin, corpo\.propertyId, user\.id\)/);
  assert.match(rota, /p\.owner_id !== userId\) return null/);
});

test("uma mensagem só no bloco: lista, 'não achamos' (busca feita) ou 'complete o endereço' (busca não feita)", () => {
  const bloco = ler("src/components/anuncio/blocos-cadastro.tsx");
  assert.match(bloco, /\{temItens && \(\s*<>\s*<p className="mb-3 text-xs text-muted" data-testid="proximidades-achamos">/);
  // E145: com a busca feita, "não respondeu" e "não achamos" são mensagens separadas (uma por vez).
  assert.match(bloco, /!carregando && !temItens && buscou && naoRespondeu && \(/);
  assert.match(bloco, /!carregando && !temItens && buscou && !naoRespondeu && \(/);
  assert.match(bloco, /!carregando && !temItens && !buscou && \(/);
});

test("Nominatim estruturado com CEP com hífen e tentativas mais largas; Overpass com espelho", () => {
  assert.equal(cepComHifen("38400100"), "38400-100");
  const t = tentativasNominatim({ rua: "Av. João Naves de Ávila", numero: "1331", cidade: "Uberlândia", uf: "MG", cep: "38408100" }).map((p) => Object.fromEntries(p));
  assert.equal(t[0].street, "1331 Av. João Naves de Ávila");
  assert.equal(t[0].postalcode, "38408-100");
  assert.equal(t[1].postalcode, undefined);
  assert.match(t[2].q, /Uberlândia, MG, Brasil/);
  assert.deepEqual(t.at(-1), { format: "jsonv2", limit: "1", countrycodes: "br", postalcode: "38408-100", country: "Brasil" });
  assert.equal(OVERPASS_SERVIDORES.length, 2);
  assert.match(OVERPASS_SERVIDORES[1], /overpass\.kumi\.systems/);
});

test("salvar: distância e tempo calculados no servidor; lugar do OSM só se estiver na busca guardada do CEP", () => {
  const g = ler("src/lib/data/proximidades-gravar.ts");
  assert.match(g, /const l = doCep\.get\(chave\(p\.tipo, nome\)\);\s*if \(!l\) continue;/);
  assert.match(g, /distancia_m: l\.distanciaM/);
  assert.doesNotMatch(g, /distancia_m: p\.distanciaM|tempo_min: p\./, "nada de distância ou minuto vindo do navegador");
  assert.match(ler("src/lib/data/actions.ts"), /proximidadesParaGravar\(admin, id, input\.proximities \?\? \[\], input\.enderecoProximidades\)/);
});

test("0238: colunas calculadas, reportes só do dono, CEP privado; aplicar e rollback se registram", () => {
  const sql = ler("supabase/migrations/0238_proximidades_curadoria.sql");
  for (const c of ["distancia_m integer", "tempo_min numeric", "oculto boolean not null default false", "origem text not null default 'manual'"]) assert.ok(sql.includes(c), c);
  assert.match(sql, /tipo in \('hospital', 'farmacia', 'academia', 'universidade', 'escola', 'coworking', 'mercado', 'onibus'\)/);
  assert.match(sql, /revoke all on public\.proximidades_reportes from anon, authenticated;/);
  assert.match(sql, /for insert to authenticated\s+with check \(autor_id = auth\.uid\(\) and exists \(select 1 from public\.properties p where p\.id = property_id and p\.owner_id = auth\.uid\(\)\)\)/);
  assert.match(sql, /revoke select \(cep_proximidades\) on public\.properties from anon, authenticated;/);
  const aplicar = ler("supabase/producao/aplicar-0238.sql");
  assert.match(aplicar, /^-- .*\nbegin;/);
  assert.match(aplicar, /commit;\s*$/);
  assert.match(aplicar, /'20261024000238', '0238_proximidades_curadoria'/);
  assert.match(ler("supabase/producao/rollback/0238_rollback.sql"), /version = '20261024000238'/);
});

test("o campo 'Distância' em texto livre saiu do cadastro; o manual pede o endereço do lugar", () => {
  const m = ler("src/components/property/manual-proximities.tsx");
  assert.doesNotMatch(m, /placeholder="Distância/);
  assert.match(m, /placeholder="Endereço do lugar \(rua e número\)"/);
  assert.match(m, /NAO_ACHAMOS_ENDERECO = "Não achamos este endereço\."/);
});
