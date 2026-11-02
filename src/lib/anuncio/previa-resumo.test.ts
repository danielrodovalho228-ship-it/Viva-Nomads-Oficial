/* Roda: node --test src/lib/anuncio/previa-resumo.test.ts — conformidade do cadastro (mockup cadastro-imovel-09,
   01/11): a prévia do Passo 9 fecha com "Resumo: Disponível a partir de 12/11 · Mínimo 30 dias". */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resumoDisponibilidadePrevia } from "./assistente-telas.ts";

test("resumo da disponibilidade (mesma regra de data da página do imóvel)", () => {
  assert.equal(resumoDisponibilidadePrevia("2026-11-12", "30", "2026-11-01"), "Resumo: Disponível a partir de 12/11 · Mínimo 30 dias");
  assert.equal(resumoDisponibilidadePrevia("", 60, "2026-11-01"), "Resumo: Disponível agora · Mínimo 60 dias");
  assert.equal(resumoDisponibilidadePrevia("2026-10-01", "90", "2026-11-01"), "Resumo: Disponível agora · Mínimo 90 dias");
  assert.equal(resumoDisponibilidadePrevia("2026-11-12", "", "2026-11-01"), "Resumo: Disponível a partir de 12/11");
});

test("o resumo só entra na prévia do Passo 9", () => {
  const pagina = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/page.tsx", import.meta.url), "utf8");
  assert.match(pagina, /resumo=\{step === ETAPA\.disponibilidade \? resumoDisponibilidadePrevia\(availableFrom, minPeriod, hojeBR\(\)\) : null\}/);
  const previa = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/previa-anuncio.tsx", import.meta.url), "utf8");
  assert.match(previa, /\{p\.resumo && \(\n\s*<p className="mt-3 text-sm text-ink" data-testid="previa-resumo">/);
});
