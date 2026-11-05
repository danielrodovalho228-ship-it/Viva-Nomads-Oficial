/* Roda: node --test src/lib/ganhos-dono.test.ts — E176: subaba "Ganhos" de Contratos. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ganhosDoDono } from "./ganhos-dono.ts";
import type { ItemCarteira } from "./carteira-dono.ts";

const item = (p: Partial<ItemCarteira>): ItemCarteira => ({
  propertyId: "p", titulo: "Studio", bairro: "Centro", situacao: "vago", valorMensal: 0, inicio: null, fim: null, diasAteFim: null, morador: null, contratoId: null, contratoNumero: null, ...p,
});

test("soma o valor mensal em vigência e o contratado a começar; vago fica de fora", () => {
  const g = ganhosDoDono([
    item({ propertyId: "a", situacao: "ocupado", valorMensal: 3200, inicio: "2026-09-01", contratoId: "c1" }),
    item({ propertyId: "b", situacao: "reservado", valorMensal: 2800, inicio: "2026-11-10", contratoId: "c2" }),
    item({ propertyId: "c", situacao: "vago" }),
  ]);
  assert.equal(g.vigencia, 3200);
  assert.equal(g.aComecar, 2800);
  assert.deepEqual(g.linhas.map((l) => l.propertyId), ["a", "b"]);
});

test("sem contrato: lista vazia (a tela mostra o estado vazio)", () => {
  assert.deepEqual(ganhosDoDono([item({})]), { vigencia: 0, aComecar: 0, linhas: [] });
});

// E545: "Contratado a começar R$ 0" com vários "Aguardando 1º pagamento" — os contratos estavam em anúncios PAUSADOS
// (a carteira só lê anúncios ativos) ou atrás de um contrato em vigência no mesmo imóvel (a carteira mostra um por
// imóvel). Ganhos passa a ler um contrato por linha.
import { itensDeGanhos } from "./ganhos-dono.ts";
import { readFileSync } from "node:fs";

const contrato = (id: string, propertyId: string, etapa: string, valorMensal: number, inicio: string) => ({
  id, propertyId, status: "ativo", etapa: etapa as never, valorMensal, blocos: [{ inicio, fim: "2027-03-01" }], morador: null, selo: null,
});

test("E545: soma todos os contratos a começar — anúncio pausado e próximo morador do mesmo imóvel entram", () => {
  const imoveis = [{ id: "pausado", titulo: "Pausado", bairro: "" }, { id: "ocupado", titulo: "Ocupado", bairro: "" }];
  const g = ganhosDoDono(
    itensDeGanhos(
      imoveis,
      [
        contrato("c1", "pausado", "aguardando_primeiro_pagamento", 3200, "2026-11-10"),
        contrato("c2", "ocupado", "em_vigencia", 3000, "2026-10-01"),
        contrato("c3", "ocupado", "aguardando_primeiro_pagamento", 3600, "2026-12-10"),
        { ...contrato("c4", "pausado", "em_vigencia", 900, "2026-09-01"), status: "encerrado_sem_renovacao" },
      ],
      "2026-11-05",
    ),
  );
  assert.equal(g.aComecar, 6800);
  assert.equal(g.vigencia, 3000);
  assert.deepEqual(g.linhas.map((l) => l.contratoId), ["c2", "c1", "c3"]);
});

test("E545: a tela Ganhos lê os contratos (getGanhosDoDono), não a carteira de anúncios ativos", () => {
  const pagina = readFileSync(new URL("../app/(dashboard)/dashboard/ganhos/page.tsx", import.meta.url), "utf8");
  assert.match(pagina, /ganhosDoDono\(isSupabaseConfigured\(\) \? await getGanhosDoDono\(undefined, \{ exigir: true \}\) : \[\]\)/);
  assert.doesNotMatch(pagina, /getCarteiraDoDono/);
});
