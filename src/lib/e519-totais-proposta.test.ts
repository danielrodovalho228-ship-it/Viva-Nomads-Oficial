/*
  E519 — os totais da proposta divergiam sem explicação: o painel do anúncio dizia "R$ 8.900 em 2 meses" (aluguel +
  preparação R$ 450 + saída R$ 250, por estadiaDoImovel) e o passo 1 da proposta dizia "Total da estadia R$ 8.200 em
  2 meses" (só o mês × meses, totalDoPeriodo), sem rótulo para os R$ 700. Agora a proposta usa a MESMA estadiaDoImovel
  do painel, com a conta aberta, e os rótulos da casa (Mensal · Total por mês (com contas) · Total do contrato).
  Roda: node --test src/lib/e519-totais-proposta.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resumoSolicitacao } from "./reserva-imovel.ts";
import { formatBRL } from "./utils.ts";

const v = (r: ReturnType<typeof resumoSolicitacao>, k: string) => r.linhas.find((l) => l.rotulo === k)?.valor;

test("com a estadia do imóvel, o total do contrato é o do painel (R$ 8.900) e a conta mostra os R$ 700", () => {
  const conta = `2 × ${formatBRL(4100)} + limpeza de preparação ${formatBRL(450)} + limpeza de saída ${formatBRL(250)}`;
  const r = resumoSolicitacao({
    monthlyPrice: 4100, hoje: "2026-11-04", totalMensal: 4100,
    inicioDesejado: "2026-11-10", fimDesejado: "2027-01-09",
    estadia: { meses: 2, total: 8900, conta },
  });
  assert.equal(v(r, "Mensal"), formatBRL(4100));
  assert.equal(v(r, "Total por mês (com contas)"), formatBRL(4100));
  assert.equal(v(r, "Total do contrato"), `${formatBRL(8900)} em 2 meses`);
  assert.equal(v(r, "Conta do total"), `${conta} = ${formatBRL(8900)}`);
  assert.equal(v(r, "Total da estadia"), undefined);
});

test("sem a estadia do imóvel, o total segue a conta do mês (sem inventar taxa)", () => {
  const r = resumoSolicitacao({ monthlyPrice: 2400, hoje: "2026-10-24", totalMensal: 2750, inicioDesejado: "2026-11-24", fimDesejado: "2027-02-22" });
  assert.equal(v(r, "Total do contrato"), `${formatBRL(8250)} em 3 meses`);
});

test("a tela: o diálogo passa a estadiaDoImovel (a mesma do painel) e mostra a conta no Revisar", () => {
  const pd = readFileSync("src/app/(public)/imoveis/[id]/property-detail.tsx", "utf8");
  // E562 (telas): a estadia vai em dias exatos (estadiaDoImovelEmDias), a regra única da proposta.
  assert.match(pd, /estadiaDias: estadiaSelecao/);
  assert.match(pd, /LINHAS_REVISAR\.has\(l\.rotulo\) \|\| l\.rotulo\.startsWith\("Total da estadia \("\)/);
  assert.match(pd, /const LINHAS_REVISAR = new Set\(\["Motivo da estadia", "Mensal", "Total por mês \(com contas\)", "Total do contrato", "Conta do total"\]\);/);
  const card = readFileSync("src/components/property/price-card.tsx", "utf8");
  // E756 (reprovado ao vivo em 11/11/2026, devolvido à Pista B; vigia 12/11: regra única de composição em todas as superfícies): a mesma função também com 1 mês.
  assert.match(card, /estadiaDoImovel\(property, Math\.max\(1, meses\)\)/);
});
