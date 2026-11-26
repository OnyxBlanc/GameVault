BEGIN;
INSERT INTO gamevault.jeux (source, id_source, titre) VALUES
  ('demo', 'elden-ring', 'Elden Ring'),
  ('demo', 'forza-horizon-5', 'Forza Horizon 5')
ON CONFLICT (source, id_source) DO NOTHING;
INSERT INTO gamevault.genres (nom) VALUES ('RPG'), ('Course') ON CONFLICT DO NOTHING;
INSERT INTO gamevault.jeu_genres (jeu_id, genre_id)
SELECT j.id, g.id FROM gamevault.jeux j
JOIN (VALUES ('elden-ring', 'RPG'), ('forza-horizon-5', 'Course')) AS v(code, genre) ON j.id_source = v.code
JOIN gamevault.genres g ON g.nom = v.genre
WHERE j.source = 'demo'
ON CONFLICT DO NOTHING;
INSERT INTO gamevault.joueurs (pseudo) VALUES ('Demo') ON CONFLICT DO NOTHING;
INSERT INTO gamevault.collections (joueur_id, jeu_id)
SELECT p.id, j.id FROM gamevault.joueurs p CROSS JOIN gamevault.jeux j
WHERE p.pseudo = 'Demo' AND j.source = 'demo' AND j.id_source = 'elden-ring'
ON CONFLICT DO NOTHING;
COMMIT;
