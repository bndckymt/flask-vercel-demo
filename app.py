
from flask import Flask, jsonify

app = Flask(__name__)


@app.route("/")
def home():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>My First Vercel App</title>
    </head>
    <body style="font-family: Arial; text-align: center; margin-top: 100px;">
        <h1>Hello from Flask!</h1>
        <p>My first Python application is ready for Vercel.</p>
    </body>
    </html>
    """


@app.route("/api/hello")
def hello():
    return jsonify({
        "message": "Hello from my Flask API!",
        "status": "success"
    })
