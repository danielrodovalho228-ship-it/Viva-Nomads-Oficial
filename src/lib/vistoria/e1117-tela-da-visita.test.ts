/*
  E1117 (ORDEM-DUET-514) — a tela de execução da visita não mente. Quatro defeitos, uma trava por perna; a trava de tela
  é a tests/e2e/specs/t1742-e1117-tela-da-visita-e-laudo.spec.ts. Aqui fica o que se prova sem navegador:
   1. "Enviar foto": o servidor só diz "Foto enviada." com a foto REGISTRADA (o erro do registro é lido e o arquivo
      que subiu sai do bucket); o formulário tira da tela o resultado anterior numa tentativa nova; o seletor de
      arquivo volta a "Nenhum arquivo escolhido" quando o formulário é limpo e diz o motivo quando falta o arquivo.
   2. Enviada a foto, a página da avaliação é refeita na mesma resposta (revalidatePath do caminho do pedido): a
      contagem, o roteiro e a lista do que falta mudam sem recarregar.
  Roda: node --test src/lib/vistoria/e1117-tela-da-visita.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
