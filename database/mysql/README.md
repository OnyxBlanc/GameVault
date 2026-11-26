# GameVault sur InfinityFree

Importer `schema.sql` dans une base MySQL/MariaDB de test sélectionnée dans phpMyAdmin. Le FTP déploie le site et le PHP, pas la base. Une fiche représente un jeu vidéo, avec sa jaquette en URL.

## Collection et crédits

- Un tirage ajoute un exemplaire à la collection, que le jeu soit nouveau ou déjà possédé. Il ne crédite jamais le joueur.
- Une revente de doublon au jeu nécessite au moins deux exemplaires. La vente retire un exemplaire et crédite le joueur. Les modalités de rachat restent à définir.
- Publier une annonce ne donne aucun crédit. Lors d’une vente entre joueurs, le serveur vérifie le stock et le solde, transfère un exemplaire à l’acheteur et transfère les crédits au vendeur, dans une seule transaction. Si le dernier exemplaire peut être vendu, supprimer la ligne de collection au lieu de mettre sa quantité à zéro.
- Le PHP renvoie les valeurs confirmées par la base pour que le front puisse actualiser la collection et le solde sans recharger la page ni interroger le serveur en boucle.

Le workflow FTPS est documenté dans le README principal. Les annonces du marché et les routes PHP métier restent à implémenter.
