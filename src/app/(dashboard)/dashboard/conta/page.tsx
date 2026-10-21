"use client";

import { PetsFicha } from "@/components/account/pets-ficha";
import { MeuLocalTrabalho } from "@/components/account/meu-local-trabalho";
import { PerfilPublicoForm } from "@/components/account/perfil-publico-form";
import { PageTitle } from "@/components/dashboard/primitives";
import { AvatarUploader } from "@/components/account/avatar-uploader";
import { TelefoneVerificacao } from "@/components/account/telefone-verificacao";
import { CaixaEmailsTeste } from "@/components/account/caixa-emails-teste";
import { ContaMenu } from "@/components/account/conta-menu";
import { AjudaContato, DadosPessoais, DangerZone, DocumentoPessoa, NotificationsPanel, QueroSerParceiro } from "@/components/account/conta-secoes";
import { BlocoConta, ConfiancaLista, PerfilProfissional, VerComoOutrosVeem } from "@/components/account/conta-blocos";

/**
 * Conta (prompt 18). No SITE: 4 blocos, cada assunto uma vez —
 * 1. Perfil público (foto, bio, idiomas, cidade e "Ver como os outros veem");
 * 2. Dados da conta (nome, e-mail, celular com SMS, documento, pets);
 * 3. Confiança e segurança (uma lista: e-mail, celular, identidade, LinkedIn, duas etapas e senha);
 * 4. Preferências (notificações, ajuda, excluir conta).
 * O simulador tributário fica só em Ferramentas (/dashboard/tributacao). No APP: o menu de subtelas.
 */
export default function AccountPage() {
  return (
    <>
      <div className="app-only">
        <ContaMenu />
      </div>
      <div className="web-only">
        <PageTitle capa="conta" title="Conta" subtitle="Seu perfil, seus dados e suas preferências." />

        <BlocoConta id="perfil-publico" numero={1} titulo="Perfil público" subtitulo="O que os outros veem de você.">
          <AvatarUploader />
          <PerfilPublicoForm />
          <PerfilProfissional />
          <VerComoOutrosVeem />
        </BlocoConta>

        <BlocoConta id="dados" numero={2} titulo="Dados da conta" subtitulo="Só a Viva vê. Vão no contrato e nos avisos.">
          <DadosPessoais />
          <TelefoneVerificacao />
          <DocumentoPessoa />
          <PetsFicha />
          <MeuLocalTrabalho />
        </BlocoConta>

        <BlocoConta id="confianca" numero={3} titulo="Confiança e segurança" subtitulo="O que já está verificado e como proteger a conta.">
          <ConfiancaLista />
        </BlocoConta>

        <BlocoConta id="preferencias" numero={4} titulo="Preferências" subtitulo="Avisos, ajuda e a sua conta.">
          <NotificationsPanel />
          <AjudaContato />
          <QueroSerParceiro />
          <DangerZone />
          {/* Por último: carrega depois da tela e não pode empurrar "Excluir conta" para fora do alcance (t183). */}
          <CaixaEmailsTeste />
        </BlocoConta>
      </div>
    </>
  );
}
