/*
  E640 (c) — teste em TEMPO DE EXECUÇÃO da recusa: a rota REAL /api/protegido/conferencia roda sobre um banco e um
  armazenamento em memória, e a gente tenta de verdade ver a foto/laudo de check-in/out com a conta errada, sem login, com link
  vencido, adulterado ou de outra pessoa. Só as portas de fora são falsas (Supabase, limite); a rota, a assinatura do link,
  a marca d'água e os cabeçalhos são os de produção. A RLS é representada pela regra "só as partes enxergam a conferência" —
  o SQL dela é guardado pelos testes de migração; aqui se prova que a ROTA depende dela e nunca serve sem ela.
  Roda: node --test src/lib/protecao/e640c-recusa-outra-conta.test.ts
*/
import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { BancoFalso } from "../testes/banco-falso.ts";
import { TTL_LINK_PROTEGIDO_S, assinarLink } from "./visualizacao.ts";

register("../testes/carregador-alias.mjs", import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-de-servico-so-do-teste";

type Estado = { usuario?: unknown; servico?: unknown; limiteLiberado?: boolean; avisos: unknown[]; admins: unknown[] };
const dubles = () => ((globalThis as unknown as { __dubles: Estado }).__dubles ??= { avisos: [], admins: [] });

const DONO = "aaaaaaaa-0000-4000-8000-0000000000a1";
const INQUILINO = "bbbbbbbb-0000-4000-8000-0000000000b2";
const ALHEIO = "cccccccc-0000-4000-8000-0000000000c3";
const FOTO = "conf-1/entrada-sala.jpg";
const LAUDO = "conf-1/laudo.pdf";
const FOTO_ALHEIA_AO_CONTRATO = "conf-9/outra.jpg";

let rota: (r: Request) => Promise<Response>;
let linkDe: (caminho: string, uid: string) => string | null;
let segredo: () => string | null;
let banco: BancoFalso;
let baixados: string[];
let original: Buffer;

before(async () => {
  const [r, s, v] = await Promise.all([import("@/app/api/protegido/conferencia/route"), import("@/lib/protecao/servidor"), import("@/lib/protecao/visualizacao")]);
  rota = r.GET;
  linkDe = s.linkProtegidoDe;
  segredo = s.segredoProtecao;
  assert.ok(v.TTL_LINK_PROTEGIDO_S > 0);
  original = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 200, g: 80, b: 40 } } }).jpeg().toBuffer();
});

beforeEach(async () => {
  banco = new BancoFalso();
  baixados = [];
  const pdf = await PDFDocument.create();
  pdf.addPage([300, 300]);
  const servico = banco.servico();
  const baixar = servico.storage.from("conferencia").download;
  servico.storage.from = () => ({
    download: async (c: string) => {
      baixados.push(c);
      return baixar(c);
    },
  });
  banco.arquivos.conferencia = { [FOTO]: new Uint8Array(original), [LAUDO]: await pdf.save(), [FOTO_ALHEIA_AO_CONTRATO]: new Uint8Array(original) };
  // As linhas são do contrato 1; a RLS: só as partes (dono e inquilino) enxergam.
  const partes = [DONO, INQUILINO];
  const soPartes = (l: Record<string, unknown>, uid: string | null) => !!uid && (l.partes as string[]).includes(uid);
  banco.tabelas.conferencia_itens = [{ id: "i1", foto_path: FOTO, partes }, { id: "i2", foto_path: FOTO_ALHEIA_AO_CONTRATO, partes: ["outro-par-1", "outro-par-2"] }];
  banco.tabelas.conferencia_conforto = [];
  banco.tabelas.conferencia_laudos = [{ conferencia_id: "c1", path: LAUDO, partes }];
  banco.rls = { conferencia_itens: soPartes, conferencia_conforto: soPartes, conferencia_laudos: soPartes };
  banco.tabelas.profiles = [{ id: DONO, full_name: "Dona Ana Souza" }, { id: INQUILINO, full_name: "Bruno Lima" }, { id: ALHEIO, full_name: "Carlos Intruso" }];
  const d = dubles();
  d.servico = servico;
  d.limiteLiberado = true;
});

const pedir = async (logadoComo: string | null, token: string | null) => {
  dubles().usuario = banco.usuario(logadoComo);
  return rota(new Request(`http://localhost/api/protegido/conferencia${token === null ? "" : `?t=${encodeURIComponent(token)}`}`));
};
const link = (caminho: string, uid: string) => {
  const l = linkDe(caminho, uid);
  assert.ok(l, "o servidor gera o link");
  return new URL(l!, "http://localhost").searchParams.get("t")!;
};

test("a parte do contrato vê a foto: 200, marcada, reduzida, inline e sem cache (e o original nunca sai)", async () => {
  const r = await pedir(INQUILINO, link(FOTO, INQUILINO));
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type") ?? "", /^image\//);
  assert.equal(r.headers.get("content-disposition"), "inline");
  assert.match(r.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  const bytes = Buffer.from(await r.arrayBuffer());
  assert.notDeepEqual(bytes, original, "não é o arquivo original");
  const meta = await sharp(bytes).metadata();
  assert.ok((meta.width ?? 99999) < 3000, "reduzida a resolução de tela");
});

test("o laudo em PDF também sai só para as partes, inline", async () => {
  const r = await pedir(DONO, link(LAUDO, DONO));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "application/pdf");
  assert.equal(r.headers.get("content-disposition"), "inline");
});

test("CONTA ALHEIA com o link de outra pessoa (token do dono, sessão do intruso): 403 e o arquivo nem é lido", async () => {
  const r = await pedir(ALHEIO, link(FOTO, DONO));
  assert.equal(r.status, 403);
  assert.deepEqual(baixados, [], "nada foi baixado do armazenamento");
});

test("CONTA ALHEIA com link PRÓPRIO assinado para a foto de outro contrato: 404 pela RLS e o arquivo nem é lido", async () => {
  const foto = await pedir(ALHEIO, link(FOTO, ALHEIO));
  assert.equal(foto.status, 404);
  const laudo = await pedir(ALHEIO, link(LAUDO, ALHEIO));
  assert.equal(laudo.status, 404);
  assert.deepEqual(baixados, []);
});

test("uma parte do contrato A não enxerga a foto do contrato B, nem com link válido dela", async () => {
  const r = await pedir(DONO, link(FOTO_ALHEIA_AO_CONTRATO, DONO));
  assert.equal(r.status, 404);
  assert.deepEqual(baixados, []);
});

test("sem login: 401; sem token: 410; token solto ou adulterado: 410", async () => {
  assert.equal((await pedir(null, link(FOTO, DONO))).status, 401);
  assert.equal((await pedir(DONO, null)).status, 410);
  assert.equal((await pedir(DONO, "lixo")).status, 410);
  const bom = link(FOTO, DONO);
  const [corpo, sig] = bom.split(".");
  const outroCorpo = Buffer.from(JSON.stringify({ c: LAUDO, u: ALHEIO, exp: 9999999999 })).toString("base64url");
  assert.equal((await pedir(ALHEIO, `${outroCorpo}.${sig}`)).status, 410, "trocar o corpo invalida a assinatura");
  assert.equal((await pedir(DONO, `${corpo}.${sig.slice(0, -2)}xx`)).status, 410);
  assert.deepEqual(baixados, []);
});

test("o link VENCE: depois de TTL segundos a rota responde 410, mesmo para a parte certa", async () => {
  const s = segredo()!;
  const emitidoHa = new Date(Date.now() - (TTL_LINK_PROTEGIDO_S + 5) * 1000);
  assert.equal((await pedir(DONO, assinarLink({ caminho: FOTO, uid: DONO }, s, emitidoHa))).status, 410);
  const aindaValido = new Date(Date.now() - (TTL_LINK_PROTEGIDO_S - 60) * 1000);
  assert.equal((await pedir(DONO, assinarLink({ caminho: FOTO, uid: DONO }, s, aindaValido))).status, 200);
  assert.deepEqual(baixados, [FOTO], "só o link ainda válido leu o arquivo");
});

test("link assinado com outro segredo (forjado) é recusado", async () => {
  assert.equal((await pedir(DONO, assinarLink({ caminho: FOTO, uid: DONO }, "segredo-do-atacante"))).status, 410);
});

test("sem a chave de serviço o servidor não gera link nem serve nada (nunca a URL crua)", async () => {
  const guarda = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    assert.equal(linkDe(FOTO, DONO), null);
    assert.equal((await pedir(DONO, "qualquer")).status, 503);
  } finally {
    process.env.SUPABASE_SERVICE_ROLE_KEY = guarda;
  }
});

test("excesso de visualizações do dia é recusado (429)", async () => {
  dubles().limiteLiberado = false;
  assert.equal((await pedir(DONO, link(FOTO, DONO))).status, 429);
  assert.deepEqual(baixados, []);
});

test("o bucket das conferências é PRIVADO (o arquivo só sai pela rota)", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/0117_conferencia_laudo.sql", import.meta.url), "utf8");
  assert.match(sql, /values \('conferencia', 'conferencia', false,/);
});
