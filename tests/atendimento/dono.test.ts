/*
  Dono do chamado: só a conta que abriu age pela Central de Ajuda. Admin NUNCA
  grava mensagem como "usuario" (caso VN-000100). node --test.
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { chamadoDoDono, ehDonoDoChamado, equipeAvisadaDaMensagem, type ClienteChamados } from "../../src/lib/atendimento/dono.ts";

const CLIENTE = "11111111-1111-1111-1111-111111111111";
const ADMIN = "22222222-2222-2222-2222-222222222222";
const CHAMADO = { id: "33333333-3333-3333-3333-333333333333", numero_publico: "VN-000100", usuario_id: CLIENTE, status: "aguardando_aprovacao" };

/** Banco falso. `filtra=false` imita a leitura do admin (vê tudo) e um filtro que falhe. */
function banco(filtra: boolean): ClienteChamados {
  return {
    from: () => ({
      select: () => {
        const filtros: [string, string][] = [];
        const q = {
          eq(coluna: string, valor: string) {
            filtros.push([coluna, valor]);
            return q;
          },
          async maybeSingle() {
            const linha = CHAMADO as Record<string, unknown>;
            const passa = !filtra || filtros.every(([c, v]) => linha[c] === v);
            return { data: passa ? { ...CHAMADO } : null };
          },
        };
        return q;
      },
    }),
  };
}

test("admin pedindo o chamado de outra conta → recusado (mesmo se a leitura deixar passar)", async () => {
  assert.equal(await chamadoDoDono(banco(true), ADMIN, { id: CHAMADO.id }, "id, status"), null);
  assert.equal(await chamadoDoDono(banco(false), ADMIN, { id: CHAMADO.id }, "id, status"), null);
  assert.equal(await chamadoDoDono(banco(false), ADMIN, { numero: "VN-000100" }, "id"), null);
});

test("a dona do chamado → liberada", async () => {
  const c = await chamadoDoDono(banco(true), CLIENTE, { id: CHAMADO.id }, "id, status");
  assert.equal(c?.usuario_id, CLIENTE);
});

test("ehDonoDoChamado: visitante e sem login nunca são dono", () => {
  assert.equal(ehDonoDoChamado({ usuario_id: null }, ADMIN), false);
  assert.equal(ehDonoDoChamado(CHAMADO, null), false);
  assert.equal(ehDonoDoChamado(null, CLIENTE), false);
  assert.equal(ehDonoDoChamado(CHAMADO, CLIENTE), true);
});

test("equipe é avisada da mensagem só quando quem atende é a equipe", () => {
  assert.equal(equipeAvisadaDaMensagem({ responsavel_tipo: "humano", status: "aguardando_aprovacao" }), true);
  assert.equal(equipeAvisadaDaMensagem({ responsavel_tipo: "ia", status: "em_andamento" }), false);
  assert.equal(equipeAvisadaDaMensagem({ responsavel_tipo: "humano", status: "encerrado" }), false);
});

/** Corpo de uma função exportada do arquivo de ações. */
function corpo(fonte: string, nome: string): string {
  const i = fonte.indexOf(`export async function ${nome}(`);
  assert.ok(i >= 0, nome);
  const j = fonte.indexOf("\nexport ", i + 10);
  return fonte.slice(i, j < 0 ? undefined : j);
}

test("toda ação da Central (ver, responder, falar com pessoa, resolveu) passa pela checagem de dono", () => {
  const fonte = readFileSync(new URL("../../src/lib/data/atendimento-actions.ts", import.meta.url), "utf8");
  for (const nome of ["meuChamado", "responderMeuChamado", "pedirPessoa", "marcarResolvido"]) {
    const f = corpo(fonte, nome);
    assert.match(f, /chamadoDoDono[<(]/, `${nome} sem checagem de dono`);
    assert.doesNotMatch(f, /supabase\s*\.from\("chamados"\)/, `${nome} lê o chamado sem checar o dono`);
  }
});

test("autor 'usuario' só é gravado em caminhos com dono conferido", () => {
  const acoes = readFileSync(new URL("../../src/lib/data/atendimento-actions.ts", import.meta.url), "utf8");
  // Fora de abrirChamado (chamado novo da própria pessoa), só responderMeuChamado grava como "usuario".
  const semAbrir = acoes.replace(corpo(acoes, "abrirChamado"), "");
  const gravacoes = semAbrir.split('autor: "usuario",').length - 1;
  assert.equal(gravacoes, 1);
  assert.match(corpo(acoes, "responderMeuChamado"), /autor: "usuario"/);
  assert.doesNotMatch(corpo(acoes, "responderComoAdmin"), /autor: "usuario"/);
  // E-mail: grava como "usuario" só se o remetente for o dono (conta ou visitante).
  const email = readFileSync(new URL("../../src/app/api/atendimento/email/route.ts", import.meta.url), "utf8");
  assert.match(email, /const dono = c && \(\(usuarioId && c\.usuario_id === usuarioId\)/);
});
