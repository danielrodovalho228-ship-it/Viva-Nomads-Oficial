/*
  Amostras dos documentos que a plataforma gera hoje (Prompt 56): REC, CAU, DEV e PRV, com o mesmo caso FICTÍCIO dos
  modelos aprovados (docs/modelos). Usa o código de verdade (conteudoDocumento, conteudoPacoteProvas, gerarPdf).
  Uso: node --experimental-strip-types scripts/documentos/amostras-56.ts  →  docs/modelos/amostras-56/*.pdf
*/
import { writeFileSync } from "node:fs";
import { conteudoDocumento, type DadosDocumento, type TipoDocumento } from "../../src/lib/fiscal/documento.ts";
import { gerarPdf } from "../../src/lib/fiscal/pdf.ts";
import { conteudoPacoteProvas } from "../../src/lib/contrato-provas.ts";
import { emitidoEmBrasilia, linhaConferir } from "../../src/lib/fiscal/prefixos.ts";
import { hashResumo } from "../../src/lib/contrato-assinar.ts";

const SITE = "https://vivanomads.com.br";
const SAIDA = "docs/modelos/amostras-56";
const caso: Omit<DadosDocumento, "tipo" | "numero" | "codigo"> = {
  emitidoEm: "2026-10-06T14:03:00Z",
  locador: { nome: "Carlos Eduardo Mendes (fictício)", doc: "12345678909" },
  locatario: { nome: "Juliana Prado (fictícia)", doc: "98765432100" },
  imovelEndereco: "Rua Professor Mário Porto, 1.245, Apto 302, Santa Mônica, Uberlândia",
  contratoRef: "VN-CT-11281A61",
  periodoInicio: "2026-10-01",
  periodoFim: "2026-10-31",
  valor: 3200,
  encargos: [],
  dataPagamento: "2026-10-05",
  forma: "pix",
  caucaoTotal: 3200,
  confirmadoEm: "2026-12-02",
  conferirUrl: `${SITE}/conferir`,
  siteUrl: SITE,
};
const docs: [TipoDocumento, string, string][] = [
  ["recibo_aluguel", "REC-2026-000001", "9f3b82d14471a0c3e5d7f9b1a2c4e6f8"],
  ["comprovante_caucao", "CAU-2026-000001", "1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f"],
  ["termo_devolucao_caucao", "DEV-2026-000001", "a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5"],
];
for (const [tipo, numero, codigo] of docs) {
  writeFileSync(`${SAIDA}/${numero.slice(0, 3)}-modelo.pdf`, await gerarPdf(conteudoDocumento({ ...caso, tipo, numero, codigo, valor: tipo === "termo_devolucao_caucao" ? 2900 : 3200 })));
}
const resumo = ["Imóvel: Apartamento 302, Santa Mônica, Uberlândia (fictício)", "Valor mensal: R$ 3.200,00", "Duração: 3 meses", "Início da estadia: 01/10/2026"];
const prv = conteudoPacoteProvas(
  {
    contratoId: "11281a61-0000-4000-8000-000000000000",
    imovel: "Apartamento 302, Santa Mônica, Uberlândia (fictício)",
    situacao: "Em vigência",
    registradoEm: "2026-09-20T12:00:00Z",
    resumo,
    assinaturas: [
      { papel: "proprietario", em: "2026-09-20T13:00:00Z", hash: hashResumo(resumo) },
      { papel: "inquilino", em: "2026-09-20T14:00:00Z", hash: hashResumo(resumo) },
    ],
    pagamentos: [{ tipo: "aluguel", valor: 3200, forma: "pix", dia: "2026-10-05", confirmadoEm: "2026-10-06T11:00:00Z" }],
    conferencias: [],
    aditivos: [],
  },
  {
    cabecalho: { numero: "PRV-2026-000001", emitidoEm: emitidoEmBrasilia("2026-10-21T21:00:00Z"), conferir: linhaConferir(SITE, "5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b") },
    contrato: "VN-CT-11281A61 · Registro nº 000001",
  },
);
writeFileSync(`${SAIDA}/PRV-modelo.pdf`, await gerarPdf(prv));
console.log("amostras em", SAIDA);
