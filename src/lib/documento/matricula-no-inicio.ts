/*
  E149-A — A MATRÍCULA NO INÍCIO DO CADASTRO (PURO). "Tem a matrícula à mão? Comece por ela" (Passo 1) usa a MESMA leitura
  do documento do Passo 10. O que a matrícula traz preenche o cadastro (endereço no Passo 3; área, vagas e unidade no
  Passo 4, com a etiqueta "veio da matrícula"), sempre editável e só nos campos ainda vazios. Nome e CPF do titular nunca
  passam por aqui: só o resultado da conferência.
*/
import type { PreenchimentoMatricula, MotivoMatricula } from "./conferencia-matricula.ts";

export interface CadastroAtual {
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  areaM2: string;
  vagas: string;
  complemento: string;
}

export type CampoDaMatricula = "endereco" | "area" | "vagas" | "complemento";

/** O que a matrícula pode preencher agora: só o que veio na leitura E ainda está vazio no cadastro. */
export function camposDaMatriculaNoInicio(p: PreenchimentoMatricula, atual: CadastroAtual): CampoDaMatricula[] {
  const vazio = (v: string) => !v.trim();
  const out: CampoDaMatricula[] = [];
  const e = p.endereco;
  const temEndereco = !!(e.rua || e.cep);
  if (temEndereco && vazio(atual.rua) && vazio(atual.cep)) out.push("endereco");
  if (p.areaM2 && !((Number(atual.areaM2) || 0) > 0)) out.push("area");
  if (p.vagas != null && vazio(atual.vagas)) out.push("vagas");
  if (p.unidade && vazio(atual.complemento)) out.push("complemento");
  return out;
}

const ROTULO: Record<CampoDaMatricula, string> = { endereco: "endereço", area: "área", vagas: "vagas", complemento: "unidade" };

/** "Preenchemos: endereço, área, vagas" — ou vazio quando a leitura não trouxe nada novo. */
export function resumoDoPreenchimento(campos: CampoDaMatricula[]): string {
  if (!campos.length) return "";
  return `Preenchemos: ${campos.map((c) => ROTULO[c]).join(", ")}.`;
}

/** O titular do documento não é quem está cadastrando: pergunta ali mesmo quem opera o imóvel (um toque). */
export const perguntaQuemOpera = (motivo: MotivoMatricula | null | undefined) => motivo === "dono_diferente";

/** A leitura falhou (foto ruim, PDF sem texto): segue sem travar; o documento fica para a conferência da equipe. */
export const leituraFalhou = (motivo: MotivoMatricula | null | undefined) => motivo === "falha_leitura";

export const MSG_FALHA_LEITURA_INICIO = "Não conseguimos ler; você pode seguir e enviar depois no fim.";

/** Linha do Passo 10 quando o documento já foi enviado no começo (não pede de novo). */
export function linhaDocumentoDoInicio(estado: "aprovado" | "revisao" | "corrija" | "nenhum"): string | null {
  if (estado === "nenhum") return null;
  const situacao = estado === "aprovado" ? "aprovado" : estado === "corrija" ? "precisa de correção" : "em análise";
  return `Documento enviado no início · ${situacao}`;
}
