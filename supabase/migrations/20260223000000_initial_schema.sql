-- ============================================================
-- SCHEMA COMPLET - BON DE LIVRAISON - JOJA DISTRIBUTION
-- À exécuter dans l'éditeur SQL de Supabase (Dashboard > SQL Editor)
-- ============================================================

-- ============================================================
-- 1) TABLE PROFILES (livreurs et admins)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'driver')),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour recherche par rôle
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- ============================================================
-- 2) TABLE COMPANY_SETTINGS (paramètres société)
-- ============================================================
CREATE TABLE public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'JOJA DISTRIBUTION',
  logo_path TEXT,  -- chemin dans le bucket "logos"
  main_email TEXT NOT NULL DEFAULT 'joy.slama@gmail.com',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insérer la ligne par défaut
INSERT INTO public.company_settings (company_name, main_email)
VALUES ('JOJA DISTRIBUTION', 'joy.slama@gmail.com');

-- ============================================================
-- 3) SÉQUENCE pour numéro BDL quotidien
-- ============================================================
CREATE SEQUENCE public.bdl_daily_seq START 1;

-- Fonction pour générer le numéro BDL : BDL-YYYYMMDD-XXXXX
CREATE OR REPLACE FUNCTION public.generate_bdl_number()
RETURNS TEXT AS $$
DECLARE
  seq_val INT;
BEGIN
  seq_val := nextval('public.bdl_daily_seq');
  RETURN 'BDL-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(seq_val::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4) TABLE DELIVERY_NOTES (bons de livraison)
-- ============================================================
CREATE TABLE public.delivery_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bdl_number TEXT UNIQUE NOT NULL DEFAULT public.generate_bdl_number(),
  client_name TEXT NOT NULL,
  client_email TEXT,
  address TEXT NOT NULL,
  details TEXT NOT NULL,
  signature_path TEXT,          -- chemin dans le bucket "signatures"
  pdf_path TEXT,                -- chemin dans le bucket "pdfs"
  status TEXT NOT NULL DEFAULT 'VALIDATED'
    CHECK (status IN ('VALIDATED', 'EMAIL_SENT', 'EMAIL_FAILED')),
  driver_id UUID NOT NULL REFERENCES public.profiles(id),
  validated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour les filtres courants
CREATE INDEX idx_delivery_notes_driver ON public.delivery_notes(driver_id);
CREATE INDEX idx_delivery_notes_status ON public.delivery_notes(status);
CREATE INDEX idx_delivery_notes_created ON public.delivery_notes(created_at DESC);
CREATE INDEX idx_delivery_notes_client ON public.delivery_notes(client_name);

-- ============================================================
-- 5) TABLE EMAIL_LOGS (historique des envois)
-- ============================================================
CREATE TABLE public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_note_id UUID NOT NULL REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_logs_delivery ON public.email_logs(delivery_note_id);

-- ============================================================
-- 6) ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Activer RLS sur toutes les tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- ---- PROFILES ----
-- Chacun peut lire son propre profil
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Les admins peuvent voir tous les profils
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ---- COMPANY_SETTINGS ----
-- Tout utilisateur authentifié peut lire les paramètres
CREATE POLICY "company_settings_select" ON public.company_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Seul l'admin peut modifier
CREATE POLICY "company_settings_update_admin" ON public.company_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ---- DELIVERY_NOTES ----
-- Le livreur ne voit que ses propres BDL
CREATE POLICY "delivery_notes_select_driver" ON public.delivery_notes
  FOR SELECT USING (driver_id = auth.uid());

-- L'admin voit tous les BDL
CREATE POLICY "delivery_notes_select_admin" ON public.delivery_notes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Le livreur peut créer un BDL (seulement pour lui-même)
CREATE POLICY "delivery_notes_insert_driver" ON public.delivery_notes
  FOR INSERT WITH CHECK (driver_id = auth.uid());

-- L'admin peut modifier tous les BDL (pour retry email, etc.)
CREATE POLICY "delivery_notes_update_admin" ON public.delivery_notes
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Le livreur peut modifier ses propres BDL (pour mise à jour pdf_path, status)
CREATE POLICY "delivery_notes_update_driver" ON public.delivery_notes
  FOR UPDATE USING (driver_id = auth.uid());

-- ---- EMAIL_LOGS ----
-- L'admin peut tout voir
CREATE POLICY "email_logs_select_admin" ON public.email_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Le livreur voit les logs de ses propres BDL
CREATE POLICY "email_logs_select_driver" ON public.email_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.delivery_notes
      WHERE delivery_notes.id = email_logs.delivery_note_id
      AND delivery_notes.driver_id = auth.uid()
    )
  );

-- Insertion via Edge Function (service_role), pas besoin de policy INSERT pour les users

-- ============================================================
-- 7) STORAGE BUCKETS
-- Créer manuellement dans Supabase Dashboard > Storage, ou via SQL :
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('pdfs', 'pdfs', false);

-- Policies Storage : les utilisateurs authentifiés peuvent uploader dans signatures
CREATE POLICY "signatures_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'signatures' AND auth.uid() IS NOT NULL
  );

-- Les utilisateurs authentifiés peuvent lire leurs fichiers
CREATE POLICY "signatures_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'signatures' AND auth.uid() IS NOT NULL
  );

-- Les utilisateurs authentifiés peuvent lire les PDFs
CREATE POLICY "pdfs_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'pdfs' AND auth.uid() IS NOT NULL
  );

-- Les utilisateurs authentifiés peuvent lire les logos
CREATE POLICY "logos_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'logos' AND auth.uid() IS NOT NULL
  );

-- ============================================================
-- FIN DU SCHEMA
-- ============================================================
