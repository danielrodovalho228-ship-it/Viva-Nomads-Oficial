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

/*
  Área de avaliadores (E1079): o set de 12 mockups aprovado pelo Daniel em 21/11/2026 (ORDEM-DUET-385: "faça agora,
  fazer idêntico", sob a mesma regra de 23/10 — as telas reais ficam idênticas aos mockups aprovados). Como nas telas
  da Conta, os estilos que a guarda da casa não permite no resto do site — título acima de 28 px e em negrito, cartões
  com sombra, pílulas de estado com fundo de cor — ficam AQUI, no mesmo arquivo de exceção. As cores foram medidas
  nos próprios desenhos. As regras da casa continuam valendo para o que os mockups não cobrem.
*/

/** Título da tela ("Avaliadores"): 34 px no celular, 60 px no computador, em negrito, no verde-escuro do desenho. */
export const TITULO_TELA_AVALIADORES = "font-title text-[34px] font-bold leading-tight text-[#03291a] lg:text-6xl";

/** Subtítulo do computador (o celular não tem). */
export const SUBTITULO_TELA_AVALIADORES = "mt-2 hidden text-xl text-[#3c3a38] lg:block";

/** A pílula "Admin" ao lado do título, no celular. */
export const PILULA_ADMIN = "rounded-lg bg-[#07593e] px-3 py-1 text-sm font-semibold text-white lg:hidden";

/** Cartão branco do desenho: canto de 12 px e a sombra suave. */
export const SOMBRA_CARTAO_AVALIADORES = "shadow-[0_8px_24px_rgba(28,40,32,0.08)]";
export const CARTAO_AVALIADORES = `rounded-xl bg-white p-4 ${SOMBRA_CARTAO_AVALIADORES} lg:p-6`;

/** Seção "solta" (Credenciamento): no celular só o título e os cartões de cada pessoa; no computador vira cartão. */
export const SECAO_SOLTA_AVALIADORES = `lg:rounded-xl lg:bg-white lg:p-6 lg:${SOMBRA_CARTAO_AVALIADORES}`;
export const CARTAO_PESSOA_AVALIADORES = `rounded-xl bg-white p-4 ${SOMBRA_CARTAO_AVALIADORES} lg:border lg:border-[#ecedea] lg:shadow-none`;

/** Título dentro do cartão ("Chave da Vistoria") e título de seção solta ("Credenciamento"). */
export const TITULO_CARTAO_AVALIADORES = "font-title text-xl font-bold text-[#03291a] 2xl:text-2xl";
export const TITULO_SECAO_AVALIADORES = "font-title text-2xl font-bold text-[#03291a]";

/** O círculo verde com o ícone, ao lado do título do cartão (só no computador, como no desenho). */
export const ICONE_TITULO_AVALIADORES = "hidden h-10 w-10 shrink-0 place-items-center rounded-full bg-[#055d3d] text-white lg:grid";

/** Pílula de estado: retângulo de canto 8 px, texto branco, fundo pela cor do estado. */
export const PILULA_ESTADO = "inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1 text-sm font-semibold text-white";
export const FUNDO_PILULA = {
  ok: "bg-[#3d9150]",
  atencao: "bg-[#d99a2c]",
  pendente: "bg-[#969593]",
  teste: "bg-[#ba741a]",
} as const;

/** Ícone redondo de cada condição da chave. */
export const ICONE_CONDICAO = {
  ok: "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#35954d] text-white",
  atencao: "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f1b51c] text-base font-bold text-white",
  pendente: "grid h-8 w-8 shrink-0 place-items-center text-[#969593]",
  teste: "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#ba741a] text-white",
} as const;

/** Nome da pessoa no cartão e o círculo das iniciais no verde-escuro do desenho (o Avatar pinta por estilo em linha). */
export const NOME_PESSOA_AVALIADORES = "font-title text-lg font-bold leading-tight text-[#02291a]";
export const AVATAR_AVALIADORES = "!bg-[#023928]";

/** Tabela de preços limpa: linha com divisor fino, ícone verde, valor à direita (maior e em negrito no computador). */
export const LINHA_TABELA_AVALIADORES = "flex items-center gap-3 border-b border-[#ecedea] py-3 last:border-b-0";
export const ICONE_TABELA_AVALIADORES = "h-6 w-6 shrink-0 text-[#2b7245] lg:hidden";
export const VALOR_TABELA_AVALIADORES = "text-base text-[#032e1d] lg:text-[22px] lg:font-bold";
export const BOTAO_EDITAR_TABELA = "mt-4 hidden items-center justify-center gap-2 rounded-lg bg-[#005030] px-4 py-2 text-base font-semibold text-white lg:inline-flex";
