/**
 * INTERNET MEDIDA NO IMÓVEL (Prompt 57, roteiro B3) — fonte ÚNICA dos números da regra.
 *
 * A frase de capacidade ("Boa para videochamadas") só sai com medição VÁLIDA do dono e só por esta regra fixa.
 * Sem medição, o anúncio mostra só o número informado pelo proprietário, sem dizer o que ele aguenta.
 */
export const INTERNET = {
  /** O aparelho precisa estar a até esta distância das coordenadas do imóvel para a medição valer. */
  raioValidacaoM: 300,
  /** Validade de uma medição do dono. */
  validadeMeses: 6,
  /** Aviso "Meça de novo a internet de …" ao dono, contado da data da medição. */
  avisoAposDias: 167, // ~5,5 meses
  /** Rodadas do teste; guarda a mediana. */
  rodadas: 2,
  /** Limite de medições por imóvel por dia (dono + morador). */
  limitePorDia: 6,
  /** Medição do morador abaixo desta fração da do dono vira sinal no painel de qualidade. */
  fracaoSinalMorador: 0.5,
  /** Regra de "Boa para videochamadas". */
  videochamada: { downloadMin: 25, uploadMin: 5, latenciaMax: 80 },
  /** Chips do filtro da busca (fase 2), download em Mbps. */
  chipsBusca: [50, 100, 300] as const,
} as const;

export const TEXTO_VIDEOCHAMADA = "Boa para videochamadas";
export const TEXTO_PARA_VALIDAR_NO_APP = "Para validar, meça pelo navegador do celular";
