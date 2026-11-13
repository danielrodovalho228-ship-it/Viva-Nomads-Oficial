# E876 — "Fale com a gente" de /empresas sem prazo próprio; envio NÃO CONFIRMADO

**Achado (RELATORIO-021, A-113):** a promessa era vaga ("retornamos com o que dá para fazer hoje"). Os 7 dias da página valiam para o envio de opções de imóveis, e o formulário não dizia o seu prazo. O Phoenix não testou o envio.

## Diagnóstico no código (sem envio ao vivo)
`src/app/(public)/empresas/empresas-form.tsx` → `fetch("/api/empresas", POST)` → `src/app/api/empresas/route.ts`:
1. `validarLead` exige nome, empresa e e-mail válido (400 sem eles), com limite de 5 envios por hora por IP (429).
2. `gravarLead(createAdminClient(), lead)` grava em `public.leads_empresas`, que só o admin lê.
3. Se gravou, `pushParaCeo` manda o push "Novo contato de empresa" ao Daniel, que leva a `/admin`.
4. `sendEmail({ interno: true, to: EMPRESAS_LEAD_EMAIL ?? SUPORTE_EMAIL })` manda o e-mail "Lead B2B — <empresa>" com os campos.
5. A resposta é `{ ok, delivered, saved }`, e o formulário mostra o recibo.

Quem responde é a equipe, no e-mail informado.

## Correção
- O prazo próprio de retorno numa fonte única (`src/lib/empresas-lead.ts`): `DIAS_RETORNO_EMPRESAS = 7` e `TEXTO_RETORNO_EMPRESAS` = "A equipe da Viva responde no e-mail informado em até 7 dias." É o mesmo prazo que a página já promete à empresa (E770).
- Ele aparece no texto ao lado do formulário (no lugar de "retornamos com o que dá para fazer hoje") e no recibo do envio.

## Testes
- `node --test src/lib/e876-empresas-form-prazo.test.ts`: main pass 0 / fail 1; branch pass 3 / fail 0. O teste também trava o destino diagnosticado (rota, gravação, push, e-mail interno).
- Escopados (empresas-lead, empresas-pagina, os testes que leem /empresas): 50 / 0. tsc limpo; consistência OK.
- Não rodei lab: a mudança é só de texto, lida da mesma fonte.

## Dúvidas
- Hoje nada garante o prazo na operação: `leads_empresas` não tem "respondido em" nem tela no admin, e só o push avisa. Proposta, se quiserem: uma migração com `respondido_em` e um alerta à equipe quando passar de 7 dias, como o E791 fez para os pedidos de parceria.
- Conflito provável com o #3798 (E873) nos imports de `empresas/page.tsx` (linhas vizinhas).
