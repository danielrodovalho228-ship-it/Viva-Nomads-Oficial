/**
 * Formulário da Convivência (regras da casa estruturadas, CAMPOS-1) no padrão E56 e no desenho da tela 06 dos mockups
 * aprovados (23/10 20:48): CADA regra — silêncio, fumo, festas, visitas — tem o seu toggle; desligada = não definida
 * (não vai ao servidor, não aparece no anúncio). Puro: a tela só desenha.
 */
import { nasceLigado, type EstadoBloco } from "./bloco-opcional.ts";
import { normalizarRegrasCasa, type Festas, type Fumo, type RegrasCasa } from "./regras-casa.ts";

export type RegraConvivencia = "silencio" | "fumo" | "festas" | "visitas";

export const REGRAS_CONVIVENCIA: { chave: RegraConvivencia; titulo: string; descricao: string }[] = [
  { chave: "silencio", titulo: "Horário de silêncio", descricao: "De que horas a que horas a casa pede silêncio." },
  { chave: "fumo", titulo: "Fumar", descricao: "Se pode fumar no imóvel ou só na área externa." },
  { chave: "festas", titulo: "Festas e eventos", descricao: "Se festas e eventos são permitidos." },
  { chave: "visitas", titulo: "Visitas", descricao: "Se o morador pode receber visitas, até que horas e se podem pernoitar." },
];

type SimNao = "" | "sim" | "nao";

/** Rascunho: "" = ainda não escolhido. `ligados` diz qual regra está ligada (desligada = não definida). */
export interface RegrasCasaForm {
  ligados: Record<RegraConvivencia, boolean>;
  silencioInicio: string;
  silencioFim: string;
  fumo: "" | Fumo;
  festas: "" | Festas;
  visitas: SimNao;
  visitasAte: string;
  pernoite: SimNao;
}

const simNao = (v: boolean | undefined): SimNao => (v === undefined ? "" : v ? "sim" : "nao");

/** Do salvo para o formulário: regra salva nasce ligada (aberta); sem regra, desligada (fechada). */
export function formDeRegrasCasa(r?: RegrasCasa | null): RegrasCasaForm {
  return {
    ligados: {
      silencio: nasceLigado(!!r?.silencio),
      fumo: nasceLigado(!!r?.fumo),
      festas: nasceLigado(!!r?.festas),
      visitas: nasceLigado(!!r?.visitas),
    },
    silencioInicio: r?.silencio?.inicio ?? "",
    silencioFim: r?.silencio?.fim ?? "",
    fumo: r?.fumo ?? "",
    festas: r?.festas ?? "",
    visitas: simNao(r?.visitas?.permitidas),
    visitasAte: r?.visitas?.ate ?? "",
    pernoite: simNao(r?.visitas?.pernoite),
  };
}

/** O que cada regra enviaria, ligada ou não (base do "tem dados" e do envio). */
function regras(f: Omit<RegrasCasaForm, "ligados">): RegrasCasa {
  const r: RegrasCasa = {};
  if (f.silencioInicio && f.silencioFim) r.silencio = { inicio: f.silencioInicio, fim: f.silencioFim };
  if (f.fumo) r.fumo = f.fumo;
  if (f.festas) r.festas = f.festas;
  if (f.visitas === "nao") r.visitas = { permitidas: false };
  if (f.visitas === "sim")
    r.visitas = {
      permitidas: true,
      ...(f.visitasAte ? { ate: f.visitasAte } : {}),
      ...(f.pernoite ? { pernoite: f.pernoite === "sim" } : {}),
    };
  return r;
}

/** Só as regras LIGADAS vão ao servidor; o servidor normaliza de novo. */
export function payloadDeRegrasCasa(f: RegrasCasaForm): RegrasCasa {
  const r = regras(f);
  const out: RegrasCasa = {};
  for (const { chave } of REGRAS_CONVIVENCIA) if (f.ligados[chave] && r[chave] !== undefined) Object.assign(out, { [chave]: r[chave] });
  return out;
}

/** A regra tem algo escolhido agora (desligar pede confirmação; ligada e escolhida conta como feita no medidor). */
export function regraTemDados(f: RegrasCasaForm, chave: RegraConvivencia): boolean {
  const r = regras(f);
  return !!normalizarRegrasCasa({ [chave]: r[chave] });
}

/** Desligar confirmado: a regra volta vazia e desligada. */
export function desligarRegra(f: RegrasCasaForm, chave: RegraConvivencia): RegrasCasaForm {
  const limpo: Partial<RegrasCasaForm> =
    chave === "silencio"
      ? { silencioInicio: "", silencioFim: "" }
      : chave === "fumo"
        ? { fumo: "" }
        : chave === "festas"
          ? { festas: "" }
          : { visitas: "", visitasAte: "", pernoite: "" };
  return { ...f, ...limpo, ligados: { ...f.ligados, [chave]: false } };
}

/** Estado das 4 regras para o medidor de completude (desligada = não se aplica). */
export function estadosConvivencia(f: RegrasCasaForm): EstadoBloco[] {
  return REGRAS_CONVIVENCIA.map(({ chave }) => ({ chave, ligado: f.ligados[chave], preenchido: regraTemDados(f, chave) }));
}
