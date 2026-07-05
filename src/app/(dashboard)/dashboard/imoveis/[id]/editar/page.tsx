import Link from "next/link";
import { loadPropertyForEdit } from "@/lib/data/actions";
import { EditarImovelClient } from "./editar-client";

/**
 * Editor de anúncio POR SEÇÕES (Fase 3). Diferente do wizard linear de criação:
 * aqui o proprietário abre o imóvel e edita cada seção (fotos, disponibilidade,
 * descrição, comodidades, regras, detalhes) de forma independente, com barra de
 * completude no topo. O servidor carrega o imóvel do dono; sem backend
 * configurado (preview), o loader cai no imóvel de exemplo — `demo` sinaliza que
 * as edições não gravam.
 */
export default async function EditarImovelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await loadPropertyForEdit(id);
  const demo = !process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!property) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center">
        <h1 className="font-title text-lg font-bold text-ink">Imóvel não encontrado</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Este anúncio não existe ou não pertence à sua conta.
        </p>
        <Link
          href="/dashboard/imoveis"
          className="mt-6 inline-block text-sm font-medium text-forest hover:underline"
        >
          Voltar aos meus imóveis
        </Link>
      </div>
    );
  }

  return <EditarImovelClient property={property} demo={demo} />;
}
