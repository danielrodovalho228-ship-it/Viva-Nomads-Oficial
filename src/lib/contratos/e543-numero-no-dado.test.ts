/*
  E543 (reprova de 05/11): o admin seguia com VN-CT-A0268B00 em DOIS registros distintos. Causa no dado (produção,
  leitura): são dois contratos diferentes da massa 0268 — a0268b00-…0011 (avaliação, terminou em 30/10) e
  a0268b00-…0021 (instruções, entrada em 10/11) — e a semente escolheu os dois ids com o MESMO começo; o número público
  é VN-CT- + os 8 primeiros hex do id (E331), então os dois ganharam o mesmo número (no registro também: 2× VN-CT-A0268B00
  v1). Única colisão no banco.
  Correção no dado (0301): o contrato …0021 é recriado como a0268b01-…0021 (VN-CT-A0268B01) com o seu bloco; o registro
  antigo dele fica 'anulado' com o motivo (o registro é imutável: só o status anda). Prevenção: nenhum contrato novo nasce
  com o número de outro — antes do insert, o id é sorteado de novo se o começo coincidir (nunca impede o contrato de
  nascer, a regra da 0201).
  Roda: node --test src/lib/contratos/e543-numero-no-dado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { numeroPublicoContrato } from "../contrato-ref.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const ARQS = ["supabase/migrations/0301_contrato_numero_unico_e543.sql", "supabase/producao/aplicar-0301.sql"];

test("os dois contratos passam a ter números diferentes", () => {
  assert.equal(numeroPublicoContrato("a0268b00-0000-4000-8000-000000000011"), "VN-CT-A0268B00");
  assert.equal(numeroPublicoContrato("a0268b01-0000-4000-8000-000000000021"), "VN-CT-A0268B01");
});

test("0301: recria o contrato …0021 com o id novo (bloco junto) e anula o registro antigo, só se ainda não foi feito", () => {
  for (const f of ARQS) {
    const s = ler(f);
    assert.match(s, /v_velho constant uuid := 'a0268b00-0000-4000-8000-000000000021';/, f);
    assert.match(s, /v_novo constant uuid := 'a0268b01-0000-4000-8000-000000000021';/, f);
    assert.match(s, /if not exists \(select 1 from public\.contratos where id = v_velho\) or exists \(select 1 from public\.contratos where id = v_novo\) then/, f);
    assert.match(s, /delete from public\.contratos where id = v_velho;/, f);
    assert.match(s, /jsonb_populate_record\(null::public\.contratos, v_contrato \|\| jsonb_build_object\('id', v_novo\)\)/, f);
    assert.match(s, /jsonb_populate_recordset\(null::public\.contrato_blocos/, f);
    assert.match(s, /set status = 'anulado', anulado_motivo = /, f);
    // Só recria se o contrato não tiver nada além do bloco (o que a massa criou) — nunca apaga histórico.
    assert.match(s, /raise notice 'E543: o contrato % tem registros além do bloco/, f);
    // Recriar não é assinar de novo: o pedido de moradia do inquilino não muda.
    assert.match(s, /disable trigger trg_pedido_atendido_no_contrato;[\s\S]*jsonb_populate_record\(null::public\.contratos[\s\S]*enable trigger trg_pedido_atendido_no_contrato;/, f);
  }
});

test("0301: prevenção — o id é sorteado de novo quando o número coincidiria (nunca impede o contrato de nascer)", () => {
  for (const f of ARQS) {
    const s = ler(f);
    assert.match(s, /create or replace function public\.contratos_numero_unico\(\) returns trigger/, f);
    assert.match(s, /while exists \(select 1 from public\.contratos c where left\(c\.id::text, 8\) = left\(new\.id::text, 8\) and c\.id <> new\.id\) loop/, f);
    assert.match(s, /new\.id := gen_random_uuid\(\);/, f);
    assert.match(s, /create trigger trg_contratos_numero_unico before insert on public\.contratos/, f);
  }
  const a = ler("supabase/producao/aplicar-0301.sql");
  assert.match(a, /^begin;/m);
  assert.match(a, /'20261105000301', '0301_contrato_numero_unico_e543'/);
  assert.match(ler("supabase/producao/rollback/0301_rollback.sql"), /drop trigger if exists trg_contratos_numero_unico on public\.contratos;/);
});
