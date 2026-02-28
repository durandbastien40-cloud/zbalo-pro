import json
import anthropic
from flask import Blueprint, request, jsonify
from database import get_db, rows_to_list, row_to_dict

bp = Blueprint('compta', __name__)

@bp.route('/api/depenses', methods=['GET'])
def get_depenses():
    db = get_db()
    depenses = rows_to_list(db.execute('SELECT * FROM depenses ORDER BY date DESC').fetchall())
    db.close()
    # Parse articles JSON
    for d in depenses:
        try:
            d['articles'] = json.loads(d['articles']) if d['articles'] else []
        except:
            d['articles'] = []
    return jsonify(depenses)

@bp.route('/api/depenses', methods=['POST'])
def add_depense():
    data = request.json
    db = get_db()
    articles_json = json.dumps(data.get('articles', []))
    db.execute('''INSERT INTO depenses (date, fournisseur, categorie, total, articles, notes, scan_ai)
                  VALUES (?,?,?,?,?,?,?)''',
        (data.get('date'), data.get('fournisseur'), data.get('categorie'),
         data.get('total', 0), articles_json, data.get('notes'), 1 if data.get('scanAI') else 0))
    db.commit()
    id_ = db.execute('SELECT last_insert_rowid()').fetchone()[0]
    row = row_to_dict(db.execute('SELECT * FROM depenses WHERE id=?', (id_,)).fetchone())
    row['articles'] = json.loads(row['articles']) if row['articles'] else []
    db.close()
    return jsonify(row), 201

@bp.route('/api/depenses/<int:id>', methods=['PUT'])
def update_depense(id):
    data = request.json
    db = get_db()
    articles_json = json.dumps(data.get('articles', []))
    db.execute('''UPDATE depenses SET date=?, fournisseur=?, categorie=?, total=?, articles=?, notes=? WHERE id=?''',
        (data.get('date'), data.get('fournisseur'), data.get('categorie'),
         data.get('total'), articles_json, data.get('notes'), id))
    db.commit()
    row = row_to_dict(db.execute('SELECT * FROM depenses WHERE id=?', (id,)).fetchone())
    row['articles'] = json.loads(row['articles']) if row['articles'] else []
    db.close()
    return jsonify(row)

@bp.route('/api/depenses/<int:id>', methods=['DELETE'])
def delete_depense(id):
    db = get_db()
    db.execute('DELETE FROM depenses WHERE id=?', (id,))
    db.commit()
    db.close()
    return jsonify({'ok': True})

# ── SCAN TICKET IA ──
@bp.route('/api/scan-ticket', methods=['POST'])
def scan_ticket():
    data = request.json
    image_data = data.get('image')   # base64
    media_type = data.get('mediaType', 'image/jpeg')

    if not image_data:
        return jsonify({'error': 'Image manquante'}), 400

    try:
        client = anthropic.Anthropic()
        message = client.messages.create(
            model='claude-sonnet-4-20250514',
            max_tokens=800,
            messages=[{
                'role': 'user',
                'content': [
                    {
                        'type': 'image',
                        'source': {
                            'type': 'base64',
                            'media_type': media_type,
                            'data': image_data
                        }
                    },
                    {
                        'type': 'text',
                        'text': '''Analyse ce ticket de caisse ou cette facture pour un maraîcher bio.
Retourne UNIQUEMENT un JSON valide avec ces champs :
{
  "date": "YYYY-MM-DD",
  "fournisseur": "nom du magasin ou fournisseur",
  "categorie": "une parmi : Graines & semences | Terreau & substrat | Matériel & outillage | Engrais & traitement | Élevage & animaux | Énergie & eau | Autre",
  "total": montant_numerique,
  "articles": ["Article 1 — prix€", "Article 2 — prix€"],
  "notes": "info utile ou null"
}
Si une info est illisible mets null. UNIQUEMENT le JSON, rien d'autre.'''
                    }
                ]
            }]
        )

        text = message.content[0].text.strip()
        # Nettoyer les balises markdown si présentes
        text = text.replace('```json', '').replace('```', '').strip()
        extracted = json.loads(text)
        return jsonify({'ok': True, 'data': extracted})

    except json.JSONDecodeError:
        return jsonify({'error': 'Impossible de lire la réponse IA', 'raw': text}), 422
    except Exception as e:
        return jsonify({'error': str(e)}), 500
