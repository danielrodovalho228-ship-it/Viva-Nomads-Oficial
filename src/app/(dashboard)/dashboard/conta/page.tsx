"use client";

import { PetsFicha } from "@/components/account/pets-ficha";
import { MeuLocalTrabalho } from "@/components/account/meu-local-trabalho";
import { PerfilPublicoForm } from "@/components/account/perfil-publico-form";
import { PageTitle } from "@/components/dashboard/primitives";
import { ConviteFotoPerfil } from "@/components/account/convite-foto-perfil";
import { AvatarUploader } from "@/components/account/avatar-uploader";
import { TelefoneVerificacao } from "@/components/account/telefone-verificacao";
import { CaixaEmailsTeste } from "@/components/account/caixa-emails-teste";
import { ContaMenu } from "@/components/account/conta-menu";
import { SeusPapeis } from "@/components/account/seus-papeis";
import { SeuPerfilPublico } from "@/components/account/seu-perfil-publico";
import { PagamentosConta } from "@/components/account/pagamentos-conta";
import { DegrausPerfil } from "@/components/account/degraus-perfil";
import { AjudaContato, DadosPessoais, DangerZone, DocumentoPessoa, NotificationsPanel } from "@/components/account/conta-secoes";
import { BlocoConta, ConfiancaLista, PerfilProfissional } from "@/components/account/conta-blocos";
import { FalarComAViva } from "@/components/ajuda/falar-com-a-viva";

/**
 * Configurações (Prompt 43, item 3). No SITE: 4 grupos, cada assunto uma vez —
 * 1. Conta: seus papéis, o perfil em 4 degraus, o perfil público (e o que os outros veem), dados e "Sair da Viva";
 * 2. Notificações;
 * 3. Privacidade e segurança (uma lista: e-mail, celular, identidade, LinkedIn, duas etapas e senha);
 * 4. Pagamentos (como o morador paga o dono; a Viva não recebe esse valor).
 * O simulador tributário fica só em Ferramentas (/dashboard/tributacao). No APP: o menu de subtelas.
 */
export default function AccountPage() {
  return (
    <>
      <div className="app-only">
        <ContaMenu />
      </div>
      <div className="web-only">
        <PageTitle title="Conta" subtitle="Seu perfil, seus dados e suas preferências." />

        <BlocoConta id="conta" numero={1} titulo="Conta" subtitulo="Seus papéis, seu perfil e seus dados.">
          <div className="mt-4 grid gap-4">
            <SeusPapeis />
            <DegrausPerfil />
          </div>
          <div id="perfil-publico" className="scroll-mt-24">
            <h3 className="mt-6 font-title text-lg font-semibold text-ink">Perfil público</h3>
            <ConviteFotoPerfil href="#perfil-publico" className="mb-4" />
            <AvatarUploader />
            <PerfilPublicoForm />
            <PerfilProfissional />
            <div className="mt-4">
              <h3 className="mb-2 font-title text-lg font-semibold text-ink">Seu perfil público</h3>
              <SeuPerfilPublico />
            </div>
          </div>
          <div id="dados" className="scroll-mt-24">
            <h3 className="mt-6 font-title text-lg font-semibold text-ink">Dados da conta</h3>
            <p className="text-sm text-muted">Só a Viva vê. Vão no contrato e nos avisos.</p>
            <DadosPessoais />
            <TelefoneVerificacao />
            <DocumentoPessoa />
            <PetsFicha />
            <MeuLocalTrabalho />
          </div>
          <AjudaContato />
          <div id="sair-da-viva" className="scroll-mt-24">
            <h3 className="mt-6 font-title text-lg font-semibold text-ink">Sair da Viva</h3>
            <DangerZone />
            <FalarComAViva className="mt-4" />
          </div>
          {/* Por último: carrega depois da tela e não pode empurrar "Sair da Viva" para fora do alcance (t183). */}
          <CaixaEmailsTeste />
        </BlocoConta>

        <BlocoConta id="notificacoes" numero={2} titulo="Notificações" subtitulo="Como e quando a Viva avisa você.">
          <NotificationsPanel />
        </BlocoConta>

        <BlocoConta id="confianca" numero={3} titulo="Privacidade e segurança" subtitulo="O que já está verificado e como proteger a conta.">
          <ConfiancaLista />
        </BlocoConta>

        <BlocoConta id="pagamentos" numero={4} titulo="Pagamentos" subtitulo="Para onde vai o valor mensal.">
          <div className="mt-4">
            <PagamentosConta />
          </div>
        </BlocoConta>
      </div>
    </>
  );
}
