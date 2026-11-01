/*
  E331 — "VN-CT-A0268B00 aparece 2× em Admin → Documentos → Emitidos". Conferido no banco (01/11): NÃO é o mesmo
  contrato emitido duas vezes. São DOIS contratos de teste diferentes da massa 0268 (…0011 e …0021), cada um com UMA
  linha no registro, que ganharam o MESMO número público. O número do contrato é `VN-CT-` + os 8 primeiros hex do id
  (numeroPublicoContrato; o banco usa a mesma regra em 0182/0201), e a 0268 escolheu os dois ids com o mesmo começo
  (a0268b00-…). É o único caso no banco. Guarda: nenhuma massa de teste nova pode repetir o começo de um id de contrato
  já usado em outra migração (o par da 0268 fica registrado como exceção conhecida — mudar o id ou o número de um
  contrato existente muda a identidade do documento).
  Roda: node --test src/lib/contratos/numero-contrato-unico.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { numeroPublicoContrato } from "../contrato-ref.ts";

const DIR = new URL("../../../supabase/migrations/", import.meta.url);
/** O par já em produção (contratos de teste da 0268). Não cresce. */
const COLISAO_CONHECIDA = new Set(["A0268B00"]);

function idsDeContratoNasMigracoes(): { arquivo: string; id: string }[] {
  const out: { arquivo: string; id: string }[] = [];
  for (const n of readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort()) {
    const s = readFileSync(new URL(n, DIR), "utf8");
    for (const m of s.matchAll(/\b\w*contrato\w*\s+constant\s+uuid\s*:=\s*'([0-9a-f-]{36})'/gi)) out.push({ arquivo: n, id: m[1].toLowerCase() });
  }
  return out;
}

test("o número público é VN-CT + os 8 primeiros hex do id (a regra que gerou a colisão da 0268)", () => {
  assert.equal(numeroPublicoContrato("a0268b00-0000-4000-8000-000000000011"), "VN-CT-A0268B00");
  assert.equal(numeroPublicoContrato("a0268b00-0000-4000-8000-000000000021"), "VN-CT-A0268B00");
});

test("nenhum contrato semeado em migração repete o número público de outro (fora a exceção conhecida da 0268)", () => {
  const ids = idsDeContratoNasMigracoes();
  assert.ok(ids.length >= 3, `achei só ${ids.length} contratos semeados`);
  const porNumero = new Map<string, string[]>();
  for (const { arquivo, id } of ids) {
    const numero = numeroPublicoContrato(id).slice("VN-CT-".length);
    const lista = porNumero.get(numero) ?? [];
    if (!lista.some((x) => x.endsWith(id))) lista.push(`${arquivo}:${id}`);
    porNumero.set(numero, lista);
  }
  const colisoes = [...porNumero].filter(([n, l]) => l.length > 1 && !COLISAO_CONHECIDA.has(n));
  assert.deepEqual(colisoes, [], "duas massas com o mesmo começo de id geram o mesmo número VN-CT — escolha outro id");
  // A exceção conhecida não cresce.
  for (const n of COLISAO_CONHECIDA) assert.ok((porNumero.get(n) ?? []).length <= 2, n);
});

test("Admin → Emitidos mostra o nº único do registro em cada linha (duas emissões nunca parecem a mesma)", () => {
  const acoes = readFileSync(new URL("../data/emitidos-actions.ts", import.meta.url), "utf8");
  assert.match(acoes, /is_teste, registro_seq"\)/);
  assert.match(acoes, /registroSeq: l\.registro_seq,/);
  const tela = readFileSync(new URL("../../app/(dashboard)/admin/documentos/emitidos-client.tsx", import.meta.url), "utf8");
  assert.match(tela, /data-testid="emitido-registro">\n\s*Registro nº \{d\.registroSeq\}/);
});
