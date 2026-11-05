import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Página não encontrada", robots: null };

/**
 * 404 DENTRO do admin. Antes o notFound() das telas com id (pedido de parceiro, atendimento, contrato…) caía na 404 pública:
 * fora da casca, com a vitrine de imóveis e o convite para anunciar — tela de marketing para quem da equipe abriu um link
 * de item apagado ou digitado errado. Aqui fica na casca do admin e leva de volta. Não revela a área: o notFound() do
 * layout (quem não é admin) continua na 404 da raiz, porque o not-found.tsx de um segmento não cobre o layout do mesmo
 * segmento (docs do Next 16).
 */
export default function NaoEncontradoNoAdmin() {
  return (
    <div data-testid="admin-nao-encontrado" className="rounded-xl border border-sage-200 bg-white p-4 text-center sm:p-6">
      <h1 className="font-title text-lg font-semibold text-ink">Página não encontrada</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Este item não existe mais, o endereço está incompleto ou o código não confere. Volte ao início do admin e abra a tela por lá.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/admin">Voltar ao início do admin</ButtonLink>
      </div>
    </div>
  );
}
