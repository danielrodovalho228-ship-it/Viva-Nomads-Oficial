"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { CampoDataFormulario } from "@/components/ui/campo-data";
import { registrarTaxaFixada, type ResultadoFixacao } from "@/lib/cobranca/fixacao-actions";
import { MOTIVO_MAX } from "@/lib/cobranca/fixacao-admin";

const campo = "mt-1 w-full rounded-lg border border-sage-200 px-3 py-2 text-base";

/** E977: registrar a taxa fixada de um proprietário (só insere; o histórico fica). */
export function FormTaxaFixada({ hoje }: { hoje: string }) {
  const [estado, enviar, pendente] = useActionState<ResultadoFixacao | null, FormData>(registrarTaxaFixada, null);
  return (
    <form action={enviar} className="grid gap-3 sm:grid-cols-2" data-testid="taxa-fixada-form">
      <label className="block text-sm font-semibold text-ink sm:col-span-2">
        E-mail da conta do proprietário
        <input name="email" type="email" required autoComplete="off" className={campo} data-testid="taxa-fixada-email" />
      </label>
      <label className="block text-sm font-semibold text-ink">
        Taxa (%)
        <input name="taxa" inputMode="decimal" required placeholder="ex.: 4 ou 4,5" className={campo} data-testid="taxa-fixada-taxa" />
      </label>
      <label className="block text-sm font-semibold text-ink">
        Vale até (inclusive)
        <span className="mt-1 block"><CampoDataFormulario name="validoAte" required min={hoje} className={campo} data-testid="taxa-fixada-validade" /></span>
      </label>
      <label className="block text-sm font-semibold text-ink sm:col-span-2">
        Motivo da decisão
        <textarea name="motivo" required minLength={3} maxLength={MOTIVO_MAX} rows={3} className={campo} data-testid="taxa-fixada-motivo" />
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pendente} aria-busy={pendente} data-testid="taxa-fixada-registrar">
          Registrar taxa fixada
        </Button>
        {estado?.erro && <p role="alert" className="mt-2 text-sm text-red-600" data-testid="taxa-fixada-erro">{estado.erro}</p>}
        {estado?.ok && <p role="status" className="mt-2 text-sm text-forest" data-testid="taxa-fixada-ok">{estado.mensagem}</p>}
      </div>
    </form>
  );
}
