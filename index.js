const mineflayer = require("mineflayer");
const express = require("express");
const app = express();
const vec3 = require("vec3");

// Plugins load karna
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder");
const collectBlock = require("mineflayer-collectblock");
const pvp = require("mineflayer-pvp").plugin;

const botArgs = {
  host: "myworld222.aternos.me",
  port: 14406,
  username: "haris bot",
  version: "1.19.4",
  auth: "offline",
};

// 🏠 APNE GHAR KE COORDINATES YAHAN LIKHEIN
const HOME_COORDINATES = {
  x: 44.0, // Ghar ka X
  y: 74.0, // Ghar ka Y
  z: -213.0, // Ghar ka Z
};

// Admins List
const admins = ["Harisxgamer", "yasirxgamez"];

let bot;
let guardMode = false;

function initBot() {
  console.log(`\n[Bot] Connecting to ${botArgs.host}:${botArgs.port}...`);
  bot = mineflayer.createBot(botArgs);

  bot.loadPlugin(pathfinder);
  bot.loadPlugin(collectBlock);
  bot.loadPlugin(pvp);

  bot.on("login", () => {
    console.log(`[Bot] ${bot.username} sabhi features ke sath online hai!`);
  });

  bot.on("spawn", () => {
    console.log("🟢 SUCCESS: Ultra Bot joined the world!");

    // 🔄 AUTOMATIC BRAIN LOOP (Har 5 seconds baad check karega)
    setInterval(() => {
      if (!bot || !bot.entity) return;

      // 1. PROTECT MODE: Agar guard mode ON hai to dushman par attack karo
      if (guardMode) {
        const mobFilter = (e) =>
          e.type === "mob" &&
          e.kind === "Hostile monsters" &&
          e.position.distanceTo(bot.entity.position) < 16;
        const enemy = bot.nearestEntity(mobFilter);
        if (enemy) {
          bot.pvp.attack(enemy);
          return;
        }
      }

      // 2. SMART ANTI-AFK: Agar aap dono server mein nahi hain, to 3-block area mein chalega
      const adminOnline = admins.some(
        (name) => bot.players[name] !== undefined
      );

      if (!adminOnline) {
        // Agar aap dono offline hain, to 3-block area mein ghoome ga taaki ban na ho
        if (!bot.pathfinder.isMoving()) {
          const moves = ["forward", "back", "left", "right"];
          const randomMove = moves[Math.floor(Math.random() * moves.length)];

          bot.setControlState(randomMove, true);
          setTimeout(() => {
            if (bot) bot.setControlState(randomMove, false);
          }, 400);

          if (Math.random() > 0.5) {
            bot.setControlState("jump", true);
            setTimeout(() => {
              if (bot) bot.setControlState("jump", false);
            }, 500);
          }
        }
      } else {
        // Agar aap online hain aur bot khali khada hai, to normal jump karega
        if (!bot.pathfinder.isMoving() && !bot.pvp.target) {
          bot.setControlState("jump", true);
          setTimeout(() => {
            if (bot) bot.setControlState("jump", false);
          }, 400);
        }
      }
    }, 5000);
  });

  // ── CHAT & COMMAND SYSTEM ───────────────────────────────────────────
  bot.on("chat", async (username, message) => {
    if (username === bot.username) return;

    // Security Check
    if (!admins.includes(username)) return;

    const msg = message.toLowerCase();
    const mcData = require("minecraft-data")(bot.version);

    // 1. BAATEIN KARNA
    if (msg.includes("hello") || msg.includes("hi")) {
      bot.chat(`Hello ${username}! Kya hukam hai boss?`);
    } else if (msg.includes("tumhe kisne banaya")) {
      bot.chat("Mujhe Haris aur Yasir ne banaya hai!");
    }

    // 2. MERE PAAS AAO
    else if (msg === "mera pass aao" || msg === "come") {
      bot.pvp.stop();
      guardMode = false;
      const player = bot.players[username];
      if (!player || !player.entity) {
        bot.chat("Main aap ko dekh nahi pa raha hoon!");
        return;
      }
      bot.chat("Ji, main aa raha hoon...");
      const defaultMove = new Movements(bot, mcData);
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new goals.GoalFollow(player.entity, 1), true);
    }

    // 3. GHAR CHALO
    else if (msg === "ghar chalo" || msg === "go home") {
      bot.pvp.stop();
      guardMode = false;
      bot.chat("Main ghar ja raha hoon, mere peeche aayein...");
      const defaultMove = new Movements(bot, mcData);
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(
        new goals.GoalXZ(HOME_COORDINATES.x, HOME_COORDINATES.z)
      );
    }

    // 4. HIFAZAT KARO (PROTECT ME) WITH SMART WEAPON SCAN
    else if (msg === "protect me" || msg === "hifazat karo") {
      guardMode = true;

      // Sword check karna
      const sword = bot.inventory
        .items()
        .find((item) => item.name.includes("sword"));

      if (sword) {
        await bot.equip(sword, "hand");
        bot.chat(
          "🛡️ Guard Mode ON! Maine sword pakad li hai aur aapki hifazat ke liye taiyar hoon!"
        );
      } else {
        bot.chat(
          "🛡️ Guard Mode ON! Mere paas sword nahi hai, lekin main khali haath (hand) se hi aapki hifazat karunga!"
        );
      }
    }

    // 5. SAMAN PAKDO (Hold Item)
    else if (msg.startsWith("pakdo ") || msg.startsWith("hold ")) {
      const itemName = msg
        .replace("pakdo ", "")
        .replace("hold ", "")
        .trim()
        .replace(" ", "_");
      const item = bot.inventory.items().find((i) => i.name.includes(itemName));

      if (item) {
        await bot.equip(item, "hand");
        bot.chat(`Maine ${item.name} haath mein pakad li hai!`);
      } else {
        bot.chat(`Mere inventory mein ${itemName} naam ka koi saman nahi hai.`);
      }
    }

    // 6. SAMAN DROP KARO
    else if (msg === "drop" || msg === "saman feko") {
      const items = bot.inventory.items();
      if (items.length === 0) {
        bot.chat("Meri inventory pehle se khali hai!");
        return;
      }
      bot.chat("Main apna saara saman drop kar raha hoon...");
      for (const item of items) {
        try {
          await bot.tossStack(item);
        } catch (err) {
          // Chunk delay error ignore karne ke liye
        }
      }
      bot.chat("Maine saara saman drop kar diya! 👍");
    }

    // 7. RUKO / STOP
    else if (msg === "ruko" || msg === "stop") {
      guardMode = false;
      bot.pvp.stop();
      bot.pathfinder.setGoal(null);
      bot.chat("Maine saare kaam rok diye hain.");
    }

    // 8. AUTO FARMING (WHEAT)
    else if (msg === "farm" || msg === "wheat todo") {
      bot.chat("Main paki hui wheat dhoond raha hoon...");
      const wheatBlock = bot.findBlock({
        matching: mcData.blocksByName.wheat.id,
        maxDistance: 32,
        useExtraInfo: (block) => block.metadata === 7,
      });

      if (!wheatBlock) {
        bot.chat("Aas paas koi paki hui wheat nahi mili!");
        return;
      }

      try {
        await bot.collectBlock.collect(wheatBlock);
        bot.chat("Wheat tor li!");
        const seedItem = bot.inventory
          .items()
          .find((item) => item.name.includes("seed"));
        if (seedItem) {
          const farmland = bot.findBlock({
            matching: mcData.blocksByName.farmland.id,
            maxDistance: 5,
          });
          if (farmland) {
            await bot.equip(seedItem, "hand");
            await bot.placeBlock(farmland, new vec3.Vec3(0, 1, 0));
            bot.chat("Naya seed bhi laga diya!");
          }
        }
      } catch (err) {
        console.log("Farming error:", err.message);
      }
    }

    // 🥔 9. POTATO FARMING
    else if (msg === "potato todo" || msg === "aloo toro") {
      bot.chat("Main pake hue potatoes check karta hoon...");
      const potatoBlock = bot.findBlock({
        matching: mcData.blocksByName.potatoes.id,
        maxDistance: 32,
        useExtraInfo: (block) => block.metadata === 7,
      });

      if (!potatoBlock) {
        bot.chat("Aas paas koi pake hue potatoes nahi mile!");
        return;
      }

      try {
        await bot.collectBlock.collect(potatoBlock);
        bot.chat("Potatoes tor liye hain! 🥔");
        const potatoItem = bot.inventory
          .items()
          .find((item) => item.name === "potato");
        if (potatoItem) {
          const farmland = bot.findBlock({
            matching: mcData.blocksByName.farmland.id,
            maxDistance: 5,
          });
          if (farmland) {
            await bot.equip(potatoItem, "hand");
            await bot.placeBlock(farmland, new vec3.Vec3(0, 1, 0));
            bot.chat("Wahan naya potato bhi laga diya!");
          }
        }
      } catch (err) {
        console.log("Potato Farming error:", err.message);
      }
    }

    // 🥕 10. CARROT FARMING
    else if (msg === "carrot todo" || msg === "gajar toro") {
      bot.chat("Main paki hui carrots check karta hoon...");
      const carrotBlock = bot.findBlock({
        matching: mcData.blocksByName.carrots.id,
        maxDistance: 32,
        useExtraInfo: (block) => block.metadata === 7,
      });

      if (!carrotBlock) {
        bot.chat("Aas paas koi paki hui carrots nahi milin!");
        return;
      }

      try {
        await bot.collectBlock.collect(carrotBlock);
        bot.chat("Carrots tor li hain! 🥕");
        const carrotItem = bot.inventory
          .items()
          .find((item) => item.name === "carrot");
        if (carrotItem) {
          const farmland = bot.findBlock({
            matching: mcData.blocksByName.farmland.id,
            maxDistance: 5,
          });
          if (farmland) {
            await bot.equip(carrotItem, "hand");
            await bot.placeBlock(farmland, new vec3.Vec3(0, 1, 0));
            bot.chat("Wahan nayi carrot bhi laga di hai!");
          }
        }
      } catch (err) {
        console.log("Carrot Farming error:", err.message);
      }
    }
  });

  bot.on("end", (reason) => {
    console.log(`[Bot] Disconnected. 10s mein reconnecting...`);
    setTimeout(initBot, 10000);
  });
}

initBot();

app.get("/", (req, res) => {
  res.send(`<h1>Ultra Smart Bot is Running!</h1>`);
});
app.listen(3000, () => {
  console.log("Dashboard Online");
});
