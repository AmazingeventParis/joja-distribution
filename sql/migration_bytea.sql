-- Migration : stockage fichiers dans PostgreSQL (bytea)
-- Les fichiers (signatures, PDFs, logos) sont stockes directement en BDD
-- au lieu du filesystem Docker qui ne persiste pas entre les deploys

CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket TEXT NOT NULL,        -- 'signatures', 'pdfs', 'logos'
  filename TEXT NOT NULL,      -- UUID.ext pour signatures, BDL-xxx.pdf pour PDFs
  data BYTEA NOT NULL,         -- contenu binaire du fichier
  mime_type TEXT NOT NULL,     -- 'image/png', 'application/pdf', etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bucket, filename)
);
