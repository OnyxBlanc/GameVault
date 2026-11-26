# GameVault

Une fiche de jeu vidéo correspond à une carte. GitHub conserve le code ; InfinityFree héberge le site, le PHP et MySQL/MariaDB sur le même domaine.

## Version 1

- Catalogue paginé (24 jeux par page) avec recherche et filtre par genre.
- Création de compte, connexion, déconnexion (sessions PHP, mots de passe hachés).
- Collection personnelle avec quantités.
- Un pack de départ de 5 jeux par joueur, tiré côté serveur. Aucun crédit n’est gagné en obtenant des cartes.
- Mises à jour sans rechargement de la page, uniquement sur action de l’utilisateur.

Pas encore implémenté : revente des doublons, marché entre joueurs, boosters payants, administration, import du catalogue complet.

## Installation sur InfinityFree

1. Créer une base MySQL dans le panneau, ouvrir phpMyAdmin, importer `database/mysql/schema.sql` puis `database/mysql/seed.sql` (encodage UTF-8). Si une ancienne version du schéma a déjà été importée, supprimer ses tables avant de réimporter.
2. Créer les secrets GitHub Actions `INFINITYFREE_FTP_USER` et `INFINITYFREE_FTP_PASSWORD`, puis lancer manuellement le workflow depuis `main`. Il construit `dist/` avec `scripts/build-dist.sh` et le transfère dans `htdocs/` sans rien supprimer sur le serveur.
3. Créer manuellement `htdocs/api/config.local.php` à partir de `api/public/config.example.php`, avec les identifiants MySQL du panneau (différents des identifiants FTP). Ce fichier n’est jamais commité ni écrasé par le déploiement.
4. Ouvrir `/api/index.php` : la réponse attendue est `{"status":"ok"}`. Ouvrir ensuite `/`.

## Test local

```
bash scripts/build-dist.sh
cp api/public/config.example.php dist/api/config.local.php
```

Éditer `dist/api/config.local.php` avec les identifiants du MySQL local, importer le schéma et le seed, puis lancer `php -S localhost:8000 -t dist`.

## Limites à connaître

L’offre gratuite limite les requêtes quotidiennes et l’usage CPU de la base. La V1 évite toute actualisation automatique, mais il n’y a pas encore de limitation des tentatives de connexion.
