# Prompt de QA — Viva Nomads (para o time executar)

**Objetivo:** validar, no site em produção (**https://vivanomads.com.br**), com
contas e e-mails reais, os fluxos principais antes do GO. Cada testador preenche
o Status de cada caso e, em caso de falha, tira **print da tela** (e dos *Logs de
Auth* do Supabase quando for erro de e-mail/cadastro).

## Pré-condições (o responsável técnico confirma ANTES de o time começar)
- [ ] Schema aplicado no Supabase (tabelas existem).
- [ ] **Pelo menos 1 imóvel publicado** (status `active`) — senão a busca legitimamente vem vazia.
- [ ] Variáveis na Vercel: Supabase, `NEXT_PUBLIC_MAPBOX_TOKEN` (mapa) e e-mail/SMTP.
- [ ] Bucket de Storage `property-photos` criado.

> Se a tela de login mostrar o aviso âmbar **"Modo demonstração"**, PARE: faltam as
> variáveis do Supabase — não adianta testar ainda.

## Preencher no topo da planilha
| Campo | Valor |
|---|---|
| Testador(a) / Data | |
| Navegador / dispositivo | |
| E-mail de teste usado | |

---

## Casos de teste

### A. Cadastro e login
1. **Cadastro Inquilino** — /auth → "Sou Inquilino" → e-mail real novo + senha forte → Criar conta. **Esperado:** conta criada; e-mail de confirmação chega; papel inquilino.
2. **Cadastro Proprietário** — idem com outro e-mail. **Esperado:** papel proprietário.
3. **E-mail já cadastrado** — repetir um e-mail. **Esperado:** "Este e-mail já possui uma conta…" (não erro genérico); não cria duplicado.
4. **Senha errada** — login com senha incorreta. **Esperado:** "E-mail ou senha incorretos." (não revela se o e-mail existe).
5. **Recuperar senha** — "Esqueci minha senha" → e-mail → link → nova senha. **Esperado:** e-mail chega; nova senha funciona; antiga não; link não reutilizável.

### B. Busca de imóveis
6. **Autocomplete de cidade** — digitar "Uber" no campo de localização. **Esperado:** aparece "Uberlândia" no dropdown do site (funciona no celular).
7. **Resultado da busca** — buscar em Uberlândia. **Esperado:** aparecem os imóveis publicados (não "0 imóveis", desde que haja imóvel `active`).
8. **Mapa** — na busca. **Esperado:** mapa real renderiza (não placeholder) se o token Mapbox estiver configurado.
9. **Página do imóvel** — abrir um imóvel. **Esperado:** fotos, dados, valor, botão de ação.

### C. Anúncio de imóvel (logado como proprietário)
10. **Publicar imóvel** — "Anunciar imóvel" → preencher → **Publicar**. **Esperado:** publica e aparece na busca.
11. **Modalidades de garantia aceitas** — na etapa de preferências. **Esperado:** seleção de caução/título/garantidor + aviso "só preferência, não muda o caminho do dinheiro".

### D. Fechamento (garantia, caução, serviços)
12. **Garantia** — etapa de garantia. **Esperado:** caução pré-selecionada; seção "Como funciona a sua proteção" e a regra de ouro visíveis.
13. **Seleção única** — escolher Título depois de Caução. **Esperado:** só UMA fica marcada.
14. **Caução flexível** — alternar "À vista" e "Parcelado". **Esperado:** mostra a parcela; texto deixa claro que o dinheiro vai para conta vinculada/emissor, nunca para a plataforma.
15. **Serviços** — etapa de serviços. **Esperado:** Assistência 24h e Plano de manutenção "Disponível", opcionais.

### E. Reembolso (logado como proprietário)
16. **Fluxo de reembolso** — Reembolsos → registrar vistoria → desconto → notificar/prazo → gerar comprovante. **Esperado:** valor a devolver diminui com o desconto; prazo de 30 dias; status "reembolso registrado"; aviso da devolução em dobro; texto deixa claro que a plataforma não transfere valores.

### F. Papéis
17. **Admin x Inquilino** — entrar com a conta admin e depois com a de inquilino. **Esperado:** admin vê área de admin; inquilino só inquilino.

---

## Como reportar (ao final)
- Planilha/folha com **OK** ou **Falhou** + observação em cada caso.
- Em cada falha: **print da tela** com a mensagem (e dos Logs de Auth do Supabase se for e-mail/cadastro).
- Qual **e-mail** e qual **papel** (inquilino/proprietário) foi usado em cada caso.

> Os casos **3, 4 e 7** são os que mais reprovam — confira as mensagens e o resultado da busca com atenção.
