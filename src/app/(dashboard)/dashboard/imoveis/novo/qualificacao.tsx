"use client";

import { useEffect, useRef, useState } from "react";
import { AirVent, AlertCircle, BedDouble, Building, Check, CheckCircle2, CookingPot, Fan, Microwave, Refrigerator, Shirt, WashingMachine, X } from "lucide-react";
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
import { progressoQualificacao, textoQualificacao } from "@/lib/anuncio/assistente-telas";
import { RodapeAssistente } from "./rodape-assistente";

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
  // E194 (print do Daniel, 25/10): a Qualificação não é "outro cadastro" — mora na moldura do assistente: o mesmo selo
  // "Anunciar imóvel" do topo dos passos e o mesmo rodapé fixo (botão primário + barra contínua até o Passo 1).
  const telaAtual = resultado ? TOTAL_TELAS : p.tela + 1;
  return (
    <section className="w-full" data-testid="qualificacao" data-tela={resultado ? "resultado" : p.tela + 1}>
      <span className="inline-flex items-center gap-2 rounded-full border border-forest px-3 py-1 text-sm font-medium text-forest" data-testid="cadastro-modo">
        Anunciar imóvel <span className="h-2 w-2 rounded-full bg-forest" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-medium text-muted" data-testid="qualificacao-progresso">
        {resultado ? "Qualificação · pronta" : `Qualificação · ${p.tela + 1} de ${TOTAL_TELAS}`}
      </p>
      {resultado ? (
        <Resultado respostas={p.respostas} onVer={p.onVerNoCadastro} onResponderDeNovo={() => p.onTela(0)} />
      ) : (
        <Tela
          indice={p.tela}
          respostas={p.respostas}
          onResponder={p.onResponder}
          onResponderDepois={p.onResponderDepois}
          ocupado={p.ocupado}
        />
      )}
      <RodapeAssistente
        pos={0}
        total={10}
        texto={resultado ? "Qualificação pronta · a seguir, o Passo 1" : textoQualificacao(telaAtual, TOTAL_TELAS)}
        pct={progressoQualificacao(resultado ? TOTAL_TELAS : p.tela, TOTAL_TELAS)}
        onVoltar={!resultado && p.tela > 0 ? () => p.onTela(p.tela - 1) : null}
        primario={
          resultado
            ? { rotulo: p.ocupado ? "Abrindo o cadastro…" : "Começar o cadastro", onClick: p.onComecar, disabled: p.ocupado, testid: "qualificacao-comecar", seta: true }
            : { rotulo: "Continuar", onClick: () => p.onTela(p.tela + 1), testid: "qualificacao-continuar", seta: true }
        }
      />
    </section>
  );
}

function Tela(p: { indice: number; respostas: Respostas; onResponder: (id: string, v: string | boolean) => void; onResponderDepois: () => void; ocupado?: boolean }) {
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
      <div className="mt-8 flex justify-center">
        <button type="button" onClick={p.onResponderDepois} disabled={p.ocupado} className="min-h-11 px-2 text-sm font-medium text-ink underline underline-offset-4" data-testid="qualificacao-depois">
          Responder depois
        </button>
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

/**
 * E193 (print do Daniel, 25/10): UM padrão de controle no assistente inteiro — o cartão grande tocável dos mockups da
 * qualificação. Antes, a mesma tela misturava cartões com interruptor (toggle), cartões de opção com ícone e um chip
 * ("Não tem internet"). Agora sim/não, opções e "Não tem internet" são o mesmo cartão (celular e computador).
 */
function CartaoOpcao(p: { on: boolean; onClick: () => void; icone: React.ComponentType<{ className?: string }>; rotulo: string; grande?: boolean; testId: string }) {
  const Icone = p.icone;
  return (
    <button
      type="button"
      aria-pressed={p.on}
      onClick={p.onClick}
      className={cn(
        "relative flex min-h-14 w-full items-center gap-4 rounded-xl border-2 bg-white p-4 text-left text-base text-ink transition-colors",
        p.grande && "sm:min-h-44 sm:flex-col sm:justify-center sm:text-center",
        p.on ? "border-forest bg-sage-100" : "border-line hover:border-sage"
      )}
      data-testid={p.testId}
      data-cartao-qualificacao
    >
      <Icone className={cn("h-8 w-8 shrink-0", p.on ? "text-forest" : "text-muted", p.grande && "sm:h-14 sm:w-14")} aria-hidden />
      <span className="min-w-0 flex-1">{p.rotulo}</span>
      {p.on && <Check className="h-5 w-5 shrink-0 rounded-full bg-forest p-1 text-white sm:absolute sm:right-3 sm:top-3" aria-hidden />}
    </button>
  );
}

function Enunciado({ q, htmlFor }: { q: Pergunta; htmlFor?: string }) {
  return (
    <>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="block text-base font-medium text-ink sm:text-center">
          {q.rotulo}
        </label>
      ) : (
        <legend className="text-base font-medium text-ink sm:mx-auto sm:text-center">{q.rotulo}</legend>
      )}
      <span className="sm:text-center">
        <OQueConta chave={q.chave} />
      </span>
    </>
  );
}

function PerguntaQ({ q, valor, onResponder }: { q: Pergunta; valor: string | boolean | undefined; onResponder: (v: string | boolean) => void }) {
  if (q.tipo === "toggle") {
    return (
      <fieldset data-testid={`qualificacao-pergunta-${q.id}`}>
        <Enunciado q={q} />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CartaoOpcao on={valor === true} onClick={() => onResponder(true)} icone={CheckCircle2} rotulo="Sim, tem" testId={`qualificacao-opcao-${q.id}-sim`} />
          <CartaoOpcao on={valor === false} onClick={() => onResponder(false)} icone={X} rotulo="Não tem" testId={`qualificacao-opcao-${q.id}-nao`} />
        </div>
      </fieldset>
    );
  }
  if (q.tipo === "internet") {
    const sem = valor === SEM_INTERNET_QUALIFICACAO;
    return (
      <div data-testid="qualificacao-pergunta-internet">
        <Enunciado q={q} htmlFor="qualificacao-mbps" />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <span className={cn("flex min-h-14 items-center gap-3 rounded-xl border-2 bg-white p-4", !sem && typeof valor === "string" && valor ? "border-forest bg-sage-100" : "border-line")}>
            <input
              id="qualificacao-mbps"
              inputMode="numeric"
              value={sem || typeof valor !== "string" ? "" : valor}
              onChange={(e) => onResponder(e.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder="Ex.: 300"
              className="input h-11 w-32"
              data-testid="qualificacao-mbps"
            />
            <span className="text-base text-ink">Mbps</span>
          </span>
          <CartaoOpcao on={sem} onClick={() => onResponder(sem ? "" : SEM_INTERNET_QUALIFICACAO)} icone={X} rotulo="Não tem internet" testId="qualificacao-sem-internet" />
        </div>
      </div>
    );
  }
  const grandes = q.opcoes.length === 3 && q.opcoes.every((o) => o.icone !== "nao");
  return (
    <fieldset data-testid={`qualificacao-pergunta-${q.id}`}>
      <Enunciado q={q} />
      <div className={cn("mt-3 grid gap-3", grandes ? "sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-3")}>
        {q.opcoes.map((o) => (
          <CartaoOpcao
            key={o.id}
            on={valor === o.id}
            onClick={() => onResponder(o.id)}
            icone={ICONES[o.icone]}
            rotulo={o.rotulo}
            grande={grandes}
            testId={`qualificacao-opcao-${q.id}-${o.id}`}
          />
        ))}
      </div>
    </fieldset>
  );
}

function Resultado({ respostas, onVer, onResponderDeNovo }: { respostas: Respostas; onVer: () => void; onResponderDeNovo: () => void }) {
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
        <button type="button" onClick={onResponderDeNovo} className="min-h-11 px-2 text-sm font-medium text-ink underline underline-offset-4" data-testid="qualificacao-de-novo">
          Responder de novo
        </button>
      </div>
    </div>
  );
}
