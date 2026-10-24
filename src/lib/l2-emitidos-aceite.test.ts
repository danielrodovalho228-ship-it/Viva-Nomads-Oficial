/*
  L2-B item 14 (aba "Emitidos" e reenvio de e-mail) e item 23 (aceite do termo de IA por dono), com a migração 0241.
  Roda: node --test src/lib/l2-emitidos-aceite.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AVISO_REENVIO,
  LIMITE_REENVIO_ADMIN,
  LIMITE_REENVIO_DOCUMENTO,
  filtrosEmitidos,
  mascararEmail,
  periodoEmInstantes,
  resultadoParaRegistro,
  situacaoEnvio,
} from "./fiscal/emitidos.ts";
import { TERMO_IA_VERSAO, precisaAceitarTermo, textoTermoJaAceito } from "./anuncio/termo-ia.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("item 14: filtros por tipo e período (URL), período invertido trocado, tipo desconhecido fora", () => {
  assert.deepEqual(filtrosEmitidos({ tipo: "rec", de: "2026-10-01", ate: "2026-10-31" }), { tipo: "REC", de: "2026-10-01", ate: "2026-10-31" });
  assert.deepEqual(filtrosEmitidos({ tipo: "XYZ", de: "ontem" }), { tipo: null, de: null, ate: null });
  assert.deepEqual(filtrosEmitidos({ de: "2026-10-31", ate: "2026-10-01" }), { tipo: null, de: "2026-10-01", ate: "2026-10-31" });
  assert.equal(filtrosEmitidos({ tipo: "VIS" }).tipo, "VIS");
  // Dias de Brasília: 00:00 BRT = 03:00 UTC; "até" inclui o dia inteiro.
  assert.deepEqual(periodoEmInstantes({ tipo: null, de: "2026-10-01", ate: "2026-10-31" }), { desde: "2026-10-01T03:00:00.000Z", antes: "2026-11-01T03:00:00.000Z" });
});

test("item 14: destinatário mascarado, status do envio por papel, sem endereço no registro", () => {
  assert.equal(mascararEmail("maria.souza@gmail.com"), "ma***@gmail.com");
  assert.equal(mascararEmail("a@x.com"), "a***@x.com");
  assert.equal(mascararEmail(""), null);
  const dois = [{ papel: "locador", status: "enviado" }, { papel: "locatario", status: "enviado" }];
  assert.deepEqual(situacaoEnvio("documentos_fiscais", dois, "valido"), { chave: "enviado", rotulo: "Enviado (2 de 2)", podeReenviar: true });
  assert.equal(situacaoEnvio("documentos_fiscais", [{ papel: "locador", status: "enviado" }, { papel: "locatario", status: "erro" }], "valido").chave, "parcial");
  assert.equal(situacaoEnvio("documentos_fiscais", [{ papel: "locador", status: "erro" }], "valido").chave, "falhou");
  assert.equal(situacaoEnvio("documentos_fiscais", null, "valido").chave, "sem_registro");
  assert.equal(situacaoEnvio("documentos_fiscais", dois, "anulado").podeReenviar, false, "anulado não se reenvia");
  assert.deepEqual(situacaoEnvio("propostas", null, "valido"), { chave: "sem_email", rotulo: "Entregue na plataforma (sem e-mail)", podeReenviar: false });
  assert.deepEqual(resultadoParaRegistro([{ papel: "locador", status: "enviado", em: "2026-10-24T10:00:00Z", email: "x@y.com" } as never]), [{ papel: "locador", status: "enviado", em: "2026-10-24T10:00:00Z" }]);
});

test("item 14: reenvio com confirmação, limite, registro e MESMO documento (nada reemitido)", () => {
  assert.ok(AVISO_REENVIO.includes("número e o código de conferência continuam os mesmos"));
  assert.deepEqual([LIMITE_REENVIO_DOCUMENTO.maximo, LIMITE_REENVIO_ADMIN.maximo], [3, 30]);
  const a = ler("src/lib/data/emitidos-actions.ts");
  assert.match(a, /exigirAdminAal2/);
  assert.match(a, /consumirLimite\(`reenvio_documento:\$\{registroId\}`/);
  assert.match(a, /consumirLimite\(`reenvio_documento_admin:\$\{c\.userId\}`/);
  assert.match(a, /reenviarEmailDoDocumento\(reg\.ref_id as string, \{ todos: true \}\)/);
  assert.match(a, /from\("documentos_reenvios"\)\.insert\(/);
  assert.doesNotMatch(a, /proximo_numero_documento|registrarDocumento|emitirDoPagamento/);
  const e = ler("src/lib/fiscal/emitir.ts");
  assert.match(e, /opcoes\.todos \|\| !anterior\.some/);
  const tela = ler("src/app/(dashboard)/admin/documentos/emitidos-client.tsx");
  assert.match(tela, /<ConfirmarNaPagina\s+aviso=\{AVISO_REENVIO\}/);
  assert.match(tela, /data-testid="emitido-destinatarios"/);
  const pagina = ler("src/app/(dashboard)/admin/documentos/page.tsx");
  assert.match(pagina, /if \(sp\.aba === ABA_EMITIDOS\)/);
  assert.match(pagina, /data-testid=\{`documentos-aba-\$\{chave\}`\}/);
});

test("item 23: aceite por dono e versão; quem aceitou não vê a caixa até a versão mudar", () => {
  assert.equal(precisaAceitarTermo(null), true);
  assert.equal(precisaAceitarTermo({ versao: TERMO_IA_VERSAO }), false);
  assert.equal(precisaAceitarTermo({ versao: "2025-01-01" }), true, "versão antiga pede de novo");
  assert.match(textoTermoJaAceito("2026-10-24T15:00:00Z"), /^Você já aceitou o termo de uso da inteligência artificial em 24\/10\/2026\./);
  const acoes = ler("src/lib/data/actions.ts");
  // O servidor confere o aceite do dono (nunca a palavra do navegador) e grava o aceite por dono ao publicar.
  assert.match(acoes, /const jaAceitou = v\.ok \? false : await termoIaAceitoNoServidor\(supabase, ownerId\);/);
  assert.match(acoes, /if \(v\.ok\) await gravarAceiteTermoIa\(supabase, ownerId\);/);
  assert.match(acoes, /from\("termo_ia_aceites"\)\.insert\(\{ user_id: ownerId, versao: TERMO_IA_VERSAO \}\)/);
  assert.match(ler("src/lib/data/termo-ia-actions.ts"), /\.eq\("versao", TERMO_IA_VERSAO\)/);
  // Cadastro e editor leem do servidor ao abrir e trocam a caixa pela linha.
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx"), /const aceiteValido = !!termoJaAceito \|\| \(aceitouIa && !textoMudouDepoisDoAceite\);/);
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-revisar.tsx"), /data-testid="aceite-ia-ja-aceito"/);
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx"), /\{!publicado && !termoJaAceito && \(/);
});

test("migração 0241: tabelas, RLS e aplicar/rollback registrados com o mesmo nome", () => {
  const m = ler("supabase/migrations/0241_reenvios_aceite_ia.sql");
  assert.match(m, /create table if not exists public\.documentos_reenvios/);
  assert.match(m, /revoke all on public\.documentos_reenvios from public, anon, authenticated;/);
  assert.match(m, /create table if not exists public\.termo_ia_aceites/);
  assert.match(m, /using \(user_id = auth\.uid\(\)\)/);
  assert.match(m, /with check \(user_id = auth\.uid\(\)\)/);
  assert.doesNotMatch(m, /grant update|for update/, "aceite não se altera");
  const ap = ler("supabase/producao/aplicar-0241.sql");
  assert.match(ap, /^-- Viva Nomads — aplicar 0241/);
  assert.match(ap, /begin;[\s\S]*commit;\s*$/);
  assert.match(ap, /select '20261024000241', '0241_reenvios_aceite_ia',/);
  assert.match(ap, /'danielrodovalho228@gmail\.com'/);
  const rb = ler("supabase/producao/rollback/0241_rollback.sql");
  assert.match(rb, /drop table if exists public\.documentos_reenvios;/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261024000241';/);
});
