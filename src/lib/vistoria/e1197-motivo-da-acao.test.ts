/*
  E1197 (URGENTE, ordem do Daniel; âmbito julgado na ORDEM-DUET-904) — "Medir agora" e "Assinar laudo" devolviam
  "Esta ação não está disponível." ao avaliador no meio da visita do piloto, e o laudo ficou sem medição.
  Antes: uma guarda só (`SEM_ACESSO`) tapava causas distintas — a chave do piloto fechada para a conta, a sessão ou a
  conta errada, a visita ainda por concluir, a visita já concluída. E a foto da visita forçava a câmara.
  Depois: cada causa diz a sua frase (as que já existem, mais duas novas julgadas pelo Gerente); `SEM_ACESSO` fica só
  para o pedido que não existe; a foto da visita oferece câmara ou galeria.
  Roda: node --test src/lib/vistoria/e1197-motivo-da-acao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MSG_CONCLUA_A_VISITA,
  MSG_DESLIGADA,
  MSG_ENTRE_DE_NOVO,
  MSG_SEM_ACESSO,
  MSG_VISITA_CONCLUIDA,
  mensagemDaFalha,
  recusaDaMedicao,
  recusaDoLaudo,
} from "./motivo-da-acao.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("os textos: os que já existiam e os dois novos julgados na ORDEM-DUET-904", () => {
  assert.equal(MSG_SEM_ACESSO, "Esta ação não está disponível.");
  assert.equal(MSG_DESLIGADA, "A avaliação do imóvel ainda não está disponível.");
  assert.equal(MSG_ENTRE_DE_NOVO, "Entre de novo na conta deste pedido para continuar.");
  assert.equal(MSG_VISITA_CONCLUIDA, "Esta visita já foi concluída.");
  assert.equal(MSG_CONCLUA_A_VISITA, "Conclua a visita antes de enviar o laudo.");
  assert.match(ler("src/lib/vistoria/laudo-servidor.ts"), /erro: MSG_CONCLUA_A_VISITA \}|"Conclua a visita antes de enviar o laudo\."/, "a mesma frase do servidor");
});

test("a falha do avaliador: chave fechada, sessão ou conta, pedido inexistente — cada uma com a sua frase", () => {
  assert.equal(mensagemDaFalha("desligada"), MSG_DESLIGADA);
  assert.equal(mensagemDaFalha("sem_sessao"), MSG_ENTRE_DE_NOVO);
  assert.equal(mensagemDaFalha("outra_conta"), MSG_ENTRE_DE_NOVO);
  assert.equal(mensagemDaFalha("inexistente"), MSG_SEM_ACESSO, "o genérico fica só para o pedido que não existe");
});

test("'Medir agora': durante a visita passa; com o laudo emitido diz que a visita já foi concluída", () => {
  assert.equal(recusaDaMedicao("agendado"), null);
  assert.equal(recusaDaMedicao("realizada"), null);
  assert.equal(recusaDaMedicao("laudo_emitido"), MSG_VISITA_CONCLUIDA);
});

test("'Assinar laudo': com a visita concluída passa; antes dela, a frase do servidor", () => {
  assert.equal(recusaDoLaudo("realizada"), null);
  for (const antes of ["agendado", "designado", "pedido"]) assert.equal(recusaDoLaudo(antes), MSG_CONCLUA_A_VISITA, antes);
});

test("as cinco ações da visita separam a causa da falha do avaliador (e não voltam ao genérico único)", () => {
  const fonte = ler("src/lib/vistoria/laudo-actions.ts");
  for (const nome of ["salvarItens", "enviarFotoAvaliacao", "registrarMedicao", "salvarRuidoVisita", "enviarLaudo"]) {
    const corpo = fonte.slice(fonte.indexOf(`export async function ${nome}(`), fonte.indexOf("\n}\n", fonte.indexOf(`export async function ${nome}(`)));
    assert.match(corpo, /await avaliadorOuFalha\(/, `${nome} usa a leitura que diz a causa`);
    assert.match(corpo, /mensagemDaFalha\(/, `${nome} devolve a frase da causa`);
    assert.doesNotMatch(corpo, /if \(!c \|\|[^)]*\) return SEM_ACESSO;/, `${nome} não junta a falha e o estado no genérico`);
  }
  const medir = fonte.slice(fonte.indexOf("export async function registrarMedicao("));
  assert.match(medir.slice(0, medir.indexOf("\n}\n")), /recusaDaMedicao\(/);
  const laudo = fonte.slice(fonte.indexOf("export async function enviarLaudo("));
  assert.match(laudo.slice(0, laudo.indexOf("\n}\n")), /recusaDoLaudo\(/);
});

test("a foto da visita oferece câmara OU galeria: sem capture nesse input (só nesse)", () => {
  const pagina = ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx");
  const painel = pagina.slice(pagina.indexOf('id="enviar-foto"'), pagina.indexOf("</Panel>", pagina.indexOf('id="enviar-foto"')));
  assert.match(painel, /<SeletorArquivo name="foto"[^>]*rotulo="Tirar ou escolher foto"/);
  assert.doesNotMatch(painel, /capture=/, "o input da foto da visita não força a câmara");
});

test("a foto do item do checklist também oferece câmara OU galeria (extensão julgada na ORDEM-DUET-906)", () => {
  const checklist = ler("src/components/vistoria/checklist-avaliador.tsx");
  const i = checklist.indexOf("aria-label={`Foto do item: ${i.rotulo}`}");
  assert.ok(i > 0, "o input da foto do item existe");
  const input = checklist.slice(checklist.lastIndexOf("<input", i), checklist.indexOf("/>", i));
  assert.match(input, /type="file"/);
  assert.doesNotMatch(input, /capture=/, "o input da foto do item não força a câmara");
});
