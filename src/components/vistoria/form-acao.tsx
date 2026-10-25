"use client";

import { useActionState } from "react";

type Res = { ok: true; mensagem?: string } | { ok: false; erro: string };

/** Formulário de uma ação da avaliação do imóvel, com o resultado logo abaixo (esqueleto do Prompt 62-B1). */
export function FormAcao({
  acao,
  children,
  className,
  testid,
}: {
  acao: (form: FormData) => Promise<Res>;
  children: React.ReactNode;
  className?: string;
  testid?: string;
}) {
  const [res, executar, pendente] = useActionState<Res | null, FormData>((_, f) => acao(f), null);
  return (
    <form action={executar} className={className} data-testid={testid} aria-busy={pendente}>
      {children}
      {res && (
        <p role={res.ok ? "status" : "alert"} className={`mt-2 text-sm ${res.ok ? "text-forest" : "text-red-600"}`} data-testid={res.ok ? "acao-ok" : "acao-erro"}>
          {res.ok ? (res.mensagem ?? "Feito.") : res.erro}
        </p>
      )}
    </form>
  );
}
