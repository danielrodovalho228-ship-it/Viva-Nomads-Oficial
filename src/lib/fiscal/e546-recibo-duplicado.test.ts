/*
  E546 — recibos em duplicidade: REC-2026-000004 e REC-2026-000005 (mesma data, imóvel, morador, R$ 6.400) somavam no
  resumo do mês (R$ 12.800). O par vinha de dois pagamentos da MESMA estadia em contratos refeitos (CT-D9C70197,
  encerrado, e CT-11281A61). 0295 anula o REC-2026-000005 como a caução gêmea CAU-2026-000002; a guarda impede a emissão
  de um recibo igual a um válido.
  Roda: node --test src/lib/fiscal/e546-recibo-duplicado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { duplicidadeDeRecibo, MOTIVO_DUPLICIDADE } from "./duplicidade.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const REC4 = { numero: "REC-2026-000004", ownerId: "dono", tenantId: "lucas", imovelEndereco: "Saraiva, Uberlândia", valor: 6400, periodoInicio: "2026-10-18", periodoFim: "2026-12-16" };
const NOVO5 = { ownerId: "dono", tenantId: "lucas", imovelEndereco: "Saraiva, Uberlândia", valor: 6400, periodoInicio: "2026-10-12", periodoFim: "2026-12-10" };

test("o caso de 19/10: o 2º recibo da mesma estadia é duplicidade do REC-2026-000004", () => {
  assert.equal(duplicidadeDeRecibo(NOVO5, [REC4])?.numero, "REC-2026-000004");
});

test("não é duplicidade: outro bloco (período seguinte), outro valor, outro morador ou outro imóvel", () => {
  assert.equal(duplicidadeDeRecibo({ ...NOVO5, periodoInicio: "2026-12-17", periodoFim: "2027-02-14" }, [REC4]), null);
  assert.equal(duplicidadeDeRecibo({ ...NOVO5, valor: 3200 }, [REC4]), null);
  assert.equal(duplicidadeDeRecibo({ ...NOVO5, tenantId: "ana" }, [REC4]), null);
  assert.equal(duplicidadeDeRecibo({ ...NOVO5, imovelEndereco: "Centro, Uberlândia" }, [REC4]), null);
  assert.equal(duplicidadeDeRecibo(NOVO5, []), null);
});

test("a emissão confere a duplicidade contra os documentos VÁLIDOS antes de reservar o número", () => {
  const src = ler("src/lib/fiscal/emitir.ts");
  const i = src.indexOf("E546: um recibo/comprovante igual");
  assert.ok(i > 0);
  assert.ok(i < src.indexOf("registrarDocumento(admin, {"), "a guarda vem antes do número");
  assert.match(src.slice(i, i + 1500), /\.is\("anulado_em", null\)/);
  assert.match(src.slice(i, i + 2500), /if \(repetido\) return \{ ok: false, motivo: `\$\{MOTIVO_DUPLICIDADE\}: igual ao \$\{repetido\.numero\}` \};/);
  assert.equal(MOTIVO_DUPLICIDADE, "registro em duplicidade");
});

test("0295: anula o REC-2026-000005 (pagamento, documento fiscal e registro), só em conta de teste; aplicar e rollback", () => {
  const m = ler("supabase/migrations/0295_recibo_duplicado_e546.sql");
  assert.match(m, /numero = 'REC-2026-000005'/);
  assert.match(m, /pr\.is_teste/);
  assert.equal((m.match(/'registro em duplicidade'/g) ?? []).length, 3);
  assert.doesNotMatch(m, /\bdelete\b/i);
  const a = ler("supabase/producao/aplicar-0295.sql");
  assert.match(a, /^begin;/m);
  assert.match(a, /^commit;/m);
  assert.match(a, /'0295_recibo_duplicado_e546'/);
  assert.match(ler("supabase/producao/rollback/0295_rollback.sql"), /documentos_registro, 0201\) é imutável/);
});
