import { notFound, redirect } from "next/navigation";
import { CascaConta } from "@/components/account/casca-conta";
import { TelaAjuda } from "@/components/account/tela-ajuda";
import { ContaDeTesteDoServidor } from "@/components/account/conta-de-teste-do-servidor";
import { TelaPapeis } from "@/components/account/tela-papeis";
import { PerfilTela } from "@/components/account/perfil-tela";
import { AncoraAntigaDaConta, VoltarAoMenuSeTelaEstreita } from "@/components/account/largura-e-ancora";
import { MeuLocalTrabalho } from "@/components/account/meu-local-trabalho";
import { TelefoneVerificacao } from "@/components/account/telefone-verificacao";
import { DadosPessoais, DocumentoPessoa } from "@/components/account/conta-secoes";
import { TelaPrivacidade } from "@/components/account/tela-privacidade";
import { SeuPerfilPublico } from "@/components/account/seu-perfil-publico";
import { PagamentosConta } from "@/components/account/pagamentos-conta";
import { SeusDadosRegras } from "@/components/account/seus-dados-regras";
import { DegrausPerfil } from "@/components/account/degraus-perfil";
import { RedesPrivadas } from "@/components/account/redes-privadas";
import { SUBTITULO_PAPEIS } from "@/lib/conta/tela-papeis";
import { ALIAS_SECAO, type SecaoConta } from "@/lib/conta/secoes";
import { getPerfilInicial } from "@/lib/data/perfil-actions";
import { usuarioDaSessaoServidor } from "@/lib/auth/sessao-servidor";
import { comLimite, LIMITE_CASCA_MS } from "@/lib/painel/com-limite";

/**
 * Telas da Conta (A1): cada seção na casca (menu lateral no computador; "‹ Conta" no celular), um H1 por tela.
 * /seguranca (senha e duas etapas) e /excluir (Sair da Viva) são subtelas de Privacidade, com rota própria na casca.
 * E789: página de SERVIDOR. O Perfil lê perfil e dados aqui, antes da primeira pintura, e a tela já chega preenchida
 * (antes: página de cliente → esqueleto → duas Server Actions enfileiradas do navegador → ~5 s de cartões vazios).
 */
export default async function ContaSecaoPage({ params }: { params: Promise<{ secao: string }> }) {
  const { secao: bruta } = await params;
  if (bruta === "perfil-publico")
    // E898: subtela do Perfil na casca (menu lateral com Perfil ativo; "← Perfil" no topo), não fora dela.
    return (
      <CascaConta ativo="perfil" subtela titulo="Seu perfil público" subtitulo="O que os outros veem de você.">
        <SeuPerfilPublico />
      </CascaConta>
    );
  const secao = (ALIAS_SECAO[bruta] ?? bruta) as SecaoConta;
  switch (secao) {
    case "perfil": {
      // Falha na leitura do servidor → null: a tela cai no caminho do navegador, que mostra "Tentar de novo" (achado 70).
      const inicial = await getPerfilInicial().catch(() => null);
      return (
        <CascaConta ativo="perfil" topoDireita>
          <PerfilTela inicial={inicial} />
          {/* E979: cookie da largura desatualizado → no celular, volta ao menu da Conta. Vem ANTES da âncora antiga: lê a
              âncora do endereço para decidir, e a âncora antiga pode tirá-la (a do próprio Perfil, sem alvo na tela). */}
          <VoltarAoMenuSeTelaEstreita />
          {/* E798: /dashboard/conta#documento (link antigo) chega aqui pelo redirecionamento do servidor; vai à seção certa. */}
          <AncoraAntigaDaConta />
        </CascaConta>
      );
    }
    case "papeis":
      return (
        <CascaConta ativo="papeis" subtitulo={SUBTITULO_PAPEIS}>
          <TelaPapeis />
        </CascaConta>
      );
    case "dados":
      return (
        <CascaConta ativo="dados" titulo="Meus dados">
          {/* Mockup perfil-04: o cartão "Meus dados". Embaixo, os blocos já aprovados que o desenho não mostra. */}
          <DadosPessoais />
          <RedesPrivadas />
          <TelefoneVerificacao />
          <DocumentoPessoa />
          <MeuLocalTrabalho />
          <div className="mt-6">
            <DegrausPerfil />
          </div>
          {/* E67b: o cartão final curto — o que a Viva guarda, por quanto tempo, e o caminho para a Privacidade. */}
          <div className="mt-6">
            <SeusDadosRegras />
          </div>
        </CascaConta>
      );
    case "privacidade":
      return (
        <CascaConta ativo="privacidade" trilha>
          {/* Mockup perfil-05: as chaves, "Baixar meus dados" e "Excluir minha conta". E66 (QA 24/10): a lista de segurança
              (e-mail, celular, identidade, LinkedIn, duas etapas, senha) mora na rota própria /dashboard/conta/seguranca. */}
          <TelaPrivacidade />
        </CascaConta>
      );
    case "notificacoes":
      // E176 (parte 2): Notificações é uma página só (/dashboard/notificacoes). O redirect do next.config chega antes.
      redirect("/dashboard/notificacoes");
    case "pagamentos":
      return (
        <CascaConta ativo="pagamentos">
          <PagamentosConta />
        </CascaConta>
      );
    case "ajuda": {
      // E1136: a Caixa de e-mails de teste precisa de saber se a conta é de teste mesmo quando a sessão do navegador
      // não leu o perfil. Lido aqui, com prazo, e passado por contexto; não leu = null (vale a sessão do navegador).
      const contaDeTeste = await comLimite(usuarioDaSessaoServidor(), LIMITE_CASCA_MS)
        .then((u) => (u ? u.isTeste === true : null))
        .catch(() => null);
      return (
        <CascaConta ativo="ajuda">
          <ContaDeTesteDoServidor valor={contaDeTeste}>
            <TelaAjuda />
          </ContaDeTesteDoServidor>
        </CascaConta>
      );
    }
    default:
      notFound();
  }
}
