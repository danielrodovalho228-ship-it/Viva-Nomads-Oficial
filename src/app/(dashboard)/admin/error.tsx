"use client";

import { Button, ButtonLink } from "@/components/ui/button";

/**
 * Falha ao abrir uma tela do admin. Antes não havia error.tsx em /admin: o erro de uma tela da equipe subia até o
 * error.tsx da raiz, que troca a casca do painel pela página pública ("Ir para o início", "Falar com a Viva"). Aqui
 * fica na casca, com "Tentar de novo" (unstable_retry do Next 16; reset de reserva) e a volta ao início do admin.
 * O error.tsx não cobre o layout do mesmo segmento: o 404 do layout para quem não é admin continua subindo (a área
 * não se revela).
 */
export default function ErroDoAdmin({ unstable_retry, reset }: { error: unknown; unstable_retry?: () => void; reset?: () => void }) {
  const tentarDeNovo = () => (unstable_retry ?? reset)?.();
  return (
    <div role="alert" data-testid="admin-erro" className="rounded-xl border border-sage-200 bg-white p-4 text-center sm:p-6">
      <h1 className="font-title text-lg font-semibold text-ink">Não conseguimos abrir esta tela do admin</h1>
      <p className="mt-2 text-sm text-muted">Foi um tropeço ao carregar esta tela. Tente de novo; se continuar, volte ao início do admin e abra a tela por lá.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={tentarDeNovo} data-testid="admin-erro-tentar">
          Tentar de novo
        </Button>
        <ButtonLink href="/admin" variant="outline">
          Voltar ao início do admin
        </ButtonLink>
      </div>
    </div>
  );
}
