-- Validação de upload NO SERVIDOR (QA cadastro, item 6): os limites moram no
-- próprio bucket do Supabase Storage, então mesmo que alguém burle o `accept`
-- do input o arquivo é rejeitado. Espelha src/lib/upload-limits.ts (a validação
-- do cliente é só para feedback rápido).

-- Documentos privados do imóvel (matrícula / contrato de gestão): PDF, JPG ou
-- PNG, até 10 MB.
update storage.buckets
set file_size_limit = 10485760, -- 10 MB
    allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']
where id = 'property-docs';

-- Fotos do anúncio: JPG, PNG ou WEBP, até 8 MB. As fotos sobem re-codificadas
-- em JPEG (sem EXIF/GPS); o webp cobre uploads já otimizados pelo navegador.
update storage.buckets
set file_size_limit = 8388608, -- 8 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'property-photos';
