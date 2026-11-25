import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm } from "../fixtures/laboratorio";

/*
  T1570 — E688 (#3478, migração 0333; decisão do Daniel, 08/11): o "Plano de manutenção" volta a "em_breve" em servicos_adicionais (sem a
  saída AquiResolve), de modo que o morador não consegue mais escolher o serviço. Guarda de BANCO no laboratório (todas as migrações aplicadas):
  plano_manutencao e assistencia_24h estão em_breve; nenhum dos dois está ativo. Só no laboratório.
*/
test.describe("T1570 — E688: Plano de manutenção em breve (0333)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");

  test("plano_manutencao e assistencia_24h estão 'em_breve' no catálogo de serviços adicionais", async () => {
    const { data, error } = await adm().from("servicos_adicionais").select("id, status").in("id", ["plano_manutencao", "assistencia_24h"]);
    expect(error, JSON.stringify(error)).toBeNull();
    const por = Object.fromEntries((data ?? []).map((r) => [r.id as string, r.status as string]));
    expect(por.plano_manutencao, "Plano de manutenção").toBe("em_breve");
    expect(por.assistencia_24h, "Assistência 24h").toBe("em_breve");
  });

  test("nenhum serviço 'em_breve' fica selecionável: o catálogo não mistura os dois estados no mesmo id", async () => {
    const { data } = await adm().from("servicos_adicionais").select("id, status").eq("id", "plano_manutencao");
    expect(data?.length).toBe(1);
    expect(data?.[0].status).not.toBe("ativo");
  });
});
