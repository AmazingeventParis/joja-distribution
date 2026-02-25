# Project Select - JOJA DISTRIBUTION

## Choix du projet et décisions techniques

### Pourquoi cette stack ?

| Besoin                  | Solution choisie          | Raison                                              |
|-------------------------|---------------------------|------------------------------------------------------|
| Base de données         | Supabase (Postgres)       | Gratuit, hébergé, Auth + Storage intégrés            |
| Authentification        | Supabase Auth             | Email/password, gestion des rôles via table profiles |
| Stockage fichiers       | Supabase Storage          | Signatures PNG, PDFs, logos - signed URLs sécurisées |
| Génération PDF          | pdf-lib (Edge Function)   | Vrai PDF natif, pas de service externe               |
| Envoi emails            | Resend                    | API simple, plan gratuit suffisant pour MVP          |
| App mobile              | Flutter                   | Cross-platform Android/iOS, un seul code             |
| Dictée vocale           | speech_to_text (Flutter)  | Package natif, supporte le français                  |
| Signature               | hand_signature (Flutter)  | Canvas simple, export PNG                            |
| Admin web               | Next.js TypeScript        | Rapide à mettre en place, SSR, écosystème React      |

### Structure des données

```
profiles (1 par utilisateur)
  ├── id (UUID, ref auth.users)
  ├── role: 'admin' | 'driver'
  ├── name
  └── created_at

company_settings (1 ligne unique)
  ├── company_name (default: 'JOJA DISTRIBUTION')
  ├── logo_path (optionnel, bucket "logos")
  ├── main_email (default: 'joy.slama@gmail.com')
  └── created_at

delivery_notes (1 par bon de livraison)
  ├── id (UUID)
  ├── bdl_number: BDL-YYYYMMDD-XXXXX (unique, auto-généré)
  ├── client_name (obligatoire)
  ├── client_email (optionnel)
  ├── address (obligatoire)
  ├── details (obligatoire)
  ├── signature_path → bucket "signatures" (ex: BDL-20260223-00001.png)
  ├── pdf_path → bucket "pdfs" (ex: BDL-20260223-00001.pdf)
  ├── status: VALIDATED | EMAIL_SENT | EMAIL_FAILED
  ├── driver_id → profiles.id
  ├── validated_at
  └── created_at

email_logs (1 par envoi d'email)
  ├── id (UUID)
  ├── delivery_note_id → delivery_notes.id
  ├── to_email
  ├── status: sent | failed
  ├── error (texte de l'erreur si failed)
  └── created_at

clients (base de fiches clients, gérée par l'admin)
  ├── id (UUID)
  ├── name (obligatoire)
  ├── email (optionnel)
  ├── address (optionnel)
  └── created_at
```

### Flux principal

```
[Livreur - Mobile Flutter]
  1. Login (email/password via Supabase Auth)
  2. Saisir infos BDL :
     - Client / Société (obligatoire) + AUTOCOMPLÉTION depuis table clients
       → Quand un client est sélectionné, email + adresse sont pré-remplis
       → Le livreur peut aussi taper un nom libre (client non enregistré)
     - Email client (optionnel, validé si rempli)
     - Adresse (obligatoire)
     - Détail livraison (obligatoire) + bouton Dicter (speech_to_text FR)
     - Zone signature (hand_signature canvas) + bouton Effacer
  3. Clic VALIDER
     │
     ├── Vérification connectivité (sinon "Connexion requise")
     ├── Validation des champs obligatoires
     ├── INSERT delivery_notes → récupère id + bdl_number
     ├── Export signature en PNG (hand_signature → Uint8List)
     ├── UPLOAD signature.png → bucket "signatures"
     ├── UPDATE delivery_notes.signature_path
     └── APPEL supabase.functions.invoke('generate_and_email_pdf')
           │
           ├── Charge BDL + company_settings + profil livreur
           ├── Télécharge signature depuis Storage (base64)
           ├── Télécharge logo si existant (base64)
           ├── Génère un vrai PDF avec pdf-lib (layout A4, sections, signature PNG)
           │     (import pdf-lib@1.17.1 via esm.sh - pas de service externe)
           ├── UPLOAD pdf → bucket "pdfs"
           ├── UPDATE delivery_notes.pdf_path
           ├── ENVOIE email via Resend (PDF en pièce jointe)
           │     ├── → joy.slama@gmail.com (toujours)
           │     └── → client_email (si renseigné)
           ├── INSERT email_logs (sent/failed + erreur)
           ├── UPDATE delivery_notes.status (EMAIL_SENT / EMAIL_FAILED)
           └── RETOURNE { ok, pdf_path, bdl_number, email_status }
  4. Affiche succès + numéro BDL

[Livreur - Historique Mobile]
  - Liste des BDL du livreur (filtre driver_id = auth.uid() via RLS)
  - Badge statut (EMAIL_SENT vert / EMAIL_FAILED rouge / VALIDATED orange)
  - Clic → bottom sheet détail
  - Bouton "Télécharger PDF" → signed URL → ouvre dans le navigateur

[Admin - Web Next.js]
  1. Login (vérifie rôle 'admin' dans profiles)
  2. Navigation : 3 onglets (Bons de Livraison | Chauffeurs | Clients)
  3. Page Bons de Livraison : liste BDL avec filtres
     - Filtre par client (recherche texte, ilike)
     - Filtre par statut (VALIDATED / EMAIL_SENT / EMAIL_FAILED)
     - Filtre par date
     - Bouton réinitialiser
  4. Clic sur un BDL → page détail :
     - Affiche tous les champs + nom livreur
     - Image signature (via signed URL)
     - Bouton "Télécharger le PDF" (via signed URL)
     - Historique emails (table email_logs)
     - Bouton "Renvoyer l'email" si status = EMAIL_FAILED
       → rappelle l'Edge Function generate_and_email_pdf
     - Bouton "Envoyer au client (email@client.com)" (vert)
       → API route /api/send-to-client (télécharge PDF + envoie via Resend)
       → Visible si client_email renseigné et PDF disponible
  5. Page Chauffeurs : gestion des comptes livreurs
     - Tableau : nom, email, date de création
     - Formulaire d'ajout (nom, email, mot de passe)
     - Suppression avec confirmation
  6. Page Clients : gestion de la base clients
     - Tableau : nom, email, adresse, date de création
     - Formulaire d'ajout (nom, email optionnel, adresse optionnelle)
     - Modification inline (clic Modifier → champs éditables → Sauver)
     - Suppression avec confirmation
     - Ces clients alimentent l'autocomplétion mobile
```

### Sécurité (RLS - Row Level Security)

| Table            | Driver (livreur)                    | Admin                    |
|------------------|-------------------------------------|--------------------------|
| profiles         | SELECT son propre profil            | SELECT tous les profils  |
| company_settings | SELECT (lecture seule)              | SELECT + UPDATE          |
| delivery_notes   | SELECT/INSERT/UPDATE ses propres BDL| SELECT + UPDATE tous     |
| email_logs       | SELECT les logs de ses propres BDL  | SELECT tous les logs     |
| clients          | SELECT tous (pour autocomplétion)   | ALL (CRUD complet)       |

**CRITIQUE** : La vérification admin utilise `public.is_admin()` (fonction SQL SECURITY DEFINER) pour éviter la récursion infinie. Ne JAMAIS faire de SELECT direct sur `profiles` dans une policy RLS de `profiles`.

### Storage (Supabase Storage)

| Bucket      | Contenu                | Accès              | Nommage fichiers           |
|-------------|------------------------|---------------------|----------------------------|
| logos       | Logo société (optionnel)| SELECT authentifié | libre                      |
| signatures  | Signatures PNG clients | INSERT + SELECT auth| {bdl_number}.png           |
| pdfs        | PDFs générés           | SELECT authentifié | {bdl_number}.pdf           |

Tous les buckets sont **privés**. L'accès se fait uniquement via **signed URLs** (durée : 1 heure).

### Environnements et configuration

| Variable                          | Où                        | Valeur                                          |
|-----------------------------------|---------------------------|------------------------------------------------|
| NEXT_PUBLIC_SUPABASE_URL          | web/.env.local            | https://bpxsodccsochwltzilqr.supabase.co       |
| NEXT_PUBLIC_SUPABASE_ANON_KEY     | web/.env.local            | (clé JWT anon - voir CLAUDE.md)                |
| SUPABASE_URL                      | mobile/lib/main.dart      | Codé en dur comme defaultValue                 |
| SUPABASE_ANON_KEY                 | mobile/lib/main.dart      | Codé en dur comme defaultValue                 |
| RESEND_API_KEY                    | Supabase secrets          | re_9kFcbvM5_3HPF5yXXYU6pFeSAAYbJjFh1          |
| SUPABASE_URL                      | Edge Function (auto)      | Injecté automatiquement par Supabase           |
| SUPABASE_SERVICE_ROLE_KEY         | Edge Function (auto)      | Injecté automatiquement par Supabase           |

### Template PDF (A4)
Le PDF contient :
- **En-tête** : Logo (si existant) + "JOJA DISTRIBUTION" en bleu + numéro BDL + date
- **Titre** : "BON DE LIVRAISON" centré
- **Bloc client** : Nom/société + Email (grille 2 colonnes)
- **Adresse** : bloc pleine largeur
- **Détails livraison** : bloc fond bleu clair avec le texte
- **Livreur** : nom du livreur
- **Signature** : image PNG + mention "Lu et approuvé"
- **Pied de page** : nom société + date de génération
- **Style** : bordures bleues, coins arrondis, polices propres

### Email envoyé
- **From** : `JOJA DISTRIBUTION <onboarding@resend.dev>` (mode test - à changer quand domaine vérifié)
- **To** : `joy.slama@gmail.com` + client_email (si renseigné)
- **Sujet** : `Bon de Livraison BDL-YYYYMMDD-XXXXX - JOJA DISTRIBUTION`
- **Corps** : HTML avec résumé (client, adresse, date, livreur)
- **Pièce jointe** : le PDF en base64

### Fonctionnalités implémentées (MVP)
- Création BDL mobile avec signature + dictée vocale
- Génération PDF + envoi email automatique via Edge Function
- Admin web : liste BDL + filtres + détail + retry email
- Gestion des chauffeurs (admin web)
- Gestion des clients (admin web : CRUD complet)
- Autocomplétion clients sur mobile (pré-remplissage email + adresse)
- Historique BDL mobile + téléchargement PDF

### Limitations du MVP
- Pas de mode offline (connexion obligatoire)
- Pas de gestion multi-société (1 seule société : JOJA DISTRIBUTION)
- Pas de gestion des produits/articles (texte libre pour les détails)
- Pas de modification d'un BDL après validation
- Email envoyé depuis onboarding@resend.dev (domaine test Resend) → ne peut envoyer qu'à jeremie.magnet@gmail.com tant qu'un domaine propre n'est pas vérifié sur Resend
- Pas de pagination sur la liste des BDL (OK pour un MVP)
- speech_to_text nécessite les permissions micro (Android/iOS)

### Problèmes rencontrés et solutions

| Problème | Cause | Solution |
|----------|-------|----------|
| Récursion infinie RLS sur profiles | Policy admin faisait SELECT sur profiles | Fonction `is_admin()` SECURITY DEFINER |
| Mot de passe avec `!` non reconnu | Échappement JSON dans curl/bash | Utiliser Node.js https.request |
| supabase login impossible | Environnement non-TTY | Variable `SUPABASE_ACCESS_TOKEN` |
| Flutter symlinks bloqués | Mode Développeur Windows désactivé | Activer dans Paramètres Windows (FAIT 24/02) |
| Port 3000 occupé | Ancien processus Next.js | Next.js bascule auto sur 3001 |
| Émulateur Android ne démarre pas | Hyperviseur Windows non activé | Activer "Plateforme de l'hyperviseur Windows" + "Plateforme de machine virtuelle" dans Fonctionnalités Windows, puis redémarrer |
| Flutter "Unable to determine engine version" | PowerShell échoue dans Gradle subprocess | Workaround fallback COPY dans shared.bat |
| Build Gradle échoue (aapt2) | Espaces dans le chemin du projet | Copier vers C:\dev\joja-app pour builder |
| Page Clients bloquée sur "Chargement..." | API route GET via supabaseAdmin ne répondait pas | Utiliser Supabase client côté navigateur pour le SELECT |
| PDF corrompu / ne s'ouvre pas | html2pdf.app ne marchait pas, fallback stockait du HTML brut en .pdf | Remplacement complet par pdf-lib (génération PDF native dans Deno) |
| Resend : envoi échoue (403) | onboarding@resend.dev ne permet d'envoyer qu'au propriétaire du compte | Vérifier un domaine propre sur Resend OU utiliser Gmail SMTP |

### Évolutions possibles (post-MVP)
- Ajout de lignes produits avec quantités et prix
- Mode offline avec synchronisation (Hive/SQLite local)
- Tableau de bord avec statistiques (nb BDL/jour, taux d'échec email)
- Export CSV des BDL
- Multi-société / multi-entrepôt
- Notifications push pour le livreur
- Scan code-barres pour identifier les produits
- Géolocalisation de la livraison
- Photo de la livraison (preuve)
- Impression directe du BDL via imprimante Bluetooth
