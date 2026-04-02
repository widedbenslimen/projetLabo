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
  "ENQUETE",
  "RAPPORT",
  "IMAGE",
  "VIDEO",
  "CARTE",
  "ARTICLE"
];

// ─────────────────────────────
// Upload configuration améliorée
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

// Filtre des fichiers selon le type de document
const fileFilter = (req, file, cb) => {
  const documentType = req.body.type;
  
  const allowedTypes = {
    'ENQUETE': /pdf|doc|docx|txt|xls|xlsx/,
    'RAPPORT': /pdf|doc|docx|txt/,
    'IMAGE': /jpg|jpeg|png|gif|bmp|svg/,
    'VIDEO': /mp4|avi|mov|wmv|flv|mkv/,
    'CARTE': /pdf|jpg|jpeg|png|geojson|kml|kmz/,
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
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max
});

// Middleware pour vérifier les droits d'accès spécifiques
const checkDocumentAccess = async (req, res, next) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    // ADMIN peut tout faire
    if (userRole === 'ADMIN') {
      return next();
    }

    const document = await pool.query(
      'SELECT auteur_id, publie FROM document WHERE id = $1',
      [documentId]
    );

    if (document.rows.length === 0) {
      return res.status(404).json({ message: 'Document non trouvé' });
    }

    // Pour INVITÉ, vérifier si le document est public
    if (userRole === 'INVITE') {
      if (document.rows[0].publie) {
        return next();
      } else {
        return res.status(403).json({ message: 'Accès non autorisé' });
      }
    }

    // Pour CHERCHEUR et CADRE_TECHNIQUE, vérifier s'ils sont propriétaires
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
// ─────────────────────────────────────────────────────────────────
// Middleware checkParticipant
// Si un projet_id est fourni, l'auteur doit en être participant
// (ADMIN exempté)
// ─────────────────────────────────────────────────────────────────
const checkParticipant = async (req, res, next) => {
  try {
    const userRole = req.user.role?.toUpperCase();
    const userId   = req.user.id;
    const projetId = req.body.projet_id;
 
    if (userRole === 'ADMIN') return next();
    if (userRole === 'INVITE')
      return res.status(403).json({ error: 'Accès refusé' });
    if (!projetId) return next(); // document sans projet → OK
 
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

// ─────────────────────────────
// GET DOCUMENTS (amélioré)
// ─────────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user.id;
    let result;

    if (role === "ADMIN") {
      result = await pool.query(`
        SELECT d.*, u.nom as auteur_nom, u.email as auteur_email, p.titre as projet_titre 
        FROM document d
        LEFT JOIN utilisateur u ON d.auteur_id = u.id
        LEFT JOIN projet p ON d.projet_id = p.id
        ORDER BY d.date_creation DESC
      `);
    } else if (role === "CADRE_TECHNIQUE" || role === "CHERCHEUR") {
      result = await pool.query(`
        SELECT d.*, u.nom as auteur_nom, u.email as auteur_email, p.titre as projet_titre 
        FROM document d
        LEFT JOIN utilisateur u ON d.auteur_id = u.id
        LEFT JOIN projet p ON d.projet_id = p.id
        WHERE d.auteur_id = $1 OR d.publie = true
        ORDER BY d.date_creation DESC
      `, [userId]);
    } else {
      // INVITE → documents publiés uniquement
      result = await pool.query(`
        SELECT d.*, u.nom as auteur_nom, u.email as auteur_email, p.titre as projet_titre 
        FROM document d
        LEFT JOIN utilisateur u ON d.auteur_id = u.id
        LEFT JOIN projet p ON d.projet_id = p.id
        WHERE d.publie = true
        ORDER BY d.date_creation DESC
      `);
    }
    // Ajoutez l'URL complète pour chaque document
    result.rows = result.rows.map(doc => ({
      ...doc,
      url_acces: doc.lien ? `/uploads/${doc.lien.replace(/^.*[\\/]/, '')}` : null
    }));

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ─────────────────────────────
// GET DOCUMENT BY ID (amélioré)
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

    // Restrictions selon le rôle
    if (role === 'INVITE') {
      query += ' AND d.publie = true';
    } else if (role !== 'ADMIN') {
      query += ' AND (d.auteur_id = $2 OR d.publie = true)';
      params.push(userId);
    }

    const doc = await pool.query(query, params);

    if (doc.rows.length === 0) {
      return res.status(404).json({ error: "Document introuvable ou accès non autorisé" });
    }

    const document = doc.rows[0];

    // Récupérer les informations spécifiques selon le type
    if (document.type === 'ARTICLE') {
      const articleInfo = await pool.query('SELECT * FROM article WHERE id = $1', [id]);
      if (articleInfo.rows.length > 0) {
        document.infos_specifiques = articleInfo.rows[0];
      }
    } else if (document.type === 'IMAGE') {
      const imageInfo = await pool.query('SELECT * FROM image WHERE id = $1', [id]);
      if (imageInfo.rows.length > 0) {
        document.infos_specifiques = imageInfo.rows[0];
      }
    }

    res.json(document);
  } catch (err) {
  console.error("Erreur création document:", err);
  res.status(500).json({ error: err.message });
}
});

// ─────────────────────────────
// CREATE DOCUMENT (amélioré)
// ─────────────────────────────
router.post("/", auth, upload.single("file"), async (req, res) => {
  try {
    const role = req.user.role;
    if (role === "INVITE") return res.status(403).json({ error: "Accès refusé" });

    const { titre, description, mots_cles, type, projet_id, doi, resume, citation_APA, resolution, format, sous_type } = req.body;

    if (!DOCUMENT_TYPES.includes(type)) return res.status(400).json({ error: "Type document invalide" });
    if (!titre) return res.status(400).json({ error: "Le titre est requis" });

    if (type === 'ARTICLE' && !['JOURNAL', 'CONFERENCE'].includes(sous_type)) {
      return res.status(400).json({ error: "sous_type requis pour ARTICLE : JOURNAL ou CONFERENCE" });
    }

    const lien = req.file ? req.file.path : null;

    // ✅ Champs conditionnels selon le type
    const articleFields = type === 'ARTICLE' 
      ? { doi: doi || null, resume: resume || null, citation_APA: citation_APA || null, sous_type: sous_type }
      : { doi: null, resume: null, citation_APA: null, sous_type: null };

    const imageFields = type === 'IMAGE'
      ? { 
          resolution: resolution || null, 
          format: format || (req.file ? path.extname(req.file.originalname).substring(1) : null),
          taille: req.file ? req.file.size : null 
        }
      : { resolution: null, format: null, taille: null };

    const result = await pool.query(
      `INSERT INTO document
        (titre, description, mots_cles, type, sous_type, auteur_id, projet_id, lien, doi, resume, citation_APA, resolution, format, taille, date_creation, date_modification)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
        RETURNING *`,
      [
        titre, description, mots_cles, type, articleFields.sous_type,
        req.user.id, projet_id || null, lien,
        articleFields.doi, articleFields.resume, articleFields.citation_APA,
        imageFields.resolution, imageFields.format, imageFields.taille
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Erreur création document:", err); // ← log l'erreur complète
    res.status(500).json({ error: err.message }); // ← renvoie le message réel temporairement
  }
});

// ─────────────────────────────
// UPDATE DOCUMENT
// ─────────────────────────────
router.put("/:id", auth, checkDocumentAccess, upload.single("file"), async (req, res) => {
  try {
    const { id } = req.params;
    const { titre, description, mots_cles, projet_id, publie, doi, resume, citation_APA, resolution, format } = req.body;

    // Récupérer document existant
    const docResult = await pool.query("SELECT * FROM document WHERE id=$1", [id]);
    if (docResult.rows.length === 0) return res.status(404).json({ error: "Document introuvable" });
    const document = docResult.rows[0];

    // Gestion du fichier
    let lien = document.lien;
    if (req.file) {
      if (document.lien && fs.existsSync(document.lien)) fs.unlinkSync(document.lien);
      lien = req.file.path;
    }

    // Construire les champs à mettre à jour
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (titre) { updates.push(`titre = $${paramIndex++}`); values.push(titre); }
    if (description !== undefined) { updates.push(`description = $${paramIndex++}`); values.push(description); }
    if (mots_cles !== undefined) { updates.push(`mots_cles = $${paramIndex++}`); values.push(mots_cles); }
    if (projet_id !== undefined) { updates.push(`projet_id = $${paramIndex++}`); values.push(projet_id === 'null' ? null : projet_id); }
    // Dans PUT /:id, avant les updates
    if (publie !== undefined) {
      const docType = document.type;
      if (docType !== 'ARTICLE') {
        console.log(`Warning: Attempt to publish non-ARTICLE document (${docType}) ignored`);
      } else {
        updates.push(`publie = $${paramIndex++}`);
        values.push(publie === 'true' || publie === true);
      }
    }
    if (lien) { updates.push(`lien = $${paramIndex++}`); values.push(lien); }

    // Champs spécifiques selon le type
    if (document.type === 'ARTICLE') {
      if (doi !== undefined) { updates.push(`doi = $${paramIndex++}`); values.push(doi); }
      if (resume !== undefined) { updates.push(`resume = $${paramIndex++}`); values.push(resume); }
      if (citation_APA !== undefined) { updates.push(`citation_APA = $${paramIndex++}`); values.push(citation_APA); }
    } else if (document.type === 'IMAGE') {
      if (resolution !== undefined) { updates.push(`resolution = $${paramIndex++}`); values.push(resolution); }
      if (format !== undefined) { updates.push(`format = $${paramIndex++}`); values.push(format); }
      if (req.file) { updates.push(`taille = $${paramIndex++}`); values.push(req.file.size); }
    }

    updates.push(`date_modification = CURRENT_TIMESTAMP`);

    if (updates.length === 1) return res.status(400).json({ error: "Aucune donnée à mettre à jour" });

    values.push(id);
    const query = `UPDATE document SET ${updates.join(', ')} WHERE id=$${values.length} RETURNING *`;
    const result = await pool.query(query, values);

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur modification document" });
  }
});

// ─────────────────────────────
// DELETE DOCUMENT (amélioré)
// ─────────────────────────────
router.delete("/:id", auth, checkDocumentAccess, async (req, res) => {
  try {
    const { id } = req.params;

    // Récupérer le chemin du fichier avant suppression
    const docResult = await pool.query('SELECT lien FROM document WHERE id = $1', [id]);
    
    if (docResult.rows.length > 0 && docResult.rows[0].lien) {
      try {
        if (fs.existsSync(docResult.rows[0].lien)) {
          fs.unlinkSync(docResult.rows[0].lien);
        }
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
// DOWNLOAD DOCUMENT
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
      query = 'SELECT lien, titre FROM document WHERE id = $1 AND publie = true';
    } else {
      query = 'SELECT lien, titre FROM document WHERE id = $1 AND (auteur_id = $2 OR publie = true)';
      params = [id, userId];
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0 || !result.rows[0].lien) {
      return res.status(404).json({ error: 'Fichier non trouvé ou accès non autorisé' });
    }

    const file = result.rows[0];
    if (!fs.existsSync(file.lien)) {
      return res.status(404).json({ error: 'Fichier physique non trouvé' });
    }

    res.download(file.lien, file.titre + path.extname(file.lien));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur téléchargement" });
  }
});

// ─────────────────────────────
// PUBLISH DOCUMENT (prévention double publication)
// ─────────────────────────────
router.post("/:id/publish", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { cible_id } = req.body; // optional: المستخدم الذي سيتم ربطه بالـ publication
    const userRole = req.user.role;
    const userId = req.user.id;

    // 1️⃣ التحقق من وجود document
    const docResult = await pool.query("SELECT * FROM document WHERE id=$1", [id]);
    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: "Document non trouvé" });
    }
    const document = docResult.rows[0];
    // 🚫 Bloquer la publication si le type n'est pas ARTICLE
    if (document.type !== 'ARTICLE') {
      return res.status(400).json({ 
        error: `La publication est réservée aux documents de type ARTICLE. Ce document est de type "${document.type}".` 
      });
    }

    let publicationUserId;

    // 2️⃣ تحديد المستخدم المرتبط بالـ publication
    if (userRole === "ADMIN") {
      // ADMIN يمكنه اختيار أي مستخدم أو auteur
      if (cible_id) {
        const userCheck = await pool.query(
          "SELECT id FROM utilisateur WHERE id=$1 AND role IN ('ADMIN','CHERCHEUR','CADRE_TECHNIQUE')",
          [cible_id]
        );
        if (userCheck.rows.length === 0) {
          return res.status(400).json({ error: "Utilisateur cible non trouvé" });
        }
        publicationUserId = cible_id;
      } else {
        publicationUserId = document.auteur_id;
      }
    } else if (userRole === "CHERCHEUR" || userRole === "CADRE_TECHNIQUE") {
      // الباحث أو cadre_technique يمكنه نشر فقط الوثائق الخاصة به
      if (document.auteur_id !== userId) {
        return res.status(403).json({ error: "Vous ne pouvez publier que vos propres documents" });
      }
      publicationUserId = userId;
    } else {
      return res.status(403).json({ error: "Seul l'administrateur, chercheur ou cadre technique peut publier" });
    }

    // 3️⃣ التحقق من double publication
    const pubCheck = await pool.query(
      "SELECT id FROM publication WHERE document_id=$1 AND chercheur_id=$2",
      [id, publicationUserId]
    );

    if (pubCheck.rows.length > 0) {
      if (userRole === "ADMIN") {
        // ADMIN يمكنه إعادة النشر → تحديث تاريخ النشر
        await pool.query(
          "UPDATE publication SET date_publication=CURRENT_TIMESTAMP WHERE document_id=$1 AND chercheur_id=$2",
          [id, publicationUserId]
        );
      } else {
        return res.status(400).json({ error: "Document déjà publié pour cet utilisateur" });
      }
    } else {
      // 4️⃣ إنشاء الـ publication جديد
      const insertResult = await pool.query(
        "INSERT INTO publication (document_id, chercheur_id, date_publication) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING *",
        [id, publicationUserId]
      );

      if (insertResult.rows.length === 0) {
        return res.status(500).json({ error: "Échec de la création de la publication" });
      }

      console.log("Publication ajoutée:", insertResult.rows[0]);
    }

    // 5️⃣ تحديث document comme publié
    if (!document.publie) {
      await pool.query("UPDATE document SET publie=true WHERE id=$1", [id]);
    }

    // 6️⃣ إنشاء lien complet للملف إذا موجود
    const lienComplet = document.lien ? `${req.protocol}://${req.get("host")}/${document.lien.replace("\\", "/")}` : null;

    res.json({
      message: "Document publié avec succès",
      document: {
        id: document.id,
        titre: document.titre,
        lien: lienComplet,
        publie: true,
        publicationUserId
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur publication" });
  }
});
// ─────────────────────────────
// SEARCH SIMPLE (amélioré)
// ─────────────────────────────
router.get("/search/simple", auth, async (req, res) => {
  try {
    const { q } = req.query;
    const userRole = req.user.role;
    const userId = req.user.id;

    if (!q) {
      return res.status(400).json({ error: "Terme de recherche requis" });
    }

    let query = `
      SELECT d.*, u.nom as auteur_nom, u.email as auteur_email, p.titre as projet_titre 
      FROM document d
      LEFT JOIN utilisateur u ON d.auteur_id = u.id
      LEFT JOIN projet p ON d.projet_id = p.id
      WHERE (d.titre ILIKE $1 OR d.description ILIKE $1 OR d.mots_cles ILIKE $1)
    `;
    
    let params = [`%${q}%`];
    let paramIndex = 2;

    if (userRole === 'INVITE') {
      query += ' AND d.publie = true';
    } else if (userRole !== 'ADMIN') {
      query += ` AND (d.auteur_id = $${paramIndex} OR d.publie = true)`;
      params.push(userId);
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
// SEARCH ADVANCED (amélioré)
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
    let paramIndex = 1;

    if (titre) {
      values.push(`%${titre}%`);
      query += ` AND d.titre ILIKE $${paramIndex++}`;
    }

    if (type && DOCUMENT_TYPES.includes(type)) {
      values.push(type);
      query += ` AND d.type = $${paramIndex++}`;
    }

    if (mots) {
      values.push(`%${mots}%`);
      query += ` AND d.mots_cles ILIKE $${paramIndex++}`;
    }

    if (auteur) {
      values.push(`%${auteur}%`);
      query += ` AND u.nom ILIKE $${paramIndex++}`;
    }

    if (projet) {
      values.push(`%${projet}%`);
      query += ` AND p.titre ILIKE $${paramIndex++}`;
    }

    if (date_debut) {
      values.push(date_debut);
      query += ` AND d.date_creation >= $${paramIndex++}`;
    }

    if (date_fin) {
      values.push(date_fin);
      query += ` AND d.date_creation <= $${paramIndex++}`;
    }

    // Restrictions selon le rôle
    if (userRole === 'INVITE') {
      query += ' AND d.publie = true';
    } else if (userRole !== 'ADMIN') {
      values.push(userId);
      query += ` AND (d.auteur_id = $${paramIndex++} OR d.publie = true)`;
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
// GET DOCUMENTS BY TYPE
// ─────────────────────────────
router.get("/type/:type", auth, async (req, res) => {
  try {
    const { type } = req.params;
    const userRole = req.user.role;
    const userId = req.user.id;

    if (!DOCUMENT_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Type de document invalide' });
    }

    let query = '';
    let params = [type];

    if (userRole === 'ADMIN') {
      query = `
        SELECT d.*, u.nom as auteur_nom, u.email as auteur_email, p.titre as projet_titre 
        FROM document d
        LEFT JOIN utilisateur u ON d.auteur_id = u.id
        LEFT JOIN projet p ON d.projet_id = p.id
        WHERE d.type = $1
        ORDER BY d.date_creation DESC
      `;
    } else if (userRole === 'INVITE') {
      query = `
        SELECT d.*, u.nom as auteur_nom, u.email as auteur_email, p.titre as projet_titre 
        FROM document d
        LEFT JOIN utilisateur u ON d.auteur_id = u.id
        LEFT JOIN projet p ON d.projet_id = p.id
        WHERE d.type = $1 AND d.publie = true
        ORDER BY d.date_creation DESC
      `;
    } else {
      query = `
        SELECT d.*, u.nom as auteur_nom, u.email as auteur_email, p.titre as projet_titre 
        FROM document d
        LEFT JOIN utilisateur u ON d.auteur_id = u.id
        LEFT JOIN projet p ON d.projet_id = p.id
        WHERE d.type = $1 AND (d.auteur_id = $2 OR d.publie = true)
        ORDER BY d.date_creation DESC
      `;
      params = [type, userId];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur récupération par type" });
  }
});

// ─────────────────────────────
// GET DOCUMENTS BY PROJECT
// ─────────────────────────────
router.get("/projet/:projetId", auth, async (req, res) => {
  try {
    const { projetId } = req.params;
    const userRole = req.user.role;
    const userId = req.user.id;

    let query = '';
    let params = [projetId];

    if (userRole === 'ADMIN') {
      query = `
        SELECT d.*, u.nom as auteur_nom, u.email as auteur_email, p.titre as projet_titre 
        FROM document d
        LEFT JOIN utilisateur u ON d.auteur_id = u.id
        LEFT JOIN projet p ON d.projet_id = p.id
        WHERE d.projet_id = $1
        ORDER BY d.date_creation DESC
      `;
    } else if (userRole === 'INVITE') {
      query = `
        SELECT d.*, u.nom as auteur_nom, u.email as auteur_email, p.titre as projet_titre 
        FROM document d
        LEFT JOIN utilisateur u ON d.auteur_id = u.id
        LEFT JOIN projet p ON d.projet_id = p.id
        WHERE d.projet_id = $1 AND d.publie = true
        ORDER BY d.date_creation DESC
      `;
    } else {
      query = `
        SELECT d.*, u.nom as auteur_nom, u.email as auteur_email, p.titre as projet_titre 
        FROM document d
        LEFT JOIN utilisateur u ON d.auteur_id = u.id
        LEFT JOIN projet p ON d.projet_id = p.id
        WHERE d.projet_id = $1 AND (d.auteur_id = $2 OR d.publie = true)
        ORDER BY d.date_creation DESC
      `;
      params = [projetId, userId];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur récupération par projet" });
  }
});

// ─────────────────────────────
// GET DOCUMENTS STATS (admin only)
// ─────────────────────────────
router.get("/stats/global", auth, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Accès réservé à l\'administrateur' });
    }

    const stats = await pool.query(`
      SELECT 
        type,
        COUNT(*) as total,
        COUNT(CASE WHEN publie = true THEN 1 END) as publies,
        COUNT(CASE WHEN publie = false THEN 1 END) as non_publies
      FROM document
      GROUP BY type
      ORDER BY type
    `);

    const totalStats = await pool.query(`
      SELECT 
        COUNT(*) as total_documents,
        COUNT(DISTINCT auteur_id) as total_auteurs,
        MIN(date_creation) as premier_document,
        MAX(date_creation) as dernier_document
      FROM document
    `);

    res.json({
      global: totalStats.rows[0],
      par_type: stats.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur statistiques" });
  }
});

module.exports = router;