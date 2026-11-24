"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useEnvioSemLimpar } from "@/components/ui/use-envio-sem-limpar";

type Res = { ok: true; mensagem?: string } | { ok: false; erro: string; campos?: { campo: string; mensagem: string }[] };

const MARCA = "data-erro-campo";
const VERMELHO = ["border-red-600", "ring-1", "ring-red-600"];
/** Marca o botão que o envio em curso desligou (E1091), para só esse voltar a ligar no fim (E1117, perna 3). */
const DESLIGADO_PELO_ENVIO = "data-desligado-pelo-envio";
/**
 * E1152: a nota fixa de um campo (`data-nota-do-campo="<campo>"`) que diz a MESMA frase da recusa desse campo sai da
 * tela enquanto a recusa está lá — a regra é dita uma vez, junto do campo, e não empilhada com a nota.
 */
const NOTA_DO_CAMPO = "data-nota-do-campo";
const NOTA_ESCONDIDA = "data-nota-escondida-pela-recusa";

/** Tira as marcas de erro de uma tentativa anterior. */
function limparMarcas(form: HTMLFormElement) {
  form.querySelectorAll(`[${MARCA}]`).forEach((n) => n.remove());
  form.querySelectorAll(`[${NOTA_ESCONDIDA}]`).forEach((n) => {
    n.removeAttribute("hidden");
    n.removeAttribute(NOTA_ESCONDIDA);
  });
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
 * E1091: (4) enquanto envia, diz "Enviando…", desliga os botões de envio e ignora um segundo envio.
 * E1117 (perna 1): o resultado mostrado é o da ÚLTIMA tentativa. Uma tentativa nova — enviada, ou barrada pelo navegador
 * por faltar um campo obrigatório — tira da tela o resultado anterior: "Foto enviada." de uma foto que já foi não pode
 * ficar por baixo de um envio que não gravou nada.
 * E1117 (perna 3) com o E1091: o efeito do envio só religa o botão que ele mesmo desligou. Um botão que a página mostra
 * desativado ("Concluir a visita" enquanto falta foto) fica desativado antes, durante e depois do envio.
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
  // E1091: um segundo envio com o primeiro em curso é ignorado — antes entrava na fila e a tela demorava ainda mais.
  const emCurso = useRef(false);
  const enviarSemLimpar = useEnvioSemLimpar((dados: FormData) => {
    if (emCurso.current) return;
    emCurso.current = true;
    executar(dados);
  });
  const formRef = useRef<HTMLFormElement>(null);
  // O resultado que uma tentativa nova já tirou da tela (por identidade: cada resposta da ação é um objeto novo).
  const [superado, setSuperado] = useState<Res | null>(null);
  const mostrar = res && res !== superado ? res : null;

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
      // E1152: a nota do campo que diz a mesma frase da recusa esconde-se; volta na tentativa seguinte.
      form.querySelectorAll<HTMLElement>(`[${NOTA_DO_CAMPO}]`).forEach((nota) => {
        if (nota.getAttribute(NOTA_DO_CAMPO) !== c.campo || nota.textContent?.trim() !== c.mensagem) return;
        nota.setAttribute("hidden", "");
        nota.setAttribute(NOTA_ESCONDIDA, "");
      });
      primeiro ??= alvo;
    }
    if (primeiro) {
      primeiro.scrollIntoView({ block: "center" });
      primeiro.focus({ preventScroll: true });
    }
  }, [res]);

  // E1091: enquanto envia, os botões de envio ficam desligados (sem segundo clique) e voltam no fim. Os campos ficam
  // como estão: o que a pessoa digitou já foi lido no envio.
  useEffect(() => {
    emCurso.current = pendente;
    const form = formRef.current;
    if (!form) return;
    // E1117 (perna 3): só mexe no botão que ESTE efeito desligou. Sem isto, o efeito religava na montagem e no fim de
    // cada envio todo botão de envio do formulário — também o que a página mostra desativado.
    form.querySelectorAll<HTMLButtonElement>('button[type="submit"], button:not([type])').forEach((b) => {
      if (pendente) {
        if (b.disabled) return;
        b.disabled = true;
        b.setAttribute(DESLIGADO_PELO_ENVIO, "");
      } else if (b.hasAttribute(DESLIGADO_PELO_ENVIO)) {
        b.disabled = false;
        b.removeAttribute(DESLIGADO_PELO_ENVIO);
      }
    });
  }, [pendente]);

  return (
    <form
      ref={formRef}
      onSubmit={enviarSemLimpar}
      onSubmitCapture={() => setSuperado(res)}
      onInvalidCapture={() => setSuperado(res)}
      className={className}
      data-testid={testid}
      aria-busy={pendente}
    >
      {children}
      {pendente && (
        <p role="status" className="mt-2 w-full text-sm text-muted" data-testid="acao-enviando">
          Enviando…
        </p>
      )}
      {mostrar && (
        <p role={mostrar.ok ? "status" : "alert"} className={`mt-2 text-sm ${mostrar.ok ? "text-forest" : "text-red-600"}`} data-testid={mostrar.ok ? "acao-ok" : "acao-erro"}>
          {mostrar.ok ? (mostrar.mensagem ?? "Feito.") : mostrar.erro}
        </p>
      )}
    </form>
  );
}
