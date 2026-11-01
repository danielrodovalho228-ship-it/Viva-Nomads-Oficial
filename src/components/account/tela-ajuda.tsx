"use client";

import Link from "next/link";
import { ChevronRight, FileText, MessageSquareText, ShieldCheck, BookOpenText } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { CaixaEmailsTeste } from "@/components/account/caixa-emails-teste";
import { CartaoComFoto } from "@/components/account/cartao-com-foto";
import { CONTATO_AJUDA, CONTATO_LINHA, LINHAS_AJUDA } from "@/lib/conta/ajuda";
import { PHOTOS } from "@/lib/media";

const ICONES = { BookOpenText, MessageSquareText, FileText, ShieldCheck } as const;

/**
 * A8 — Conta › Ajuda (mockup perfil-08), com o E71 (QA 24/10): "Fale com a Viva" é o cartão em destaque, com a foto
 * (padrão dos Papéis) e a frase do atendimento; embaixo, um cartão com Central de ajuda, Termos de uso e Política de
 * privacidade, cada linha com a sua descrição curta e o ícone (foto só no contato). E312 (QA 31/10): o "Sair" aparece
 * UMA vez no total — o do menu da Conta (avatar), em todas as telas; a tela de Ajuda não repete o botão. "Sair da Viva" (pausar ou apagar a conta) tem a sua tela, aberta por "Excluir minha conta" em
 * Privacidade. A tela fecha na linha institucional da casca (E75).
 */
export function TelaAjuda() {
  return (
    <div className="grid gap-4" data-testid="tela-ajuda">
      <CartaoComFoto foto={PHOTOS.ajudaContato} testId="ajuda-contato" rotulo={CONTATO_AJUDA.rotulo}>
        <h2 className="font-title text-2xl font-semibold text-ink">{CONTATO_AJUDA.rotulo}</h2>
        <p className="mt-1 text-sm text-ink" data-testid="ajuda-contato-linha">
          {CONTATO_LINHA}
        </p>
        <ButtonLink href={CONTATO_AJUDA.href} className="mt-3" data-testid="ajuda-link-fale">
          <MessageSquareText className="h-4 w-4" aria-hidden /> Falar com a Viva
        </ButtonLink>
      </CartaoComFoto>

      <section className="rounded-xl bg-white" aria-label="Ajuda e documentos">
        <ul className="divide-y divide-line px-4 sm:px-6">
          {LINHAS_AJUDA.map((l) => {
            const Icone = ICONES[l.icone];
            return (
              <li key={l.href}>
                <Link href={l.href} className="flex min-h-16 items-center gap-4 py-3 text-ink hover:text-forest" data-testid={`ajuda-link-${l.id}`}>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sage-100 text-forest" aria-hidden>
                    <Icone className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base">{l.rotulo}</span>
                    <span className="block text-sm text-muted" data-testid={`ajuda-desc-${l.id}`}>
                      {l.descricao}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Só nas contas de teste: carrega depois e fica por último para não empurrar nada (t183). */}
      <CaixaEmailsTeste />
    </div>
  );
}
