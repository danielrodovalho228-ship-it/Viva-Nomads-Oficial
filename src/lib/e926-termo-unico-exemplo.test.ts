/* Roda: node --test src/lib/e926-termo-unico-exemplo.test.ts
   E926 (Phoenix, RELATORIO-045, A-259, 14/11/2026): a mesma página usava dois nomes para o anúncio de exemplo — o cartão dizia
   "Anúncio de exemplo" e a página do imóvel, "Exemplo ilustrativo". A varredura achou um terceiro: "Anúncio de demonstração", no
   aviso do bloco do proprietário e do perfil de exemplo.
   Termo único em TODAS as superfícies: "Anúncio de exemplo" (o estabelecido, o dos cartões). Trava: o termo sai de uma constante só
   (SELO_EXEMPLO) e nenhum arquivo de produção escreve os nomes antigos. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { AVISO_EXEMPLO, SELO_EXEMPLO } from "../config/exemplo-proprietarios.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const TERMO = "Anúncio de exemplo";
/** Os nomes que saíram: "Exemplo ilustrativo" e "Anúncio(s) de demonstração", em qualquer caixa. */
const NOMES_ANTIGOS = /exemplo ilustrativo|an[úu]ncios? de demonstra[çc][ãa]o/i;

function arquivosDeProducao(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) arquivosDeProducao(p, out);
    else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}

test("E926: o termo único é 'Anúncio de exemplo', numa constante só", () => {
  assert.equal(SELO_EXEMPLO, TERMO);
  // O aviso que acompanha o selo usa o mesmo termo (antes: "Anúncio de demonstração: …").
  assert.equal(AVISO_EXEMPLO, "Anúncio de exemplo: nos anúncios reais estes dados vêm do perfil e das estadias verificadas.");
  assert.match(ler("src/components/property/selo-exemplo.tsx"), /\{SELO_EXEMPLO\}/);
});

test("E926: nenhum arquivo de produção escreve 'Exemplo ilustrativo' nem 'Anúncio de demonstração' (tela, mensagem ou comentário)", () => {
  const achados: string[] = [];
  for (const f of arquivosDeProducao("src")) {
    ler(f)
      .split("\n")
      .forEach((l, i) => {
        if (NOMES_ANTIGOS.test(l)) achados.push(`${f}:${i + 1} ${l.trim().slice(0, 90)}`);
      });
  }
  assert.deepEqual(achados, []);
  // O teste pega os dois nomes antigos de verdade.
  assert.match("Exemplo ilustrativo", NOMES_ANTIGOS);
  assert.match("Este é um anúncio de demonstração", NOMES_ANTIGOS);
  assert.doesNotMatch("Anúncio de exemplo: serve para você ver como a Viva funciona.", NOMES_ANTIGOS);
});

test("E926: as superfícies varridas mostram o mesmo termo do cartão", () => {
  // Cartão (busca, home, cidade, favoritos, painel…): o termo estabelecido, escrito uma vez.
  const cartao = ler("src/components/property-card.tsx");
  const noCartao = [...cartao.matchAll(/>\s*(Anúncio de exemplo)\s*</g)].map((m) => m[1]);
  assert.deepEqual(noCartao, [SELO_EXEMPLO], "o termo do cartão é o da constante");
  // Página do imóvel: o selo ao lado da nota (topo) sai da constante; a faixa do proprietário, as avaliações e o bloco
  // "Sobre o proprietário" usam o componente SeloExemplo, que escreve a mesma constante.
  const pagina = ler("src/app/(public)/imoveis/[id]/property-detail.tsx");
  assert.match(pagina, /data-testid="selo-exemplo-topo"[^>]*>\s*\{SELO_EXEMPLO\}/);
  for (const f of ["src/components/property/faixa-proprietario.tsx", "src/components/property/owner-card.tsx", "src/components/property/avaliacoes-exemplo.tsx", "src/app/(public)/proprietario/[id]/perfil-exemplo.tsx"]) {
    assert.match(ler(f), /<SeloExemplo\b/, `${f} usa o selo único`);
  }
  // Listas do painel (linha do imóvel): o mesmo termo, pela constante.
  assert.match(ler("src/components/dashboard/property-row.tsx"), /\{SELO_EXEMPLO\}/);
  // Barra fixa do celular e cartão de preço: frases que já usavam o termo seguem com ele.
  assert.match(ler("src/components/property/price-card.tsx"), /Anúncio de exemplo: serve para você ver como a Viva funciona/);
});

test("E926: o título da aba do perfil de exemplo e a recusa de reserva usam o termo único", () => {
  assert.match(ler("src/app/(public)/proprietario/[id]/page.tsx"), /title: `\$\{ex\.nome\} — proprietário de anúncio de exemplo`/);
  assert.match(ler("src/lib/data/reservas-actions.ts"), /"Este é um anúncio de exemplo — a reserva fica disponível nos imóveis reais\."/);
});
