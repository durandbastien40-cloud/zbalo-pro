# ZBALO Pro — Application Maraîchage Bio

Application Flask pour la gestion d'une exploitation maraîchère bio.

## Structure

```
zbalo-pro/
├── app.py              # Serveur Flask principal
├── database.py         # SQLite — initialisation des tables
├── data_seed.py        # Base légumes Agrosemens (69 légumes)
├── requirements.txt
├── render.yaml         # Config déploiement Render.com
├── routes/
│   ├── cultures.py     # API cultures, entretiens, rappels
│   ├── stocks.py       # API stocks et ventes
│   ├── compta.py       # API dépenses + scan tickets IA
│   ├── assistant.py    # API chat IA avec actions DB
│   └── admin.py        # API fiches, serres, settings, stats
├── templates/
│   └── index.html      # Interface HTML (une seule page)
└── static/
    └── zbalo.js        # Frontend JavaScript
```

## Lancer en local

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY=ta_clé_ici
python app.py
```
Puis ouvre http://localhost:5000

## Déployer sur Render.com

1. Crée un compte sur https://github.com et mets ces fichiers dans un repo
2. Crée un compte sur https://render.com
3. "New Web Service" → connecte ton repo GitHub
4. Render détecte automatiquement render.yaml
5. Dans "Environment Variables" ajoute :
   - `ANTHROPIC_API_KEY` = ta clé API Anthropic
6. Clique Deploy → ton appli est en ligne en 3 minutes

## Fonctionnalités

- 🌱 Cultures — semis, plantations, récoltes avec suivi statuts
- 📋 Fiches légumes — base Agrosemens 69 légumes bio avec données techniques
- 🔔 Rappels — manuels et automatiques
- 🔧 Entretiens — arrosage, taille, fertilisation...
- 📦 Stocks — niveaux et alertes
- 💰 Ventes — suivi CA
- 📒 Comptabilité — dépenses + scan tickets par IA (photo → données extraites)
- 🤖 Assistant IA — chat + actions directes sur la base de données
- 📊 Historique — graphiques CA, cultures, entretiens
- ⚙️ Admin — gestion serres, fiches, menus déroulants
