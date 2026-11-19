# Telegram Group Sandbox — Cloudflare build

This version is designed for Cloudflare Workers + SQLite-backed Durable Objects. It avoids the always-on Node server used by the earlier Render/Oracle starter.

## Features included in this build
- Telegram webhook receiver with a setup page to install the webhook.
- `/help`, `/vote`, `/closevote`, `/afk`, `/back`, `/createworld`, `/createroom`, `/world`.
- Admin checks for world/room creation and vote creation/closing.
- Persistent group world, room, AFK and vote state in a SQLite-backed Durable Object.
- Yes/No callback voting with one vote per Telegram user and refreshed totals.
- 3D lounge Mini App with furniture, room, game tables, a boxing ring, walk movement, emote buttons and WebSocket presence.
- The ten game tables: Ludo, Chess, Snakes & Ladders, Monopoly, Tic-Tac-Toe, Connect 4, Checkers, UNO, Battleship and Carrom.

## Important status
The 3D scene and game-table lobby are included, but the board-game tables are not yet full playable implementations. The boxing area is currently a visual room feature; competitive boxing combat still needs its own implementation pass. This starter also does not yet enforce Telegram group membership for every Mini App connection, so treat the world link as a group-shared link rather than a private-members-only security boundary.

## Cloudflare deploy
1. Upload this folder's contents to the root of your GitHub repository. Do not upload any bot token.
2. In Cloudflare, open Workers & Pages → Create application → Import an existing Git repository, select the repository, and deploy.
3. Add these Worker variables/secrets under Settings → Variables and Secrets:
   - `BOT_TOKEN` (Secret): your newly regenerated Telegram bot token.
   - `WEBHOOK_SECRET` (Secret): random 32+ character string using letters, numbers, `_` or `-`.
   - `WEBHOOK_SETUP_SECRET` (Secret): another random private string; used once on `/setup`.
   - `BOT_USERNAME` (Text): the bot username without `@`.
4. Redeploy after adding variables.
5. Open `https://<your-worker-url>/setup`, enter `WEBHOOK_SETUP_SECRET`, and click Install webhook.
6. In @BotFather, configure the bot's Main Mini App URL to `https://<your-worker-url>/`. This enables the `t.me/<botusername>?startapp=...` group launch link.
7. Add the bot to the Telegram group and make it an administrator.
8. In the group, use `/createworld`, then `/world`.

Cloudflare free-plan usage is limited. Durable Objects on Free use SQLite storage and have daily request, compute, read and write quotas. Review usage in Cloudflare; if limits are exceeded, some calls can fail until the quota resets.

## Local development
Requires Node.js 20+. Run `npm install`, then use `npx wrangler dev`. Set local secrets using `.dev.vars` (never commit this file).
