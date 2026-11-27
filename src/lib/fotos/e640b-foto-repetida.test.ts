/*
  E640 (b) — DETECÇÃO DE FOTO REPETIDA no cadastro (aprovado pelo Daniel em 05/11/2026): hash perceptual; foto igual ou
  quase igual à de OUTRO anúncio → alerta ao admin + publicação travada até conferir a matrícula (com o E633, é a proteção
  real contra cadastrar o imóvel em nome de outra pessoa). Só compara conta real × real: contas de teste reaproveitam as
  mesmas fotos de exemplo. O dono nunca vê de quem é a outra foto.
  Roda: node --test src/lib/fotos/e640b-foto-repetida.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { LIMITE_BITS_FOTO_PARECIDA, distanciaHamming, ehFotoParecida, matriculaConfereu, ROTULO_FOTO_REPETIDA } from "./foto-repetida.ts";
import { prontidaoAnuncio, type FatosAnuncio } from "../anuncio/prontidao.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("distância de Hamming entre hashes de 64 bits (16 hex)", () => {
  assert.equal(distanciaHamming("0000000000000000", "0000000000000000"), 0);
  assert.equal(distanciaHamming("0000000000000000", "0000000000000001"), 1);
  assert.equal(distanciaHamming("ffffffffffffffff", "0000000000000000"), 64);
  assert.equal(distanciaHamming("f0f0f0f0f0f0f0f0", "0f0f0f0f0f0f0f0f"), 64);
});

test("hash inválido nunca conta como parecido (falha fechada para o alerta, não para a foto)", () => {
  assert.equal(distanciaHamming("zz", "00"), Number.POSITIVE_INFINITY);
  assert.equal(ehFotoParecida("", "0000000000000000"), false);
  assert.equal(distanciaHamming("00", "0000"), Number.POSITIVE_INFINITY);
});

test("igual ou quase igual até o limite; acima dele é outra foto", () => {
  const base = "00000000000000ff";
  assert.equal(ehFotoParecida(base, base), true);
  assert.equal(ehFotoParecida(base, "00000000000000fc"), true);
  const limite = "0000000000" + "00003f".padStart(6, "0"); // 6 bits de diferença para "0000000000000000"
  assert.equal(distanciaHamming("0000000000000000", limite), LIMITE_BITS_FOTO_PARECIDA);
  assert.equal(ehFotoParecida("0000000000000000", limite), true);
  assert.equal(ehFotoParecida("0000000000000000", "000000000000007f"), false); // 7 bits
});

test("matrícula conferida (ou provável) libera; revisão e recusa não", () => {
  assert.equal(matriculaConfereu("conferido"), true);
  assert.equal(matriculaConfereu("provavel"), true);
  assert.equal(matriculaConfereu("em_revisao"), false);
  assert.equal(matriculaConfereu("recusado"), false);
  assert.equal(matriculaConfereu(null), false);
});

const ok: FatosAnuncio = {
  enderecoOk: true, detalhesOk: true, periodoOk: true, fotos: 10, titulo: "Apartamento claro", preco: 2500, garantiaOk: true,
  sublocacaoOk: true, privacidadeOk: true, documento: "approved", descricao: "x".repeat(200), selo: false, video: false,
};

test("prontidão: foto repetida em aberto trava a publicação; sem alerta (ou liberada) não muda nada", () => {
  const trava = prontidaoAnuncio({ ...ok, fotoRepetidaAberta: true });
  assert.equal(trava.podePublicar, false);
  const item = trava.obrigatorios.find((i) => i.key === "foto_repetida");
  assert.ok(item && !item.ok);
  assert.equal(item?.label, ROTULO_FOTO_REPETIDA);
  assert.ok(!/de quem|conta d|nome d|proprietári|dono/i.test(`${item?.label} ${item?.detalhe}`), "não revela de quem é a outra foto");
  assert.equal(prontidaoAnuncio({ ...ok, fotoRepetidaAberta: false }).podePublicar, true);
  assert.equal(prontidaoAnuncio(ok).podePublicar, true);
  assert.ok(!prontidaoAnuncio(ok).obrigatorios.some((i) => i.key === "foto_repetida"));
});

test("migração 0309: alerta só do admin, marcador na tabela do imóvel, consulta só real × real e só pelo servidor", () => {
  const m = ler("supabase/migrations/0309_foto_repetida_e640.sql");
  assert.match(m, /alter table public\.properties add column if not exists foto_repetida_em timestamptz/);
  assert.match(m, /create table if not exists public\.fotos_repetidas_alertas/);
  assert.match(m, /enable row level security/);
  assert.match(m, /revoke all on public\.fotos_repetidas_alertas from anon, authenticated/);
  assert.match(m, /create or replace function public\.fotos_parecidas\(/);
  assert.match(m, /bit_count\(/);
  assert.match(m, /is_teste/);
  assert.match(m, /revoke all on function public\.fotos_parecidas\(uuid, int\) from public, anon, authenticated/);
  assert.match(m, /grant execute on function public\.fotos_parecidas\(uuid, int\) to service_role/);
  assert.match(m, new RegExp(`p_max int default ${LIMITE_BITS_FOTO_PARECIDA}`), "o limite do SQL é o mesmo do TypeScript");
  assert.ok(existsSync(new URL("../../../supabase/producao/aplicar-0309.sql", import.meta.url)));
  assert.ok(existsSync(new URL("../../../supabase/producao/rollback/0309_rollback.sql", import.meta.url)));
  const ap = ler("supabase/producao/aplicar-0309.sql");
  assert.match(ap, /begin;/);
  assert.match(ap, /20261105000309/);
  assert.match(ap, /0309_foto_repetida_e640/);
});

test("servidor: a detecção roda ao ligar as fotos ao imóvel, avisa o admin e marca o imóvel", () => {
  const f = ler("src/lib/minimizacao/fotos-anuncio.ts");
  assert.match(f, /registrarFotoRepetida\(admin, propertyId\)/);
  const s = ler("src/lib/fotos/foto-repetida-servidor.ts");
  assert.match(s, /rpc\("fotos_parecidas"/);
  assert.match(s, /from\("fotos_repetidas_alertas"\)/);
  assert.match(s, /foto_repetida_em/);
  assert.match(s, /event: "documento_recebido"/);
});

test("prontidão do servidor lê o marcador e só mantém a trava enquanto a matrícula não for conferida", () => {
  const s = ler("src/lib/anuncio/prontidao-servidor.ts");
  assert.match(s, /foto_repetida_em/);
  assert.match(s, /matriculaConfereu\(/);
  assert.match(s, /f\.fotoRepetidaAberta = /);
  const e = ler("src/lib/anuncio/assistente-dez-etapas.ts");
  assert.match(e, /"foto_repetida"/);
});

test("admin: liberar a trava exige admin com 2FA, recusa o observador da QA e limpa o marcador", () => {
  const a = ler("src/lib/data/foto-repetida-admin-actions.ts");
  assert.match(a, /export async function liberarFotoRepetida\(/);
  assert.match(a, /await recusaObservador\(/);
  assert.match(a, /foto_repetida_em: null/);
  assert.match(a, /status: "liberado"/);
  const p = ler("src/app/(dashboard)/admin/documentos/page.tsx");
  assert.match(p, /<FotosRepetidasAdmin /);
});

test("retenção: a tabela de alertas está no inventário", () => {
  assert.match(ler("src/config/retencao.ts"), /i\("fotos_repetidas_alertas", "public\.fotos_repetidas_alertas"/);
});
