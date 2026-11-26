ALTER TABLE jeux ADD COLUMN rarete VARCHAR(16) NOT NULL DEFAULT 'commun';
ALTER TABLE jeux ADD KEY idx_jeux_rarete (rarete);
