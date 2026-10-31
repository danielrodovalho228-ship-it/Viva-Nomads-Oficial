import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Página não encontrada", robots: null };

/**
 * 404 DENTRO do painel (morador e proprietário). Antes o notFound() das telas com id (estadia, proposta, visita,
 * pedido de serviço, avaliação…) caía na 404 pública: fora do painel, com a vitrine de imóveis e o convite para
 * anunciar — tela de marketing para quem só abriu um link de outra conta ou já apagado. Aqui fica na casca do painel,
 * diz por que (não existe ou não é desta conta, sem dizer qual) e leva de volta. O título continua "Página não
 * encontrada" (as specs de acesso o conferem).
 */
export default function NaoEncontradoNoPainel() {
  return (
    <div data-testid="painel-nao-encontrado" className="rounded-xl border border-sage-200 bg-white p-4 text-center sm:p-6">
      <h1 className="font-title text-lg font-semibold text-ink">Página não encontrada</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Este endereço não existe mais ou não é desta conta. Estadias, propostas, visitas e pedidos abrem só para quem faz parte deles.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/dashboard">Voltar ao painel</ButtonLink>
        <ButtonLink href="/ajuda" variant="outline">
          Falar com a Viva
        </ButtonLink>
      </div>
    </div>
  );
}
