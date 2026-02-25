# Project Select - JOJA DISTRIBUTION (v2.0 Standalone)

## Historique des decisions

### Migration Supabase → Standalone (25 fevrier 2026)
**Probleme** : JOJA partageait la meme instance Supabase que tous les autres projets (Admin-Hub, Kooki, etc.). Quand on creait un livreur dans JOJA, il apparaissait dans la page utilisateurs d'Admin-Hub car ils partageaient la table `auth.users`.

**Decision** : Rendre JOJA 100% independant — sa propre base de donnees, son propre systeme d'auth, son propre stockage de fichiers. Zero dependance a Supabase.

### Pourquoi cette stack ?

| Besoin | Solution choisie | Raison |
|--------|------------------|--------|
| Base de donnees | PostgreSQL 16 (container Docker dedie) | Independance totale, pas de partage avec d'autres projets |
| Authentification | bcrypt + JWT custom | Simple, pas de dependance externe, HttpOnly cookies securises |
| Stockage fichiers | Filesystem local (dossier public Next.js) | Simple, pas besoin de service externe |
| Generation PDF | pdf-lib (API route Next.js) | Vrai PDF natif, fonctionne en Node.js sans service externe |
| Envoi emails | Resend API | API simple, plan gratuit suffisant |
| App mobile | Flutter | Cross-platform Android/iOS, un seul code |
| Dictee vocale | speech_to_text (Flutter) | Package natif, supporte le francais |
| Signature | hand_signature (Flutter) | Canvas simple, export PNG |
| Admin web | Next.js 14 TypeScript | API REST integrees, SSR, deploiement standalone |
| Deploiement | Coolify (nixpacks) | PaaS self-hosted, SSL automatique via Traefik |

### Pourquoi pas Supabase ?
- Partage de `auth.users` entre projets = fuite de donnees
- Dependance a un service externe pour l'auth
- RLS complexe et source de bugs (recursion infinie)
- Edge Functions en Deno = limitations et complexite
- Signed URLs pour les fichiers = complexite inutile

### Pourquoi JWT custom plutot qu'un service d'auth ?
- Controle total sur les tokens et les roles
- Pas de dependance externe
- Cookie HttpOnly pour le web = securise et transparent
- Bearer token pour le mobile = simple et standard
- bcrypt 12 rounds = securite suffisante

---

## Architecture technique

### Infrastructure
```
Serveur OVH (217.182.89.133)
├── Coolify (PaaS)
│   ├── JOJA Distribution (Next.js 14 standalone) → joja.swipego.app
│   │   ├── App UUID : p0g8g8gc0wgs8cwwss8oocgc
│   │   ├── Build pack : nixpacks
│   │   └── Base directory : /web
│   └── PostgreSQL 16 (container dedie)
│       ├── UUID : po4gc0sg84wkocg0wg0ccssk
│       ├── Database : joja
│       ├── User : joja
│       └── Acces interne uniquement (pas de port public)
├── Flutter SDK : /opt/flutter
├── Android SDK : /opt/android-sdk
└── Java 17 : /usr/lib/jvm/java-17-openjdk-amd64
```

### Variables d'environnement (Coolify)
```
DATABASE_URL=postgres://joja:JojaDistr2026SecureDB@po4gc0sg84wkocg0wg0ccssk:5432/joja
JWT_SECRET=bd1e4cb2f1309aeaf9964785a385988f2db5bfb66ebe98017f3a337d930486f185117295911a728493f87fb7294f2be0
RESEND_API_KEY=re_9kFcbvM5_3HPF5yXXYU6pFeSAAYbJjFh1
UPLOADS_DIR=/app/uploads
```

---

## Structure des donnees

```
users (remplace auth.users + profiles de Supabase)
  ├── id (UUID, gen_random_uuid())
  ├── email (UNIQUE, NOT NULL)
  ├── password_hash (bcrypt 12 rounds)
  ├── role: 'admin' | 'driver'
  ├── name (NOT NULL)
  └── created_at

company_settings (1 ligne unique)
  ├── company_name (default: 'JOJA DISTRIBUTION')
  ├── logo_path (optionnel)
  ├── main_email (default: 'joy.slama@gmail.com')
  └── created_at

delivery_notes (1 par bon de livraison)
  ├── id (UUID)
  ├── bdl_number: BDL-YYYYMMDD-XXXXX (unique, auto-genere via bdl_daily_seq)
  ├── client_name (obligatoire)
  ├── client_email (optionnel)
  ├── address (obligatoire)
  ├── details (obligatoire)
  ├── signature_path → fichier dans uploads/signatures/
  ├── pdf_path → fichier dans uploads/pdfs/
  ├── status: VALIDATED | EMAIL_SENT | EMAIL_FAILED
  ├── driver_id → users.id
  ├── validated_at
  └── created_at

email_logs (1 par envoi d'email)
  ├── id (UUID)
  ├── delivery_note_id → delivery_notes.id
  ├── to_email
  ├── status: sent | failed
  ├── error (texte de l'erreur si failed)
  └── created_at

clients (base de fiches clients)
  ├── id (UUID)
  ├── name (obligatoire)
  ├── email (optionnel)
  ├── address (optionnel)
  └── created_at
```

---

## Systeme d'authentification

### Flux
```
[Login] → POST /api/auth/login (email + password)
  ├── Verification bcrypt du mot de passe
  ├── Generation JWT (expire 7 jours)
  ├── Web : cookie HttpOnly "joja_token" (secure en prod, sameSite: lax)
  └── Mobile : token dans le body JSON → stocke dans SharedPreferences

[Auth middleware] → verifie dans l'ordre :
  1. Header Authorization: Bearer <token>
  2. Cookie joja_token
  3. Query param ?token=... (pour PDF dans navigateur externe mobile)
```

### Roles et permissions
| Action | Driver (livreur) | Admin |
|--------|-----------------|-------|
| Voir ses BDL | Oui | Oui (tous) |
| Creer un BDL | Oui | Non (pas depuis le web) |
| Voir les chauffeurs | Non | Oui |
| Creer/supprimer un chauffeur | Non | Oui |
| Voir les clients | Oui (autocompletion) | Oui |
| Creer/modifier/supprimer un client | Non | Oui |

L'autorisation se fait dans les API routes (pas de RLS SQL).

---

## API REST

### Auth
| Route | Methode | Auth | Description |
|-------|---------|------|-------------|
| `/api/auth/login` | POST | Non | Login → JWT + cookie |
| `/api/auth/me` | GET | Oui | User courant |
| `/api/auth/logout` | POST | Non | Supprime le cookie |

### Bons de livraison
| Route | Methode | Auth | Description |
|-------|---------|------|-------------|
| `/api/delivery-notes` | GET | Oui | Liste (filtres: client_name, status, date) |
| `/api/delivery-notes` | POST | Oui | Creer un BDL |
| `/api/delivery-notes/[id]` | GET | Oui | Detail |
| `/api/delivery-notes/[id]` | PATCH | Oui | Modifier |

### Fichiers
| Route | Methode | Auth | Description |
|-------|---------|------|-------------|
| `/api/files/upload` | POST | Oui | Upload multipart (bucket: logos/signatures/pdfs) |
| `/api/files/[bucket]/[filename]` | GET | Oui | Servir un fichier |

### PDF et email
| Route | Methode | Auth | Description |
|-------|---------|------|-------------|
| `/api/generate-pdf` | POST | Oui | Generer PDF + envoyer email |
| `/api/send-to-client` | POST | Oui | Renvoyer PDF au client |

### CRUD
| Route | Methode | Auth | Description |
|-------|---------|------|-------------|
| `/api/drivers` | GET/POST/DELETE | Admin | CRUD chauffeurs |
| `/api/clients` | GET/POST/PUT/DELETE | Oui | CRUD clients |
| `/api/email-logs` | GET | Oui | Logs email par delivery_note_id |

Toutes les routes incluent des headers CORS pour l'acces mobile.

---

## Flux principal

```
[Livreur - Mobile Flutter]
  1. Login (email/password via POST /api/auth/login)
  2. Saisir infos BDL :
     - Client (obligatoire) + autocompletion depuis /api/clients
     - Email client (optionnel)
     - Adresse (obligatoire)
     - Detail livraison (obligatoire) + bouton Dicter (speech_to_text FR)
     - Zone signature (hand_signature canvas)
  3. Clic VALIDER
     ├── POST /api/delivery-notes → recupere id + bdl_number
     ├── Export signature en PNG
     ├── POST /api/files/upload (bucket: signatures)
     ├── PATCH /api/delivery-notes/[id] (signature_path)
     └── POST /api/generate-pdf
           ├── Charge BDL + company_settings + user (livreur)
           ├── Lit signature depuis filesystem
           ├── Genere PDF avec pdf-lib (layout A4)
           ├── Sauvegarde PDF dans uploads/pdfs/
           ├── Envoie email via Resend (PDF en piece jointe)
           ├── INSERT email_logs
           ├── UPDATE delivery_notes.status
           └── Retourne { ok, pdf_path, bdl_number, email_status }
  4. Affiche succes + numero BDL

[Admin - Web Next.js]
  1. Login → /api/auth/me verifie le role admin
  2. Navigation : Bons de Livraison | Chauffeurs | Clients
  3. Liste BDL avec filtres (client, statut, date)
  4. Detail BDL : signature, PDF, historique emails, retry, envoi au client
  5. Chauffeurs : tableau + ajout (bcrypt hash) + suppression
  6. Clients : tableau + ajout + modification inline + suppression
```

---

## Template PDF (A4)
- **En-tete** : "JOJA DISTRIBUTION" en bleu + numero BDL + date
- **Titre** : "BON DE LIVRAISON" centre
- **Bloc client** : Nom/societe + Email
- **Adresse** : bloc pleine largeur
- **Details livraison** : bloc fond bleu clair
- **Livreur** : nom du livreur
- **Signature** : image PNG + mention "Lu et approuve"
- **Pied de page** : nom societe + date de generation
- Polices : Helvetica / HelveticaBold / HelveticaOblique (StandardFonts)

---

## Email envoye
- **Domaine** : `swipego.app` (verifie sur Resend, DNS SPF+DKIM+DMARC configures sur OVH)
- **From** : `JOJA DISTRIBUTION <noreply@swipego.app>`
- **To** : `joy.slama@gmail.com` (toujours) + client_email (si renseigne)
- **Sujet** : `Bon de Livraison BDL-YYYYMMDD-XXXXX - JOJA DISTRIBUTION`
- **Corps** : HTML avec resume (client, adresse, date, livreur)
- **Piece jointe** : le PDF en base64
- **Peut envoyer a n'importe quelle adresse** (domaine verifie, plus de restriction mode test)

---

## APK Mobile
- **URL** : `https://joja.swipego.app/apk/joja-distribution.apk`
- **Build** : sur le serveur OVH avec Flutter 3.27.4
- **Taille** : ~15MB (arm64-v8a + armeabi-v7a)
- **Stockage** : fichier statique dans `web/public/apk/`
- **Lien** : bouton vert dans la carte JOJA sur admin.swipego.app

### Procedure de mise a jour APK
1. Pull + build sur le serveur : `flutter build apk --release`
2. Supprimer l'ancien APK de `web/public/apk/`
3. Copier le nouveau via scp
4. Mettre a jour la date/heure dans Admin `index.html`
5. Commit + push les deux repos
6. Deployer les deux sur Coolify

---

## Comptes utilisateurs

| Role | Email | Mot de passe | Usage |
|------|-------|-------------|-------|
| Admin | jeremie.magnet@gmail.com | Admin2026! | Web admin |
| Livreur | livreur@joja.com | Admin2026! | App mobile Flutter |

---

## Problemes rencontres et solutions

| Probleme | Cause | Solution |
|----------|-------|----------|
| Users JOJA dans admin.swipego.app | Supabase auth.users partage entre projets | Migration vers PostgreSQL dedie + auth custom |
| Unicode `\u00e9` dans le navigateur | Subagent a ecrit des sequences d'echappement au lieu de caracteres UTF-8 | Remplacer toutes les sequences par les vrais caracteres |
| Volume Docker non monte | Coolify nixpacks ignore `custom_docker_run_options` | Utiliser `web/public/` pour les fichiers statiques |
| `!` dans mot de passe curl | Bash interprete `!` comme expansion d'historique | Utiliser double quotes echappees |
| Docker sans sudo | User ubuntu pas dans le groupe docker | Toujours utiliser `sudo docker` |
| SQL inline via docker exec | Single quotes causent des erreurs | Ecrire SQL dans un fichier, docker cp, puis psql -f |
| PATH Windows injecte dans SSH | Bash local exporte le PATH Windows | Utiliser single quotes et PATH explicite dans la commande |
| Flutter build local echoue | Mode Developpeur Windows desactive | Builder sur le serveur Linux a la place |

---

## Limitations actuelles
- Pas de mode offline (connexion obligatoire)
- Pas de gestion multi-societe
- Pas de gestion des produits/articles (texte libre)
- Pas de modification d'un BDL apres validation
- Pas de pagination sur la liste des BDL
- Volume Docker non monte par Coolify (nixpacks) → fichiers uploades perdus au redeploiement
  (les fichiers statiques dans web/public/ sont OK car inclus dans le build)
  (l'APK est dans web/public/apk/ donc persiste)

---

## Evolutions possibles
- Ajout de lignes produits avec quantites et prix
- Mode offline avec synchronisation locale
- Tableau de bord avec statistiques
- Export CSV des BDL
- Notifications push pour le livreur
- Photo de la livraison (preuve)
- Pagination + recherche avancee
- Configurer un vrai volume persistant pour les uploads (fichiers dynamiques)
