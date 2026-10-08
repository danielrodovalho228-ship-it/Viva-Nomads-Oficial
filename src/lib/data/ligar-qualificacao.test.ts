/*
  Ligação da qualificação à espera ao rascunho/imóvel (P0 08/10: documento enviado
  aparecia como "Não enviado"). node --test (sem alias @).
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import { ligarQualificacaoAoImovel } from "./ligar-qualificacao.ts";

type Linha = { id: string; owner_id: string; property_id: string | null; created_at: string };

/** Cliente falso mínimo: encadeia filtros e aplica select/update numa lista em memória. */
function falso(linhas: Linha[]) {
  return {
    from() {
      const filtros: Array<(l: Linha) => boolean> = [];
      let ordem = false;
      let patch: Partial<Linha> | null = null;
      const q = {
        select: () => q,
        update: (p: Partial<Linha>) => ((patch = p), q),
        eq: (c: keyof Linha, v: string) => (filtros.push((l) => l[c] === v), q),
        is: (c: keyof Linha, v: null) => (filtros.push((l) => l[c] === v), q),
        order: () => ((ordem = true), q),
        limit: () => q,
        maybeSingle: async () => {
          const achadas = linhas.filter((l) => filtros.every((f) => f(l)));
          if (ordem) achadas.sort((a, b) => b.created_at.localeCompare(a.created_at));
          return { data: achadas[0] ?? null, error: null };
        },
        then: (res: (v: { error: null }) => void) => {
          if (patch) for (const l of linhas.filter((x) => filtros.every((f) => f(x)))) Object.assign(l, patch);
          res({ error: null });
        },
      };
      return q;
    },
  };
}

test("liga a qualificação mais recente sem imóvel ao rascunho do mesmo dono", async () => {
  const linhas: Linha[] = [
    { id: "velha", owner_id: "dono", property_id: null, created_at: "2026-10-08T20:00:00Z" },
    { id: "nova", owner_id: "dono", property_id: null, created_at: "2026-10-08T20:51:00Z" },
  ];
  assert.equal(await ligarQualificacaoAoImovel(falso(linhas), "dono", "imovel-1"), true);
  assert.equal(linhas.find((l) => l.id === "nova")?.property_id, "imovel-1");
  assert.equal(linhas.find((l) => l.id === "velha")?.property_id, null);
});

test("não liga a qualificação de outro dono (caso negativo)", async () => {
  const linhas: Linha[] = [{ id: "alheia", owner_id: "outro", property_id: null, created_at: "2026-10-08T20:51:00Z" }];
  assert.equal(await ligarQualificacaoAoImovel(falso(linhas), "dono", "imovel-1"), false);
  assert.equal(linhas[0].property_id, null);
});

test("imóvel que já tem qualificação não ganha outra", async () => {
  const linhas: Linha[] = [
    { id: "dele", owner_id: "dono", property_id: "imovel-1", created_at: "2026-10-08T20:00:00Z" },
    { id: "espera", owner_id: "dono", property_id: null, created_at: "2026-10-08T20:51:00Z" },
  ];
  assert.equal(await ligarQualificacaoAoImovel(falso(linhas), "dono", "imovel-1"), false);
  assert.equal(linhas[1].property_id, null);
});
