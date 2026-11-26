INSERT IGNORE INTO genres (nom) VALUES
  ('Action'), ('Aventure'), ('Course'), ('FPS'), ('Horreur'), ('Plateforme'),
  ('Puzzle'), ('RPG'), ('Sandbox'), ('Simulation'), ('Stratégie');

INSERT IGNORE INTO jeux (source, id_source, titre) VALUES
  ('manuel', 'elden-ring', 'Elden Ring'),
  ('manuel', 'forza-horizon-5', 'Forza Horizon 5'),
  ('manuel', 'resident-evil-4', 'Resident Evil 4'),
  ('manuel', 'minecraft', 'Minecraft'),
  ('manuel', 'valorant', 'Valorant'),
  ('manuel', 'the-witcher-3', 'The Witcher 3: Wild Hunt'),
  ('manuel', 'hollow-knight', 'Hollow Knight'),
  ('manuel', 'silent-hill-2', 'Silent Hill 2'),
  ('manuel', 'portal-2', 'Portal 2'),
  ('manuel', 'celeste', 'Celeste'),
  ('manuel', 'black-desert-online', 'Black Desert Online'),
  ('manuel', 'gran-turismo-7', 'Gran Turismo 7'),
  ('manuel', 'dark-souls', 'Dark Souls'),
  ('manuel', 'doom-eternal', 'DOOM Eternal'),
  ('manuel', 'civilization-vi', 'Sid Meier''s Civilization VI'),
  ('manuel', 'stardew-valley', 'Stardew Valley'),
  ('manuel', 'hades', 'Hades'),
  ('manuel', 'outlast', 'Outlast'),
  ('manuel', 'alien-isolation', 'Alien: Isolation'),
  ('manuel', 'mario-kart-8-deluxe', 'Mario Kart 8 Deluxe');

INSERT IGNORE INTO jeu_genres (jeu_id, genre_id)
SELECT j.id, g.id
FROM (
  SELECT 'elden-ring' AS code, 'RPG' AS genre
  UNION ALL SELECT 'elden-ring', 'Action'
  UNION ALL SELECT 'forza-horizon-5', 'Course'
  UNION ALL SELECT 'resident-evil-4', 'Horreur'
  UNION ALL SELECT 'resident-evil-4', 'Action'
  UNION ALL SELECT 'minecraft', 'Sandbox'
  UNION ALL SELECT 'minecraft', 'Aventure'
  UNION ALL SELECT 'valorant', 'FPS'
  UNION ALL SELECT 'the-witcher-3', 'RPG'
  UNION ALL SELECT 'the-witcher-3', 'Aventure'
  UNION ALL SELECT 'hollow-knight', 'Plateforme'
  UNION ALL SELECT 'hollow-knight', 'Aventure'
  UNION ALL SELECT 'silent-hill-2', 'Horreur'
  UNION ALL SELECT 'portal-2', 'Puzzle'
  UNION ALL SELECT 'celeste', 'Plateforme'
  UNION ALL SELECT 'black-desert-online', 'RPG'
  UNION ALL SELECT 'gran-turismo-7', 'Course'
  UNION ALL SELECT 'gran-turismo-7', 'Simulation'
  UNION ALL SELECT 'dark-souls', 'RPG'
  UNION ALL SELECT 'dark-souls', 'Action'
  UNION ALL SELECT 'doom-eternal', 'FPS'
  UNION ALL SELECT 'doom-eternal', 'Action'
  UNION ALL SELECT 'civilization-vi', 'Stratégie'
  UNION ALL SELECT 'stardew-valley', 'Simulation'
  UNION ALL SELECT 'hades', 'Action'
  UNION ALL SELECT 'outlast', 'Horreur'
  UNION ALL SELECT 'alien-isolation', 'Horreur'
  UNION ALL SELECT 'mario-kart-8-deluxe', 'Course'
) AS m
JOIN jeux j ON j.source = 'manuel' AND j.id_source = m.code
JOIN genres g ON g.nom = m.genre;
