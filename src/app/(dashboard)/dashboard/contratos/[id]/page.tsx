import { ContratoDetalhe } from "@/components/contrato/contrato-detalhe";

export const metadata = { title: "Contrato" };

export default async function ContratoDonoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContratoDetalhe id={id} voltarHref="/dashboard/contratos" voltarRotulo="Contratos & blocos" />;
}
