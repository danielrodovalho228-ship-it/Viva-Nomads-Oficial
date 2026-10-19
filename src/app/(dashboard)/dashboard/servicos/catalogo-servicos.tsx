"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { avisarServicoDisponivel, type ServicoView } from "@/lib/data/servicos-morador-actions";
import { hrefPedidoServico } from "@/lib/servicos-morador";

/**
 * S1 — catálogo (complemento da ordem 521c5af7): grade PAR (2 colunas a 390 px, 4 a 1280 px), cartão = foto da
 * categoria, nome, linha curta e o selo "Em breve" enquanto não houver parceiro aprovado. O cartão "Em breve" abre o
 * "Avise-me quando estiver disponível"; com parceiro aprovado (31b no ar), vai ao pedido com contrato e imóvel já
 * preenchidos. Sem foto, o cartão nem chega aqui (o servidor o tira): nunca há ícone no lugar da foto.
 */
export function CatalogoServicos({ servicos, contratoId, propertyId }: { servicos: ServicoView[]; contratoId: string | null; propertyId: string | null }) {
  const [aberto, setAberto] = useState<string | null>(null);
  if (servicos.length === 0) return <p className="text-sm text-muted" data-testid="servicos-vazio">Os serviços de parceiros aparecem aqui em breve.</p>;
  const selecionado = servicos.find((s) => s.id === aberto) ?? null;
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="servicos-lista">
        {servicos.map((s) => {
          const conteudo = (
            <>
              <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-t-2xl bg-sage-100">
                <Image src={s.foto.src} alt={s.foto.alt} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover" data-testid="servico-foto" />
              </span>
              <span className="block p-3">
                <span className="block font-title text-sm font-bold text-ink sm:text-base">{s.nome}</span>
                <span className="mt-1 block text-xs text-muted sm:text-sm">{s.resumo}</span>
                {!s.aceitaPedido && (
                  <span className="mt-2 inline-flex rounded-full bg-sage-100 px-2.5 py-0.5 text-xs font-semibold text-forest" data-testid="servico-embreve">
                    Em breve
                  </span>
                )}
              </span>
            </>
          );
          const classe = "block h-full w-full overflow-hidden rounded-2xl border border-sage-200 bg-white text-left transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-forest";
          return (
            <li key={s.id} data-testid={`servico-${s.id}`}>
              {s.aceitaPedido ? (
                <Link href={hrefPedidoServico(s.id, contratoId, propertyId)} className={classe} data-testid="servico-cartao">
                  {conteudo}
                </Link>
              ) : (
                <button type="button" onClick={() => setAberto(s.id)} className={classe} data-testid="servico-cartao" aria-haspopup="dialog">
                  {conteudo}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {selecionado && <AviseMe servico={selecionado} onFechar={() => setAberto(null)} />}
    </>
  );
}

function AviseMe({ servico, onFechar }: { servico: ServicoView; onFechar: () => void }) {
  const [estado, setEstado] = useState<"livre" | "enviando" | "ok">("livre");
  const [erro, setErro] = useState<string | null>(null);
  async function avisar() {
    setErro(null);
    setEstado("enviando");
    const r = await avisarServicoDisponivel(servico.id);
    if (!r.ok) {
      setEstado("livre");
      setErro(r.error ?? "Não foi possível registrar agora.");
      return;
    }
    setEstado("ok");
  }
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="aviseme-titulo" className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" data-testid="servico-aviseme">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 id="aviseme-titulo" className="font-title text-lg font-bold text-ink">
          {servico.nome}
        </h2>
        <p className="mt-1 text-sm text-muted">{servico.descricao}</p>
        <p className="mt-3 text-sm text-ink">Este serviço ainda não tem parceiro aprovado na sua cidade.</p>
        {estado === "ok" ? (
          <p className="mt-4 rounded-lg bg-sage-100 px-3 py-2 text-sm font-semibold text-forest" role="status" data-testid="servico-aviseme-ok">
            Pronto: avisamos você quando estiver disponível.
          </p>
        ) : (
          <Button variant="primary" className="mt-4 w-full" disabled={estado === "enviando"} onClick={avisar} data-testid="servico-aviseme-enviar">
            Avise-me quando estiver disponível
          </Button>
        )}
        {erro && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {erro}
          </p>
        )}
        <Button variant="secondary" className="mt-2 w-full" onClick={onFechar} data-testid="servico-aviseme-fechar">
          Fechar
        </Button>
      </div>
    </div>
  );
}
