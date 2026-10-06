"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dataBR } from "@/lib/utils";
import { quemEAPessoa, sugerirResposta } from "@/lib/data/atendimento-actions";
import type { PessoaResumo } from "@/lib/atendimento/copiloto-regras";

/**
 * Copiloto da equipe no chamado: "Quem é a pessoa" (sob demanda, cada consulta
 * vai para o histórico) e "Sugerir resposta" (rascunho + fontes; quem envia é
 * a equipe, depois de conferir).
 */

const STATUS_ANUNCIO: Record<string, string> = { draft: "rascunho", active: "publicado", paused: "pausado" };

export function QuemEAPessoa({ chamadoId }: { chamadoId: string }) {
  const router = useRouter();
  const [p, setP] = useState<PessoaResumo | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function ver() {
    setCarregando(true);
    setErro(null);
    const r = await quemEAPessoa(chamadoId).catch(() => ({ ok: false as const, error: "Falha de conexão." }));
    setCarregando(false);
    if (!r.ok) return setErro(r.error);
    setP(r.pessoa);
    router.refresh(); // mostra a consulta no histórico
  }

  if (!p) {
    return (
      <div data-testid="quem-e-a-pessoa">
        <Button variant="outline" size="sm" disabled={carregando} onClick={ver}>
          <Eye className="h-4 w-4" /> {carregando ? "Carregando…" : "Ver quem é a pessoa"}
        </Button>
        <p className="mt-1.5 text-xs text-muted">Só o necessário para resolver. A consulta fica no histórico (quem viu e quando).</p>
        {erro && <p className="mt-1 text-xs text-red-700">{erro}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm text-ink" data-testid="quem-e-a-pessoa">
      <p>
        <strong>{p.nome ?? "—"}</strong>
        {p.papel ? ` · ${p.papel}` : p.tipo === "visitante" ? " · visitante sem conta" : ""}
        {p.emailMascarado && <span className="block text-xs text-muted">{p.emailMascarado}</span>}
        {p.contaDesde && (
          <span className="block text-xs text-muted">
            conta desde {dataBR(p.contaDesde)}
            {p.contaNova ? " · conta nova (menos de 30 dias)" : ""}
          </span>
        )}
      </p>
      {p.tipo === "conta" && (
        <>
          <Bloco titulo="Anúncios" vazio="Nenhum anúncio.">
            {p.anuncios.map((a, i) => (
              <li key={i}>
                {a.titulo} · {STATUS_ANUNCIO[a.status] ?? a.status}
                {a.status !== "active" && (
                  <span className="block text-muted">{a.podePublicar ? "100% · pronto para publicar" : `falta: ${a.faltam.join("; ")}`}</span>
                )}
              </li>
            ))}
          </Bloco>
          <Bloco titulo="Contratos" vazio="Nenhum contrato.">
            {p.contratos.map((k, i) => (
              <li key={i}>
                {k.imovel} · {k.papel} · {k.status}
                {k.inicio ? ` · ${dataBR(k.inicio)} a ${k.fim ? dataBR(k.fim) : "—"}` : ""}
              </li>
            ))}
          </Bloco>
          <Bloco titulo="Pedidos de Moradia" vazio="Nenhum pedido.">
            {p.pedidos.map((x) => (
              <li key={x.status}>
                {x.quantidade} {x.status}
              </li>
            ))}
          </Bloco>
          <Bloco titulo="Chamados anteriores" vazio="Primeiro chamado.">
            {p.chamadosAnteriores.map((k) => (
              <li key={k.numero}>
                {k.numero} · {k.assunto} · {k.status}
              </li>
            ))}
          </Bloco>
        </>
      )}
      <p className="text-[11px] text-muted">Sem CPF, telefone ou e-mail completo (LGPD).</p>
    </div>
  );
}

function Bloco({ titulo, vazio, children }: { titulo: string; vazio: string; children: React.ReactNode[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{titulo}</p>
      {children.length ? <ul className="mt-1 space-y-1 text-xs">{children}</ul> : <p className="mt-1 text-xs text-muted">{vazio}</p>}
    </div>
  );
}

export interface SugestaoVista {
  fontes: { rotulo: string; resumo: string; erro: boolean }[];
  aviso: string | null;
  custo: string | null;
  conferida: boolean;
}

/** Botão "Sugerir resposta": põe o rascunho na caixa e mostra as fontes. */
export function BotaoSugerir({
  chamadoId,
  disponivel,
  onSugestao,
}: {
  chamadoId: string;
  disponivel: boolean;
  onSugestao: (texto: string, s: SugestaoVista) => void;
}) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <Button
        variant="outline"
        size="sm"
        disabled={carregando || !disponivel}
        title={disponivel ? undefined : "A Viva está desligada"}
        onClick={async () => {
          setCarregando(true);
          setErro(null);
          const r = await sugerirResposta(chamadoId).catch(() => ({ ok: false as const, error: "Falha de conexão." }));
          setCarregando(false);
          if (!r.ok) return setErro(r.error);
          onSugestao(r.texto, { fontes: r.fontes, aviso: r.aviso, custo: r.custo, conferida: false });
          router.refresh();
        }}
      >
        <Sparkles className="h-4 w-4" /> {carregando ? "A Viva está consultando…" : "Sugerir resposta"}
      </Button>
      {erro && <span className="mt-1 text-xs text-red-700">{erro}</span>}
    </span>
  );
}

/** As fontes que a Viva consultou. Enviar só depois de marcar "Conferi". */
export function FontesDaSugestao({ s, onConferir }: { s: SugestaoVista; onConferir: (v: boolean) => void }) {
  return (
    <div className="mb-3 rounded-xl border border-forest/30 bg-sage-100/60 p-3 text-xs text-ink" data-testid="fontes-sugestao">
      <p className="font-semibold">Rascunho da Viva — o que ela consultou</p>
      {s.fontes.length ? (
        <ul className="mt-1.5 space-y-1">
          {s.fontes.map((f, i) => (
            <li key={i}>
              <strong>{f.rotulo}</strong>
              {f.erro ? " (falhou)" : ""}: <span className="text-muted">{f.resumo}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-muted">Nenhum dado da pessoa: só as fontes oficiais (FAQ, planos, regras).</p>
      )}
      {s.aviso && <p className="mt-2 font-semibold text-amber-800">{s.aviso}</p>}
      {s.custo && <p className="mt-1 text-muted">Custo estimado: {s.custo}</p>}
      <label className="mt-2 flex items-center gap-2 font-medium">
        <input type="checkbox" checked={s.conferida} onChange={(e) => onConferir(e.target.checked)} /> Conferi as fontes e o texto
      </label>
    </div>
  );
}
