/*
  Fotografia interina (Unsplash) enquanto não há fotos reais do cliente.
  Carrega em produção via next/image. Substituir por fotos reais dos imóveis,
  profissionais e fachadas de Uberlândia assim que disponíveis.
*/

const U = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export const PHOTOS = {
  heroProfessional: U("photo-1521737711867-e3b97375f902", 1400), // profissional com notebook
  homeOffice: U("photo-1593642632823-8f785ba67e45", 1200), // home office montado
  owner: U("photo-1556761175-5973dc0f32e7", 1200), // reunião/escritório
  personas: {
    executivos: U("photo-1507003211169-0a1dd7228f2d", 800),
    saude: U("photo-1612349317150-e413f6a5b16d", 800),
    familias: U("photo-1511895426328-dc8714191300", 800),
    nomades: U("photo-1499951360447-b19be8fe80f5", 800),
  },
  properties: [
    U("photo-1502672260266-1c1ef2d93688", 1000), // apartamento claro
    U("photo-1493809842364-78817add7ffb", 1000), // studio aconchegante
    U("photo-1568605114967-8130f3a36994", 1000), // casa
  ],
} as const;
