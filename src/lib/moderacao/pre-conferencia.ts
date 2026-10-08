/*
  PRÉ-CONFERÊNCIA AUTOMÁTICA do documento do imóvel — regras PURAS.

  Quando o dono envia o documento, o sistema adianta o que dá para conferir
  sozinho e mostra ao Daniel, ao lado do checklist, "Parece OK" ou
  "Atenção: <motivo>". NÃO aprova nem recusa nada: a decisão é sempre de uma
  pessoa (Daniel, no admin). Ninguém além dele abre o arquivo.

  Confere: CPF/CNPJ do dono válido; nome informado como titular × nome da conta
  (ou razão social); o mesmo arquivo enviado por outra conta (hash repetido);
  autorização/procuração anexada quando o imóvel é sublocado ou administrado;
  CNPJ ativo e leitura do documento (OCR) quando houver integração — sem chave,
  ficam como "não consultado" e não pesam no veredito.
*/
import { cnpjValido, cpfValido, soDigitos, type PerfilDocumento } from "../documento-pessoa.ts";
import { exigeAutorizacao, ROTULO_FALTA_AUTORIZACAO } from "../anuncio/operacao.ts";

export interface FatosPreConferencia {
  documentoDono: PerfilDocumento | null;
  nomeConta: string | null;
  /** Nome do titular como o dono digitou (está escrito no documento). */
  titularInformado?: string | null;
  /** Quantos envios de OUTRAS contas têm o mesmo hash do arquivo. */
  duplicado: number;
  operacao?: string | null;
  autorizacaoAnexada: boolean;
  /** Situação do CNPJ na consulta (null = não consultado). */
  cnpjSituacao?: string | null;
  /** Nome do titular lido do documento por OCR (null = não lido). */
  ocrTitular?: string | null;
}

export interface ItemPreConferencia {
  chave: "documento_dono" | "titular" | "duplicado" | "autorizacao" | "cnpj_ativo" | "ocr";
  rotulo: string;
  estado: "ok" | "atencao" | "nao_consultado";
  detalhe?: string;
}

export interface PreConferencia {
  pareceOk: boolean;
  veredito: string;
  motivos: string[];
  itens: ItemPreConferencia[];
}

const PARTICULAS = new Set(["da", "de", "do", "das", "dos", "e", "ltda", "me", "epp", "eireli", "sa", "s/a"]);

export function normalizarNome(nome: string | null | undefined): string[] {
  return String(nome ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !PARTICULAS.has(t));
}

/**
 * Os nomes batem? Primeiro e último nome iguais, ou um contido no outro
 * ("Ana Lima" × "Ana Paula Souza Lima" bate; "Ana Lima" × "Bruno Lima" não).
 */
export function nomesConferem(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normalizarNome(a);
  const y = normalizarNome(b);
  if (!x.length || !y.length) return false;
  if (x[0] === y[0] && x[x.length - 1] === y[y.length - 1]) return true;
  const [menor, maior] = x.length <= y.length ? [x, y] : [y, x];
  return menor.length >= 2 && menor.every((t) => maior.includes(t));
}

export function preConferir(f: FatosPreConferencia): PreConferencia {
  const itens: ItemPreConferencia[] = [];
  const pj = f.documentoDono?.person_type === "pj";

  // 1) Documento do dono (CPF ou CNPJ) com dígitos válidos.
  const docOk = pj ? cnpjValido(f.documentoDono?.cnpj) && cpfValido(f.documentoDono?.cpf_representante) : cpfValido(f.documentoDono?.cpf);
  itens.push({
    chave: "documento_dono",
    rotulo: pj ? "CNPJ do dono" : "CPF do dono",
    estado: docOk ? "ok" : "atencao",
    detalhe: docOk ? "válido" : pj ? "dono ainda sem CNPJ válido" : "dono ainda sem CPF válido",
  });

  // 2) Titular informado × nome da conta (PJ: razão social ou o nome da conta).
  const nomes = [f.nomeConta, pj ? f.documentoDono?.company_name : null].filter(Boolean) as string[];
  const titular = (f.titularInformado ?? "").trim();
  if (!titular) {
    itens.push({ chave: "titular", rotulo: "Titular × conta", estado: "atencao", detalhe: "dono não informou o nome do titular" });
  } else {
    const confere = nomes.some((n) => nomesConferem(titular, n));
    const operado = exigeAutorizacao(f.operacao);
    itens.push({
      chave: "titular",
      rotulo: "Titular × conta",
      // Sublocado/administrado: o titular É outra pessoa (o proprietário) — a
      // autorização é que precisa existir; o nome diferente é o esperado.
      estado: confere || (operado && f.autorizacaoAnexada) ? "ok" : "atencao",
      detalhe: confere
        ? "nome do titular confere com a conta"
        : operado && f.autorizacaoAnexada
          ? "titular é o proprietário; há autorização anexada"
          : "nome do titular diferente do nome da conta",
    });
  }

  // 3) Mesmo arquivo enviado por outra conta.
  itens.push({
    chave: "duplicado",
    rotulo: "Arquivo repetido",
    estado: f.duplicado > 0 ? "atencao" : "ok",
    detalhe: f.duplicado > 0 ? `mesmo arquivo enviado por outra conta (${f.duplicado}×)` : "arquivo único",
  });

  // 4) Autorização / procuração (só quando o imóvel é sublocado ou administrado).
  if (exigeAutorizacao(f.operacao)) {
    const rot = ROTULO_FALTA_AUTORIZACAO[f.operacao as "subleased" | "managed"];
    itens.push({
      chave: "autorizacao",
      rotulo: rot,
      estado: f.autorizacaoAnexada ? "ok" : "atencao",
      detalhe: f.autorizacaoAnexada ? "anexada" : `${rot.toLowerCase()} não anexada`,
    });
  }

  // 5) CNPJ ativo (integração; sem chave = não consultado, não pesa).
  if (pj && soDigitos(f.documentoDono?.cnpj).length === 14) {
    const sit = (f.cnpjSituacao ?? "").trim().toUpperCase();
    itens.push({
      chave: "cnpj_ativo",
      rotulo: "CNPJ ativo",
      estado: !sit ? "nao_consultado" : sit === "ATIVA" ? "ok" : "atencao",
      detalhe: !sit ? "não consultado" : sit === "ATIVA" ? "ativo" : `situação: ${sit.toLowerCase()}`,
    });
  }

  // 6) Leitura do documento (OCR; sem chave = não lido, não pesa).
  const ocr = (f.ocrTitular ?? "").trim();
  itens.push({
    chave: "ocr",
    rotulo: "Leitura do documento",
    estado: !ocr ? "nao_consultado" : titular && nomesConferem(ocr, titular) ? "ok" : "atencao",
    detalhe: !ocr ? "não lido (sem integração)" : titular && nomesConferem(ocr, titular) ? "nome lido confere" : "nome lido no documento é diferente do informado",
  });

  const motivos = itens.filter((i) => i.estado === "atencao").map((i) => i.detalhe ?? i.rotulo);
  return {
    pareceOk: motivos.length === 0,
    veredito: motivos.length === 0 ? "Parece OK" : `Atenção: ${motivos.join("; ")}`,
    motivos,
    itens,
  };
}
