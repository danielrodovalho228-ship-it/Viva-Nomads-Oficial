"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ConfirmarNaPagina } from "@/components/ui/confirmar-na-pagina";
import { Panel } from "@/components/dashboard/primitives";
import { atualizarVinculo, convidarParceiroFixo, encerrarVinculo, type OpcaoParceiro, type ParceirosDoImovel, type VinculoNaTela } from "@/lib/automacao/acoes";
import { CATEGORIAS_VINCULO, type CategoriaVinculo, type ModoVinculo } from "@/lib/automacao/pedidos-do-evento";

const TITULO: Record<CategoriaVinculo, string> = { limpeza: "Limpeza", manutencao: "Manutenção", lavanderia: "Lavanderia", fotografia: "Fotografia" };
const QUANDO: Record<CategoriaVinculo, string> = {
  limpeza: "Pedida 5 dias antes de cada saída, para depois que o morador sai.",
  lavanderia: "Vai junto com a limpeza da saída.",
  manutencao: "Pedida quando a conferência de saída fecha com item marcado \"precisa de reparo\". Sempre com a sua confirmação.",
  fotografia: "Para pedir quando quiser, já com o parceiro escolhido.",
};
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const precoServico = (s: { precoBase: number | null; unidade: string | null }) => (s.precoBase == null ? "valor a combinar" : `a partir de ${brl(s.precoBase)}${s.unidade ? ` ${s.unidade}` : ""}`);

function EscolhaModo({ modo, onChange, categoria }: { modo: ModoVinculo; onChange: (m: ModoVinculo) => void; categoria: CategoriaVinculo }) {
  if (categoria === "manutencao") return <p className="text-sm text-muted">Modo: pedir minha confirmação (o custo varia).</p>;
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Como o pedido sai">
      <Chip ativo={modo === "confirmar"} onClick={() => onChange("confirmar")} data-testid={`modo-confirmar-${categoria}`}>
        Pedir minha confirmação
      </Chip>
      <Chip ativo={modo === "automatico"} onClick={() => onChange("automatico")} data-testid={`modo-automatico-${categoria}`}>
        Automático
      </Chip>
    </div>
  );
}

function Instrucoes({ valor, onChange, categoria }: { valor: string; onChange: (v: string) => void; categoria: CategoriaVinculo }) {
  return (
    <label className="block text-sm text-ink">
      Instruções para o parceiro (opcional)
      <textarea
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        maxLength={200}
        rows={2}
        placeholder="Ex.: trocar o enxoval; chave na portaria"
        className="mt-1 block w-full rounded-lg border border-line p-3 text-sm"
        data-testid={`instrucoes-${categoria}`}
      />
    </label>
  );
}

function Vinculado({ v }: { v: VinculoNaTela }) {
  const router = useRouter();
  const [modo, setModo] = useState<ModoVinculo>(v.modo);
  const [instrucoes, setInstrucoes] = useState(v.instrucoes ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const salvar = () =>
    iniciar(async () => {
      const r = await atualizarVinculo(v.id, { modo, instrucoes });
      setMsg(r.ok ? { ok: true, texto: "Salvo." } : { ok: false, texto: r.erro });
      if (r.ok) router.refresh();
    });
  return (
    <div className="space-y-3" data-testid={`vinculo-${v.categoria}`} data-status={v.status}>
      <p className="text-sm text-ink">
        <Link href={`/parceiros/${v.parceiro.slug}`} className="font-semibold underline underline-offset-4">
          {v.parceiro.nome}
        </Link>
        {" · "}
        <span data-testid={`vinculo-${v.categoria}-estado`}>{v.status === "ativo" ? "Ativo" : "Aguardando o parceiro aceitar"}</span>
      </p>
      {v.servico && (
        <p className="text-sm text-muted">
          {v.servico.titulo}: {precoServico(v.servico)}
        </p>
      )}
      <EscolhaModo modo={modo} onChange={setModo} categoria={v.categoria} />
      <Instrucoes valor={instrucoes} onChange={setInstrucoes} categoria={v.categoria} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={salvar} disabled={pendente} data-testid={`salvar-vinculo-${v.categoria}`}>
          Salvar
        </Button>
        <ConfirmarNaPagina
          aviso="Encerrar este parceiro fixo? Pedidos que esperam a sua confirmação são cancelados."
          confirmar="Encerrar"
          onConfirmar={() =>
            iniciar(async () => {
              const r = await encerrarVinculo(v.id);
              if (!r.ok) setMsg({ ok: false, texto: r.erro });
              router.refresh();
            })
          }
          disabled={pendente}
          variant="outline"
          size="sm"
          testid={`encerrar-vinculo-${v.categoria}`}
        >
          Encerrar
        </ConfirmarNaPagina>
        {msg && (
          <p role="status" className={msg.ok ? "text-sm text-forest" : "text-sm text-red-700"}>
            {msg.texto}
          </p>
        )}
      </div>
    </div>
  );
}

function Convidar({ propertyId, categoria, opcoes, cidade }: { propertyId: string; categoria: CategoriaVinculo; opcoes: OpcaoParceiro[]; cidade: string | null }) {
  const router = useRouter();
  const [parceiroId, setParceiroId] = useState(opcoes[0]?.id ?? "");
  const parceiro = opcoes.find((o) => o.id === parceiroId) ?? null;
  const [servicoId, setServicoId] = useState(parceiro?.servicos[0]?.id ?? "");
  const [modo, setModo] = useState<ModoVinculo>("confirmar");
  const [instrucoes, setInstrucoes] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  if (!opcoes.length) {
    return (
      <p className="text-sm text-muted" data-testid={`sem-opcoes-${categoria}`}>
        Nenhum parceiro de {TITULO[categoria].toLowerCase()} atende {cidade ?? "a cidade do imóvel"} ainda.{" "}
        <Link href={`/parceiros/buscar?categoria=${categoria}`} className="text-ink underline underline-offset-4">
          Ver parceiros
        </Link>
      </p>
    );
  }
  const convidar = () =>
    iniciar(async () => {
      setErro(null);
      const r = await convidarParceiroFixo({ propertyId, categoria, parceiroId, servicoId: servicoId || null, modo: categoria === "manutencao" ? "confirmar" : modo, instrucoes });
      if (!r.ok) return setErro(r.erro);
      router.refresh();
    });
  return (
    <div className="space-y-3" data-testid={`convidar-${categoria}`}>
      <label className="block text-sm text-ink">
        Parceiro
        <select
          value={parceiroId}
          onChange={(e) => {
            setParceiroId(e.target.value);
            setServicoId(opcoes.find((o) => o.id === e.target.value)?.servicos[0]?.id ?? "");
          }}
          className="mt-1 block h-11 w-full rounded-lg border border-line bg-white px-3 text-sm"
          data-testid={`parceiro-${categoria}`}
        >
          {opcoes.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </select>
      </label>
      {parceiro && parceiro.servicos.length > 0 && (
        <label className="block text-sm text-ink">
          Serviço
          <select value={servicoId} onChange={(e) => setServicoId(e.target.value)} className="mt-1 block h-11 w-full rounded-lg border border-line bg-white px-3 text-sm" data-testid={`servico-${categoria}`}>
            {parceiro.servicos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.titulo} · {precoServico(s)}
              </option>
            ))}
          </select>
        </label>
      )}
      <EscolhaModo modo={modo} onChange={setModo} categoria={categoria} />
      <Instrucoes valor={instrucoes} onChange={setInstrucoes} categoria={categoria} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={convidar} disabled={pendente || !parceiroId} data-testid={`convidar-${categoria}-enviar`}>
          {pendente ? "Enviando…" : "Convidar"}
        </Button>
        {erro && (
          <p role="alert" className="text-sm text-red-700">
            {erro}
          </p>
        )}
      </div>
    </div>
  );
}

/** "Parceiros do imóvel" (Prompt 38): o parceiro fixo por categoria, o modo e as instruções. */
export function ParceirosDoImovelTela({ dados }: { dados: ParceirosDoImovel }) {
  return (
    <div className="space-y-4" data-testid="parceiros-do-imovel">
      {CATEGORIAS_VINCULO.map((c) => {
        const v = dados.vinculos.find((x) => x.categoria === c);
        return (
          <Panel key={c} title={TITULO[c]} data-testid={`categoria-${c}`}>
            <p className="mb-3 text-sm text-muted">{QUANDO[c]}</p>
            {v ? <Vinculado v={v} /> : <Convidar propertyId={dados.imovel.id} categoria={c} opcoes={dados.opcoes[c]} cidade={dados.imovel.cidade} />}
          </Panel>
        );
      })}
    </div>
  );
}
