/*
  E673 — "Disponível a partir de": a primeira entrada possível, não só a data que o dono pôs no cadastro.
  Pura (node --test). `ocupados` = os dias ocupados (bloqueios do dono e períodos de contrato, já expandidos dia a dia).
*/

const HORIZONTE_DIAS = 800;

function soma(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * A primeira data, a partir do MAIOR entre o início do anúncio e hoje, em que a estadia mínima (`minDias`, ao menos 1)
 * cabe sem cruzar um dia ocupado e sem passar do fim da janela do anúncio. null = não há data possível.
 */
export function primeiraEntradaPossivel(o: {
  from: string | null;
  until: string | null;
  minDias: number | null | undefined;
  hoje: string | null;
  ocupados: Iterable<string>;
}): string | null {
  const hoje = o.hoje ?? "";
  const inicio = o.from && o.from > hoje ? o.from : hoje || o.from;
  if (!inicio) return null;
  const ocupados = new Set(o.ocupados);
  const min = Math.max(1, Math.round(Number(o.minDias) || 1));
  for (let i = 0; i < HORIZONTE_DIAS; i++) {
    const d = soma(inicio, i);
    // A saída (d + min) tem de caber na janela do anúncio.
    if (o.until && soma(d, min) > o.until) return null;
    let livre = true;
    for (let k = 0; k < min; k++) {
      if (ocupados.has(soma(d, k))) {
        // Pula direto para o dia seguinte ao ocupado.
        i += k;
        livre = false;
        break;
      }
    }
    if (livre) return d;
  }
  return null;
}
