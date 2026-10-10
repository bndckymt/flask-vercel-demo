
from flask import Flask, request, render_template_string

app = Flask(__name__)

HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Dynamic Flask App</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 80px auto;
            padding: 20px;
            background: #f4f6f8;
        }
        .card {
            background: white;
            padding: 30px;
            border-radius: 12px;
        }
        input, button {
            padding: 12px;
            margin-top: 10px;
            box-sizing: border-box;
            width: 100%;
        }
        button {
            background: #111827;
            color: white;
            border: none;
            cursor: pointer;
        }
        .result {
            margin-top: 20px;
            color: #087443;
        }
    </style>
</head>
<body>
    <div class="card">
        <h1>My Dynamic Flask App</h1>
        <p>Enter your name to receive a personalized greeting.</p>

        <form method="POST">
            <input
                type="text"
                name="name"
                placeholder="Enter your name"
                maxlength="80"
                required
            >
            <button type="submit">Submit</button>
        </form>

        {% if greeting %}
            <div class="result">
                <h2>{{ greeting }}</h2>
            </div>
        {% endif %}
    </div>
</body>
</html>
"""


@app.route("/", methods=["GET", "POST"])
def home():
    greeting = None

    if request.method == "POST":
        name = request.form.get("name", "").strip()
        if name:
            greeting = f"Hello, {name}! Welcome to my dynamic Flask app."

    return render_template_string(HTML, greeting=greeting)


@app.route("/api/hello")
def hello():
    return {
        "message": "Hello from my Flask API!",
        "status": "success"
    }
