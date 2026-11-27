/*
  E665 — textos-modelo das perguntas que os hóspedes mais fazem (enxoval, camas, cozinha, documentos, regras). O dono
  toca em "Usar este modelo": o texto entra no formulário para ele conferir e EDITAR antes de salvar (nada é salvo
  sozinho). Regra de conteúdo: o modelo NUNCA traz valor, prazo, horário ou número — onde faltaria um dado, vai um
  [trecho entre colchetes] para o dono preencher com o que vale no imóvel dele. PURO.
*/
export interface ModeloResposta {
  id: string;
  tema: string;
  titulo: string;
  texto: string;
}

export const MODELOS_SUGERIDOS: readonly ModeloResposta[] = [
  {
    id: "enxoval",
    tema: "Enxoval",
    titulo: "Roupa de cama e banho",
    texto: "Olá! Sobre roupa de cama e banho: [diga o que está incluso e o que a pessoa precisa trazer]. Qualquer dúvida, me escreva por aqui.",
  },
  {
    id: "camas",
    tema: "Camas",
    titulo: "Camas e quartos",
    texto: "Olá! Sobre as camas: [descreva cada quarto e o tipo de cama]. Se precisar de algo diferente, me conte antes de pedir para eu ver se é possível.",
  },
  {
    id: "cozinha",
    tema: "Cozinha",
    titulo: "O que tem na cozinha",
    texto: "Olá! Sobre a cozinha: ela tem [liste fogão, geladeira, utensílios e eletrodomésticos]. O que não estiver na lista, não está no imóvel.",
  },
  {
    id: "documentos",
    tema: "Documentos",
    titulo: "Documentos para o pedido",
    texto: "Olá! Para seguir com o pedido, a Viva confere a sua identidade na própria plataforma. [Explique se você precisa de mais alguma informação.] Os dados pessoais ficam na plataforma, não pela conversa.",
  },
  {
    id: "regras",
    tema: "Regras",
    titulo: "Regras da casa",
    texto: "Olá! As regras do imóvel estão na página do anúncio. [Destaque aqui as que você mais quer reforçar: silêncio, visitas, pets, fumo.] Se alguma não servir para você, me avise antes de pedir.",
  },
];
