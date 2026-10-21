/*
  Documentos que a plataforma GERA para as partes (PURO, node --test):
  recibo de aluguel (do proprietário), comprovante de caução e termo de
  devolução da caução. NUNCA "nota fiscal": nota a Viva só emite do que ela
  vende (assinatura e comissão), e isso é outro fluxo.

  O conteúdo sai do RETRATO gravado na emissão (documentos_fiscais), nunca do
  perfil atual. Nenhum documento leva e-mail ou telefone.
*/

import { cnpjValido, cpfValido, formatarDocumento } from "../documento-pessoa.ts";
import { emitidoEmBrasilia, linhaConferir, type Marca } from "./prefixos.ts";

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
  /** Recibo: o rótulo único do pagamento ("Bloco 1 (2 meses: 19/10 a 18/12) — R$ 6.400 (2 × R$ 3.200)"). */
  rotuloPagamento?: string | null;
  /** Recibo/comprovante: data e forma do pagamento declarado. */
  dataPagamento?: string | null;
  forma?: string | null;
  /** Termo: total da caução e data da confirmação do inquilino. */
  caucaoTotal?: number | null;
  confirmadoEm?: string | null;
  conferirUrl: string;
  /** Código de verificação (Prompt 56): vai no rodapé comum de toda página. */
  codigo?: string;
  /** Endereço do site (o rodapé mostra só o host: "vivanomads.com.br/conferir"). */
  siteUrl?: string;
}

/** Cabeçalho e rodapé comuns dos documentos registrados (Prompt 56). */
export interface CabecalhoDocumento {
  marca: Marca;
  /** Marca do emissor (D1-b): nome em destaque e a linha de identificação ("Locador — pessoa física"). */
  emissor?: { nome: string; linha: string };
  /** Número exibido, com a versão ("ORC-2026-0002 v2"). */
  numero: string;
  /** "Registro nº 000001" — só no legado (VN-CT, VN-SV). */
  registro?: string;
  /** "06/10/2026 às 11:03 (horário de Brasília)". */
  emitidoEm: string;
  /** "Confira em vivanomads.com.br/conferir com o código …" — em toda página. */
  conferir: string;
}

export interface ConteudoDocumento {
  /** Documentos registrados (Prompt 56): cabeçalho e rodapé comuns. */
  cabecalho?: CabecalhoDocumento;
  titulo: string;
  subtitulo: string;
  /** Pares rótulo → valor do quadro de dados. */
  quadro: [string, string][];
  /** Parágrafos do corpo. */
  corpo: string[];
  rodape: string[];
}

export const ROTULO_TIPO: Record<TipoDocumento, string> = {
  recibo_aluguel: "Recibo de locação",
  comprovante_caucao: "Comprovante de Caução",
  termo_devolucao_caucao: "Termo de devolução da Caução",
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

// CPF/CNPJ sempre por extenso e formatado (000.000.000-00), venha só com dígitos ou não (jornada de assinatura, 19/10).
const parte = (p: Parte) => {
  const doc = formatarDocumento(p.doc);
  return doc ? `${p.nome} (CPF/CNPJ ${doc})` : p.nome;
};

export function totalComEncargos(d: Pick<DadosDocumento, "valor" | "encargos">): number {
  return Math.round((d.valor + d.encargos.reduce((s, e) => s + e.valor, 0)) * 100) / 100;
}

/** O texto do documento — o PDF só desenha isto. */
export function conteudoDocumento(d: DadosDocumento): ConteudoDocumento {
  const periodo = d.periodoInicio ? `${dataBR(d.periodoInicio)} a ${dataBR(d.periodoFim)}` : "—";
  const base: [string, string][] = [
    // Com o código (Prompt 56), número e emissão vão no cabeçalho comum.
    ...(d.codigo
      ? []
      : ([
          ["Número", d.numero],
          ["Emitido em", dataBR(d.emitidoEm)],
        ] as [string, string][])),
    ["Locador", parte(d.locador)],
    ["Locatário", parte(d.locatario)],
    ["Imóvel", d.imovelEndereco],
    ["Contrato", d.contratoRef],
  ];
  const rodape = [
    "Documento gerado pela plataforma Viva Nomads a partir do registro do locador e da confirmação do locatário. Não é nota fiscal.",
    "A Viva Nomads não recebe aluguel nem caução: os valores são pagos diretamente entre as partes.",
    // Com o código, a conferência vai no rodapé comum de toda página (Prompt 56).
    ...(d.codigo ? [] : [`Confira a autenticidade em ${d.conferirUrl}`]),
  ];
  // Documento do emissor gerado pela plataforma (D1-b): o locador em destaque, a Viva numa linha discreta.
  const digitos = (d.locador.doc ?? "").replace(/\D/g, "");
  const cabecalho: CabecalhoDocumento | undefined = d.codigo
    ? {
        marca: "emissor",
        emissor: { nome: d.locador.nome, linha: digitos.length === 14 ? "Locador — pessoa jurídica" : digitos.length === 11 ? "Locador — pessoa física" : "Locador" },
        numero: d.numero,
        emitidoEm: emitidoEmBrasilia(d.emitidoEm),
        conferir: linhaConferir(d.siteUrl ?? "https://vivanomads.com.br", d.codigo),
      }
    : undefined;

  if (d.tipo === "recibo_aluguel") {
    const total = totalComEncargos(d);
    return {
      cabecalho,
      titulo: ROTULO_TIPO.recibo_aluguel,
      subtitulo: `Período ${periodo}`,
      quadro: [
        ...base,
        ["Período", periodo],
        // O mesmo rótulo das telas ("Bloco 1 (2 meses: …) — R$ 6.400 (2 × R$ 3.200)"); sem ele, a linha antiga.
        ...(d.rotuloPagamento
          ? ([
              ["Referente a", d.rotuloPagamento],
              ["Valor", brl(d.valor)],
            ] as [string, string][])
          : ([["Aluguel", brl(d.valor)]] as [string, string][])),
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
      cabecalho,
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
    cabecalho,
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
  const cab = c.cabecalho;
  const topo = cab ? [cab.emissor?.nome, cab.emissor?.linha, cab.numero, cab.registro, `Emitido em ${cab.emitidoEm}`].filter((x): x is string => !!x) : [];
  return [...topo, c.titulo, c.subtitulo, ...c.quadro.map(([a, b]) => `${a}: ${b}`), ...c.corpo, ...c.rodape, ...(cab ? [cab.conferir] : [])].join("\n");
}

/** Nenhum documento pode levar e-mail ou telefone. */
export function temContato(texto: string): boolean {
  // Primeiro sai o que a PRÓPRIA plataforma escreve e é sorteado ou sequencial: a URL de conferência (32 hex — um
  // código como "…12345678…" casava com o padrão de telefone e a emissão abortava ao acaso), o número do documento
  // (REC-2026-000004) e a referência do contrato (CT-1A2B3C4D). Assim a trava só depende do que veio das pessoas.
  texto = texto
    .replace(/(?:https?:\/\/[^\s]*)?\/conferir\/[0-9a-f]{32}/gi, "")
    .replace(/\/conferir com o código [0-9a-f]{32}/gi, "")
    .replace(/\b[A-Z]{3}-\d{4}-\d{6}\b/g, "")
    .replace(/\bCT-[0-9A-F]{8}\b/g, "");
  if (/[^\s@/]+@[^\s@]+\.[a-z]{2,}/i.test(texto)) return true;
  // Antes de procurar telefone, tira o que não é telefone: CPF/CNPJ (com OU sem máscara — um CPF de 11 dígitos
  // casava com o padrão de celular e o recibo nunca saía; jornada de assinatura, 19/10), valores, datas e números
  // de documento. Só sai a sequência de dígitos que é um CPF/CNPJ VÁLIDO: um celular de 11 dígitos continua pego.
  const semDocumentos = texto
    .replace(/\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, "")
    .replace(/\b\d{11}\b|\b\d{14}\b/g, (m) => (cpfValido(m) || cnpjValido(m) ? "" : m));
  return /(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}\b/.test(
    semDocumentos.replace(/R\$\s?[\d.,]+|\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}|[A-Z]{3}-\d{4}-\d{6}/g, ""),
  );
}

/** Número provisório da checagem de contato: a trava roda ANTES de reservar o definitivo (falha não queima número). */
export const NUMERO_PROVISORIO = "XXX-0000-000000";

/** Código de conferência: 32 hex (128 bits). */
export const CODIGO_RE = /^[0-9a-f]{32}$/;
