"use client";

import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { AvatarUploader } from "@/components/account/avatar-uploader";
import { ContaMenu } from "@/components/account/conta-menu";
import {
  AjudaContato,
  ChangePassword,
  DadosPessoais,
  DangerZone,
  NotificationsPanel,
  PerfilDoModo,
} from "@/components/account/conta-secoes";

/**
 * Conta. No SITE: a página completa (todas as seções). No APP: um menu de itens
 * que abrem subtelas (/dashboard/conta/[secao]) — a página longa (2,3 telas de
 * rolagem no celular) vira uma lista curta.
 */
export default function AccountPage() {
  return (
    <>
      <div className="app-only">
        <ContaMenu />
      </div>
      <div className="web-only mx-auto max-w-5xl">
        <PageTitle title="Conta" subtitle="Seus dados pessoais e preferências." />
        <DadosPessoais />
        {/* Foto de perfil (Fase 2) — opcional; visibilidade decidida no servidor. */}
        <AvatarUploader />
        <PerfilDoModo />
        <Panel title="Verificação" className="mt-6">
          <p className="text-sm text-muted">
            Complete a verificação de identidade para gerar mais confiança. Progresso atual:{" "}
            <strong className="text-forest">60%</strong>.
          </p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-sage-100">
            <div className="h-full w-[60%] rounded-full bg-champagne" />
          </div>
          <ButtonLink href="/dashboard/verificacao" variant="outline" className="mt-5">
            Continuar verificação
          </ButtonLink>
        </Panel>
        {/* Alterar senha (Atualização 20.7) */}
        <ChangePassword />
        {/* Notificações (Atualização 20.7) */}
        <NotificationsPanel />
        {/* Ajuda & contato — canal oficial de saída (Fase 3.3). */}
        <AjudaContato />
        {/* Zona de risco — excluir conta com dupla confirmação (Atualização 20.7) */}
        <DangerZone />
      </div>
    </>
  );
}
