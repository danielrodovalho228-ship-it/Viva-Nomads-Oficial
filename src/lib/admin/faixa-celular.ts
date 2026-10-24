/*
  E73 (QA 24/10): no celular o /admin abre com uma faixa curta de números-chave, antes das decisões. Os mesmos números
  da visão geral (nada novo é contado aqui), cada um com o link da lista que ele conta. No computador a tela segue igual.
*/
import { fmtInteiro, num, type Metricas } from "./visao-geral.ts";
import { hrefUsuarios } from "./usuarios-lista.ts";

export interface NumeroFaixa {
  chave: string;
  rotulo: string;
  valor: string;
  href: string;
}

/** Imóveis no ar, usuários, pedidos ativos e chamados abertos — com o filtro de cidade onde ele existe. */
export function faixaNumerosCelular(agora: Metricas, atual: Metricas, cidade: string | null): NumeroFaixa[] {
  const comCidade = (href: string) => (cidade ? `${href}&cidade=${encodeURIComponent(cidade)}` : href);
  return [
    { chave: "imoveis", rotulo: "Imóveis no ar", valor: fmtInteiro(num(agora.imoveis_ativos)), href: comCidade("/admin/imoveis?tipo=real&status=active") },
    { chave: "usuarios", rotulo: "Usuários", valor: fmtInteiro(num(agora.usuarios)), href: hrefUsuarios({}) },
    { chave: "pedidos", rotulo: "Pedidos ativos", valor: fmtInteiro(num(agora.pedidos_ativos)), href: comCidade("/admin/pedidos?status=ativo") },
    { chave: "chamados", rotulo: "Chamados abertos", valor: fmtInteiro(num(atual.x_atd_abertos_agora)), href: "/admin/atendimento?aba=fila" },
  ];
}
