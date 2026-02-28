import json
import anthropic
from datetime import datetime
from flask import Blueprint, request, jsonify
from database import get_db, rows_to_list

bp = Blueprint('assistant', __name__)

def get_context():
    """Construit le contexte de l'exploitation pour le prompt IA"""
    db = get_db()
    cultures = rows_to_list(db.execute("SELECT * FROM cultures WHERE statut='En cours'").fetchall())
    stocks_low = rows_to_list(db.execute(
        "SELECT * FROM stocks WHERE qte_max > 0 AND CAST(qte AS REAL)/CAST(qte_max AS REAL) < 0.3"
    ).fetchall())
    serres = [r['nom'] for r in db.execute('SELECT nom FROM serres ORDER BY nom').fetchall()]
    rappels = rows_to_list(db.execute(
        "SELECT * FROM rappels WHERE done=0 AND date <= date('now','+7 days') ORDER BY date"
    ).fetchall())
    db.close()

    now = datetime.now()
    mois = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet',
            'Août','Septembre','Octobre','Novembre','Décembre']
    saisons = ['Hiver','Hiver','Printemps','Printemps','Printemps','Été',
               'Été','Été','Automne','Automne','Automne','Hiver']

    cultures_str = ' | '.join([
        f"{c['plante']}{(' ('+c['variete']+')') if c['variete'] else ''} en {c['emplacement']}"
        for c in cultures
    ]) or 'aucune'

    return f"""Tu es l'assistant maraîchage bio de ZBALO Pro, exploitation en Bretagne/Pays de Loire.
Tu tutoies l'utilisateur. Tu es expert en maraîchage bio, permaculture, associations de plantes.
Tu réponds en français, de façon concise et pratique.

═══ EXPLOITATION ═══
Date : {now.strftime('%d/%m/%Y')} — {mois[now.month-1]} {now.year}
Saison : {saisons[now.month-1]}
Serres : {', '.join(serres)}
Cultures en cours ({len(cultures)}) : {cultures_str}
Stocks bas : {', '.join([s['nom'] for s in stocks_low]) or 'aucun'}
Rappels urgents (7j) : {', '.join([r['label'] for r in rappels]) or 'aucun'}

═══ ASSOCIATIONS BIO ═══
✅ Tomate ↔ Basilic, Carotte, Persil, Œillet d'Inde
❌ Tomate ✗ Fenouil, Chou, Pomme de terre
✅ Courgette ↔ Haricot, Capucine, Maïs
✅ Carotte ↔ Poireau, Oignon, Salade
✅ Aubergine ↔ Basilic, Poivron, Haricot

═══ ACTIONS DISPONIBLES ═══
Si l'utilisateur demande d'agir sur l'appli, inclus un JSON d'action entouré de ###.
Format : ###{{"action":"NOM", ...paramètres...}}###

Actions :
- Créer culture : ###{{"action":"ADD_CULTURE","plante":"Tomate","variete":"Cœur de bœuf","type":"semis","modeSemis":"godet","emplacement":"Serre 1","date":"{now.strftime('%Y-%m-%d')}"}}###
- Supprimer culture : ###{{"action":"DELETE_CULTURE","id":123}}###
- Ajouter serre : ###{{"action":"ADD_SERRE","nom":"Serre 6"}}###
- Créer rappel : ###{{"action":"ADD_RAPPEL","label":"Arroser serre 2","date":"{now.strftime('%Y-%m-%d')}"}}###
- Ajouter stock : ###{{"action":"ADD_STOCK","nom":"Graines basilic","qte":50,"unite":"graine"}}###
- Ajouter entretien : ###{{"action":"ADD_ENTRETIEN","type":"Arrosage","zone":"Serre 1","duree":1,"description":"Arrosage hebdo"}}###

Annonce toujours ce que tu fais avant le JSON.
"""

@bp.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    messages = data.get('messages', [])
    if not messages:
        return jsonify({'error': 'Messages manquants'}), 400

    try:
        client = anthropic.Anthropic()
        response = client.messages.create(
            model='claude-sonnet-4-20250514',
            max_tokens=1000,
            system=get_context(),
            messages=messages
        )
        reply = response.content[0].text

        # Extraire et exécuter les actions
        actions_done = []
        import re
        matches = re.findall(r'###(\{[^#]+\})###', reply)
        for match in matches:
            try:
                action = json.loads(match)
                result = execute_action(action)
                if result:
                    actions_done.append(result)
            except:
                pass

        return jsonify({
            'reply': reply,
            'actions': actions_done
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

def execute_action(action):
    db = get_db()
    name = action.get('action')
    today = datetime.now().strftime('%Y-%m-%d')

    try:
        if name == 'ADD_CULTURE':
            db.execute('''INSERT INTO cultures (plante, variete, type, mode_semis, statut, date, emplacement, notes)
                         VALUES (?,?,?,?,?,?,?,?)''',
                (action.get('plante'), action.get('variete'), action.get('type','semis'),
                 action.get('modeSemis','godet'), 'En cours',
                 action.get('date', today), action.get('emplacement'),
                 '🤖 Créé par assistant IA'))
            db.commit()
            return {'action': 'ADD_CULTURE', 'message': f"Culture {action.get('plante')} ajoutée"}

        elif name == 'DELETE_CULTURE':
            db.execute('DELETE FROM cultures WHERE id=?', (action.get('id'),))
            db.commit()
            return {'action': 'DELETE_CULTURE', 'message': 'Culture supprimée'}

        elif name == 'ADD_SERRE':
            nom = action.get('nom')
            db.execute('INSERT OR IGNORE INTO serres (nom) VALUES (?)', (nom,))
            db.commit()
            return {'action': 'ADD_SERRE', 'message': f'Serre {nom} ajoutée'}

        elif name == 'ADD_RAPPEL':
            db.execute('INSERT INTO rappels (date, label, icon) VALUES (?,?,?)',
                (action.get('date', today), action.get('label'), '🤖'))
            db.commit()
            return {'action': 'ADD_RAPPEL', 'message': 'Rappel créé'}

        elif name == 'ADD_STOCK':
            db.execute('INSERT INTO stocks (nom, qte, qte_max, unite) VALUES (?,?,?,?)',
                (action.get('nom'), action.get('qte',0), 100, action.get('unite','kg')))
            db.commit()
            return {'action': 'ADD_STOCK', 'message': f"Stock {action.get('nom')} ajouté"}

        elif name == 'ADD_ENTRETIEN':
            db.execute('INSERT INTO entretiens (date, type, zone, duree, description) VALUES (?,?,?,?,?)',
                (action.get('date', today), action.get('type'), action.get('zone'),
                 action.get('duree'), action.get('description')))
            db.commit()
            return {'action': 'ADD_ENTRETIEN', 'message': 'Entretien enregistré'}

    except Exception as e:
        return {'action': name, 'error': str(e)}
    finally:
        db.close()

    return None
