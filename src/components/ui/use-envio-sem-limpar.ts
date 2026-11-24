"use client";

import { startTransition, useCallback, useEffect, useRef } from "react";

/**
 * E818: envio de formulário com ação de servidor SEM limpar o que a pessoa digitou. No React 19, `<form action={fn}>`
 * limpa os campos não controlados assim que a ação termina — também quando ela devolve erro (o cadastro de vistoriador
 * voltava em branco com o CNPJ inválido). Aqui o envio é por onSubmit: o mesmo despacho do useActionState, dentro de
 * startTransition, e o formulário só é limpo quando a ação dá certo (`limparNoSucesso`, como antes).
 */
export function useEnvioSemLimpar(despachar: (dados: FormData) => void) {
  return useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      startTransition(() => despachar(new FormData(form)));
    },
    [despachar],
  );
}

/** E818: o sucesso limpa o formulário, como o <form action> fazia (o erro não). Devolve a ref para pôr no <form>. */
export function useLimparNoSucesso(res: { ok: boolean } | null) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (res?.ok) ref.current?.reset();
  }, [res]);
  return ref;
}
