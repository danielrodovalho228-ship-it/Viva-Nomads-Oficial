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

export interface ItemPassoDono {
  rotulo: string;
  feito: boolean;
  href: string;
}

export interface BlocoPrincipalDono {
  tipo: "rascunho" | "decisao" | "primeiro_anuncio" | "em_dia";
  titulo: string;
  /** "47% pronto" (só no rascunho). */
  pct: number | null;
  /** Linha logo abaixo do título ("Próximo passo: …" ou a decisão). */
  linha: string;
  botao: { rotulo: string; href: string };
  /** "Próximos passos" do rascunho (até 3: o feito mais recente e os que faltam). */
  passos: ItemPassoDono[];
  foto: string | null;
}

/** A pendência mais urgente: atrasada primeiro, depois o prazo mais próximo; sem prazo, a primeira da lista. */
export function alertaDoTopo(decisoes: readonly Decisao[]): Decisao | null {
  if (!decisoes.length) return null;
  const peso = (d: Decisao) => (d.atrasada ? 0 : d.prazo ? 1 : 2);
  return [...decisoes].sort((a, b) => peso(a) - peso(b) || (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"))[0];
}

export function blocoPrincipalDono(p: {
  rascunho: { id: string; pct: number; pronto: boolean; itens: { label: string; ok: boolean; href: string }[]; foto: string | null } | null;
  decisoes: readonly Decisao[];
  temAnuncio: boolean;
  fotoAnuncio: string | null;
}): BlocoPrincipalDono {
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
      botao: { rotulo: "Continuar de onde parou", href: falta?.href ?? `/dashboard/imoveis/novo?draft=${r.id}` },
      passos,
      foto: r.foto,
    };
  }
  const urgente = alertaDoTopo(p.decisoes);
  if (urgente) {
    return { tipo: "decisao", titulo: "Próximo passo", pct: null, linha: urgente.texto, botao: { rotulo: "Resolver agora", href: urgente.href }, passos: [], foto: p.fotoAnuncio };
  }
  if (!p.temAnuncio) {
    return {
      tipo: "primeiro_anuncio",
      titulo: "Anuncie seu primeiro imóvel",
      pct: null,
      linha: "Imóveis mobiliados de 30 a 180 dias, com o morador falando direto com você.",
      botao: { rotulo: "Anunciar meu imóvel", href: "/dashboard/imoveis/novo" },
      passos: [],
      foto: null,
    };
  }
  return { tipo: "em_dia", titulo: "Tudo em dia", pct: null, linha: "Nada pede sua decisão hoje.", botao: { rotulo: "Ver meus anúncios", href: "/dashboard/imoveis" }, passos: [], foto: p.fotoAnuncio };
}

export const PECA_NA_VIVA = {
  titulo: "Peça na Viva",
  texto: "O diferencial da Viva: peça e a rede responde.",
  principal: { rotulo: "Publicar pedido de moradia", href: "/pedidos/novo" },
  secundario: { rotulo: "Pedir um serviço", href: "/dashboard/servicos" },
} as const;

export const ATALHOS_INICIO_DONO = [
  { id: "agenda", rotulo: "Agenda", texto: "Veja visitas e manutenções", href: "/dashboard/agenda" },
  { id: "simulador", rotulo: "Simulador de rentabilidade", texto: "Estime receita mensal e despesas", href: "/dashboard/simulador" },
  { id: "recibos", rotulo: "Recibos e notas", texto: "Emissão e histórico de comprovantes", href: "/dashboard/recibos" },
] as const;
