# Base de données & authentification (Prisma + MySQL + NextAuth)

Le projet a maintenant une vraie base de données (**Prisma + MySQL sur
Aiven**, hébergé, pas besoin d'installer XAMPP), une vraie authentification
admin (**NextAuth + bcryptjs**, mots de passe hashés), et un vrai envoi
d'emails (**Nodemailer + Gmail**, voir README-EMAIL.md).

## Ce qui a été créé

- `prisma/schema.prisma` — le schéma complet : Admin (équipe), Client,
  Stagiaire, Appointment (RDV), ClientMessage, InternMessage, TeamMessage,
  NewClientNotification, DismissedNotification, SeenMarker.
- `prisma/seed.ts` — remplit la base avec les 3 comptes admin (mots de
  passe hashés avec bcryptjs) et les clients de démo.
- `src/lib/prisma.ts` — le client Prisma partagé par toutes les routes API.
- `src/lib/auth.ts` — configuration NextAuth (Credentials provider,
  vérifie l'email/mot de passe contre la table `Admin` en base, hash
  comparé avec bcryptjs).
- `src/app/api/auth/[...nextauth]/route.ts` — le endpoint de connexion
  NextAuth (remplace l'ancienne comparaison en clair contre un tableau
  codé en dur).
- `src/app/api/**` — les routes qui remplacent le localStorage :
  `/api/clients`, `/api/stagiaires`, `/api/appointments`,
  `/api/appointments/reminders`, `/api/messages/client/[email]`,
  `/api/messages/intern/[email]`, `/api/messages/team`,
  `/api/notifications`, `/api/seen`.

## ⚠️ Important : le front-end n'est pas encore branché

Ces routes API, ce schéma et NextAuth sont **prêts et fonctionnels côté
serveur**, mais les pages (`espace-admin/page.tsx`,
`espace-utilisateur/page.tsx`, `espace-stagiaire/page.tsx`) lisent et
écrivent encore dans le `localStorage` du navigateur comme avant —
elles n'appellent pas encore ces routes, et la connexion admin ne passe
pas encore par NextAuth. C'est volontaire : rebrancher ~230 Ko de code
React sans pouvoir tester contre une vraie base ici (le bac à sable n'a
pas accès à un serveur MySQL externe) aurait été trop risqué à
l'aveugle. Une fois que ta base tourne et que tu confirmes que les
routes marchent, on fait cette étape ensemble.

## Démarrage

### 1. Créer une base MySQL gratuite sur Aiven

1. Va sur https://aiven.io et crée un compte (aucune carte bancaire
   requise).
2. Crée un nouveau service → choisis **MySQL** → plan **Free**.
3. Choisis une région proche de toi, donne un nom au service (ex:
   `vetcare-db`), et crée-le. Ça prend 1-2 minutes à démarrer.
4. Une fois le service prêt (statut "Running"), va dans l'onglet
   **Overview** → section **Connection information** → copie le
   **Service URI** (commence par `mysql://avnadmin:...`).

### 2. Configurer `.env.local`

Colle le Service URI dans `DATABASE_URL`, en ajoutant `?sslaccept=strict`
à la fin (Aiven exige une connexion chiffrée) :

```
DATABASE_URL="mysql://avnadmin:TON_MOT_DE_PASSE@TON_HOTE.aivencloud.com:12345/defaultdb?sslaccept=strict"
```

Ajoute aussi les autres variables (voir `.env.local.example`) :
`GMAIL_USER`, `GMAIL_APP_PASSWORD` (README-EMAIL.md), et
`NEXTAUTH_SECRET` / `NEXTAUTH_URL` pour l'authentification.

Pour générer un `NEXTAUTH_SECRET` correct :
```bash
openssl rand -base64 32
```
(sous Windows sans `openssl`, tu peux aussi juste taper une longue
phrase aléatoire — l'important est que ce soit long et imprévisible.)

### 3. Installer les dépendances et générer le client Prisma

```bash
npm install
npx prisma generate
```

### 4. Créer les tables dans MySQL

```bash
npx prisma migrate dev --name init
```

Ça crée toutes les tables dans la base `defaultdb` fournie par Aiven.

### 5. Remplir les données initiales (équipe + clients démo)

```bash
npx prisma db seed
```

Le terminal affichera le mot de passe en clair à utiliser pour te
connecter (les mots de passe sont hashés en base, donc invisibles
directement, mais restent `VetCare@2024` par défaut).

### 6. Vérifier que ça marche

```bash
npm run dev
```

Puis dans un navigateur : http://localhost:3000/api/clients — tu dois
voir les 5 clients de démo en JSON.

Tu peux aussi explorer/modifier les données visuellement avec :

```bash
npx prisma studio
```

(ouvre une interface web sur http://localhost:5555)

## Prochaine étape

Une fois que `npx prisma studio` te montre bien tes tables remplies et
que `/api/clients` répond, dis-le moi et on passera à la connexion du
front-end : remplacer les appels `localStorage` par des `fetch()` vers
ces routes, et brancher le formulaire de connexion admin sur NextAuth —
étape par étape, pour pouvoir tester à chaque fois.
