# Proposta: ambiente de QA isolado para a terceira persona (ADMIN)

Ordem 5af5f167 (faixa D), complemento da ee7d27b8. **É uma proposta para o Daniel aprovar. Nada foi criado nem configurado
em Vercel ou Supabase.** Custo e configuração são decisão dele.

## Regra de segurança
Hoje só existem 2 admins reais (Daniel e Rogério). As telas do `/admin` leem tudo; um admin de teste dentro da produção
veria dados reais de usuários. Por isso: **NÃO criar admin de teste em produção.** O QA do admin roda só no ambiente isolado abaixo.
Inquilino e proprietário de teste continuam pelo caminho da ee7d27b8 (`docs/roteiro-qa-logado-muse.md`); se o ambiente for aprovado, os três passam a rodar lá.

## (a) Banco separado
- Opção 1 (preferida): **branch do Supabase** do projeto atual, com as migrações de `supabase/migrations` aplicadas.
- Opção 2: projeto Supabase de QA, aplicando `supabase/migrations` em ordem.
- **Semente fictícia** (nenhum dado real é copiado): usuários, imóveis, candidaturas, contratos, chamados, documentos para moderar,
  avaliações e números de relatório. Fonte: as fixtures do laboratório (`tests/e2e`) e o seed de `docs/massa-de-teste.md`
  (contas `is_teste`). Cada registro leva o rótulo TESTE.
- Chaves próprias do ambiente de QA; nenhuma chave de produção é reaproveitada.

## (b) Site separado
- **Vercel Preview** apontando para o banco de QA (variáveis só do ambiente de Preview, definidas pelo Daniel).
- Integrações **simuladas**: sem e-mail externo (vale a caixa `/admin/emails-teste`), sem WhatsApp, sem Asaas, sem Certta, sem ZapSign.
  O código já trata `is_teste` no servidor (`src/lib/contas-de-teste.ts`); no ambiente de QA todas as contas da semente são `is_teste`.
- Banner **AMBIENTE DE TESTE** fixo em todas as páginas, ligado por variável de ambiente do Preview (implementação em PR próprio, depois da aprovação).
- Fora do índice de buscadores (noindex) e sem link a partir do site público.

## (c) Três contas de QA na semente
| Persona | Conta (semente do QA) | Observação |
|---|---|---|
| Inquilino | `inquilino-qa@…` | `is_teste` |
| Proprietário | `proprietario-qa@…` | `is_teste`, imóveis publicados e um com documento pendente |
| Admin | `admin-qa@…` | `is_teste`, com 2FA |

**2FA do admin sem expor segredo real:** o `/admin` exige AAL2 (portão do servidor). No QA, o fator TOTP é **exclusivo do ambiente de QA**:
o Daniel gera o fator na conta `admin-qa`, guarda o segredo e o entrega ao Muse por canal próprio. O segredo nunca entra no repositório,
na ronda nem no Drive. No laboratório, o mesmo segredo vai no secret `TESTES_ADMIN_TOTP_SEGREDO` (já lido por `.github/workflows/e2e.yml`).
Os códigos de recuperação não são usados no QA.

## (d) Roteiro do admin, página por página
Todas as rotas de `src/app/(dashboard)/admin`. Em cada uma: 390 px e 1280 px, sem rolagem horizontal, PageTitle + StatCard + Panel.

| Rota | Simulação | Resultado esperado |
|---|---|---|
| `/admin` | Abrir a visão geral | Indicadores só da semente; contas `is_teste` fora das métricas e do MRR |
| `/admin/agentes` | Ver agentes e ordens | Lista carrega; nenhuma ação gasta crédito |
| `/admin/ajuda-publicacao` | Abrir a ajuda de publicação | Conteúdo carrega sem erro |
| `/admin/atendimento` | Ver a fila de chamados | Chamado com SLA vencido aparece destacado |
| `/admin/atendimento/[id]` | Responder um chamado e subir a prioridade | Resposta registrada; e-mail cai na caixa de teste |
| `/admin/avaliacoes` | Moderar uma avaliação (aprovar e recusar) | Status muda; avaliação recusada some do anúncio |
| `/admin/candidaturas` | Abrir uma candidatura | Dados do inquilino conforme a regra de ocultação até o aceite |
| `/admin/cidades` | Ver cidades ativas | Contagem de anúncios bate com a semente |
| `/admin/conforto` | Abrir o link antigo das contestações | Leva à Central de pendências já filtrada em "Contestações para decidir" |
| `/admin/pendencias` | Central de pendências: filtrar, decidir uma contestação, aceitar/recusar foto de nível, rodar os prazos | Contagem de cada filtro igual ao topo de decisões; contas de teste à parte; foto recusada some do nível do imóvel |
| `/admin/destinos` | Conferir o ponto de um destino no mapa e ativar | Sem ponto não ativa; ativo aparece nos chips da busca; "Destinos mais buscados" só com contagem |
| `/admin/retencao` | Ver o inventário, o relatório "o que seria apagado hoje" e as eliminações da semana | Só contagens, nenhum caminho de arquivo; teste contado à parte; simulado não apaga |
| `/admin/contratos` | Abrir contrato de teste | Marca "MINUTA DE TESTE — sem validade"; linha do tempo do contrato |
| `/admin/contratos/[id]` | Abrir o contrato pela lista (só leitura) e baixar o pacote de provas | Selo de estado, assinaturas com hash igual/diferente, pagamentos (anulados marcados), conferências com fotos e o prazo; PDF com "Gerado pela equipe Viva Nomads"; não admin recebe 404 |
| `/admin/contratos/encerramentos` | Na página da estadia de um contrato de teste, "Encerrar contrato" → motivo → confirmar | O pedido aparece na fila sem valor de multa ou devolução (chave ENCERRAMENTO_REGRAS_ATIVO desligada); "Concluir" encerra o contrato em acerto de saída; não admin recebe 404 |
| `/admin/dados-de-teste` | Semear e limpar a massa | Só cria registros `is_teste`; limpar não toca dado real |
| `/admin/documentos` | Aprovar e recusar um documento | Aprovado libera a publicação; recusado avisa o dono; decisão agrupada por imóvel |
| `/admin/emails-teste` | Ler os e-mails gerados nos outros passos | Um e-mail por evento, com o modelo único |
| `/admin/eventos` | Ver o funil de eventos | Eventos da semente; sem dado pessoal em URL |
| `/admin/funil` | Ver o funil de ativação e abrir a lista de uma etapa | Maior queda da semana no topo; fórmula escrita sob cada número; contas de teste fora; a lista abre pelo número |
| `/admin/qualidade` | Ver por que as pessoas saem, dar dono e prazo a uma Correção, fechar com o PR e mudar o estado de uma denúncia | Decisões no topo; os 8 quebradores com o sinal escrito ("sem medição" quando não há fonte); motivo com mais de 3 saídas em 30 dias vira Correção; contas de teste fora |
| `/admin/financeiro` | Ver comissão e MRR | Comissão de contrato `is_teste` aparece como simulada (TESTE) e não entra no MRR |
| `/admin/avaliadores` | Credenciar um avaliador de teste (em teste → ativo), salvar a tabela de preço da cidade e ver a fila | As 3 condições da chave VISTORIA_ATIVA com o estado de cada uma; "tabela sem valor" sem preço; histórico de preço; ativar exige duas etapas |
| `/admin/fotografos` | Ver parceiros fotógrafos | Lista e contagens carregam |
| `/admin/imoveis` | Moderar anúncio (publicar e despublicar) | Publicação exige documento aprovado; despublicar tira da busca |
| `/admin/marketing` | Abrir a área de marketing | Carrega sem enviar nada |
| `/admin/parceiros` | Aprovar um parceiro | Status muda; conta `is_teste` marcada |
| `/admin/parceiros/pedidos` | Ver os pedidos de serviço de parceiros (31b) | Números com a fórmula, contas `is_teste` fora; "Pedidos vindos de cartão" conta o pedido com ref do cartão |
| `/admin/parceiros/pedidos/[id]` | Abrir um pedido de serviço | Valores (taxa congelada no aceite), pagamento indisponível/simulado, eventos; grava `ver_pedido_parceiro` |
| `/admin/pedidos` | Ver pedidos de moradia | Pedido da semente aparece; compatíveis são avisados |
| `/admin/servicos` | Ver serviços para o morador | Indicadores carregam |
| `/admin/socios` | Ver a caixa dos sócios | Pedido só some com o aceite de quem pediu |
| `/admin/solicitacoes` | Ver solicitações de manutenção | Lista por status; abrir uma solicitação |
| `/admin/usuarios` | Buscar e abrir um usuário | Selo TESTE nas contas `is_teste`; sem acesso a senha |

Negativos obrigatórios: sem login → redireciona; admin em AAL1 → manda para o código 2FA; inquilino e proprietário → bloqueados em qualquer rota acima.

## (e) Custo estimado e passos só do Daniel
**Custo:** não estimo valor em reais: depende do plano atual da Vercel (Hobby tem limite de 100 deploys por dia, ver `docs/DEPLOYS-VERCEL.md`) e do
preço de branch/projeto adicional do Supabase na página de preços vigente. O Daniel confere os dois valores antes de aprovar.

**Só o Daniel pode:**
1. Aprovar o custo e escolher branch do Supabase ou projeto de QA.
2. Criar o branch/projeto e as variáveis do Preview na Vercel (chaves nunca passam por agente).
3. Criar a conta `admin-qa` e o fator TOTP; guardar o segredo e entregar ao Muse.
4. Confirmar que o Preview de QA não tem Asaas, e-mail externo, WhatsApp, Certta e ZapSign reais.

**Depois da aprovação (faixa D):** PR do banner "AMBIENTE DE TESTE", semente do QA e specs do laboratório para o roteiro acima.
