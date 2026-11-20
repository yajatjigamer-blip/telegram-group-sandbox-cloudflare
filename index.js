const TELEGRAM_API = 'https://api.telegram.org';
const DEFAULT_STATE = () => ({ worldCreated: false, rooms: [], afk: {}, drafts: {}, polls: [] });

async function tg(env, method, payload = {}) {
  if (!env.BOT_TOKEN) throw new Error('BOT_TOKEN is not configured');
  const res = await fetch(`${TELEGRAM_API}/bot${env.BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || `Telegram API ${method} failed`);
  return data.result;
}

async function isGroupAdmin(env, chatId, userId) {
  try {
    const member = await tg(env, 'getChatMember', { chat_id: chatId, user_id: userId });
    return member.status === 'creator' || member.status === 'administrator';
  } catch { return false; }
}

async function groupRpc(env, groupId, payload) {
  const id = env.ROOMS.idFromName(String(groupId));
  const stub = env.ROOMS.get(id);
  const response = await stub.fetch('https://group-room.internal/rpc', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Room state error: ${response.status}`);
  return response.json();
}

function displayName(user = {}) {
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Member';
}

async function sendMessage(env, chatId, text, replyMarkup) {
  const payload = { chat_id: chatId, text };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  return tg(env, 'sendMessage', payload);
}

async function sendVoteMessage(env, chatId, groupId, poll) {
  const sent = await sendMessage(env, chatId, voteText(poll), voteMarkup(poll.id));
  await groupRpc(env, groupId, { op: 'setPollMessage', pollId: poll.id, messageId: sent.message_id });
  return sent;
}

function voteMarkup(id) {
  return { inline_keyboard: [[
    { text: '👍 Yes', callback_data: `vote:${id}:yes` },
    { text: '👎 No', callback_data: `vote:${id}:no` }
  ]] };
}

function voteText(poll) {
  const yes = Object.values(poll.votes || {}).filter(v => v === 'yes').length;
  const no = Object.values(poll.votes || {}).filter(v => v === 'no').length;
  return `📊 ${poll.question}\n\n👍 Yes: ${yes}\n👎 No: ${no}\n🗳 Total: ${yes + no}\n\n${poll.closed ? '🔒 Voting closed' : 'Voting is open'}`;
}

async function handleMessage(update, env) {
  const msg = update.message;
  if (!msg?.chat || !msg?.from || !['group', 'supergroup'].includes(msg.chat.type)) return;
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text || '';
  const name = displayName(msg.from);
  const command = text.match(/^\/(\w+)(?:@\w+)?(?:\s+([\s\S]+))?$/);

  if (command) {
    const cmd = command[1].toLowerCase();
    const arg = (command[2] || '').trim();
    if (cmd === 'help' || cmd === 'start') {
      return sendMessage(env, chatId,
        '🌍 Group Sandbox commands\n/vote — admin creates a Yes/No vote\n/closevote — close the latest open vote\n/afk [reason] — mark yourself away\n/back — return from AFK\n/createworld — admin creates the group world\n/createroom [name] — admin creates another room\n/world — open the 3D sandbox');
    }
    if (cmd === 'afk') {
      const reason = arg || 'Away';
      await groupRpc(env, chatId, { op: 'setAfk', userId, name, reason });
      return sendMessage(env, chatId, `💤 ${name} is now AFK: ${reason}`);
    }
    if (cmd === 'back') {
      const result = await groupRpc(env, chatId, { op: 'clearAfk', userId });
      return sendMessage(env, chatId, result.hadAfk ? `👋 Welcome back, ${name}!` : 'You were not marked AFK.');
    }
    if (cmd === 'createworld') {
      if (!(await isGroupAdmin(env, chatId, userId))) return sendMessage(env, chatId, 'Only group admins can create the world.');
      await groupRpc(env, chatId, { op: 'createWorld', creatorId: userId });
      return sendMessage(env, chatId, '🌍 This group’s sandbox world has been created! Use /world to enter.');
    }
    if (cmd === 'createroom') {
      if (!(await isGroupAdmin(env, chatId, userId))) return sendMessage(env, chatId, 'Only group admins can create rooms.');
      const result = await groupRpc(env, chatId, { op: 'createRoom', name: arg || 'New Lounge' });
      return sendMessage(env, chatId, result.ok ? `🏠 Room created: ${result.room.name}\nUse /world to enter the group lounge.` : 'Create the group world first with /createworld.');
    }
    if (cmd === 'world') {
      const state = await groupRpc(env, chatId, { op: 'status' });
      if (!state.worldCreated) return sendMessage(env, chatId, 'An admin must create this group’s world first using /createworld.');
      if (!env.BOT_USERNAME) return sendMessage(env, chatId, 'The bot owner must set BOT_USERNAME in Cloudflare and configure this bot’s Main Mini App in @BotFather first.');
      const appLink = `https://t.me/${String(env.BOT_USERNAME).replace(/^@/, '')}?startapp=room_${encodeURIComponent(String(chatId))}`;
      return sendMessage(env, chatId, '🌍 Your group sandbox is ready:', {
        inline_keyboard: [[{ text: '🌍 Enter the Sandbox', url: appLink }]]
      });
    }
    if (cmd === 'vote') {
      if (!(await isGroupAdmin(env, chatId, userId))) return sendMessage(env, chatId, 'Only group admins can create votes.');
      if (arg) {
        const poll = await groupRpc(env, chatId, { op: 'createPoll', creatorId: userId, question: arg });
        return sendVoteMessage(env, chatId, chatId, poll);
      }
      await groupRpc(env, chatId, { op: 'setDraft', userId });
      return sendMessage(env, chatId, 'Send the voting question in your next message. Send /cancel to stop.');
    }
    if (cmd === 'cancel') {
      await groupRpc(env, chatId, { op: 'clearDraft', userId });
      return sendMessage(env, chatId, 'Cancelled.');
    }
    if (cmd === 'closevote') {
      const poll = await groupRpc(env, chatId, { op: 'latestOpenPoll' });
      if (!poll) return sendMessage(env, chatId, 'There is no open vote.');
      if (!(await isGroupAdmin(env, chatId, userId)) && poll.creatorId !== userId) {
        return sendMessage(env, chatId, 'Only the vote creator or a group admin can close this vote.');
      }
      const closed = await groupRpc(env, chatId, { op: 'closePoll', pollId: poll.id });
      if (closed?.messageId) {
        await tg(env, 'editMessageText', { chat_id: chatId, message_id: closed.messageId, text: voteText(closed) });
        return;
      }
      return sendMessage(env, chatId, 'Vote closed.');
    }
  }

  // If a group admin previously started /vote, their next ordinary message becomes the question.
  if (text && !text.startsWith('/')) {
    const draft = await groupRpc(env, chatId, { op: 'getDraft', userId });
    if (draft?.pending) {
      if (!(await isGroupAdmin(env, chatId, userId))) {
        await groupRpc(env, chatId, { op: 'clearDraft', userId });
        return;
      }
      const poll = await groupRpc(env, chatId, { op: 'createPollFromDraft', userId, question: text.slice(0, 280), creatorId: userId });
      if (poll) return sendVoteMessage(env, chatId, chatId, poll);
    }
  }

  // Telegram text_mention entities include a user ID, so those AFK mentions can be resolved safely.
  for (const entity of msg.entities || []) {
    if (entity.type === 'text_mention' && entity.user) {
      const away = await groupRpc(env, chatId, { op: 'getAfk', userId: entity.user.id });
      if (away) await sendMessage(env, chatId, `💤 ${away.name} is AFK: ${away.reason}`);
    }
  }

  const selfAfk = await groupRpc(env, chatId, { op: 'clearAfkIfPresent', userId });
  if (selfAfk?.hadAfk) await sendMessage(env, chatId, `👋 ${name} is no longer AFK.`);
}

async function handleCallback(update, env) {
  const q = update.callback_query;
  if (!q?.data?.startsWith('vote:') || !q.message?.chat?.id) return;
  const [, pollId, choice] = q.data.split(':');
  const result = await groupRpc(env, q.message.chat.id, { op: 'castVote', pollId, userId: q.from.id, choice });
  await tg(env, 'answerCallbackQuery', { callback_query_id: q.id, text: result?.ok ? 'Your vote has been counted.' : (result?.error || 'Vote unavailable.') });
  if (result?.poll) {
    await tg(env, 'editMessageText', {
      chat_id: q.message.chat.id,
      message_id: q.message.message_id,
      text: voteText(result.poll),
      ...(result.poll.closed ? {} : { reply_markup: voteMarkup(result.poll.id) })
    });
  }
}

const SETUP_HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Install Telegram webhook</title><style>body{font:16px system-ui;background:#101827;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0}.card{width:min(440px,90vw);background:#1c2a3d;padding:26px;border-radius:20px;border:1px solid #ffffff22}input,button{width:100%;padding:13px;border-radius:10px;margin-top:10px;box-sizing:border-box}input{background:#0e1724;color:#fff;border:1px solid #52647c}button{background:#2786df;color:white;border:0;font-weight:700}small{color:#b7c5d6}</style></head><body><div class="card"><h2>Connect Telegram bot</h2><p>Enter the WEBHOOK_SETUP_SECRET you saved in Cloudflare. This installs the Telegram webhook for this Worker.</p><form id="f"><input id="secret" type="password" placeholder="WEBHOOK_SETUP_SECRET" required><button>Install webhook</button></form><p id="out"><small>Your secret is sent directly to this Worker and is not saved in this page.</small></p></div><script>document.getElementById('f').addEventListener('submit',async e=>{e.preventDefault();const out=document.getElementById('out');out.textContent='Installing…';try{const r=await fetch('/setup-webhook',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({secret:document.getElementById('secret').value})});const d=await r.json();out.textContent=d.ok?'✅ Webhook installed. You can close this page.':('Error: '+(d.error||'Unknown error'));}catch(e){out.textContent='Could not connect: '+e.message;}});</script></body></html>`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/health') return Response.json({ ok: true, service: 'telegram-group-sandbox' });
    if (url.pathname === '/setup' && request.method === 'GET') return new Response(SETUP_HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } });

    if (url.pathname === '/setup-webhook' && request.method === 'POST') {
      if (!env.BOT_TOKEN || !env.WEBHOOK_SECRET || !env.WEBHOOK_SETUP_SECRET) {
        return Response.json({ ok: false, error: 'Set BOT_TOKEN, WEBHOOK_SECRET and WEBHOOK_SETUP_SECRET in Worker secrets first.' }, { status: 400 });
      }
      let body = {};
      try { body = await request.json(); } catch {}
      if (!body.secret || body.secret !== env.WEBHOOK_SETUP_SECRET) return Response.json({ ok: false, error: 'Incorrect setup secret.' }, { status: 403 });
      try {
        const webhookUrl = new URL('/telegram/webhook', request.url).toString();
        const result = await tg(env, 'setWebhook', {
          url: webhookUrl,
          secret_token: env.WEBHOOK_SECRET,
          allowed_updates: ['message', 'callback_query']
        });
        return Response.json({ ok: true, webhook: webhookUrl, result });
      } catch (error) { return Response.json({ ok: false, error: error.message }, { status: 500 }); }
    }

    if (url.pathname === '/telegram/webhook' && request.method === 'POST') {
      if (!env.WEBHOOK_SECRET || request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) {
        return new Response('Forbidden', { status: 403 });
      }
      try {
        const update = await request.json();
        if (update.message) await handleMessage(update, env);
        if (update.callback_query) await handleCallback(update, env);
        return new Response('ok');
      } catch (error) {
        console.error('Telegram update error:', error);
        return new Response('ok'); // Acknowledge to Telegram; inspect Worker logs for details.
      }
    }

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
      const roomId = url.searchParams.get('room') || 'demo-room';
      const id = env.ROOMS.idFromName(String(roomId));
      return env.ROOMS.get(id).fetch(request);
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
      return env.ASSETS.fetch(request);
    }
    return new Response('Not found', { status: 404 });
  }
};

export class GroupRoom {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }

  async getData() { return (await this.ctx.storage.get('data')) || DEFAULT_STATE(); }
  async saveData(data) { await this.ctx.storage.put('data', data); }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/rpc' && request.method === 'POST') {
      const body = await request.json();
      const data = await this.getData();
      let result = {};
      switch (body.op) {
        case 'status': result = { worldCreated: data.worldCreated, rooms: data.rooms }; break;
        case 'createWorld':
          data.worldCreated = true;
          if (!data.rooms.length) data.rooms.push({ id: 'main', name: 'Main Lounge' });
          data.createdBy = body.creatorId;
          await this.saveData(data);
          result = { ok: true, rooms: data.rooms };
          break;
        case 'createRoom': {
          if (!data.worldCreated) { result = { ok: false }; break; }
          const id = `room-${crypto.randomUUID().slice(0, 8)}`;
          const room = { id, name: String(body.name || 'New Lounge').slice(0, 40) };
          data.rooms.push(room); await this.saveData(data); result = { ok: true, room }; break;
        }
        case 'setAfk':
          data.afk[String(body.userId)] = { name: body.name, reason: String(body.reason || 'Away').slice(0, 120), since: Date.now() };
          await this.saveData(data); result = { ok: true }; break;
        case 'getAfk': result = data.afk[String(body.userId)] || null; break;
        case 'clearAfk': {
          const hadAfk = Boolean(data.afk[String(body.userId)]);
          delete data.afk[String(body.userId)]; await this.saveData(data); result = { hadAfk }; break;
        }
        case 'clearAfkIfPresent': {
          const hadAfk = Boolean(data.afk[String(body.userId)]);
          if (hadAfk) { delete data.afk[String(body.userId)]; await this.saveData(data); }
          result = { hadAfk }; break;
        }
        case 'setDraft': data.drafts[String(body.userId)] = true; await this.saveData(data); result = { ok: true }; break;
        case 'clearDraft': delete data.drafts[String(body.userId)]; await this.saveData(data); result = { ok: true }; break;
        case 'getDraft': result = { pending: Boolean(data.drafts[String(body.userId)]) }; break;
        case 'createPollFromDraft': {
          const key = String(body.userId);
          if (!data.drafts[key]) break;
          delete data.drafts[key];
          const poll = { id: crypto.randomUUID().slice(0, 12), creatorId: body.creatorId, question: String(body.question || '').slice(0, 280), votes: {}, closed: false, messageId: null };
          data.polls.push(poll); await this.saveData(data); result = poll; break;
        }
        case 'createPoll': {
          const poll = { id: crypto.randomUUID().slice(0, 12), creatorId: body.creatorId, question: String(body.question || 'Vote').slice(0, 280), votes: {}, closed: false, messageId: null };
          data.polls.push(poll); await this.saveData(data); result = poll; break;
        }
        case 'latestOpenPoll': result = [...data.polls].reverse().find(p => !p.closed) || null; break;
        case 'setPollMessage': {
          const poll = data.polls.find(p => p.id === body.pollId);
          if (poll) { poll.messageId = body.messageId; await this.saveData(data); result = { ok: true }; }
          break;
        }
        case 'closePoll': {
          const poll = data.polls.find(p => p.id === body.pollId);
          if (poll) { poll.closed = true; await this.saveData(data); result = poll; }
          break;
        }
        case 'castVote': {
          const poll = data.polls.find(p => p.id === body.pollId);
          if (!poll || poll.closed) { result = { ok: false, error: 'This vote is closed or unavailable.' }; break; }
          if (!['yes', 'no'].includes(body.choice)) { result = { ok: false, error: 'Invalid vote.' }; break; }
          poll.votes[String(body.userId)] = body.choice;
          await this.saveData(data); result = { ok: true, poll }; break;
        }
        default: result = { error: 'Unknown operation' };
      }
      return Response.json(result);
    }

    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.ctx.acceptWebSocket(server);
      const name = new URL(request.url).searchParams.get('name') || 'Guest';
      server.serializeAttachment({ socketId: crypto.randomUUID(), name: name.slice(0, 24), x: 0, z: 0 });
      const players = this.ctx.getWebSockets().map(ws => ({ id: this.getSocketId(ws), ...(ws.deserializeAttachment() || {}) }));
      server.send(JSON.stringify({ type: 'joined', id: this.getSocketId(server), players }));
      this.broadcast({ type: 'player-joined', id: this.getSocketId(server), name: name.slice(0, 24) }, server);
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response('Not found', { status: 404 });
  }

  getSocketId(ws) { return ws.deserializeAttachment()?.socketId || 'player'; }
  broadcast(data, except = null) {
    const message = JSON.stringify(data);
    for (const ws of this.ctx.getWebSockets()) if (ws !== except) { try { ws.send(message); } catch {} }
  }
  async webSocketMessage(ws, message) {
    let data; try { data = JSON.parse(message); } catch { return; }
    const attachment = ws.deserializeAttachment() || { name: 'Guest', x: 0, z: 0 };
    if (data.type === 'move' && typeof data.x === 'number' && typeof data.z === 'number') {
      attachment.x = Math.max(-10, Math.min(10, data.x));
      attachment.z = Math.max(-8, Math.min(8, data.z));
      ws.serializeAttachment(attachment);
      this.broadcast({ type: 'player-moved', id: this.getSocketId(ws), name: attachment.name, x: attachment.x, z: attachment.z }, ws);
    } else if (data.type === 'emote' && ['hug', 'slap', 'kiss', 'wave'].includes(data.kind)) {
      this.broadcast({ type: 'emote', id: this.getSocketId(ws), name: attachment.name, kind: data.kind });
    }
  }
  async webSocketClose(ws) {
    const attachment = ws.deserializeAttachment() || {};
    this.broadcast({ type: 'player-left', id: this.getSocketId(ws), name: attachment.name || 'A player' });
  }
  async webSocketError(ws) { try { ws.close(1011, 'WebSocket error'); } catch {} }
}
