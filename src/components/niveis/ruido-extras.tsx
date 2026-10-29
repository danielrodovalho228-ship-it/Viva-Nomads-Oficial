"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CartaoEscolha, Pilula } from "@/components/anuncio/escolha-assistente";
import { EXTRAS, PERGUNTAS_RUIDO } from "@/config/niveis";
import { salvarExtras, salvarRuido, type NivelDoImovelTela } from "@/lib/data/nivel-actions";

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
  const completo = PERGUNTAS_RUIDO.every((p) => r[p.chave] !== null);
  return (
    <section className="rounded-xl border border-line bg-white p-4" data-testid="ruido-form">
      <h2 className="text-base font-semibold text-ink">Ruído</h2>
      <p className="mt-1 text-xs text-muted">A classe sai da exposição (baixo, médio ou alto). O morador confere na entrada.</p>
      <ul className="mt-3 space-y-2">
        {PERGUNTAS_RUIDO.map((p) => (
          <li key={p.chave} className="text-sm text-ink" role="radiogroup" aria-label={p.texto}>
            <p>{p.texto}</p>
            {/* E193: sim/não no cartão da Qualificação (antes, botões redondos de rádio). */}
            <div className="mt-1 grid grid-cols-2 gap-2">
              <CartaoEscolha on={r[p.chave] === true} onClick={() => setR((a) => ({ ...a, [p.chave]: true }))} rotulo="Sim" testid={`ruido-${p.chave}-sim`} />
              <CartaoEscolha on={r[p.chave] === false} onClick={() => setR((a) => ({ ...a, [p.chave]: false }))} rotulo="Não" testid={`ruido-${p.chave}-nao`} />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pendente || !completo}
          onClick={() =>
            iniciar(async () => {
              const res = await salvarRuido(propertyId, r);
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
      {/* E193: várias escolhas = pílulas (antes, caixas quadradas). */}
      <ul className="mt-3 flex flex-wrap gap-2">
        {EXTRAS.map((e) => (
          <li key={e.chave}>
            <Pilula
              on={sel.has(e.chave)}
              onClick={() => setSel((s) => (s.has(e.chave) ? new Set([...s].filter((k) => k !== e.chave)) : new Set([...s, e.chave])))}
              testid={`extra-${e.chave}`}
            >
              {e.rotulo}
            </Pilula>
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
