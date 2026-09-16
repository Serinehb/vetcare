# VetCare — Version finale (toutes les corrections)
## Comment mettre à jour votre site Vercel

---

## 1. Ce qui est corrigé dans cette version

**Vos 3 derniers signalements (photos) :**
1. **Panneau de notifications coupé sur téléphone** (espaces Admin ET Client ET Stagiaire) :
   il s'affiche maintenant en entier, sur toute la largeur de l'écran, sous la barre du haut.
2. **Fiche animal qui redemande les infos à chaque connexion** :
   - sur le même téléphone : les infos sont conservées, le formulaire ne revient plus ;
   - sur un nouvel appareil : les infos sont restaurées automatiquement depuis le serveur
     (écran "Restauration de votre profil…" une seconde, puis votre espace complet).
3. **Fenêtre de recherche sur téléphone** : tant qu'elle est ouverte, la page principale
   derrière est **bloquée** (elle ne bouge plus), et retrouve exactement sa position à la fermeture.

**Corrections des demandes précédentes (déjà dans cette version) :**
- Messagerie, bouton Envoyer, scrollbar et navbar corrects sur téléphone (3 espaces).
- Nouveau message → notification + badge rouge sur "Messagerie" dans le menu.
- Nouvelle inscription / nouveau rendez-vous → notification.
- Rappel automatique au client quand un rendez-vous approche (moins de 24 h) — envoyé
  par le serveur, même si aucun admin n'est connecté.
- Bouton "Retour au site" de l'admin : il ne déconnecte plus, retour à l'accueil et
  reprise de l'espace admin sans re-taper le mot de passe.
- Messagerie + rendez-vous + notifications enregistrés côté serveur et synchronisés
  entre appareils (~4 secondes).

---

## 2. Comment installer cette version sur votre site Vercel

### Étape 1 — Remplacer le code
1. Décompressez `vetcare-FINAL-toutes-corrections.zip`.
2. Remplacez TOUS les fichiers de votre projet (dépôt GitHub ou dossier local) par le
   contenu du dossier `vetcare/` du zip, **sauf le dossier `node_modules`** (il se
   réinstalle tout seul) et **sauf vos fichiers `.env`** si vous y avez mis des clés
   différentes (le zip contient les vôtres).

### Étape 2 — Redéployer
- Si votre site est branché à GitHub : poussez (commit + push) → Vercel redéploie tout seul.
- Sinon, dans Vercel : ouvrez votre projet → onglet **Deployments** → bouton **Redeploy**.

### Étape 3 — Vérifier sur votre téléphone
- Panneau de notifications : il doit s'afficher en entier.
- Recherche : la page derrière ne doit plus bouger.
- Déconnexion puis reconnexion : la fiche animal ne doit plus redemander les infos.

---

## 3. IMPORTANT — La base de données (à lire)

Votre base MySQL hébergée (Aiven) est **hors service** : son adresse
`mysql-...-d290.g.aivencloud.com` n'existe plus (service supprimé ou expiré).

Conséquences tant que la base n'est pas rétablie :
- **Sur votre ordinateur / serveur local** : tout est sauvegardé dans le fichier
  `data/vetcare-db-fallback.json` — rien ne se perd.
- **Sur Vercel** : le disque du serveur est **en lecture seule et temporaire**. Le site
  fonctionne, les données sont gardées tant que le serveur reste "chaud", mais elles
  peuvent être effacées quand Vercel redémarre le serveur (quelques heures/jours).
  Sur un même téléphone, la fiche animal reste quand même enregistrée dans le
  navigateur — c'est le cas que vous avez testé.

**Pour une sauvegarde DÉFINITIVE (recommandé) :**
1. Recréez un MySQL gratuit (Aiven free plan, ou un autre fournisseur MySQL).
2. Copiez la nouvelle adresse de connexion (elle ressemble à
   `mysql://user:motdepasse@hote:port/defaultdb?ssl-mode=REQUIRED`).
3. Dans Vercel : votre projet → **Settings → Environment Variables** →
   remplacez la valeur de `DATABASE_URL` par la nouvelle adresse.
4. Redéployez. Le site bascule automatiquement sur la vraie base (Prisma) —
   aucune autre modification nécessaire.

Tant que la base n'est pas rétablie, le fichier `data/vetcare-db-fallback.json` sert
de base de données de secours, et sur Vercel les écritures basculent sur `/tmp`
(temps de survie limité à la session du serveur).

---

## 4. Comptes de test

- Espace admin : `sophie.martin@vetcare.com` / `VetCare@2024`
- Espace stagiaire : compte créé à l'inscription stagiaire.
