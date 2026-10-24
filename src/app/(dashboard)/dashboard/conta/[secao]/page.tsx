"use client";

import Link from "next/link";
import { use } from "react";
import { notFound } from "next/navigation";
import { PageTitle } from "@/components/dashboard/primitives";
import { CascaConta } from "@/components/account/casca-conta";
import { PerfilTela } from "@/components/account/perfil-tela";
import { MeuLocalTrabalho } from "@/components/account/meu-local-trabalho";
import { TelefoneVerificacao } from "@/components/account/telefone-verificacao";
import { CentralAjuda } from "@/components/ajuda/central-ajuda";
import { AjudaContato, DadosPessoais, DocumentoPessoa, NotificationsPanel } from "@/components/account/conta-secoes";
import { ConfiancaLista } from "@/components/account/conta-blocos";
import { SeuPerfilPublico } from "@/components/account/seu-perfil-publico";
import { PagamentosConta } from "@/components/account/pagamentos-conta";
import { DegrausPerfil } from "@/components/account/degraus-perfil";
import { FalarComAViva } from "@/components/ajuda/falar-com-a-viva";
import { SairDaViva } from "@/components/account/sair-da-viva";
import { RedesPrivadas } from "@/components/account/redes-privadas";
import { SeusPapeis } from "@/components/account/seus-papeis";
import { MinhaIntencao } from "@/components/auth/escolha-intencao";
import { CaixaEmailsTeste } from "@/components/account/caixa-emails-teste";
import { ALIAS_SECAO, type SecaoConta } from "@/lib/conta/secoes";
import { useIsNative } from "@/lib/use-native";

/** Subtítulo de cada seção (A1; cada tela ganha o desenho do seu mockup nas entregas A2–A8). */
const SUBTITULO: Record<Exclude<SecaoConta, "perfil">, string> = {
  avaliacoes: "O que disseram de você depois de cada estadia.",
  papeis: "O que você quer fazer na Viva. Só muda o menu e o painel que aparecem primeiro.",
  dados: "Atualize suas informações de cadastro. Só a Viva vê; vão no contrato e nos avisos.",
  privacidade: "O que já está verificado e como proteger a conta.",
  notificacoes: "Como e quando a Viva avisa você.",
  pagamentos: "Para onde vai o valor mensal.",
  ajuda: "Central de ajuda, contato com a Viva e sair da Viva.",
};

/**
 * Telas da Conta (A1): cada seção na casca (menu lateral no computador; "‹ Conta" no celular), um H1 por tela.
 * Endereço antigo /excluir → Ajuda (ALIAS_SECAO); /seguranca é a subtela de senha e duas etapas (rota própria, na casca).
 */
export default function ContaSecaoPage({ params }: { params: Promise<{ secao: string }> }) {
  const { secao: bruta } = use(params);
  const nativo = useIsNative();
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
    case "avaliacoes":
      return (
        <CascaConta ativo="avaliacoes" subtitulo={SUBTITULO.avaliacoes}>
          <section className="rounded-xl bg-white p-4 sm:p-6">
            <Link href="/dashboard/avaliacoes" className="inline-flex min-h-11 items-center text-sm font-semibold text-forest underline underline-offset-2" data-testid="conta-ver-avaliacoes">
              Ver as avaliações que você recebeu
            </Link>
          </section>
        </CascaConta>
      );
    case "papeis":
      return (
        <CascaConta ativo="papeis" subtitulo={SUBTITULO.papeis}>
          <div className="grid gap-4">
            <SeusPapeis dentroDoBloco />
            <MinhaIntencao />
          </div>
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
        <CascaConta ativo="notificacoes" subtitulo={SUBTITULO.notificacoes}>
          <NotificationsPanel titulo={null} />
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
        <CascaConta ativo="ajuda" subtitulo={SUBTITULO.ajuda}>
          <CentralAjuda canal={nativo ? "app" : "site"} />
          <AjudaContato />
          <div className="mt-6">
            <SairDaViva />
            <FalarComAViva className="mt-4" />
          </div>
          {/* Por último: carrega depois da tela e não pode empurrar "Sair da Viva" para fora do alcance (t183). */}
          <CaixaEmailsTeste />
        </CascaConta>
      );
    default:
      notFound();
  }
}
