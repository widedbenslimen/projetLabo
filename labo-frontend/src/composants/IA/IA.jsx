import { useState, useRef, useCallback } from "react";
import "./IA.css";

/* ═══════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════ */
const API_BASE = "http://localhost:8000/api";
const getToken = () => localStorage.getItem("token");

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════ */
const DOCUMENT_TYPES = ["ARTICLE", "ENQUETE", "IMAGE", "RAPPORT", "VIDEO", "CARTE"];

const TYPE_META = {
  ARTICLE: { icon: "📰", color: "#6366f1", label: "Article" },
  ENQUETE: { icon: "📋", color: "#8b5cf6", label: "Enquête" },
  IMAGE:   { icon: "🖼️", color: "#10b981", label: "Image" },
  RAPPORT: { icon: "📊", color: "#f59e0b", label: "Rapport" },
  VIDEO:   { icon: "🎬", color: "#ec4899", label: "Vidéo" },
  CARTE:   { icon: "🗺️", color: "#06b6d4", label: "Carte" },
};

const ALLOWED_TYPES = {
  ENQUETE: /pdf|doc|docx|txt|xls|xlsx/,
  RAPPORT: /pdf|doc|docx|txt/,
  IMAGE:   /jpg|jpeg|png|gif|bmp|svg/,
  VIDEO:   /mp4|avi|mov|wmv|flv|mkv/,
  CARTE:   /pdf|jpg|jpeg|png|geojson|kml|kmz/,
  ARTICLE: /pdf|doc|docx|txt/,
};

const CONFIDENCE_COLORS = {
  high:   { bg: "#d1fae5", text: "#065f46", label: "Fiable" },
  medium: { bg: "#fef3c7", text: "#92400e", label: "Moyen" },
  low:    { bg: "#fee2e2", text: "#991b1b", label: "Faible" },
};

const STEPS = ["upload", "analyzing", "review", "done"];

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
function getConfidenceLevel(score) {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Pour les images : redimensionne à max 1024px et compresse en JPEG 0.75
 * avant de convertir en base64 — réduit la taille de 80-95%
 */
function compressImageToBase64(file, maxPx = 1024, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = e => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width > height) { height = Math.round((height * maxPx) / width); width = maxPx; }
          else                { width  = Math.round((width  * maxPx) / height); height = maxPx; }
        }
        const canvas = document.createElement("canvas");
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl.split(",")[1]);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function guessDocType(fileName, mimeType) {
  const ext = fileName.split(".").pop().toLowerCase();
  if (/jpg|jpeg|png|gif|bmp|svg|webp/.test(ext)) return "IMAGE";
  if (/mp4|avi|mov|wmv|flv|mkv/.test(ext)) return "VIDEO";
  if (/geojson|kml|kmz/.test(ext)) return "CARTE";
  if (/xls|xlsx/.test(ext)) return "ENQUETE";
  return "ARTICLE"; // default for pdf/doc/txt
}

function ConfidenceBadge({ score }) {
  const level = getConfidenceLevel(score);
  const { bg, text, label } = CONFIDENCE_COLORS[level];
  return (
    <span className="ia-conf-badge" style={{ background: bg, color: text }}>
      <span className="ia-conf-dot" style={{ background: text }} />
      {score}% — {label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   FIELD ROW
═══════════════════════════════════════════════════════════ */
function FieldRow({ label, fieldKey, value, confidence, onChange, type = "text", options, modified }) {
  const [editing, setEditing] = useState(false);
  const level = getConfidenceLevel(confidence);

  return (
    <div className={`ia-field-row ${modified ? "ia-field-modified" : ""} ia-conf-${level}`}>
      <div className="ia-field-meta">
        <span className="ia-field-label">{label}</span>
        <ConfidenceBadge score={confidence} />
        {modified && <span className="ia-field-edited-tag">✏ modifié</span>}
      </div>

      {type === "textarea" ? (
        <textarea
          className="ia-field-input ia-field-textarea"
          value={value || ""}
          onChange={e => onChange(fieldKey, e.target.value)}
          rows={3}
        />
      ) : type === "select" ? (
        <select className="ia-field-input" value={value || ""} onChange={e => onChange(fieldKey, e.target.value)}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : type === "toggle" ? (
        <div
          className={`ia-field-toggle ${value ? "on" : "off"}`}
          onClick={() => onChange(fieldKey, !value)}
          role="switch"
          aria-checked={!!value}
          tabIndex={0}
          onKeyDown={e => e.key === " " && onChange(fieldKey, !value)}
        >
          <span className="ia-toggle-track"><span className="ia-toggle-thumb" /></span>
          <span className="ia-toggle-label">{value ? "🌐 Public" : "🔒 Privé"}</span>
        </div>
      ) : (
        <input
          className="ia-field-input"
          type={type}
          value={value || ""}
          onChange={e => onChange(fieldKey, e.target.value)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN IA COMPONENT
═══════════════════════════════════════════════════════════ */
export default function IA({ role, onSubmit, onClose, loading: externalLoading }) {
  const [step,          setStep]          = useState("upload");    // upload | analyzing | review | done
  const [file,          setFile]          = useState(null);
  const [preview,       setPreview]       = useState(null);
  const [dragOver,      setDragOver]      = useState(false);
  const [aiError,       setAiError]       = useState(null);
  const [analyzing,     setAnalyzing]     = useState(false);
  const [analyzeLog,    setAnalyzeLog]    = useState([]);

  // extracted data with confidence scores
  const [extracted,     setExtracted]     = useState(null);
  // user-edited values
  const [form,          setForm]          = useState({});
  // which fields were touched
  const [modified,      setModified]      = useState({});

  const fileInputRef = useRef(null);

  /* ── Drop / pick ── */
  const handleFile = useCallback(f => {
    if (!f) return;
    setFile(f);
    setAiError(null);
    if (f.type.startsWith("image/")) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }, []);

  const onDrop = e => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  /* ── Log helper ── */
  const log = msg => setAnalyzeLog(prev => [...prev, msg]);

  /* ── AI analysis ── */
  const analyzeDocument = async () => {
    if (!file) return;
    setStep("analyzing");
    setAnalyzing(true);
    setAnalyzeLog([]);
    setAiError(null);

    try {
      log("📂 Lecture du fichier…");
      const ext  = file.name.split(".").pop().toLowerCase();
      const isImage = /jpg|jpeg|png|gif|bmp|svg|webp/.test(ext);
      const isPdf   = ext === "pdf";
      const guessedType = guessDocType(file.name, file.type);

      log("🧠 Envoi à l'IA pour analyse…");

      let userContent;

      if (isImage) {
        const b64 = await compressImageToBase64(file); // compressé avant envoi
        const mimeType = "image/jpeg";
        userContent = [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType, data: b64 }
          },
          {
            type: "text",
            text: buildPrompt(file.name, guessedType, "image")
          }
        ];
      } else if (isPdf) {
        // Haiku ne supporte pas les PDFs natifs — on envoie le nom et type comme contexte
        // Le modèle extrait ce qu'il peut du nom de fichier
        userContent = buildPrompt(file.name, guessedType, "pdf_name");
      } else {
        // text-based file: read as text
        const text = await file.text();
        userContent = buildPrompt(file.name, guessedType, "text", text.slice(0, 8000));
      }

      // Appel via le proxy backend (évite CORS + masque la clé API)
      const response = await fetch(`${API_BASE}/ai/analyze`, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          model:      "claude-haiku-4-5-20251001",
          max_tokens: 1000,
          system:     buildSystemPrompt(),
          messages:   [{ role: "user", content: userContent }],
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.statusText}`);

      const data = await response.json();
      log("✅ Réponse reçue — parsing…");

      const rawText = data.content
        .filter(b => b.type === "text")
        .map(b => b.text)
        .join("");

      const clean = rawText.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      log("🎯 Extraction terminée avec succès !");

      // Normalize
      const result = {
        titre:          { value: parsed.titre          || "", confidence: parsed.confidence?.titre          ?? 60 },
        description:    { value: parsed.description    || "", confidence: parsed.confidence?.description    ?? 55 },
        mots_cles:      { value: parsed.mots_cles      || "", confidence: parsed.confidence?.mots_cles      ?? 50 },
        type:           { value: parsed.type           || guessedType, confidence: parsed.confidence?.type  ?? 70 },
        sous_type:      { value: parsed.sous_type      || "JOURNAL",   confidence: parsed.confidence?.sous_type ?? 40 },
        doi:            { value: parsed.doi            || "", confidence: parsed.confidence?.doi            ?? 30 },
        resume:         { value: parsed.resume         || "", confidence: parsed.confidence?.resume         ?? 55 },
        citation_APA:   { value: parsed.citation_APA   || "", confidence: parsed.confidence?.citation_APA   ?? 40 },
        journal:        { value: parsed.journal        || "", confidence: parsed.confidence?.journal        ?? 35 },
        maison_edition: { value: parsed.maison_edition || "", confidence: parsed.confidence?.maison_edition ?? 30 },
        resolution:     { value: parsed.resolution     || "", confidence: parsed.confidence?.resolution     ?? 50 },
        format:         { value: parsed.format         || ext.toUpperCase(), confidence: parsed.confidence?.format ?? 80 },
        visibilite:     { value: false,                       confidence: 100 },
      };

      setExtracted(result);
      // init form with extracted values
      const initForm = {};
      Object.entries(result).forEach(([k, v]) => { initForm[k] = v.value; });
      setForm(initForm);
      setModified({});
      setStep("review");

    } catch (err) {
      console.error(err);
      setAiError("Erreur lors de l'analyse IA : " + err.message);
      setStep("upload");
    } finally {
      setAnalyzing(false);
    }
  };

  /* ── Form update ── */
  const handleChange = (key, value) => {
    setForm(f => ({ ...f, [key]: value }));
    if (extracted && value !== extracted[key]?.value) {
      setModified(m => ({ ...m, [key]: true }));
    } else {
      setModified(m => { const n = { ...m }; delete n[key]; return n; });
    }
  };

  /* ── Submit ── */
  const handleSubmit = () => {
    const fd = new FormData();
    const type = form.type || "ARTICLE";
    fd.append("titre",       form.titre || "");
    fd.append("description", form.description || "");
    fd.append("mots_cles",   form.mots_cles || "");
    fd.append("type",        type);
    fd.append("visibilite",  form.visibilite ? "true" : "false");
    fd.append("projet_id",   "");

    if (type === "ARTICLE") {
      fd.append("sous_type",      form.sous_type || "JOURNAL");
      fd.append("doi",            form.doi || "");
      fd.append("resume",         form.resume || "");
      fd.append("citation_APA",   form.citation_APA || "");
      fd.append("journal",        form.journal || "");
      fd.append("maison_edition", form.maison_edition || "");
    }
    if (type === "RAPPORT") fd.append("doi", form.doi || "");
    if (type === "IMAGE") {
      fd.append("resolution", form.resolution || "");
      fd.append("format",     form.format || "");
    }
    if (file) fd.append("file", file);
    onSubmit(fd);
  };

  const modifiedCount = Object.keys(modified).length;
  const currentType   = form.type || "ARTICLE";
  const typeMeta      = TYPE_META[currentType] || TYPE_META.ARTICLE;

  /* ════════════════ RENDER ════════════════ */
  return (
    <div className="ia-overlay" onClick={onClose}>
      <div className="ia-panel" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="ia-header">
          <div className="ia-header-left">
            <div className="ia-header-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </div>
            <div>
              <h2 className="ia-header-title">Ajout intelligent par IA</h2>
              <p className="ia-header-sub">Analyse automatique · Extraction · Pré-remplissage</p>
            </div>
          </div>
          <button className="ia-close" onClick={onClose}>✕</button>
        </div>

        {/* ── Progress bar ── */}
        <div className="ia-progress-bar">
          {["upload", "analyzing", "review"].map((s, i) => (
            <div key={s} className={`ia-progress-step ${step === s ? "active" : STEPS.indexOf(step) > i ? "done" : ""}`}>
              <div className="ia-progress-dot">
                {STEPS.indexOf(step) > i ? "✓" : i + 1}
              </div>
              <span>{["Import", "Analyse", "Vérification"][i]}</span>
            </div>
          ))}
          <div className="ia-progress-line">
            <div className="ia-progress-line-fill" style={{ width: step === "upload" ? "0%" : step === "analyzing" ? "50%" : "100%" }} />
          </div>
        </div>

        {/* ══════════ STEP 1 : UPLOAD ══════════ */}
        {step === "upload" && (
          <div className="ia-body">
            <div
              className={`ia-dropzone ${dragOver ? "drag" : ""} ${file ? "has-file" : ""}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" style={{ display: "none" }}
                accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.bmp,.svg,.mp4,.avi,.mov,.wmv,.flv,.mkv,.geojson,.kml,.kmz"
                onChange={e => handleFile(e.target.files[0])} />

              {file ? (
                <div className="ia-file-preview">
                  {preview
                    ? <img src={preview} alt="preview" className="ia-file-img-preview" />
                    : <div className="ia-file-icon-big">📄</div>
                  }
                  <div className="ia-file-info">
                    <strong>{file.name}</strong>
                    <span>{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <button className="ia-file-remove" onClick={e => { e.stopPropagation(); setFile(null); setPreview(null); }}>✕</button>
                </div>
              ) : (
                <>
                  <div className="ia-dz-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  </div>
                  <p className="ia-dz-title">Glissez votre document ici</p>
                  <p className="ia-dz-sub">ou <span className="ia-dz-link">parcourir</span> pour importer</p>
                  <div className="ia-dz-types">
                    {["PDF", "DOC", "DOCX", "TXT", "XLS", "JPG", "PNG", "MP4"].map(t => (
                      <span key={t} className="ia-dz-type-pill">{t}</span>
                    ))}
                  </div>
                </>
              )}
            </div>

            {aiError && <div className="ia-error-box">⚠ {aiError}</div>}

            <div className="ia-upload-footer">
              <div className="ia-ai-note">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                L'IA analysera le contenu pour extraire les métadonnées. Vous vérifierez tout avant l'enregistrement.
              </div>
              <div className="ia-footer-actions">
                <button className="ia-btn-ghost" onClick={onClose}>Annuler</button>
                <button className="ia-btn-primary" disabled={!file} onClick={analyzeDocument}>
                  <span className="ia-btn-sparkle">✦</span> Analyser avec l'IA
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ STEP 2 : ANALYZING ══════════ */}
        {step === "analyzing" && (
          <div className="ia-body ia-analyzing-body">
            <div className="ia-analyzing-center">
              <div className="ia-orb-wrapper">
                <div className="ia-orb" />
                <div className="ia-orb-ring ia-orb-ring-1" />
                <div className="ia-orb-ring ia-orb-ring-2" />
                <div className="ia-orb-ring ia-orb-ring-3" />
                <div className="ia-orb-icon">✦</div>
              </div>
              <h3 className="ia-analyzing-title">Analyse en cours…</h3>
              <p className="ia-analyzing-sub">L'IA extrait les informations de votre document</p>
              <div className="ia-log-stream">
                {analyzeLog.map((msg, i) => (
                  <div key={i} className="ia-log-line" style={{ animationDelay: `${i * 0.1}s` }}>
                    <span className="ia-log-dot" />
                    {msg}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════ STEP 3 : REVIEW ══════════ */}
        {step === "review" && extracted && (
          <div className="ia-body ia-review-body">
            {/* Type banner */}
            <div className="ia-type-banner" style={{ "--tc": typeMeta.color }}>
              <span className="ia-type-banner-icon">{typeMeta.icon}</span>
              <div>
                <span className="ia-type-banner-label">Type détecté</span>
                <span className="ia-type-banner-value">{typeMeta.label}</span>
              </div>
              <select
                className="ia-type-select"
                value={form.type}
                onChange={e => handleChange("type", e.target.value)}
              >
                {DOCUMENT_TYPES.map(t => (
                  <option key={t} value={t}>{TYPE_META[t].icon} {TYPE_META[t].label}</option>
                ))}
              </select>
            </div>

            {/* Stats */}
            {modifiedCount > 0 && (
              <div className="ia-modified-notice">
                ✏ {modifiedCount} champ{modifiedCount > 1 ? "s" : ""} modifié{modifiedCount > 1 ? "s" : ""} par rapport à l'extraction IA
              </div>
            )}

            {/* Confidence legend */}
            <div className="ia-conf-legend">
              {Object.entries(CONFIDENCE_COLORS).map(([level, { bg, text, label }]) => (
                <span key={level} className="ia-conf-legend-item" style={{ background: bg, color: text }}>
                  <span style={{ background: text, width: 6, height: 6, borderRadius: "50%", display: "inline-block", marginRight: 4 }} />
                  {label}
                </span>
              ))}
            </div>

            <div className="ia-fields-grid">
              {/* Common fields */}
              <FieldRow label="Titre" fieldKey="titre" value={form.titre} confidence={extracted.titre.confidence}
                onChange={handleChange} modified={!!modified.titre} />
              <FieldRow label="Description" fieldKey="description" value={form.description} confidence={extracted.description.confidence}
                onChange={handleChange} type="textarea" modified={!!modified.description} />
              <FieldRow label="Mots-clés" fieldKey="mots_cles" value={form.mots_cles} confidence={extracted.mots_cles.confidence}
                onChange={handleChange} modified={!!modified.mots_cles} />
              <FieldRow label="Visibilité" fieldKey="visibilite" value={form.visibilite} confidence={100}
                onChange={handleChange} type="toggle" modified={!!modified.visibilite} />

              {/* ARTICLE-specific */}
              {currentType === "ARTICLE" && (<>
                <FieldRow label="Sous-type" fieldKey="sous_type" value={form.sous_type} confidence={extracted.sous_type.confidence}
                  onChange={handleChange} type="select" modified={!!modified.sous_type}
                  options={[{ value: "JOURNAL", label: "📰 Journal" }, { value: "CONFERENCE", label: "🎤 Conférence" }]} />
                <FieldRow label="DOI" fieldKey="doi" value={form.doi} confidence={extracted.doi.confidence}
                  onChange={handleChange} modified={!!modified.doi} />
                <FieldRow label="Résumé" fieldKey="resume" value={form.resume} confidence={extracted.resume.confidence}
                  onChange={handleChange} type="textarea" modified={!!modified.resume} />
                <FieldRow label="Citation APA" fieldKey="citation_APA" value={form.citation_APA} confidence={extracted.citation_APA.confidence}
                  onChange={handleChange} modified={!!modified.citation_APA} />
                <FieldRow label="Journal" fieldKey="journal" value={form.journal} confidence={extracted.journal.confidence}
                  onChange={handleChange} modified={!!modified.journal} />
                <FieldRow label="Maison d'édition" fieldKey="maison_edition" value={form.maison_edition} confidence={extracted.maison_edition.confidence}
                  onChange={handleChange} modified={!!modified.maison_edition} />
              </>)}

              {/* RAPPORT */}
              {currentType === "RAPPORT" && (
                <FieldRow label="DOI" fieldKey="doi" value={form.doi} confidence={extracted.doi.confidence}
                  onChange={handleChange} modified={!!modified.doi} />
              )}

              {/* IMAGE */}
              {currentType === "IMAGE" && (<>
                <FieldRow label="Résolution" fieldKey="resolution" value={form.resolution} confidence={extracted.resolution.confidence}
                  onChange={handleChange} modified={!!modified.resolution} />
                <FieldRow label="Format" fieldKey="format" value={form.format} confidence={extracted.format.confidence}
                  onChange={handleChange} modified={!!modified.format} />
              </>)}

              {/* File display */}
              <div className="ia-field-file-row">
                <span className="ia-field-label">Fichier importé</span>
                <div className="ia-field-file-info">
                  <span className="ia-field-file-name">📎 {file?.name}</span>
                  <span className="ia-field-file-size">{file ? (file.size / 1024).toFixed(1) + " KB" : ""}</span>
                </div>
              </div>
            </div>

            <div className="ia-review-footer">
              <button className="ia-btn-ghost" onClick={() => { setStep("upload"); setExtracted(null); }}>
                ← Recommencer
              </button>
              <button className="ia-btn-primary" onClick={handleSubmit} disabled={externalLoading}>
                {externalLoading
                  ? <><span className="ia-btn-spinner" /> Enregistrement…</>
                  : <>💾 Enregistrer le document</>
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PROMPTS
═══════════════════════════════════════════════════════════ */
function buildSystemPrompt() {
  return `Tu es un assistant expert en extraction d'informations documentaires.
Tu analyses des documents (images, PDF, textes) et extrais les métadonnées.
Tu réponds UNIQUEMENT en JSON valide, sans aucun texte avant ou après, sans balises Markdown.
Langues supportées : français, anglais, arabe.
Le JSON doit avoir exactement cette structure :
{
  "titre": "string",
  "description": "string",
  "mots_cles": "string (séparés par des virgules)",
  "type": "ARTICLE|ENQUETE|IMAGE|RAPPORT|VIDEO|CARTE",
  "sous_type": "JOURNAL|CONFERENCE (seulement si type=ARTICLE)",
  "doi": "string ou null",
  "resume": "string ou null",
  "citation_APA": "string ou null",
  "journal": "string ou null",
  "maison_edition": "string ou null",
  "resolution": "string ou null (ex: 1920x1080)",
  "format": "string ou null",
  "confidence": {
    "titre": 0-100,
    "description": 0-100,
    "mots_cles": 0-100,
    "type": 0-100,
    "sous_type": 0-100,
    "doi": 0-100,
    "resume": 0-100,
    "citation_APA": 0-100,
    "journal": 0-100,
    "maison_edition": 0-100,
    "resolution": 0-100,
    "format": 0-100
  }
}
Les scores de confiance (0-100) indiquent ta certitude pour chaque champ.
Si un champ n'est pas trouvé, mets une chaîne vide "" et confidence 0.`;
}

function buildPrompt(fileName, guessedType, fileKind, textContent) {
  const base = `Analyse ce document "${fileName}" (type probable: ${guessedType}).
Extrais toutes les métadonnées disponibles et retourne uniquement le JSON demandé.`;

  if (fileKind === "text" && textContent) {
    return `${base}\n\nContenu du document :\n\`\`\`\n${textContent}\n\`\`\``;
  }
  if (fileKind === "pdf_name") {
    // Pas de contenu lisible — utiliser le nom de fichier comme seul indice
    return `${base}\n\nNote: seul le nom du fichier est disponible. Déduis le maximum à partir du nom.`;
  }
  return base;
}