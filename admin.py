import json
from flask import Blueprint, request, jsonify
from database import get_db, rows_to_list, row_to_dict

bp = Blueprint('admin', __name__)

# ── FICHES LÉGUMES ──
@bp.route('/api/fiches', methods=['GET'])
def get_fiches():
    db = get_db()
    fiches = rows_to_list(db.execute('SELECT * FROM fiches ORDER BY nom').fetchall())
    db.close()
    for f in fiches:
        try:
            f['varietes'] = json.loads(f['varietes']) if f['varietes'] else []
        except:
            f['varietes'] = []
    return jsonify(fiches)

@bp.route('/api/fiches', methods=['POST'])
def add_fiche():
    data = request.json
    db = get_db()
    db.execute('''INSERT OR REPLACE INTO fiches
        (nom, categorie, varietes, temp_min, temp_opt, temp_max, duree_germination,
         duree_semis_repiquage, duree_semis_recolte, duree_repiquage_recolte,
         espacement, profondeur, unite, notes)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
        (data.get('nom'), data.get('categorie'),
         json.dumps(data.get('varietes', [])),
         data.get('tempMin'), data.get('tempOpt'), data.get('tempMax'),
         data.get('dureeGermination'), data.get('dureeSemisRepiquage'),
         data.get('dureeSemisRecolte'), data.get('dureeRepiquageRecolte'),
         data.get('espacement'), data.get('profondeur'),
         data.get('unite'), data.get('notes')))
    db.commit()
    id_ = db.execute('SELECT last_insert_rowid()').fetchone()[0]
    row = row_to_dict(db.execute('SELECT * FROM fiches WHERE id=?', (id_,)).fetchone())
    row['varietes'] = json.loads(row['varietes']) if row['varietes'] else []
    db.close()
    return jsonify(row), 201

@bp.route('/api/fiches/<int:id>', methods=['PUT'])
def update_fiche(id):
    data = request.json
    db = get_db()
    db.execute('''UPDATE fiches SET nom=?, categorie=?, varietes=?, temp_min=?, temp_opt=?,
        temp_max=?, duree_germination=?, duree_semis_repiquage=?, duree_semis_recolte=?,
        duree_repiquage_recolte=?, espacement=?, profondeur=?, unite=?, notes=? WHERE id=?''',
        (data.get('nom'), data.get('categorie'),
         json.dumps(data.get('varietes', [])),
         data.get('tempMin'), data.get('tempOpt'), data.get('tempMax'),
         data.get('dureeGermination'), data.get('dureeSemisRepiquage'),
         data.get('dureeSemisRecolte'), data.get('dureeRepiquageRecolte'),
         data.get('espacement'), data.get('profondeur'),
         data.get('unite'), data.get('notes'), id))
    db.commit()
    row = row_to_dict(db.execute('SELECT * FROM fiches WHERE id=?', (id,)).fetchone())
    row['varietes'] = json.loads(row['varietes']) if row['varietes'] else []
    db.close()
    return jsonify(row)

@bp.route('/api/fiches/<int:id>', methods=['DELETE'])
def delete_fiche(id):
    db = get_db()
    db.execute('DELETE FROM fiches WHERE id=?', (id,))
    db.commit()
    db.close()
    return jsonify({'ok': True})

# ── SERRES ──
@bp.route('/api/serres', methods=['GET'])
def get_serres():
    db = get_db()
    serres = [r['nom'] for r in db.execute('SELECT nom FROM serres ORDER BY nom').fetchall()]
    db.close()
    return jsonify(serres)

@bp.route('/api/serres', methods=['POST'])
def add_serre():
    data = request.json
    nom = data.get('nom', '').strip()
    if not nom:
        return jsonify({'error': 'Nom requis'}), 400
    db = get_db()
    db.execute('INSERT OR IGNORE INTO serres (nom) VALUES (?)', (nom,))
    db.commit()
    db.close()
    return jsonify({'ok': True, 'nom': nom}), 201

@bp.route('/api/serres/<nom>', methods=['DELETE'])
def delete_serre(nom):
    db = get_db()
    db.execute('DELETE FROM serres WHERE nom=?', (nom,))
    db.commit()
    db.close()
    return jsonify({'ok': True})

# ── SETTINGS (menus déroulants) ──
@bp.route('/api/settings', methods=['GET'])
def get_settings():
    db = get_db()
    rows = db.execute('SELECT key, value FROM settings').fetchall()
    db.close()
    result = {}
    for r in rows:
        try:
            result[r['key']] = json.loads(r['value'])
        except:
            result[r['key']] = r['value']
    return jsonify(result)

@bp.route('/api/settings/<key>', methods=['PUT'])
def update_setting(key):
    data = request.json
    value = data.get('value')
    db = get_db()
    db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)',
               (key, json.dumps(value)))
    db.commit()
    db.close()
    return jsonify({'ok': True})

# ── STATS DASHBOARD ──
@bp.route('/api/stats', methods=['GET'])
def get_stats():
    db = get_db()
    from datetime import datetime
    now = datetime.now()
    month_start = now.strftime('%Y-%m-01')

    stats = {
        'cultures_actives': db.execute(
            "SELECT COUNT(*) as n FROM cultures WHERE statut='En cours'"
        ).fetchone()['n'],
        'rappels_pending': db.execute(
            "SELECT COUNT(*) as n FROM rappels WHERE done=0 AND date <= date('now','+14 days')"
        ).fetchone()['n'],
        'fiches_total': db.execute('SELECT COUNT(*) as n FROM fiches').fetchone()['n'],
        'ca_mois': db.execute(
            "SELECT COALESCE(SUM(qte*prix_unit),0) as total FROM ventes WHERE date >= ?",
            (month_start,)
        ).fetchone()['total'],
        'stock_alertes': db.execute(
            "SELECT COUNT(*) as n FROM stocks WHERE qte_max > 0 AND CAST(qte AS REAL)/CAST(qte_max AS REAL) < 0.3"
        ).fetchone()['n'],
    }
    db.close()
    return jsonify(stats)
