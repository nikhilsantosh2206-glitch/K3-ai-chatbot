const sessionListEl = document.getElementById("session-list");
const messagesEl = document.getElementById("messages");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const chatTitleEl = document.getElementById("chat-title");
const newChatBtn = document.getElementById("new-chat-btn");

let currentSessionId = null;


// =====================================================
// FETCH SESSIONS
// =====================================================

async function fetchSessions() {

    try {

        const res = await fetch("/api/sessions");

        if (!res.ok) {
            throw new Error("Failed to load sessions");
        }

        const sessions = await res.json();

        renderSessionList(sessions);

        return sessions;

    } catch (error) {

        console.error("Session error:", error);

        return [];

    }
}


// =====================================================
// RENDER SESSION LIST
// =====================================================

function renderSessionList(sessions) {

    sessionListEl.innerHTML = "";

    if (sessions.length === 0) {

        const empty = document.createElement("div");

        empty.className = "session-empty";

        empty.textContent = "No chats yet";

        sessionListEl.appendChild(empty);

        return;
    }


    sessions.forEach((s) => {

        const item = document.createElement("div");

        item.className =
            "session-item" +
            (s.id === currentSessionId ? " active" : "");

        item.dataset.id = s.id;


        // -------------------------------
        // Title
        // -------------------------------

        const titleSpan =
            document.createElement("span");

        titleSpan.className = "session-title";

        titleSpan.textContent =
            s.title || "New Chat";


        item.appendChild(titleSpan);


        // -------------------------------
        // Delete button
        // -------------------------------

        const delBtn =
            document.createElement("button");

        delBtn.className = "delete-btn";

        delBtn.textContent = "✕";


        delBtn.addEventListener(
            "click",
            (e) => {

                e.stopPropagation();

                deleteSession(s.id);

            }
        );


        item.appendChild(delBtn);


        // -------------------------------
        // Open session
        // -------------------------------

        item.addEventListener(
            "click",
            () => loadSession(s.id)
        );


        sessionListEl.appendChild(item);

    });

}


// =====================================================
// CREATE NEW SESSION
// =====================================================

async function createSession() {

    try {

        const res =
            await fetch(
                "/api/sessions",
                {
                    method: "POST"
                }
            );


        if (!res.ok) {

            throw new Error(
                "Unable to create new chat"
            );

        }


        const session =
            await res.json();


        currentSessionId =
            session.id;


        chatTitleEl.textContent =
            "New Chat";


        renderMessages([]);


        await fetchSessions();


        messageInput.focus();

    }

    catch (error) {

        console.error(
            "Create session error:",
            error
        );

        alert(
            "Unable to create a new chat."
        );

    }

}


// =====================================================
// LOAD SESSION
// =====================================================

async function loadSession(sessionId) {

    try {

        currentSessionId =
            sessionId;


        const res =
            await fetch(
                `/api/sessions/${sessionId}`
            );


        if (!res.ok) {

            throw new Error(
                "Session not found"
            );

        }


        const session =
            await res.json();


        chatTitleEl.textContent =
            session.title || "K3 AI Chat";


        renderMessages(
            session.messages || []
        );


        await fetchSessions();


        messageInput.focus();

    }

    catch (error) {

        console.error(
            "Load session error:",
            error
        );

    }

}


// =====================================================
// DELETE SESSION
// =====================================================

async function deleteSession(sessionId) {

    try {

        const res =
            await fetch(
                `/api/sessions/${sessionId}`,
                {
                    method: "DELETE"
                }
            );


        if (!res.ok) {

            throw new Error(
                "Unable to delete chat"
            );

        }


        if (
            sessionId ===
            currentSessionId
        ) {

            currentSessionId =
                null;


            renderMessages([]);


            chatTitleEl.textContent =
                "K3 AI Chat";

        }


        await fetchSessions();

    }

    catch (error) {

        console.error(
            "Delete session error:",
            error
        );

    }

}


// =====================================================
// RENDER MESSAGES
// =====================================================

function renderMessages(messages) {

    messagesEl.innerHTML = "";


    if (
        !messages ||
        messages.length === 0
    ) {

        const empty =
            document.createElement("div");


        empty.className =
            "empty-state";


        empty.textContent =
            "Start a conversation below.";


        messagesEl.appendChild(
            empty
        );


        return;

    }


    messages.forEach((m) => {

        appendMessage(
            m.role,
            m.content
        );

    });

}


// =====================================================
// APPEND MESSAGE
// =====================================================

function appendMessage(
    role,
    content
) {

    // Remove empty state

    const empty =
        messagesEl.querySelector(
            ".empty-state"
        );


    if (empty) {

        empty.remove();

    }


    const div =
        document.createElement("div");


    div.className =
        `message ${role}`;


    // textContent prevents HTML injection

    div.textContent =
        content;


    messagesEl.appendChild(
        div
    );


    messagesEl.scrollTop =
        messagesEl.scrollHeight;


    return div;

}


// =====================================================
// SEND MESSAGE
// =====================================================

chatForm.addEventListener(
    "submit",
    async (e) => {

        e.preventDefault();


        const text =
            messageInput.value.trim();


        if (!text) {

            return;

        }


        // Create session automatically

        if (!currentSessionId) {

            await createSession();

        }


        // Display user message

        appendMessage(
            "user",
            text
        );


        // Clear input

        messageInput.value = "";

        messageInput.style.height =
            "auto";


        // Disable button

        sendBtn.disabled = true;


        sendBtn.textContent =
            "…";


        // Loading message

        const loadingDiv =
            document.createElement("div");


        loadingDiv.className =
            "message loading";


        loadingDiv.textContent =
            "K3 AI is thinking...";


        messagesEl.appendChild(
            loadingDiv
        );


        messagesEl.scrollTop =
            messagesEl.scrollHeight;


        try {

            const res =
                await fetch(
                    `/api/sessions/${currentSessionId}/messages`,
                    {

                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                message: text
                            })

                    }
                );


            const data =
                await res.json();


            // Remove loading

            loadingDiv.remove();


            if (!res.ok) {

                throw new Error(
                    data.error ||
                    "API request failed"
                );

            }


            // AI response

            appendMessage(
                "assistant",
                data.reply ||
                "No response received."
            );


            // Update title

            if (data.title) {

                chatTitleEl.textContent =
                    data.title;

            }


            // Refresh sidebar

            await fetchSessions();

        }

        catch (err) {

            loadingDiv.remove();


            appendMessage(
                "assistant",
                "❌ Error: " +
                err.message
            );


            console.error(
                "Chat error:",
                err
            );

        }

        finally {

            sendBtn.disabled =
                false;


            sendBtn.textContent =
                "➤";


            messageInput.focus();

        }

    }
);


// =====================================================
// AUTO-GROW TEXTAREA
// =====================================================

messageInput.addEventListener(
    "input",
    () => {

        messageInput.style.height =
            "auto";


        messageInput.style.height =
            messageInput.scrollHeight +
            "px";

    }
);


// =====================================================
// ENTER TO SEND
// SHIFT + ENTER = NEW LINE
// =====================================================

messageInput.addEventListener(
    "keydown",
    (e) => {

        if (
            e.key === "Enter" &&
            !e.shiftKey
        ) {

            e.preventDefault();


            chatForm.requestSubmit();

        }

    }
);


// =====================================================
// NEW CHAT BUTTON
// =====================================================

newChatBtn.addEventListener(
    "click",
    createSession
);


// =====================================================
// INITIALIZE
// =====================================================

fetchSessions();

messageInput.focus();