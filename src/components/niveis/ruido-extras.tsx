"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CartaoEscolha } from "@/components/anuncio/escolha-assistente";
import { EXTRAS, PERGUNTAS_RUIDO, type ChaveRuido } from "@/config/niveis";
import { salvarExtras, salvarRuido, type NivelDoImovelTela } from "@/lib/data/nivel-actions";

/** E193: cada pergunta do ruído como afirmação para marcar (✓ = sim). */
const TEXTO_CARTAO_RUIDO: Record<ChaveRuido, string> = {
  via_intensa: "Via de tráfego intenso na fachada",
  noturno_obra_100m: "Bares, casas de show ou obra a até 100 m",
  aviao_ferrovia: "Rota de avião ou perto de ferrovia",
  isolamento_acustico: "Janelas com isolamento acústico",
};

/**
 * Adendo 59.1 — ruído e extras do imóvel. Usados na página do nível e, desde o E143, dentro do Passo 5 do cadastro
 * (onSalvo recalcula o nível lá; aqui, sem onSalvo, a página do servidor é recarregada).
 */
export function Ruido({ propertyId, inicial, onSalvo }: { propertyId: string; inicial: NivelDoImovelTela["ruido"]; onSalvo?: () => void }) {
  const router = useRouter();
  const salvo = onSalvo ?? (() => router.refresh());
  const [r, setR] = useState<Record<string, boolean | null>>(() => Object.fromEntries(PERGUNTAS_RUIDO.map((p) => [p.chave, inicial ? inicial[p.chave] : null])));
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  return (
    <section className="rounded-xl border border-line bg-white p-4" data-testid="ruido-form">
      <h2 className="text-base font-semibold text-ink">Ruído</h2>
      <p className="mt-1 text-xs text-muted">Marque o que vale para o imóvel; o que ficar sem marcar conta como “não”. A classe sai da exposição (baixo, médio ou alto). O morador confere na entrada.</p>
      {/* E193 (reteste de 30/10): no lugar dos pares Sim/Não, um cartão de marcar por pergunta — o mesmo cartão grande de
          todas as escolhas do assistente. Desmarcado = não; o que se grava continua o mesmo (sim ou não em cada uma). */}
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {PERGUNTAS_RUIDO.map((p) => (
          <li key={p.chave}>
            <CartaoEscolha
              papel="checkbox"
              on={r[p.chave] === true}
              onClick={() => setR((a) => ({ ...a, [p.chave]: a[p.chave] !== true }))}
              rotulo={TEXTO_CARTAO_RUIDO[p.chave]}
              testid={`ruido-${p.chave}`}
              className="h-full"
            />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const respostas = Object.fromEntries(PERGUNTAS_RUIDO.map((p) => [p.chave, r[p.chave] === true]));
              const res = await salvarRuido(propertyId, respostas);
              setMsg(res.ok ? { ok: true, t: res.mensagem ?? "Salvo." } : { ok: false, t: res.erro });
              if (res.ok) salvo();
            })
          }
          data-testid="ruido-salvar"
        >
          Salvar ruído
        </Button>
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-ink" : "text-sm text-red-700"} data-testid="ruido-resultado">
            {msg.t}
          </p>
        )}
      </div>
    </section>
  );
}

export function Extras({ propertyId, inicial, onSalvo }: { propertyId: string; inicial: string[]; onSalvo?: () => void }) {
  const router = useRouter();
  const salvo = onSalvo ?? (() => router.refresh());
  const [sel, setSel] = useState<Set<string>>(() => new Set(inicial));
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  return (
    <section className="rounded-xl border border-line bg-white p-4" data-testid="extras-form">
      <h2 className="text-base font-semibold text-ink">Extras</h2>
      <p className="mt-1 text-xs text-muted">Aparecem na ficha como fato. Não mudam o nível.</p>
      {/* E193 (reteste de 30/10): várias escolhas = o cartão grande da Qualificação, em grade. */}
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {EXTRAS.map((e) => (
          <li key={e.chave}>
            <CartaoEscolha
              papel="checkbox"
              on={sel.has(e.chave)}
              onClick={() => setSel((s) => (s.has(e.chave) ? new Set([...s].filter((k) => k !== e.chave)) : new Set([...s, e.chave])))}
              testid={`extra-${e.chave}`}
              rotulo={e.rotulo}
              className="h-full"
            />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const res = await salvarExtras(propertyId, [...sel]);
              setMsg(res.ok ? { ok: true, t: res.mensagem ?? "Salvo." } : { ok: false, t: res.erro });
              if (res.ok) salvo();
            })
          }
          data-testid="extras-salvar"
        >
          Salvar extras
        </Button>
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-ink" : "text-sm text-red-700"} data-testid="extras-resultado">
            {msg.t}
          </p>
        )}
      </div>
    </section>
  );
}
