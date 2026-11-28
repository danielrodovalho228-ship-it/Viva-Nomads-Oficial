/*
  E1248 PR 1 — as telas, a leitura do comprovante e o pacote de provas (ESPEC-E1248 v11, 2.6, 2.7, 8.2-2A, 8.3 e 9-A;
  ORDENS 1326, 1332 e 1352). Casos M24, M25, M28 e M31, mais o campo do motivo e a hora do prazo na tela do morador.
  As regras são puras (devolucao-maquina.ts); as ligações conferem-se no código. A tela inteira prova-se na t1810.
  Roda: node --test src/lib/caucao/e1248-telas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const m = (await import("./devolucao-maquina.ts")) as unknown as Record<string, unknown>;
const f = <T>(nome: string) => {
  assert.equal(typeof m[nome], "function", `${nome} existe`);
  return m[nome] as T;
};
const ler = (p: string) => readFileSync(p, "utf8");
const corpoDe = (fonte: string, nome: string) => {
  const i = fonte.search(new RegExp(`export (async )?function ${nome}\\(`));
  assert.ok(i >= 0, `${nome} existe`);
  const j = fonte.indexOf("\nexport ", i + 1);
  return fonte.slice(i, j < 0 ? undefined : j);
};

const DONO = "d0d0d0d0-0000-4000-8000-000000000001";
const MORADOR = "a0a0a0a0-0000-4000-8000-000000000002";
const OUTRO = "a0a0a0a0-0000-4000-8000-000000000004";
const CAMINHO = `${DONO}/9f1c2b7e-1111-4222-8333-444455556666.pdf`;

test("M28. quem lê o comprovante: o dono que enviou, o morador do contrato e a equipe; outra conta, não", () => {
  const pode = f<(p: Record<string, unknown>) => boolean>("podeLerComprovante");
  const base = { caminho: CAMINHO, dono: DONO, morador: MORADOR, ehEquipe: false };
  assert.equal(pode({ ...base, uid: DONO }), true, "o dono que enviou");
  assert.equal(pode({ ...base, uid: MORADOR }), true, "o morador do contrato");
  assert.equal(pode({ ...base, uid: OUTRO, ehEquipe: true }), true, "a equipe");
  assert.equal(pode({ ...base, uid: OUTRO }), false, "outra conta");
  assert.equal(pode({ ...base, uid: DONO, caminho: `${OUTRO}/x.pdf` }), false, "o dono lê só o que ele enviou");
  assert.equal(pode({ ...base, uid: null }), false, "sem sessão");
  assert.equal(pode({ ...base, uid: MORADOR, morador: null }), false, "sem o morador lido, ninguém por ele");
});

test("M28. a rota do comprovante: link assinado de quem está logado; a autorização é própria (não a regra de leitura da tabela)", () => {
  const ROTA = "src/app/api/protegido/comprovante-devolucao/route.ts";
  assert.ok(existsSync(ROTA), "a rota existe");
  const r = ler(ROTA);
  assert.match(r, /verificarLink\(/, "o link assinado, de curta duração");
  assert.match(r, /v\.uid !== user\.id/, "o link é de quem está logado");
  assert.match(r, /podeLerComprovante\(/);
  assert.match(r, /ehAdmin\(/);
  assert.match(r, /admin\s*\.from\("caucao_acertos"\)[\s\S]*\.eq\("comprovante_path", v\.caminho\)/, "o acerto lê-se pelo servidor, pelo caminho");
  assert.doesNotMatch(r, /supabase\s*\.from\(/, "não se apoia no RLS da tabela (o responsável local leria)");
  assert.doesNotMatch(r, /getPublicUrl|createSignedUrl/, "sem link público e sem a URL crua do bucket");
  assert.match(r, /storage\.from\("conferencia"\)\.download/);
  assert.match(r, /no-store/);
});

test("M24 e M25. o rótulo do estado: com a disputa aberta, só \"contestada pelo morador\"; sem ela, o sufixo volta", () => {
  const rotulo = f<(p: Record<string, unknown>) => string>("rotuloDoAcerto");
  assert.equal(rotulo({ status: "desconto_contestado", disputaAberta: true }), "contestada pelo morador");
  assert.equal(rotulo({ status: "desconto_contestado", disputaAberta: false }), "contestada pelo morador — fale pela Central de Ajuda");
  assert.equal(rotulo({ status: "aguardando_confirmacao", disputaAberta: false }), "aguardando a confirmação do morador");
  assert.equal(rotulo({ status: "devolvida_integral", via: "morador" }), "devolução confirmada pelo morador");
  assert.equal(rotulo({ status: "desconto_confirmado", via: "morador" }), "devolução com descontos confirmada pelo morador");
  assert.equal(rotulo({ status: "devolvida_integral", via: null }), "devolução confirmada pelo morador", "o acerto anterior ao E1248, como hoje");
  assert.match(rotulo({ status: "devolvida_integral", via: "falta_de_resposta" }), /por falta de resposta/, "8.4-6: a palavra nas telas");
  assert.doesNotMatch(rotulo({ status: "devolvida_integral", via: "falta_de_resposta" }), /silêncio/i);
  assert.match(rotulo({ status: "desconto_confirmado", via: "central" }), /equipe da Viva/);
});

const TELA = ler("src/components/documentos/documentos-contrato.tsx");

test("M24. a tela do dono: na disputa aberta, a linha nova, o anexo do comprovante e nenhum botão de registrar", () => {
  const c = corpoDe(TELA, "DevolucaoCaucaoDono");
  assert.match(c, /rotuloDoAcerto\(/, "o rótulo sai da regra pura");
  assert.match(c, /linhaDoDonoNaDisputa\(\)/, "texto 2-A");
  assert.match(c, /acerto\?\.disputaAberta|acerto\.disputaAberta/);
  assert.match(c, /data-testid="devolucao-anexar"/);
  assert.match(c, /anexarComprovanteDaDevolucao\(/);
  const disputa = c.indexOf("disputaAberta");
  const botao = c.indexOf("Registrar devolução da caução");
  assert.ok(disputa >= 0 && disputa < botao, "a disputa aberta decide antes do botão de registrar");
  assert.doesNotMatch(c, /A devolução anterior foi contestada pelo morador\./, "ORDEM-1326: a frase antiga sai");
});

test("a tela do morador: o motivo da contestação e a hora do fim do prazo", () => {
  const c = corpoDe(TELA, "DevolucaoCaucaoInquilino");
  assert.match(c, /data-testid="devolucao-motivo"/);
  assert.match(c, /responderDevolucaoCaucao\(acerto\.id, r, motivo\)/);
  assert.match(c, /acerto\.prazoRespostaAte/);
  assert.match(c, /horaAnunciada\(/, "a hora vem do mesmo relógio do aviso (M13)");
});

test("o loader traz a disputa, o prazo e o link do comprovante (para quem o pode ler)", () => {
  const d = ler("src/lib/data/documentos-actions.ts");
  const c = corpoDe(d, "documentosDosContratos");
  for (const col of ["aviso_em", "contestado_em", "central_decisao", "confirmacao_via", "comprovante_path", "comprovante_pedido_em", "comprovante_anexado_em"]) assert.match(c, new RegExp(col), col);
  assert.match(c, /disputaAberta\(/);
  assert.match(c, /fimDoPrazoDeResposta\(/);
  assert.match(c, /linkDoComprovante\(/);
});

test("a Central: o botão da decisão no chamado, num componente irmão do da anulação", () => {
  const p = "src/app/(dashboard)/admin/atendimento/[id]/decidir-devolucao-central.tsx";
  assert.ok(existsSync(p));
  assert.match(ler(p), /decidirDevolucaoPelaCentral\(/);
  const cli = ler("src/app/(dashboard)/admin/atendimento/[id]/chamado-client.tsx");
  assert.match(cli, /\\\[devolucao\\\] acerto=/, "aparece no chamado com a nota do acerto");
  assert.match(cli, /<DecidirDevolucaoCentral /);
});

test("M31. o pacote de provas não traz o comprovante (fica fora por omissão)", () => {
  for (const p of ["src/lib/contrato-provas.ts", "src/lib/fiscal/pacote-provas.ts", "src/app/api/contrato/[id]/provas/route.ts", "src/app/api/admin/contratos/[id]/provas/route.ts"]) {
    const t = ler(p);
    assert.doesNotMatch(t, /comprovante_path|comprovante-devolucao|caucao_acertos/, p);
  }
});
