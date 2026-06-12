# Hack Your Friends Web Frontend

This is a static HTML/CSS/JavaScript client for the FastAPI backend.

Run the backend from the repository root:

```bash
python3 -m uvicorn hyf_backend.main:app --reload
```

For local development, serve the frontend from this directory:

```bash
cd frontend/web
python3 -m http.server 8080
```

Then open:

```text
http://127.0.0.1:8080/
```

The API base defaults to:

```text
https://api.logangrimason.com
```

The browser stores the room code, player token, and API base in local storage for reconnects.

For Cloudflare Pages, deploy `frontend/web` as the static site directory. The folder is self-contained and includes the copied `CardArt/` assets.

If you need to test against a local backend, change the API field in the top bar to:

```text
http://127.0.0.1:8000
```
