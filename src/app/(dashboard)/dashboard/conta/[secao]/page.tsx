"use client";

import { PetsFicha } from "@/components/account/pets-ficha";
import { PerfilPublicoForm } from "@/components/account/perfil-publico-form";
import { use } from "react";
import { notFound } from "next/navigation";
import { AvatarUploader } from "@/components/account/avatar-uploader";
import { TelefoneVerificacao } from "@/components/account/telefone-verificacao";
import { PageTitle } from "@/components/dashboard/primitives";
import { CentralAjuda } from "@/components/ajuda/central-ajuda";
import {
  ChangePassword,
  DadosPessoais,
  DangerZone,
  DocumentoPessoa,
  NotificationsPanel,
} from "@/components/account/conta-secoes";
import { ConfiancaLista, PerfilProfissional, VerComoOutrosVeem } from "@/components/account/conta-blocos";

const TITULOS: Record<string, { titulo: string; subtitulo: string }> = {
  perfil: { titulo: "Perfil", subtitulo: "Seus dados, documento e foto." },
  seguranca: { titulo: "Confiança e segurança", subtitulo: "O que está verificado, duas etapas e senha." },
  notificacoes: { titulo: "Notificações", subtitulo: "Escolha como quer ser avisado." },
  excluir: { titulo: "Excluir conta", subtitulo: "Apaga seus dados, com confirmação." },
};

/** Subtelas da Conta (app). No site, a página /dashboard/conta mostra tudo junto. */
export default function ContaSecaoPage({ params }: { params: Promise<{ secao: string }> }) {
  const { secao } = use(params);
  switch (secao) {
    case "perfil":
      return (
        <div className="w-full">
          <PageTitle title={TITULOS.perfil.titulo} subtitle={TITULOS.perfil.subtitulo} />
          <AvatarUploader />
          <PerfilPublicoForm />
          <PerfilProfissional />
          <VerComoOutrosVeem />
          <DadosPessoais />
          <TelefoneVerificacao />
          <DocumentoPessoa />
          <PetsFicha />
        </div>
      );
    case "seguranca":
      return (
        <div className="w-full">
          <PageTitle title={TITULOS.seguranca.titulo} subtitle={TITULOS.seguranca.subtitulo} />
          <ConfiancaLista />
          <ChangePassword />
        </div>
      );
    case "notificacoes":
      return (
        <div className="w-full">
          <PageTitle title={TITULOS.notificacoes.titulo} subtitle={TITULOS.notificacoes.subtitulo} />
          <NotificationsPanel />
        </div>
      );
    case "ajuda":
      // App: a MESMA Central de Ajuda do site, aqui dentro (sem tela nova). Com o título principal (h1) que a
      // /ajuda do site tem — sem ele a tela ficava sem cabeçalho (t183).
      return (
        <div className="w-full">
          <PageTitle title="Central de Ajuda" subtitle="Perguntas frequentes, chamados e contato com a equipe." />
          <CentralAjuda canal="app" />
        </div>
      );
    case "excluir":
      return (
        <div className="w-full">
          <PageTitle title={TITULOS.excluir.titulo} subtitle={TITULOS.excluir.subtitulo} />
          <DangerZone />
        </div>
      );
    default:
      notFound();
  }
}
