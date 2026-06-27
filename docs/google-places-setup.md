# Proximidades reais (Google Places) — como configurar a chave

A seção **Proximidades** da página do imóvel mostra o **nome do lugar, a distância
real e o link do Google Maps**. Isso usa duas APIs do Google. A chave fica **só no
servidor** (nunca no navegador) e tudo funciona com **fallback**: sem a chave, a
página continua no ar, mostrando só o rótulo do lugar.

## Regra do Google (já respeitada no código)
- Guardamos **apenas o `place_id`** no banco (coluna `properties.google_places`).
- Nome, endereço e distância são buscados **em tempo real** (nunca persistidos).
- Sem scraping — só as APIs oficiais. O link do Maps é montado pelo `place_id`.

## Passo a passo (você, dono)
1. Acesse **Google Cloud Console** → crie um projeto (ou use um existente).
2. Em **APIs e serviços → Biblioteca**, ative:
   - **Places API**
   - **Distance Matrix API**
3. Em **APIs e serviços → Credenciais**, crie uma **Chave de API**.
4. **Restrinja a chave** (importante, evita uso indevido/cobrança):
   - Como as chamadas saem do **servidor** (Vercel), restrinja por **IP** se quiser,
     ou ao menos por **API** (restrinja às duas APIs acima em "Restrições de API").
   - Não precisa de restrição por referer/domínio, porque a chave não vai ao browser.
5. Ative o **faturamento** no projeto (o Google exige; há cota gratuita mensal).

## Onde colocar a chave (Vercel)
- Vercel → seu projeto → **Settings → Environment Variables**.
- Adicione: `GOOGLE_MAPS_API_KEY = sua_chave` (Production).
- **Não** use o prefixo `NEXT_PUBLIC_` — isso exporia a chave no navegador.
- Faça **Redeploy** para a variável valer.

## Como testar depois de configurar
1. No cadastro do imóvel, etapa **Comodidades → Proximidades**, busque um lugar real
   (ex.: "ASA Coworking") e adicione com a categoria.
2. Publique. Abra a página do imóvel: a seção **Proximidades** deve mostrar
   `Nome · 1,2 km · 4 min a pé` com link para o Google Maps.
3. Sem a chave (ou se exceder a cota), a seção mostra só o rótulo, sem distância —
   a página nunca quebra.

## Custo (ordem de grandeza)
Places Details + Distance Matrix são cobrados por chamada, com cota gratuita
mensal. Como resolvemos por imóvel no carregamento (com cache curto de 5 min na
borda), o volume é baixo. Acompanhe em **Faturamento** no Google Cloud e, se
quiser, defina um **alerta de orçamento**.
