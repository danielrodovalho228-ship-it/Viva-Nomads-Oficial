/**
 * E976 (WCAG 2.4.1) — o link "Pular para o conteúdo principal": oculto até receber o foco do teclado (estilo `.skip-link`,
 * globals.css) e sempre o primeiro focável da tela. Leva ao `<main id="conteudo">` da página, que aceita o foco
 * (`tabIndex={-1}`) para o Tab seguinte já cair dentro do conteúdo. O site público tem o mesmo link no layout dele;
 * este componente leva o salto ao painel logado e à página 404, que não o tinham.
 */
export function PularParaConteudo() {
  return (
    <a href="#conteudo" className="skip-link">
      Pular para o conteúdo principal
    </a>
  );
}
