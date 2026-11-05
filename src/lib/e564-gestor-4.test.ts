/**
 * E564 (parte A, decisão do Daniel, 04/11/2026): o Gestor de assinatura (R$ 500/mês, taxa zero) sai; entra "Gestor: 4% para
 * carteiras de 20 ou mais imóveis, com cadastro assistido da carteira e contato direto na Viva". A faixa "31+ · taxa
 * negociável" some: 31+ é tabela (6%) ou Gestor (4%). Nada da fase 2 é anunciado. `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { GESTOR_DIFERENCIAIS, GESTOR_PRECO, GESTOR_RESUMO, GESTOR_TEXTO, PLANOS } from "../config/planos.ts";
import { FAIXAS_COMISSAO_PADRAO, rotuloFaixaTaxa, taxaPublicaTexto } from "./cobranca/regra.ts";

const RAIZ = new URL("../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");

test("o desenho novo do Gestor: 4%, 20+ imóveis, cadastro assistido e contato direto", () => {
  assert.equal(GESTOR_PRECO.taxa, 0.04);
  assert.equal(GESTOR_PRECO.minimoImoveis, 20);
  assert.equal(GESTOR_TEXTO, "4% para carteiras de 20 ou mais imóveis, com cadastro assistido da carteira e contato direto na Viva");
  assert.match(GESTOR_RESUMO, /^4% · carteiras de 20\+ imóveis · cadastro assistido/);
});

test("só os diferenciais do lançamento (nada da fase 2)", () => {
  assert.deepEqual(GESTOR_DIFERENCIAIS, ["Taxa de serviço de 4% sobre o valor total de cada contrato", "Cadastro assistido da carteira", "Contato direto na Viva", "Suporte prioritário"]);
  const g = PLANOS.find((p) => p.id === "gestor")!;
  assert.deepEqual(g.beneficios, GESTOR_DIFERENCIAIS);
  assert.doesNotMatch(g.custoLabel, /zero|assinatura/i);
  for (const fase2 of [/ilimitad/i, /recursos de carteira/i, /vários proprietários|varios proprietarios/i, /permiss/i, /importa/i, /sincroniza/i])
    assert.ok(!g.beneficios.some((b) => fase2.test(b)), String(fase2));
});

test("31+ é a faixa de 6% da tabela — sem 'taxa negociável' nem 'Negociado'", () => {
  assert.ok(FAIXAS_COMISSAO_PADRAO.every((f) => !("negociavel" in f)));
  const topo = FAIXAS_COMISSAO_PADRAO.at(-1)!;
  assert.equal(rotuloFaixaTaxa(topo), "31+");
  assert.equal(taxaPublicaTexto(topo), "6%");
  assert.doesNotMatch(ler("lib/cobranca/taxa-servidor.ts"), /negociavel: true/);
});

const PROIBIDAS = [/R\$ ?500\/m[eê]s/i, /taxa (de serviço )?zero/i, /20 imóveis incluídos/i, /R\$ ?25 por imóvel/i, /taxa negoci[aá]vel/i, /negoci[aá]vel, entre em contato/i, /condições negociadas/i];
// O registro histórico da decisão dos sócios (/decisao) e o admin ficam de fora.
const FORA = [/components\/decisao\//, /app\/\(dashboard\)\/admin\//, /\.test\.tsx?$/];
function arquivos(dir: string): string[] {
  return readdirSync(join(RAIZ, dir)).flatMap((n) => {
    const rel = join(dir, n);
    return statSync(join(RAIZ, rel)).isDirectory() ? arquivos(rel) : /\.(ts|tsx)$/.test(n) ? [rel] : [];
  });
}

test("nenhum texto do Gestor antigo nem da faixa negociável sobra no site e no atendimento", () => {
  const achados: string[] = [];
  for (const f of [...arquivos("app"), ...arquivos("components"), ...arquivos("lib"), ...arquivos("config")]) {
    if (FORA.some((r) => r.test(f))) continue;
    const linhas = ler(f).split("\n");
    linhas.forEach((l, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(l)) return; // comentário não é texto da tela
      for (const p of PROIBIDAS) if (p.test(l)) achados.push(`${f}:${i + 1} ${p}`);
    });
  }
  assert.deepEqual(achados, []);
});

test("as telas e o atendimento usam o texto único do Gestor", () => {
  for (const f of [
    "app/(public)/para-proprietarios/page.tsx",
    "app/(public)/precos/page.tsx",
    "app/(public)/parceiros/page.tsx",
    "components/precos/plano-gestor-form.tsx",
    "components/modelo-negocio/modelo-negocio.tsx",
    "lib/atendimento/faq.ts",
    "lib/atendimento/viva-prompt.ts",
    "lib/atendimento/parceiros-texto.ts",
  ])
    assert.match(ler(f), /GESTOR_TEXTO/, f);
});
