import { UserRound } from "lucide-react";
import { PageTitle, EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { filaFotosPerfil } from "@/lib/data/fotos-perfil-actions";
import { REGRA_FOTO_PERFIL } from "@/lib/perfil/foto-revisao";
import { FilaFotosCliente } from "./fila-fotos-cliente";

export const metadata = { title: "Fotos de perfil — Admin" };
export const dynamic = "force-dynamic";

/**
 * FOTO-PERFIL-B (E13): fila de revisão das fotos de perfil. A foto já está no ar; aqui a equipe aprova ou remove com
 * motivo da lista fechada. Denunciadas no topo; depois a mais antiga primeiro. O layout de /admin já barra quem não é
 * admin, e as ações conferem admin + 2FA de novo.
 */
export default async function AdminFotosPerfilPage() {
  const fila = await filaFotosPerfil();
  return (
    <>
      <PageTitle title="Fotos de perfil" subtitle={REGRA_FOTO_PERFIL} />
      {fila === null ? (
        <EmptyState icon={UserRound} title="Sem acesso à fila" text="Entre com a verificação em duas etapas para revisar as fotos." action={<ButtonLink href="/admin" variant="secondary" size="sm">Voltar ao painel</ButtonLink>} />
      ) : fila.length === 0 ? (
        <EmptyState icon={UserRound} title="Nenhuma foto em revisão" text="Fotos novas e denunciadas aparecem aqui." action={<ButtonLink href="/admin" variant="secondary" size="sm">Voltar ao painel</ButtonLink>} />
      ) : (
        <FilaFotosCliente fila={fila} />
      )}
    </>
  );
}
