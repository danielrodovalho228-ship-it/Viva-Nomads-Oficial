import Link from "next/link";
import { dadosNovaProposta } from "@/lib/data/propostas-actions";
import { PageTitle, EmptyState } from "@/components/dashboard/primitives";
import { MontagemProposta } from "./montagem-proposta";

/** Montagem da proposta (prompt 17): sempre a partir de um interessado real (?interessado=…), pré-preenchida do anúncio. */
export default async function NovaPropostaPage({ searchParams }: { searchParams: Promise<{ interessado?: string }> }) {
  const { interessado } = await searchParams;
  const dados = interessado ? await dadosNovaProposta(interessado) : null;
  if (!dados) {
    return (
      <>
        <PageTitle title="Nova proposta" />
        <EmptyState
          title="Escolha um interessado"
          text="A proposta sempre nasce de um interessado real. Abra Orçamentos e use Nova proposta, ou o botão Enviar proposta em Interessados."
          action={
            <Link href="/dashboard/orcamentos" className="font-medium text-forest underline">
              Voltar para Orçamentos
            </Link>
          }
        />
      </>
    );
  }
  return <MontagemProposta dados={dados} />;
}
