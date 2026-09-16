# Envoi d'emails (Nodemailer, config SMTP générique)

VetCare envoie un email à chaque événement important : inscription
(client/stagiaire), réservation de RDV, rappel de RDV proche. C'est géré
côté serveur par **Nodemailer**, avec une configuration SMTP générique
(pas figée sur un fournisseur) — pour pouvoir changer de service juste
en éditant `.env`, sans toucher au code.

## Configuration actuelle : Gmail (gratuit)

1. Va dans les paramètres du compte Gmail expéditeur
   (`machattelolo9@gmail.com`) → Sécurité → active la **validation en 2
   étapes** (obligatoire pour créer un mot de passe d'application).
2. Va sur https://myaccount.google.com/apppasswords, crée un mot de
   passe d'application (choisis "Autre", nomme-le "VetCare").
3. Copie les 16 caractères générés.
4. Dans `.env.local` :
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=machattelolo9@gmail.com
   SMTP_PASS=les16caracteres
   SMTP_FROM=machattelolo9@gmail.com
   ```
5. Redémarre `npm run dev`.

Tant que ces variables ne sont pas définies, la route
`/api/send-email` ne fait qu'un `console.warn` et renvoie
`{ skipped: true }` — rien de cassé, juste aucun email réellement envoyé.

## Limite Gmail : le spam au début

Un compte Gmail personnel (sans domaine vérifié) n'est jamais garanti à
100% d'éviter le dossier spam, surtout sur les tout premiers emails
envoyés à une nouvelle adresse — c'est une limite du côté de Gmail
destinataire, pas un bug du code. Solution immédiate : ouvrir le
premier email en spam et cliquer "Ce n'est pas un spam" — les suivants
arriveront ensuite directement dans la boîte de réception.

## Passer à un vrai service pro (zéro spam garanti dès le 1er envoi)

Pour un usage réel avec de vrais clients, la solution fiable à 100% dès
le départ est un **domaine vérifié** sur un service transactionnel
(Brevo, Mailgun, SendGrid...). Une fois le domaine authentifié (SPF/DKIM
configurés côté service), il suffit de changer ces 5 lignes — **aucun
changement de code nécessaire** :

```
SMTP_HOST=smtp-relay.brevo.com   (exemple avec Brevo)
SMTP_PORT=587
SMTP_USER=identifiant-fourni-par-le-service
SMTP_PASS=mot-de-passe-fourni-par-le-service
SMTP_FROM=contact@ton-domaine.com
```

## Limite Gmail (volume)

Un compte Gmail standard est limité à ~500 emails/jour, largement
suffisant pour un cabinet vétérinaire en développement/test.
