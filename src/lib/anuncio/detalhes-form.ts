/**
 * CAMPOS-2 — formulário dos detalhes opcionais (padrão E56), puro: rascunho, estado inicial dos toggles, o que vai ao
 * servidor, "tem dados" de cada grupo e o estado para o medidor de completude. A tela só desenha.
 */
import { nasceLigado, type EstadoBloco } from "./bloco-opcional.ts";
import { GRUPOS_DETALHE, normalizarDetalhes, type ChaveGrupoDetalhe, type DetalhesAnuncio } from "./detalhes-anuncio.ts";

type SimNao = "" | "sim" | "nao";

/** Rascunho do formulário (texto até o servidor validar) + qual grupo está ligado. */
export interface DetalhesForm {
  ligados: Record<ChaveGrupoDetalhe, boolean>;
  incluidoNoPreco: string[];
  areasCondominio: string[];
  andar: string;
  elevador: SimNao;
  entradaDe: string;
  entradaAte: string;
  saidaAte: string;
  vagaCoberta: SimNao;
  vagaTipo: "" | "fixa" | "rotativa";
  vagaObs: string;
}

const sn = (v: boolean | undefined): SimNao => (v === undefined ? "" : v ? "sim" : "nao");
const bool = (v: SimNao) => (v === "" ? undefined : v === "sim");

/** Do salvo para o formulário: grupo com dado salvo nasce ligado (aberto); sem dado, desligado (fechado). */
export function formDeDetalhes(d?: DetalhesAnuncio | null): DetalhesForm {
  const n = normalizarDetalhes(d) ?? {};
  return {
    ligados: {
      incluidoNoPreco: nasceLigado(!!n.incluidoNoPreco),
      areasCondominio: nasceLigado(!!n.areasCondominio),
      andar: nasceLigado(!!n.andar),
      janela: nasceLigado(!!n.janela),
      vaga: nasceLigado(!!n.vaga),
    },
    incluidoNoPreco: n.incluidoNoPreco ?? [],
    areasCondominio: n.areasCondominio ?? [],
    andar: n.andar ? String(n.andar.andar) : "",
    elevador: sn(n.andar?.elevador),
    entradaDe: n.janela?.entradaDe ?? "",
    entradaAte: n.janela?.entradaAte ?? "",
    saidaAte: n.janela?.saidaAte ?? "",
    vagaCoberta: sn(n.vaga?.coberta),
    vagaTipo: n.vaga?.tipo ?? "",
    vagaObs: n.vaga?.observacao ?? "",
  };
}

/** O que cada grupo enviaria (ligado ou não) — base do "tem dados" e do envio. */
function grupos(f: DetalhesForm): DetalhesAnuncio {
  return {
    incluidoNoPreco: f.incluidoNoPreco as DetalhesAnuncio["incluidoNoPreco"],
    areasCondominio: f.areasCondominio as DetalhesAnuncio["areasCondominio"],
    andar: f.andar.trim() !== "" ? { andar: Number(f.andar), elevador: bool(f.elevador) } : undefined,
    janela: { entradaDe: f.entradaDe || undefined, entradaAte: f.entradaAte || undefined, saidaAte: f.saidaAte || undefined },
    vaga: { coberta: bool(f.vagaCoberta), tipo: f.vagaTipo || undefined, observacao: f.vagaObs || undefined },
  };
}

/** Só os grupos LIGADOS vão ao servidor; desligado = não existe (o servidor normaliza de novo). */
export function payloadDeDetalhes(f: DetalhesForm): DetalhesAnuncio {
  const g = grupos(f);
  const out: DetalhesAnuncio = {};
  for (const { chave } of GRUPOS_DETALHE) if (f.ligados[chave]) Object.assign(out, { [chave]: g[chave] });
  return out;
}

/** O grupo tem algo preenchido agora (desligar pede confirmação; ligado e preenchido conta como feito). */
export function grupoTemDados(f: DetalhesForm, chave: ChaveGrupoDetalhe): boolean {
  return !!normalizarDetalhes({ [chave]: grupos(f)[chave] });
}

/** Estado dos 5 blocos para o medidor de completude (desligado = não se aplica). */
export function estadosDetalhes(f: DetalhesForm): EstadoBloco[] {
  return GRUPOS_DETALHE.map(({ chave }) => ({ chave, ligado: f.ligados[chave], preenchido: grupoTemDados(f, chave) }));
}

/** Desligar confirmado: o grupo volta vazio e desligado. */
export function desligarGrupo(f: DetalhesForm, chave: ChaveGrupoDetalhe): DetalhesForm {
  const limpo: Partial<DetalhesForm> =
    chave === "incluidoNoPreco"
      ? { incluidoNoPreco: [] }
      : chave === "areasCondominio"
        ? { areasCondominio: [] }
        : chave === "andar"
          ? { andar: "", elevador: "" }
          : chave === "janela"
            ? { entradaDe: "", entradaAte: "", saidaAte: "" }
            : { vagaCoberta: "", vagaTipo: "", vagaObs: "" };
  return { ...f, ...limpo, ligados: { ...f.ligados, [chave]: false } };
}
