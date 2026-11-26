BEGIN;
CREATE SCHEMA IF NOT EXISTS gamevault;
CREATE TABLE IF NOT EXISTS gamevault.jeux (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source text NOT NULL,
  id_source text NOT NULL,
  titre text NOT NULL,
  date_sortie date,
  description text,
  image_url text,
  UNIQUE (source, id_source)
);
CREATE TABLE IF NOT EXISTS gamevault.genres (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nom text NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS gamevault.jeu_genres (
  jeu_id bigint REFERENCES gamevault.jeux(id),
  genre_id bigint REFERENCES gamevault.genres(id),
  PRIMARY KEY (jeu_id, genre_id)
);
CREATE TABLE IF NOT EXISTS gamevault.joueurs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pseudo text NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS gamevault.collections (
  joueur_id bigint REFERENCES gamevault.joueurs(id),
  jeu_id bigint REFERENCES gamevault.jeux(id),
  ajoute_le timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (joueur_id, jeu_id)
);
COMMIT;
