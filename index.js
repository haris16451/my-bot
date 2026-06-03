require('dotenv').config();
// ╔═══════════════════════════════════════════════════════════════════╗
// ║          ADVANCED AI COMPANION BOT — MODULAR ARCHITECTURE         ║
// ║     Groq AI + Pathfinder + Armor Manager + Anti-AFK + Stable      ║
// ║                  Termux / Node.js — Final Build                   ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
//  📁 FILE STRUCTURE (sab ek file mein, modular sections):
//  ─────────────────────────────────────────────────────
//  [1] CONFIG          — Server, admins, Groq key
//  [2] EXPRESS         — Keep-alive dashboard
//  [3] BOT STATE       — Global state management
//  [4] AI BRIDGE       — Groq API → JSON action
//  [5] CORE FUNCTIONS  — moveTo, performTask, autoEquip, mine, farm...
//  [6] ANTI-AFK        — Smart random movement
//  [7] CHAT HANDLER    — Message receive → AI → execute
//  [8] BOT INIT        — Events, plugins, reconnect
//  [9] START           — Entry point
// ─────────────────────────────────────────────────────

"use strict";
require('dotenv').config();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  [1] IMPORTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const mineflayer    = require("mineflayer");
const express       = require("express");
const axios         = require("axios");
const vec3          = require("vec3");
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder");
const { GoalNear, GoalFollow, GoalBlock, GoalXZ, GoalY } = goals;
const collectBlock  = require("mineflayer-collectblock").plugin;
const pvp           = require("mineflayer-pvp").plugin;
// mineflayer-armor-manager (npm install mineflayer-armor-manager)
let armorManager;
try {
  armorManager = require("mineflayer-armor-manager");
} catch (_) {
  armorManager = null;
  console.warn("[Boot] mineflayer-armor-manager nahi mila — autoEquip limited mode mein chalega.");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  [2] CONFIG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const CONFIG = {
  // ── Minecraft Server ──
  server: {
    host   : "myworld222.aternos.me",  // ← Server IP
    port   : 14406,                     // ← Server Port
    user   : "harisbot",               // ← Bot username
    version: "1.20.1",                 // ← MC Version
    auth   : "offline",
  },

  // ── Bot Owners ──
  admins: ["Harisxgamer", "yasirxgamez"],

  // ── Home Coordinates ──
  home: { x: 44, y: 74, z: -213 },

  // ── Groq AI ──
  groq: {
    apiKey: "  process.env.GROQ_API_KEY;" // ← console.groq.com/keys
    model : "llama3-8b-8192",
    url   : "https://api.groq.com/openai/v1/chat/completions",
  },

  // ── Timing ──
  reconnectDelay : 10_000,   // 10s
  afkInterval    : 30_000,   // 30s
  brainInterval  : 5_000,    //  5s
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  [3] EXPRESS — Keep-Alive Dashboard
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const webApp = express();

webApp.get("/", (_req, res) => {
  const pos = (bot && bot.entity)
    ? `X:${Math.round(bot.entity.position.x)}  Y:${Math.round(bot.entity.position.y)}  Z:${Math.round(bot.entity.position.z)}`
    : "Connecting...";

  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>AI Companion Bot</title>
  <meta http-equiv="refresh" content="10">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0d0d1a;color:#c9d1d9;font-family:monospace;padding:24px}
    h1{color:#58a6ff;font-size:1.4rem;margin-bottom:16px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
    .card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:14px}
    .card .label{font-size:.75rem;color:#8b949e;margin-bottom:4px}
    .card .val{font-size:1rem;color:#e6edf3}
    .on{color:#3fb950}.off{color:#f85149}.warn{color:#d29922}
    .badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:.75rem}
    .badge.on{background:#1f3d25;color:#3fb950}
    .badge.off{background:#3d1f1f;color:#f85149}
    footer{margin-top:20px;font-size:.7rem;color:#484f58}
  </style>
</head>
<body>
  <h1>🤖 Advanced AI Companion — Dashboard</h1>
  <div class="grid">
    <div class="card"><div class="label">Server</div><div class="val">${CONFIG.server.host}:${CONFIG.server.port}</div></div>
    <div class="card"><div class="label">Bot Username</div><div class="val">${CONFIG.server.user}</div></div>
    <div class="card"><div class="label">Position</div><div class="val">${pos}</div></div>
    <div class="card"><div class="label">Guard Mode</div><div class="val"><span class="badge ${STATE.guard ? 'on' : 'off'}">${STATE.guard ? '🛡️ ON' : 'OFF'}</span></div></div>
    <div class="card"><div class="label">Farming</div><div class="val"><span class="badge ${STATE.farming ? 'on' : 'off'}">${STATE.farming ? '🌾 ON' : 'OFF'}</span></div></div>
    <div class="card"><div class="label">Following</div><div class="val"><span class="badge ${STATE.following ? 'on' : 'off'}">${STATE.following ? '🏃 ' + STATE.followTarget : 'OFF'}</span></div></div>
    <div class="card"><div class="label">AI Engine</div><div class="val"><span class="badge on">✅ Groq Llama3</span></div></div>
    <div class="card"><div class="label">Armor Manager</div><div class="val"><span class="badge ${armorManager ? 'on' : 'warn'}">${armorManager ? '✅ Loaded' : '⚠️ Fallback Mode'}</span></div></div>
  </div>
  <footer>Auto-refresh: 10s | Build: Advanced AI Companion v2.0</footer>
</body>
</html>`);
});

webApp.listen(5000, "0.0.0.0", () =>
  console.log("🌐 Dashboard → http://localhost:5000")
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  [4] BOT STATE — Single source of truth
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const STATE = {
  guard       : false,
  following   : false,
  farming     : false,
  followTarget: null,
  busy        : false,   // koi bhi long task chal raha ho
};

let bot          = null;
let _brainTick   = null;
let _afkTick     = null;
let _reconnecting = false;

// State reset helper
function resetState(keepBusy = false) {
  STATE.guard        = false;
  STATE.following    = false;
  STATE.farming      = false;
  STATE.followTarget = null;
  if (!keepBusy) STATE.busy = false;
  try { bot.pathfinder.setGoal(null); } catch (_) {}
  try { bot.pvp.stop();               } catch (_) {}
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  [5] AI BRIDGE — Groq → JSON Action
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Supported actions (AI in return karega):
 *
 * { action:"come"                                          }  → player ke paas aao
 * { action:"follow",   player:"name"                      }  → follow karo
 * { action:"stop"                                          }  → sab band
 * { action:"go_home"                                       }  → ghar jao
 * { action:"protect"                                       }  → guard ON
 * { action:"attack",   target:"playerName"                 }  → attack karo
 * { action:"mine",     block:"block_name", count:5         }  → blocks khodo
 * { action:"place",    block:"block_name"                  }  → block lagao
 * { action:"farm",     crop:"wheat"|"potatoes"|"carrots"   }  → crop kato
 * { action:"drop_all"                                      }  → inventory girao
 * { action:"give",     item:"item_name"|"all"              }  → player ko do
 * { action:"equip",    item:"item_name"                    }  → item pakdo
 * { action:"armor"                                         }  → armor pehan lo
 * { action:"sleep"                                         }  → so jao
 * { action:"health"                                        }  → health batao
 * { action:"inventory"                                     }  → inventory batao
 * { action:"position"                                      }  → position batao
 * { action:"craft",    recipe:"item_name"                  }  → craft karo (basic)
 * { action:"chat",     reply:"..."                         }  → sirf jawab do
 * { action:"unknown",  reply:"..."                         }  → samajh nahi aaya
 */

const AI_SYSTEM_PROMPT = `
Tu ek advanced Minecraft bot ka AI brain hai. Tera naam "harisbot" hai.
Tujhe player ka message analyze karna hai aur SIRF ek valid JSON object return karna hai.
Koi extra text, explanation, ya markdown nahi — sirf raw JSON.

Available actions aur unka format:
- come           → {"action":"come","reply":"..."}
- follow         → {"action":"follow","player":"playerName","reply":"..."}
- stop           → {"action":"stop","reply":"..."}
- go_home        → {"action":"go_home","reply":"..."}
- protect        → {"action":"protect","reply":"..."}
- attack         → {"action":"attack","target":"playerName","reply":"..."}
- mine           → {"action":"mine","block":"block_name","count":5,"reply":"..."}
- place          → {"action":"place","block":"block_name","reply":"..."}
- farm           → {"action":"farm","crop":"wheat","reply":"..."}   (crop: wheat/potatoes/carrots)
- drop_all       → {"action":"drop_all","reply":"..."}
- give           → {"action":"give","item":"all","reply":"..."}
- equip          → {"action":"equip","item":"sword","reply":"..."}
- armor          → {"action":"armor","reply":"..."}
- sleep          → {"action":"sleep","reply":"..."}
- health         → {"action":"health","reply":"..."}
- inventory      → {"action":"inventory","reply":"..."}
- position       → {"action":"position","reply":"..."}
- craft          → {"action":"craft","recipe":"item_name","reply":"..."}
- chat           → {"action":"chat","reply":"jawab urdu mein"}
- unknown        → {"action":"unknown","reply":"Samajh nahi aaya, explain karo"}

Rules:
1. reply field HAMESHA Urdu/Hindi mein hona chahiye aur friendly hona chahiye.
2. block/item names Minecraft ke exact internal names hone chahiye (e.g. "oak_log", "diamond_sword").
3. Agar koi player naam mile toh exact likho.
4. count field sirf mine action mein zaroori hai, default 1 rakh.
`;

async function askAI(username, message) {
  try {
    const resp = await axios.post(
      CONFIG.groq.url,
      {
        model      : CONFIG.groq.model,
        max_tokens : 256,
        temperature: 0.1,
        messages: [
          { role: "system", content: AI_SYSTEM_PROMPT },
          { role: "user",   content: `Player "${username}" ne kaha: "${message}"` },
        ],
      },
      {
        headers : { Authorization: `Bearer ${CONFIG.groq.apiKey}`, "Content-Type": "application/json" },
        timeout : 9000,
      }
    );

    const raw   = resp.data.choices[0].message.content.trim();
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error("JSON nahi mila AI response mein");

    const parsed = JSON.parse(match[0]);
    console.log(`[AI] ${username} → action:"${parsed.action}"`);
    return parsed;

  } catch (err) {
    console.error("[AI Error]", err.message);
    return fallbackParse(message, username);
  }
}

// Fallback: Groq fail ho to basic keyword matching
function fallbackParse(message, username) {
  const m = message.toLowerCase();
  if (m.includes("come")   || m.includes("paas aao"))           return { action:"come",      reply:"Aa raha hoon!" };
  if (m.includes("follow") || m.includes("peeche"))             return { action:"follow",    player: username, reply:"Follow kar raha hoon!" };
  if (m.includes("stop")   || m.includes("ruko"))               return { action:"stop",      reply:"Ruk gaya!" };
  if (m.includes("home")   || m.includes("ghar"))               return { action:"go_home",   reply:"Ghar ja raha hoon!" };
  if (m.includes("protect")|| m.includes("hifazat"))            return { action:"protect",   reply:"Guard mode ON!" };
  if (m.includes("wheat"))                                       return { action:"farm",      crop:"wheat",    reply:"Wheat kaat raha hoon!" };
  if (m.includes("potato") || m.includes("aloo"))               return { action:"farm",      crop:"potatoes", reply:"Aloo kaat raha hoon!" };
  if (m.includes("carrot") || m.includes("gajar"))              return { action:"farm",      crop:"carrots",  reply:"Gajar kaat raha hoon!" };
  if (m.includes("drop"))                                        return { action:"drop_all",  reply:"Saman gira raha hoon!" };
  if (m.includes("armor")  || m.includes("pehan"))              return { action:"armor",     reply:"Armor pehan raha hoon!" };
  if (m.includes("sleep")  || m.includes("so jao"))             return { action:"sleep",     reply:"So raha hoon!" };
  if (m.includes("health"))                                      return { action:"health",    reply:"" };
  if (m.includes("inventory"))                                   return { action:"inventory", reply:"" };
  if (m.includes("give")   || m.includes("de do"))              return { action:"give",      item:"all", reply:"De raha hoon!" };
  return { action:"unknown", reply:"Samajh nahi aaya — 'help' likho!" };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  [6] CORE FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── moveTo: Pathfinder se player ke paas jao ──────────
async function moveTo(playerName) {
  const p = bot.players[playerName];
  if (!p || !p.entity) throw new Error(`${playerName} nazar nahi aa raha`);
  const { x, y, z } = p.entity.position;
  await bot.pathfinder.goto(new GoalNear(x, y, z, 2));
}

// ── autoEquip: Best armor inventory se pehan lo ───────
async function autoEquip() {
  if (armorManager) {
    // Plugin khud best armor equip karega automatically
    bot.chat("🛡️ Armor manager active hai — best armor pehan raha hoon!");
    return;
  }

  // Fallback: manual armor equip
  const armorSlots = {
    head   : ["netherite_helmet","diamond_helmet","iron_helmet","golden_helmet","chainmail_helmet","leather_helmet"],
    torso  : ["netherite_chestplate","diamond_chestplate","iron_chestplate","golden_chestplate","chainmail_chestplate","leather_chestplate"],
    legs   : ["netherite_leggings","diamond_leggings","iron_leggings","golden_leggings","chainmail_leggings","leather_leggings"],
    feet   : ["netherite_boots","diamond_boots","iron_boots","golden_boots","chainmail_boots","leather_boots"],
  };

  let equipped = 0;
  for (const [slot, priority] of Object.entries(armorSlots)) {
    for (const armorName of priority) {
      const item = bot.inventory.items().find((i) => i.name === armorName);
      if (item) {
        try {
          await bot.equip(item, slot);
          equipped++;
          await sleep(300);
          break;
        } catch (_) {}
      }
    }
  }
  bot.chat(equipped > 0
    ? `✅ ${equipped} armor pieces pehan li!`
    : "❌ Koi armor nahi mila inventory mein."
  );
}

// ── performTask: AI JSON → action execute ─────────────
async function performTask(ai, senderName) {
  const { action } = ai;
  const mcData = require("minecraft-data")(bot.version);

  switch (action) {

    // ── COME ────────────────────────────────────────────
    case "come": {
      resetState();
      try {
        await moveTo(senderName);
      } catch (e) {
        bot.chat(`❌ Aa nahi saka kyunki: ${e.message}`);
      }
      break;
    }

    // ── FOLLOW ──────────────────────────────────────────
    case "follow": {
      const targetName = ai.player || senderName;
      const pl = bot.players[targetName];
      if (!pl || !pl.entity) {
        bot.chat(`❌ Follow nahi kar sakta kyunki: ${targetName} nazar nahi aa raha`);
        return;
      }
      resetState();
      STATE.following    = true;
      STATE.followTarget = targetName;
      bot.pathfinder.setGoal(new GoalFollow(pl.entity, 2), true);
      break;
    }

    // ── STOP ────────────────────────────────────────────
    case "stop":
      resetState();
      break;

    // ── GO HOME ─────────────────────────────────────────
    case "go_home":
      resetState();
      bot.pathfinder.setGoal(new GoalXZ(CONFIG.home.x, CONFIG.home.z));
      break;

    // ── PROTECT / GUARD ─────────────────────────────────
    case "protect": {
      resetState();
      STATE.guard = true;
      const sword = bot.inventory.items().find((i) => i.name.includes("sword"));
      if (sword) {
        await bot.equip(sword, "hand");
        bot.chat("🛡️ Sword pakad li — guard mode ON!");
      } else {
        bot.chat("🛡️ Sword nahi mili, par guard mode ON! Khali haath kaafi hain.");
      }
      break;
    }

    // ── ATTACK ──────────────────────────────────────────
    case "attack": {
      const targetName = ai.target || "";
      const tp = bot.players[targetName];
      if (!tp || !tp.entity) {
        bot.chat(`❌ Attack nahi kar sakta kyunki: ${targetName} nazar nahi aa raha`);
        return;
      }
      bot.pvp.attack(tp.entity);
      break;
    }

    // ── MINE ────────────────────────────────────────────
    case "mine": {
      const blockName = (ai.block || "").replace(/ /g, "_");
      const count     = parseInt(ai.count) || 1;
      const blockDef  = mcData.blocksByName[blockName];

      if (!blockDef) {
        bot.chat(`❌ Mine nahi kar sakta kyunki: "${blockName}" valid block nahi hai`);
        return;
      }

      STATE.busy = true;
      bot.chat(`⛏️ ${count}x ${blockName} mine kar raha hoon...`);
      let mined = 0;

      try {
        while (mined < count && STATE.busy) {
          const b = bot.findBlock({ matching: blockDef.id, maxDistance: 32 });
          if (!b) { bot.chat(`⚠️ Aur ${blockName} nahi mili (${mined}/${count} toda)`); break; }

          try {
            await bot.pathfinder.goto(new GoalBlock(b.position.x, b.position.y, b.position.z));
            await bot.dig(b);
            mined++;
            if (mined % 5 === 0) bot.chat(`⛏️ ${mined}/${count} toda...`);
          } catch (e) {
            bot.chat(`❌ Mine nahi kar saka: ${e.message}`);
            break;
          }
          await sleep(200);
        }
        bot.chat(`✅ Mining khatam! Kul ${mined} ${blockName} toda.`);
      } finally {
        STATE.busy = false;
      }
      break;
    }

    // ── PLACE ───────────────────────────────────────────
    case "place": {
      const blockName = (ai.block || "").replace(/ /g, "_");
      const item = bot.inventory.items().find((i) => i.name === blockName);
      if (!item) {
        bot.chat(`❌ Place nahi kar sakta kyunki: "${blockName}" inventory mein nahi hai`);
        return;
      }
      try {
        await bot.equip(item, "hand");
        const ref = bot.blockAt(bot.entity.position.offset(0, -1, 0));
        if (!ref) { bot.chat("❌ Reference block nahi mila place karne ke liye"); return; }
        await bot.placeBlock(ref, new vec3.Vec3(0, 1, 0));
        bot.chat(`✅ ${blockName} rakh diya!`);
      } catch (e) {
        bot.chat(`❌ Place nahi kar saka kyunki: ${e.message}`);
      }
      break;
    }

    // ── FARM ────────────────────────────────────────────
    case "farm": {
      const crop = ai.crop || "wheat";
      if (STATE.farming) { bot.chat("⚠️ Pehle se khet mein hoon!"); return; }
      await farmCrop(crop, mcData);
      break;
    }

    // ── DROP ALL ────────────────────────────────────────
    case "drop_all": {
      const items = bot.inventory.items();
      if (!items.length) { bot.chat("⚠️ Inventory pehle se khali hai!"); return; }
      for (const item of items) {
        try { await bot.tossStack(item); } catch (_) {}
        await sleep(120);
      }
      bot.chat("✅ Saara saman gira diya!");
      break;
    }

    // ── GIVE ────────────────────────────────────────────
    case "give": {
      const pl = bot.players[senderName];
      if (!pl || !pl.entity) { bot.chat("❌ De nahi sakta kyunki: Aap nazar nahi aa rahe"); return; }

      try {
        await moveTo(senderName);
        await sleep(400);
      } catch (_) {}

      const itemName = ai.item || "all";
      const items = itemName === "all"
        ? bot.inventory.items()
        : bot.inventory.items().filter((i) => i.name.includes(itemName.replace(/ /g, "_")));

      if (!items.length) {
        bot.chat(`❌ De nahi sakta kyunki: ${itemName === "all" ? "inventory khali hai" : itemName + " nahi hai"}`);
        return;
      }
      for (const item of items) {
        try { await bot.tossStack(item); } catch (_) {}
        await sleep(120);
      }
      bot.chat(`✅ ${itemName === "all" ? "Saara saman" : itemName} de diya!`);
      break;
    }

    // ── EQUIP (item haath mein pakdo) ───────────────────
    case "equip": {
      const itemName = (ai.item || "").replace(/ /g, "_");
      const item = bot.inventory.items().find((i) => i.name.includes(itemName));
      if (!item) {
        bot.chat(`❌ Equip nahi kar sakta kyunki: "${itemName}" inventory mein nahi`);
        return;
      }
      try {
        await bot.equip(item, "hand");
        bot.chat(`✅ ${item.name} haath mein pakad li!`);
      } catch (e) {
        bot.chat(`❌ Equip nahi kar saka kyunki: ${e.message}`);
      }
      break;
    }

    // ── ARMOR ───────────────────────────────────────────
    case "armor":
      await autoEquip();
      break;

    // ── SLEEP ───────────────────────────────────────────
    case "sleep":
      await trySleep(mcData);
      break;

    // ── CRAFT ───────────────────────────────────────────
    case "craft": {
      const recipeName = (ai.recipe || "").replace(/ /g, "_");
      const mcDataObj = require("minecraft-data")(bot.version);
      const itemDef = mcDataObj.itemsByName[recipeName];
      if (!itemDef) {
        bot.chat(`❌ Craft nahi kar sakta kyunki: "${recipeName}" valid item nahi hai`);
        return;
      }
      const recipes = bot.recipesFor(itemDef.id, null, 1, null);
      if (!recipes.length) {
        bot.chat(`❌ Craft nahi kar sakta kyunki: ${recipeName} ki recipe nahi mili ya materials nahi hain`);
        return;
      }
      try {
        const craftingTable = bot.findBlock({ matching: mcDataObj.blocksByName.crafting_table?.id, maxDistance: 16 });
        await bot.craft(recipes[0], 1, craftingTable || null);
        bot.chat(`✅ ${recipeName} craft ho gaya!`);
      } catch (e) {
        bot.chat(`❌ Craft nahi kar saka kyunki: ${e.message}`);
      }
      break;
    }

    // ── HEALTH ──────────────────────────────────────────
    case "health":
      bot.chat(`❤️ Health: ${Math.round(bot.health)}/20  |  🍗 Food: ${Math.round(bot.food)}/20`);
      break;

    // ── INVENTORY ───────────────────────────────────────
    case "inventory": {
      const items = bot.inventory.items();
      if (!items.length) { bot.chat("🎒 Inventory bilkul khali hai!"); return; }
      const summary = items.map((i) => `${i.name}x${i.count}`).slice(0, 12).join(", ");
      bot.chat(`🎒 ${summary}`);
      break;
    }

    // ── POSITION ────────────────────────────────────────
    case "position": {
      const p = bot.entity.position;
      bot.chat(`📍 X:${Math.round(p.x)}  Y:${Math.round(p.y)}  Z:${Math.round(p.z)}`);
      break;
    }

    // ── CHAT / UNKNOWN ──────────────────────────────────
    case "chat":
    case "unknown":
    default:
      // Reply pehle hi chat mein aa chuki hai
      break;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  [7] FARMING MODULE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function farmCrop(cropKey, mcData) {
  STATE.farming = true;
  STATE.guard   = false;
  STATE.following = false;
  try { bot.pvp.stop(); } catch (_) {}

  const cropMap = {
    wheat    : { block: "wheat",    seed: "wheat_seeds" },
    potatoes : { block: "potatoes", seed: "potato"      },
    carrots  : { block: "carrots",  seed: "carrot"      },
  };

  const def     = cropMap[cropKey] || cropMap.wheat;
  const blockDef = mcData.blocksByName[def.block];
  const doorIds  = getDoorIds(mcData);

  if (!blockDef) {
    bot.chat(`❌ ${def.block} ka data nahi mila!`);
    STATE.farming = false;
    return;
  }

  let harvested = 0;
  bot.chat(`🌾 ${def.block} farming shuru! Ruko...`);

  try {
    while (STATE.farming) {
      const blocks = bot.findBlocks({
        matching    : blockDef.id,
        maxDistance : 48,
        count       : 20,
        useExtraInfo: (b) => b.metadata === 7,
      });

      if (!blocks.length) {
        bot.chat(`✅ Farming khatam! Kul ${harvested} ${def.block} toda.`);
        break;
      }

      blocks.sort(
        (a, b) => bot.entity.position.distanceTo(a) - bot.entity.position.distanceTo(b)
      );

      await openDoorsNearby(doorIds);

      try {
        await bot.pathfinder.goto(new GoalBlock(blocks[0].x, blocks[0].y, blocks[0].z));
      } catch (_) { await sleep(300); continue; }

      await openDoorsNearby(doorIds);

      const block = bot.blockAt(blocks[0]);
      if (block && block.name === def.block && block.metadata === 7) {
        try {
          await bot.dig(block);
          harvested++;
          if (harvested % 5 === 0) bot.chat(`🌾 ${harvested} ${def.block} toda...`);

          await sleep(200);
          const seed = bot.inventory.items().find(
            (i) => i.name === def.seed || i.name.includes("seed")
          );
          if (seed) {
            const farmland = bot.findBlock({ matching: mcData.blocksByName.farmland.id, maxDistance: 3 });
            if (farmland) {
              await bot.equip(seed, "hand");
              try { await bot.placeBlock(farmland, new vec3.Vec3(0, 1, 0)); } catch (_) {}
            }
          }
        } catch (_) {}
      }
      await sleep(100);
    }
  } catch (e) {
    bot.chat(`❌ Farming mein masla: ${e.message}`);
  }

  STATE.farming = false;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  [8] HELPER MODULES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Doors kholna
function getDoorIds(mcData) {
  return [
    "oak_door","spruce_door","birch_door","jungle_door","acacia_door",
    "dark_oak_door","iron_door","oak_fence_gate","spruce_fence_gate",
    "birch_fence_gate","jungle_fence_gate","acacia_fence_gate",
    "dark_oak_fence_gate","fence_gate","crimson_door","warped_door",
  ].map((n) => mcData.blocksByName[n]?.id).filter(Boolean);
}

async function openDoorsNearby(doorIds) {
  if (!doorIds?.length) return;
  const doors = bot.findBlocks({ matching: doorIds, maxDistance: 4, count: 5 });
  for (const pos of doors) {
    const door = bot.blockAt(pos);
    if (door && door.metadata % 2 === 0) {
      try { await bot.activateBlock(door); await sleep(250); } catch (_) {}
    }
  }
}

// Bed dhundh ke so jao
async function trySleep(mcData) {
  const bedIds = Object.keys(mcData.blocksByName)
    .filter((n) => n.endsWith("_bed"))
    .map((n) => mcData.blocksByName[n].id);

  const bed = bot.findBlock({ matching: bedIds, maxDistance: 32 });
  if (!bed) { bot.chat("❌ Koi bed nahi mila aas paas!"); return; }

  try {
    await bot.pathfinder.goto(new GoalBlock(bed.position.x, bed.position.y, bed.position.z));
    await bot.sleep(bed);
    bot.chat("😴 So raha hoon... Zzzz");
  } catch (e) {
    bot.chat(`❌ So nahi saka kyunki: ${e.message}`);
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  [9] ANTI-AFK MODULE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function runAntiAfk() {
  if (!bot || !bot.entity) return;
  if (STATE.farming || STATE.busy) return;
  if (bot.pathfinder.isMoving()) return;

  const adminOnline = CONFIG.admins.some((name) => bot.players[name]);

  if (!adminOnline) {
    // Admin offline → 3 block radius random walk
    const pos   = bot.entity.position;
    const tx    = Math.round(pos.x + (Math.random() - 0.5) * 6);
    const tz    = Math.round(pos.z + (Math.random() - 0.5) * 6);
    try { bot.pathfinder.setGoal(new GoalXZ(tx, tz)); } catch (_) {}
    console.log(`[Anti-AFK] Random walk → X:${tx} Z:${tz}`);
  }

  // Kabhi kabhi jump (admin online ya offline)
  if (Math.random() > 0.5 && !bot.pvp.target) {
    bot.setControlState("jump", true);
    setTimeout(() => bot && bot.setControlState("jump", false), 500);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  [10] BRAIN LOOP — Guard + Follow tick
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function brainTick() {
  if (!bot || !bot.entity) return;

  // Guard: hostile mob attack
  if (STATE.guard) {
    const enemy = bot.nearestEntity(
      (e) =>
        e.type === "mob" &&
        e.kind === "Hostile monsters" &&
        e.position.distanceTo(bot.entity.position) < 16
    );
    if (enemy) { bot.pvp.attack(enemy); return; }
    bot.pvp.stop();
  }

  // Follow: player ke paas raho
  if (STATE.following && STATE.followTarget) {
    const pl = bot.players[STATE.followTarget];
    if (pl && pl.entity) {
      const dist = bot.entity.position.distanceTo(pl.entity.position);
      if (dist > 3) {
        const { x, y, z } = pl.entity.position;
        bot.pathfinder.setGoal(new GoalNear(x, y, z, 2));
      } else {
        bot.pathfinder.setGoal(null);
      }
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  [11] CHAT HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function onChat(username, message) {
  if (username === bot.username) return;
  if (!CONFIG.admins.includes(username)) return;

  console.log(`[Chat] ${username}: ${message}`);
  const msg = message.toLowerCase().trim();

  // Quick commands (AI bypass — instant)
  if (msg === "help" || msg === "commands") {
    bot.chat(
      "📋 Commands (Urdu/Hindi mein bolo ya likho!): " +
      "come | follow | stop | ghar jao | protect me | [naam] attack karo | " +
      "mine [block] [count] | farm wheat/potato/carrot | drop all | " +
      "give [item/all] | armor pehan | sleep | health | inventory | position | craft [item]"
    );
    return;
  }

  // AI se pucho
  bot.chat("🤔 ...");
  const ai = await askAI(username, message);

  // AI ki reply
  if (ai.reply) bot.chat(ai.reply);

  // Action execute karo
  try {
    await performTask(ai, username);
  } catch (e) {
    bot.chat(`❌ Kaam nahi ho saka kyunki: ${e.message}`);
    console.error("[Task Error]", e);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  [12] BOT INIT — Events + Plugins + Reconnect
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function initBot() {
  if (_reconnecting) return;
  console.log(`\n[Bot] Connecting → ${CONFIG.server.host}:${CONFIG.server.port}`);

  bot = mineflayer.createBot({
    host    : CONFIG.server.host,
    port    : CONFIG.server.port,
    username: CONFIG.server.user,
    version : CONFIG.server.version,
    auth    : CONFIG.server.auth,
    checkTimeoutInterval: 60000,
    keepAlive: true,
  });

  // ── Load Plugins ──
  bot.loadPlugin(pathfinder);
  bot.loadPlugin(collectBlock);
  bot.loadPlugin(pvp);
  if (armorManager) bot.loadPlugin(armorManager);

  // ── LOGIN ──
  bot.on("login", () => console.log(`[Bot] ✅ ${bot.username} logged in!`));

  // ── SPAWN ──
  bot.on("spawn", () => {
    console.log("🟢 Spawned in world!");
    _reconnecting = false;

    const mcData    = require("minecraft-data")(bot.version);
    const movements = new Movements(bot, mcData);
    movements.canDig          = true;
    movements.allow1by1towers = false;
    bot.pathfinder.setMovements(movements);

    bot.chat("Salam! 🤖 AI Companion ready. Natural Urdu/Hindi mein bolo — main samajh lunga!");

    // Clear old intervals
    if (_brainTick) clearInterval(_brainTick);
    if (_afkTick)   clearInterval(_afkTick);

    _brainTick = setInterval(brainTick,   CONFIG.brainInterval);
    _afkTick   = setInterval(runAntiAfk,  CONFIG.afkInterval);
  });

  // ── CHAT ──
  bot.on("chat", onChat);

  // ── HEALTH ──
  bot.on("health", () => {
    if (bot.health <= 5)
      bot.chat(`⚠️ Health bahut kam hai! ${Math.round(bot.health)}/20`);
  });

  // ── DEATH ──
  bot.on("death", () => {
    console.log("[Bot] Died!");
    resetState();
    bot.chat("😵 Main mar gaya... dobara aa raha hoon!");
  });

  // ── KICKED — Auto Reconnect ──
  bot.on("kicked", (reason) => {
    console.log(`[Bot] ⚡ Kicked: ${reason}`);
    scheduleReconnect();
  });

  // ── ERROR ──
  bot.on("error", (err) => {
    console.error("[Bot] ❌", err.message);
  });

  // ── END — Auto Reconnect ──
  bot.on("end", (reason) => {
    console.log(`[Bot] Disconnected: ${reason || "unknown"}`);
    scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (_reconnecting) return;
  _reconnecting = true;
  resetState();
  if (_brainTick) { clearInterval(_brainTick); _brainTick = null; }
  if (_afkTick)   { clearInterval(_afkTick);   _afkTick   = null; }
  const delay = CONFIG.reconnectDelay;
  console.log(`[Bot] 🔁 ${delay / 1000}s mein reconnect hoga...`);
  setTimeout(() => { _reconnecting = false; initBot(); }, delay);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  [13] START
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
initBot();
