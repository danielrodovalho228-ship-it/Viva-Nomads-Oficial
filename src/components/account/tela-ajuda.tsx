"use client";

import Link from "next/link";
import { ChevronRight, FileText, MessageSquareText, ShieldCheck, BookOpenText } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { CaixaEmailsTeste } from "@/components/account/caixa-emails-teste";
import { LINKS_AJUDA_CONTA, RODAPE_AJUDA_CONTA } from "@/lib/conta/ajuda";
import { useSair } from "./use-sair";

const ICONES = { BookOpenText, MessageSquareText, FileText, ShieldCheck } as const;

/**
 * A8 — Conta › Ajuda (mockup perfil-08): um cartão com Central de ajuda, Fale com a Viva, Termos de uso e Política de
 * privacidade (ícone num quadrado verde-claro e a seta), "Sair da conta" e o rodapé. "Sair da Viva" (pausar ou apagar
 * a conta) tem a sua tela, aberta por "Excluir minha conta" em Privacidade.
 */
export function TelaAjuda() {
  const sair = useSair();
  return (
    <div data-testid="tela-ajuda">
      <section className="rounded-xl bg-white" aria-label="Ajuda e documentos">
        <ul className="divide-y divide-line px-4 sm:px-6">
          {LINKS_AJUDA_CONTA.map((l) => {
            const Icone = ICONES[l.icone];
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="flex min-h-16 items-center gap-4 py-3 text-base text-ink hover:text-forest"
                  data-testid={`ajuda-link-${l.id}`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sage-100 text-forest" aria-hidden>
                    <Icone className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">{l.rotulo}</span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <button type="button" onClick={sair} className={`mt-6 ${buttonClasses({ variant: "secondary", size: "md" })}`} data-testid="ajuda-sair">
        Sair da conta
      </button>
      <p className="mt-4 text-sm text-muted" data-testid="ajuda-rodape">
        {RODAPE_AJUDA_CONTA}
      </p>

      {/* Só nas contas de teste: carrega depois e fica por último para não empurrar nada (t183). */}
      <CaixaEmailsTeste />
    </div>
  );
}
