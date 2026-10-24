"use client";

import Link from "next/link";
import { PetsFicha } from "@/components/account/pets-ficha";
import { MeuLocalTrabalho } from "@/components/account/meu-local-trabalho";
import { PerfilPublicoForm } from "@/components/account/perfil-publico-form";
import { TelefoneVerificacao } from "@/components/account/telefone-verificacao";
import { CaixaEmailsTeste } from "@/components/account/caixa-emails-teste";
import { ContaMenu } from "@/components/account/conta-menu";
import { SeusPapeis } from "@/components/account/seus-papeis";
import { PagamentosConta } from "@/components/account/pagamentos-conta";
import { DegrausPerfil } from "@/components/account/degraus-perfil";
import { AjudaContato, DadosPessoais, DocumentoPessoa, NotificationsPanel } from "@/components/account/conta-secoes";
import { SairDaViva } from "@/components/account/sair-da-viva";
import { RedesPrivadas } from "@/components/account/redes-privadas";
import { BlocoConta, ConfiancaLista, PerfilProfissional } from "@/components/account/conta-blocos";
import { TopoConta } from "@/components/account/topo-conta";
import { FalarComAViva } from "@/components/ajuda/falar-com-a-viva";
import { MinhaIntencao } from "@/components/auth/escolha-intencao";

/**
 * Conta (CONTA-A, entrega 1 — Perfil). Um TOPO ÚNICO (site e app, mesmo conteúdo: foto, nome no H1, cidade e papéis)
 * e, no site, os blocos nesta ordem, cada assunto uma vez e sem números:
 * 1. Topo · 2. Perfil (formulário + profissional + pets + degraus + O ESPELHO) · 3. Avaliações · 4. Papéis e intenção ·
 * 5. Dados da conta · 6. Privacidade e segurança · 7. Notificações · 8. Pagamentos · 9. Ajuda e Sair da Viva.
 * Âncoras mantidas: #perfil-publico, #dados, #confianca, #notificacoes, #pagamentos, #sair-da-viva.
 * O simulador tributário fica só em Ferramentas (/dashboard/tributacao). No APP: o topo e o menu de subtelas.
 */
export default function AccountPage() {
  return (
    <>
      <TopoConta />
      <div className="app-only">
        <ContaMenu />
      </div>
      <div className="web-only">
        <BlocoConta id="perfil-publico" titulo="Perfil" subtitulo="O que o proprietário vê de você. Opcional, e cada dado é pedido só quando é usado.">
          <PerfilPublicoForm />
          <PerfilProfissional />
          <div className="mt-6">
            <PetsFicha />
          </div>
          <div className="mt-6">
            <DegrausPerfil />
          </div>
          {/* C3c: a visão do proprietário fica só no ESPELHO (ao lado do formulário); o resumo repetido saiu daqui. */}
        </BlocoConta>

        <BlocoConta id="avaliacoes" titulo="Avaliações" subtitulo="O que disseram de você depois de cada estadia.">
          <Link href="/dashboard/avaliacoes" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-forest underline underline-offset-2" data-testid="conta-ver-avaliacoes">
            Ver as avaliações que você recebeu
          </Link>
        </BlocoConta>

        <BlocoConta id="papeis" titulo="Papéis e intenção" subtitulo="Só muda o menu e o painel que aparecem primeiro.">
          <div className="mt-4 grid gap-4">
            <SeusPapeis dentroDoBloco />
            <MinhaIntencao />
          </div>
        </BlocoConta>

        <BlocoConta id="dados" titulo="Dados da conta" subtitulo="Só a Viva vê. Vão no contrato e nos avisos.">
          <DadosPessoais />
          <RedesPrivadas />
          <TelefoneVerificacao />
          <DocumentoPessoa />
          <MeuLocalTrabalho />
        </BlocoConta>

        <BlocoConta id="confianca" titulo="Privacidade e segurança" subtitulo="O que já está verificado e como proteger a conta.">
          <ConfiancaLista />
        </BlocoConta>

        <BlocoConta id="notificacoes" titulo="Notificações" subtitulo="Como e quando a Viva avisa você.">
          <NotificationsPanel titulo={null} />
        </BlocoConta>

        <BlocoConta id="pagamentos" titulo="Pagamentos" subtitulo="Para onde vai o valor mensal.">
          <div className="mt-4">
            <PagamentosConta />
          </div>
        </BlocoConta>

        <BlocoConta id="sair-da-viva" titulo="Ajuda e Sair da Viva" subtitulo="Fale com a Viva ou pause a conta.">
          <AjudaContato />
          <div className="mt-6">
            <SairDaViva />
            <FalarComAViva className="mt-4" />
          </div>
          {/* Por último: carrega depois da tela e não pode empurrar "Sair da Viva" para fora do alcance (t183). */}
          <CaixaEmailsTeste />
        </BlocoConta>
      </div>
    </>
  );
}
