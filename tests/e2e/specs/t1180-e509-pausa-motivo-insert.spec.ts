import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1180 — E509 (#2696, migração 0300, 05/11): "Pausado" com o mesmo comportamento em todos os cartões. O gatilho de
 * coerência da pausa (0223) só rodava no UPDATE: anúncio INSERIDO já pausado ficava sem motivo, e Meus imóveis lia o
 * motivo vazio como pausa da Viva (selo sem menu) ao lado dos pausados pelo dono (com "Reativar"). A 0300 faz o gatilho
 * rodar também no INSERT. O E509 entrou com teste de migração (texto do SQL); aqui é a prova no banco do laboratório:
 *   1. anúncio inserido já pausado e SEM motivo nasce com pausa_motivo = 'admin' (pausa da Viva), nunca nulo;
 *   2. anúncio inserido pausado COM motivo 'dono' mantém 'dono' (o gatilho não sobrescreve);
 *   3. anúncio inserido como rascunho segue sem motivo de pausa.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1180.${sufixo}@lab.vivanomads.test`, nome: "Paula Pausa", role: "owner" as const };
const ids: { dono?: string } = {};

const anuncio = (titulo: string, extra: Record<string, unknown>) => ({
  owner_id: ids.dono,
  title: `${titulo} ${sufixo}`,
  description: "Imóvel de teste do laboratório: mobiliado, com home office, internet e cozinha completa. Pronto para morar.",
  property_type: "Studio",
  address: "Centro",
  city: "Uberlândia",
  state: "MG",
  bedrooms: 1,
  bathrooms: 1,
  area_m2: 40,
  max_guests: 2,
  min_period_days: 30,
  max_period_days: 180,
  monthly_price: 3200,
  garantias_aceitas: ["caucao"],
  ...extra,
});

async function inserir(titulo: string, extra: Record<string, unknown>) {
  const { data, error } = await adm().from("properties").insert(anuncio(titulo, extra)).select("status, pausa_motivo").single();
  expect(error, error?.message).toBeNull();
  return data as { status: string; pausa_motivo: string | null };
}

test.describe("T1180 — E509: anúncio pausado nunca nasce sem motivo (gatilho também no INSERT)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.dono) await adm().from("properties").delete().eq("owner_id", ids.dono);
    await apagarContas([ids.dono]);
  });

  test("1. inserido pausado sem motivo nasce com a pausa da Viva ('admin')", async () => {
    const r = await inserir("Pausado sem motivo", { status: "paused" });
    expect(r.status).toBe("paused");
    expect(r.pausa_motivo).toBe("admin");
  });

  test("2. inserido pausado pelo dono mantém 'dono'", async () => {
    const r = await inserir("Pausado pelo dono", { status: "paused", pausa_motivo: "dono" });
    expect(r.pausa_motivo).toBe("dono");
  });

  test("3. inserido como rascunho segue sem motivo de pausa", async () => {
    const r = await inserir("Rascunho", { status: "draft" });
    expect(r.pausa_motivo).toBeNull();
  });
});
