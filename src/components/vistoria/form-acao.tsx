"use client";

import { useActionState, useEffect, useRef } from "react";
import { useEnvioSemLimpar } from "@/components/ui/use-envio-sem-limpar";

type Res = { ok: true; mensagem?: string } | { ok: false; erro: string; campos?: { campo: string; mensagem: string }[] };

const MARCA = "data-erro-campo";
const VERMELHO = ["border-red-600", "ring-1", "ring-red-600"];

/** Tira as marcas de erro de uma tentativa anterior. */
function limparMarcas(form: HTMLFormElement) {
  form.querySelectorAll(`[${MARCA}]`).forEach((n) => n.remove());
  form.querySelectorAll('[aria-invalid="true"]').forEach((el) => {
    el.removeAttribute("aria-invalid");
    el.classList.remove(...VERMELHO);
  });
}

/**
 * Formulário de uma ação da avaliação do imóvel, com o resultado logo abaixo (esqueleto do Prompt 62-B1).
 * E818: (1) erro nunca limpa o formulário — o envio é por onSubmit (useEnvioSemLimpar), e só o sucesso limpa, como antes;
 * (2) cada campo apontado pela ação (`campos`) fica em vermelho, com a mensagem própria logo abaixo;
 * (3) a página rola até o primeiro campo com erro e o foca.
 */
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
  const enviarSemLimpar = useEnvioSemLimpar(executar);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form || !res) return;
    limparMarcas(form);
    if (res.ok) {
      form.reset(); // o sucesso limpa, como antes
      return;
    }
    let primeiro: HTMLElement | null = null;
    for (const c of res.campos ?? []) {
      const el = form.elements.namedItem(c.campo);
      const alvo = (el instanceof RadioNodeList ? el[0] : el) as HTMLElement | null;
      if (!alvo) continue;
      alvo.setAttribute("aria-invalid", "true");
      alvo.classList.add(...VERMELHO);
      const msg = document.createElement("span");
      msg.setAttribute(MARCA, "");
      msg.setAttribute("role", "alert");
      msg.setAttribute("data-testid", `campo-erro-${c.campo}`);
      msg.className = "mt-1 block text-sm font-semibold text-red-700";
      msg.textContent = c.mensagem;
      // A mensagem fica junto do campo: dentro do <label> que o envolve, logo depois dele (ou, sem label, depois do campo).
      (alvo.closest("label") ?? alvo.parentElement)?.appendChild(msg);
      primeiro ??= alvo;
    }
    if (primeiro) {
      primeiro.scrollIntoView({ block: "center" });
      primeiro.focus({ preventScroll: true });
    }
  }, [res]);

  return (
    <form ref={formRef} onSubmit={enviarSemLimpar} className={className} data-testid={testid} aria-busy={pendente}>
      {children}
      {res && (
        <p role={res.ok ? "status" : "alert"} className={`mt-2 text-sm ${res.ok ? "text-forest" : "text-red-600"}`} data-testid={res.ok ? "acao-ok" : "acao-erro"}>
          {res.ok ? (res.mensagem ?? "Feito.") : res.erro}
        </p>
      )}
    </form>
  );
}
