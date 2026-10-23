import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { carregarEstadia } from "@/lib/data/estadia";
import { HREF_ESTADIA, textoEntrada, textoSaida } from "@/lib/estadia/estadia";
import { TEXTO_CONFIRMADA, TITULO_CONFIRMADA, proximosPassos } from "@/lib/estadia/confirmacao";

export const metadata: Metadata = {
  title: "Estadia confirmada",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Prompt 61-A, item 1 — "Estadia confirmada": logo depois da segunda assinatura. Foto, título, datas e o próximo passo
 * concreto (Caução e conferência de entrada, com o prazo de cada um). Um primário só: "Ver a página da estadia".
 * Antes das duas assinaturas, a tela não existe (volta para a página da estadia); quem não é parte vê 404.
 */
export default async function EstadiaConfirmadaPage({ params }: { params: Promise<{ contratoId: string }> }) {
  const { contratoId } = await params;
  if (!UUID_RE.test(contratoId)) notFound();
  const e = await carregarEstadia(contratoId);
  if (!e) notFound();
  if (!e.assinadoPorAmbos) redirect(HREF_ESTADIA(e.id));
  const passos = proximosPassos(e.periodo, e.caucao);

  return (
    <div className="space-y-4" data-testid="estadia-confirmada">
      <PageTitle title={TITULO_CONFIRMADA} subtitle={`Contrato ${e.numero}`} />
      <Panel className="space-y-4">
        {e.imovel.foto && (
          // eslint-disable-next-line @next/next/no-img-element -- foto do anúncio, já reduzida no envio
          <img src={e.imovel.foto} alt={`Foto de ${e.imovel.titulo}`} className="aspect-[16/9] w-full rounded-xl object-cover" data-testid="confirmada-foto" />
        )}
        <div className="space-y-1">
          <h2 className="font-title text-xl font-semibold text-ink" data-testid="confirmada-imovel">
            {e.imovel.titulo}
          </h2>
          <p className="text-sm text-ink" data-testid="confirmada-entrada">
            {textoEntrada(e.periodo)}
          </p>
          <p className="text-sm text-ink" data-testid="confirmada-saida">
            {textoSaida(e.periodo)}
          </p>
          <p className="text-xs text-muted">Horário de Brasília.</p>
        </div>
        <div className="border-t border-line pt-4">
          <p className="text-sm text-ink" data-testid="confirmada-texto">
            {TEXTO_CONFIRMADA} Próximo passo:
          </p>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line" data-testid="confirmada-passos">
            {passos.map((p) => (
              <li key={p.chave} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between" data-testid={`confirmada-passo-${p.chave}`}>
                <span className="font-semibold text-ink">{p.rotulo}</span>
                <span className="text-muted">{p.prazo}</span>
              </li>
            ))}
          </ul>
        </div>
        <ButtonLink href={HREF_ESTADIA(e.id)} variant="primary" data-testid="confirmada-ver-estadia">
          Ver a página da estadia
        </ButtonLink>
      </Panel>
    </div>
  );
}
