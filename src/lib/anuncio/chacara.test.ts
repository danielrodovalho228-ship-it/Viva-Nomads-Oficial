/*
  TIPO-CHACARA-B — tipo "Chácara/Sítio": cadastro, busca, campos obrigatórios e distância calculada do ponto marcado.
  Roda: node --test src/lib/anuncio/chacara.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PROPERTY_TYPES, propertyTypeLabel } from "../amenities.ts";
import { OPCOES_TIPO, tipoCanonico } from "../busca/painel-filtros.ts";
import { TIPOS_ASSISTENTE } from "./assistente-telas.ts";
import { prontidaoAnuncio, type FatosAnuncio } from "./prontidao.ts";
import { linhasDetalhes, normalizarDetalhes } from "./detalhes-anuncio.ts";
import {
  CENTROS_CONHECIDOS,
  LINHA_FIXA_CHACARA,
  ROTULO_FALTA_CHACARA,
  chacaraDoFormulario,
  distanciaCidade,
  faltaChacara,
  linhaChacara,
  normalizarChacara,
  tipoSemAndar,
} from "./chacara.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("o tipo aparece no cadastro, no tipoCanonico da busca, no filtro e na URL; fazenda e rancho não", () => {
  assert.ok(PROPERTY_TYPES.some((t) => t.value === "chacara" && t.label === "Chácara/Sítio"));
  assert.equal(propertyTypeLabel("chacara"), "Chácara/Sítio");
  assert.ok(TIPOS_ASSISTENTE.some((t) => t.valor === "chacara" && t.rotulo === "Chácara/Sítio"), "cadastro (passo Tipo)");
  assert.ok(OPCOES_TIPO.some((o) => o.valor === "chacara" && o.rotulo === "Chácara/Sítio"), "filtro Tipo de imóvel");
  assert.equal(tipoCanonico("Chácara/Sítio"), "chacara");
  assert.equal(tipoCanonico("chacara"), "chacara");
  assert.ok(!PROPERTY_TYPES.some((t) => /fazenda|rancho/i.test(t.value + t.label)), "fazenda e rancho fora até o parecer");
  // A URL (?tipo=) aceita o que está no catálogo.
  assert.match(ler("src/app/(public)/buscar/search-client.tsx"), /tipo && PROPERTY_TYPES\.some\(\(t\) => t\.value === tipo\)/);
});

const BASE: FatosAnuncio = {
  enderecoOk: true, detalhesOk: true, periodoOk: true, fotos: 8, titulo: "Chácara do Lab", preco: 3000, garantiaOk: true,
  sublocacaoOk: true, privacidadeOk: true, documento: "approved", limitePlanoOk: true, descricao: "x".repeat(80), selo: false, video: false,
};

test("publicar sem os 3 campos é recusado; com os 3, passa", () => {
  assert.deepEqual(faltaChacara(undefined), ["acesso", "tipo de internet", "ponto no mapa"]);
  const sem = prontidaoAnuncio({ ...BASE, chacaraFaltam: faltaChacara({ acesso: "terra" }) });
  assert.equal(sem.podePublicar, false);
  assert.ok(sem.faltam.some((f) => f.startsWith(ROTULO_FALTA_CHACARA) && f.includes("tipo de internet") && f.includes("ponto no mapa")));
  const com = prontidaoAnuncio({ ...BASE, chacaraFaltam: faltaChacara({ acesso: "terra", internet: "radio", pontoMarcado: true }) });
  assert.equal(com.podePublicar, true);
  assert.equal(prontidaoAnuncio(BASE).podePublicar, true, "outro tipo: não se aplica");
  // O servidor usa a mesma regra no portão do Publicar.
  const srv = ler("src/lib/anuncio/prontidao-servidor.ts");
  assert.match(srv, /f\.chacaraFaltam = chacaraPor\.get\(p\.id\)/);
});

test("a distância vem do ponto marcado (calculada), nunca do formulário", () => {
  const centro = CENTROS_CONHECIDOS["uberlandia|MG"];
  const ponto = { lat: -18.95, lng: -48.4 };
  const km = distanciaCidade(ponto, centro);
  assert.ok(km > 14 && km < 16, `~15 km, veio ${km}`);
  // O formulário não manda distância: se mandar, é ignorada.
  const { dados, ponto: p } = chacaraDoFormulario({ acesso: "asfalto", internet: "fibra", ponto, distanciaCidadeKm: 1 } as never);
  assert.deepEqual(p, ponto);
  assert.equal(dados.distanciaCidadeKm, undefined);
  assert.equal(dados.pontoMarcado, true);
  // E o formulário de detalhes não consegue enfiar o grupo do tipo (o servidor descarta).
  const acoes = ler("src/lib/data/actions.ts");
  assert.match(acoes, /const \{ chacara: _ignorada, \.\.\.novos \} = normalizarDetalhes\(input\.detalhesAnuncio\)/);
  // O servidor troca o lat/lng pelo ponto marcado e calcula a distância a partir dele.
  const srv = ler("src/lib/anuncio/chacara-servidor.ts");
  assert.match(srv, /return \{ \.\.\.input, lat: Number\(p\.lat\), lng: Number\(p\.lng\) \}/);
  assert.match(srv, /dados\.distanciaCidadeKm = distanciaCidade\(ponto, centro\)/);
  assert.match(acoes, /const input = aplicarPontoChacara\(entrada\);/);
});

test("editar acesso sem marcar de novo mantém o ponto e a distância", () => {
  const anterior = { acesso: "terra" as const, internet: "radio" as const, pontoMarcado: true, distanciaCidadeKm: 12.4 };
  const { dados, ponto } = chacaraDoFormulario({ acesso: "asfalto", internet: "radio" }, anterior);
  assert.equal(ponto, null);
  assert.deepEqual(dados, { acesso: "asfalto", internet: "radio", pontoMarcado: true, distanciaCidadeKm: 12.4 });
});

test("validação: valor fora da lista cai fora", () => {
  assert.deepEqual(normalizarChacara({ acesso: "helicoptero", internet: "radio", pontoMarcado: "sim", distanciaCidadeKm: -3 }), { internet: "radio" });
  assert.equal(normalizarChacara({}), undefined);
  assert.equal(normalizarDetalhes({ chacara: { acesso: "terra" } })?.chacara?.acesso, "terra");
  const { ponto } = chacaraDoFormulario({ ponto: { lat: 40, lng: -74 } });
  assert.equal(ponto, null, "fora do Brasil não vale");
});

test("anúncio: linha do tipo e sem andar/elevador para chácara (como casa)", () => {
  assert.equal(
    linhaChacara({ acesso: "terra", internet: "radio", pontoMarcado: true, distanciaCidadeKm: 12.4 }, "Uberlândia"),
    "Acesso: estrada de terra · internet: rádio · ~12,4 km do centro de Uberlândia em linha reta",
  );
  const d = { andar: { andar: 2, elevador: true }, chacara: { acesso: "asfalto", internet: "fibra", pontoMarcado: true } };
  const chac = linhasDetalhes(d as never, { tipo: "chacara", cidade: "Uberlândia" });
  assert.ok(!chac.some((l) => l.chave === "andar"));
  assert.equal(chac[0].chave, "chacara");
  assert.ok(linhasDetalhes(d as never, { tipo: "apartamento" }).some((l) => l.chave === "andar"));
  assert.equal(tipoSemAndar("casa"), true);
  assert.equal(tipoSemAndar("chacara"), true);
  assert.equal(tipoSemAndar("apartamento"), false);
  assert.match(ler("src/components/anuncio/detalhes-anuncio-campos.tsx"), /!tipoSemAndar\(tipo\) && bloco\(/);
});

test("cadastro: linha fixa e os campos só neste tipo", () => {
  assert.equal(LINHA_FIXA_CHACARA, "Anuncie só a casa para morar. Uso da terra para plantio ou criação não entra no anúncio.");
  const campos = ler("src/components/anuncio/campos-chacara.tsx");
  assert.match(campos, /LINHA_FIXA_CHACARA/);
  const novo = ler("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  assert.match(novo, /ehChacara\(propertyType\) && \(\s*<CamposChacara/);
  const editar = ler("src/app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx");
  assert.match(editar, /ehChacara\(property\.propertyType\) && \(\s*<CamposChacara/);
});

test("E102-A: a Revisão mostra os dados preenchidos da chácara/sítio, não só o que falta", async () => {
  const { linhasChacaraRevisao } = await import("./chacara.ts");
  assert.deepEqual(
    linhasChacaraRevisao({ acesso: "asfalto", internet: "fibra", pontoMarcado: true }).map((l) => l.texto),
    ["Acesso: Asfalto", "Internet: Fibra", "Ponto marcado no mapa"],
  );
  assert.deepEqual(
    linhasChacaraRevisao({ internet: "radio" }).map((l) => [l.texto, l.ok]),
    [["Acesso: falta informar", false], ["Internet: Rádio", true], ["Falta marcar o ponto", false]],
  );
  const revisar = ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-revisar.tsx");
  assert.match(revisar, /data-testid="revisao-chacara"/);
  assert.match(revisar, /linhasChacaraRevisao\(p\.chacara\)/);
  assert.match(revisar, /l\.ok && <Check /, "o sinal de feito é um ícone");
  const pagina = ler("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  assert.match(pagina, /chacara=\{ehChacara\(propertyType\) \? \{ acesso: chacara\.acesso, internet: chacara\.internet, pontoMarcado: !!chacara\.ponto \|\| chacaraPontoGravado \} : null\}/);
});
