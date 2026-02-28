from flask import Blueprint, request, jsonify
from database import get_db, rows_to_list, row_to_dict

bp = Blueprint('cultures', __name__)

@bp.route('/api/cultures', methods=['GET'])
def get_cultures():
    db = get_db()
    cultures = rows_to_list(db.execute('SELECT * FROM cultures ORDER BY date DESC').fetchall())
    db.close()
    return jsonify(cultures)

@bp.route('/api/cultures', methods=['POST'])
def add_culture():
    data = request.json
    db = get_db()
    db.execute('''INSERT INTO cultures (plante, variete, type, mode_semis, statut, date, date_prevue, emplacement, surface, notes)
                  VALUES (?,?,?,?,?,?,?,?,?,?)''',
        (data.get('plante'), data.get('variete'), data.get('type'), data.get('modeSemis'),
         data.get('statut','En cours'), data.get('date'), data.get('datePrevue'),
         data.get('emplacement'), data.get('surface'), data.get('notes')))
    db.commit()
    id_ = db.execute('SELECT last_insert_rowid()').fetchone()[0]
    culture = row_to_dict(db.execute('SELECT * FROM cultures WHERE id=?', (id_,)).fetchone())
    db.close()
    return jsonify(culture), 201

@bp.route('/api/cultures/<int:id>', methods=['PUT'])
def update_culture(id):
    data = request.json
    db = get_db()
    db.execute('''UPDATE cultures SET plante=?, variete=?, type=?, mode_semis=?, statut=?,
                  date=?, date_prevue=?, emplacement=?, surface=?, notes=? WHERE id=?''',
        (data.get('plante'), data.get('variete'), data.get('type'), data.get('modeSemis'),
         data.get('statut'), data.get('date'), data.get('datePrevue'),
         data.get('emplacement'), data.get('surface'), data.get('notes'), id))
    db.commit()
    culture = row_to_dict(db.execute('SELECT * FROM cultures WHERE id=?', (id,)).fetchone())
    db.close()
    return jsonify(culture)

@bp.route('/api/cultures/<int:id>', methods=['DELETE'])
def delete_culture(id):
    db = get_db()
    db.execute('DELETE FROM cultures WHERE id=?', (id,))
    db.commit()
    db.close()
    return jsonify({'ok': True})

# ── ENTRETIENS ──
@bp.route('/api/entretiens', methods=['GET'])
def get_entretiens():
    db = get_db()
    entretiens = rows_to_list(db.execute('SELECT * FROM entretiens ORDER BY date DESC').fetchall())
    db.close()
    return jsonify(entretiens)

@bp.route('/api/entretiens', methods=['POST'])
def add_entretien():
    data = request.json
    db = get_db()
    db.execute('INSERT INTO entretiens (date, type, zone, duree, description) VALUES (?,?,?,?,?)',
        (data.get('date'), data.get('type'), data.get('zone'),
         data.get('duree'), data.get('description')))
    db.commit()
    id_ = db.execute('SELECT last_insert_rowid()').fetchone()[0]
    row = row_to_dict(db.execute('SELECT * FROM entretiens WHERE id=?', (id_,)).fetchone())
    db.close()
    return jsonify(row), 201

@bp.route('/api/entretiens/<int:id>', methods=['DELETE'])
def delete_entretien(id):
    db = get_db()
    db.execute('DELETE FROM entretiens WHERE id=?', (id,))
    db.commit()
    db.close()
    return jsonify({'ok': True})

# ── RAPPELS ──
@bp.route('/api/rappels', methods=['GET'])
def get_rappels():
    db = get_db()
    rappels = rows_to_list(db.execute('SELECT * FROM rappels WHERE done=0 ORDER BY date ASC').fetchall())
    db.close()
    return jsonify(rappels)

@bp.route('/api/rappels', methods=['POST'])
def add_rappel():
    data = request.json
    db = get_db()
    db.execute('INSERT INTO rappels (date, label, icon) VALUES (?,?,?)',
        (data.get('date'), data.get('label'), data.get('icon','📌')))
    db.commit()
    id_ = db.execute('SELECT last_insert_rowid()').fetchone()[0]
    row = row_to_dict(db.execute('SELECT * FROM rappels WHERE id=?', (id_,)).fetchone())
    db.close()
    return jsonify(row), 201

@bp.route('/api/rappels/<int:id>/done', methods=['POST'])
def mark_done(id):
    db = get_db()
    db.execute('UPDATE rappels SET done=1 WHERE id=?', (id,))
    db.commit()
    db.close()
    return jsonify({'ok': True})

@bp.route('/api/rappels/<int:id>', methods=['DELETE'])
def delete_rappel(id):
    db = get_db()
    db.execute('DELETE FROM rappels WHERE id=?', (id,))
    db.commit()
    db.close()
    return jsonify({'ok': True})
