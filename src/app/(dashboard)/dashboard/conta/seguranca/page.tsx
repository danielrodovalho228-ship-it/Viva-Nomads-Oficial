import { CascaConta } from "@/components/account/casca-conta";
import { ChangePassword } from "@/components/account/conta-secoes";
import { ConfiancaLista } from "@/components/account/conta-blocos";
import { DuasEtapasPanel } from "@/components/seguranca/duas-etapas";
import { safeInternalPath } from "@/lib/safe-redirect";

export const metadata = { title: "Segurança e verificações", robots: { index: false } };

/**
 * Conta → Privacidade → Segurança e verificações (A1: na casca da Conta, com Privacidade ativa no menu). O endereço fica
 * o mesmo: o portão do admin manda ativar o 2FA aqui (CAMINHO_ATIVAR_2FA). E66 (QA 24/10): a lista de confiança (e-mail,
 * celular, identidade, LinkedIn, duas etapas, senha), que o desenho perfil-05 não tem na Privacidade, mora aqui.
 */
export default async function SegurancaPage({ searchParams }: { searchParams: Promise<{ obrigatorio?: string; redirect?: string }> }) {
  const { obrigatorio, redirect } = await searchParams;
  return (
    <CascaConta ativo="privacidade" subtela titulo="Segurança e verificações" subtitulo="Troque a senha, ative a verificação em duas etapas e confira as verificações da conta.">
      <DuasEtapasPanel obrigatorio={obrigatorio === "admin"} destino={safeInternalPath(redirect, "/admin")} />
      <ChangePassword />
      <div className="mt-8">
        <ConfiancaLista />
      </div>
    </CascaConta>
  );
}
