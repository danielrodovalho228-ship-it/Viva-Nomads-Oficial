"use client";

import { useState } from "react";
import { aoTocarToggle } from "@/lib/anuncio/bloco-opcional";
import { CartaoEscolha } from "@/components/anuncio/escolha-assistente";

/**
 * Bloco opcional do formulário (padrão E56): cartão grande tocável no topo; desligado, o grupo não aparece; ligar abre o grupo
 * inteiro; desligar com dados pede confirmação aqui mesmo (sem diálogo do navegador) e, confirmado, chama `onDesligar`
 * para o formulário limpar os dados do grupo. O estado inicial (`ligado`) vem de `nasceLigado(temDadosSalvos)`.
 */
export function BlocoOpcional({
  id,
  titulo,
  descricao,
  ligado,
  temDados,
  onLigar,
  onDesligar,
  children,
  icone: Icone,
}: {
  id: string;
  titulo: string;
  /** Conformidade do cadastro (mockup 06, 01/11): ícone da regra ao lado do título (opcional). */
  icone?: React.ComponentType<{ className?: string }>;
  descricao?: string;
  ligado: boolean;
  /** O grupo tem algo preenchido agora (decide se desligar pede confirmação). */
  temDados: boolean;
  onLigar: () => void;
  /** Desligar confirmado: o formulário apaga os dados do grupo e desliga. */
  onDesligar: () => void;
  children: React.ReactNode;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const tocar = () => {
    const acao = aoTocarToggle(ligado, temDados);
    if (acao === "ligar") onLigar();
    else if (acao === "desligar") onDesligar();
    else setConfirmando(true);
  };
  // E193: dentro do assistente a pergunta do bloco é um CARTÃO GRANDE tocável (✓ redondo), como todas as outras escolhas;
  // o interruptor (trilho) era o terceiro estilo de controle. Mesma semântica (role=switch) e mesmo testid de antes.
  return (
    <div className="space-y-2" data-testid={`bloco-${id}`} data-ligado={ligado ? "sim" : "nao"}>
      <CartaoEscolha
        papel="switch"
        on={ligado}
        onClick={tocar}
        testid={`bloco-${id}-toggle`}
        icone={Icone}
        rotulo={titulo}
        dica={descricao}
        aria-labelledby={`bloco-${id}-titulo`}
      />
      <span id={`bloco-${id}-titulo`} className="sr-only">
        {titulo}
      </span>
      {confirmando && (
        <div role="alertdialog" aria-labelledby={`bloco-${id}-confirmar-texto`} className="mx-4 mb-4 rounded-lg bg-surface-2 p-3" data-testid={`bloco-${id}-confirmar`}>
          <p id={`bloco-${id}-confirmar-texto`} className="text-sm text-ink">
            Desligar “{titulo}” apaga o que você preencheu neste grupo quando salvar. Quer desligar?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-11 rounded-full border border-line bg-white px-4 text-sm font-semibold text-ink"
              onClick={() => {
                setConfirmando(false);
                onDesligar();
              }}
              data-testid={`bloco-${id}-confirmar-desligar`}
            >
              Desligar e apagar
            </button>
            <button
              type="button"
              className="min-h-11 rounded-full px-4 text-sm font-semibold text-forest underline underline-offset-4"
              onClick={() => setConfirmando(false)}
              data-testid={`bloco-${id}-confirmar-manter`}
            >
              Manter
            </button>
          </div>
        </div>
      )}
      {ligado && (
        <div className="grid gap-4 rounded-xl border border-line bg-white p-4" data-testid={`bloco-${id}-conteudo`}>
          {children}
        </div>
      )}
    </div>
  );
}
