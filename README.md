# URL Shortener API

A Node.js URL shortener with a responsive web dashboard, link creation, redirects, click analytics, and owner-only link deletion.

## Requirements

- Node.js 20 or newer and npm
- MongoDB 7 or newer (local MongoDB or MongoDB Atlas)
- Docker Desktop only if you want to start MongoDB with the included Compose file

## Quick start (Windows PowerShell)

1. Install Node.js from <https://nodejs.org/> if `node --version` does not work.
2. Install Docker Desktop, or create a free MongoDB Atlas database.
3. In this project folder, install the Node dependencies:

   ```powershell
   npm install
   ```

4. Create your local configuration:

   ```powershell
   Copy-Item .env.example .env
   ```

5. Start MongoDB. For local Docker:

   ```powershell
   npm run start:db
   ```

   For Atlas, edit `MONGODB_URI` in `.env` to your database connection string instead. Do not commit `.env`.

6. Start the API:

   ```powershell
   npm run dev
   ```

   Open `http://localhost:4000` for the web dashboard. Press `Ctrl+C` to stop the server. You can paste a URL, optionally choose a custom alias, create a short link, copy it, and view click counts in the recent-links list.

7. To create publicly accessible links with a temporary address, stop the regular server with `Ctrl+C`, then run:

   ```powershell
   winget install --id Cloudflare.cloudflared
   npm run dev:tunnel
   ```

   Install Cloudflare Tunnel only once. Open the public URL printed in the terminal. Links created through that address use the temporary public domain instead of `localhost`. Keep the terminal open; the tunnel address stops working when the command exits and may change next time. Use this for testing, not as permanent hosting.

8. Run the tests in a separate terminal:

   ```powershell
   npm test
   ```

To stop the local MongoDB container, run `npm run stop:db`. MongoDB data is retained in the Compose volume.

## API

The dashboard is served at `GET /`.

### Create a short link

`POST /api/urls`

```json
{
  "url": "https://example.com/a-long-page",
  "customCode": "optional-name"
}
```

`customCode` is optional and must be 3-32 letters, numbers, hyphens, or underscores. Without a custom code, the API creates a compact code from the destination website name and a short unique suffix (for example, `youtube-X7q`). Only HTTP and HTTPS destination URLs are accepted. A successful response (`201`) includes the short URL and a one-time `ownerToken`. Save the token securely; it is required to delete this link. If a custom code already exists, the API responds with `409`.

### Open a short link

`GET /:code`

Redirects to the original URL with HTTP `302` and records the click time, referrer, and user-agent.

### Read analytics

`GET /api/urls/:code/stats`

Returns the original destination, creation time, total click count, and click counts by UTC day.

### Delete a link

`DELETE /api/urls/:code`

Send the `x-owner-token` header with the token returned when the link was created. Returns `204` when deleted; click records for that link are also removed.

### Health check

`GET /health`

Returns `{ "status": "ok" }` when the API process is responsive.

## Example requests (PowerShell)

Create a link:

```powershell
$created = Invoke-RestMethod -Method Post `
  -Uri http://localhost:4000/api/urls `
  -ContentType 'application/json' `
  -Body '{"url":"https://example.com"}'
$created
```

Visit `$created.shortUrl` in a browser to record a click. Then check analytics:

```powershell
Invoke-RestMethod "http://localhost:4000/api/urls/$($created.code)/stats"
```

Delete the link:

```powershell
Invoke-RestMethod -Method Delete `
  -Uri "http://localhost:4000/api/urls/$($created.code)" `
  -Headers @{ 'x-owner-token' = $created.ownerToken }
```
