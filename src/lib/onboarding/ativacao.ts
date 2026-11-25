/*
  Papéis em camadas e checklist de ativação (Prompt 43 — adendo da Conta e adendo de onboarding) — PURO.

  Conta única, sem "modo" escolhido à mão. Os papéis derivam do que a pessoa TEM:
    • Morador: sempre;
    • Proprietário: ao ter o primeiro imóvel ou rascunho;
    • Parceiro: com a solicitação enviada (aguardando a Viva) ou aprovada.
  O checklist de ativação de cada papel fica no topo do painel até a ativação e some sozinho. Lista com check e a ação
  dentro do item — sem barra, sem porcentagem. Os dados vêm do que já existe no banco (src/lib/data/ativacao.ts); quando
  o estado de ativação do Prompt 50 chegar, ele entra no lugar do carregador sem mudar esta função.
  Roda: node --test src/lib/onboarding/ativacao.test.ts
*/

export type Papel = "morador" | "proprietario" | "parceiro";

/** Estado da parceria: nenhuma, pedido na Viva (aguardando), aprovada (página ainda não publicada) ou publicada. */
export type EstadoParceria = "nenhuma" | "aguardando" | "recusada" | "aprovada" | "publicada";

export interface FatosConta {
  /** Nome e foto no perfil. */
  temNome: boolean;
  temFoto: boolean;
  favoritos: number;
  buscasSalvas: number;
  /** Candidaturas enviadas + pedidos de moradia publicados. */
  pedidosEnviados: number;
  /** Imóveis (qualquer estado) e rascunhos do dono. */
  imoveis: number;
  imoveisAtivos: number;
  /** O rascunho mais adiantado: tem endereço/dados, fotos mínimas e valor mensal. */
  rascunhoComDados: boolean;
  rascunhoComFotos: boolean;
  rascunhoComValor: boolean;
  parceria: EstadoParceria;
  pedidosParceiroAceitos: number;
  /** Entrou pela porta "Sou proprietário" (cadastro como dono), ainda sem imóvel: o checklist de dono já aparece. */
  entrouComoDono: boolean;
}

export interface PapelDaConta {
  papel: Papel;
  ativo: boolean;
  /** Frase curta do estado ("Aguardando aprovação da Viva"). */
  estado: string;
  /** Convite para quem ainda não tem o papel. */
  convite: { rotulo: string; href: string } | null;
}

export const ROTULO_PAPEL: Record<Papel, string> = { morador: "Morador", proprietario: "Proprietário", parceiro: "Parceiro" };

export function papeisDaConta(f: Pick<FatosConta, "imoveis" | "parceria">): PapelDaConta[] {
  const dono = f.imoveis > 0;
  const parceiroAtivo = f.parceria === "aprovada" || f.parceria === "publicada";
  return [
    { papel: "morador", ativo: true, estado: "Busque imóveis e envie pedidos.", convite: null },
    dono
      ? { papel: "proprietario", ativo: true, estado: f.imoveis === 1 ? "1 imóvel na sua conta." : `${f.imoveis} imóveis na sua conta.`, convite: null }
      : { papel: "proprietario", ativo: false, estado: "Para anunciar um imóvel mobiliado.", convite: { rotulo: "Anunciar um imóvel", href: "/dashboard/imoveis/novo" } },
    parceiroAtivo
      ? { papel: "parceiro", ativo: true, estado: f.parceria === "publicada" ? "Sua página está publicada." : "Aprovado. Publique sua página.", convite: null }
      : f.parceria === "aguardando"
        ? { papel: "parceiro", ativo: false, estado: "Aguardando aprovação da Viva.", convite: null }
        : { papel: "parceiro", ativo: false, estado: f.parceria === "recusada" ? "Pedido não aprovado." : "Para oferecer serviços a moradores e donos.", convite: { rotulo: "Quero ser parceiro", href: "/dashboard/parceiro" } },
  ];
}

export interface ItemAtivacao {
  id: string;
  texto: string;
  /** Linha de "para que serve" ou estado. */
  detalhe: string | null;
  feito: boolean;
  acao: { rotulo: string; href: string } | null;
}

export interface ChecklistAtivacao {
  papel: Papel;
  titulo: string;
  itens: ItemAtivacao[];
  /** Todos feitos: o checklist some. */
  ativado: boolean;
}

const item = (id: string, texto: string, feito: boolean, acao: ItemAtivacao["acao"], detalhe: string | null = null): ItemAtivacao => ({
  id,
  texto,
  detalhe,
  feito,
  acao: feito ? null : acao,
});

function fechar(papel: Papel, titulo: string, itens: ItemAtivacao[]): ChecklistAtivacao {
  return { papel, titulo, itens, ativado: itens.every((i) => i.feito) };
}

export function checklistMorador(f: FatosConta): ChecklistAtivacao {
  return fechar("morador", "Para encontrar seu imóvel", [
    item("perfil", "Nome e foto no perfil", f.temNome && f.temFoto, { rotulo: "Completar o perfil", href: "/dashboard/conta/perfil" }, "O dono vê quem pede antes de responder."),
    item("salvar", "Salvar uma busca ou um favorito", f.favoritos + f.buscasSalvas > 0, { rotulo: "Buscar imóveis", href: "/buscar" }),
    item("pedido", "Enviar o primeiro pedido", f.pedidosEnviados > 0, { rotulo: "Fazer um pedido de moradia", href: "/pedidos/novo" }, "Pedido não é contrato: nada é cobrado até vocês assinarem."),
  ]);
}

export function checklistProprietario(f: FatosConta): ChecklistAtivacao {
  const publicado = f.imoveisAtivos > 0;
  const continuar = { rotulo: "Continuar o anúncio", href: "/dashboard/imoveis/novo" };
  return fechar("proprietario", "Para publicar seu anúncio", [
    item("dados", "Endereço e dados do imóvel", publicado || f.rascunhoComDados, { rotulo: f.imoveis ? "Continuar o anúncio" : "Começar o anúncio", href: "/dashboard/imoveis/novo" }),
    item("fotos", "Fotos do imóvel", publicado || f.rascunhoComFotos, continuar, "Mínimo de 8, de dia e na horizontal."),
    item("valor", "Valor mensal", publicado || f.rascunhoComValor, continuar, "Você vê a taxa da faixa em reais antes de publicar."),
    item("publicar", "Publicar", publicado, continuar),
  ]);
}

export function checklistParceiro(f: FatosConta): ChecklistAtivacao {
  const enviada = f.parceria !== "nenhuma";
  const aprovada = f.parceria === "aprovada" || f.parceria === "publicada";
  return fechar("parceiro", "Para receber pedidos como parceiro", [
    item("solicitacao", "Solicitação enviada", enviada, { rotulo: "Enviar a solicitação", href: "/dashboard/parceiro" }),
    item(
      "analise",
      "Análise da Viva",
      aprovada,
      enviada ? { rotulo: "Falar com a Viva", href: "/ajuda/fale-com-a-viva" } : null,
      f.parceria === "aguardando" ? "Em análise. Resposta em até 1 dia útil." : f.parceria === "recusada" ? "Não aprovada. Fale com a Viva para entender o motivo." : null,
    ),
    item("pagina", "Página publicada", f.parceria === "publicada", aprovada ? { rotulo: "Publicar a página", href: "/dashboard/parceiro" } : null),
    item("pedido", "Primeiro pedido aceito", f.pedidosParceiroAceitos > 0, f.parceria === "publicada" ? { rotulo: "Ver pedidos", href: "/dashboard/parceiro#pedidos" } : null),
  ]);
}

/**
 * Prompt 50: o fato que ATIVA cada papel (gravado uma vez em ativacoes): morador = 1º pedido enviado; proprietário =
 * 1º anúncio publicado; parceiro = 1º pedido aceito.
 */
export function fatoDeAtivacao(papel: Papel, f: FatosConta): boolean {
  if (papel === "morador") return f.pedidosEnviados > 0;
  if (papel === "proprietario") return f.imoveisAtivos > 0;
  return f.pedidosParceiroAceitos > 0;
}

/**
 * Os checklists a mostrar no Início: um por papel ativo (o de parceiro desde a solicitação), só os que ainda não
 * ativaram. Morador sempre entra enquanto não ativar. Prompt 50: some na ATIVAÇÃO do papel (o fato, ou a data já
 * gravada em ativacoes), mesmo com outro item em aberto.
 */
export function checklistsDoInicio(f: FatosConta, ativados: Partial<Record<Papel, string | null>> = {}): ChecklistAtivacao[] {
  const lista = [checklistMorador(f)];
  if (f.imoveis > 0 || f.entrouComoDono) lista.push(checklistProprietario(f));
  if (f.parceria !== "nenhuma") lista.push(checklistParceiro(f));
  return lista.filter((c) => !c.ativado && !ativados[c.papel] && !fatoDeAtivacao(c.papel, f));
}
