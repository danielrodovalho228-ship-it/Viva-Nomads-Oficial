import { PageTitle } from "@/components/dashboard/primitives";
import { ChangePassword } from "@/components/account/conta-secoes";
import { DuasEtapasPanel } from "@/components/seguranca/duas-etapas";
import { safeInternalPath } from "@/lib/safe-redirect";

export const metadata = { title: "Segurança da conta", robots: { index: false } };

/** Conta → Segurança: senha e verificação em duas etapas (obrigatória para admin). */
export default async function SegurancaPage({ searchParams }: { searchParams: Promise<{ obrigatorio?: string; redirect?: string }> }) {
  const { obrigatorio, redirect } = await searchParams;
  return (
    <>
      <PageTitle title="Segurança" subtitle="Senha e verificação em duas etapas." />
      <DuasEtapasPanel obrigatorio={obrigatorio === "admin"} destino={safeInternalPath(redirect, "/admin")} />
      <ChangePassword />
    </>
  );
}
