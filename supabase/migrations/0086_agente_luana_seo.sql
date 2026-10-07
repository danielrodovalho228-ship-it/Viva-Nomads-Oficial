-- 0086 — Luana assume o SEO de conteúdo (divisão do antigo SEO do Rafael, 07/10/2026).
-- Só UPDATE de um cartão da Central; sem NOTICE; reaplicar é seguro.
update public.agentes
   set cargo = 'Marketing e SEO de conteúdo',
       rotina_texto = 'Segundas 07:47 Brasília · SEO de conteúdo na 1ª segunda do mês',
       briefing = 'Marketing e SEO de conteúdo. Toda segunda: calendário de posts, roteiros e custos. Na 1ª segunda do mês: posição no Google em "imóvel mobiliado Uberlândia" e afins, concorrentes (QuintoAndar, OLX, ZAP), melhorias de texto e pautas para o site. Nunca publica sem aprovação do Daniel.'
 where slug = 'luana';
