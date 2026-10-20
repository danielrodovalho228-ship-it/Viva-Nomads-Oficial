/*
  Guarda (Prompt 35A, item 3): nenhuma promessa de "em breve" ligada à VERIFICAÇÃO DE IDENTIDADE nas páginas
  públicas (src/app/(public)) nem nos componentes do imóvel (src/components/property). O cartão de candidatura fica
  só com o que existe hoje.
  Um "em breve" conta como ligado à verificação quando a linha dele, ou uma das 2 anteriores (pergunta de FAQ,
  título), fala em verificação ou identidade. Exceções ficam AQUI, em código, com o motivo.
  Roda: node --test src/app/promessa-em-breve.test.ts
*/
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = new URL("../../", import.meta.url).pathname;
const PASTAS = ["src/app/(public)", "src/components/property"];

/** Exceções: arquivo + trecho exato da linha do "em breve". */
export const EXCECOES: { arquivo: string; trecho: string; motivo: string }[] = [
  // Decisão do Daniel: o pagamento pela plataforma ainda vem (não é verificação, mas fica explícito aqui).
  { arquivo: "*", trecho: "Pagamento pela plataforma em breve", motivo: "decisão do Daniel" },
  // Textos jurídicos: não se mexe em /termos e /privacidade fora de uma revisão jurídica.
  { arquivo: "src/app/(public)/termos/page.tsx", trecho: "Verificação de inquilinos (em breve)", motivo: "texto jurídico (/termos)" },
  { arquivo: "src/app/(public)/privacidade/page.tsx", trecho: "Verificação de identidade do inquilino (em breve)", motivo: "texto jurídico (/privacidade)" },
  // Páginas institucionais que explicam o que ainda NÃO existe (não prometem no fluxo de candidatura). Fora do
  // escopo do 35A: se o Daniel decidir tirar, saem daqui junto.
  { arquivo: "src/app/(public)/seguranca/page.tsx", trecho: "A verificação de identidade do inquilino chega em breve.", motivo: "FAQ institucional" },
  { arquivo: "src/app/(public)/seguranca/page.tsx", trecho: "Em breve — ainda não está disponível.", motivo: "FAQ institucional" },
  { arquivo: "src/app/(public)/como-funciona/page.tsx", trecho: "A verificação de identidade chega em breve.", motivo: "passo a passo institucional" },
  { arquivo: "src/app/(public)/para-proprietarios/page.tsx", trecho: "Verificação de identidade do inquilino — em breve.", motivo: "lista de benefícios" },
];

function arquivos(dir: string): string[] {
  const out: string[] = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) out.push(...arquivos(p));
    else if (/\.(tsx?|mdx?)$/.test(nome) && !/\.test\.ts$/.test(nome)) out.push(p);
  }
  return out;
}

/** Ocorrências de "em breve" ligadas a verificação/identidade, fora das exceções. */
export function promessasDeVerificacao(arquivo: string, texto: string): string[] {
  const linhas = texto.split("\n");
  const achados: string[] = [];
  linhas.forEach((linha, i) => {
    if (!/em breve/i.test(linha)) return;
    const janela = linhas.slice(Math.max(0, i - 2), i + 1).join(" ");
    if (!/verifica|identidade/i.test(janela)) return;
    const excecao = EXCECOES.some((e) => (e.arquivo === "*" || e.arquivo === arquivo) && linha.includes(e.trecho));
    if (!excecao) achados.push(`${arquivo}:${i + 1}: ${linha.trim()}`);
  });
  return achados;
}

test("nenhum \"em breve\" de verificação de identidade em página pública ou no cartão do imóvel", () => {
  const achados: string[] = [];
  for (const pasta of PASTAS) {
    for (const a of arquivos(join(RAIZ, pasta))) {
      achados.push(...promessasDeVerificacao(relative(RAIZ, a), readFileSync(a, "utf8")));
    }
  }
  assert.deepEqual(achados, [], `Promessa de "em breve" ligada à verificação:\n${achados.join("\n")}`);
});

test("a guarda pega as duas frases removidas e respeita as exceções", () => {
  assert.equal(
    promessasDeVerificacao("src/components/property/price-card.tsx", "<strong>Verificação de identidade: em breve.</strong> Por enquanto, candidate-se direto pela plataforma.").length,
    1
  );
  assert.equal(
    promessasDeVerificacao("src/app/(public)/imoveis/[id]/property-detail.tsx", "<ShieldCheck />\n<span>\n<strong>Verificação de identidade: em breve.</strong> Complete seu perfil").length,
    1
  );
  assert.deepEqual(promessasDeVerificacao("x.tsx", "Verificação concluída.\nPagamento pela plataforma em breve"), []);
  // "em breve" sem verificação por perto não conta.
  assert.deepEqual(promessasDeVerificacao("x.tsx", "Em breve, imóveis em Uberlândia"), []);
});

test("as duas frases do 35A sumiram do código", () => {
  const card = readFileSync(join(RAIZ, "src/components/property/price-card.tsx"), "utf8");
  const detalhe = readFileSync(join(RAIZ, "src/app/(public)/imoveis/[id]/property-detail.tsx"), "utf8");
  assert.doesNotMatch(card, /Verificação de identidade: em breve/);
  assert.doesNotMatch(card, /candidate-se direto pela plataforma/);
  assert.doesNotMatch(detalhe, /Verificação de identidade: em breve/);
  assert.doesNotMatch(detalhe, /Complete seu perfil enquanto isso/);
});
