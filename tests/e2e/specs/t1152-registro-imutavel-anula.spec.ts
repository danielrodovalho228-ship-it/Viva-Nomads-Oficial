import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { NO_LABORATORIO, adm, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1152 — #2610 (05/11): os rollbacks 0260, 0261 e 0268 ANULAM o registro em vez de apagar, porque documentos_registro
 * é imutável (gatilho documentos_registro_imutavel, 0201). O teste de unidade (tests/migracoes/rollback-registro-
 * imutavel.test.ts) confere o texto dos scripts; aqui é a prova no banco do laboratório do que eles pressupõem, com dois
 * documentos de teste (is_teste, ref inventada) registrados pela função única registrar_documento:
 *   1. DELETE no registro é barrado ("Documento registrado não pode ser apagado.") e a linha continua lá;
 *   2. o UPDATE dos rollbacks (status 'anulado' com motivo, só onde status = 'valido') passa e grava o motivo;
 *   3. rodar o rollback de novo não reanula nada: o filtro
 *      status = 'valido' faz o UPDATE repetido não tocar linha nenhuma, e mexer no anulado é recusado ("só muda uma vez");
 *   4. anular sem motivo (menos de 5 caracteres) é recusado pela regra da tabela.
 * Os dois documentos ficam no laboratório, anulados — o registro não apaga, por desenho.
 */
const sufixo = novoSufixo();
const MOTIVO = `Massa de teste da t1152 removida (rollback ${sufixo}).`;

async function registrar(numero: string): Promise<string> {
  const { data, error } = await adm().rpc("registrar_documento", {
    p_prefixo: "ORC",
    p_tipo: "orcamento_teste",
    p_numero: numero,
    p_ref_tabela: "parceiro_pedidos",
    p_ref_id: randomUUID(),
    p_hash: null,
    p_codigo: null,
    p_partes: [],
    p_is_teste: true,
  });
  expect(error, error?.message).toBeNull();
  return (data as { id: string }[])[0].id;
}

test.describe("T1152 — #2610: o registro de documentos não apaga; o rollback anula com motivo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  const ids: { a?: string; b?: string } = {};

  test.beforeAll(async () => {
    ids.a = await registrar(`ORC-T1152-A-${sufixo}`);
    ids.b = await registrar(`ORC-T1152-B-${sufixo}`);
  });

  test("1. DELETE no registro é barrado e a linha fica", async () => {
    const { error } = await adm().from("documentos_registro").delete().eq("id", ids.a!);
    expect(error?.message ?? "").toContain("não pode ser apagado");
    const { data } = await adm().from("documentos_registro").select("id, status").eq("id", ids.a!).single();
    expect(data).toEqual({ id: ids.a, status: "valido" });
  });

  test("2. o UPDATE do rollback anula o válido com o motivo", async () => {
    const { data, error } = await adm()
      .from("documentos_registro")
      .update({ status: "anulado", anulado_motivo: MOTIVO })
      .eq("id", ids.a!)
      .eq("status", "valido")
      .select("status, anulado_motivo");
    expect(error, error?.message).toBeNull();
    expect(data).toEqual([{ status: "anulado", anulado_motivo: MOTIVO }]);
  });

  test("3. rodar de novo não reanula: o filtro 'valido' não acha nada, e anular o anulado é recusado", async () => {
    const repetido = await adm().from("documentos_registro").update({ status: "anulado", anulado_motivo: MOTIVO }).eq("id", ids.a!).eq("status", "valido").select("id");
    expect(repetido.error, repetido.error?.message).toBeNull();
    expect(repetido.data).toEqual([]);
    const { error } = await adm().from("documentos_registro").update({ status: "anulado", anulado_motivo: `${MOTIVO} 2` }).eq("id", ids.a!);
    expect(error?.message ?? "").toMatch(/só muda uma vez|já está anulado/);
  });

  test("4. anular sem motivo é recusado; com motivo, passa", async () => {
    const sem = await adm().from("documentos_registro").update({ status: "anulado", anulado_motivo: "x" }).eq("id", ids.b!);
    expect(sem.error, "motivo com menos de 5 caracteres").not.toBeNull();
    const { data } = await adm().from("documentos_registro").select("status").eq("id", ids.b!).single();
    expect(data?.status).toBe("valido");
    const com = await adm().from("documentos_registro").update({ status: "anulado", anulado_motivo: MOTIVO }).eq("id", ids.b!).eq("status", "valido");
    expect(com.error, com.error?.message).toBeNull();
  });
});
