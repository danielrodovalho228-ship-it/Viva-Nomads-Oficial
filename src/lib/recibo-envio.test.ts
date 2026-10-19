import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cpfValido } from "./documento-pessoa.ts";
import { conteudoDocumento, NUMERO_PROVISORIO, temContato, textoDocumento, type DadosDocumento } from "./fiscal/documento.ts";
import { envioConfirmado, motivoFalhaEnvio, resultadoEnvio } from "./fiscal/envio.ts";
import { erroResend, semDadosPessoais, sendEmail } from "./notifications/email.ts";
import { hashResumo, linhasParaHash, resumoContrato } from "./contrato-assinar.ts";
import { MAX_VERSOES, TEXTO_RODADAS_ESGOTADAS, bloqueioContraproposta, tetoDeRodadasAtingido } from "./propostas/regras.ts";

/*
  Complemento do recibo (coordenador, reteste do #872, 19/10):
   1. enviado_em só com envio confirmado, resultado por destinatário em documentos_fiscais.envio, falha de envio na fila
      com "Reenviar e-mail" (sem documento novo);
   2. o motivo da recusa do Resend vai para o log e para a fila (sem dados pessoais); 429 espera e tenta de novo;
   3. trava de contato determinística (o código sorteado nunca dispara) e checada ANTES de reservar o número;
   4. "Registrado em" em pt-BR, sem quebrar o hash de quem já assinou;
   + anexo: na v3, o dono vê o mesmo aviso de teto que o inquilino.
*/
const ler = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/** CPF válido aleatório, só dígitos (como fica gravado no perfil). */
function cpfAleatorio(): string {
  const n = Array.from({ length: 9 }, () => randomInt(10));
  for (const tam of [9, 10]) {
    const soma = n.slice(0, tam).reduce((s, d, i) => s + d * (tam + 1 - i), 0);
    const r = (soma * 10) % 11;
    n.push(r === 10 ? 0 : r);
  }
  return n.join("");
}

const recibo = (p: Partial<DadosDocumento> = {}): DadosDocumento => ({
  tipo: "recibo_aluguel",
  numero: `REC-2026-${String(randomInt(1, 999999)).padStart(6, "0")}`,
  emitidoEm: "2026-10-19T05:10:15.000Z",
  locador: { nome: "Ana Souza", doc: cpfAleatorio() },
  locatario: { nome: "Bruno Lima", doc: cpfAleatorio() },
  imovelEndereco: "Rua das Acácias, 1234, Uberlândia",
  contratoRef: `CT-${randomUUID().slice(0, 8).toUpperCase()}`,
  periodoInicio: "2026-10-19",
  periodoFim: "2026-12-18",
  valor: 6400,
  encargos: [{ rotulo: "Condomínio", valor: 450 }],
  rotuloPagamento: "Bloco 1 (2 meses: 19/10 a 18/12) — R$ 6.400 (2 × R$ 3.200)",
  dataPagamento: "2026-10-19",
  forma: "pix",
  conferirUrl: `https://vivanomads.com.br/conferir/${randomBytes(16).toString("hex")}`,
  ...p,
});

test("3. 1.000 recibos com código sorteado e CPF só-dígitos → 0 bloqueios", () => {
  let bloqueados = 0;
  for (let i = 0; i < 1000; i++) {
    const d = recibo();
    assert.ok(cpfValido(d.locador.doc) && cpfValido(d.locatario.doc));
    if (temContato(textoDocumento(conteudoDocumento(d)))) bloqueados++;
    // com o número provisório (a checagem roda antes de reservar o definitivo), o resultado é o mesmo
    if (temContato(textoDocumento(conteudoDocumento({ ...d, numero: NUMERO_PROVISORIO })))) bloqueados++;
  }
  assert.equal(bloqueados, 0);
});

test("3. códigos que antes casavam com telefone (8+ dígitos seguidos) não disparam mais a trava", () => {
  for (const codigo of ["a1234567812345678b0000000000000000".slice(0, 32), "99999888800000000000000000000000", "0034999998888ffffffffffffffffffff".slice(0, 32)]) {
    assert.equal(codigo.length, 32);
    assert.equal(temContato(textoDocumento(conteudoDocumento(recibo({ conferirUrl: `https://vivanomads.com.br/conferir/${codigo}` })))), false, codigo);
  }
  assert.equal(temContato(textoDocumento(conteudoDocumento(recibo({ contratoRef: "CT-12345678" })))), false);
});

test("3. telefone e e-mail das pessoas continuam bloqueados", () => {
  assert.equal(temContato(textoDocumento(conteudoDocumento(recibo({ imovelEndereco: "Rua A, 10 — (34) 99999-8888" })))), true);
  assert.equal(temContato(textoDocumento(conteudoDocumento(recibo({ imovelEndereco: "Rua A, 10 — 34 99999 8888" })))), true);
  assert.equal(temContato(textoDocumento(conteudoDocumento(recibo({ locador: { nome: "Ana 34999998888", doc: null } })))), true);
  assert.equal(temContato(textoDocumento(conteudoDocumento(recibo({ locatario: { nome: "bruno@exemplo.com", doc: null } })))), true);
  assert.equal(temContato("(34) 99999-8888"), true);
});

test("3. a checagem roda ANTES de reservar o número (falha não queima número)", () => {
  const e = ler("./fiscal/emitir.ts");
  const checa = e.indexOf("if (temContato(textoDocumento(conteudoDocumento(dados))))");
  const reserva = e.indexOf('admin.rpc("proximo_numero_documento"');
  assert.ok(checa > 0 && reserva > 0 && checa < reserva, "temContato antes de proximo_numero_documento");
  assert.match(e, /numero: NUMERO_PROVISORIO,/);
  assert.equal((e.match(/proximo_numero_documento/g) ?? []).length, 1);
});

test("1. resultado por destinatário: só conta o envio confirmado (resposta real com id do Resend)", () => {
  const em = "2026-10-19T12:00:00.000Z";
  assert.deepEqual(resultadoEnvio("locador", { demo: false, id: "re_123" }, em), { papel: "locador", status: "enviado", resend_id: "re_123", erro: null, em });
  assert.deepEqual(resultadoEnvio("locatario", { demo: true }, em), { papel: "locatario", status: "simulado", resend_id: null, erro: null, em });
  assert.equal(resultadoEnvio("locador", { demo: false, error: "Resend 422: validation_error: x" }, em).status, "erro");
  assert.equal(resultadoEnvio("locador", { demo: false }, em).status, "erro"); // sem id não é envio
  assert.equal(resultadoEnvio("locador", null, em).erro, "sem resposta do envio");
  const ok = [resultadoEnvio("locador", { id: "a", demo: false }), resultadoEnvio("locatario", { id: "b", demo: false })];
  assert.equal(envioConfirmado(ok), true);
  assert.equal(envioConfirmado([ok[0]]), false);
  assert.equal(envioConfirmado([ok[0], resultadoEnvio("locatario", { demo: true })]), false);
  assert.equal(motivoFalhaEnvio(ok), null);
  assert.equal(motivoFalhaEnvio([ok[0], resultadoEnvio("locatario", { demo: true })]), null);
  assert.equal(
    motivoFalhaEnvio([ok[0], resultadoEnvio("locatario", { demo: false, error: "Resend 422: validation_error: Invalid `to` field." })]),
    "e-mail não enviado: Resend 422: validation_error: Invalid `to` field. (inquilino)",
  );
  // nunca o endereço
  for (const e of ok) assert.ok(!Object.values(e).some((v) => typeof v === "string" && v.includes("@")));
});

test("1. emitir: nada de `if (r) enviado = true`; envio por destinatário; enviado_em só com os dois confirmados", () => {
  const e = ler("./fiscal/emitir.ts");
  assert.doesNotMatch(e, /if \(r\) enviado = true/);
  assert.match(e, /envio\.push\(resultadoEnvio\(papel, r\)\)/);
  assert.match(e, /\.update\(\{ envio, enviado_em: envioConfirmado\(envio\) \? new Date\(\)\.toISOString\(\) : null \}\)/);
  assert.match(e, /registro do envio falhou/); // erro ao gravar não some em silêncio
  assert.doesNotMatch(e, /email: p\.email[^}]*\}\s*\)\s*;?\s*envio/); // o endereço nunca entra no registro
  // falha de envio → fila, etapa "envio"; "Reenviar e-mail" reenvia o PDF guardado, sem emitir documento novo
  assert.match(e, /const etapa = r\.ok \? "envio" : "emissao";/);
  const reenviar = e.slice(e.indexOf("export async function reenviarEmailDoDocumento"), e.indexOf("/** Pagamento confirmado pelo inquilino"));
  assert.match(reenviar, /\.storage\.from\(BUCKET_DOCUMENTOS\)\.download\(/);
  assert.doesNotMatch(reenviar, /proximo_numero_documento|\.insert\(/);
  assert.match(reenviar, /\/conferir\/\$\{d\.codigo_verificacao/);
});

test("1. fila: 'Reenviar e-mail' na falha de envio, 'Emitir de novo' na de emissão", () => {
  const c = ler("../app/(dashboard)/admin/documentos/falhas-client.tsx");
  assert.match(c, /f\.etapa === "envio" \?/);
  assert.match(c, /data-testid="documento-reenviar-email"/);
  assert.match(c, /"Reenviar e-mail"/);
  const a = ler("./data/documentos-falhas-actions.ts");
  assert.match(a, /export async function reenviarEmail\(/);
  assert.match(a, /if \(f\.etapa === "envio"\) return \{ ok: false/); // "Emitir de novo" não engole a falha de envio
  assert.match(a, /exigirAdminAal2/);
});

test("1. migração 0180: envio jsonb, etapa na fila e os documentos antigos voltam para a fila sem renumerar", () => {
  const m = ler("../../supabase/migrations/0180_documentos_envio.sql");
  const p = ler("../../supabase/producao/aplicar-0180.sql");
  const r = ler("../../supabase/producao/rollback/0180_rollback.sql");
  for (const s of [m, p]) {
    assert.match(s, /add column if not exists envio jsonb not null default '\[\]'::jsonb/);
    assert.match(s, /check \(etapa in \('emissao', 'envio'\)\)/);
    // o gatilho de imutabilidade (0083) libera "envio" junto com "enviado_em"; o resto do documento continua travado
    assert.match(s, /array\['enviado_em', 'envio', 'contrato_id'/);
    assert.match(s, /update public\.documentos_fiscais d set enviado_em = null/);
    assert.match(s, /'e-mail não confirmado: emitido antes do registro de envio', 'envio'/);
    assert.doesNotMatch(s, /numero\s*=/); // a lacuna 000001–000003 fica como está
  }
  assert.match(p, /^begin;/m);
  assert.match(p, /^commit;/m);
  assert.match(p, /'20261019000180', '0180_documentos_envio'/);
  assert.match(r, /drop column if exists envio/);
  assert.match(r, /from public\._bkp_0180_enviado_em/);
});

test("2. o corpo do erro do Resend vira o motivo (status + nome + mensagem), sem dados pessoais", () => {
  assert.equal(
    erroResend(422, JSON.stringify({ statusCode: 422, name: "validation_error", message: "Invalid `to` field. The email address needs to follow the `email@example.com` format." })),
    "Resend 422: validation_error: Invalid `to` field. The email address needs to follow the [e-mail] format.",
  );
  assert.equal(erroResend(403, JSON.stringify({ name: "validation_error", message: "You can only send testing emails to your own email address (ana@vivanomads.com.br)." })), "Resend 403: validation_error: You can only send testing emails to your own email address ([e-mail]).");
  assert.equal(erroResend(500, "Internal Server Error"), "Resend 500: Internal Server Error");
  assert.equal(erroResend(502, ""), "Resend 502");
  assert.equal(semDadosPessoais("ligue (34) 99999-8888 ou 529.982.247-25"), "ligue [número] ou [número]");
  assert.ok(erroResend(422, JSON.stringify({ name: "x", message: "a".repeat(1000) })).length <= 220);
});

test("2. sendEmail: 429 espera e tenta de novo; recusa devolve o motivo; sucesso exige id", async () => {
  const antes = { fetch: globalThis.fetch, key: process.env.RESEND_API_KEY, sim: process.env.INTEGRACOES_SIMULADAS, out: process.env.EMAIL_TEST_OUTBOX, err: console.error };
  process.env.RESEND_API_KEY = "re_teste";
  delete process.env.INTEGRACOES_SIMULADAS;
  delete process.env.EMAIL_TEST_OUTBOX;
  const logs: string[] = [];
  console.error = (...a: unknown[]) => void logs.push(a.join(" "));
  const resp = (status: number, corpo: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json", ...headers } });
  try {
    const fila = [resp(429, { statusCode: 429, name: "rate_limit_exceeded", message: "Too many requests." }, { "retry-after": "1" }), resp(200, { id: "re_abc" })];
    const corpos: string[] = [];
    globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
      corpos.push(String(init?.body));
      return fila.shift()!;
    }) as typeof fetch;
    const anexo = [{ filename: "REC-2026-000004.pdf", content: Buffer.from("%PDF-1.4 teste").toString("base64") }];
    const ok = await sendEmail({ to: "dono@vivanomads.com.br", subject: "Recibo", html: "<p>x</p>", attachments: anexo });
    assert.deepEqual(ok, { demo: false, id: "re_abc" });
    assert.equal(corpos.length, 2);
    // formato do anexo do Resend: { filename, content (base64) }
    assert.deepEqual(JSON.parse(corpos[0]).attachments, anexo);

    globalThis.fetch = (async () => resp(422, { statusCode: 422, name: "validation_error", message: "Invalid `to` field." })) as typeof fetch;
    const recusa = await sendEmail({ to: "x@vivanomads.com.br", subject: "Recibo", html: "<p>x</p>" });
    assert.deepEqual(recusa, { demo: false, error: "Resend 422: validation_error: Invalid `to` field." });
    assert.ok(logs.some((l) => l.includes("Resend 422: validation_error")));
    assert.ok(!logs.some((l) => l.includes("@vivanomads")), "o log não leva o endereço");

    globalThis.fetch = (async () => resp(200, {})) as typeof fetch;
    assert.equal((await sendEmail({ to: "x@vivanomads.com.br", subject: "s", html: "h" })).error, "Resend 200: resposta sem id");
  } finally {
    globalThis.fetch = antes.fetch;
    console.error = antes.err;
    if (antes.key === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = antes.key;
    if (antes.sim !== undefined) process.env.INTEGRACOES_SIMULADAS = antes.sim;
    if (antes.out !== undefined) process.env.EMAIL_TEST_OUTBOX = antes.out;
  }
});

test("2. Resend falso do laboratório só vale com INTEGRACOES_SIMULADAS (nunca em produção) e o lab o sobe", () => {
  const e = ler("./notifications/email.ts");
  assert.match(e, /const resendFalso = integracoesSimuladas\(\) \? process\.env\.LAB_RESEND_URL : undefined;/);
  const w = ler("../../.github/workflows/laboratorio.yml");
  assert.match(w, /LAB_RESEND_URL: http:\/\/127\.0\.0\.1:3999/);
  assert.match(w, /node scripts\/lab\/resend-falso\.mjs 3999/);
});

test("4. 'Registrado em' em pt-BR, e quem assinou o texto antigo (ISO) continua com o mesmo hash", () => {
  const dados = { contratoId: "VN-CT-1", imovel: "Apto", aluguelMensal: 3200, prazoDias: 60, ocupantes: 1, criadoEm: "2026-10-19", inicioEstadia: "2026-10-20" } as Parameters<typeof resumoContrato>[0];
  const linhas = resumoContrato(dados);
  assert.ok(linhas.includes("Registrado em: 19/10/2026"));
  assert.ok(!linhas.some((l) => /\d{4}-\d{2}-\d{2}/.test(l)));
  const antigas = linhas.map((l) => (l === "Registrado em: 19/10/2026" ? "Registrado em: 2026-10-19" : l));
  assert.deepEqual(linhasParaHash(linhas, hashResumo(antigas)), antigas);
  const antigasSemInicio = antigas.filter((l) => !l.startsWith("Início da estadia:"));
  assert.deepEqual(linhasParaHash(linhas, hashResumo(antigasSemInicio)), antigasSemInicio);
  assert.deepEqual(linhasParaHash(linhas, null), linhas);
  assert.deepEqual(linhasParaHash(linhas, hashResumo(linhas)), linhas);
});

test("anexo #873: na v3 as duas visões mostram o mesmo aviso de teto e nenhuma mostra 'Contrapropor'", () => {
  assert.equal(TEXTO_RODADAS_ESGOTADAS, "Esta proposta já teve 3 rodadas: agora é aceitar ou recusar.");
  assert.equal(tetoDeRodadasAtingido(MAX_VERSOES, true), true);
  assert.equal(tetoDeRodadasAtingido(2, true), false);
  assert.equal(tetoDeRodadasAtingido(3, false), false);
  for (const quem of ["owner", "tenant"] as const) {
    assert.equal(bloqueioContraproposta({ status: "enviada", versaoAtual: 3, quem, autorUltimaVersao: quem === "owner" ? "tenant" : "owner", negociacao: { aceita: true } } as unknown as Parameters<typeof bloqueioContraproposta>[0]), TEXTO_RODADAS_ESGOTADAS);
  }
  const d = ler("../app/(dashboard)/dashboard/propostas/[id]/proposta-detalhe.tsx");
  const aviso = d.indexOf('data-testid="proposta-teto-rodadas"');
  assert.ok(aviso > 0 && aviso < d.indexOf("{p.podeResponder && ("), "o aviso fica sob a pílula, fora de 'Sua resposta' (o dono também vê)");
  assert.match(d, /\{!p\.bloqueioContraproposta && \(\s*<Button[\s\S]{0,200}?data-testid="proposta-contrapropor"/);
});
