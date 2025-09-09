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

// Middleware
app.use(requestIp.mw());
app.use(useragent.express());
app.use(express.static("public")); // dossier pour index.html

// Vérifier si l'IP est locale
function isPrivateIP(ip) {
  return /^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) || ip === "127.0.0.1";
}

// Fonction pour récupérer hostname via NetBIOS
function getHostnameNetBIOS(ip, callback) {
  exec(`nbtstat -A ${ip}`, (err, stdout) => {
    if (err) return callback(null);
    const match = stdout.match(/<20>\s+UNIQUE\s+(\S+)/);
    callback(match ? match[1] : null);
  });
}

// Fonction pour récupérer hostname
function getHostname(ip, callback) {
  getHostnameNetBIOS(ip, (nbtHostname) => {
    if (nbtHostname) return callback(nbtHostname);
    dns.reverse(ip.replace("::ffff:", ""), (err, hostnames) => {
      if (!err && hostnames.length > 0) return callback(hostnames[0]);
      callback("Inconnu");
    });
  });
}

// Fonction pour localiser l'IP via ip-api.com
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

// Route principale : renvoie la page vidéo côté client
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "sv-js", "index.html"));
});

// Middleware pour logger infos côté serveur
app.use((req, res, next) => {
  const ip = req.clientIp || req.ip;
  const realIp = ip.includes("::ffff:") ? ip.replace("::ffff:", "") : (ip === "::1" ? "127.0.0.1" : ip);
  const ua = req.useragent;

  // Envoyer la page tout de suite
  next();

  // Récupération des infos en arrière-plan
  (async () => {
    const hostname = await new Promise(resolve => getHostname(realIp, resolve));
    let localisation = {};
    if (!isPrivateIP(realIp)) {
      localisation = await localiserIP(realIp);
    }

    const infos = {
      ip: realIp,
      hostname: hostname,
      localisation: localisation,
      navigateur: ua.browser,
      os: ua.os,
      plateforme: ua.platform,
      mobile: ua.isMobile,
      tablette: ua.isTablet,
      desktop: ua.isDesktop,
    };

    console.log("Nouvelle visite :", infos);
  })();
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Serveur en écoute sur http://localhost:${PORT}`);
});
