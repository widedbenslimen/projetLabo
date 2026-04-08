// routes/document.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const auth = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ─────────────────────────────
// Types documents
// ─────────────────────────────
const DOCUMENT_TYPES = [
  "ENQUETE", "RAPPORT", "IMAGE", "VIDEO", "CARTE", "ARTICLE"
];

// ─────────────────────────────
// Upload configuration
// ─────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/documents";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
   filename: (req, file, cb) => {
    const unique = Date.now() + "_" + file.originalname.replace(/\s+/g, '_');
    cb(null, unique);
  }
});

const fileFilter = (req, file, cb) => {
  const documentType = req.body.type;
  const allowedTypes = {
    'ENQUETE': /pdf|doc|docx|txt|xls|xlsx/,
    'RAPPORT': /pdf|doc|docx|txt/,
    'IMAGE':   /jpg|jpeg|png|gif|bmp|svg/,
    'VIDEO':   /mp4|avi|mov|wmv|flv|mkv/,
    'CARTE':   /pdf|jpg|jpeg|png|geojson|kml|kmz/,
    'ARTICLE': /pdf|doc|docx|txt/
  };
  if (!documentType || !allowedTypes[documentType]) {
    return cb(new Error('Type de document non spécifié ou invalide'));
  }

  const extname = allowedTypes[documentType].test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes[documentType].test(file.mimetype);
  
  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error(`Type de fichier non supporté pour le document de type ${documentType}`));
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } 
});

// ─────────────────────────────
// Middleware checkDocumentAccess
// Utilisé pour PUT et DELETE uniquement
// ─────────────────────────────
const checkDocumentAccess = async (req, res, next) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole === 'ADMIN') {
      return next();
    }


    const document = await pool.query(
      'SELECT auteur_id FROM document WHERE id = $1',
      [documentId]
    );

    if (document.rows.length === 0){
      return res.status(404).json({ message: 'Document non trouvé' });
    }

    if (userRole === 'INVITE'){
      return res.status(403).json({ message: 'Accès non autorisé' });
  }
    if (userRole === 'CHERCHEUR' || userRole === 'CADRE_TECHNIQUE') {
      if (document.rows[0].auteur_id === userId) {
        return next();
      } else {
        return res.status(403).json({ message: 'Vous ne pouvez modifier que vos propres documents' });
      }
    }
    next();
  } catch (error) {
    console.error('Erreur checkDocumentAccess:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─────────────────────────────
// Middleware checkParticipant
// ─────────────────────────────
const checkParticipant = async (req, res, next) => {
  try {
    const userRole = req.user.role?.toUpperCase();
    const userId = req.user.id;
    const projetId = req.body.projet_id;

    if (userRole === 'ADMIN') return next();
    if (userRole === 'INVITE') 
      return res.status(403).json({ error: 'Accès refusé' });
    if (!projetId) return next();

    const p = await pool.query(
      'SELECT 1 FROM participation WHERE projet_id = $1 AND utilisateur_id = $2',
      [projetId, userId]
    );
    if (p.rows.length === 0)
      return res.status(403).json({ 
        error: 'Vous devez être participant du projet pour y ajouter un document' 
      });

    next();
  } catch (err) {
    console.error('checkParticipant:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// ══════════════════════════════════════════════════════════════════
// ⚠️  ROUTES STATIQUES EN PREMIER (avant /:id)
// ══════════════════════════════════════════════════════════════════

// ─────────────────────────────
// SEARCH SIMPLE
// ─────────────────────────────
router.get("/search/simple", auth, async (req, res) => {
  try {
    const { q } = req.query;
    const userRole = req.user.role;
    const userId = req.user.id;

    if (!q) return res.status(400).json({ error: "Terme de recherche requis" });

    let query = `
      SELECT d.*, u.nom as auteur_nom, u.email as auteur_email, p.titre as projet_titre
      FROM document d
      LEFT JOIN utilisateur u ON d.auteur_id = u.id
      LEFT JOIN projet p ON d.projet_id = p.id
      WHERE (d.titre ILIKE $1 OR d.description ILIKE $1 OR d.mots_cles ILIKE $1)
    `;
    let params = [`%${q}%`];
    let idx = 2;

    if (userRole === 'ADMIN') {
      // ADMIN voit tout
    } else if (userRole === 'INVITE' || userRole === 'CHERCHEUR' || userRole === 'CADRE_TECHNIQUE') {
      // Voit les documents visibles + ses propres (si chercheur/cadre)
      if (userRole === 'INVITE') {
        query += ` AND d.visibilite = true`;
      } else {
        query += ` AND (d.auteur_id = $${idx} OR d.visibilite = true)`;
        params.push(userId);
        idx++;
      }
    }

    query += ' ORDER BY d.date_creation DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur recherche" });
  }
});

// ─────────────────────────────
// SEARCH ADVANCED
// ─────────────────────────────
router.get("/search/advanced", auth, async (req, res) => {
  try {
    const { titre, type, mots, auteur, projet, date_debut, date_fin } = req.query;
    const userRole = req.user.role;
    const userId = req.user.id;

    let query = `
      SELECT d.*, u.nom as auteur_nom, u.email as auteur_email, p.titre as projet_titre
      FROM document d
      LEFT JOIN utilisateur u ON d.auteur_id = u.id
      LEFT JOIN projet p ON d.projet_id = p.id
      WHERE 1=1
    `;
    let values = [];
    let idx = 1;

    if (titre)  { values.push(`%${titre}%`); query += ` AND d.titre ILIKE $${idx++}`; }
    if (type && DOCUMENT_TYPES.includes(type)) { values.push(type); query += ` AND d.type = $${idx++}`; }
    if (mots)   { values.push(`%${mots}%`);  query += ` AND d.mots_cles ILIKE $${idx++}`; }
    if (auteur) { values.push(`%${auteur}%`); query += ` AND u.nom ILIKE $${idx++}`; }
    if (projet) { values.push(`%${projet}%`); query += ` AND p.titre ILIKE $${idx++}`; }
    if (date_debut) { values.push(date_debut); query += ` AND d.date_creation >= $${idx++}`; }
    if (date_fin)   { values.push(date_fin);   query += ` AND d.date_creation <= $${idx++}`; }

    // ── Logique de visibilité ──
    if (userRole === 'ADMIN') {
      // Voit tout
    } else if (userRole === 'INVITE') {
      query += ` AND d.visibilite = true`;
    } else {
      values.push(userId);
      query += ` AND (d.auteur_id = $${idx++} OR d.visibilite = true)`;
    }

    query += ' ORDER BY d.date_creation DESC';
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur recherche avancée" });
  }
});

// ─────────────────────────────
// STATS (admin only)
// ─────────────────────────────
router.get("/stats/global", auth, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN')
      return res.status(403).json({ error: "Accès réservé à l'administrateur" });

    const stats = await pool.query(`
      SELECT type,
        COUNT(*) as total,
        COUNT(CASE WHEN visibilite = true THEN 1 END) as visibles
      FROM document
      GROUP BY type
      ORDER BY type;
    `);
    const totalStats = await pool.query(`
      SELECT COUNT(*) as total_documents,
        COUNT(DISTINCT auteur_id) as total_auteurs,
        MIN(date_creation) as premier_document,
        MAX(date_creation) as dernier_document
      FROM document
    `);
    res.json({ global: totalStats.rows[0], par_type: stats.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur statistiques" });
  }
});

// ─────────────────────────────
// GET BY TYPE
// ─────────────────────────────
router.get("/type/:type", auth, async (req, res) => {
  try {
    const { type } = req.params;
    const userRole = req.user.role;
    const userId = req.user.id;

    if (!DOCUMENT_TYPES.includes(type))
      return res.status(400).json({ error: 'Type de document invalide' });

    let query = `
      SELECT d.*, u.nom as auteur_nom, u.email as auteur_email, p.titre as projet_titre
      FROM document d
      LEFT JOIN utilisateur u ON d.auteur_id = u.id
      LEFT JOIN projet p ON d.projet_id = p.id
      WHERE d.type = $1
    `;
    let params = [type];

    if (userRole === 'ADMIN') {
      // tout
    } else if (userRole === 'INVITE') {
      query += ` AND d.visibilite = true`;
    } else {
      query += ` AND (d.auteur_id = $2 OR d.visibilite = true)`;
      params.push(userId);
    }

    query += ' ORDER BY d.date_creation DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur récupération par type" });
  }
});

// ─────────────────────────────
// GET BY PROJECT
// ─────────────────────────────
router.get("/projet/:projetId", auth, async (req, res) => {
  try {
    const { projetId } = req.params;
    const userRole = req.user.role;
    const userId = req.user.id;

    let query = `
      SELECT d.*, u.nom as auteur_nom, u.email as auteur_email, p.titre as projet_titre
      FROM document d
      LEFT JOIN utilisateur u ON d.auteur_id = u.id
      LEFT JOIN projet p ON d.projet_id = p.id
      WHERE d.projet_id = $1
    `;
    let params = [projetId];

    if (userRole === 'ADMIN') {
      // tout
    } else if (userRole === 'INVITE') {
      query += ` AND d.visibilite = true`;
    } else {
      query += ` AND (d.auteur_id = $2 OR d.visibilite = true)`;
      params.push(userId);
    }

    query += ' ORDER BY d.date_creation DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur récupération par projet" });
  }
});

// ══════════════════════════════════════════════════════════════════
// ROUTES PRINCIPALES
// ══════════════════════════════════════════════════════════════════

// ─────────────────────────────
// GET ALL
// ─────────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user.id;

    let query = `
      SELECT d.*, u.nom as auteur_nom, u.email as auteur_email, p.titre as projet_titre
      FROM document d
      LEFT JOIN utilisateur u ON d.auteur_id = u.id
      LEFT JOIN projet p ON d.projet_id = p.id
    `;
    let params = [];

    if (role === 'ADMIN') {
      query += ' ORDER BY d.date_creation DESC';
    } else if (role === 'CHERCHEUR' || role === 'CADRE_TECHNIQUE') {
      // Ses propres docs + les docs visibles des autres
      query += ` WHERE (d.auteur_id = $1 OR d.visibilite = true) ORDER BY d.date_creation DESC`;
      params = [userId];
    } else {
      // INVITE : uniquement visibles
      query += ` WHERE d.visibilite = true ORDER BY d.date_creation DESC`;
    }

    const result = await pool.query(query, params);
    result.rows = result.rows.map(doc => ({
      ...doc,
      url_acces: doc.lien ? `/uploads/documents/${path.basename(doc.lien)}` : null
    }));

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ─────────────────────────────
// GET BY ID
// ─────────────────────────────
router.get("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const role = req.user.role;
    const userId = req.user.id;

    let query = `
      SELECT d.*, u.nom as auteur_nom, u.email as auteur_email, p.titre as projet_titre
      FROM document d
      LEFT JOIN utilisateur u ON d.auteur_id = u.id
      LEFT JOIN projet p ON d.projet_id = p.id
      WHERE d.id = $1
    `;
    let params = [id];

    if (role === 'INVITE') {
      query += ' AND d.visibilite = true';
    } else if (role !== 'ADMIN') {
      query += ' AND (d.auteur_id = $2 OR d.visibilite = true)';
      params.push(userId);
    }

    const doc = await pool.query(query, params);
    if (doc.rows.length === 0)
      return res.status(404).json({ error: "Document introuvable ou accès non autorisé" });

    res.json(doc.rows[0]);
  } catch (err) {
    console.error("Erreur GET document by id:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────
// CREATE
// ─────────────────────────────
// routes/document.js - Version corrigée du POST

router.post("/", auth, upload.single("file"), async (req, res) => {
  try {
    const role = req.user.role;
    if (role === "INVITE") {
      return res.status(403).json({ error: "Accès refusé" });
    }

    const {
      titre, description, mots_cles, type, projet_id,
      doi, resume, citation_APA, sous_type, journal, maison_edition,
      resolution, format,
      visibilite
    } =req.body;
if (!DOCUMENT_TYPES.includes(type)) return res.status(400).json({ error: "Type document invalide" });
    if (!titre) return res.status(400).json({ error: "Le titre est requis" });

    if (type === 'ARTICLE' && !['JOURNAL', 'CONFERENCE'].includes(sous_type)) {
      return res.status(400).json({ error: "sous_type requis pour ARTICLE : JOURNAL ou CONFERENCE" });
    }

    const lien = req.file ? req.file.path : null;
    // Valeurs par défaut
    const docVisibilite = visibilite === 'true' || visibilite === true || visibilite === '1';
    const docSousType = type === 'ARTICLE' ? (sous_type || null) : null;
    const docDoi = (type === 'ARTICLE' || type === 'RAPPORT') ? (doi || null) : null;
    const docResume = type === 'ARTICLE' ? (resume || null) : null;
    const docCitationAPA = type === 'ARTICLE' ? (citation_APA || null) : null;
    const docJournal = type === 'ARTICLE' ? (journal || null) : null;
    const docMaisonEdit = type === 'ARTICLE' ? (maison_edition || null) : null;
    const docResolution = type === 'IMAGE' ? (resolution || null) : null;
    const docFormat = type === 'IMAGE' ? (format || null) : null;
    const docTaille = type === 'IMAGE' && req.file ? req.file.size : null;

    console.log("Creating document with data:", {
      titre,
      type,
      visibilite: docVisibilite,
      userId: req.user.id,
      hasFile: !!req.file
    });

    const result = await pool.query(
      `INSERT INTO document
        (titre, description, mots_cles, type, sous_type,
         auteur_id, projet_id, lien,
         doi, resume, citation_APA, journal, maison_edition,
         resolution, format, taille,
         visibilite,
         date_creation, date_modification)
       VALUES
        ($1,$2,$3,$4,$5, $6,$7,$8, $9,$10,$11,$12,$13, $14,$15,$16, $17, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        titre, description || null, mots_cles || null, type, docSousType,
        req.user.id, projet_id || null, lien,
        docDoi, docResume, docCitationAPA, docJournal, docMaisonEdit,
        docResolution, docFormat, docTaille,
        docVisibilite
      ]
    );

    res.status(201).json({
      success: true,
      message: "Document créé avec succès",
      document: result.rows[0]
    });
    
  } catch (err) {
    console.error("Erreur création document:", err);
    // Envoyer un message d'erreur plus détaillé en développement
    res.status(500).json({ 
      error: "Erreur lors de la création du document",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});
// ─────────────────────────────
// UPDATE
// ─────────────────────────────
router.put("/:id", auth, checkDocumentAccess, upload.single("file"), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      titre, description, mots_cles, projet_id,
      doi, resume, citation_APA, journal, maison_edition,
      resolution, format,
      visibilite   
    } = req.body;

    const docResult = await pool.query("SELECT * FROM document WHERE id=$1", [id]);
    if (docResult.rows.length === 0) return res.status(404).json({ error: "Document introuvable" });
    const document = docResult.rows[0];

    let lien = document.lien;
    const updates = [];
    const values = [];
    let idx = 1;
    if (req.file) {
      // Supprimer l'ancien fichier s'il existe
      if (document.lien && fs.existsSync(document.lien)) {
        fs.unlinkSync(document.lien);
      }
      lien = req.file.path;
      updates.push(`lien = $${idx++}`);
      values.push(lien);
    } else if (req.body.lien === "" && document.lien && fs.existsSync(document.lien)) {
      // Si l'utilisateur veut supprimer le fichier
      fs.unlinkSync(document.lien);
      lien = null;
      updates.push(`lien = $${idx++}`);
      values.push(null);
    }

    if (titre !== undefined)       { updates.push(`titre = $${idx++}`);       values.push(titre); }
    if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description === "" ? null : description); }
    if (mots_cles !== undefined)   { updates.push(`mots_cles = $${idx++}`);   values.push(mots_cles === "" ? null : mots_cles); }
    if (projet_id !== undefined)   { updates.push(`projet_id = $${idx++}`);   values.push(projet_id === "" || projet_id === "null" ? null : projet_id); }

    // ── visibilite : n'importe quel rôle autorisé peut toggle son propre doc ──
    if (visibilite !== undefined) { updates.push(`visibilite = $${idx++}`); values.push(visibilite === 'true' || visibilite === true); }

    

    if (document.type === 'ARTICLE') {
      if (doi !== undefined)          { updates.push(`doi = $${idx++}`);           values.push(doi === "" ? null : doi); }
      if (resume !== undefined)       { updates.push(`resume = $${idx++}`);        values.push(resume === "" ? null : resume); }
      if (citation_APA !== undefined) { updates.push(`citation_APA = $${idx++}`); values.push(citation_APA === "" ? null : citation_APA); }
      if (journal !== undefined)      { updates.push(`journal = $${idx++}`);       values.push(journal === "" ? null : journal); }
      if (maison_edition !== undefined) { updates.push(`maison_edition = $${idx++}`); values.push(maison_edition === "" ? null : maison_edition); }
    }
    if (document.type === 'IMAGE') {
      if (resolution !== undefined) { updates.push(`resolution = $${idx++}`); values.push(resolution === "" ? null : resolution); }
      if (format !== undefined)     { updates.push(`format = $${idx++}`);     values.push(format === "" ? null : format); }
      if (req.file)                 { updates.push(`taille = $${idx++}`);     values.push(req.file.size); }
    }

    updates.push(`date_modification = CURRENT_TIMESTAMP`);

    if (updates.length === 1) return res.status(400).json({ error: "Aucune donnée à mettre à jour" });

    values.push(id);
    const result = await pool.query(
      `UPDATE document SET ${updates.join(', ')} WHERE id=$${values.length} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur modification document" });
  }
});

// ─────────────────────────────
// DELETE
// ─────────────────────────────
router.delete("/:id", auth, checkDocumentAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const docResult = await pool.query('SELECT lien FROM document WHERE id = $1', [id]);

    if (docResult.rows.length > 0 && docResult.rows[0].lien) {
      try {
        if (fs.existsSync(docResult.rows[0].lien)) fs.unlinkSync(docResult.rows[0].lien);
      } catch (fileError) {
        console.error('Erreur suppression fichier:', fileError);
      }
    }

    await pool.query("DELETE FROM document WHERE id=$1", [id]);
    res.json({ message: "Document supprimé avec succès" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur suppression" });
  }
});

// ─────────────────────────────
// DOWNLOAD
// ─────────────────────────────
router.get("/:id/download", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role;
    const userId = req.user.id;

    let query = '';
    let params = [id];

    if (userRole === 'ADMIN') {
      query = 'SELECT lien, titre FROM document WHERE id = $1';
    } else if (userRole === 'INVITE') {
      query = 'SELECT lien, titre FROM document WHERE id = $1 AND visibilite = true';
    } else {
      query = 'SELECT lien, titre FROM document WHERE id = $1 AND (auteur_id = $2 OR visibilite = true)';
      params = [id, userId];
    }

    const result = await pool.query(query, params);
    if (result.rows.length === 0 || !result.rows[0].lien)
      return res.status(404).json({ error: 'Fichier non trouvé ou accès non autorisé' });

    const file = result.rows[0];
    if (!fs.existsSync(file.lien))
      return res.status(404).json({ error: 'Fichier physique non trouvé' });

    res.download(file.lien, file.titre + path.extname(file.lien));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur téléchargement" });
  }
});

// ─────────────────────────────
// PUBLISH (ARTICLE uniquement)
// ─────────────────────────────
router.post("/:id/publish", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { cible_id } = req.body;
    const userRole = req.user.role;
    const userId = req.user.id;

    const docResult = await pool.query("SELECT * FROM document WHERE id=$1", [id]);
    if (docResult.rows.length === 0) return res.status(404).json({ error: "Document non trouvé" });
    const document = docResult.rows[0];

    if (document.type !== 'ARTICLE')
      return res.status(400).json({ error: `La publication est réservée aux ARTICLE. Ce document est de type "${document.type}".` });

    let publicationUserId;

    if (userRole === "ADMIN") {
      if (cible_id) {
        const userCheck = await pool.query(
          "SELECT id FROM utilisateur WHERE id=$1 AND role IN ('ADMIN','CHERCHEUR','CADRE_TECHNIQUE')",
          [cible_id]
        );
        if (userCheck.rows.length === 0) return res.status(400).json({ error: "Utilisateur cible non trouvé" });
        publicationUserId = cible_id;
      } else {
        publicationUserId = document.auteur_id;
      }
    } else if (userRole === "CHERCHEUR" || userRole === "CADRE_TECHNIQUE") {
      if (document.auteur_id !== userId) return res.status(403).json({ error: "Vous ne pouvez publier que vos propres documents" });
      publicationUserId = userId;
    } else {
      return res.status(403).json({ error: "Seul l'administrateur, chercheur ou cadre technique peut publier" });
    }

    const pubCheck = await pool.query(
      "SELECT id FROM publication WHERE document_id=$1 AND chercheur_id=$2",
      [id, publicationUserId]
    );

    if (pubCheck.rows.length > 0) {
      if (userRole === "ADMIN") {
        await pool.query(
          "UPDATE publication SET date_publication=CURRENT_TIMESTAMP WHERE document_id=$1 AND chercheur_id=$2",
          [id, publicationUserId]
        );
      } else {
        return res.status(400).json({ error: "Document déjà publié pour cet utilisateur" });
      }
    } else {
      const insertResult = await pool.query(
        "INSERT INTO publication (document_id, chercheur_id, date_publication) VALUES ($1,$2,CURRENT_TIMESTAMP) RETURNING *",
        [id, publicationUserId]
      );
      if (insertResult.rows.length === 0) return res.status(500).json({ error: "Échec de la création de la publication" });
    }

    // Publier = aussi rendre visible automatiquement
    await pool.query("UPDATE document SET visibilite=true WHERE id=$1", [id]);

    const lienComplet = document.lien
      ? `${req.protocol}://${req.get("host")}/${document.lien.replace(/\\/g, "/")}`
      : null;

    res.json({
      message: "Document publié et rendu visible avec succès",
      document: { id: document.id, titre: document.titre, lien: lienComplet, visibilite: true, publicationUserId }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur publication" });
  }
});

// ─────────────────────────────
// TOGGLE VISIBILITÉ (route dédiée)
// Permet à l'auteur ou ADMIN de rendre un doc visible/invisible
// ─────────────────────────────
router.patch("/:id/visibilite", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { visibilite } = req.body;
    const userRole = req.user.role;
    const userId = req.user.id;

    if (visibilite === undefined)
      return res.status(400).json({ error: "Le champ visibilite est requis" });

    const docResult = await pool.query("SELECT * FROM document WHERE id=$1", [id]);
    if (docResult.rows.length === 0) return res.status(404).json({ error: "Document non trouvé" });
    const document = docResult.rows[0];

    // Seul l'auteur ou l'ADMIN peut changer la visibilité
    if (userRole !== 'ADMIN' && document.auteur_id !== userId)
      return res.status(403).json({ error: "Vous ne pouvez modifier que vos propres documents" });

    const newVal = visibilite === true || visibilite === 'true';
    const result = await pool.query(
      "UPDATE document SET visibilite=$1, date_modification=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *",
      [newVal, id]
    );

    res.json({ message: `Document ${newVal ? "rendu visible" : "masqué"} avec succès`, document: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur modification visibilité" });
  }
});

module.exports = router;