/**
 * E553 (parte VISUAL, chat principal 04/11): no cartão do candidato em Interessados (/dashboard/leads), a foto (ou o
 * avatar neutro) e o nome abrem o perfil completo do candidato (/dashboard/leads/<id>, rota da Pista B, #2564), no
 * mesmo padrão dos títulos clicáveis do painel (Meus imóveis: texto tinta, verde ao passar). O link só aparece para
 * candidaturas reais (id UUID): no modo demonstração o perfil não existe. `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cli = readFileSync(new URL("../../app/(dashboard)/dashboard/leads/leads-client.tsx", import.meta.url), "utf8");

test("o cartão usa a rota da Pista B (hrefPerfilCandidato), só para candidatura real", () => {
  assert.match(cli, /import \{ hrefPerfilCandidato \} from "@\/lib\/notifications\/dados-candidatura";/);
  assert.match(cli, /const perfilHref = !demoOn && UUID_CANDIDATURA\.test\(l\.id\) \? hrefPerfilCandidato\(l\.id\) : null;/);
});

test("o nome é link no padrão do painel (tinta, verde ao passar) e a foto abre o mesmo perfil", () => {
  assert.match(cli, /<Link href=\{perfilHref\} className="alvo-toque hover:text-forest focus-visible:text-forest" data-testid="candidato-perfil-link">\s*\{l\.name\}\s*<\/Link>/);
  assert.match(cli, /<Link href=\{perfilHref\} tabIndex=\{-1\} aria-hidden className="shrink-0 rounded-full" data-testid="candidato-perfil-foto">/);
});
