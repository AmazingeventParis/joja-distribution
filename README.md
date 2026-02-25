# JOJA DISTRIBUTION - Bons de Livraison

Application complète pour générer, envoyer et gérer des Bons de Livraison (BDL).

- **Mobile Flutter** : pour les livreurs (créer BDL + signature + dictée vocale)
- **Web Admin Next.js** : pour l'administrateur (voir tous les BDL, filtrer, relancer les emails)
- **Backend Supabase** : base de données, authentification, stockage, Edge Functions
- **Email Resend** : envoi automatique du PDF par email

---

## Architecture

```
/mobile          → App Flutter (Android/iOS) pour livreurs
/web             → Interface admin Next.js TypeScript
/supabase/functions/generate_and_email_pdf  → Edge Function (génération PDF + email)
/sql/schema.sql  → Schéma complet de la base de données
```

---

## Guide d'installation étape par étape

### Étape 1 : Créer un projet Supabase

1. Allez sur [https://supabase.com](https://supabase.com)
2. Créez un compte gratuit
3. Cliquez sur **"New Project"**
4. Choisissez un nom (ex: `joja-bdl`), un mot de passe pour la base de données, et une région
5. Attendez que le projet soit créé (1-2 minutes)

### Étape 2 : Activer l'authentification email/password

1. Dans votre projet Supabase, allez dans **Authentication** > **Providers**
2. Vérifiez que **Email** est activé (c'est le cas par défaut)
3. Optionnel : désactivez "Confirm email" dans **Authentication** > **Settings** pour simplifier les tests

### Étape 3 : Créer les buckets de stockage

1. Allez dans **Storage** dans le menu de gauche
2. Le SQL le fait automatiquement, mais si besoin créez manuellement :
   - Bucket `logos` (privé)
   - Bucket `signatures` (privé)
   - Bucket `pdfs` (privé)

### Étape 4 : Exécuter le schéma SQL

1. Allez dans **SQL Editor** dans le menu de gauche
2. Cliquez sur **"New Query"**
3. Copiez-collez le contenu complet du fichier `sql/schema.sql`
4. Cliquez sur **"Run"**
5. Vérifiez qu'il n'y a pas d'erreur (les tables apparaissent dans **Table Editor**)

### Étape 5 : Récupérer vos clés Supabase

1. Allez dans **Settings** > **API** (ou **Project Settings** > **API**)
2. Notez ces 3 valeurs :
   - **Project URL** : `https://xxxxx.supabase.co`
   - **anon/public key** : `eyJhbGciOi...` (clé longue)
   - **service_role key** : `eyJhbGciOi...` (clé longue, secrète !)

### Étape 6 : Configurer Resend (envoi d'emails)

1. Allez sur [https://resend.com](https://resend.com)
2. Créez un compte gratuit
3. Allez dans **API Keys** et créez une clé
4. Notez la clé : `re_xxxxxxxxxxxx`
5. **Important** : Pour envoyer des emails, vous devez vérifier un domaine dans Resend.
   En mode test, Resend permet d'envoyer uniquement à votre propre email.

### Étape 7 : Déployer l'Edge Function

1. Installez le CLI Supabase :
   ```bash
   npm install -g supabase
   ```

2. Connectez-vous :
   ```bash
   supabase login
   ```

3. Liez votre projet :
   ```bash
   supabase link --project-ref VOTRE_PROJECT_REF
   ```
   (Le project ref est dans l'URL de votre dashboard : `https://supabase.com/dashboard/project/VOTRE_PROJECT_REF`)

4. Configurez les secrets (variables d'environnement) :
   ```bash
   supabase secrets set RESEND_API_KEY=re_votre_cle_ici
   ```

5. Déployez la fonction :
   ```bash
   supabase functions deploy generate_and_email_pdf
   ```

### Étape 8 : Lancer le Web Admin

1. Allez dans le dossier `web/` :
   ```bash
   cd web
   ```

2. Créez le fichier `.env.local` :
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://VOTRE-PROJET.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-anon-key-ici
   ```

3. Installez les dépendances :
   ```bash
   npm install
   ```

4. Lancez le serveur de développement :
   ```bash
   npm run dev
   ```

5. Ouvrez [http://localhost:3000](http://localhost:3000)

### Étape 9 : Lancer l'app Mobile

1. Assurez-vous que Flutter est installé : [https://flutter.dev/docs/get-started/install](https://flutter.dev/docs/get-started/install)

2. Allez dans le dossier `mobile/` :
   ```bash
   cd mobile
   ```

3. Installez les dépendances :
   ```bash
   flutter pub get
   ```

4. Lancez l'app avec vos clés Supabase :
   ```bash
   flutter run \
     --dart-define=SUPABASE_URL=https://VOTRE-PROJET.supabase.co \
     --dart-define=SUPABASE_ANON_KEY=votre-anon-key-ici
   ```

### Étape 10 : Créer les utilisateurs (admin + livreur)

#### Créer un administrateur

1. Dans Supabase, allez dans **Authentication** > **Users**
2. Cliquez sur **"Add User"** > **"Create New User"**
3. Entrez un email et un mot de passe (ex: `admin@joja.com` / `motdepasse123`)
4. Allez dans **SQL Editor** et exécutez :
   ```sql
   INSERT INTO public.profiles (id, role, name)
   VALUES (
     'COPIEZ_LE_UUID_DU_USER_ICI',
     'admin',
     'Administrateur'
   );
   ```
   (Le UUID se trouve dans **Authentication** > **Users**, colonne "UID")

#### Créer un livreur

1. Même procédure : créez un user dans **Authentication** > **Users**
2. Exécutez dans **SQL Editor** :
   ```sql
   INSERT INTO public.profiles (id, role, name)
   VALUES (
     'COPIEZ_LE_UUID_DU_LIVREUR_ICI',
     'driver',
     'Nom du Livreur'
   );
   ```

---

## Fonctionnement

### Flux complet

1. Le **livreur** se connecte sur l'app mobile
2. Il crée un **Bon de Livraison** : client, adresse, détails (peut dicter), signature
3. Il appuie sur **VALIDER**
4. L'app :
   - Enregistre le BDL en base de données
   - Upload la signature PNG dans Supabase Storage
   - Appelle l'Edge Function `generate_and_email_pdf`
5. L'Edge Function :
   - Génère un PDF A4 avec toutes les infos + signature
   - Upload le PDF dans Storage
   - Envoie le PDF par email à `joy.slama@gmail.com` (+ email client si renseigné)
   - Met à jour le statut (EMAIL_SENT ou EMAIL_FAILED)
6. L'**admin** consulte tous les BDL sur le tableau de bord web
7. Si un email a échoué, l'admin peut cliquer sur **"Renvoyer l'email"**

### Numérotation des BDL

Format : `BDL-YYYYMMDD-XXXXX`
- Exemple : `BDL-20260223-00001`
- Séquence auto-incrémentée

---

## Dépannage

| Problème | Solution |
|----------|----------|
| "Connexion requise" sur mobile | Vérifiez votre connexion Wi-Fi/4G |
| Email non reçu | Vérifiez votre clé Resend et votre domaine vérifié |
| "BDL introuvable" | Vérifiez que le schéma SQL a bien été exécuté |
| Erreur 401 sur l'Edge Function | Vérifiez que le user est authentifié et que les RLS sont correctes |
| PDF non généré | Vérifiez les logs de l'Edge Function dans Supabase Dashboard > Edge Functions > Logs |

---

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Base de données | Supabase (PostgreSQL) |
| Authentification | Supabase Auth |
| Stockage fichiers | Supabase Storage |
| Edge Function | Supabase Edge Functions (Deno) |
| Email | Resend |
| PDF | HTML → PDF (Edge Function) |
| Mobile | Flutter + speech_to_text + hand_signature |
| Web admin | Next.js 14 + TypeScript |
