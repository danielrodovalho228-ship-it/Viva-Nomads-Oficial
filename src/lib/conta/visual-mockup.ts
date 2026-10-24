/*
  Telas da Conta (perfil-01..08): estilos que vêm do set de mockups aprovado pelo Daniel (23/10 20:48) e que a guarda
  de estilo da casa (Prompt 40/45) não permite no resto do site. Decisão da coordenação (24/10, sob a ordem do Daniel
  de 23/10 20:53): nestas telas VALE O MOCKUP — rótulo "CONTA" em caixa alta espaçada, título do herói acima de 28 px,
  cartões com a sombra do desenho. Fica tudo AQUI, num lugar só; a guarda isenta apenas este arquivo
  (src/lib/estilo/estilo-padrao.test.ts). As regras da casa continuam valendo para o que os mockups não cobrem.
*/

/** Rótulo do menu lateral ("CONTA"), como no desenho. */
export const ROTULO_MENU_CONTA = "text-xs font-semibold uppercase tracking-[0.18em] text-muted";

/** Título (H1) de cada tela da Conta: o herói grande do desenho (36 px no celular, 48 px no computador). */
export const TITULO_TELA_CONTA = "font-title text-4xl font-semibold leading-tight text-ink lg:text-5xl";

/** A sombra suave dos cartões no desenho (menu lateral, cartões e espelho). */
export const SOMBRA_CARTAO_CONTA = "shadow-[0_8px_24px_rgba(28,40,32,0.08)]";

/** A mesma sombra só no computador / só no celular (o Perfil muda de cartão entre as duas larguras, como no desenho). */
export const SOMBRA_SO_COMPUTADOR = "sm:shadow-[0_8px_24px_rgba(28,40,32,0.08)]";
export const SOMBRA_SO_CELULAR = "max-sm:shadow-[0_8px_24px_rgba(28,40,32,0.08)]";

/** Na raiz da casca: todo cartão branco (section) dentro dela ganha a mesma sombra do desenho. */
export const CASCA_SOMBRA_CARTOES = "[&_section.bg-white]:shadow-[0_8px_24px_rgba(28,40,32,0.08)]";

/*
  Assistente de cadastro em 10 passos (cadastro-imovel-01..10, mesmo set de mockups e a mesma decisão de 24/10): o
  título grande de cada passo e a sombra dos cartões (opções do passo, prévia do anúncio).
*/
export const TITULO_PASSO_CADASTRO = "font-title text-3xl font-semibold leading-tight text-ink lg:text-5xl";
export const SOMBRA_CARTAO_CADASTRO = "shadow-[0_8px_24px_rgba(28,40,32,0.08)]";
