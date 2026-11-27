# GameVault

**GameVault** est une application web de collection de jeux vidéo sous forme de cartes (PHP / MySQL / HTML-CSS-JS sans framework), conçue pour fonctionner sur un hébergement mutualisé comme **InfinityFree**.

## Fonctionnalités

- **Catalogue & Collection :** recherche par titre, filtre par genre, tri alphabétique ou par rareté, inspection détaillée des cartes et gestion des doublons.
- **Boosters animés :** pack de départ (5 cartes), boosters gratuits qui se rechargent dans le temps + boosters payants en crédits, ouverture par glisser-déchirer, révélation carte par carte et bilan final.
- **7 niveaux de rareté :** Commun (`62,974 %`), Peu commun (`25 %`), Rare (`10 %`), Épique (`1,5 %`), Légendaire (`0,45 %`), Mythique (`0,075 %`) et Éthéré (`0,001 %`), avec effets holographiques et auras dédiées.
- **Système de succès :** 48 succès répartis sur la collection, les raretés et les genres, avec récompenses en crédits réclamables individuellement ou en un clic.
- **Profil personnalisé & Vitrine :** inscription par email + pseudo + mot de passe, connexion par pseudo + mot de passe, bio, avatar et cadre d'avatar, titre, style de pseudo, thème de profil, vitrine jusqu'à 7 jeux (mode *Projecteur* ou *Classeur*), confidentialité Public / Privé et lien partageable (`?profil=Pseudo`).
- **Panel d'administration :** réservé aux comptes `is_admin = 1` — vue d'ensemble, journal des actions (`admin_logs`), gestion des joueurs (crédits, boosters, admin, timeout, ban/déban), gestion détaillée carte par carte des collections et des succès, gestion du catalogue et paramètres du site (maintenance, marché).

## Architecture du dépôt

```text
api/public/
  index.php          # API catalogue, collection, auth (register/login/logout), pack de départ
  booster.php        # Statut et ouverture de boosters
  carte.php          # Détails d'une carte
  succes.php         # Liste et réclamation des succès
  profile.php        # Lecture et personnalisation du profil + vitrine
  admin.php          # API complète du panel d'administration
  config.example.php # Modèle de configuration MySQL (à copier en config.local.php)

docs/
  index.html         # Interface principale
  assets/            # Feuilles de style (style, booster, inspect, succes, profile, admin) et scripts JS

database/mysql/
  migration_succes.sql # Table joueur_succes
  migration_admin.sql  # Colonnes de modération/admin + tables site_settings et admin_logs
  migration_profil.sql # Email + colonnes de personnalisation de profil et vitrine
```

## Installation & Migrations SQL

1. Créer la base MySQL et configurer `api/public/config.local.php` à partir de `api/public/config.example.php`.
2. Importer le schéma initial puis exécuter dans **phpMyAdmin** les migrations dans l'ordre :
   - `database/mysql/migration_succes.sql`
   - `database/mysql/migration_admin.sql`
   - `database/mysql/migration_profil.sql`
3. Promouvoir un compte en administrateur :
   ```sql
   UPDATE joueurs SET is_admin = 1 WHERE pseudo = 'TonPseudo';
   ```

## Déploiement sur InfinityFree

Le déploiement s'effectue via l'action GitHub **Déployer GameVault sur InfinityFree** (FTPS). Après chaque mise à jour incluant une migration SQL, exécuter d'abord le script SQL correspondant dans phpMyAdmin puis lancer le workflow de déploiement.

## Licence

Copyright © 2026 OnyxBlanc. Ce projet est distribué sous licence **GNU Affero General Public License v3.0 (AGPL-3.0)** — voir le fichier [LICENSE](./LICENSE).
