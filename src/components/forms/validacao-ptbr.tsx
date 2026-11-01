"use client";

import { useEffect } from "react";
import { mensagemValidacaoPtBr } from "@/lib/forms/validacao-ptbr";

type Campo = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
const ehCampo = (t: EventTarget | null): t is Campo => t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement;

/**
 * E384 (01/11): em TODAS as telas, a mensagem da validação nativa sai em português ("Preencha este campo." no lugar de
 * "Please fill out this field."). No `invalid` — antes de o navegador mostrar o balão — a mensagem vira a nossa.
 * A nossa mensagem é limpa ao digitar/trocar e também antes de cada nova tentativa (clique ou tecla), para que um valor
 * posto por código (calendário, máscara) nunca fique preso como "inválido". Mensagem própria de outro código é respeitada.
 */
export function ValidacaoPtBr() {
  useEffect(() => {
    const nossas = new Set<Campo>();
    const limparCampo = (c: Campo) => {
      c.setCustomValidity("");
      nossas.delete(c);
    };
    const aoInvalidar = (e: Event) => {
      const c = e.target;
      if (!ehCampo(c)) return;
      if (c.validity.customError && !nossas.has(c)) return;
      if (nossas.has(c)) limparCampo(c);
      const msg = mensagemValidacaoPtBr(c);
      if (!msg) return;
      c.setCustomValidity(msg);
      nossas.add(c);
    };
    const aoMudar = (e: Event) => {
      const c = e.target;
      if (ehCampo(c) && nossas.has(c)) limparCampo(c);
    };
    const antesDeTentar = () => {
      for (const c of [...nossas]) limparCampo(c);
    };
    document.addEventListener("invalid", aoInvalidar, true);
    document.addEventListener("input", aoMudar, true);
    document.addEventListener("change", aoMudar, true);
    document.addEventListener("click", antesDeTentar, true);
    document.addEventListener("keydown", antesDeTentar, true);
    return () => {
      document.removeEventListener("invalid", aoInvalidar, true);
      document.removeEventListener("input", aoMudar, true);
      document.removeEventListener("change", aoMudar, true);
      document.removeEventListener("click", antesDeTentar, true);
      document.removeEventListener("keydown", antesDeTentar, true);
    };
  }, []);
  return null;
}
