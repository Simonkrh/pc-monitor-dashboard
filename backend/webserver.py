from flask import Flask, send_from_directory

app = Flask(__name__, static_folder='../frontend/static')

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/spotify.html')
def spotify():
    return send_from_directory(app.static_folder, 'spotify.html')

@app.route('/macro.html')
def macro():
    return send_from_directory(app.static_folder, 'macro.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
