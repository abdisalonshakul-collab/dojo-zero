DOJO ZERO v4.6 - HOW TO DEPLOY

FILES (keep them together): index.html, config.js, economy.js, css/, js/, portraits/, sw.js,
manifest.webmanifest, icon-192.png, icon-512.png. Server only: server.js, make-owner-hash.js, package.json.
Full version history: CHANGELOG.txt

1. STATIC HOSTING (no accounts sync)
   Upload everything except the server files. The game works offline; accounts live on the device.

2. ONLINE (accounts, progress sync, leaderboard, public/private 1v1 room lobby)
   node server.js            (Node 16+, no packages). Open http://localhost:3000
   Environment variables (all optional):
     PORT            port to listen on (default 3000)
     DB_FILE         where to keep the data file (default dojo-data.json next to server.js)
     ALLOWED_ORIGIN  e.g. https://mygame.example.com (default * so an APK can connect)
     TRUST_PROXY=1   set when behind a proxy so rate limits use the real visitor IP
     OWNER_HASH      owner password for the server (see below)
   Public/private 1v1 room matchmaking is included; room codes and matchmaking require this server to stay running. The current build provides online room creation/joining and opponent presence; the actual fighting simulation is still local and is not yet synchronized between players.
   ACCOUNTS ARE PERMANENT only if the data file survives: host the server on a disk that persists (set DB_FILE
   to a path on it). The server also keeps dojo-data.json.bak (refreshed every 6 hours). Serve over HTTPS.

3. APK / SEPARATE HOSTING: set window.DZ_API in config.js to your server address (https, no trailing slash).

4. SECURE OWNER MODE (recommended once the server runs)
   - config.js: set window.DZ_OWNER_ONLINE_ONLY = true. The owner then must be confirmed by the server,
     so the password hash inside the page no longer grants anything.
   - Optional new owner password: node make-owner-hash.js "new password", then start the server with the
     printed OWNER_HASH=... variable. (Only works together with step 4's config.js setting.)

5. PRICES: edit economy.js. Tiers are Classic 300 / Rising 500 / Elite 750 / Legend 1000.
   Set FLAT = 500 to make every fighter cost the same again.

6. RELEASING AN UPDATE: bump CACHE in sw.js and the ?v=46 tags in index.html so players get the new files.

WHAT THE SERVER CHECKS
   Coins and owned fighters are validated on every save (lifetime coins can only grow at a believable
   mission rate), records are capped, admin fighters are ignored for normal users, and owner/mods are
   hidden from the leaderboard. Scores are still reported by the player's device, so a determined
   cheater can fake plausible numbers; the checks stop obvious cheating, not all of it.
