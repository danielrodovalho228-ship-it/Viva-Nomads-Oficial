/*
  Resíduo da varredura ampla: a leitura "o imóvel já tem qualificação?" com erro nunca liga outra qualificação à espera.
  Teste de comportamento com cliente falso: a 1ª leitura (property_id = imóvel) devolve erro.
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import { ligarQualificacaoAoImovel } from "./ligar-qualificacao.ts";

type Linha = { id: string; owner_id: string; property_id: string | null; created_at: string; document_path: string | null };

function falsoComErroNaLeituraDoImovel(linhas: Linha[], imovel: string) {
  return {
    from() {
      const filtros: Array<(l: Linha) => boolean> = [];
      let lendoDoImovel = false;
      let patch: Partial<Linha> | null = null;
      const q = {
        select: () => q,
        update: (p: Partial<Linha>) => ((patch = p), q),
        eq: (c: keyof Linha, v: string) => {
          if (c === "property_id" && v === imovel && !patch) lendoDoImovel = true;
          filtros.push((l) => l[c] === v);
          return q;
        },
        is: (c: keyof Linha, v: null) => (filtros.push((l) => l[c] === v), q),
        order: () => q,
        limit: () => q,
        maybeSingle: async () => {
          if (lendoDoImovel) return { data: null, error: { message: "falha simulada" } };
          const achadas = linhas.filter((l) => filtros.every((f) => f(l)));
          achadas.sort((a, b) => b.created_at.localeCompare(a.created_at));
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

test("leitura com erro: nada é ligado ao imóvel (que pode já ter a sua qualificação)", async () => {
  const linhas: Linha[] = [
    { id: "dele", owner_id: "dono", property_id: "imovel-1", created_at: "2026-10-08T20:00:00Z", document_path: "a.pdf" },
    { id: "espera", owner_id: "dono", property_id: null, created_at: "2026-10-08T20:51:00Z", document_path: "b.pdf" },
  ];
  assert.equal(await ligarQualificacaoAoImovel(falsoComErroNaLeituraDoImovel(linhas, "imovel-1"), "dono", "imovel-1"), false);
  assert.equal(linhas.find((l) => l.id === "espera")?.property_id, null);
});
