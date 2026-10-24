"use client";

import Link from "next/link";
import { ChevronRight, FileText, LogOut, MessageSquareText, ShieldCheck, BookOpenText } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { CaixaEmailsTeste } from "@/components/account/caixa-emails-teste";
import { CartaoComFoto } from "@/components/account/cartao-com-foto";
import { CONTATO_AJUDA, CONTATO_LINHA, LINHAS_AJUDA } from "@/lib/conta/ajuda";
import { PHOTOS } from "@/lib/media";
import { useSair } from "./use-sair";

const ICONES = { BookOpenText, MessageSquareText, FileText, ShieldCheck } as const;

/**
 * A8 — Conta › Ajuda (mockup perfil-08), com o E71 (QA 24/10): "Fale com a Viva" é o cartão em destaque, com a foto
 * (padrão dos Papéis) e a frase do atendimento; embaixo, um cartão com Central de ajuda, Termos de uso e Política de
 * privacidade, cada linha com a sua descrição curta e o ícone (foto só no contato), e "Sair da conta" como última
 * linha do mesmo cartão. "Sair da Viva" (pausar ou apagar a conta) tem a sua tela, aberta por "Excluir minha conta" em
 * Privacidade. A tela fecha na linha institucional da casca (E75).
 */
export function TelaAjuda() {
  const sair = useSair();
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
          {/* E71: "Sair da conta" é a última linha do cartão (antes ficava sozinho, longe, sobre o fundo). */}
          <li>
            <button type="button" onClick={sair} className="flex min-h-16 w-full items-center gap-4 py-3 text-left text-red-700" data-testid="ajuda-sair">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-50" aria-hidden>
                <LogOut className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1 text-base font-semibold">Sair da conta</span>
            </button>
          </li>
        </ul>
      </section>

      {/* Só nas contas de teste: carrega depois e fica por último para não empurrar nada (t183). */}
      <CaixaEmailsTeste />
    </div>
  );
}
