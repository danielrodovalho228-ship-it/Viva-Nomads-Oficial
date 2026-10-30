/*
  QA-LOGIN-B — regras puras da porta de QA (contas de teste e admin observador).
  Roda: node --test src/lib/qa/entrar.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  QA_ADMIN_VALIDO_ATE,
  chaveConfere,
  chaveLimiteConta,
  destinoParaRegistro,
  emailNoPadrao,
  emailNormalizado,
  hashValido,
  papelDaContaNova,
  portaAdminQaAberta,
  sha256Hex,
  tipoDeEntrada,
} from "./entrar.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const CHAVE = "chave-de-teste-nao-real";
const HASH = sha256Hex(CHAVE);

test("chave: conferida pelo HASH (sha256 hex); só a certa confere; sem hash válido nada confere", () => {
  assert.equal(hashValido(HASH), true);
  assert.equal(chaveConfere(CHAVE, HASH), true);
  assert.equal(chaveConfere(CHAVE, HASH.toUpperCase()), true, "hex em maiúsculas também vale");
  assert.equal(chaveConfere(`${CHAVE}x`, HASH), false);
  assert.equal(chaveConfere("", HASH), false);
  assert.equal(chaveConfere(undefined, HASH), false);
  assert.equal(chaveConfere(CHAVE, undefined), false);
  assert.equal(chaveConfere(CHAVE, CHAVE), false, "a chave em claro na env NÃO vale: só o hash");
  assert.equal(chaveConfere(CHAVE, "abc"), false);
});

test("chave: comparação em tempo constante e nenhuma chave em claro lida da env", () => {
  const src = ler("./entrar.ts");
  assert.match(src, /crypto\.timingSafeEqual\(a, b\)/);
  assert.doesNotMatch(src, /fornecida === |=== fornecida/);
  const srv = ler("./entrar-servidor.ts") + ler("../../app/api/qa/entrar/route.ts") + ler("../../app/qa/entrar/page.tsx");
  assert.match(srv, /process\.env\.QA_LOGIN_KEY_HASH/);
  assert.doesNotMatch(srv, /process\.env\.QA_LOGIN_KEY\b(?!_HASH)/, "a chave em claro nunca é lida");
});

test("e-mail: normaliza e recusa o que não parece e-mail", () => {
  assert.equal(emailNormalizado("  QA.Ana@Exemplo.com "), "qa.ana@exemplo.com");
  assert.equal(emailNormalizado("sem-arroba"), "");
  assert.equal(emailNormalizado(42), "");
});

test("padrão: ancorado no e-mail inteiro; sem padrão ou padrão inválido não cria nada", () => {
  const p = String.raw`qa\+[a-z0-9.-]+@exemplo\.com`;
  assert.equal(emailNoPadrao("qa+morador1@exemplo.com", p), true);
  assert.equal(emailNoPadrao("pessoa@exemplo.com", p), false);
  assert.equal(emailNoPadrao("x-qa+a@exemplo.com.br", p), false, "âncora: não casa pedaço");
  assert.equal(emailNoPadrao("qa+a@exemplo.com", undefined), false);
  assert.equal(emailNoPadrao("qa+a@exemplo.com", "(["), false);
});

test("contas aceitas: teste (morador/proprietário, sem 2FA) e o admin observador; qualquer outra → null (404)", () => {
  assert.equal(tipoDeEntrada({ role: "tenant", is_teste: true }, false, true), "teste");
  assert.equal(tipoDeEntrada({ role: "owner", is_teste: true }, false, true), "teste");
  assert.equal(tipoDeEntrada({ role: "tenant", is_teste: false }, false, true), null, "cliente real");
  assert.equal(tipoDeEntrada({ role: "admin", is_teste: false }, true, true), null, "admin comum / Daniel");
  assert.equal(tipoDeEntrada({ role: "admin", is_teste: true }, false, true), null, "admin marcado de teste, sem qa_admin");
  assert.equal(tipoDeEntrada({ role: "tenant", is_teste: true }, true, true), null, "conta de teste com 2FA");
  assert.equal(tipoDeEntrada({ role: "admin", is_teste: true, qa_admin: true }, true, true), "admin_qa", "observador entra (com o 2FA dele)");
  assert.equal(tipoDeEntrada({ role: "admin", is_teste: true, qa_admin: true }, true, false), null, "porta do admin desligada");
  assert.equal(tipoDeEntrada({ role: "admin", is_teste: false, qa_admin: true }, true, true), null, "observador precisa ser de teste");
  assert.equal(tipoDeEntrada({ role: "tenant", is_teste: true, qa_admin: true }, false, true), null, "qa_admin sem papel admin");
  assert.equal(tipoDeEntrada(null, false, true), null);
});

test("desligamento automático do admin observador: PRE_LANCAMENTO=off OU depois de QA_ADMIN_VALIDO_ATE", () => {
  assert.equal(QA_ADMIN_VALIDO_ATE, "2026-12-31");
  const antes = new Date("2026-11-15T12:00:00Z");
  assert.equal(portaAdminQaAberta(antes, undefined), true, "pré-lançamento ligado por padrão");
  assert.equal(portaAdminQaAberta(antes, "on"), true);
  assert.equal(portaAdminQaAberta(antes, "off"), false, "gatilho 1: lançamento");
  assert.equal(portaAdminQaAberta(antes, " OFF "), false);
  assert.equal(portaAdminQaAberta(new Date("2027-01-01T02:59:00Z"), undefined), true, "31/12 23:59 em Brasília ainda vale");
  assert.equal(portaAdminQaAberta(new Date("2027-01-01T03:00:00Z"), undefined), false, "gatilho 2: 01/01 em Brasília");
});

test("conta nova: papel pedido ou morador; nunca admin", () => {
  assert.equal(papelDaContaNova("owner"), "owner");
  assert.equal(papelDaContaNova("admin"), "tenant");
  assert.equal(papelDaContaNova(undefined), "tenant");
});

test("registro: destino só com o caminho; limite por conta usa o resumo, nunca o e-mail", () => {
  assert.equal(destinoParaRegistro("/admin/usuarios?q=pessoa@exemplo.com#x"), "/admin/usuarios");
  assert.equal(destinoParaRegistro("/dashboard"), "/dashboard");
  const k = chaveLimiteConta("qa+ana@exemplo.com");
  assert.doesNotMatch(k, /ana|exemplo/);
  assert.match(k, /^qa-entrar:conta:[0-9a-f]{32}$/);
});

test("guardas do servidor: 404 em tudo, sessão por generateLink + verifyOtp, nada sensível em log nem na URL", () => {
  const srv = ler("./entrar-servidor.ts");
  const rota = ler("../../app/api/qa/entrar/route.ts");
  const pagina = ler("../../app/qa/entrar/page.tsx");
  assert.match(srv, /generateLink\(\{ type: "magiclink", email \}\)/);
  assert.match(srv, /verifyOtp\(\{ type: "magiclink", token_hash/);
  assert.match(srv, /email_confirm: true/);
  assert.match(srv, /insert\(\{ usuario_id: userId, tipo, ip_hash: ipHash, destino, conta_criada: criada \}\)/);
  // E256-B: a porta escreve UM tipo de linha no log, o código do motivo da recusa (sem e-mail, chave nem IP).
  assert.deepEqual(srv.match(/console\.(log|error|warn|info)\([^)]*\)/g), ["console.warn(linhaLogRecusaQa(motivo)"]);
  assert.doesNotMatch(rota, /console\./);
  assert.match(rota, /status: 404/);
  assert.match(pagina, /if \("chave" in sp \|\| "key" in sp\) \{\n\s*registrarRecusaQa\("chave"\);\n\s*notFound\(\);/);
  // PRE_LANCAMENTO lido na hora (não inlinado no build), para o desligamento valer sem novo build.
  assert.match(srv, /\["NEXT_PUBLIC", "PRE_LANCAMENTO"\]\.join\("_"\)/);
  // O login das pessoas reais, is_admin() e o 2FA do admin não mudam por aqui.
  assert.doesNotMatch(srv, /signInWithOtp|is_admin\(|unenroll|mfa\.(enroll|verify)/);
});

test("E256-B: as 5 contas da equipe marcadas como teste entram (tipo 'teste'); proprietario1 entra sem o fator; com 2FA, não", async () => {
  const { tipoDeEntrada, motivoRecusaConta } = await import("./entrar.ts");
  for (const role of ["tenant", "tenant", "tenant", "tenant", "tenant"]) assert.equal(tipoDeEntrada({ role, is_teste: true, qa_admin: false }, false, true), "teste");
  const proprietario1 = { role: "owner", is_teste: true, qa_admin: false };
  assert.equal(tipoDeEntrada(proprietario1, false, true), "teste");
  assert.equal(tipoDeEntrada(proprietario1, true, true), null);
  assert.equal(motivoRecusaConta(proprietario1, true, true), "2fa");
  assert.equal(motivoRecusaConta(proprietario1, false, true), null);
  // Antes da 0257 as 5 contas estavam com is_teste = false: "perfil".
  assert.equal(motivoRecusaConta({ role: "tenant", is_teste: false }, false, true), "perfil");
  // Conta real, admin comum e o admin observador com a porta dele fechada.
  assert.equal(motivoRecusaConta({ role: "owner", is_teste: false }, false, true), "perfil");
  assert.equal(motivoRecusaConta({ role: "admin", is_teste: false }, false, true), "perfil");
  assert.equal(motivoRecusaConta({ role: "admin", is_teste: true, qa_admin: true }, true, false), "admin_fechada");
  assert.equal(motivoRecusaConta({ role: "admin", is_teste: true, qa_admin: true }, true, true), null);
  assert.equal(motivoRecusaConta(null, false, true), "perfil");
});

test("E256-B: a linha do log da recusa leva só o evento e o código (sem e-mail, chave nem IP)", async () => {
  const { linhaLogRecusaQa, MOTIVOS_RECUSA_QA } = await import("./entrar.ts");
  assert.deepEqual([...MOTIVOS_RECUSA_QA], ["desligada", "metodo", "chave", "perfil", "2fa", "padrao", "admin_fechada"]);
  for (const m of MOTIVOS_RECUSA_QA) assert.deepEqual(JSON.parse(linhaLogRecusaQa(m)), { evento: "qa_porta_recusa", motivo: m });
  const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
  const servidor = ler("src/lib/qa/entrar-servidor.ts");
  // Toda saída 404 passa por recusa(<motivo>); nenhum NAO_EXISTE mudo sobrou. O log só recebe a linha pronta.
  assert.doesNotMatch(servidor, /NAO_EXISTE/);
  for (const m of ["desligada", "chave", "perfil", "padrao"]) assert.match(servidor, new RegExp(`recusa\\("${m}"\\)`));
  assert.match(servidor, /return recusa\(motivoRecusaConta\(perfil, fator, adminAberta\) \?\? "perfil"\);/);
  assert.match(servidor, /console\.warn\(linhaLogRecusaQa\(motivo\)\);/);
  assert.equal((servidor.match(/console\./g) ?? []).length, 1, "um só ponto de log na porta");
  const rota = ler("src/app/api/qa/entrar/route.ts");
  assert.match(rota, /export function GET\(\) \{\n  registrarRecusaQa\("metodo"\);\n  return naoEncontrado\(\);/);
  assert.match(rota, /registrarRecusaQa\("desligada"\)/);
  assert.doesNotMatch(rota + servidor, /console\.\w+\([^)]*(email|chave|ipHash|ip_hash)/);
  const pagina = ler("src/app/qa/entrar/page.tsx");
  assert.match(pagina, /registrarRecusaQa\("desligada"\)/);
  assert.match(pagina, /registrarRecusaQa\("chave"\)/);
});

test("E256-B: o formulário só envia pelo fetch relativo, depois de carregado (nada de POST nativo para a página)", () => {
  const form = readFileSync(new URL("../../app/qa/entrar/qa-entrar-form.tsx", import.meta.url), "utf8");
  assert.match(form, /await fetch\("\/api\/qa\/entrar", \{\n\s*method: "POST",/);
  assert.doesNotMatch(form, /method="post"/);
  assert.match(form, /disabled=\{enviando \|\| !pronto\}/);
  assert.match(form, /const pronto = useSyncExternalStore\(semAssinatura, \(\) => true, \(\) => false\);/);
});

test("E256-B (0257): só as 5 contas por e-mail exato, trava contra conta real, 2FA sai só de teste que não é qa_admin", () => {
  const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
  const mig = ler("supabase/migrations/0257_qa_contas_teste_sem_2fa.sql");
  const aplicar = ler("supabase/producao/aplicar-0257.sql");
  for (const sql of [mig, aplicar]) {
    for (const e of ["avaliador1", "cadastro1", "cadastro2", "cadastro3", "cadastro-teste-2310"]) assert.ok(sql.includes(`'${e}@vivanomads.com.br'`), e);
    assert.equal((sql.match(/@vivanomads\.com\.br'/g) ?? []).length, 5, "nenhuma conta além das 5");
    assert.match(sql, /where lower\(email\) = any \(c_emails\)/);
    assert.match(sql, /raise exception '0257: uma das contas tem vínculo com conta real; nada foi marcado/);
    assert.match(sql, /p\.is_teste = true and coalesce\(p\.qa_admin, false\) = false/);
    const semComentario = sql.replace(/--.*$/gm, "");
    assert.doesNotMatch(semComentario, /QA_EMAIL_PADRAO|qa_entradas|qa_admin = true|role = 'admin'/);
    assert.match(sql, /\(teste\|test\|qa\)\\y/, "borda de palavra do Postgres é \\y, não \\b");
  }
  assert.match(aplicar, /^begin;$/m);
  assert.match(aplicar, /^commit;$/m);
  assert.match(aplicar, /'20261030000257', '0257_qa_contas_teste_sem_2fa'/);
  const volta = ler("supabase/producao/rollback/0257_rollback.sql");
  assert.match(volta, /update public\.profiles set is_teste = false/);
  assert.match(volta, /delete from supabase_migrations\.schema_migrations where version = '20261030000257';/);
});
