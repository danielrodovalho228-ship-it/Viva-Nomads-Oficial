/*
  E620 (ordem do Daniel, 05/11): a massa de anúncios de exemplo graduada PELO MESMO caminho computado do produto —
  respostas da Qualificação a partir dos atributos reais → confirmações do Passo 5 (aplicarRespostas) → motor do nível
  (nivelDoImovel). Nenhum nível escrito à mão; exemplo novo já nasce graduado.
  Roda: node --test src/lib/niveis/nivel-exemplo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NIVEIS } from "../../config/niveis.ts";
import { SAMPLE_PROPERTIES } from "../properties.ts";
import { FILTROS_PAINEL_VAZIOS, passaNoPainel } from "../busca/painel-filtros.ts";
import { exibicaoDoExemplo, graduarExemplo, mbpsInformado, respostasDoExemplo } from "./nivel-exemplo.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const porId = (id: string) => SAMPLE_PROPERTIES.find((p) => p.id === id)!;

test("E620: o nível de cada exemplo É o do motor (nada escrito à mão)", () => {
  for (const p of SAMPLE_PROPERTIES) assert.equal(p.nivel ?? null, graduarExemplo(p).nivel, p.id);
  // nenhum literal de exemplo declara nível: ele só sai do laço que chama o motor
  const fonte = ler("src/lib/properties.ts");
  const literais = fonte.slice(fonte.indexOf("export const SAMPLE_PROPERTIES"), fonte.indexOf("/* Selo \"Preço justo\""));
  assert.doesNotMatch(literais, /\bnivel\s*:/);
  assert.match(fonte, /for \(const p of SAMPLE_PROPERTIES\) p\.nivel = graduarExemplo\(p\)\.nivel;/);
  // o caminho do cadastro: aplicarRespostas (Passo 5) + nivelDoImovel (motor)
  const mod = ler("src/lib/niveis/nivel-exemplo.ts");
  assert.match(mod, /aplicarRespostas\(respostasDoExemplo\(p\)\)/);
  assert.match(mod, /nivelDoImovel\(\{/);
});

test("E620: distribuição honesta — 4 Essencial (12 de 12), 11 sem nível; nenhum Conforto/Premium sem foto na hora e sem medição", () => {
  const essencial = SAMPLE_PROPERTIES.filter((p) => p.nivel === "essencial").map((p) => p.id);
  assert.deepEqual(essencial, ["ube-001", "ube-006", "ube-012", "ube-014"]);
  assert.equal(SAMPLE_PROPERTIES.filter((p) => p.nivel === "conforto" || p.nivel === "premium").length, 0);
  assert.equal(SAMPLE_PROPERTIES.filter((p) => !p.nivel).length, 11);
});

test("E620: quem fica sem nível tem o motivo (os itens do padrão mínimo que os atributos não sustentam)", () => {
  assert.deepEqual(graduarExemplo(porId("ube-002")).faltam, ["lavanderia_acesso"]); // "Studio premium" sem máquina de lavar
  assert.deepEqual(graduarExemplo(porId("ube-005")).faltam, ["internet_informada"]); // "Internet fibra" sem a velocidade
  assert.deepEqual(graduarExemplo(porId("ube-007")).faltam, ["cozinha_basica", "internet_informada", "lavanderia_acesso"]);
  const casa = graduarExemplo(porId("ube-003")).faltam; // sem Pronto para Morar e sem ar-condicionado
  for (const k of ["ventilacao_quartos", "agua_quente", "entrega_limpa", "internet_informada"]) assert.ok(casa.includes(k as never), k);
  for (const p of SAMPLE_PROPERTIES) if (!p.nivel) assert.ok(graduarExemplo(p).faltam.length > 0, p.id);
});

test("E620: leitura conservadora dos atributos — sem o atributo, sem resposta", () => {
  assert.equal(mbpsInformado(porId("ube-001")), 300);
  assert.equal(mbpsInformado(porId("ube-005")), null); // "Internet fibra" não é velocidade
  assert.equal(mbpsInformado({ ...porId("ube-005"), internetMbps: 100 }), 100); // o campo informado vale
  assert.equal(respostasDoExemplo(porId("ube-009")).cozinha, undefined); // "Cozinha compacta" sem "equipada"
  assert.equal(respostasDoExemplo(porId("ube-004")).cozinha, "fogao"); // "Cozinha compacta equipada"
  assert.equal(respostasDoExemplo(porId("ube-001")).cozinha, "micro");
  assert.equal(respostasDoExemplo(porId("ube-003")).ventilacao, undefined);
});

test("E620: exemplo novo já nasce graduado pelo mesmo caminho (a correção está onde a massa é gerada)", () => {
  const base = porId("ube-001");
  const novo = { ...base, id: "ube-999", nivel: undefined };
  assert.equal(graduarExemplo(novo).nivel, "essencial");
  const semLavar = { ...novo, amenities: base.amenities.filter((a) => a !== "Máquina de lavar"), amenityGroups: base.amenityGroups?.map((g) => ({ ...g, items: g.items.filter((i) => i !== "Máquina de lavar") })) };
  assert.equal(graduarExemplo(semLavar).nivel, null);
  assert.deepEqual(graduarExemplo(semLavar).faltam, ["lavanderia_acesso"]);
});

test("E620: filtro de Nível da busca conta > 0 coerente (mesma regra do painel: 'a partir de')", () => {
  const conta = Object.fromEntries(NIVEIS.map((n) => [n, SAMPLE_PROPERTIES.filter((p) => passaNoPainel(p, { ...FILTROS_PAINEL_VAZIOS, nivelMin: n })).length]));
  assert.deepEqual(conta, { essencial: 4, conforto: 0, premium: 0 });
});

test("E620: a página do exemplo mostra o MESMO nível do cartão", () => {
  for (const p of SAMPLE_PROPERTIES) {
    const ex = exibicaoDoExemplo(p);
    assert.equal(ex.nivel?.nivel ?? null, p.nivel ?? null, p.id);
    assert.equal(ex.confortoConfirmado, !!p.nivel, p.id);
    assert.equal(ex.nivel?.vistoriado ?? false, false);
  }
  const pagina = ler("src/app/(public)/imoveis/[id]/page.tsx");
  assert.match(pagina, /isExemplo\(property\) \? Promise\.resolve\(exibicaoDoExemplo\(property\)\) : exibicao59DoImovel\(/);
});
