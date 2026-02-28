from flask import Blueprint, request, jsonify
from database import get_db, rows_to_list, row_to_dict

bp = Blueprint('stocks', __name__)

# ── STOCKS ──
@bp.route('/api/stocks', methods=['GET'])
def get_stocks():
    db = get_db()
    stocks = rows_to_list(db.execute('SELECT * FROM stocks ORDER BY nom').fetchall())
    db.close()
    return jsonify(stocks)

@bp.route('/api/stocks', methods=['POST'])
def add_stock():
    data = request.json
    db = get_db()
    db.execute('INSERT INTO stocks (nom, qte, qte_max, unite, prix, fournisseur) VALUES (?,?,?,?,?,?)',
        (data.get('nom'), data.get('qte',0), data.get('qteMax',100),
         data.get('unite','kg'), data.get('prix',0), data.get('fournisseur')))
    db.commit()
    id_ = db.execute('SELECT last_insert_rowid()').fetchone()[0]
    row = row_to_dict(db.execute('SELECT * FROM stocks WHERE id=?', (id_,)).fetchone())
    db.close()
    return jsonify(row), 201

@bp.route('/api/stocks/<int:id>', methods=['PUT'])
def update_stock(id):
    data = request.json
    db = get_db()
    db.execute('UPDATE stocks SET nom=?, qte=?, qte_max=?, unite=?, prix=?, fournisseur=? WHERE id=?',
        (data.get('nom'), data.get('qte'), data.get('qteMax'),
         data.get('unite'), data.get('prix'), data.get('fournisseur'), id))
    db.commit()
    row = row_to_dict(db.execute('SELECT * FROM stocks WHERE id=?', (id,)).fetchone())
    db.close()
    return jsonify(row)

@bp.route('/api/stocks/<int:id>', methods=['DELETE'])
def delete_stock(id):
    db = get_db()
    db.execute('DELETE FROM stocks WHERE id=?', (id,))
    db.commit()
    db.close()
    return jsonify({'ok': True})

# ── VENTES ──
@bp.route('/api/ventes', methods=['GET'])
def get_ventes():
    db = get_db()
    ventes = rows_to_list(db.execute('SELECT * FROM ventes ORDER BY date DESC').fetchall())
    db.close()
    return jsonify(ventes)

@bp.route('/api/ventes', methods=['POST'])
def add_vente():
    data = request.json
    db = get_db()
    db.execute('INSERT INTO ventes (date, produit, qte, prix_unit, unite, client) VALUES (?,?,?,?,?,?)',
        (data.get('date'), data.get('produit'), data.get('qte'),
         data.get('prixUnit'), data.get('unite'), data.get('client')))
    db.commit()
    id_ = db.execute('SELECT last_insert_rowid()').fetchone()[0]
    row = row_to_dict(db.execute('SELECT * FROM ventes WHERE id=?', (id_,)).fetchone())
    db.close()
    return jsonify(row), 201

@bp.route('/api/ventes/<int:id>', methods=['DELETE'])
def delete_vente(id):
    db = get_db()
    db.execute('DELETE FROM ventes WHERE id=?', (id,))
    db.commit()
    db.close()
    return jsonify({'ok': True})
