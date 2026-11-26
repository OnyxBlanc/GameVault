# Squelette PostgreSQL de GameVault

Une fiche correspond à un jeu vidéo ; la carte est son affichage dans le site. La jaquette est référencée par `image_url`, pas stockée comme fichier dans la BDD. Un jeu peut avoir plusieurs genres et être dans plusieurs collections.

Sur une base de test Neon ou PostgreSQL, exécuter `schema.sql`, puis `demo.sql`. Ce dossier est indépendant des migrations existantes. Aucun identifiant de connexion ne doit être commité.

Pour le catalogue réel, importer les jeux par `(source, id_source)` avec `ON CONFLICT ... DO UPDATE` pour conserver leurs identifiants internes et les collections. Les identifiants fictifs `demo` ne sont pas ceux du futur catalogue : utiliser la même source réelle dès les 50 premières fiches pour éviter les doublons en phase 2.
