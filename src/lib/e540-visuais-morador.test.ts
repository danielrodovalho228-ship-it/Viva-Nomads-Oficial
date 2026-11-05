/**
 * E540 (grupo de visuais do painel do morador), os itens localizados:
 *  - "1parceiroem Uberlândia" (busca de parceiros) e "…pelos dois lados.Próximo passo:" (estadia confirmada): as frases
 *    eram montadas em vários nós de texto ({n} {rótulo}{cidade} / {TEXTO} Próximo passo:) — quem lê nó a nó colava as
 *    palavras. Agora cada frase é UM texto só, com os espaços dentro;
 *  - a foto do cartão "Para suas estadias" em Conta › Pagamentos era um arquivo de placeholder de imóvel
 *    (placeholder-imovel-sala.webp): agora a foto própria de pagamentos (cf-pagamentos.webp), com a prévia gerada.
 * `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PHOTOS } from "./media.ts";
import { PREVIAS_FOTOS } from "./previas-fotos.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("busca de parceiros: a contagem é uma frase só", () => {
  const pg = ler("app/(public)/parceiros/buscar/page.tsx");
  assert.match(pg, /\{`\$\{r\.lista\.length\} \$\{r\.lista\.length === 1 \? "parceiro" : "parceiros"\}\$\{r\.cidade \? ` em \$\{r\.cidade\}` : ""\}`\}/);
});

test("estadia confirmada: 'pelos dois lados. Próximo passo:' é uma frase só", () => {
  const pg = ler("app/(dashboard)/dashboard/estadia/[contratoId]/confirmada/page.tsx");
  assert.match(pg, /\{`\$\{TEXTO_CONFIRMADA\} Próximo passo:`\}/);
  assert.doesNotMatch(pg, /^\s*\{TEXTO_CONFIRMADA\} Próximo passo:/m);
});

test("Pagamentos: a foto do morador é a de pagamentos (não um placeholder), com prévia", () => {
  assert.equal(PHOTOS.pagamentos.morador, "/images/unicas/cf-pagamentos.webp");
  for (const f of Object.values(PHOTOS.pagamentos)) {
    assert.doesNotMatch(f, /placeholder/, f);
    assert.ok(PREVIAS_FOTOS[f], `prévia de ${f}`);
  }
});
