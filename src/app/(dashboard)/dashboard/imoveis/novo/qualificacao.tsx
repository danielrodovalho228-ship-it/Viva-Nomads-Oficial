"use client";

import { useEffect, useRef, useState } from "react";
import { AirVent, AlertCircle, BedDouble, Building, Check, CheckCircle2, CookingPot, Fan, Microwave, Refrigerator, Shirt, WashingMachine, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { itemConforto } from "@/config/conforto-minimo";
import {
  SEM_INTERNET_QUALIFICACAO,
  TELAS_QUALIFICACAO,
  TOTAL_TELAS,
  aplicarRespostas,
  criterioDe,
  faltamDoEssencial,
  nivelDoResultado,
  tituloResultado,
  type IconeOpcao,
  type Pergunta,
  type Respostas,
} from "@/lib/anuncio/qualificacao-conforto";
import { cn } from "@/lib/utils";

const ICONES: Record<IconeOpcao, React.ComponentType<{ className?: string }>> = {
  ar: AirVent,
  ventilador: Fan,
  nao: X,
  fogao: Refrigerator,
  micro: Microwave,
  forno: CookingPot,
  roupa: Shirt,
  cama: BedDouble,
  maquina: WashingMachine,
  predio: Building,
};

/**
 * E132-A — a Qualificação antes do Passo 1 (mockups qualificacao-01 e 02, com o fundo clean do E166). Um botão cheio
 * por tela ("Continuar" / "Começar o cadastro"); "Responder depois" e "Responder de novo" em texto. Nada trava: o
 * rascunho sempre salva e "Responder depois" leva direto ao Passo 1.
 */
export function Qualificacao(p: {
  tela: number;
  respostas: Respostas;
  onResponder: (id: string, valor: string | boolean) => void;
  onTela: (tela: number) => void;
  onResponderDepois: () => void;
  onComecar: () => void;
  /** "Ver no cadastro" de um item que falta: o Passo 5 do rascunho, no checklist do essencial. */
  onVerNoCadastro: () => void;
  /** "Sair" do topo do assistente durante a Qualificação = salvar e sair (o rascunho nasce na hora). */
  onSalvarESair: () => Promise<void>;
  ocupado?: boolean;
}) {
  const resultado = p.tela >= TOTAL_TELAS;
  // O "Sair" do topo (moldura do assistente) aqui salva as respostas antes de sair (decisão do Muse, 25/10).
  const sair = useRef(p.onSalvarESair);
  useEffect(() => {
    sair.current = p.onSalvarESair;
  });
  useEffect(() => {
    const link = document.querySelector<HTMLAnchorElement>('[data-testid="assistente-sair"]');
    if (!link) return;
    const aoClicar = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      void sair.current();
    };
    link.addEventListener("click", aoClicar, { capture: true });
    return () => link.removeEventListener("click", aoClicar, { capture: true });
  }, []);
  const progresso = resultado ? 100 : Math.round(((p.tela + 1) / TOTAL_TELAS) * 100);
  return (
    <section className="w-full pb-16" data-testid="qualificacao" data-tela={resultado ? "resultado" : p.tela + 1}>
      <p className="text-center text-sm font-medium text-ink sm:text-base" data-testid="qualificacao-progresso">
        {resultado ? "Qualificação · pronta" : `Qualificação · ${p.tela + 1} de ${TOTAL_TELAS}`}
      </p>
      <div className="mx-auto mt-2 h-2 w-full max-w-md overflow-hidden rounded-full bg-sage-100" aria-hidden>
        <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${progresso}%` }} />
      </div>
      {resultado ? (
        <Resultado respostas={p.respostas} onComecar={p.onComecar} onVer={p.onVerNoCadastro} onResponderDeNovo={() => p.onTela(0)} ocupado={p.ocupado} />
      ) : (
        <Tela
          indice={p.tela}
          respostas={p.respostas}
          onResponder={p.onResponder}
          onContinuar={() => p.onTela(p.tela + 1)}
          onResponderDepois={p.onResponderDepois}
          ocupado={p.ocupado}
        />
      )}
    </section>
  );
}

function Tela(p: { indice: number; respostas: Respostas; onResponder: (id: string, v: string | boolean) => void; onContinuar: () => void; onResponderDepois: () => void; ocupado?: boolean }) {
  const tela = TELAS_QUALIFICACAO[p.indice];
  return (
    <>
      <h1 className="mt-8 text-center font-title text-2xl font-semibold text-ink" data-testid="qualificacao-titulo">
        O imóvel tem o essencial?
      </h1>
      <p className="mt-2 text-center text-sm text-muted sm:text-base">Responda tocando nas opções. Leva menos de 1 minuto.</p>
      <h2 className="mt-6 text-center font-title text-lg font-semibold text-ink" data-testid="qualificacao-tela-titulo">
        {tela.titulo}
      </h2>
      <div className="mt-4 space-y-6">
        {tela.perguntas.map((q) => (
          <PerguntaQ key={q.id} q={q} valor={p.respostas[q.id]} onResponder={(v) => p.onResponder(q.id, v)} />
        ))}
      </div>
      <div className="mt-8 flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-center sm:gap-8">
        <button type="button" onClick={p.onResponderDepois} disabled={p.ocupado} className="min-h-11 px-2 text-sm font-medium text-ink underline underline-offset-4" data-testid="qualificacao-depois">
          Responder depois
        </button>
        <Button size="lg" onClick={p.onContinuar} className="w-full sm:w-auto" data-testid="qualificacao-continuar">
          Continuar
        </Button>
      </div>
    </>
  );
}

function OQueConta({ chave }: { chave: Pergunta["chave"] }) {
  const [aberto, setAberto] = useState(false);
  return (
    <span className="block">
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className="text-xs font-medium text-forest underline underline-offset-2" data-testid={`o-que-conta-${chave}`}>
        O que conta?
      </button>
      {aberto && <span className="mt-1 block text-xs text-muted">{criterioDe(chave)}</span>}
    </span>
  );
}

function PerguntaQ({ q, valor, onResponder }: { q: Pergunta; valor: string | boolean | undefined; onResponder: (v: string | boolean) => void }) {
  if (q.tipo === "toggle") {
    return (
      <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-white p-4" data-testid={`qualificacao-pergunta-${q.id}`}>
        <span className="min-w-0">
          <span className="block text-base font-medium text-ink">{q.rotulo}</span>
          <OQueConta chave={q.chave} />
        </span>
        <Switch checked={valor === true} onChange={(v) => onResponder(v)} label={q.rotulo} testId={`qualificacao-toggle-${q.id}`} />
      </div>
    );
  }
  if (q.tipo === "internet") {
    const sem = valor === SEM_INTERNET_QUALIFICACAO;
    return (
      <div className="rounded-xl border border-line bg-white p-4" data-testid="qualificacao-pergunta-internet">
        <label className="block text-base font-medium text-ink" htmlFor="qualificacao-mbps">
          {q.rotulo}
        </label>
        <OQueConta chave={q.chave} />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2">
            <input
              id="qualificacao-mbps"
              inputMode="numeric"
              value={sem || typeof valor !== "string" ? "" : valor}
              onChange={(e) => onResponder(e.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder="Ex.: 300"
              className="input h-11 w-32"
              data-testid="qualificacao-mbps"
            />
            <span className="text-sm text-muted">Mbps</span>
          </span>
          <button
            type="button"
            aria-pressed={sem}
            onClick={() => onResponder(sem ? "" : SEM_INTERNET_QUALIFICACAO)}
            className={cn("min-h-11 rounded-lg border px-4 text-sm font-medium", sem ? "border-forest bg-sage-100 text-forest" : "border-line bg-white text-ink")}
            data-testid="qualificacao-sem-internet"
          >
            Não tem internet
          </button>
        </div>
      </div>
    );
  }
  const grandes = q.opcoes.length === 3 && q.opcoes.every((o) => o.icone !== "nao");
  return (
    <fieldset data-testid={`qualificacao-pergunta-${q.id}`}>
      <legend className="text-base font-medium text-ink sm:mx-auto sm:text-center">{q.rotulo}</legend>
      <span className="sm:text-center">
        <OQueConta chave={q.chave} />
      </span>
      <div className={cn("mt-3 grid gap-3", grandes ? "sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-3")}>
        {q.opcoes.map((o) => {
          const on = valor === o.id;
          const Icone = ICONES[o.icone];
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => onResponder(o.id)}
              className={cn(
                "relative flex min-h-14 items-center gap-4 rounded-xl border-2 bg-white p-4 text-left text-base text-ink transition-colors",
                grandes && "sm:min-h-44 sm:flex-col sm:justify-center sm:text-center",
                on ? "border-forest bg-sage-100" : "border-line hover:border-sage"
              )}
              data-testid={`qualificacao-opcao-${q.id}-${o.id}`}
            >
              <Icone className={cn("h-8 w-8 shrink-0", on ? "text-forest" : "text-muted", grandes && "sm:h-14 sm:w-14")} aria-hidden />
              <span className="min-w-0 flex-1">{o.rotulo}</span>
              {on && <Check className="h-5 w-5 shrink-0 rounded-full bg-forest p-1 text-white sm:absolute sm:right-3 sm:top-3" aria-hidden />}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Resultado({ respostas, onComecar, onVer, onResponderDeNovo, ocupado }: { respostas: Respostas; onComecar: () => void; onVer: () => void; onResponderDeNovo: () => void; ocupado?: boolean }) {
  const { conforto } = aplicarRespostas(respostas);
  const faltam = faltamDoEssencial(conforto);
  const { titulo, subtitulo } = tituloResultado(faltam.length);
  // E179: o que as respostas já mostram (ex.: micro-ondas na cozinha) sai do "Para subir a Conforto".
  const { nivel, paraSubir } = nivelDoResultado(conforto, respostas);
  return (
    <div className="mt-6 space-y-4" data-testid="qualificacao-resultado" data-faltam={faltam.length}>
      <div className="rounded-xl border border-line bg-white p-6 sm:p-8">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border-2 border-forest text-forest">
          {faltam.length === 0 ? <Check className="h-7 w-7" aria-hidden /> : <AlertCircle className="h-7 w-7" aria-hidden />}
        </span>
        <h1 className="mt-4 text-center font-title text-2xl font-semibold text-ink" data-testid="qualificacao-resultado-titulo">
          {titulo}
        </h1>
        <p className="mt-2 text-center text-sm text-muted">{subtitulo}</p>
        <ul className="mt-6 space-y-3" data-testid="qualificacao-lista">
          {conforto.map((c) => (
            <li key={c} className="flex items-center gap-3 text-base text-ink" data-testid="qualificacao-item-ok">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-forest" aria-hidden /> {itemConforto(c).rotulo}
            </li>
          ))}
          {faltam.map((c) => (
            <li key={c} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-ink" data-testid="qualificacao-item-falta">
              <AlertCircle className="h-6 w-6 shrink-0 text-amber-600" aria-hidden />
              <span className="min-w-0 flex-1">{itemConforto(c).rotulo} — falta</span>
              <a href="#conforto-no-cadastro" onClick={(e) => (e.preventDefault(), onVer())} className="text-sm font-medium text-forest underline underline-offset-2" data-testid={`qualificacao-ver-${c}`}>
                Ver no cadastro
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-line bg-white p-6" data-testid="qualificacao-nivel">
        <h2 className="font-title text-lg font-semibold text-ink">{nivel ? `Nível: ${nivel}` : "Nível: ainda sem nível (falta o essencial)"}</h2>
        <p className="mt-1 text-sm text-muted">Para subir a Conforto, no cadastro, com fotos tiradas na hora (e a medida da internet):</p>
        <ul className="mt-3 grid gap-1 text-sm text-ink sm:grid-cols-2" data-testid="qualificacao-para-subir">
          {paraSubir.map((s) => (
            <li key={s}>· {s}</li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col items-center gap-3 pt-2">
        <Button size="lg" onClick={onComecar} disabled={ocupado} className="w-full sm:w-auto" data-testid="qualificacao-comecar">
          {ocupado ? "Abrindo o cadastro…" : "Começar o cadastro"}
        </Button>
        <button type="button" onClick={onResponderDeNovo} className="min-h-11 px-2 text-sm font-medium text-ink underline underline-offset-4" data-testid="qualificacao-de-novo">
          Responder de novo
        </button>
      </div>
    </div>
  );
}
