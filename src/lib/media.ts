/*
  Fotografia interina (Unsplash) art-dirigida conforme plano-imagens-viva-nomads.md.
  Carrega em produção via next/image. Substituir por fotos reais (ver ASSETS.md).
*/

const U = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

/** Placeholder blur de marca (azul) — evita CLS e dá load suave. */
export const BRAND_BLUR =
  "data:image/svg+xml;base64," +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#0b2a66"/></svg>`
  ).toString("base64");

export const PHOTOS = {
  // A — Home
  heroProfessional: U("photo-1521737711867-e3b97375f902", 1400), // chegada / notebook
  homeOffice: U("photo-1593642632823-8f785ba67e45", 1200),
  condominio: U("photo-1545324418-cc1a3fa10c00", 1200), // fachada/condomínio
  ownerKeys: U("photo-1560520653-9e0e4c89eb11", 1200), // proprietário/ambiente valorizado
  // B — Busca
  buscaHero: U("photo-1486406146926-c627a92ad1ab", 1800), // bairro/skyline ao entardecer
  personas: {
    executivos: U("photo-1507003211169-0a1dd7228f2d", 800),
    saude: U("photo-1612349317150-e413f6a5b16d", 800),
    familias: U("photo-1511895426328-dc8714191300", 800),
    nomades: U("photo-1499951360447-b19be8fe80f5", 800),
  },
  // C — Auth (login e cadastro distintos)
  authLogin: U("photo-1497366216548-37526070297c", 1200), // trabalho concentrado ao anoitecer
  authSignup: U("photo-1484154218962-a197022b5858", 1200), // porta/novo apartamento
  // D/E — Dashboards
  dashTenant: U("photo-1567767292278-a4f21aa2d36e", 1400), // canto aconchegante
  dashOwner: U("photo-1505691938895-1758d7feb511", 1400), // sala preparada p/ anúncio
  // B — Galerias dos imóveis (5–8 por anúncio)
  galleryA: [
    U("photo-1502672260266-1c1ef2d93688", 1200),
    U("photo-1505691938895-1758d7feb511", 1200),
    U("photo-1493809842364-78817add7ffb", 1200),
    U("photo-1556911220-bff31c812dba", 1200),
    U("photo-1564013799919-ab600027ffc6", 1200),
  ],
  galleryB: [
    U("photo-1493809842364-78817add7ffb", 1200),
    U("photo-1522708323590-d24dbb6b0267", 1200),
    U("photo-1560448204-e02f11c3d0e2", 1200),
    U("photo-1493663284031-b7e3aefcae8e", 1200),
  ],
  galleryC: [
    U("photo-1568605114967-8130f3a36994", 1200),
    U("photo-1570129477492-45c003edd2be", 1200),
    U("photo-1484154218962-a197022b5858", 1200),
  ],
  properties: [
    U("photo-1502672260266-1c1ef2d93688", 1000),
    U("photo-1493809842364-78817add7ffb", 1000),
    U("photo-1568605114967-8130f3a36994", 1000),
  ],
} as const;
