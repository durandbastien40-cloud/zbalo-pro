import os
from flask import Flask, render_template, send_from_directory
from database import init_db
from data_seed import seed_fiches

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'zbalo-dev-key-changeme')

# Enregistrer les routes
from routes.cultures import bp as cultures_bp
from routes.stocks import bp as stocks_bp
from routes.compta import bp as compta_bp
from routes.assistant import bp as assistant_bp
from routes.admin import bp as admin_bp

app.register_blueprint(cultures_bp)
app.register_blueprint(stocks_bp)
app.register_blueprint(compta_bp)
app.register_blueprint(assistant_bp)
app.register_blueprint(admin_bp)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/<path:path>')
def static_files(path):
    return send_from_directory('static', path)

if __name__ == '__main__':
    init_db()
    seed_fiches()
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)
