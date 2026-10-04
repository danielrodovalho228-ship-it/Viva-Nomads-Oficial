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
          {/* Sem progresso inventado: a verificação ainda não existe (em breve). */}
          <p className="text-sm text-muted">
            A verificação de identidade abre em breve, por meio de um parceiro. Você pode usar a
            plataforma normalmente enquanto isso.
          </p>
          <ButtonLink href="/dashboard/verificacao" variant="outline" className="mt-5">
            Saber mais
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
