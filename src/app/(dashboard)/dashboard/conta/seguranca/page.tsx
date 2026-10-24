import { CascaConta } from "@/components/account/casca-conta";
import { ChangePassword } from "@/components/account/conta-secoes";
import { DuasEtapasPanel } from "@/components/seguranca/duas-etapas";
import { safeInternalPath } from "@/lib/safe-redirect";

export const metadata = { title: "Senha e duas etapas", robots: { index: false } };

/**
 * Conta → Privacidade → Senha e duas etapas (A1: na casca da Conta, com Privacidade ativa no menu). O endereço fica o
 * mesmo: o portão do admin manda ativar o 2FA aqui (CAMINHO_ATIVAR_2FA).
 */
export default async function SegurancaPage({ searchParams }: { searchParams: Promise<{ obrigatorio?: string; redirect?: string }> }) {
  const { obrigatorio, redirect } = await searchParams;
  return (
    <CascaConta ativo="privacidade" titulo="Senha e duas etapas" subtitulo="Troque a senha e ative a verificação em duas etapas.">
      <DuasEtapasPanel obrigatorio={obrigatorio === "admin"} destino={safeInternalPath(redirect, "/admin")} />
      <ChangePassword />
    </CascaConta>
  );
}
