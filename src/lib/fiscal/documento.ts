/*
  Documentos que a plataforma GERA para as partes (PURO, node --test):
  recibo de aluguel (do proprietário), comprovante de caução e termo de
  devolução da caução. NUNCA "nota fiscal": nota a Viva só emite do que ela
  vende (assinatura e comissão), e isso é outro fluxo.

  O conteúdo sai do RETRATO gravado na emissão (documentos_fiscais), nunca do
  perfil atual. Nenhum documento leva e-mail ou telefone.
*/

export type TipoDocumento = "recibo_aluguel" | "comprovante_caucao" | "termo_devolucao_caucao";

export interface Parte {
  nome: string;
  /** CPF/CNPJ como cadastrado (pode faltar). */
  doc: string | null;
}

export interface DadosDocumento {
  tipo: TipoDocumento;
  numero: string;
  emitidoEm: string; // ISO
  locador: Parte;
  locatario: Parte;
  imovelEndereco: string;
  contratoRef: string;
  periodoInicio: string | null; // yyyy-mm-dd
  periodoFim: string | null;
  valor: number;
  encargos: { rotulo: string; valor: number }[];
  /** Recibo/comprovante: data e forma do pagamento declarado. */
  dataPagamento?: string | null;
  forma?: string | null;
  /** Termo: total da caução e data da confirmação do inquilino. */
  caucaoTotal?: number | null;
  confirmadoEm?: string | null;
  conferirUrl: string;
}

export interface ConteudoDocumento {
  titulo: string;
  subtitulo: string;
  /** Pares rótulo → valor do quadro de dados. */
  quadro: [string, string][];
  /** Parágrafos do corpo. */
  corpo: string[];
  rodape: string[];
}

export const ROTULO_TIPO: Record<TipoDocumento, string> = {
  recibo_aluguel: "Recibo de aluguel",
  comprovante_caucao: "Comprovante de caução",
  termo_devolucao_caucao: "Termo de devolução da caução",
};

const FORMA: Record<string, string> = { pix: "Pix", boleto: "boleto", transferencia: "transferência", dinheiro: "dinheiro", outro: "outra forma" };

export function brl(n: number): string {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** yyyy-mm-dd ou ISO → dd/mm/aaaa (sem fuso: a data é a declarada). */
export function dataBR(s: string | null | undefined): string {
  if (!s) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

const parte = (p: Parte) => (p.doc ? `${p.nome} (CPF/CNPJ ${p.doc})` : p.nome);

export function totalComEncargos(d: Pick<DadosDocumento, "valor" | "encargos">): number {
  return Math.round((d.valor + d.encargos.reduce((s, e) => s + e.valor, 0)) * 100) / 100;
}

/** O texto do documento — o PDF só desenha isto. */
export function conteudoDocumento(d: DadosDocumento): ConteudoDocumento {
  const periodo = d.periodoInicio ? `${dataBR(d.periodoInicio)} a ${dataBR(d.periodoFim)}` : "—";
  const base: [string, string][] = [
    ["Número", d.numero],
    ["Emitido em", dataBR(d.emitidoEm)],
    ["Locador", parte(d.locador)],
    ["Locatário", parte(d.locatario)],
    ["Imóvel", d.imovelEndereco],
    ["Contrato", d.contratoRef],
  ];
  const rodape = [
    "Documento gerado pela plataforma Viva Nomads a partir do registro do locador e da confirmação do locatário. Não é nota fiscal.",
    "A Viva Nomads não recebe aluguel nem caução: os valores são pagos diretamente entre as partes.",
    `Confira a autenticidade em ${d.conferirUrl}`,
  ];

  if (d.tipo === "recibo_aluguel") {
    const total = totalComEncargos(d);
    return {
      titulo: ROTULO_TIPO.recibo_aluguel,
      subtitulo: `Período ${periodo}`,
      quadro: [
        ...base,
        ["Período", periodo],
        ["Aluguel", brl(d.valor)],
        ...d.encargos.map((e): [string, string] => [e.rotulo, brl(e.valor)]),
        ["Total", brl(total)],
        ["Pago em", `${dataBR(d.dataPagamento)}${d.forma ? `, por ${FORMA[d.forma] ?? d.forma}` : ""}`],
      ],
      corpo: [
        `${d.locador.nome} declara ter recebido de ${d.locatario.nome} a quantia de ${brl(total)} referente ao aluguel${d.encargos.length ? " e encargos" : ""} do imóvel acima, no período de ${periodo}, conforme o contrato ${d.contratoRef}.`,
        "O recebimento foi registrado pelo locador e confirmado pelo locatário na plataforma.",
      ],
      rodape,
    };
  }

  if (d.tipo === "comprovante_caucao") {
    return {
      titulo: ROTULO_TIPO.comprovante_caucao,
      subtitulo: `Contrato ${d.contratoRef}`,
      quadro: [...base, ["Caução", brl(d.valor)], ["Depositada em", `${dataBR(d.dataPagamento)}${d.forma ? `, por ${FORMA[d.forma] ?? d.forma}` : ""}`]],
      corpo: [
        `${d.locador.nome} declara o recebimento da caução de ${brl(d.valor)}, depositada por ${d.locatario.nome} em caderneta de poupança, nos termos do art. 38, §2º, da Lei 8.245/91 e do contrato ${d.contratoRef}.`,
        "A caução é devolvida ao fim da locação, depois da vistoria de saída, com os eventuais descontos justificados.",
      ],
      rodape,
    };
  }

  const total = d.caucaoTotal ?? d.valor;
  const descontos = Math.max(0, Math.round((total - d.valor) * 100) / 100);
  return {
    titulo: ROTULO_TIPO.termo_devolucao_caucao,
    subtitulo: `Contrato ${d.contratoRef}`,
    quadro: [
      ...base,
      ["Caução depositada", brl(total)],
      ["Descontos", brl(descontos)],
      ["Valor devolvido", brl(d.valor)],
      ["Devolvido em", `${dataBR(d.dataPagamento)}${d.forma ? `, por ${FORMA[d.forma] ?? d.forma}` : ""}`],
      ["Confirmado pelo locatário em", dataBR(d.confirmadoEm)],
    ],
    corpo: [
      `${d.locador.nome} declara ter devolvido a ${d.locatario.nome} o valor de ${brl(d.valor)} referente à caução do contrato ${d.contratoRef}${descontos > 0 ? `, com descontos de ${brl(descontos)}` : ", sem descontos"}.`,
      "O locatário confirmou o recebimento na plataforma. Este termo encerra a caução deste contrato.",
    ],
    rodape,
  };
}

/** Todo o texto do documento numa string (para testes e para o hash do conteúdo). */
export function textoDocumento(c: ConteudoDocumento): string {
  return [c.titulo, c.subtitulo, ...c.quadro.map(([a, b]) => `${a}: ${b}`), ...c.corpo, ...c.rodape].join("\n");
}

/** Nenhum documento pode levar e-mail ou telefone. */
export function temContato(texto: string): boolean {
  return /[^\s@/]+@[^\s@]+\.[a-z]{2,}/i.test(texto) || /(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}\b/.test(texto.replace(/\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|R\$\s?[\d.,]+|\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}|[A-Z]{3}-\d{4}-\d{6}/g, ""));
}

/** Código de conferência: 32 hex (128 bits). */
export const CODIGO_RE = /^[0-9a-f]{32}$/;
