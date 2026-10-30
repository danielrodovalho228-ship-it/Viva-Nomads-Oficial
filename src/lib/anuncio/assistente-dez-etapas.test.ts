/*
  CAMPOS-3 — dados das 10 etapas do assistente (mockups cadastro-imovel-01..10): mapa de etapas, lista de conferência
  da etapa 10, "Outras regras" da tela 06 e a comodidade TV da tela 05.
  Roda: node --test src/lib/anuncio/assistente-dez-etapas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ETAPAS_ASSISTENTE, NOTA_DISPONIVEL_AGORA, NOTA_ENDERECO_SEM_CEP, conferenciaAssistente, etapaDoItemProntidao } from "./assistente-dez-etapas.ts";
import { prontidaoAnuncio, type FatosAnuncio } from "./prontidao.ts";
import { MAX_OUTRAS_REGRAS, limparOutrasRegras, linhasRegrasCasa, normalizarRegrasCasa } from "./regras-casa.ts";
import { formDeRegrasCasa, payloadDeRegrasCasa } from "./regras-casa-form.ts";
import { AMENITY_GROUPS } from "../amenities.ts";
import { ICONE_POR_CHAVE } from "./comodidades-icones.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

const FATOS_OK: FatosAnuncio = {
  enderecoOk: true,
  detalhesOk: true,
  periodoOk: true,
  fotos: 8,
  titulo: "Apartamento mobiliado no Santa Mônica",
  preco: 2900,
  garantiaOk: true,
  sublocacaoOk: true,
  privacidadeOk: true,
  documento: "approved",
 
  descricao: "x".repeat(80),
  selo: false,
  video: false,
};

test("mapa: 10 etapas na ordem dos mockups, cada uma com o seu arquivo em docs/mockups", () => {
  assert.deepEqual(
    ETAPAS_ASSISTENTE.map((e) => e.n),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  );
  for (const e of ETAPAS_ASSISTENTE) assert.match(e.mockup, new RegExp(`^cadastro-imovel-${String(e.n).padStart(2, "0")}-`));
});

test("mapa: todo campo citado existe em Property (src/lib/types.ts)", () => {
  const tipos = ler("src/lib/types.ts");
  const corpo = tipos.slice(tipos.indexOf("export interface Property {"), tipos.indexOf("\n}", tipos.indexOf("export interface Property {")));
  for (const e of ETAPAS_ASSISTENTE) for (const c of e.campos) assert.match(corpo, new RegExp(`\\n  ${c}\\??:`), `${e.id}: ${c} não está em Property`);
});

test("mapa: todo item obrigatório da prontidão cai numa etapa (nenhum fica sem tela) e cada um numa só", () => {
  const fonte = ler("src/lib/anuncio/prontidao.ts");
  const obrig = fonte.slice(fonte.indexOf("export function prontidaoAnuncio"), fonte.indexOf("const opcionais"));
  const chaves = [...obrig.matchAll(/key: "([a-z_]+)"/g)].map((m) => m[1]);
  assert.ok(chaves.length >= 15);
  for (const k of chaves) {
    const etapas = ETAPAS_ASSISTENTE.filter((e) => e.prontidao.includes(k));
    assert.equal(etapas.length, 1, `${k} em ${etapas.length} etapas`);
  }
  assert.equal(etapaDoItemProntidao("documento").id, "revisao"); // E104: o Passo 3 é só endereço
  assert.equal(etapaDoItemProntidao("sublocacao").id, "revisao");
  assert.equal(etapaDoItemProntidao("endereco").id, "endereco");
  assert.equal(etapaDoItemProntidao("titulo").id, "descricao");
  assert.equal(etapaDoItemProntidao("chave-nova").id, "revisao");
});

test("conferência: anúncio pronto → as 7 linhas do mockup feitas e pode publicar", () => {
  const c = conferenciaAssistente(prontidaoAnuncio(FATOS_OK));
  assert.equal(c.podePublicar, true);
  assert.deepEqual(
    c.itens.map((i) => i.rotulo),
    ["Fotos", "Endereço", "Detalhes", "Comodidades", "Regras", "Título e descrição", "Preço", "Disponibilidade"]
  );
  assert.ok(c.itens.every((i) => i.ok && i.faltam.length === 0));
  assert.deepEqual(c.pendentesNaRevisao, []);
});

test("conferência: o que falta aparece na etapa certa, com o texto da prontidão", () => {
  const p = prontidaoAnuncio({ ...FATOS_OK, fotos: 5, garantiaOk: false, internetOk: false, tipoEntradaOk: false, qualificacaoOk: false });
  const c = conferenciaAssistente(p);
  const por = Object.fromEntries(c.itens.map((i) => [i.id, i]));
  assert.equal(c.podePublicar, false);
  assert.equal(por.fotos.ok, false);
  assert.match(por.fotos.faltam[0], /tem 5/);
  assert.equal(por.preco.ok, false);
  assert.equal(por.comodidades.ok, false);
  assert.equal(por.regras.ok, false);
  // E271: as declarações (qualificação) não viram linha da lista — ficam só na seção delas, no Passo 10.
  assert.equal(por.tipo, undefined);
  assert.equal(por.endereco.ok, true);
  assert.equal(c.itens[0].id, "fotos");
  assert.ok(c.pendentesNaRevisao.some((t) => /Declara|Qualifica/i.test(t)), c.pendentesNaRevisao.join(" | "));
});

test("E233-A: tudo em ordem publica — sem 'Vaga no seu plano' na revisão", () => {
  const c = conferenciaAssistente(prontidaoAnuncio(FATOS_OK));
  assert.equal(c.podePublicar, true);
  assert.ok(c.itens.every((i) => i.ok));
  assert.deepEqual(c.pendentesNaRevisao, []);
});

test("outras regras: limpa, corta no máximo e vazio não existe", () => {
  assert.equal(limparOutrasRegras("  Tirar os sapatos   na sala \n\n\n Manter a varanda limpa "), "Tirar os sapatos na sala\nManter a varanda limpa");
  assert.equal(limparOutrasRegras("   "), undefined);
  assert.equal(limparOutrasRegras(42), undefined);
  assert.equal(limparOutrasRegras("a\u0000b"), "a b");
  assert.equal(limparOutrasRegras("x".repeat(500))!.length, MAX_OUTRAS_REGRAS);
});

test("outras regras: o servidor guarda, a folha mostra por último e só ela também conta como regra definida", () => {
  const r = normalizarRegrasCasa({ festas: "proibido", outras: " Sem sapatos na sala " });
  assert.deepEqual(r, { festas: "proibido", outras: "Sem sapatos na sala" });
  const l = linhasRegrasCasa(r);
  assert.deepEqual(l.at(-1), { chave: "outras", texto: "Sem sapatos na sala" });
  assert.deepEqual(normalizarRegrasCasa({ outras: "Só ela" }), { outras: "Só ela" });
  assert.equal(normalizarRegrasCasa({ outras: "   " }), null);
});

test("outras regras: o formulário traz de volta e envia sem toggle (vazio não vai)", () => {
  const f = formDeRegrasCasa({ outras: "Sem sapatos" });
  assert.equal(f.outras, "Sem sapatos");
  assert.deepEqual(payloadDeRegrasCasa(f), { outras: "Sem sapatos" });
  assert.deepEqual(payloadDeRegrasCasa({ ...f, outras: "  " }), {});
  // As 4 regras continuam no padrão E56: desligada não vai, mesmo com outras preenchida.
  assert.deepEqual(payloadDeRegrasCasa({ ...f, festas: "proibido" }), { outras: "Sem sapatos" });
});

test("outras regras: editor tem o campo com limite, e a folha tem ícone para a linha", () => {
  const campos = ler("src/components/anuncio/regras-casa-campos.tsx");
  assert.match(campos, /data-testid="regras-casa-outras"/);
  assert.match(campos, /maxLength=\{MAX_OUTRAS_REGRAS\}/);
  assert.match(ler("src/components/property/bom-saber.tsx"), /outras: ListChecks/);
});

test("comodidade TV (tela 05): no catálogo, com ícone e reconhecida na importação", () => {
  const conforto = AMENITY_GROUPS.find((g) => g.category === "conforto")!;
  assert.ok(conforto.items.some((i) => i.key === "tv" && i.label === "TV"));
  assert.ok(ICONE_POR_CHAVE.tv);
  assert.match(ler("src/lib/anuncio/importar-anuncio.ts"), /\["tv", /);
});

test("spec da Pista B aponta cada tela do mockup e lista as divergências", () => {
  const spec = ler("docs/specs/assistente-cadastro-dados.md");
  for (const e of ETAPAS_ASSISTENTE) assert.ok(spec.includes(e.mockup), `spec sem ${e.mockup}`);
  for (const t of ["Caução", "Estadia mínima", "Outras regras", "TV"]) assert.ok(spec.includes(t), `spec sem ${t}`);
});

test("E258 (a)(b): o 'feito' explica o opcional vazio — sem CEP (o por perto fica de fora) e sem data (disponível agora)", () => {
  const p = prontidaoAnuncio(FATOS_OK);
  const sem = Object.fromEntries(conferenciaAssistente(p, { cepOk: false, disponivelDesde: "" }).itens.map((i) => [i.id, i]));
  assert.equal(sem.endereco.ok, true);
  assert.equal(sem.endereco.nota, NOTA_ENDERECO_SEM_CEP);
  assert.equal(sem.disponibilidade.ok, true);
  assert.equal(sem.disponibilidade.nota, NOTA_DISPONIVEL_AGORA);
  const com = Object.fromEntries(conferenciaAssistente(p, { cepOk: true, disponivelDesde: "15/11/2026" }).itens.map((i) => [i.id, i]));
  assert.equal(com.endereco.nota, undefined);
  assert.equal(com.disponibilidade.nota, "Disponível a partir de 15/11/2026.");
  // Pendente não ganha nota: a linha mostra o que falta.
  const falta = conferenciaAssistente(prontidaoAnuncio({ ...FATOS_OK, enderecoOk: false }), { cepOk: false });
  assert.equal(falta.itens.find((i) => i.id === "endereco")!.nota, undefined);
});

test("E258 (a)(c): o aviso do 'por perto' e a regra de gravar de cada bloco do Passo 5 estão ditos na tela", () => {
  const blocos = readFileSync("src/components/anuncio/blocos-cadastro.tsx", "utf8");
  assert.match(blocos, /quando o endereço tiver CEP e rua \(Passo 3\)\. O CEP não segura a publicação/);
  const re = readFileSync("src/components/niveis/ruido-extras.tsx", "utf8");
  assert.match(re, /data-testid="ruido-como-salva"/);
  assert.match(re, /data-testid="extras-como-salva"/);
  assert.match(readFileSync("src/components/anuncio/estrutura-acessibilidade.tsx", "utf8"), /COMO_SALVA_ESTRUTURA = "Cada toque salva na hora\."/);
  const pagina = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx", "utf8");
  assert.match(pagina, /contextoConferencia=\{\{ cepOk: !!cepValido\(cep\), disponivelDesde: availableFrom \? dataBR\(availableFrom\) : "" \}\}/);
});
