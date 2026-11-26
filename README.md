# GameVault
Application web de cartes de jeux vidéo à collectionner.

## Démarrage local
À la racine : `php -S localhost:8000 -t api/public` pour l’API, puis `python3 -m http.server 8080 --directory docs` pour la vitrine.

## GitHub Pages
Settings → Pages → Deploy from a branch → main → /docs. Seule la vitrine statique est publiée ; PHP et PostgreSQL nécessitent un autre hébergement.

## Ordre de développement
1. Migrations PostgreSQL et catalogue de 50 cartes.
2. Comptes, sessions et crédits.
3. Boutique et tirage pondéré côté serveur : débit et attribution dans une transaction.
4. Collection, doublons, historique et administration.
5. Phase 2 : import RAWG et boosters thématiques.
