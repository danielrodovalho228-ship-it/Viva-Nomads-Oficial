/*
  E587 (reteste ao vivo de 05/11, "[TESTE QA] Publicável 0264 A"): com o documento "Conferido", anexar um documento
  novo no cadastro fazia a conferência automática devolver o novo na hora, e o estado aprovado SUMIA da revisão
  ("Corrija o documento"). Enquanto isso, a lista do dono e o admin seguiam com "Aprovado". O banco estava certo
  (linha nova à parte, E-DOC-VIGENTE #2343); quem trocava a história era a TELA: a resposta de /api/documentos/conferir
  trazia só o veredito do novo, e o editor o punha no lugar do estado do documento.
  Correção: a rota diz se há aprovado vigente, e a tela segue "Documentação conferida", com o envio novo À PARTE
  ("em análise" ou "recusado, o aprovado continua valendo"). A troca só acontece quando o novo é aprovado.
  Reativação (vigia 05/11): havendo aprovado vigente, TODO envio novo fica em análise para a equipe — a conferência
  automática não decide na hora (nem recusa, nem aprova); o veredito dela fica só na trilha (conferencia) para a equipe.
  Roda: node --test src/lib/documento/e587-vigente-na-tela.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decisaoComVigente, resultadoNaTela, novoDoStatus, TEXTO_NOVO_EM_ANALISE, TEXTO_NOVO_RECUSADO } from "./vigente.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const MOTIVOS = ["Tipo de documento não aceito", "Documento ilegível ou incompleto"];

test("(1)(3) aprovado vigente + novo recusado na hora: a tela segue conferida, o novo fica à parte com os motivos", () => {
  assert.deepEqual(resultadoNaTela(true, "corrija", MOTIVOS), { estado: "aprovado", motivos: [], novo: { estado: "corrija", motivos: MOTIVOS } });
});

test("(2) aprovado vigente + novo em revisão: a tela segue conferida, o novo aparece em análise", () => {
  assert.deepEqual(resultadoNaTela(true, "revisao", ["A equipe confere"]), { estado: "aprovado", motivos: [], novo: { estado: "revisao", motivos: ["A equipe confere"] } });
});

test("(4) aprovado vigente + novo aprovado: o novo passa a ser o vigente (sem nada à parte)", () => {
  assert.deepEqual(resultadoNaTela(true, "aprovado", []), { estado: "aprovado", motivos: [], novo: null });
});

test("sem aprovado vigente: o fluxo de sempre (o resultado do envio é o estado da tela)", () => {
  assert.deepEqual(resultadoNaTela(false, "corrija", MOTIVOS), { estado: "corrija", motivos: MOTIVOS, novo: null });
  assert.deepEqual(resultadoNaTela(false, "revisao", []), { estado: "revisao", motivos: [], novo: null });
});

test("ao reabrir a tela, o envio novo gravado vem à parte (mesma história da lista e do admin)", () => {
  assert.deepEqual(novoDoStatus("pending", null), { estado: "revisao", motivos: [] });
  assert.deepEqual(novoDoStatus("rejected", "Tipo de documento não aceito · Documento ilegível ou incompleto"), { estado: "corrija", motivos: MOTIVOS });
  assert.equal(novoDoStatus(null, null), null);
});

test("rota: diz se há aprovado vigente (lido ANTES de gravar o novo) e nunca altera a linha aprovada", () => {
  const r = ler("app/api/documentos/conferir/route.ts");
  assert.match(r, /const vigenteAprovado = await temAprovadoVigente\(/);
  assert.equal((r.match(/^\s+vigenteAprovado,$/gm) ?? []).length, 2, "as duas respostas (matrícula e outros) levam o vigenteAprovado");
  assert.doesNotMatch(r, /\.update\(/, "a conferência só insere linha nova");
});

test("tela: o componente aplica resultadoNaTela e mostra o novo à parte; o editor guarda o novo separado", () => {
  const c = ler("components/anuncio/documento-vinculo.tsx");
  assert.match(c, /resultadoNaTela\(r\.vigenteAprovado === true, r\.estado, r\.motivos \?\? \[\]\)/);
  assert.match(c, /data-testid="documento-novo"/);
  assert.match(c, /TEXTO_NOVO_EM_ANALISE/);
  assert.match(c, /TEXTO_NOVO_RECUSADO/);
  const p = ler("app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  assert.match(p, /setDocNovo\(novoDoStatus\(r\.novo, r\.motivoNovo\)\)/);
  assert.equal((p.match(/setDocNovo\(novo \?\? null\)/g) ?? []).length, 2, "os dois pontos de envio (início e passo do documento)");
  assert.ok(TEXTO_NOVO_EM_ANALISE && TEXTO_NOVO_RECUSADO);
});

test("com aprovado vigente, a conferência automática não decide: todo envio novo vai para a equipe", () => {
  for (const auto of ["aprovado", "corrija", "revisao"] as const) assert.equal(decisaoComVigente(true, auto), "revisao", auto);
  for (const auto of ["aprovado", "corrija", "revisao"] as const) assert.equal(decisaoComVigente(false, auto), auto, auto);
});

test("rota: com vigente, grava o novo como pendente da equipe (os dois ramos), avisa a equipe e não devolve a leitura", () => {
  const r = ler("app/api/documentos/conferir/route.ts");
  assert.match(r, /const estadoFinal = decisaoComVigente\(vigenteAprovado, r\.estado\);/);
  assert.match(r, /document_status: statusDoEstado\(estadoFinal\)/);
  assert.match(r, /const estado = decisaoComVigente\(vigenteAprovado, estadoTelaDaMatricula\(d\.resultado\)\);/);
  assert.match(r, /document_status: vigenteAprovado \? "pending" : statusDaMatricula\(d\.resultado\)/);
  assert.match(r, /matricula: vigenteAprovado \? undefined : \{/);
  assert.match(r, /if \(estadoFinal === "revisao"\) await avisarAdmins\(\);/);
});
