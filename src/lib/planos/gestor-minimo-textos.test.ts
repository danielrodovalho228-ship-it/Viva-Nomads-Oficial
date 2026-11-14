/*
  E236 — Plano Gestor: o mínimo de imóveis é UM número só, GESTOR_PRECO.minimoImoveis (decisão do Daniel, out/2026).
  Nenhuma frase liga o Gestor a um número escrito à mão (5, 20, 30 ou 31); os textos do Gestor saem da constante e mudam
  juntos com ela. A faixa sem teto da TAXA DE SERVIÇO ("31+") é outra regra e fica como está.
  Roda: node --test src/lib/planos/gestor-minimo-textos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { GESTOR_PRECO, PORTA_GESTOR_TEXTO } from "../../config/planos.ts";
import { FAQ } from "../atendimento/faq.ts";
import { EMPRESAS_E_GESTORES } from "../atendimento/parceiros-texto.ts";
import { FAIXAS_COMISSAO_PADRAO } from "../cobranca/regra.ts";

const RAIZ = new URL("../../../", import.meta.url);
const ler = (p: string) => readFileSync(new URL(p, RAIZ), "utf8");
const N = GESTOR_PRECO.minimoImoveis;

function arquivos(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(new URL(dir, RAIZ))) {
    const p = join(dir, nome);
    if (statSync(new URL(p, RAIZ)).isDirectory()) arquivos(`${p}/`, out);
    else if (/\.(ts|tsx)$/.test(nome) && !/\.(test|spec)\./.test(nome)) out.push(p);
  }
  return out;
}

/** Número de imóveis escrito à mão colado ao Gestor ("31+", "31 ou mais", "20 imóveis", "a partir de 30", "tem 5"). */
const NUMERO_FIXO = /\b(5|20|30|31)\s*(\+|ou mais|imóve)|\b(a partir de|tem|com) (5|20|30|31)\b/;
/** Frases que citam Gestor e um número, mas não falam do mínimo do plano (com o motivo). */
const EXCECOES: Record<string, string> = {
  "src/lib/data/planos-actions.ts": "comentário sobre o mesmo documento enviado 5 vezes contar como 5 imóveis (dedupe), não o mínimo",
  "src/config/planos.ts": "a própria constante e o comentário do preço (R$ 500 com 20 inclusos) — a fonte do número",
};

test("VARREDURA: nenhuma frase liga 'Gestor' a um número fixo de imóveis (falha se surgir uma)", () => {
  const achados: string[] = [];
  for (const f of arquivos("src/")) {
    if (f in EXCECOES) continue;
    const frases = ler(f).split(/(?<=[.;])\s+|\n/);
    for (const fr of frases) if (/Gestor/.test(fr) && NUMERO_FIXO.test(fr)) achados.push(`${f}: ${fr.trim().slice(0, 140)}`);
  }
  assert.deepEqual(achados, []);
});

test("VARREDURA public/: as páginas estáticas não ligam 'Gestor' a um número fixo nem chamam a faixa 31+ de Plano Gestor", () => {
  // HTML estático não lê a constante: o Gestor não pode vir com número escrito à mão, e a faixa sem teto da taxa é
  // "taxa negociável" (E252-B). Achado da varredura do E236: /apresentacao dizia "31+ imóveis (Plano Gestor)".
  const achados: string[] = [];
  for (const f of readdirSync(new URL("public/", RAIZ)).filter((n) => /\.html?$/.test(n)).map((n) => `public/${n}`)) {
    for (const fr of ler(f).split(/(?<=[.;])\s+|\n/)) {
      if (/Gestor/.test(fr) && (NUMERO_FIXO.test(fr) || /\b31\b/.test(fr))) achados.push(`${f}: ${fr.trim().slice(0, 140)}`);
    }
  }
  assert.deepEqual(achados, []);
  // E564: a tabela da apresentação segue a regra nova (16–19 a 6%; o Plano Gestor a 4%), sem a "31+ negociável".
  assert.match(ler("public/apresentacao.html"), /<span>Plano Gestor<\/span><b>4%<\/b>/);
  assert.doesNotMatch(ler("public/apresentacao.html"), /taxa negociável/);
});

test("os 4 pontos do E236 e a varredura usam GESTOR_PRECO.minimoImoveis", () => {
  for (const f of [
    "src/app/(public)/parceiros/page.tsx",
    "src/components/precos/plano-gestor-form.tsx",
    "src/app/api/plano-gestor/route.ts",
    "src/lib/atendimento/faq.ts",
    "src/lib/atendimento/viva-prompt.ts",
    "src/lib/atendimento/parceiros-texto.ts",
  ])
    // E321/E564: a porta (PORTA_GESTOR_TEXTO) ou o texto das telas (GESTOR_TEXTO) — os dois leem a constante.
    assert.match(ler(f), /GESTOR_PRECO\.minimoImoveis|PORTA_GESTOR_TEXTO|GESTOR_TEXTO/, f);
  assert.match(ler("src/config/planos.ts"), /PORTA_GESTOR_TEXTO = `\$\{GESTOR_PRECO\.minimoImoveis\} imóveis ou mais ativos \(publicados, com documento aprovado e calendário em dia\), ou conta de administradora`/);
  assert.match(ler("src/app/(public)/parceiros/page.tsx"), /Plano Gestor: \$\{GESTOR_TEXTO\}\./);
  // E905 (asserção alterada): o texto ganhou "ou conta de administradora".
  assert.match(ler("src/config/planos.ts"), /GESTOR_TEXTO = `[^`]*% para carteiras de \$\{GESTOR_PRECO\.minimoImoveis\} ou mais imóveis ou conta de administradora, com cadastro assistido da carteira e contato direto na Viva`/);
  const form = ler("src/components/precos/plano-gestor-form.tsx");
  assert.match(form, /title="Plano Gestor"/);
  assert.match(ler("src/app/api/plano-gestor/route.ts"), /subject: `Lead — Plano Gestor \(\$\{GESTOR_PRECO\.minimoImoveis\}\+ imóveis\)`/);
  assert.doesNotMatch(ler("src/app/(dashboard)/dashboard/simulador/page.tsx"), /Gestor \(31\+\)/);
  // /modelodenegocio não lê @/config/planos (guarda dos planos antigos): usa o GESTOR_TEXTO reexportado por lib/planos/gestor.
  assert.match(ler("src/components/modelo-negocio/modelo-negocio.tsx"), /Plano Gestor: \{GESTOR_TEXTO\}\./);
  assert.match(ler("src/components/modelo-negocio/modelo-negocio.tsx"), /from "@\/lib\/planos\/gestor"/);
  assert.match(ler("src/lib/planos/gestor.ts"), /GESTOR_MIN_IMOVEIS_VALIDADOS: number = GESTOR_PRECO\.minimoImoveis;/);
});

test("os textos prontos do Gestor saem da constante (mudam juntos com ela)", () => {
  const taxa = FAQ.map((q) => q.resposta).find((r) => r.includes("Plano Gestor"));
  assert.ok(taxa?.includes(`O Plano Gestor tem taxa de 4%, sem mensalidade, para ${PORTA_GESTOR_TEXTO}`));
  assert.ok(PORTA_GESTOR_TEXTO.startsWith(`${N} imóveis ou mais`));
  assert.ok(EMPRESAS_E_GESTORES.includes(`Plano Gestor, 4% sem mensalidade, para ${PORTA_GESTOR_TEXTO}`));
});

test("E564: a faixa sem teto é a do Plano Gestor — começa no mínimo do Gestor, a 4%; a '31+ negociável' saiu", () => {
  const ultima = FAIXAS_COMISSAO_PADRAO[FAIXAS_COMISSAO_PADRAO.length - 1];
  assert.equal(ultima.minImoveis, GESTOR_PRECO.minimoImoveis);
  assert.equal(ultima.maxImoveis, null);
  assert.equal(ultima.taxa, GESTOR_PRECO.taxa);
  assert.equal(ultima.gestor, true);
  assert.equal(FAIXAS_COMISSAO_PADRAO.some((f) => f.negociavel), false);
  assert.equal(FAIXAS_COMISSAO_PADRAO[FAIXAS_COMISSAO_PADRAO.length - 2].maxImoveis, GESTOR_PRECO.minimoImoveis - 1);
});

test("E564: os rótulos da tabela — a faixa sem teto é 'Plano Gestor' (não mais 'taxa negociável')", async () => {
  const { FAIXAS_COMISSAO_PADRAO: faixas, rotuloFaixaTaxa } = await import("../cobranca/regra.ts");
  assert.deepEqual(faixas.map((f) => rotuloFaixaTaxa(f, true)), ["1–2 imóveis", "3–5 imóveis", "6–15 imóveis", "16–19 imóveis", `${N}+ imóveis · Plano Gestor`]);
  for (const r of faixas.slice(0, -1).map((f) => rotuloFaixaTaxa(f))) assert.doesNotMatch(r, /Gestor|negoci/);
});
