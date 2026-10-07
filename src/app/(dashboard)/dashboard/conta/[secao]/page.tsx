"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { AvatarUploader } from "@/components/account/avatar-uploader";
import { CentralAjuda } from "@/components/ajuda/central-ajuda";
import {
  ChangePassword,
  DadosPessoais,
  DangerZone,
  DocumentoPessoa,
  NotificationsPanel,
  PerfilDoModo,
} from "@/components/account/conta-secoes";

/** Subtelas da Conta (app). No site, a página /dashboard/conta mostra tudo junto. */
export default function ContaSecaoPage({ params }: { params: Promise<{ secao: string }> }) {
  const { secao } = use(params);
  switch (secao) {
    case "perfil":
      return (
        <div className="mx-auto max-w-xl">
          <DadosPessoais />
          <DocumentoPessoa />
          <AvatarUploader />
          <PerfilDoModo />
        </div>
      );
    case "seguranca":
      return (
        <div className="mx-auto max-w-xl">
          <ChangePassword />
        </div>
      );
    case "notificacoes":
      return (
        <div className="mx-auto max-w-xl">
          <NotificationsPanel />
        </div>
      );
    case "ajuda":
      // App: a MESMA Central de Ajuda do site, aqui dentro (sem tela nova).
      return <CentralAjuda canal="app" />;
    case "excluir":
      return (
        <div className="mx-auto max-w-xl">
          <DangerZone />
        </div>
      );
    default:
      notFound();
  }
}
