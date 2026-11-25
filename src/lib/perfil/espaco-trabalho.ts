/*
  Ordem 286312f8 (P3): medir interesse em espaços de trabalho, sem construir o produto.
  Duas perguntas opcionais no perfil (uma conta só): "tem sala/consultório mobiliado?" e "vai precisar de espaço fora de casa?".
  Módulo puro: o servidor valida aqui (fonte da verdade); as listas casam com os check da migração 0250.
*/
import type { Validado } from "../conta-validacao.ts";

export const OFERTA = ["nao", "sala", "consultorio", "clinica", "outro"] as const;
export const PROCURA = ["nao", "coworking", "sala_consultorio"] as const;
export type Oferta = (typeof OFERTA)[number];
export type Procura = (typeof PROCURA)[number];

export const ROTULO_OFERTA: Record<Oferta, string> = {
  nao: "Não",
  sala: "Sim, uma sala",
  consultorio: "Sim, um consultório",
  clinica: "Sim, uma clínica equipada",
  outro: "Sim, outro espaço",
};
export const ROTULO_PROCURA: Record<Procura, string> = {
  nao: "Não",
  coworking: "Sim, um coworking",
  sala_consultorio: "Sim, uma sala ou consultório por turno",
};

export interface EspacoTrabalho {
  oferta: Oferta | null;
  procura: Procura | null;
}

function escolha<T extends string>(bruto: unknown, lista: readonly T[]): T | null | undefined {
  const v = String(bruto ?? "").trim();
  if (!v) return null;
  return (lista as readonly string[]).includes(v) ? (v as T) : undefined;
}

export function validarEspacoTrabalho(entrada: { oferta?: unknown; procura?: unknown }): Validado<EspacoTrabalho> {
  const oferta = escolha(entrada.oferta, OFERTA);
  if (oferta === undefined) return { ok: false, erro: "Resposta inválida sobre o espaço que você oferece." };
  const procura = escolha(entrada.procura, PROCURA);
  if (procura === undefined) return { ok: false, erro: "Resposta inválida sobre o espaço que você procura." };
  return { ok: true, valor: { oferta, procura } };
}

export interface LinhaInteresse {
  oferta: string | null;
  procura: string | null;
  teste: boolean;
}
export interface Contagem {
  reais: number;
  teste: number;
}
export interface InteresseEspaco {
  oferecem: Contagem;
  procuram: Contagem;
  coworking: Contagem;
  responderam: Contagem;
}

/** Contagem agregada para o /admin (só números; contas de teste à parte). "Não" conta como resposta, não como interesse. */
export function contarInteresse(linhas: readonly LinhaInteresse[]): InteresseEspaco {
  const zero = (): Contagem => ({ reais: 0, teste: 0 });
  const r: InteresseEspaco = { oferecem: zero(), procuram: zero(), coworking: zero(), responderam: zero() };
  const soma = (c: Contagem, teste: boolean) => (teste ? c.teste++ : c.reais++);
  for (const l of linhas) {
    if (l.oferta || l.procura) soma(r.responderam, l.teste);
    if (l.oferta && l.oferta !== "nao") soma(r.oferecem, l.teste);
    if (l.procura && l.procura !== "nao") soma(r.procuram, l.teste);
    if (l.procura === "coworking") soma(r.coworking, l.teste);
  }
  return r;
}
