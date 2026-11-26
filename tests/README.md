# Vérifications GameVault

- Vérifier que la vitrine et ses styles se chargent sur InfinityFree.
- Vérifier que `GET /api/index.php` donne 200 après import et configuration MySQL ; vérifier un 503 sans configuration dans un environnement de test. Un POST doit donner 405.
- Vérifier que le transfert n’envoie ni scripts SQL, ni configuration locale, ni tests.
- Quand les boosters et le marché seront implémentés, tester qu’un tirage n’ajoute pas de crédits, qu’un doublon augmente la quantité et qu’une vente transfère l’exemplaire et les crédits dans une seule transaction.
