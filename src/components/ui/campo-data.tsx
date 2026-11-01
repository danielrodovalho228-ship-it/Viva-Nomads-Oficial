"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import { CalendarDays } from "lucide-react";
import { CalendarioBR } from "@/components/ui/calendario-br";
import { useToque } from "@/components/ui/use-toque";
import { brParaIso, interpretarDataColada, isoParaBr, mascararData } from "@/lib/data-digitada";
import { cn } from "@/lib/utils";

/**
 * Campo de data do COMPUTADOR (E136): digitar dd/mm/aaaa com máscara, colar em vários formatos e, no botão ao lado, o
 * calendário do site em pt-BR (`CalendarioBR`). O campo nativo do computador é segmentado, sai em mm/dd/yyyy num
 * navegador em inglês e o pop-up dele vem no idioma do navegador ("November 2026", "Clear", "Today").
 * Valor em ISO (AAAA-MM-DD). Uma data ISO digitada de uma vez (colada ou preenchida) também vale.
 */
export function CampoDataTexto({
  value,
  aoMudar,
  min,
  ariaLabel,
  testid,
  className,
  rotuloCalendario,
  aceitarTexto,
  ...resto
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "min"> & {
  value: string;
  aoMudar: (iso: string) => void;
  min?: string;
  ariaLabel?: string;
  testid?: string;
  /** O nome do campo no botão e no calendário ("Abrir calendário: Disponível a partir de"). */
  rotuloCalendario?: string;
  /** Texto inteiro que o dono do campo trata (ex.: data e hora "AAAA-MM-DDTHH:MM" colada no campo de data e hora). */
  aceitarTexto?: (bruto: string) => boolean;
}) {
  const caixa = useRef<HTMLSpanElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState(isoParaBr(value));
  // Mudança de fora (rascunho, calendário): o texto acompanha — ajuste na renderização, sem efeito.
  const [anterior, setAnterior] = useState(value);
  if (anterior !== value) {
    setAnterior(value);
    if (brParaIso(texto) !== value) setTexto(isoParaBr(value));
  }
  const fechar = useCallback(() => setAberto(false), []);
  const nome = rotuloCalendario ?? ariaLabel;

  return (
    <span ref={caixa} className="relative block min-w-0">
      <input
        {...resto}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        value={texto}
        onChange={(e) => {
          const bruto = e.target.value;
          if (aceitarTexto?.(bruto.trim())) return;
          const iso = /^\d{4}-\d{1,2}-\d{1,2}$/.test(bruto.trim()) ? interpretarDataColada(bruto) : null;
          if (iso) {
            setTexto(isoParaBr(iso));
            aoMudar(iso);
            return;
          }
          const m = mascararData(bruto);
          setTexto(m);
          aoMudar(brParaIso(m) ?? "");
        }}
        onPaste={(e) => {
          const iso = interpretarDataColada(e.clipboardData.getData("text"));
          if (!iso) return; // formato desconhecido: deixa o navegador colar e a máscara limpar
          e.preventDefault();
          setTexto(isoParaBr(iso));
          aoMudar(iso);
        }}
        aria-label={ariaLabel}
        data-testid={testid}
        className={cn("box-border block w-full min-w-0 max-w-full pr-12", className)}
      />
      <button
        ref={botao}
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-label={nome ? `Abrir calendário: ${nome}` : "Abrir calendário"}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-forest hover:bg-sage-50"
        data-testid={testid ? `${testid}-calendario` : undefined}
      >
        <CalendarDays className="h-5 w-5" aria-hidden />
      </button>
      {aberto && (
        <CalendarioBR
          valor={value}
          min={min}
          rotulo={nome}
          dentroDe={caixa}
          testid={testid ? `${testid}-calendario-popup` : "calendario-popup"}
          aoFechar={() => {
            fechar();
            botao.current?.focus();
          }}
          aoEscolher={(iso) => {
            setTexto(isoParaBr(iso));
            aoMudar(iso);
            fechar();
            botao.current?.focus();
          }}
        />
      )}
    </span>
  );
}

/**
 * Campo de data do app. Valor em ISO; `onChange` recebe um evento com `target.value` em ISO, como o campo nativo.
 *  • Toque (celular): o campo nativo (calendário do aparelho) que não estoura o cartão no iPhone (Q3): ocupa a largura
 *    da coluna (regra global em globals.css + `min-w-0 w-full block`). Vazio, o iOS mostra o campo em branco: o texto
 *    de exemplo "dd/mm/aaaa" aparece por cima até a pessoa tocar.
 *  • Computador (E136): `CampoDataTexto`, com o calendário do site em pt-BR.
 */
export function CampoData({
  value,
  className,
  exemplo = "dd/mm/aaaa",
  onChange,
  min,
  name,
  "aria-label": ariaLabel,
  "data-testid": testid,
  ...resto
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "min"> & {
  value: string;
  exemplo?: string;
  min?: string;
  "data-testid"?: string;
}) {
  const toque = useToque();
  const vazio = !value;

  if (!toque) {
    return (
      <>
        <CampoDataTexto
          {...resto}
          value={value}
          min={min}
          ariaLabel={ariaLabel}
          testid={testid}
          className={className}
          aoMudar={(iso) => onChange?.({ target: { value: iso }, currentTarget: { value: iso } } as ChangeEvent<HTMLInputElement>)}
        />
        {name && <input type="hidden" name={name} value={value} />}
      </>
    );
  }

  return (
    <span className="relative block w-full min-w-0">
      <input
        {...resto}
        type="date"
        name={name}
        min={min}
        value={value}
        onChange={onChange}
        aria-label={ariaLabel}
        data-testid={testid}
        data-vazio={vazio ? "1" : undefined}
        className={cn("peer block w-full min-w-0 max-w-full", className)}
      />
      {vazio && (
        <span
          aria-hidden
          data-testid="campo-data-exemplo"
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-base text-muted peer-focus:hidden"
        >
          {exemplo}
        </span>
      )}
    </span>
  );
}

/**
 * E332 (01/11): `CampoData` para formulário simples (GET ou ação de servidor) — guarda o próprio valor e envia em ISO
 * pelo `name`. O admin usava `type="date"` nativo, que no computador com navegador em inglês sai em mm/dd/yyyy.
 */
export function CampoDataFormulario({
  name,
  defaultValue = "",
  ...resto
}: Omit<Parameters<typeof CampoData>[0], "value" | "onChange" | "defaultValue" | "name"> & { name: string; defaultValue?: string }) {
  const [valor, setValor] = useState(defaultValue);
  return <CampoData {...resto} name={name} value={valor} onChange={(e) => setValor(e.target.value)} />;
}

const DATA_HORA = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;
/** Horas oferecidas no campo do computador: de 30 em 30 minutos, das 06:00 às 22:00. */
const HORAS = Array.from({ length: 33 }, (_, i) => `${String(6 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

/**
 * Varredura 01/11: data e hora no padrão do site. O `datetime-local` nativo do computador sai em mm/dd/yyyy e AM/PM num
 * navegador em inglês; aqui a data é dd/mm/aaaa (`CampoDataTexto`, calendário pt-BR) e a hora uma lista de 24 h. No
 * toque, o nativo do aparelho. Valor "AAAA-MM-DDTHH:MM" (como o nativo) — "" enquanto falta a data ou a hora. Um valor
 * inteiro "AAAA-MM-DDTHH:MM" preenchido ou colado no campo da data também vale (o mesmo que o nativo aceitava).
 */
export function CampoDataHora({
  value,
  aoMudar,
  min,
  max,
  testid,
  className,
  rotulo,
}: {
  value: string;
  aoMudar: (valor: string) => void;
  /** "AAAA-MM-DDTHH:MM" (só a data entra no calendário). */
  min?: string;
  max?: string;
  testid?: string;
  className?: string;
  rotulo?: string;
}) {
  const toque = useToque();
  const m = DATA_HORA.exec(value);
  const [data, setData] = useState(m?.[1] ?? "");
  const [hora, setHora] = useState(m?.[2] ?? "");
  // Mudança de fora (valor zerado ou trocado): as partes acompanham — ajuste na renderização, sem efeito.
  const [anterior, setAnterior] = useState(value);
  if (anterior !== value) {
    setAnterior(value);
    if (value !== (data && hora ? `${data}T${hora}` : "")) {
      setData(m?.[1] ?? (value ? data : ""));
      setHora(m?.[2] ?? (value ? hora : ""));
    }
  }
  const emitir = (d: string, h: string) => {
    setData(d);
    setHora(h);
    const v = d && h ? `${d}T${h}` : "";
    setAnterior(v);
    aoMudar(v);
  };

  if (toque) {
    // Nativo SEM value controlado: meio preenchido (só a data) vale "" para o React, e reaplicar "" apagava o que a pessoa
    // já tinha escolhido (complemento do prompt 23). Mudança de fora entra pelo efeito.
    return <DataHoraNativo value={value} aoMudar={aoMudar} min={min} max={max} rotulo={rotulo} testid={testid} className={className} />;
  }
  const horas = hora && !HORAS.includes(hora) ? [...HORAS, hora].sort() : HORAS;
  return (
    <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_7rem] gap-2" data-campo-data-hora>
      <CampoDataTexto
        value={data}
        min={min?.slice(0, 10)}
        ariaLabel={rotulo ? `${rotulo}: data` : "Data"}
        rotuloCalendario={rotulo}
        testid={testid}
        className={className}
        aoMudar={(d) => emitir(d, hora)}
        aceitarTexto={(bruto) => {
          const t = DATA_HORA.exec(bruto);
          if (!t) return false;
          emitir(t[1], t[2]);
          return true;
        }}
      />
      <select
        value={hora}
        onChange={(e) => emitir(data, e.target.value)}
        aria-label={rotulo ? `${rotulo}: hora` : "Hora"}
        data-testid={testid ? `${testid}-hora` : undefined}
        className={cn("min-w-0", className)}
      >
        <option value="">Hora</option>
        {horas.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </span>
  );
}

function DataHoraNativo({ value, aoMudar, min, max, rotulo, testid, className }: { value: string; aoMudar: (v: string) => void; min?: string; max?: string; rotulo?: string; testid?: string; className?: string }) {
  const campo = useRef<HTMLInputElement>(null);
  const ultimo = useRef(value);
  useEffect(() => {
    if (campo.current && value !== ultimo.current) {
      campo.current.value = value;
      ultimo.current = value;
    }
  }, [value]);
  return (
    <input
      ref={campo}
      type="datetime-local"
      min={min}
      max={max}
      defaultValue={value}
      onChange={(e) => {
        ultimo.current = e.target.value;
        aoMudar(e.target.value);
      }}
      aria-label={rotulo}
      data-testid={testid}
      className={cn("block w-full min-w-0 max-w-full", className)}
    />
  );
}

/** Varredura 01/11: `CampoDataHora` num formulário de ação de servidor — envia "AAAA-MM-DDTHH:MM" pelo `name`. */
export function CampoDataHoraFormulario({ name, required, rotulo, className, testid }: { name: string; required?: boolean; rotulo?: string; className?: string; testid?: string }) {
  const [valor, setValor] = useState("");
  return (
    <>
      <CampoDataHora value={valor} aoMudar={setValor} rotulo={rotulo} className={className} testid={testid} />
      <input type="hidden" name={name} value={valor} required={required} />
    </>
  );
}
