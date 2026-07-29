# Deploying the Saddle to Paddle live-tracking site

This folder contains everything needed: the map itself, the serverless
function that talks to Garmin, and the config that lets Rodeo Labs
embed it in an iframe. Here's how to get it live on Netlify.

## One important thing up front

Netlify's simple drag-and-drop deploy (app.netlify.com/drop) does **not**
support serverless Functions — it's static-files-only. Since this project
needs the `live-location` function to talk to Garmin, you'll need to deploy
via a **GitHub repository connected to Netlify** instead. It's still simple,
just one extra step versus dragging a file.

## Step 1: Put this folder in a GitHub repo

1. Create a new repository on GitHub (public or private, either works).
2. Upload everything in this folder to it, keeping the folder structure
   exactly as-is:
   - `index.html`
   - `netlify.toml`
   - `_headers`
   - `netlify/functions/live-location.js`

## Step 2: Connect it to Netlify

1. Log into [netlify.com](https://netlify.com) (free account is fine).
2. Click **Add new site → Import an existing project**.
3. Choose GitHub, and select the repository you just created.
4. Build settings: leave the build command **blank**, and set the
   publish directory to `.` (a single period, meaning the root folder).
   Netlify will auto-detect the `netlify/functions` folder and deploy the
   function automatically.
5. Click **Deploy**.

You'll get a URL like `https://random-name-123.netlify.app` — that's your
live site.

## Step 3: Add your Garmin feed URL (required)

The function won't work until it knows which Garmin feed to fetch. This is
kept as an environment variable rather than hardcoded in the code, so the
feed URL isn't sitting in public source files.

1. In your Netlify site dashboard: **Site configuration → Environment
   variables → Add a variable**.
2. Key: `GARMIN_FEED_URL`
   Value: your MapShare "Raw KML Data" URL, e.g.
   `https://share.garmin.com/Feed/Share/YourMapShareName`
3. If your MapShare feed is password-protected, also add:
   Key: `GARMIN_FEED_PASSWORD`
   Value: that password
   (Worth testing this against a real protected feed once you have one —
   the function currently appends it as a URL query parameter, the most
   common pattern for this kind of share link, but Garmin's exact
   mechanism should be confirmed rather than assumed.)
4. **Redeploy the site** after adding environment variables (Netlify
   doesn't apply them retroactively to an already-running deploy) —
   easiest way: go to **Deploys** and click **Trigger deploy → Deploy site**.

## Step 4: Test it

Visit your Netlify URL, scroll into the map, and click
**"Jump to current location."** If everything's wired up correctly, it'll
fly to the real position from your Garmin feed and show the info popup.

If it instead shows the fallback test point (Noah's position in Peru),
something's not connected — check:
- Is `GARMIN_FEED_URL` actually set, and did you redeploy after adding it?
- Open `https://your-site.netlify.app/.netlify/functions/live-location`
  directly in a browser — it should return JSON, not an error. If it
  returns an error message, it'll tell you what went wrong (bad feed URL,
  Garmin returned an unexpected response, etc.).

## Step 5: Hand off to Rodeo Labs for the iframe embed

Once it's working, give their developer:
- The Netlify URL (or your custom domain, if you set one up)
- A note that the `_headers` file already permits embedding specifically
  from `rodeo-labs.com` — if their actual embedding domain is different
  (e.g. a staging subdomain), that file will need the domain added too.

## Updating the map later

Since this is now a Git-connected Netlify site, updating the map is just:
edit `index.html` (or ask Claude to regenerate it), commit, push to GitHub,
and Netlify redeploys automatically. No manual re-upload needed.
