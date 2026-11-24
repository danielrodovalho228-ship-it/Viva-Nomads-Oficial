/**
 * Para as travas de unidade que leem o código-fonte: devolve o código sem os comentários, para a trava conferir o que a
 * tela faz e não o que um comentário conta.
 *
 * Por que existe (ORDEM-DUET-682): cada trava tinha a sua cópia, e a cópia tirava "tudo entre barra-asterisco e
 * asterisco-barra", em qualquer ponto do arquivo. Na página do avaliador há um `accept="application/pdf,image/*"`:
 * esse "/*" está dentro de um texto, mas a cópia tomava-o por começo de comentário e apagava tudo até ao fim do
 * comentário seguinte — 169 linhas de tela (108 a 276). As travas do E1101, do E1146, do E1153 e do E1155 liam a página
 * sem essas linhas.
 *
 * O que sai: o comentário JSX entre chaves, o comentário de bloco que COMEÇA a linha e a linha que é só comentário.
 * O que fica de propósito: o comentário no fim de uma linha de código. Tirá-lo pedia saber onde acaba um texto, e é aí
 * que mora o engano; ficar com um comentário a mais nunca cega a trava.
 */
export function fonteSemComentarios(codigo: string): string {
  return codigo
    .replace(/\{[ \t]*\/\*(?:(?!\*\/)[\s\S])*\*\/[ \t]*\}/g, "")
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}
