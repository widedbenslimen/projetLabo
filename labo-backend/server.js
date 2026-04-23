require('dotenv').config();
const express = require('express');
const pool = require("./config/db");
const bcrypt = require('bcryptjs');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('❌ Erreur PostgreSQL:', err);
    process.exit(1);
  } else {
    console.log('✅ Connecté à PostgreSQL');
  }
});


// Route test
app.get("/", (req, res) => {
  res.send("Backend working");
});

// Servir les fichiers uploadés de manière statique
const path = require('path');

// Assurez-vous que cette ligne est placée APRÈS vos middlewares mais AVANT vos routes
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes : inscription
const inscriptionRoutes = require("./routes/inscription");
app.use("/api", inscriptionRoutes);

// Routes : inscription
const connexionRoutes = require("./routes/connexion");
app.use("/api", connexionRoutes);

// Routes : admin
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);


// Routes : document
const documentRoutes = require("./routes/document");
app.use("/api/documents", documentRoutes);

// Routes : projet
const projetRoutes = require("./routes/projet");
app.use("/api/projet", projetRoutes);  

const utilisateurRoutes = require("./routes/utilisateur");
app.use("/api/utilisateur", utilisateurRoutes);

const rapportRouter = require("./routes/rapport");
app.use("/api/rapport", rapportRouter);


// 404
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint non trouvé" });
});


// Démarrer le serveur
app.listen(8000, () => {
  console.log('🚀 Serveur démarré sur http://localhost:8000');
});
