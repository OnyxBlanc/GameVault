#!/usr/bin/env python3
"""Genere un fichier SQL (jeux, genres, images) depuis l'API RAWG.

Usage : RAWG_API_KEY=xxx python3 tools/import_rawg.py [nombre] [sortie.sql] [--garder-manuel]
Importer ensuite le fichier avec phpMyAdmin. Ne jamais commiter la cle ni le SQL genere.
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

GENRES_FR = {
    'Action': 'Action', 'Adventure': 'Aventure', 'RPG': 'RPG', 'Strategy': 'Stratégie',
    'Shooter': 'Tir', 'Casual': 'Casual', 'Simulation': 'Simulation', 'Puzzle': 'Puzzle',
    'Arcade': 'Arcade', 'Platformer': 'Plateforme', 'Racing': 'Course',
    'Massively Multiplayer': 'MMO', 'Sports': 'Sport', 'Fighting': 'Combat',
    'Family': 'Famille', 'Board Games': 'Jeu de société', 'Educational': 'Éducatif',
    'Card': 'Cartes', 'Indie': 'Indépendant',
}


def esc(value):
    return "'" + str(value).replace('\\', '\\\\').replace("'", "''") + "'"


def fetch_page(key, page):
    query = urllib.parse.urlencode({'key': key, 'page': page, 'page_size': 40, 'ordering': '-added'})
    request = urllib.request.Request('https://api.rawg.io/api/games?' + query, headers={'User-Agent': 'GameVault-import'})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    keep_manual = '--garder-manuel' in sys.argv
    key = os.environ.get('RAWG_API_KEY', '')
    if not key:
        sys.exit('Definis RAWG_API_KEY dans ton terminal.')
    total = int(args[0]) if args else 500
    out = args[1] if len(args) > 1 else os.path.expanduser('~/gamevault_catalogue.sql')

    games = {}
    page = 1
    while len(games) < total:
        try:
            data = fetch_page(key, page)
        except Exception as error:
            print('Arret page', page, ':', error)
            break
        for item in data.get('results', []):
            games[item['id']] = item
        if not data.get('next'):
            break
        page += 1
        time.sleep(0.3)
    games = list(games.values())[:total]
    if not games:
        sys.exit('Aucun jeu recupere.')

    lines = ['SET NAMES utf8mb4;']
    if not keep_manual:
        owned = 'SELECT jeu_id FROM collections'
        lines.append("DELETE FROM jeu_genres WHERE jeu_id IN (SELECT id FROM jeux WHERE source='manuel' AND id NOT IN (%s));" % owned)
        lines.append("DELETE FROM jeux WHERE source='manuel' AND id NOT IN (%s);" % owned)

    names = sorted({GENRES_FR.get(g['name'], g['name']) for x in games for g in x.get('genres', [])})
    if names:
        lines.append('INSERT IGNORE INTO genres (nom) VALUES ' + ', '.join('(%s)' % esc(n) for n in names) + ';')

    rows = []
    for x in games:
        image = x.get('background_image') or ''
        image = image if image.startswith('https://') else None
        released = x.get('released') or None
        rows.append('(%s, %s, %s, %s, %s)' % (
            esc('rawg'), esc(x['id']), esc(x['name'][:255]),
            esc(released) if released else 'NULL', esc(image) if image else 'NULL'))
    for i in range(0, len(rows), 100):
        lines.append('INSERT INTO jeux (source, id_source, titre, date_sortie, image_url) VALUES ' + ', '.join(rows[i:i + 100]) +
                     ' ON DUPLICATE KEY UPDATE titre=VALUES(titre), date_sortie=VALUES(date_sortie), image_url=VALUES(image_url);')

    links = []
    for x in games:
        for g in x.get('genres', []):
            links.append('SELECT %s AS code, %s AS genre' % (esc(x['id']), esc(GENRES_FR.get(g['name'], g['name']))))
    for i in range(0, len(links), 200):
        lines.append('INSERT IGNORE INTO jeu_genres (jeu_id, genre_id) SELECT j.id, g.id FROM (' + ' UNION ALL '.join(links[i:i + 200]) +
                     ") AS m JOIN jeux j ON j.source='rawg' AND j.id_source=m.code JOIN genres g ON g.nom=m.genre;")

    with open(out, 'w', encoding='utf-8') as handle:
        handle.write('\n'.join(lines) + '\n')
    print(len(games), 'jeux ecrits dans', out)


if __name__ == '__main__':
    main()
