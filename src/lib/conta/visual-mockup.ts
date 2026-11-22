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

/*
  Painel do avaliador (E1079, fatia 2): mockup avaliador-painel (celular). As cores foram medidas no próprio desenho.
*/

/** Saudação ("Olá, <primeiro nome>!") e a frase por baixo ("Você tem 1 visita hoje"). */
export const SAUDACAO_PAINEL_AVALIADOR = "font-title text-[34px] font-bold leading-tight text-[#2b2928]";
export const FRASE_PAINEL_AVALIADOR = "mt-1 text-xl text-[#5b5a56]";

/** O cartão do cabeçalho: a foto por cima e a faixa verde-escura com o botão "Ver pedidos". */
export const CABECALHO_PAINEL_AVALIADOR = `overflow-hidden rounded-xl ${SOMBRA_CARTAO_AVALIADORES}`;
export const FOTO_PAINEL_AVALIADOR = "grid aspect-[8/5] w-full place-items-center overflow-hidden bg-[#e8f0e8]";
export const FAIXA_PAINEL_AVALIADOR = "bg-[#123526] p-4 text-white";
export const TEXTO_FAIXA_PAINEL_AVALIADOR = "flex items-center gap-2 text-xl font-semibold";
export const BOTAO_PAINEL_AVALIADOR =
  "mt-3 flex min-h-14 w-full items-center justify-center rounded-xl bg-[#16452e] px-4 text-2xl font-bold text-white shadow-[0_6px_16px_rgba(0,0,0,0.25)] hover:bg-[#1c5237] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/** Os quatro cartões (Pedidos, Agenda, Recebidos, Credenciamento): ícone branco no círculo verde, título e texto. */
export const CARTAO_PAINEL_AVALIADOR = `flex h-full min-h-32 flex-col items-center justify-center rounded-xl bg-white p-4 text-center ${SOMBRA_CARTAO_AVALIADORES} hover:bg-[#fbf9f7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16452e]`;
export const ICONE_PAINEL_AVALIADOR = "grid h-12 w-12 place-items-center rounded-full bg-[#1c4430] text-white";
export const TITULO_CARTAO_PAINEL_AVALIADOR = "mt-2 text-xl font-semibold text-[#1f2123]";
export const TEXTO_CARTAO_PAINEL_AVALIADOR = "text-base text-[#60635e]";
export const DESTAQUE_CARTAO_PAINEL_AVALIADOR = "text-base text-[#0f4027]";
export const VALOR_CARTAO_PAINEL_AVALIADOR = "text-lg font-semibold text-[#1f2123]";

/*
  Laudo do avaliador (E1079, fatia 5): mockup avaliador-laudo (celular). As cores foram medidas no próprio desenho.
*/

/** Os três níveis em cartões de escolha: o escolhido ganha a moldura verde-escura e o círculo verde com o visto. */
export const CARTAO_NIVEL_LAUDO = `group flex cursor-pointer items-center justify-between gap-4 rounded-xl border-[6px] border-transparent bg-white p-4 ${SOMBRA_CARTAO_AVALIADORES} has-[:checked]:border-[#0b4830] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#0b4830]`;
export const TITULO_NIVEL_LAUDO = "block font-title text-[26px] font-bold leading-tight text-[#03090e]";
export const TEXTO_NIVEL_LAUDO = "block text-lg text-[#262628]";
export const MARCA_NIVEL_LAUDO =
  "grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-[#dadad8] text-transparent group-has-[:checked]:border-[#3d9150] group-has-[:checked]:bg-[#3d9150] group-has-[:checked]:text-white";

/** O resumo por baixo dos níveis: "12 fotos enviadas", "Checklist completo". */
export const RESUMO_LAUDO = `grid gap-3 rounded-xl bg-white p-4 ${SOMBRA_CARTAO_AVALIADORES}`;
export const LINHA_RESUMO_LAUDO = "flex items-center gap-3 text-lg text-[#090b0c]";
export const MARCA_RESUMO_LAUDO = { ok: "grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#3d9150] text-white", falta: "grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#969593] text-white" } as const;

/** O botão "Assinar laudo": largura inteira, verde-escuro. */
export const BOTAO_ASSINAR_LAUDO = "h-14 w-full rounded-xl bg-[#07492e] text-2xl font-bold text-white hover:bg-[#0b5a3a]";

/*
  Visita do avaliador (E1079, fatia 4): mockup avaliador-visita (celular). As cores foram medidas no próprio desenho.
*/

/** A foto do imóvel no topo e o cartão "Roteiro da visita", que sobe por cima da foto. */
export const CAPA_VISITA = "aspect-[16/9] w-full overflow-hidden rounded-xl bg-[#e8f0e8]";
export const CARTAO_ROTEIRO_VISITA = `relative rounded-xl bg-white p-4 ${SOMBRA_CARTAO_AVALIADORES}`;
export const CARTAO_ROTEIRO_SOBRE_A_CAPA = "-mt-8 mx-4";
export const TITULO_ROTEIRO_VISITA = "font-title text-2xl font-bold text-[#020d13]";
export const LINHA_ROTEIRO_VISITA = { feito: "flex items-center gap-3 text-xl text-[#000912]", porFazer: "flex items-center gap-3 text-xl text-[#424242]" } as const;
export const CAIXA_ROTEIRO_VISITA = {
  feito: "grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[#3b8d62] text-white",
  porFazer: "h-6 w-6 shrink-0 rounded-lg border-2 border-[#d6d4d0] bg-white",
} as const;

/** "Fotos do imóvel": miniaturas quadradas e as vagas tracejadas "Adicionar foto". */
export const TITULO_FOTOS_DA_VISITA = "font-title text-2xl font-bold text-[#020f14]";
export const MINIATURA_VISITA = "aspect-square w-full overflow-hidden rounded-lg bg-[#e8f0e8]";
export const VAGA_FOTO_VISITA =
  "flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#c9c5c0] text-center text-sm text-[#736d69] hover:border-[#0e4233] hover:text-[#0e4233] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0e4233]";

/** O botão "Continuar": largura inteira, verde-escuro. */
export const BOTAO_CONTINUAR_VISITA =
  "flex min-h-14 w-full items-center justify-center rounded-xl bg-[#0e4233] px-4 text-2xl font-bold text-white hover:bg-[#145241] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0e4233]";

/*
  Pedido do avaliador (E1079, fatia 3): mockup avaliador-pedido (celular). As cores foram medidas no próprio desenho.
*/

/** A etiqueta ao lado do título ("Novo": ocre do desenho; as outras etapas, verde-claro). */
export const ETIQUETA_PEDIDO_AVALIADOR = {
  novo: "inline-flex items-center rounded-full bg-[#c48131] px-3 py-1 text-base font-bold text-white",
  outras: "inline-flex items-center rounded-full bg-[#bad3ad] px-3 py-1 text-base font-bold text-[#0e4233]",
} as const;
/** A foto do imóvel e o cartão dos dados, que sobe por cima da foto. */
export const CAPA_PEDIDO_AVALIADOR = "aspect-[16/10] w-full overflow-hidden rounded-xl bg-[#e8f0e8]";
export const CARTAO_PEDIDO_AVALIADOR = `relative rounded-xl bg-white p-4 ${SOMBRA_CARTAO_AVALIADORES}`;
export const CARTAO_PEDIDO_SOBRE_A_CAPA = "-mt-6";
export const LINHA_PEDIDO_AVALIADOR = "flex items-start gap-3 text-xl text-[#1d2327]";
export const ICONE_PEDIDO_AVALIADOR = "mt-0.5 h-7 w-7 shrink-0 text-[#0e4233]";
/** A caixa do valor (verde-claro do desenho). */
export const CAIXA_VALOR_PEDIDO = "flex items-center gap-3 rounded-xl bg-[#bad3ad] px-4 py-3 text-xl font-bold text-[#0e4233]";
/** "Aceitar pedido" (cheio) e "Recusar" (contorno), lado a lado. */
export const BOTAO_ACEITAR_PEDIDO =
  "flex min-h-14 w-full items-center justify-center rounded-xl bg-[#054534] whitespace-nowrap px-2 text-lg font-bold text-white hover:bg-[#0b5a3a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#054534]";
export const BOTAO_RECUSAR_PEDIDO =
  "flex min-h-14 w-full items-center justify-center rounded-xl border-2 border-[#1b3a34] bg-white whitespace-nowrap px-2 text-lg font-bold text-[#1b3a34] hover:bg-[#f1f6f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1b3a34]";
