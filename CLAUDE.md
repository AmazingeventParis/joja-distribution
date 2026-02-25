# CLAUDE.md - Projet JOJA DISTRIBUTION (Bons de Livraison)

## Resume du projet
Application pour generer, envoyer et gerer des Bons de Livraison (BDL) pour la societe **JOJA DISTRIBUTION**.
Email de reception automatique : `joy.slama@gmail.com`
**URL production** : https://joja.swipego.app

## Architecture standalone (v2.0 - 25 fevrier 2026)
JOJA est **100% independant** — sa propre base de donnees, son propre systeme d'auth, son propre stockage de fichiers. Aucune dependance a Supabase ou a d'autres projets.

```
JOJA Distribution (standalone)
+-- Next.js 14 (web admin + API REST)
+-- PostgreSQL 16 (container dedie sur Coolify)
+-- Auth custom (bcrypt + JWT HttpOnly cookies)
+-- Stockage fichiers local (volume Docker)
+-- PDF generation (pdf-lib dans API route Next.js)
+-- Email (Resend API)
+-- Flutter mobile (appelle l'API REST Next.js)
```

## Stack technique
- **Backend** : Next.js 14 API Routes (Node.js)
- **Base de donnees** : PostgreSQL 16 (container Docker dedie sur Coolify)
- **Auth** : bcrypt (hash mot de passe) + jsonwebtoken (JWT 7 jours)
- **Stockage** : Volume Docker `joja-uploads:/app/uploads` (logos, signatures, pdfs)
- **PDF** : pdf-lib (generation native dans API route Next.js)
- **Email** : Resend API
- **Mobile** : Flutter (Android/iOS) + speech_to_text (FR) + hand_signature (canvas PNG)
- **Web admin** : Next.js 14 TypeScript (styles inline, pas de CSS externe)
- **Deploiement** : Coolify (nixpacks) sur serveur OVH 217.182.89.133

## Infrastructure Coolify
- **App UUID** : `p0g8g8gc0wgs8cwwss8oocgc`
- **PostgreSQL UUID** : `po4gc0sg84wkocg0wg0ccssk`
- **URL** : https://joja.swipego.app
- **Repo** : https://github.com/AmazingeventParis/joja-distribution
- **Base directory** : `/web`
- **Build pack** : nixpacks

### Variables d'environnement (Coolify)
```
DATABASE_URL=postgres://joja:JojaDistr2026SecureDB@po4gc0sg84wkocg0wg0ccssk:5432/joja
JWT_SECRET=bd1e4cb2f1309aeaf9964785a385988f2db5bfb66ebe98017f3a337d930486f185117295911a728493f87fb7294f2be0
RESEND_API_KEY=re_9kFcbvM5_3HPF5yXXYU6pFeSAAYbJjFh1
UPLOADS_DIR=/app/uploads
```

### Volume Docker
- `joja-uploads:/app/uploads` avec sous-dossiers `/logos`, `/signatures`, `/pdfs`

## Architecture du projet
```
/sql/schema_standalone.sql                  -> Schema BDD standalone (sans Supabase)
/mobile/                                    -> App Flutter (livreurs)
  /mobile/lib/main.dart                     -> Point d'entree (pas de Supabase)
  /mobile/lib/services/api_service.dart     -> Client HTTP REST (auth JWT + toutes operations)
  /mobile/lib/screens/login_screen.dart     -> Connexion livreur via API REST
  /mobile/lib/screens/home_screen.dart      -> Accueil (creer BDL / historique)
  /mobile/lib/screens/create_bdl_screen.dart-> Formulaire BDL + signature + dictee vocale
  /mobile/lib/screens/history_screen.dart   -> Liste BDL + telecharger PDF
  /mobile/lib/services/connectivity_service.dart -> Verif connexion internet
  /mobile/pubspec.yaml                      -> Dependances Flutter (http, shared_preferences)
/web/                                       -> Interface admin Next.js + API REST
  /web/src/lib/db.ts                        -> Pool PostgreSQL (pg, max 10 connexions)
  /web/src/lib/auth.ts                      -> JWT sign/verify + bcrypt hash/compare
  /web/src/lib/auth-middleware.ts            -> Extraction user (Bearer header / cookie / query param)
  /web/src/app/layout.tsx                   -> Layout principal
  /web/src/app/page.tsx                     -> Liste BDL + filtres (page d'accueil admin)
  /web/src/app/login/page.tsx               -> Login admin
  /web/src/app/bdl/[id]/page.tsx            -> Detail BDL + retry email + telecharger PDF
  /web/src/app/chauffeurs/page.tsx          -> Gestion des chauffeurs (CRUD)
  /web/src/app/clients/page.tsx             -> Gestion des clients (CRUD + tableau + modif inline)
  /web/src/app/api/auth/login/route.ts      -> POST login (JWT + cookie HttpOnly)
  /web/src/app/api/auth/me/route.ts         -> GET user courant
  /web/src/app/api/auth/logout/route.ts     -> POST deconnexion (supprime cookie)
  /web/src/app/api/delivery-notes/route.ts  -> GET (liste + filtres) + POST (creer BDL)
  /web/src/app/api/delivery-notes/[id]/route.ts -> GET detail + PATCH modifier
  /web/src/app/api/drivers/route.ts         -> GET/POST/DELETE chauffeurs (bcrypt + SQL)
  /web/src/app/api/clients/route.ts         -> GET/POST/PUT/DELETE clients
  /web/src/app/api/email-logs/route.ts      -> GET logs email par BDL
  /web/src/app/api/files/upload/route.ts    -> POST upload fichier (multipart)
  /web/src/app/api/files/[...path]/route.ts -> GET servir fichier (auth requis)
  /web/src/app/api/generate-pdf/route.ts    -> POST generation PDF + envoi email
  /web/src/app/api/send-to-client/route.ts  -> POST envoi PDF au client par email
  /web/next.config.js                       -> output: "standalone"
  /web/package.json                         -> v2.0.0 (pg, jsonwebtoken, pdf-lib, bcryptjs)
/CLAUDE.md                                  -> Ce fichier
```

## Schema base de donnees PostgreSQL
```sql
-- Table users (remplace auth.users + profiles de Supabase)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,          -- bcrypt, 12 rounds
  role TEXT NOT NULL CHECK (role IN ('admin', 'driver')),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tables metier
CREATE TABLE company_settings (id UUID PK, company_name, logo_path, main_email);
CREATE TABLE delivery_notes (id UUID PK, bdl_number, driver_id FK->users, client_name,
  client_email, address, details, signature_path, pdf_path, status, validated_at, created_at);
CREATE TABLE email_logs (id UUID PK, delivery_note_id FK->delivery_notes, to_email, status, error);
CREATE TABLE clients (id UUID PK, name, email, address, created_at);

-- Sequence pour numerotation BDL : BDL-YYYYMMDD-XXXXX
CREATE SEQUENCE bdl_daily_seq;
```

## Systeme d'authentification
- **Hash** : bcrypt avec 12 rounds
- **Token** : JWT signe avec `JWT_SECRET`, expire apres 7 jours
- **Web** : token dans cookie HttpOnly `joja_token` (secure en prod, sameSite: lax)
- **Mobile** : token dans `SharedPreferences`, envoye via header `Authorization: Bearer <token>`
- **Auth middleware** : verifie dans l'ordre : header Authorization > cookie > query param `?token=`
- **Roles** : `admin` (acces complet) et `driver` (ses propres BDL uniquement)

## Comptes utilisateurs
| Role    | Email                    | Mot de passe | Ou l'utiliser      |
|---------|--------------------------|-------------|---------------------|
| Admin   | jeremie.magnet@gmail.com | Admin2026!  | Web admin           |
| Livreur | livreur@joja.com         | Admin2026!  | App mobile Flutter  |

## API REST (endpoints)

### Auth
| Route | Methode | Description |
|-------|---------|-------------|
| `/api/auth/login` | POST | Login (email + password) -> JWT + cookie |
| `/api/auth/me` | GET | User courant (valide le token) |
| `/api/auth/logout` | POST | Supprime le cookie |

### Bons de livraison
| Route | Methode | Description |
|-------|---------|-------------|
| `/api/delivery-notes` | GET | Lister (filtres: client_name, status, date) |
| `/api/delivery-notes` | POST | Creer un BDL |
| `/api/delivery-notes/[id]` | GET | Detail d'un BDL |
| `/api/delivery-notes/[id]` | PATCH | Modifier un BDL |

### Fichiers
| Route | Methode | Description |
|-------|---------|-------------|
| `/api/files/upload` | POST | Upload multipart (bucket: logos/signatures/pdfs) |
| `/api/files/[bucket]/[filename]` | GET | Servir un fichier (auth requis) |

### Autres
| Route | Methode | Description |
|-------|---------|-------------|
| `/api/generate-pdf` | POST | Generer PDF + envoyer email |
| `/api/send-to-client` | POST | Renvoyer PDF au client par email |
| `/api/drivers` | GET/POST/DELETE | CRUD chauffeurs |
| `/api/clients` | GET/POST/PUT/DELETE | CRUD clients |
| `/api/email-logs` | GET | Logs email par delivery_note_id |

Toutes les routes incluent des headers CORS pour l'acces mobile.

## Generation PDF (API route)
- Route : `/api/generate-pdf` (POST, auth requise)
- Utilise `pdf-lib` pour generer un vrai PDF natif
- PDF A4 avec : en-tete JOJA DISTRIBUTION, sections colorees, signature PNG, pied de page
- Sauvegarde dans `/app/uploads/pdfs/`
- Envoie par email via Resend a `joy.slama@gmail.com` (+ client_email si renseigne)
- Logue dans `email_logs` et met a jour le statut du BDL

## Numerotation BDL
Format : `BDL-YYYYMMDD-XXXXX` (sequence auto-incrementee via `bdl_daily_seq`)

## Flutter mobile - ApiService
Le fichier `mobile/lib/services/api_service.dart` centralise toutes les communications :
- Base URL : `https://joja.swipego.app`
- Token JWT stocke dans `SharedPreferences`
- Methodes : login, logout, getMyDeliveryNotes, createDeliveryNote, uploadFile, generatePdf, getClients, getPdfDownloadUrl
- Les URLs de fichiers incluent `?token=...` pour l'acces dans le navigateur externe

## Conventions de code
- **Langue** : tout en francais (commentaires, variables UI, messages)
- **Simplicite** : pas de sur-ingenierie, code clair et commente
- **100% online** : connexion obligatoire, pas de mode offline
- **Mobile** : verifier la connectivite avant chaque action reseau
- **Web** : styles inline (pas de CSS externe, simplicite maximale)
- **Securite** : fichiers servis avec auth, pas d'acces public
- **Pas d'emojis dans le code** sauf le micro pour le bouton dictee
- **Pas de Supabase** : tout passe par PostgreSQL direct + API REST custom

## Commandes utiles
```bash
# Web admin (dev local)
cd web && npm run dev

# Mobile Flutter
cd mobile && flutter run

# Deployer sur Coolify (via API)
curl -s "http://217.182.89.133:8000/api/v1/deploy?uuid=p0g8g8gc0wgs8cwwss8oocgc&force=true" \
  -H "Authorization: Bearer 1|FNcssp3CipkrPNVSQyv3IboYwGsP8sjPskoBG3ux98e5a576"

# Acces PostgreSQL (via SSH)
ssh ubuntu@217.182.89.133 "sudo docker exec -it $(sudo docker ps -q --filter name=po4gc0sg84wkocg0wg0ccssk) psql -U joja -d joja"

# Voir les logs de l'app
ssh ubuntu@217.182.89.133 "sudo docker logs --tail 100 $(sudo docker ps -q --filter name=p0g8g8gc0wgs8cwwss8oocgc)"
```

## Points d'attention / Bugs resolus
1. **Unicode dans les fichiers TSX** : les caracteres accentues doivent etre ecrits directement (e, a, etc.) et non en sequences d'echappement (`\u00e9`), sinon ils s'affichent litteralement dans le navigateur
2. **Mot de passe avec `!` dans curl** : bash interprete `!` dans les single quotes → utiliser des double quotes echappees : `-d "{\"password\":\"Admin2026!\"}"`
3. **Docker sans sudo** : sur le serveur OVH, utiliser `sudo docker` (l'utilisateur ubuntu n'est pas dans le groupe docker)
4. **SQL inline via docker exec** : les single quotes dans le SQL causent des erreurs → ecrire le SQL dans un fichier, docker cp, puis psql -f
5. **Coolify env vars** : ne pas envoyer le champ `is_build_time` dans l'API, il cause une erreur de validation

## Historique des sessions

### Sessions 1-5 (23-24 fevrier 2026) - Architecture Supabase
- MVP complet avec Supabase (Auth + Storage + Edge Functions)
- Web admin + mobile Flutter fonctionnels
- PDF generation avec pdf-lib dans Edge Function

### Session 6 - 25 fevrier 2026 - Migration vers standalone
- [x] PostgreSQL 16 dedie deploye sur Coolify
- [x] Schema standalone cree (users remplace auth.users + profiles)
- [x] Backend Next.js reecrit : pg + bcryptjs + jsonwebtoken + pdf-lib
- [x] Toutes les API routes creees (auth, delivery-notes, files, generate-pdf, etc.)
- [x] Toutes les pages web refactorees (plus aucune reference a Supabase)
- [x] App Flutter reecrite avec ApiService (http + shared_preferences)
- [x] Deploye et teste sur https://joja.swipego.app
- [x] Verifie : les utilisateurs JOJA n'apparaissent plus dans admin.swipego.app
- [x] JOJA est 100% independant

### A faire
- [ ] Configurer l'envoi d'email (Resend avec domaine verifie ou Gmail SMTP)
- [ ] Tester l'app Flutter sur un vrai appareil
- [ ] Nettoyer les anciennes tables JOJA dans le Supabase partage
- [ ] Supprimer le dossier /supabase/ du repo (plus utilise)
- [ ] Creer quelques clients de test
