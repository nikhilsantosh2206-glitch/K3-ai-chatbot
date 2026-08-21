import json
import os
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from openai import OpenAI


# ============================================================
# LOAD ENVIRONMENT VARIABLES
# ============================================================

load_dotenv()


# ============================================================
# FLASK APP
# ============================================================

app = Flask(__name__)


# ============================================================
# CONFIGURATION
# ============================================================

MODEL_NAME = "openrouter/free"

DATA_FILE = "sessions.json"

API_KEY = os.getenv("OPENROUTER_API_KEY")


if not API_KEY:
    raise ValueError(
        "OPENROUTER_API_KEY not found. "
        "Please add it to your .env file."
    )


# ============================================================
# OPENROUTER CLIENT
# ============================================================

client = OpenAI(
    api_key=API_KEY,
    base_url="https://openrouter.ai/api/v1"
)


# ============================================================
# STORAGE FUNCTIONS
# ============================================================

def load_sessions():

    if not os.path.exists(DATA_FILE):
        return {}

    try:

        with open(
            DATA_FILE,
            "r",
            encoding="utf-8"
        ) as file:

            return json.load(file)

    except Exception:

        return {}


def save_sessions(data):

    with open(
        DATA_FILE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            data,
            file,
            indent=2,
            ensure_ascii=False
        )


# ============================================================
# HOME PAGE
# ============================================================

@app.route("/")
def index():

    return render_template("index.html")


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/health")
def health():

    return jsonify({

        "status": "ok",

        "api_configured": bool(API_KEY),

        "provider": "OpenRouter",

        "model": MODEL_NAME

    })


# ============================================================
# GET ALL SESSIONS
# ============================================================

@app.route(
    "/api/sessions",
    methods=["GET"]
)
def list_sessions():

    sessions = load_sessions()

    result = []


    for session_id, data in sessions.items():

        result.append({

            "id": session_id,

            "title": data.get(
                "title",
                "New Chat"
            ),

            "created_at": data.get(
                "created_at"
            ),

            "message_count": len(
                data.get(
                    "messages",
                    []
                )
            )

        })


    result.sort(

        key=lambda item:
        item.get(
            "created_at",
            ""
        ),

        reverse=True

    )


    return jsonify(result)


# ============================================================
# CREATE NEW SESSION
# ============================================================

@app.route(
    "/api/sessions",
    methods=["POST"]
)
def create_session():

    sessions = load_sessions()


    session_id = str(
        uuid.uuid4()
    )


    sessions[session_id] = {

        "title": "New Chat",

        "created_at":
            datetime.now(
                timezone.utc
            ).isoformat(),

        "messages": []

    }


    save_sessions(sessions)


    return jsonify({

        "id": session_id,

        "title": "New Chat",

        "messages": []

    })


# ============================================================
# GET SINGLE SESSION
# ============================================================

@app.route(
    "/api/sessions/<session_id>",
    methods=["GET"]
)
def get_session(session_id):

    sessions = load_sessions()


    if session_id not in sessions:

        return jsonify({

            "error":
                "Session not found"

        }), 404


    return jsonify({

        "id": session_id,

        **sessions[session_id]

    })


# ============================================================
# DELETE SESSION
# ============================================================

@app.route(
    "/api/sessions/<session_id>",
    methods=["DELETE"]
)
def delete_session(session_id):

    sessions = load_sessions()


    if session_id in sessions:

        del sessions[session_id]

        save_sessions(sessions)


    return jsonify({

        "success": True

    })


# ============================================================
# CHAT API
# ============================================================

@app.route(
    "/api/sessions/<session_id>/messages",
    methods=["POST"]
)
def send_message(session_id):

    sessions = load_sessions()


    # --------------------------------------------------------
    # Check session
    # --------------------------------------------------------

    if session_id not in sessions:

        return jsonify({

            "error":
                "Session not found"

        }), 404


    # --------------------------------------------------------
    # Read request
    # --------------------------------------------------------

    body = request.get_json(
        silent=True
    ) or {}


    user_message = str(
        body.get(
            "message",
            ""
        )
    ).strip()


    if not user_message:

        return jsonify({

            "error":
                "Message cannot be empty"

        }), 400


    # --------------------------------------------------------
    # Current session
    # --------------------------------------------------------

    session = sessions[session_id]


    # --------------------------------------------------------
    # Save user message
    # --------------------------------------------------------

    session["messages"].append({

        "role": "user",

        "content": user_message

    })


    # --------------------------------------------------------
    # Automatically create title
    # --------------------------------------------------------

    if session["title"] == "New Chat":

        session["title"] = (
            user_message[:40]
        )


    # --------------------------------------------------------
    # Build conversation
    # --------------------------------------------------------

    messages = [

        {
            "role": "system",

            "content":
                (
                    "You are K3 AI, a helpful, "
                    "professional and friendly AI assistant. "
                    "Give clear and accurate answers."
                )
        }

    ]


    for message in session["messages"]:

        messages.append({

            "role":
                message["role"],

            "content":
                message["content"]

        })


    # --------------------------------------------------------
    # OpenRouter request
    # --------------------------------------------------------

    try:

        completion = client.chat.completions.create(

            model=MODEL_NAME,

            messages=messages,

            temperature=0.7,

            max_tokens=2000

        )


        assistant_reply = (
            completion
            .choices[0]
            .message
            .content
        )


        if not assistant_reply:

            assistant_reply = (
                "I couldn't generate a response."
            )


    except Exception as error:

        # Remove user message if API failed
        session["messages"].pop()


        sessions[session_id] = session

        save_sessions(sessions)


        print(
            "\n========== OPENROUTER ERROR =========="
        )

        print(error)

        print(
            "======================================\n"
        )


        return jsonify({

            "error":
                f"OpenRouter API error: {str(error)}"

        }), 500


    # --------------------------------------------------------
    # Save assistant response
    # --------------------------------------------------------

    session["messages"].append({

        "role": "assistant",

        "content": assistant_reply

    })


    sessions[session_id] = session


    save_sessions(sessions)


    # --------------------------------------------------------
    # Response
    # --------------------------------------------------------

    return jsonify({

        "reply": assistant_reply,

        "title":
            session["title"]

    })


# ============================================================
# ERROR HANDLER
# ============================================================

@app.errorhandler(404)
def not_found(error):

    return jsonify({

        "error":
            "Route not found"

    }), 404


# ============================================================
# START APPLICATION
# ============================================================

if __name__ == "__main__":

    print()
    print("=" * 60)
    print("              K3 AI CHAT")
    print("=" * 60)
    print(
        "API Provider : OpenRouter"
    )
    print(
        f"Model        : {MODEL_NAME}"
    )
    print(
        "API Key      : Loaded"
    )
    print(
        "Server       : http://127.0.0.1:5000"
    )
    print("=" * 60)
    print()


    app.run(

        host="127.0.0.1",

        port=5000,

        debug=False,

        use_reloader=False,

        threaded=True

    )