import sqlite3
import json
from datetime import datetime

DB_PATH = 'zbalo.db'

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()

    c.execute('''CREATE TABLE IF NOT EXISTS cultures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plante TEXT NOT NULL,
        variete TEXT,
        type TEXT,
        mode_semis TEXT,
        statut TEXT DEFAULT 'En cours',
        date TEXT,
        date_prevue TEXT,
        emplacement TEXT,
        surface REAL,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS entretiens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        type TEXT,
        zone TEXT,
        duree REAL,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS stocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        qte REAL DEFAULT 0,
        qte_max REAL DEFAULT 100,
        unite TEXT DEFAULT 'kg',
        prix REAL DEFAULT 0,
        fournisseur TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS ventes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        produit TEXT,
        qte REAL,
        prix_unit REAL,
        unite TEXT,
        client TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS depenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        fournisseur TEXT,
        categorie TEXT,
        total REAL,
        articles TEXT,  -- JSON array
        notes TEXT,
        scan_ai INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS rappels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        label TEXT,
        icon TEXT DEFAULT '📌',
        done INTEGER DEFAULT 0,
        auto INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS fiches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL UNIQUE,
        categorie TEXT,
        varietes TEXT,  -- JSON array
        temp_min REAL,
        temp_opt REAL,
        temp_max REAL,
        duree_germination INTEGER,
        duree_semis_repiquage INTEGER,
        duree_semis_recolte INTEGER,
        duree_repiquage_recolte INTEGER,
        espacement REAL,
        profondeur REAL,
        unite TEXT,
        notes TEXT
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS serres (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL UNIQUE
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )''')

    # Serres par défaut
    serres_default = ['Serre 1', 'Serre 2', 'Serre 3', 'Serre 4', 'Serre 5']
    for s in serres_default:
        c.execute('INSERT OR IGNORE INTO serres (nom) VALUES (?)', (s,))

    # Settings par défaut
    defaults = {
        'types_entretien': json.dumps(['Arrosage','Taille','Fertilisation','Désherbage',
            'Traitement bio','Buttage','Paillage','Récolte','Semis','Tuteurage',
            'Éclaircissage','Binage','Élevage','Autre']),
        'statuts_culture': json.dumps(['En cours','En attente','Terminé','Abandonné']),
        'categories_legume': json.dumps(['Fruit','Mini','Feuille','Racine','Herbe',
            'Brassica','Allium','Légumineuse','Élevage']),
        'unites_vente': json.dumps(['kg','pièce','botte','barquette','sachet',
            'pot','tête','graine','litre','caisse','douzaine']),
    }
    for k, v in defaults.items():
        c.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?,?)', (k, v))

    conn.commit()
    conn.close()

def row_to_dict(row):
    if row is None:
        return None
    return dict(row)

def rows_to_list(rows):
    return [dict(r) for r in rows]
