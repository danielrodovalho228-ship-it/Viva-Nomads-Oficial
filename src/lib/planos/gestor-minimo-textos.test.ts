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
import { GESTOR_PRECO } from "../../config/planos.ts";
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

test("os 4 pontos do E236 e a varredura usam GESTOR_PRECO.minimoImoveis", () => {
  for (const f of [
    "src/app/(public)/parceiros/page.tsx",
    "src/components/precos/plano-gestor-form.tsx",
    "src/app/api/plano-gestor/route.ts",
    "src/lib/atendimento/faq.ts",
    "src/lib/atendimento/viva-prompt.ts",
    "src/lib/atendimento/parceiros-texto.ts",
  ])
    assert.match(ler(f), /GESTOR_PRECO\.minimoImoveis/, f);
  assert.match(ler("src/app/(public)/parceiros/page.tsx"), /Plano Gestor para quem tem \$\{GESTOR_PRECO\.minimoImoveis\} ou mais imóveis\./);
  const form = ler("src/components/precos/plano-gestor-form.tsx");
  assert.match(form, /title=\{`Plano Gestor: \$\{GESTOR_PRECO\.minimoImoveis\} imóveis ou mais`\}/);
  assert.match(ler("src/app/api/plano-gestor/route.ts"), /subject: `Lead — Plano Gestor \(\$\{GESTOR_PRECO\.minimoImoveis\}\+ imóveis\)`/);
  assert.doesNotMatch(ler("src/app/(dashboard)/dashboard/simulador/page.tsx"), /Gestor \(31\+\)/);
  // /modelodenegocio não lê @/config/planos (guarda dos planos antigos): usa o alias GESTOR_MIN_IMOVEIS_VALIDADOS = GESTOR_PRECO.minimoImoveis.
  assert.match(ler("src/components/modelo-negocio/modelo-negocio.tsx"), /Plano Gestor a partir de \{GESTOR_MIN_IMOVEIS_VALIDADOS\} imóveis\./);
  assert.match(ler("src/lib/planos/gestor.ts"), /GESTOR_MIN_IMOVEIS_VALIDADOS: number = GESTOR_PRECO\.minimoImoveis;/);
});

test("os textos prontos do Gestor saem da constante (mudam juntos com ela)", () => {
  const taxa = FAQ.map((q) => q.resposta).find((r) => r.includes("Plano Gestor"));
  assert.ok(taxa?.includes(`O Plano Gestor vale a partir de ${N} imóveis`));
  assert.ok(EMPRESAS_E_GESTORES.includes(`Plano Gestor para quem tem ${N} imóveis ou mais`));
});

test("a faixa sem teto da taxa de serviço continua '31+' (outra regra)", () => {
  const ultima = FAIXAS_COMISSAO_PADRAO[FAIXAS_COMISSAO_PADRAO.length - 1];
  assert.equal(ultima.minImoveis, 31);
  assert.equal(ultima.maxImoveis, null);
  assert.match(ler("src/components/modelo-negocio/modelo-negocio.tsx"), /label: f\.maxImoveis === null \? "31\+"/);
  assert.match(ler("src/app/(public)/termos/page.tsx"), /16 a 30, 6%; 31 ou mais, condição negociada\./);
});
