# E806 — "Você envia o link" em /para-proprietarios

**Problema.** No bloco "Publicamos para você", logo abaixo de "Pedidos de moradia da sua cidade", a frase dizia
"Você envia o link, o texto e as fotos do anúncio que já tem". Não dizia que link era nem o que acontecia depois,
e, colada no bloco da cidade, lia-se como "link da cidade".

**Fluxo real** (`src/lib/ajuda-publicacao/ajuda.ts` + `src/components/property/ajuda-publicar.tsx`): o dono cola o
"Link do seu anúncio" (o anúncio que já tem em outro site) e/ou o texto e as fotos. A equipe monta o rascunho numa
fila do /admin, e o dono aprova antes de publicar; publicar continua exigindo o documento aprovado. Sem custo nesta fase.

**Depois.** Frase única `PUBLICAMOS_PARA_VOCE_TEXTO` (em `ajuda.ts`) + `AVISO_APROVACAO`:
"Já anuncia o imóvel em outro site? Cole o link desse anúncio, ou envie o texto e as fotos que você já tem, e a equipe
da Viva monta o rascunho do anúncio aqui na plataforma, sem custo nesta fase. Nada vai ao ar sem a sua aprovação, e
publicar continua exigindo o documento do imóvel aprovado."

**Teste.** `node --test src/lib/e806-publicamos-para-voce.test.ts`: falha na main (o export não existe) e passa na branch.
Asserção alterada: `e718-proprietarios-blocos` (`AVISO_SEM_CUSTO` → `{PUBLICAMOS_PARA_VOCE_TEXTO} {AVISO_APROVACAO}`).
