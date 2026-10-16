/*
  Pílulas de estadia no calendário do proprietário (ordem 8195c772).
  Regra PURA, sem banco nem imports @/: dado o período de uma estadia e um mês, devolve os
  segmentos por semana (linha da grade de 7 colunas). Uma estadia que atravessa a semana
  quebra na linha seguinte; `abreAqui` marca onde a pílula mostra avatar e nome.
*/

export interface SegmentoPilula {
  /** Linha da grade do mês (0 = primeira semana). */
  semana: number;
  /** Coluna inicial e final (0 = domingo … 6 = sábado), inclusive. */
  colIni: number;
  colFim: number;
  /** Primeiro segmento da estadia dentro do mês: é onde ficam o avatar e o nome. */
  abreAqui: boolean;
  /** A estadia começou antes desta linha / continua depois dela (bordas retas). */
  continuaAntes: boolean;
  continuaDepois: boolean;
}

function ymd(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** `mes` é 0..11. Datas ISO AAAA-MM-DD; fim inclusive. Fora do mês → []. */
export function segmentosDaPilula(
  inicioISO: string,
  fimISO: string,
  ano: number,
  mes: number,
): SegmentoPilula[] {
  if (!inicioISO || !fimISO || fimISO < inicioISO) return [];
  const primeiroDow = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const segs: SegmentoPilula[] = [];
  let dentro: { semana: number; colIni: number; colFim: number; dia: number } | null = null;

  const fechar = (diaFinal: number) => {
    if (!dentro) return;
    segs.push({
      semana: dentro.semana,
      colIni: dentro.colIni,
      colFim: dentro.colFim,
      abreAqui: segs.length === 0,
      continuaAntes: segs.length > 0 || inicioISO < ymd(ano, mes, 1),
      continuaDepois: diaFinal === diasNoMes && fimISO > ymd(ano, mes, diasNoMes),
    });
    dentro = null;
  };

  for (let dia = 1; dia <= diasNoMes; dia++) {
    const iso = ymd(ano, mes, dia);
    const ocupado = iso >= inicioISO && iso <= fimISO;
    const pos = primeiroDow + dia - 1;
    const semana = Math.floor(pos / 7);
    const col = pos % 7;
    if (ocupado) {
      if (dentro && dentro.semana === semana) {
        dentro.colFim = col;
        dentro.dia = dia;
      } else {
        fechar(dia - 1);
        dentro = { semana, colIni: col, colFim: col, dia };
      }
    } else {
      fechar(dia - 1);
    }
  }
  if (dentro) {
    const d: { dia: number } = dentro;
    fechar(d.dia);
  }
  // A quebra de semana no meio da estadia: as bordas intermediárias ficam retas.
  return segs.map((s, i) => ({
    ...s,
    continuaDepois: s.continuaDepois || i < segs.length - 1,
  }));
}

/** Texto do leitor de tela: "Reservado por Ana, 05/11 a 20/12". */
export function rotuloPilula(primeiroNome: string, inicioISO: string, fimISO: string): string {
  const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return `Reservado por ${primeiroNome}, ${br(inicioISO)} a ${br(fimISO)}`;
}

/** Só o primeiro nome (privacidade e espaço). Vazio → "Inquilino". */
export function primeiroNome(nomeCompleto: string | null | undefined): string {
  const n = (nomeCompleto ?? "").trim().split(/\s+/)[0] ?? "";
  return n || "Inquilino";
}
