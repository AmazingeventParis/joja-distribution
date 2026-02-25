# CLAUDE.md - Projet JOJA DISTRIBUTION (Bons de Livraison)

## Résumé du projet
Application MVP pour générer, envoyer et gérer des Bons de Livraison (BDL) pour la société **JOJA DISTRIBUTION**.
Email de réception automatique : `joy.slama@gmail.com`

## Stack technique
- **Backend** : Supabase (Postgres + Auth + Storage + Edge Functions Deno)
- **Email** : Resend
- **PDF** : pdf-lib (génération native dans l'Edge Function, vrai PDF)
- **Mobile** : Flutter (Android/iOS) + speech_to_text (FR) + hand_signature (canvas PNG)
- **Web admin** : Next.js 14 TypeScript + Supabase client

## Architecture du projet
```
/sql/schema.sql                             → Schéma BDD complet (tables + RLS + buckets)
/sql/migration_clients.sql                  → Migration table clients (autocomplétion mobile)
/supabase/functions/generate_and_email_pdf/ → Edge Function (génération PDF + envoi email)
/supabase/migrations/                       → Migrations Supabase
/supabase/config.toml                       → Config Supabase CLI (auto-généré)
/mobile/                                    → App Flutter (livreurs)
  /mobile/lib/main.dart                     → Point d'entrée + init Supabase
  /mobile/lib/screens/login_screen.dart     → Connexion livreur
  /mobile/lib/screens/home_screen.dart      → Accueil (créer BDL / historique)
  /mobile/lib/screens/create_bdl_screen.dart→ Formulaire BDL + signature + dictée vocale + autocomplétion clients
  /mobile/lib/screens/history_screen.dart   → Liste BDL + télécharger PDF
  /mobile/lib/services/connectivity_service.dart → Vérif connexion internet
  /mobile/pubspec.yaml                      → Dépendances Flutter
/web/                                       → Interface admin Next.js
  /web/src/lib/supabase.ts                  → Client Supabase singleton
  /web/src/app/layout.tsx                   → Layout principal
  /web/src/app/page.tsx                     → Liste BDL + filtres (page d'accueil admin)
  /web/src/app/login/page.tsx               → Login admin
  /web/src/app/bdl/[id]/page.tsx            → Détail BDL + retry email + télécharger PDF
  /web/src/app/chauffeurs/page.tsx           → Gestion des chauffeurs (CRUD)
  /web/src/app/clients/page.tsx             → Gestion des clients (CRUD + tableau + modif inline)
  /web/src/app/api/drivers/route.ts         → API chauffeurs (GET/POST/DELETE)
  /web/src/app/api/clients/route.ts         → API clients (POST/PUT/DELETE, le GET utilise Supabase client)
  /web/src/app/api/send-to-client/route.ts → API envoi PDF au client par email (Resend)
  /web/src/lib/supabase-admin.ts            → Client Supabase admin (service_role, côté serveur)
  /web/.env.local                           → Variables d'environnement (NE PAS COMMITER)
  /web/package.json                         → Dépendances Node.js
/CLAUDE.md                                  → Ce fichier
/project-select.md                          → Décisions techniques et architecture
/README.md                                  → Guide d'installation étape par étape
/.env.example                               → Template des variables d'environnement
```

## Supabase - Configuration complète
- **Project ref** : `bpxsodccsochwltzilqr`
- **URL** : `https://bpxsodccsochwltzilqr.supabase.co`
- **Anon Key** : `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJweHNvZGNjc29jaHdsdHppbHFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NzU3MDksImV4cCI6MjA4NzQ1MTcwOX0.TmX_5dUOCm3deQrFmw9thrwIe8hprocRkOoMj5IP1AA`
- **Service Role Key** : `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJweHNvZGNjc29jaHdsdHppbHFyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTg3NTcwOSwiZXhwIjoyMDg3NDUxNzA5fQ.7GX3rPOr7cRFZh7bG8ee_8BjrmmZ6TdqitgQK98cywU`
- **Access Token CLI** : `sbp_f24d3f57f0d98c89dd53982b2cb0cca02e839bcd`
- **Resend API Key** : `re_9kFcbvM5_3HPF5yXXYU6pFeSAAYbJjFh1`
- **Tables** : `profiles`, `company_settings`, `delivery_notes`, `email_logs`, `clients`
- **Buckets Storage** : `logos`, `signatures`, `pdfs` (tous privés, accès via signed URLs)
- **RLS** : Utilise la fonction `public.is_admin()` (SECURITY DEFINER) pour éviter la récursion infinie
- Les drivers ne voient que leurs propres BDL, les admins voient tout

## Comptes utilisateurs
| Rôle     | Email                        | Mot de passe | UUID                                  | Où l'utiliser          |
|----------|------------------------------|-------------|---------------------------------------|------------------------|
| Admin    | jeremie.magnet@gmail.com     | Sachaeden5  | 5582aa92-2ad9-4326-a9b2-9e443ced8348  | Web admin (localhost)  |
| Livreur  | livreur@joja.com             | Joja2026!   | f15b032d-7257-4728-929b-2d335f469322  | App mobile Flutter     |

## Numérotation BDL
Format : `BDL-YYYYMMDD-XXXXX` (séquence auto-incrémentée via `public.generate_bdl_number()`)

## Edge Function : generate_and_email_pdf
- Chemin : `supabase/functions/generate_and_email_pdf/index.ts`
- Déployée avec `--no-verify-jwt`
- Reçoit `{ delivery_note_id }`
- Charge les données BDL + company_settings + profil livreur + signature (bytes)
- **Génère un vrai PDF avec pdf-lib** (plus de dépendance à un service HTML→PDF externe)
  - PDF A4 avec en-tête JOJA DISTRIBUTION, sections colorées, signature PNG intégrée
  - Polices Helvetica/HelveticaBold/HelveticaOblique (StandardFonts)
  - Fonction `wrapText()` pour le retour à la ligne automatique
  - Fonction `cleanText()` pour les caractères spéciaux (WinAnsi)
- Upload le PDF dans le bucket `pdfs` (chemin : `BDL-YYYYMMDD-XXXXX.pdf`)
- Envoie l'email via Resend à `joy.slama@gmail.com` (+ client_email si renseigné)
- Le PDF est envoyé en pièce jointe dans l'email
- Logue le résultat dans `email_logs` (sent/failed + erreur)
- Met à jour le statut BDL (EMAIL_SENT / EMAIL_FAILED)
- Retourne `{ ok, pdf_path, bdl_number, email_status }`

## Conventions de code
- **Langue** : tout en français (commentaires, variables UI, messages)
- **Simplicité** : pas de sur-ingénierie, code clair et commenté
- **100% online** : connexion obligatoire, pas de mode offline
- **Mobile** : vérifier la connectivité avant chaque action réseau
- **Web** : styles inline (pas de CSS externe, simplicité maximale)
- **Sécurité** : jamais de bucket public, toujours des signed URLs
- **Pas d'emojis dans le code** sauf le micro pour le bouton dictée

## Commandes utiles
```bash
# Web admin
cd web && npm run dev

# Mobile Flutter (les clés sont déjà en dur dans main.dart comme defaultValue)
cd mobile && flutter run

# Mobile Flutter avec clés explicites
cd mobile && flutter run --dart-define=SUPABASE_URL=https://bpxsodccsochwltzilqr.supabase.co --dart-define=SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJweHNvZGNjc29jaHdsdHppbHFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NzU3MDksImV4cCI6MjA4NzQ1MTcwOX0.TmX_5dUOCm3deQrFmw9thrwIe8hprocRkOoMj5IP1AA

# Déployer l'Edge Function
SUPABASE_ACCESS_TOKEN=sbp_f24d3f57f0d98c89dd53982b2cb0cca02e839bcd npx supabase functions deploy generate_and_email_pdf --no-verify-jwt

# Pousser une migration SQL
SUPABASE_ACCESS_TOKEN=sbp_f24d3f57f0d98c89dd53982b2cb0cca02e839bcd npx supabase db push

# Créer un nouvel utilisateur via l'API (Node.js)
# Utiliser le script Node.js avec https.request (pas curl, à cause de l'échappement)

# Exécuter du SQL arbitraire sur Supabase
# POST https://api.supabase.com/v1/projects/bpxsodccsochwltzilqr/database/query
# Header: Authorization: Bearer sbp_f24d3f57f0d98c89dd53982b2cb0cca02e839bcd
# Body: { "query": "SELECT ..." }
```

## Points d'attention / Bugs connus et résolus
1. **RLS récursion infinie** : les policies admin qui font SELECT sur leur propre table causent une boucle → TOUJOURS utiliser `public.is_admin()` (SECURITY DEFINER)
2. **Mot de passe avec `!` dans curl** : l'API Auth Supabase a des problèmes d'échappement JSON avec curl/bash → utiliser Node.js `https.request` pour les appels API
3. **Mode Développeur Windows** : nécessaire pour Flutter (symlinks) → ACTIVÉ le 24/02/2026
4. **Port 3000 occupé** : le serveur web Next.js peut démarrer sur le port 3001 si le 3000 est pris
5. **Supabase CLI pas dans PATH** : utiliser `npx supabase` au lieu de `supabase` directement
6. **Supabase CLI non-TTY** : `supabase login` ne fonctionne pas dans cet environnement → utiliser `SUPABASE_ACCESS_TOKEN=...` comme variable d'environnement
7. **Émulateur Android : hyperviseur manquant** : l'émulateur ne démarre pas sans accélération matérielle → activer "Plateforme de l'hyperviseur Windows" + "Plateforme de machine virtuelle" dans Fonctionnalités Windows, puis redémarrer le PC
8. **API route clients bloquante** : le GET `/api/clients` via `supabaseAdmin` bloquait la page indéfiniment → utiliser directement le client Supabase côté navigateur pour le SELECT (RLS autorise SELECT pour tous les users authentifiés)
9. **PDF corrompu (HTML stocké comme .pdf)** : le service html2pdf.app ne fonctionnait pas, le fallback stockait du HTML brut → remplacé par **pdf-lib** qui génère de vrais PDF natifs sans dépendance externe
10. **Resend mode test** : avec `onboarding@resend.dev` (domaine partagé), on ne peut envoyer qu'à l'email du compte Resend (jeremie.magnet@gmail.com). Pour envoyer à n'importe qui → vérifier un domaine propre sur Resend (ou utiliser Gmail SMTP)

## État du projet

### Session 1 - 23 février 2026 (FAIT)
- [x] Arborescence complète du projet créée
- [x] sql/schema.sql : tables + RLS (corrigé) + buckets + séquence BDL
- [x] Migration SQL déployée sur Supabase (20260223000000_initial_schema.sql)
- [x] Fix RLS récursion infinie (fonction is_admin SECURITY DEFINER)
- [x] Edge Function generate_and_email_pdf déployée
- [x] Resend API Key configurée dans Supabase secrets
- [x] Web admin Next.js : login + liste BDL + détail BDL + retry email
- [x] Web admin : login testé et fonctionnel
- [x] App mobile Flutter : login + créer BDL + dictée vocale + signature + historique
- [x] Dépendances Flutter installées (83 packages)
- [x] Comptes admin + livreur créés avec profils en base
- [x] company_settings initialisé (JOJA DISTRIBUTION + joy.slama@gmail.com)
- [x] README.md, CLAUDE.md, project-select.md, .env.example

### Session 2 - 24 février 2026 (FAIT)
- [x] Mode Développeur Windows activé
- [x] Android SDK : image système installée (android-34;google_apis;x86_64)
- [x] Émulateur Android créé (AVD "Pixel_6" basé sur Pixel 6)
- [x] Diagnostic émulateur : hyperviseur Windows manquant identifié

### Session 3 - 24 février 2026 (FAIT)
- [x] Hyperviseur Windows activé (WHPX opérationnel)
- [x] Émulateur Android Pixel_6 fonctionne
- [x] NDK installé (28.2.13676358)
- [x] Android SDK Platform 34 installé manuellement
- [x] Fix Flutter "Unable to determine engine version" (workaround shared.bat)
- [x] Fix import manquant FileOptions dans create_bdl_screen.dart
- [x] Fix chemin avec espaces (copie vers C:\dev\joja-app pour le build)
- [x] compileSdk forcé à 36, speech_to_text mis à jour vers ^7.0.0
- [x] App mobile testée : login + création BDL + signature + PDF + email OK
- [x] Premier BDL créé : BDL-20260224-00001

### Session 4 - 24 février 2026 (FAIT)
- [x] Table `clients` créée en BDD (id, name, email, address, created_at)
- [x] RLS clients : admins full access, drivers SELECT (pour autocomplétion)
- [x] Migration SQL déployée sur Supabase (sql/migration_clients.sql)
- [x] API route `/api/clients` : POST, PUT, DELETE (via supabaseAdmin)
- [x] Page admin `/clients` : tableau + ajout + modification inline + suppression
- [x] Navigation 3 onglets : Bons de Livraison | Chauffeurs | Clients
- [x] Autocomplétion clients sur mobile (widget Autocomplete Flutter)
- [x] Pré-remplissage email + adresse à la sélection d'un client
- [x] Fix bug chargement infini page Clients (GET via Supabase client au lieu de API route)
- [x] Build web vérifié OK

### Session 5 - 24 février 2026 (FAIT)
- [x] Bouton "Envoyer au client" ajouté sur page détail BDL (web admin)
- [x] API route `/api/send-to-client` créée (télécharge PDF + envoie via Resend au client)
- [x] RESEND_API_KEY ajoutée dans web/.env.local
- [x] **Fix PDF corrompu** : Edge Function réécrite avec **pdf-lib** (vrai PDF natif)
  - Plus de dépendance à html2pdf.app (service externe qui ne marchait pas)
  - PDF A4 avec layout complet : en-tête, sections colorées, signature PNG, pied de page
  - Import : `pdf-lib@1.17.1` via esm.sh
- [x] Edge Function redéployée sur Supabase
- [x] PDF BDL-20260224-00001 regénéré avec succès (vrai PDF cette fois)
- [x] Email renvoyé avec succès (statut EMAIL_SENT)
- [x] **Problème Resend identifié** : avec `onboarding@resend.dev`, envoi uniquement vers jeremie.magnet@gmail.com
  - Pour envoyer à joy.slama@gmail.com ou aux clients → besoin de vérifier un domaine sur Resend
  - Alternative possible : Gmail SMTP (gratuit, pas de domaine requis)

### À FAIRE (prochaine session)
- [ ] **PRIORITAIRE** : Configurer l'envoi d'email (choisir une option) :
  - Option A : Acheter un domaine (~5 euros/an) + le vérifier sur Resend
  - Option B : Utiliser Gmail SMTP (gratuit, modifier le code)
  - Option C : Mode test uniquement (emails vers jeremie.magnet@gmail.com)
- [ ] Créer quelques clients de test via l'admin web
- [ ] Tester l'autocomplétion sur l'app mobile (rebuild nécessaire)
- [ ] Vérifier le pré-remplissage email + adresse à la sélection
- [ ] Tester la dictée vocale en français (non dispo sur émulateur)
- [ ] Tester le téléchargement PDF depuis l'admin et le mobile
- [ ] Ajouter d'autres livreurs si besoin

### Commandes pour reprendre
```bash
# 1. Lancer l'émulateur Android
C:/dev/android-sdk/emulator/emulator.exe -avd Pixel_6 -no-audio &

# 2. Web admin
cd web && npm run dev

# 3. Copier le code mobile vers un chemin sans espaces puis lancer
cp -r "mobile/"* /c/dev/joja-app/
cd /c/dev/joja-app && export FLUTTER_PREBUILT_ENGINE_VERSION=6c0baaebf70e0148f485f27d5616b3d3382da7bf && flutter run -d emulator-5554

# 4. Déployer l'Edge Function (si modifiée)
SUPABASE_ACCESS_TOKEN=sbp_f24d3f57f0d98c89dd53982b2cb0cca02e839bcd npx supabase functions deploy generate_and_email_pdf --no-verify-jwt
```
