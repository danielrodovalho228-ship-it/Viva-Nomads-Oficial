/*
  Linha de ranking_sinais (0196) → SinaisAnuncio (Prompt 33, item 4) — PURO.
  Os campos restritos (resultado da matrícula, CAF) só existem aqui no servidor: ao cliente vão a nota,
  os selos e os motivos, nunca a linha.
*/
import type { NivelOuAdequacao } from "../../config/niveis.ts";
import { ehAnuncioDeTeste } from "../data/anuncio-teste.ts";
import type { SinaisAnuncio } from "./ordem.ts";

export interface LinhaRankingSinais {
  id: string;
  dono_id: string;
  titulo: string | null;
  dono_is_teste: boolean | null;
  fotos_total: number | null;
  comodos_distintos: number | null;
  descricao_palavras: number | null;
  regras_completas: boolean | null;
  endereco_exato: boolean | null;
  disponibilidade_confirmada_em: string | null;
  matricula_conferida: boolean | null;
  caf_real_ok: boolean | null;
  conversas: number | null;
  conversas_respondidas: number | null;
  resposta_media_min: number | null;
  avaliacoes_qtd: number | null;
  avaliacoes_media: number | string | null; // numeric chega como texto pelo PostgREST
  cancelamentos_dono_12m: number | null;
  preco_justo: boolean | null;
}

export interface ExtrasDoServidor {
  /** estadoIdentidade(...).estado === "confirmada" (fonte única da identidade). */
  identidadeConfirmada: boolean;
  /** Fotos entregues por fotógrafo parceiro e aceitas pelo dono (Prompt 31b). Até lá, false para todos. */
  fotosDeParceiro?: boolean;
  /** Prompt 57: etiqueta "Para trabalhar de casa" com internet medida (vigente, regra de videochamada) ou só informada. */
  homeOffice?: "medido" | "informado" | null;
  internetAbaixoMorador?: boolean;
  /** Prompt 59: pendências procedentes em 12 meses e soluções fora do prazo em 90 dias (contadas no servidor). */
  confortoProcedentes12m?: number;
  manutencaoFora90d?: number;
  /** Pendências do padrão mínimo abertas, contestadas ou vencidas (sinal "imóvel diferente do anúncio"). */
  confortoPendenciasAbertas?: number;
  /** Adendo 59.1: nível gravado (imovel_nivel). */
  nivel?: NivelOuAdequacao | null;
}

const n = (v: number | string | null | undefined) => (v == null || v === "" ? 0 : Number(v) || 0);

export function sinaisDaLinha(l: LinhaRankingSinais, extras: ExtrasDoServidor): SinaisAnuncio {
  const media = l.avaliacoes_media == null || l.avaliacoes_media === "" ? null : Number(l.avaliacoes_media);
  return {
    id: l.id,
    donoId: l.dono_id,
    ehExemplo: false, // anúncio do banco nunca é exemplo (exemplos não têm uuid)
    ehTeste: l.dono_is_teste === true || ehAnuncioDeTeste(l.titulo),
    fotosTotal: n(l.fotos_total),
    comodosDistintos: n(l.comodos_distintos),
    fotosDeParceiro: extras.fotosDeParceiro === true,
    descricaoPalavras: n(l.descricao_palavras),
    regrasCompletas: l.regras_completas === true,
    enderecoExato: l.endereco_exato === true,
    calendarioConfirmadoEm: l.disponibilidade_confirmada_em,
    // CAF simulado nunca conta (caf_real_ok já exclui); a fonte melhor é o estado da identidade do perfil.
    identidadeConfirmada: extras.identidadeConfirmada || l.caf_real_ok === true,
    matriculaConferida: l.matricula_conferida === true,
    conversas: n(l.conversas),
    conversasRespondidas: n(l.conversas_respondidas),
    respostaMediaMin: l.resposta_media_min == null ? null : Number(l.resposta_media_min),
    avaliacoesQtd: n(l.avaliacoes_qtd),
    avaliacoesMedia: media != null && Number.isFinite(media) ? media : null,
    cancelamentosDono12m: n(l.cancelamentos_dono_12m),
    precoJusto: l.preco_justo === true,
    homeOffice: extras.homeOffice ?? null,
    internetAbaixoMorador: extras.internetAbaixoMorador === true,
    confortoProcedentes12m: extras.confortoProcedentes12m ?? 0,
    manutencaoFora90d: extras.manutencaoFora90d ?? 0,
    confortoPendenciasAbertas: extras.confortoPendenciasAbertas ?? 0,
    nivel: extras.nivel ?? null,
  };
}
