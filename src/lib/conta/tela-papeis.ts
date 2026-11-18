/*
  A3 — Conta › Papéis e intenção (mockup perfil-03): os textos e a regra dos cartões. Puro.
  Vocabulário da casa: "viajantes" e "curto e médio prazo" do desenho viram profissionais e estadias de 1 a 6 meses.
*/
import type { Intencao } from "../auth/entrada.ts";
import { grafiaDaCidade } from "../cidades.ts";

export const SUBTITULO_PAPEIS = "Defina seus papéis na plataforma para receber recomendações personalizadas.";
export const RODAPE_PAPEIS = "Viva Nomads · Configurações são salvas automaticamente";

const cidadeLimpa = (c: string | null | undefined) => grafiaDaCidade(c);

/** "Procurando imóvel de 1 a 6 meses em Uberlândia" (sem cidade, sem o "em"). */
export function linhaQueroMorar(cidade: string | null | undefined): string {
  const c = cidadeLimpa(cidade);
  return c ? `Procurando imóvel de 1 a 6 meses em ${c}` : "Procurando imóvel de 1 a 6 meses";
}

/** O resumo do cartão: "Uberlândia · 1–6 meses · Mobiliado" (a cidade some se não houver). */
export function resumoQueroMorar(cidade: string | null | undefined): string {
  return [cidadeLimpa(cidade), "1–6 meses", "Mobiliado"].filter(Boolean).join(" · ");
}

/** O convite do cartão "Quero anunciar". */
export function textoQueroAnunciar(cidade: string | null | undefined): string {
  const c = cidadeLimpa(cidade);
  return `Publique seu imóvel para profissionais que buscam estadias de 1 a 6 meses${c ? ` em ${c}` : ""}.`;
}

/** O cartão "Quero ser parceiro" (perfil-03-papeis-com-fotos): mesmo padrão dos outros dois. */
export const TEXTO_QUERO_PARCEIRO = "Ofereça serviços para moradores e proprietários";
export const BOTAO_QUERO_PARCEIRO = "Cadastrar meu serviço";
export const BOTAO_PARCEIRO_ATIVO = "Abrir meu painel de parceiro";

/** Ligar/desligar uma intenção mantém as outras (a ordem é a da lista oficial). */
export function alternarIntencao(atuais: readonly Intencao[], alvo: Intencao, ligar: boolean): Intencao[] {
  const conjunto = new Set(atuais);
  if (ligar) conjunto.add(alvo);
  else conjunto.delete(alvo);
  return (["morar", "anunciar", "servicos"] as const).filter((i) => conjunto.has(i));
}

/**
 * E537: o interruptor "Quero morar" reflete o papel de verdade — ligado quando a intenção tem "morar" OU o papel de
 * morador está em uso agora (o mesmo "Em uso" de "Como você usa a Viva"). Em uso, fica travado: desligar ali não
 * desligaria o papel; para isso, troca-se o papel em uso.
 */
export function estadoQueroMorar(intencao: readonly Intencao[], morarEmUso: boolean): { ligado: boolean; travado: boolean } {
  return { ligado: morarEmUso || intencao.includes("morar"), travado: morarEmUso };
}

export const TEXTO_MORAR_EM_USO = "Em uso agora. Para desligar, use outro papel em “Como você usa a Viva”, abaixo.";
