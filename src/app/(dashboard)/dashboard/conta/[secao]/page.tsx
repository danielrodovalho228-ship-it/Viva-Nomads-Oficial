"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { PageTitle } from "@/components/dashboard/primitives";
import { CascaConta } from "@/components/account/casca-conta";
import { TelaAjuda } from "@/components/account/tela-ajuda";
import { TelaPapeis } from "@/components/account/tela-papeis";
import { PerfilTela } from "@/components/account/perfil-tela";
import { MeuLocalTrabalho } from "@/components/account/meu-local-trabalho";
import { TelefoneVerificacao } from "@/components/account/telefone-verificacao";
import { DadosPessoais, DocumentoPessoa } from "@/components/account/conta-secoes";
import { TelaNotificacoes } from "@/components/account/tela-notificacoes";
import { ConfiancaLista } from "@/components/account/conta-blocos";
import { SeuPerfilPublico } from "@/components/account/seu-perfil-publico";
import { PagamentosConta } from "@/components/account/pagamentos-conta";
import { DegrausPerfil } from "@/components/account/degraus-perfil";
import { RedesPrivadas } from "@/components/account/redes-privadas";
import { SUBTITULO_PAPEIS } from "@/lib/conta/tela-papeis";
import { ALIAS_SECAO, type SecaoConta } from "@/lib/conta/secoes";

/** Subtítulo de cada seção (A1; cada tela ganha o desenho do seu mockup nas entregas A2–A8). */
const SUBTITULO: Record<Exclude<SecaoConta, "perfil" | "ajuda" | "avaliacoes" | "notificacoes">, string> = {
  papeis: SUBTITULO_PAPEIS,
  dados: "Atualize suas informações de cadastro. Só a Viva vê; vão no contrato e nos avisos.",
  privacidade: "O que já está verificado e como proteger a conta.",
  pagamentos: "Para onde vai o valor mensal.",
};

/**
 * Telas da Conta (A1): cada seção na casca (menu lateral no computador; "‹ Conta" no celular), um H1 por tela.
 * /seguranca (senha e duas etapas) e /excluir (Sair da Viva) são subtelas de Privacidade, com rota própria na casca.
 */
export default function ContaSecaoPage({ params }: { params: Promise<{ secao: string }> }) {
  const { secao: bruta } = use(params);
  if (bruta === "perfil-publico")
    return (
      <div className="w-full">
        <PageTitle title="Seu perfil público" subtitle="O que os outros veem de você." />
        <SeuPerfilPublico />
      </div>
    );
  const secao = (ALIAS_SECAO[bruta] ?? bruta) as SecaoConta;
  switch (secao) {
    case "perfil":
      return (
        <CascaConta ativo="perfil" topoDireita>
          <PerfilTela />
        </CascaConta>
      );
    case "papeis":
      return (
        <CascaConta ativo="papeis" subtitulo={SUBTITULO.papeis}>
          <TelaPapeis />
        </CascaConta>
      );
    case "dados":
      return (
        <CascaConta ativo="dados" subtitulo={SUBTITULO.dados}>
          <DadosPessoais />
          <RedesPrivadas />
          <TelefoneVerificacao />
          <DocumentoPessoa />
          <MeuLocalTrabalho />
          <div className="mt-6">
            <DegrausPerfil />
          </div>
        </CascaConta>
      );
    case "privacidade":
      return (
        <CascaConta ativo="privacidade" subtitulo={SUBTITULO.privacidade}>
          {/* Senha e duas etapas têm a sua subtela (/dashboard/conta/seguranca): aqui só a lista, cada item uma vez. */}
          <ConfiancaLista />
        </CascaConta>
      );
    case "notificacoes":
      return (
        // Mockup perfil-06: sem subtítulo; o título e os dois cartões.
        <CascaConta ativo="notificacoes">
          <TelaNotificacoes />
        </CascaConta>
      );
    case "pagamentos":
      return (
        <CascaConta ativo="pagamentos" subtitulo={SUBTITULO.pagamentos}>
          <PagamentosConta />
        </CascaConta>
      );
    case "ajuda":
      return (
        <CascaConta ativo="ajuda">
          <TelaAjuda />
        </CascaConta>
      );
    default:
      notFound();
  }
}
