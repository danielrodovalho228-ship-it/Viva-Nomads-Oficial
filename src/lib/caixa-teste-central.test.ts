import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { definirGuardaCaixaTeste, sendEmail } from "./notifications/email.ts";
import { guardarNaCaixaTeste, type ClienteCaixaTeste, type RegistroEmailTeste } from "./notifications/caixa-teste.ts";
import { refContratoVN, tipoDaFalha, umaLinhaPorDocumento } from "./fiscal/fila-falhas.ts";

/*
  Complemento do #880 (reteste do Muse):
   1. a caixa de e-mails de teste é gravada num lugar só, dentro do sendEmail, depois do envio aceito: assim o
      recibo, o comprovante, o termo, a exclusão de conta, a recuperação… também chegam à caixa (antes só notify()
      e o código de assinatura gravavam). Só conta is_teste; conta real nunca. Do anexo, só o nome.
   2. a fila "Documentos com falha" mostra número, tipo, contrato, nomes, motivo e data; a chave é o documento.
*/
const raiz = fileURLToPath(new URL("../../", import.meta.url));
const ler = (rel: string) => readFileSync(join(raiz, rel), "utf8");

/** Cliente de serviço falso: perfis is_teste por id/e-mail e as linhas gravadas em emails_teste. */
function clienteFalso(perfisDeTeste: { id: string; email: string }[]) {
  const gravadas: RegistroEmailTeste[] = [];
  const cliente: ClienteCaixaTeste = {
    from(tabela: string) {
      return {
        select() {
          return {
            eq(_c: string, v: unknown) {
              assert.equal(v, true); // .eq("is_teste", true)
              return {
                limit() {
                  return {
                    eq(col: string, valor: unknown) {
                      const achou = perfisDeTeste.filter((p) => (col === "id" ? p.id === valor : p.email === valor));
                      return Promise.resolve({ data: achou.slice(0, 1).map((p) => ({ id: p.id })) });
                    },
                  };
                },
              };
            },
          };
        },
        insert(linha: RegistroEmailTeste) {
          assert.equal(tabela, "emails_teste");
          gravadas.push(linha);
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return { cliente, gravadas };
}

const TESTE = { id: "11111111-1111-4111-8111-111111111111", email: "dono.qa@lab.vivanomads.test" };

async function comResendAceitando<T>(fn: () => Promise<T>): Promise<T> {
  const antes = { fetch: globalThis.fetch, key: process.env.RESEND_API_KEY, sim: process.env.INTEGRACOES_SIMULADAS, out: process.env.EMAIL_TEST_OUTBOX };
  process.env.RESEND_API_KEY = "re_teste";
  delete process.env.INTEGRACOES_SIMULADAS;
  delete process.env.EMAIL_TEST_OUTBOX;
  globalThis.fetch = (async () => new Response(JSON.stringify({ id: "re_ok" }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;
  try {
    return await fn();
  } finally {
    globalThis.fetch = antes.fetch;
    if (antes.key === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = antes.key;
    if (antes.sim !== undefined) process.env.INTEGRACOES_SIMULADAS = antes.sim;
    if (antes.out !== undefined) process.env.EMAIL_TEST_OUTBOX = antes.out;
  }
}

test("1. sendEmail para conta de teste → 1 linha; conta real → 0; anexo só pelo nome; link com token não vai", async () => {
  const { cliente, gravadas } = clienteFalso([TESTE]);
  definirGuardaCaixaTeste((p) => guardarNaCaixaTeste(cliente, p));
  try {
    await comResendAceitando(async () => {
      const pdf = Buffer.from("%PDF-1.4 conteudo-secreto-do-pdf").toString("base64");
      const r = await sendEmail({
        to: TESTE.email,
        subject: "Seu recibo de pagamento",
        html: "<p>Segue o recibo</p>",
        text: "Segue em anexo o recibo de aluguel.",
        attachments: [{ filename: "REC-2026-000004.pdf", content: pdf }],
        evento: "recibo_emitido",
      });
      assert.equal(r.id, "re_ok");
      assert.equal(gravadas.length, 1);
      assert.equal(gravadas[0].evento, "recibo_emitido");
      // O envio põe a marca no assunto (rota rápida dos e-mails, item 2) e o remetente único no topo do corpo guardado.
      assert.equal(gravadas[0].assunto, "Seu recibo de pagamento · Viva Nomads");
      assert.match(gravadas[0].corpo, /^Remetente: Viva Nomads Brasil <suporte@vivanomads\.com\.br>/);
      assert.match(gravadas[0].corpo, /Anexo: REC-2026-000004\.pdf$/);
      assert.ok(!gravadas[0].corpo.includes(pdf) && !gravadas[0].corpo.includes("conteudo-secreto"), "o PDF não vai para a tabela");
      assert.equal(gravadas[0].usuario_id, TESTE.id);
      assert.ok(!JSON.stringify(gravadas[0]).includes(TESTE.email), "destinatário mascarado");

      // conta real: nada gravado
      await sendEmail({ to: "pessoa.real@gmail.com", subject: "Recibo", html: "<p>x</p>", attachments: [{ filename: "a.pdf", content: pdf }] });
      assert.equal(gravadas.length, 1);

      // sem evento → padrão "email"; link com token vira aviso
      await sendEmail({ to: TESTE.email, subject: "Confirme", html: "<p>x</p>", text: "Abra https://vivanomads.com.br/excluir-conta/confirmar?token=abc123 agora" });
      assert.equal(gravadas[1].evento, "email");
      assert.ok(!gravadas[1].corpo.includes("abc123"));
      assert.match(gravadas[1].corpo, /\[link com token removido\]/);
    });

    // recusa do Resend ou modo simulado: não grava (só o que saiu de verdade)
    process.env.INTEGRACOES_SIMULADAS = "on";
    const antes = gravadas.length;
    await sendEmail({ to: TESTE.email, subject: "Simulado", html: "<p>x</p>" });
    assert.equal(gravadas.length, antes);
    delete process.env.INTEGRACOES_SIMULADAS;
  } finally {
    definirGuardaCaixaTeste(null);
  }
});

test("1. um e-mail de notify() grava exatamente 1 linha (a gravação é só a do sendEmail)", () => {
  const n = ler("src/lib/notifications/index.ts");
  assert.doesNotMatch(n, /guardarSeContaDeTeste/);
  assert.equal((n.match(/await sendEmail\(/g) ?? []).length, 1);
  assert.match(n, /evento: params\.event,\s*usuarioId: params\.userId,/);
  const e = ler("src/lib/notifications/email.ts");
  assert.equal((e.match(/await capturarNaCaixaTeste\(/g) ?? []).length, 1, "uma captura por envio aceito");
  const corpo = e.slice(e.indexOf("if (res.ok) {"), e.indexOf("return { demo: false, id: data.id };"));
  assert.match(corpo, /if \(!data\.id\)[\s\S]*await capturarNaCaixaTeste\(/, "só depois do id do Resend");
});

test("1. guarda: nenhum arquivo chama guardarSeContaDeTeste fora de email.ts", () => {
  const achados: string[] = [];
  const varrer = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) varrer(p);
      else if (/\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n) && /guardarSeContaDeTeste\(/.test(readFileSync(p, "utf8"))) achados.push(p.slice(raiz.length));
    }
  };
  varrer(join(raiz, "src"));
  assert.deepEqual(achados.sort(), ["src/lib/notifications/caixa-teste-servidor.ts", "src/lib/notifications/email.ts"]);
});

test("1. o recibo, o comprovante e o termo vão com o evento certo; a assinatura e a recuperação também", () => {
  const f = ler("src/lib/fiscal/emitir.ts");
  assert.match(f, /recibo_aluguel: "recibo_emitido"/);
  assert.match(f, /comprovante_caucao: "comprovante_caucao_emitido"/);
  assert.match(f, /termo_devolucao_caucao: "termo_devolucao"/);
  assert.match(f, /evento: EVENTO_CAIXA\[doc\.tipo\]/);
  assert.match(ler("src/lib/data/contrato-assinar-actions.ts"), /evento: "contract_signature_code",\s*usuarioId: user\.id,/);
  assert.match(ler("src/lib/seguranca/recuperacao-actions.ts"), /evento: "recuperacao_2fa"/);
  assert.match(ler("src/lib/data/account-delete.ts"), /evento: "exclusao_conta"/);
});

test("2. fila legível: número, tipo e contrato por linha; com 2 falhas, 2 linhas diferentes; a chave é o documento", () => {
  assert.equal(refContratoVN("11281a61-aaaa-4bbb-8ccc-000000000000"), "VN-CT-11281A61");
  assert.equal(tipoDaFalha({ docTipo: "recibo_aluguel" }), "Recibo de locação");
  assert.equal(tipoDaFalha({ pagamentoTipo: "caucao" }), "Comprovante de Caução");
  assert.equal(tipoDaFalha({ acerto: true }), "Termo de devolução da Caução");
  const a = { id: "1", documentoId: "d1", pagamentoId: "p1", acertoId: null, atualizadoEm: "2026-10-19T05:00:00Z", numero: "REC-2026-000004", contrato: "VN-CT-D9C70197" };
  const b = { id: "2", documentoId: "d2", pagamentoId: "p2", acertoId: null, atualizadoEm: "2026-10-19T05:01:00Z", numero: "REC-2026-000005", contrato: "VN-CT-11281A61" };
  const linhas = umaLinhaPorDocumento([a, b]);
  assert.equal(linhas.length, 2);
  assert.notEqual(linhas[0].numero, linhas[1].numero);
  assert.notEqual(linhas[0].contrato, linhas[1].contrato);
  // a mesma chave duas vezes → uma linha só (a mais recente)
  const dup = umaLinhaPorDocumento([a, { ...a, id: "3", atualizadoEm: "2026-10-19T06:00:00Z" }]);
  assert.deepEqual(dup.map((x) => x.id), ["3"]);
  const c = ler("src/app/(dashboard)/admin/documentos/falhas-client.tsx");
  for (const t of ["falha-numero", "falha-tipo", "falha-contrato", "falha-proprietario", "falha-inquilino", "falha-motivo", "falha-data"]) assert.match(c, new RegExp(`data-testid="${t}"`));
  assert.match(ler("src/lib/data/documentos-falhas-actions.ts"), /umaLinhaPorDocumento\(/);
});
