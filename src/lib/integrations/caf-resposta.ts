/*
  Resposta da CAF (Certta) → laudo da plataforma (prompt 19). Regras PURAS, para testar sem rede.

  O que a documentação pública da CAF descreve (docs.caf.io — "Transaction", "OCR sync", "Register data",
  "CPF sync", "Documentscopy"): a transação devolve `status` (APPROVED / REPROVED / PENDING / PROCESSING), uma lista
  de `validations` ({ rule, status }) e `sections` por serviço — `ocr.data` com o que foi lido do documento (os
  campos variam conforme o tipo: nome, CPF, nascimento…), `pfData`/`cpf` com a consulta à Receita (nome, nascimento,
  situação), `facematch`, `liveness`, `documentscopy`. O aninhamento exato depende do TEMPLATE contratado e não foi
  confirmado com uma chamada real (sem contrato/token); por isso a leitura é defensiva: aceita o formato antigo que
  o código supunha (validations.identity/liveness/document + risk.level) e o das seções, e o que não vier fica de fora.

  Do OCR e da Receita NADA é gravado: só se o nome/CPF lidos batem com o perfil (`ocrConfere`, `receitaConfere`).
*/
import { normalizarNome } from "../moderacao/pre-conferencia.ts";

export interface LaudoCafLido {
  light: "green" | "yellow" | "red";
  identity: boolean;
  liveness: boolean;
  document: boolean;
  notes: string[];
  /** O nome/CPF lidos do documento (OCR) batem com o perfil? null = a CAF não devolveu OCR. */
  ocrConfere: boolean | null;
  /** O nome da Receita bate com o perfil? null = não veio. */
  receitaConfere: boolean | null;
  /** A transação ainda está em análise (PENDING/PROCESSING). */
  pendente: boolean;
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const digitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/** Primeiro valor de texto entre as chaves (aceita name/nome, cpf/taxId…). */
function campo(o: Obj | null, chaves: string[]): string | null {
  if (!o) return null;
  for (const k of chaves) {
    const v = str(o[k]);
    if (v) return v;
  }
  return null;
}

/** Os dados de uma seção: `sections.<nome>.data` (ou a própria seção, se vier sem `data`). */
function secao(raiz: Obj, nomes: string[]): Obj | null {
  const sections = obj(raiz.sections);
  if (!sections) return null;
  for (const n of nomes) {
    const s = obj(sections[n]);
    if (s) return obj(s.data) ?? s;
  }
  return null;
}

function mesmoNome(a: string | null, b: string | null): boolean {
  const x = normalizarNome(a).join(" ");
  return !!x && x === normalizarNome(b).join(" ");
}

/** Compara o que foi lido com o perfil: CPF manda quando os dois existem; senão, o nome. */
function confere(lido: { nome: string | null; cpf: string | null }, perfil: { name: string; cpf?: string }): boolean | null {
  const cpfLido = digitos(lido.cpf);
  const cpfPerfil = digitos(perfil.cpf);
  if (cpfLido.length === 11 && cpfPerfil.length === 11) return cpfLido === cpfPerfil;
  if (lido.nome) return mesmoNome(lido.nome, perfil.name);
  return null;
}

const VALIDO = new Set(["VALID", "APPROVED", "OK", "TRUE"]);
const INVALIDO = new Set(["INVALID", "REPROVED", "REJECTED", "FALSE"]);

export function lerRespostaCaf(json: unknown, perfil: { name: string; cpf?: string }): LaudoCafLido {
  const d = obj(json) ?? {};
  const status = String(d.status ?? "").toUpperCase();
  const pendente = status === "PENDING" || status === "PROCESSING";

  // Formato antigo (suposto): validations = { identity, liveness, document }.
  const valObj = obj(d.validations);
  // Formato da documentação: validations = [{ rule, status }].
  const valLista = Array.isArray(d.validations) ? (d.validations as unknown[]).map(obj).filter((x): x is Obj => !!x) : [];
  const reprovadas = valLista.filter((v) => INVALIDO.has(String(v.status ?? "").toUpperCase()));
  const regraOk = (re: RegExp): boolean | null => {
    const r = valLista.filter((v) => re.test(String(v.rule ?? v.code ?? "")));
    if (!r.length) return null;
    return r.every((v) => VALIDO.has(String(v.status ?? "").toUpperCase()));
  };

  const ocr = secao(d, ["ocr", "documentOcr", "ocrSync"]);
  const receita = secao(d, ["pfData", "cpf", "pfBasicData", "cpfSync"]);
  const liveness = secao(d, ["liveness", "livenessCheck"]);
  const facematch = secao(d, ["facematch", "faceMatch"]);
  const documentscopy = secao(d, ["documentscopy", "documentoscopia"]);

  const aprovada = status === "APPROVED";
  const boolDe = (o: Obj | null, chaves: string[]): boolean | null => {
    if (!o) return null;
    for (const k of chaves) if (typeof o[k] === "boolean") return o[k] as boolean;
    return null;
  };

  const identity =
    (typeof valObj?.identity === "boolean" ? valObj.identity : null) ??
    regraOk(/face|identity|identidade|biometr/i) ??
    boolDe(facematch, ["isMatch", "match", "isSimilar"]) ??
    (aprovada && reprovadas.length === 0);
  const livenessOk =
    (typeof valObj?.liveness === "boolean" ? valObj.liveness : null) ??
    regraOk(/liveness|prova.?de.?vida/i) ??
    boolDe(liveness, ["isAlive", "alive", "isLive"]) ??
    (aprovada && reprovadas.length === 0);
  const documentOk =
    (typeof valObj?.document === "boolean" ? valObj.document : null) ??
    regraOk(/document|ocr|documentoscop/i) ??
    boolDe(documentscopy, ["isValid", "valid", "authentic"]) ??
    (aprovada && reprovadas.length === 0);

  const ocrConfere = ocr
    ? confere({ nome: campo(ocr, ["name", "nome", "fullName"]), cpf: campo(ocr, ["cpf", "taxId", "documentNumber"]) }, perfil)
    : null;
  const receitaConfere = receita ? confere({ nome: campo(receita, ["name", "nome"]), cpf: campo(receita, ["cpf", "taxId"]) }, perfil) : null;

  const risco = String(obj(d.risk)?.level ?? "").toUpperCase();
  const light: LaudoCafLido["light"] =
    risco === "HIGH" || status === "REPROVED" || ocrConfere === false || receitaConfere === false
      ? "red"
      : risco === "MEDIUM" || pendente || reprovadas.length > 0
        ? "yellow"
        : "green";

  const motivos = obj(d.risk)?.reasons;
  const notes: string[] = Array.isArray(motivos) ? motivos.map(str).filter((x): x is string => !!x).slice(0, 8) : [];
  if (pendente) notes.push("Verificação em análise na CAF.");
  if (ocrConfere === false) notes.push("O documento lido não é do titular da conta.");
  if (receitaConfere === false) notes.push("O nome na Receita é diferente do cadastro.");
  if (!notes.length) notes.push("Análise concluída.");

  return {
    light,
    identity: !pendente && identity === true,
    liveness: !pendente && livenessOk === true,
    document: !pendente && documentOk === true,
    notes,
    ocrConfere,
    receitaConfere,
    pendente,
  };
}

/** A transação foi criada mas a resposta ainda não traz o resultado (só o id)? Então é preciso buscar por GET. */
export function idSemResultado(json: unknown): string | null {
  const d = obj(json);
  if (!d) return null;
  const temResultado = d.validations != null || d.sections != null || d.risk != null;
  const id = str(d.id) ?? str(d.requestId) ?? str(d.transactionId);
  return !temResultado && id ? id : null;
}
