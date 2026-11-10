# E785 — gate de frases proibidas: "contato protegido até o aceite" e variantes

**Regra (E445/E764):** telefone, e-mail e redes sociais NUNCA são trocados entre morador e proprietário, nem depois do aceite. "Contato protegido até o aceite" sugere o contrário (que o contato é liberado depois).

**Gate:** nova regra `contato-protegido-ate-o-aceite` em `src/lib/frases-proibidas.ts` — cobre `contato/telefone/e-mail/whatsapp … protegido|oculto|liberado|revelado|compartilhado|trocado … até/antes do aceite` e `protegemos/mantemos/guardamos … contato … até o aceite`; frases que NEGAM ("nunca são trocados… inclusive depois do aceite") passam. A varredura de `supabase/` agora ignora comentário de SQL (`--`): as migrações antigas são imutáveis.

**Superfícies que a regra pegou e foram corrigidas (7):** selo da home → `SELO_PERFIL_VERIFICADO` ("Perfil verificado"); Como funciona e Preços → `CONTATO_NUNCA_TROCADO` / `FRASE_NEGOCIACAO_NA_PLATAFORMA`; Para proprietários; aviso do anúncio de exemplo (`owner-card`); "Bom saber" (`PROTECOES_VIVA`). Specs ajustados: t217, t172.

**Testes:** `frases-proibidas.test.ts` (+2), `home-imagens.test.ts`; 1.880 testes de `src/lib`, `src/config`, `src/components` verdes; `tsc` limpo. Sem prova ao vivo.

## Decisões do chat principal (09/11) aplicadas
1. Selo da home (spec t1025) = "Perfil verificado" (`SELO_PERFIL_VERIFICADO`, no lugar de "Sem troca de contato direto"); t217 e `home-imagens.test.ts` ajustados.
2. Nova regra `plataforma-entrega-contato-do-proprietario`: barra "contato do proprietário/dono/anfitrião/locador" que a plataforma entrega, passa, revela ou libera (verbo antes: "passamos/entrega/você recebe o contato do proprietário"; particípio depois: "contato do dono liberado/revelado"). Negações ("nunca entrega", "não passamos") passam. "Sem contato por fora" NÃO entra (orientação permitida). Teste cobre os dois lados; o GATE varre `src/` sem achados.

## Varredura final (10/11)
Conferido em `src/`, `tests/`, `supabase/` e `public/`: nenhuma superfície voltada ao público sugere contato liberado depois do aceite. Restavam dois **comentários de código** com a ideia antiga ("contato protegido/mascarado até o aceite", em `visitas-video-actions.ts` e `property-detail.tsx`); reescritos para a regra E445 (o gate ignora comentários, mas eles ensinariam a frase errada). "contato protegido" como **máscara** (`[contato protegido]`, ajuda, FAQ) é o mecanismo de bloqueio e segue.
