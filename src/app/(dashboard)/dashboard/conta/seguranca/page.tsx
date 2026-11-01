import { CascaConta } from "@/components/account/casca-conta";
import { ChangePassword, SairDeTodosAparelhos } from "@/components/account/conta-secoes";
import { ConfiancaLista } from "@/components/account/conta-blocos";
import { DuasEtapasPanel } from "@/components/seguranca/duas-etapas";
import { safeInternalPath } from "@/lib/safe-redirect";

export const metadata = { title: "Segurança e verificações", robots: { index: false } };

/**
 * Conta → Segurança e verificações (E176 parte 2: item próprio no menu da Conta; antes, subtela de Privacidade). O endereço fica
 * o mesmo: o portão do admin manda ativar o 2FA aqui (CAMINHO_ATIVAR_2FA). E66 (QA 24/10): a lista de confiança (e-mail,
 * celular, identidade, LinkedIn, duas etapas, senha), que o desenho perfil-05 não tem na Privacidade, mora aqui.
 * E391 (1): "Sair de todos os aparelhos" mora aqui, separado do "Sair" do menu da Conta (que é só deste aparelho).
 */
export default async function SegurancaPage({ searchParams }: { searchParams: Promise<{ obrigatorio?: string; redirect?: string }> }) {
  const { obrigatorio, redirect } = await searchParams;
  return (
    <CascaConta ativo="seguranca" subtitulo="Troque a senha, ative a verificação em duas etapas e confira as verificações da conta.">
      <DuasEtapasPanel obrigatorio={obrigatorio === "admin"} destino={safeInternalPath(redirect, "/admin")} />
      <ChangePassword />
      <SairDeTodosAparelhos />
      <div className="mt-8">
        <ConfiancaLista />
      </div>
    </CascaConta>
  );
}
