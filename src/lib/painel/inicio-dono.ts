/*
  PROP-6 — Início do dono como no mockup painel-proprietario (desktop e celular). PURO.
    • Faixa de alerta: a pendência MAIS urgente, uma só, com seta.
    • Bloco principal: "Continue seu anúncio" (com rascunho) ou "Próximo passo" (a decisão que espera o dono) ou, sem
      nada pendente, o caminho real (anunciar o 1º imóvel / ver os anúncios).
    • "Peça na Viva": Publicar pedido de moradia (cheio) e Pedir um serviço (contorno).
    • Três atalhos: Agenda, Simulador de rentabilidade, Recibos e notas.
  A foto do bloco principal é a capa do anúncio. Sem anúncio (ou sem foto), o bloco fica sem foto: a imagem padrão
  aprovada ainda não foi identificada, e nenhuma foto é inventada.
*/
import type { Decisao } from "./decisoes.ts";
import type { ChecklistAtivacao } from "../onboarding/ativacao.ts";

export interface ItemPassoDono {
  rotulo: string;
  feito: boolean;
  /** E494: null quando o passo leva ao MESMO lugar do botão do bloco (não é atalho; a lista só mostra o estado). */
  href: string | null;
  /** Linha curta de "para que serve" (o guia de ativação do dono traz; o rascunho, não). */
  detalhe?: string | null;
}

export interface BlocoPrincipalDono {
  /** E1093: "sem_leitura" = os anúncios (ou as decisões) não foram lidos agora; o bloco não afirma o que não leu. */
  tipo: "rascunho" | "decisao" | "primeiro_anuncio" | "em_dia" | "sem_leitura";
  titulo: string;
  /** "47% pronto" (só no rascunho). */
  pct: number | null;
  /** Linha logo abaixo do título ("Próximo passo: …" ou a decisão). */
  linha: string;
  botao: { rotulo: string; href: string };
  /** "Próximos passos" do rascunho (até 3: o feito mais recente e os que faltam). */
  passos: ItemPassoDono[];
  foto: string | null;
  /** E567: o nome do RASCUNHO a que o "% pronto" se refere (o dono não confunde com o anúncio já publicado). */
  nome?: string | null;
}

/** A pendência mais urgente: atrasada primeiro, depois o prazo mais próximo; sem prazo, a primeira da lista. */
export function alertaDoTopo(decisoes: readonly Decisao[]): Decisao | null {
  if (!decisoes.length) return null;
  const peso = (d: Decisao) => (d.atrasada ? 0 : d.prazo ? 1 : 2);
  return [...decisoes].sort((a, b) => peso(a) - peso(b) || (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"))[0];
}

export function blocoPrincipalDono(p: {
  /** E507: `retomar` é o destino único de retomada (hrefRetomarRascunho) — o mesmo do "Continuar editando" de Meus imóveis. */
  rascunho: { id: string; pct: number; pronto: boolean; itens: { label: string; ok: boolean; href: string }[]; foto: string | null; retomar?: string; nome?: string | null } | null;
  decisoes: readonly Decisao[];
  temAnuncio: boolean;
  fotoAnuncio: string | null;
  /**
   * E218-A: o guia de ativação do dono (checklistProprietario — dados, fotos ≥ 8, valor mensal, publicar), fonte única.
   * Mora DENTRO do bloco principal, na lista "Próximos passos" do mockup; nunca num bloco à parte (um guia só).
   */
  checklist?: ChecklistAtivacao | null;
  /**
   * E1093: o que o Início NÃO conseguiu ler nesta carga. Com os anúncios por ler, `temAnuncio` não quer dizer nada: o
   * bloco não pode dizer "Anuncie seu primeiro imóvel" a quem tem imóveis. Com as decisões por ler, não pode dizer "Tudo
   * em dia". O que foi lido (um rascunho, uma decisão) continua a valer.
   */
  naoLido?: { imoveis: boolean; decisoes: boolean };
}): BlocoPrincipalDono {
  const b = montarBloco(p);
  // E494: "Próximos passos" não repete o destino do botão principal (ex.: "Endereço" = "Continuar de onde parou").
  return { ...b, passos: b.passos.map((x) => (x.href === b.botao.href ? { ...x, href: null } : x)) };
}

function montarBloco(p: Parameters<typeof blocoPrincipalDono>[0]): BlocoPrincipalDono {
  const r = p.rascunho;
  if (r && !r.pronto) {
    const falta = r.itens.find((i) => !i.ok) ?? null;
    const feitos = r.itens.filter((i) => i.ok);
    const passos = [...feitos.slice(-1), ...r.itens.filter((i) => !i.ok)].slice(0, 3).map((i) => ({ rotulo: i.label, feito: i.ok, href: i.href }));
    return {
      tipo: "rascunho",
      titulo: "Continue seu anúncio",
      pct: Math.max(0, Math.min(100, Math.round(r.pct))),
      linha: falta ? `Próximo passo: ${falta.label.charAt(0).toLowerCase()}${falta.label.slice(1)}` : "Falta revisar e publicar",
      botao: { rotulo: "Continuar de onde parou", href: r.retomar ?? falta?.href ?? `/dashboard/imoveis/novo?draft=${r.id}` },
      passos,
      foto: r.foto,
      nome: r.nome ?? null,
    };
  }
  // E218-A, caso obrigatório: rascunho PRONTO e ainda não publicado → revisar e publicar ESSE rascunho (antes caía em
  // "Anuncie seu primeiro imóvel", que abria um anúncio novo).
  if (r && r.pronto) {
    return {
      tipo: "rascunho",
      titulo: "Publique seu anúncio",
      pct: 100,
      linha: "Tudo pronto: falta revisar e publicar.",
      botao: { rotulo: "Revisar e publicar", href: `/dashboard/imoveis/novo?draft=${r.id}&etapa=revisao` },
      passos: [],
      foto: r.foto,
      nome: r.nome ?? null,
    };
  }
  const urgente = alertaDoTopo(p.decisoes);
  if (urgente) {
    return { tipo: "decisao", titulo: "Próximo passo", pct: null, linha: urgente.texto, botao: { rotulo: "Resolver agora", href: urgente.href }, passos: [], foto: p.fotoAnuncio };
  }
  // E1093: daqui para baixo o bloco afirma algo sobre os anúncios ("não tem nenhum") ou sobre as decisões ("nada
  // pendente"). Sem a leitura, diz que não leu e leva aos anúncios — nunca ao cadastro de um imóvel novo.
  if (p.naoLido?.imoveis) return blocoSemLeitura(TEXTO_ANUNCIOS_NAO_LIDOS, null);
  if (!p.temAnuncio) {
    return {
      tipo: "primeiro_anuncio",
      titulo: "Anuncie seu primeiro imóvel",
      pct: null,
      linha: "Imóveis mobiliados de 30 a 180 dias, com o morador falando direto com você.",
      botao: { rotulo: "Anunciar meu imóvel", href: "/dashboard/imoveis/novo" },
      // E218-A: o que o dono vai precisar, antes de começar — o guia de ativação, item a item.
      passos:
        p.checklist && !p.checklist.ativado
          ? p.checklist.itens.map((i) => ({ rotulo: i.texto, feito: i.feito, href: i.acao?.href ?? "/dashboard/imoveis/novo", detalhe: i.detalhe }))
          : [],
      foto: null,
    };
  }
  if (p.naoLido?.decisoes) return blocoSemLeitura(TEXTO_DECISOES_NAO_LIDAS, p.fotoAnuncio);
  return { tipo: "em_dia", titulo: "Tudo em dia", pct: null, linha: "Nada pede sua decisão hoje.", botao: { rotulo: "Ver meus anúncios", href: "/dashboard/imoveis" }, passos: [], foto: p.fotoAnuncio };
}

/** E1093: os textos do bloco quando a leitura falhou (o aviso do topo, avisoInicioSemLeitura, diz o que faltou ler). */
export const TITULO_SEM_LEITURA = "Seus anúncios";
export const TEXTO_ANUNCIOS_NAO_LIDOS = "Não foi possível ler os seus anúncios agora. Recarregue a página em instantes.";
export const TEXTO_DECISOES_NAO_LIDAS = "Não foi possível ler as suas pendências agora. Recarregue a página em instantes.";

function blocoSemLeitura(linha: string, foto: string | null): BlocoPrincipalDono {
  return { tipo: "sem_leitura", titulo: TITULO_SEM_LEITURA, pct: null, linha, botao: { rotulo: "Ver meus anúncios", href: "/dashboard/imoveis" }, passos: [], foto };
}

export const PECA_NA_VIVA = {
  titulo: "Peça na Viva",
  texto: "O diferencial da Viva: peça e a rede responde.",
  principal: { rotulo: "Publicar pedido de moradia", href: "/pedidos/novo" },
  secundario: { rotulo: "Pedir um serviço", href: "/dashboard/servicos" },
} as const;

export const ATALHOS_INICIO_DONO = [
  { id: "agenda", rotulo: "Agenda", texto: "Veja visitas e manutenções", href: "/dashboard/agenda" },
  { id: "simulador", rotulo: "Simulador do imóvel", texto: "Rentabilidade e retorno com os seus números", href: "/dashboard/simulador" },
  { id: "recibos", rotulo: "Recibos e notas", texto: "Emissão e histórico de comprovantes", href: "/dashboard/recibos" },
] as const;
