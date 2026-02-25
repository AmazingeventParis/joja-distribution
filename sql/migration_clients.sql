-- Migration : création de la table clients
-- Les admins peuvent tout faire, les livreurs peuvent lire (pour l'autocomplétion)

CREATE TABLE public.clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access clients" ON public.clients
  FOR ALL USING (public.is_admin());

CREATE POLICY "Drivers can read clients" ON public.clients
  FOR SELECT USING (true);
