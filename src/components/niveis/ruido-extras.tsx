"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CartaoEscolha } from "@/components/anuncio/escolha-assistente";
import { EXTRAS, PERGUNTAS_RUIDO, type ChaveRuido } from "@/config/niveis";
import { salvarExtras, salvarRuido, type NivelDoImovelTela } from "@/lib/data/nivel-actions";
import { semQuedaDeRede } from "@/lib/erro-de-rede";

/** E193: cada pergunta do ruído como afirmação para marcar (✓ = sim). */
const TEXTO_CARTAO_RUIDO: Record<ChaveRuido, string> = {
  via_intensa: "Via de tráfego intenso na fachada",
  noturno_obra_100m: "Bares, casas de show ou obra a até 100 m",
  aviao_ferrovia: "Rota de avião ou perto de ferrovia",
  isolamento_acustico: "Janelas com isolamento acústico",
};

/**
 * E606: o Passo 5 tem UM modelo de gravar — cada toque salva na hora, como a estrutura de acessibilidade e as
 * comodidades (antes, Ruído e Extras exigiam o próprio "Salvar", e quem fechava o bloco sem apertar perdia o que
 * marcou). O ruído é um questionário: o toque num cartão grava as quatro respostas (o que ficou sem marcar = "não");
 * "Nenhum destes" grava "não" nas quatro de uma vez — a forma de responder sem marcar nada.
 */
export const COMO_SALVA_RUIDO = "Cada toque salva na hora.";
export const COMO_SALVA_EXTRAS = "Cada toque salva na hora.";
export const RUIDO_NENHUM = "Nenhum destes vale para o imóvel";

type Estado = "" | "salvando" | "salvo" | "erro";

/** A linha de status, igual à da estrutura de acessibilidade (E606: o mesmo texto e os mesmos estados no Passo 5). */
function LinhaComoSalva({ estado, erro, testid, padrao }: { estado: Estado; erro: string | null; testid: string; padrao: string }) {
  return (
    <p className="mt-3 text-xs" role={estado === "erro" ? "alert" : "status"} aria-live="polite" data-testid={testid} data-estado={estado || "parado"}>
      {estado === "" && <span className="text-muted">{padrao}</span>}
      {estado === "salvando" && <span className="text-muted">Salvando…</span>}
      {estado === "salvo" && <span className="text-forest">Salvo.</span>}
      {estado === "erro" && <span className="text-red-700">{erro ?? "Não foi possível salvar agora. Tente de novo."}</span>}
    </p>
  );
}

/**
 * Adendo 59.1 — ruído e extras do imóvel. Usados na página do nível e, desde o E143, dentro do Passo 5 do cadastro
 * (onSalvo recalcula o nível lá; aqui, sem onSalvo, a página do servidor é recarregada).
 */
export function Ruido({ propertyId, inicial, onSalvo }: { propertyId: string; inicial: NivelDoImovelTela["ruido"]; onSalvo?: () => void }) {
  const router = useRouter();
  const salvo = onSalvo ?? (() => router.refresh());
  const [r, setR] = useState<Record<string, boolean>>(() => Object.fromEntries(PERGUNTAS_RUIDO.map((p) => [p.chave, inicial ? inicial[p.chave] === true : false])));
  // Respondido = já gravou alguma vez (o "Nenhum destes" só aparece marcado quando a resposta gravada é "não" nas quatro).
  const [respondido, setRespondido] = useState(!!inicial);
  const [estado, setEstado] = useState<Estado>("");
  const [erro, setErro] = useState<string | null>(null);
  async function gravar(novo: Record<string, boolean>) {
    setR(novo);
    setEstado("salvando");
    setErro(null);
    const res = await semQuedaDeRede(salvarRuido(propertyId, novo));
    if (res.ok) {
      setRespondido(true);
      setEstado("salvo");
      salvo();
    } else {
      setEstado("erro");
      setErro(res.erro);
    }
  }
  const nenhum = respondido && PERGUNTAS_RUIDO.every((p) => !r[p.chave]);
  return (
    <section className="rounded-xl border border-line bg-white p-4" data-testid="ruido-form">
      <h2 className="text-base font-semibold text-ink">Ruído</h2>
      <p className="mt-1 text-xs text-muted">Marque o que vale para o imóvel; o que ficar sem marcar conta como “não”. A classe sai da exposição (baixo, médio ou alto). O morador confere na entrada.</p>
      {/* E193 (reteste de 30/10): um cartão de marcar por pergunta. Desmarcado = não. */}
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {PERGUNTAS_RUIDO.map((p) => (
          <li key={p.chave}>
            <CartaoEscolha
              papel="checkbox"
              on={r[p.chave] === true}
              onClick={() => void gravar({ ...r, [p.chave]: !r[p.chave] })}
              disabled={estado === "salvando"}
              rotulo={TEXTO_CARTAO_RUIDO[p.chave]}
              testid={`ruido-${p.chave}`}
              className="h-full"
            />
          </li>
        ))}
        <li className="sm:col-span-2">
          <CartaoEscolha
            papel="checkbox"
            on={nenhum}
            onClick={() => void gravar(Object.fromEntries(PERGUNTAS_RUIDO.map((p) => [p.chave, false])))}
            disabled={estado === "salvando"}
            rotulo={RUIDO_NENHUM}
            testid="ruido-nenhum"
          />
        </li>
      </ul>
      <LinhaComoSalva estado={estado} erro={erro} testid="ruido-como-salva" padrao={COMO_SALVA_RUIDO} />
    </section>
  );
}

export function Extras({ propertyId, inicial, onSalvo }: { propertyId: string; inicial: string[]; onSalvo?: () => void }) {
  const router = useRouter();
  const salvo = onSalvo ?? (() => router.refresh());
  const [sel, setSel] = useState<Set<string>>(() => new Set(inicial));
  const [estado, setEstado] = useState<Estado>("");
  const [erro, setErro] = useState<string | null>(null);
  async function alternar(chave: string) {
    const novo = sel.has(chave) ? new Set([...sel].filter((k) => k !== chave)) : new Set([...sel, chave]);
    setSel(novo);
    setEstado("salvando");
    setErro(null);
    const res = await semQuedaDeRede(salvarExtras(propertyId, [...novo]));
    if (res.ok) {
      setEstado("salvo");
      salvo();
    } else {
      setEstado("erro");
      setErro(res.erro);
    }
  }
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
              onClick={() => void alternar(e.chave)}
              disabled={estado === "salvando"}
              testid={`extra-${e.chave}`}
              rotulo={e.rotulo}
              className="h-full"
            />
          </li>
        ))}
      </ul>
      <LinhaComoSalva estado={estado} erro={erro} testid="extras-como-salva" padrao={COMO_SALVA_EXTRAS} />
    </section>
  );
}
