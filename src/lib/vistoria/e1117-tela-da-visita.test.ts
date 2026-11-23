/*
  E1117 (ORDEM-DUET-514) — a tela de execução da visita não mente. Quatro defeitos, uma trava por perna; a trava de tela
  é a tests/e2e/specs/t1742-e1117-tela-da-visita-e-laudo.spec.ts. Aqui fica o que se prova sem navegador:
   1. "Enviar foto": o servidor só diz "Foto enviada." com a foto REGISTRADA (o erro do registro é lido e o arquivo
      que subiu sai do bucket); o formulário tira da tela o resultado anterior numa tentativa nova; o seletor de
      arquivo volta a "Nenhum arquivo escolhido" quando o formulário é limpo e diz o motivo quando falta o arquivo.
   2. Enviada a foto, a página da avaliação é refeita na mesma resposta (revalidatePath do caminho do pedido): a
      contagem, o roteiro e a lista do que falta mudam sem recarregar.
   3. "Concluir a visita" sai desativado enquanto faltar foto do roteiro, com o motivo ligado ao botão; a recusa do
      servidor continua lá (quem contornar a tela não conclui).
   4. O dB(A) guardado volta para a tela: a ação só diz "guardada" com a medição gravada e refaz a página; a página
      lê o último valor (só o avaliador designado, pela ação do servidor da avaliação) e mostra-o no campo e numa linha.
  Roda: node --test src/lib/vistoria/e1117-tela-da-visita.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dbaNoCampo, linhaDbaGuardado } from "./visita-avaliador.ts";

const RAIZ = new URL("../../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");
/** O corpo de uma função do arquivo de ações (do cabeçalho até a próxima função de topo). */
function corpoDe(fonte: string, cabecalho: string): string {
  const i = fonte.indexOf(cabecalho);
  assert.ok(i >= 0, `não achei "${cabecalho}"`);
  const resto = fonte.slice(i + cabecalho.length);
  const fim = resto.search(/\n(?:export )?(?:async )?function /);
  return fim >= 0 ? resto.slice(0, fim) : resto;
}

const ACOES = ler("src/lib/vistoria/laudo-actions.ts");
const FORM = ler("src/components/vistoria/form-acao.tsx");
const SELETOR = ler("src/components/ui/seletor-arquivo.tsx");
const TELA = ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx");

test("E1117 perna 1: 'Foto enviada.' só com a foto registrada; tentativa nova tira o resultado antigo; o seletor acompanha o formulário", () => {
  const gravar = corpoDe(ACOES, "async function gravarFoto(");
  // O registro da foto é conferido ANTES do "Foto enviada."; com erro, o arquivo sai do bucket e a resposta é de erro.
  const registro = gravar.indexOf('.from("vistoria_checklist_fotos").insert(');
  const sucesso = gravar.indexOf('mensagem: "Foto enviada."');
  assert.ok(registro >= 0 && sucesso > registro, "o registro vem antes do sucesso");
  const entre = gravar.slice(registro, sucesso);
  assert.match(gravar.slice(0, registro).split("\n").pop() ?? "", /const \{ error: erroRegistro \} = await /, "o erro do registro é lido");
  assert.match(entre, /if \(erroRegistro\) \{[\s\S]*storage\.from\(BUCKET\)\.remove\(\[path\]\)[\s\S]*return \{ ok: false, erro: "Não foi possível guardar a foto\. Envie de novo\." \};/);

  // O formulário: uma tentativa nova (enviada ou barrada pelo navegador) tira da tela o resultado anterior.
  assert.match(FORM, /onInvalidCapture=\{\(\) => setSuperado\(res\)\}/);
  assert.match(FORM, /onSubmitCapture=\{\(\) => setSuperado\(res\)\}/);
  assert.match(FORM, /const mostrar = res && res !== superado \? res : null;/);
  assert.doesNotMatch(FORM, /\{res && \(\s*<p role=/, "o parágrafo do resultado não sai mais direto de `res`");

  // O seletor: limpa o nome no reset do formulário e diz o motivo quando falta o arquivo obrigatório.
  assert.match(SELETOR, /form\.addEventListener\("reset", limpar\)/);
  assert.match(SELETOR, /if \(e\.currentTarget\.validity\.valueMissing\) setFalta\(true\);/);
  assert.match(SELETOR, /\{falta \? faltaTexto : nomes\.length === 0 \? "Nenhum arquivo escolhido"/);
  // Na tela da visita o motivo é o mesmo que o servidor diz.
  assert.match(TELA, /<SeletorArquivo name="foto"[^>]*required[^>]*faltaTexto="Escolha a foto\." \/>/);
  assert.match(gravar, /return \{ ok: false, erro: "Escolha a foto\." \};/);
});

test("E1117 perna 2: enviada a foto, a página desta avaliação é refeita (contagem, roteiro e faltas sem recarregar)", () => {
  const enviar = corpoDe(ACOES, "export async function enviarFotoAvaliacao(");
  assert.match(enviar, /const res = await gravarFoto\(c\.admin, c\.p\.id, form\);/);
  // Só quando a foto ficou registrada, e no caminho DESTA avaliação (a tela que a pessoa está a ver).
  assert.match(enviar, /if \(res\.ok\) revalidatePath\(`\$\{ROTA_AVALIADOR\}\/\$\{c\.p\.id\}`\);\s*return res;/);
  // A contagem, o roteiro e as faltas saem todos da mesma leitura de fotos da página (uma leitura nova refaz os três).
  assert.match(TELA, /data-testid="avaliacao-fotos-contagem">\{fotosLista\.length\} foto\(s\) enviada\(s\)\./);
  assert.match(TELA, /const roteiro = roteiroDaVisita\(fotosLista\.map\(\(f\) => f\.comodo\)\);/);
  assert.match(TELA, /const faltasRoteiro = agendada \? faltasDoRoteiro\(roteiro\) : \[\];/);
});

test("E1117 perna 3: 'Concluir a visita' desativado enquanto falta foto do roteiro, com o motivo ligado; o servidor continua a recusar", () => {
  // O botão: desativado pela mesma lista que escreve a frase, e apontando para ela.
  assert.match(TELA, /<p id="concluir-faltas-motivo"[^>]*role="status" data-testid="concluir-faltas">\{msgRoteiroIncompleto\(faltasRoteiro\)\}<\/p>/);
  assert.match(TELA, /<Button type="submit" size="sm" className="mt-2" disabled=\{faltasRoteiro\.length > 0\} aria-describedby=\{faltasRoteiro\.length > 0 \? "concluir-faltas-motivo" : undefined\}>Concluir a visita<\/Button>/);
  // A tela não é a única guarda: a ação recusa antes de mudar o estado.
  const concluir = corpoDe(ACOES, "export async function concluirVisita(");
  assert.match(concluir, /if \(faltas\.length\) return \{ ok: false, erro: msgRoteiroIncompleto\(faltas\) \};/);
  assert.ok(concluir.indexOf("if (faltas.length)") < concluir.indexOf('update({ status: "realizada"'), "a recusa vem antes de concluir");
});

test("E1117 perna 4: o dB(A) guardado volta para o campo e para a linha; 'guardada' só com a medição gravada", () => {
  // O valor como a pessoa o escreve: vírgula decimal, uma casa, sem zero à direita.
  assert.equal(dbaNoCampo(62.5), "62,5");
  assert.equal(dbaNoCampo(48), "48");
  assert.equal(dbaNoCampo(0), "0");
  assert.equal(dbaNoCampo(61.25), "61,3");
  assert.equal(dbaNoCampo(null), "");
  assert.equal(dbaNoCampo(undefined), "");
  assert.equal(dbaNoCampo(Number.NaN), "");
  assert.equal(linhaDbaGuardado(62.5), "Última medição guardada: 62,5 dB(A).");
  assert.equal(linhaDbaGuardado(0), "Última medição guardada: 0 dB(A).");
  assert.equal(linhaDbaGuardado(null), null);

  // A ação: lê o erro do registro antes de dizer "guardada" e refaz a página desta avaliação.
  const medir = corpoDe(ACOES, "export async function registrarMedicao(");
  const ramo = medir.slice(medir.indexOf('if (tipo === "ruido_dba") {'), medir.indexOf('if (tipo !== "internet")'));
  assert.match(ramo, /const \{ error: erroMedicao \} = await c\.admin\.from\("vistoria_medicoes"\)\.insert\(/);
  assert.match(ramo, /if \(erroMedicao\) return \{ ok: false, erro: "Não foi possível guardar a medição\. Tente de novo\." \};/);
  assert.ok(ramo.indexOf("if (erroMedicao)") < ramo.indexOf('mensagem: "Medição de ruído guardada (uso interno)."'), "o erro é lido antes do sucesso");
  assert.match(ramo, /revalidatePath\(`\$\{ROTA_AVALIADOR\}\/\$\{c\.p\.id\}`\);/);

  // A leitura: só o avaliador designado (comoAvaliador), só durante a visita e o laudo, o valor mais recente.
  const ler = corpoDe(ACOES, "export async function dbaGuardadoDaVisita(");
  assert.match(ler, /const c = await comoAvaliador\(pedidoId\);\s*if \(!c \|\| !EM_VISITA\.includes\(c\.p\.status\)\) return null;/);
  assert.match(ler, /\.eq\("tipo", "ruido_dba"\)\.order\("medido_em", \{ ascending: false \}\)\.limit\(1\)/);

  // A tela: o campo abre com o valor guardado e a linha diz o que ficou.
  assert.match(TELA, /const dbaGuardado = emVisita \? await dbaGuardadoDaVisita\(p\.id as string\) : null;/);
  assert.match(TELA, /<input key=\{dbaNoCampo\(dbaGuardado\)\} name="dba" inputMode="decimal" defaultValue=\{dbaNoCampo\(dbaGuardado\)\}/);
  assert.match(TELA, /data-testid="avaliacao-dba-guardado">\{linhaDbaGuardado\(dbaGuardado\)\}<\/p>/);
  // A página não lê a tabela das medições por conta própria (a guarda de quem lê vistoria_medicoes continua a valer).
  assert.doesNotMatch(TELA, /from\("vistoria_medicoes"\)/);
});
