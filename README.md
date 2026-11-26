# GameVault

Une fiche de jeu vidéo correspond à une carte. GitHub conserve le code ; InfinityFree héberge la vitrine, le PHP et MySQL/MariaDB sur le même domaine. GitHub Pages n’est pas nécessaire.

1. Créer une base MySQL dans le panneau InfinityFree, la sélectionner dans phpMyAdmin et importer `database/mysql/schema.sql`. Les scripts PostgreSQL de `database/gamevault/` sont historiques.
2. Créer les secrets GitHub Actions `INFINITYFREE_FTP_USER` et `INFINITYFREE_FTP_PASSWORD` avec les identifiants FTP. Lancer manuellement le workflow depuis `main`. Il publie la vitrine et `api/index.php`, sans supprimer les autres fichiers distants.
3. Créer manuellement `htdocs/api/config.local.php` sur InfinityFree à partir de `api/public/config.example.php`, avec les identifiants MySQL du panneau, distincts des identifiants FTP. Ne jamais commiter ce fichier ni envoyer ses valeurs dans le chat.
4. Ouvrir `/`, puis `/api/index.php` sur le domaine InfinityFree. Cette route vérifie la connexion MySQL et la présence de la table `jeux` sans exposer les erreurs internes. Un code 503 indique que la base ou sa configuration doit être vérifiée.

Le FTP ne modifie pas la base. Le catalogue public, les comptes, les boosters, le marché et les mises à jour à la demande restent à implémenter.
