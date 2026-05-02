import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import lesorBg from "../../assets/LESOR.jpg"; // ← ajustez le chemin si besoin
import logo from "../../assets/image.png";

function Inscription() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nom: "",
    email: "",
    mot_de_passe: "",
    num_telephone: "",
    role: "",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "num_telephone") {
      if (!/^\d*$/.test(value)) {
        setPhoneError("Veuillez entrer uniquement des chiffres");
        return;
      }
      if (value.length > 8) {
        setPhoneError("Le numéro ne doit pas dépasser 8 chiffres");
        return;
      }
      setPhoneError("");
    }

    if (name === "email") {
      if (value && !/^\S+@\S+\.\S+$/.test(value)) {
        setEmailError("Format attendu : nom@domaine.com");
      } else {
        setEmailError("");
      }
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!form.email || !/^\S+@\S+\.\S+$/.test(form.email)) {
      setEmailError("Format attendu : nom@domaine.com");
      return;
    }
    if (!form.num_telephone || !/^[0-9]{8}$/.test(form.num_telephone)) {
      setPhoneError("Le numéro doit contenir exactement 8 chiffres");
      return;
    }

    setLoading(true);
    try {
      await axios.post("http://localhost:8000/api/inscription", form);
      setMessage("Inscription réussie ✅");
      setTimeout(() => {
        setMessage("");
        navigate("/Connexion");
      }, 2000);
      setForm({ nom: "", email: "", mot_de_passe: "", num_telephone: "", role: "" });
      setEmailError("");
      setPhoneError("");
    } catch (err) {
      setError(err.response?.data?.message || "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" style={{ backgroundImage: `url(${lesorBg})` }}>
      {/* overlay sombre */}
      <div className="auth-overlay" />

      <div className="auth-card auth-card-wide" style={{ animationName: "fadeUp" }}>
        {/* ── Logo ── */}
        <div className="auth-logo">
          <img src={logo} alt="logo" className="ad-logo" />
          <span className="auth-logo-text">LESOR</span>
        </div>

        <h1 className="auth-title">
          Créer un <span className="auth-title-accent">compte</span>
        </h1>
        <p className="auth-subtitle">
          Rejoignez LESOR et commencez votre aventure avec nous
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          {/* Grid 2 colonnes pour nom + téléphone */}
          <div className="auth-grid-2">
            {/* Nom complet */}
            <div className="auth-field">
              <label className="auth-label">Nom complet</label>
              <input
                type="text"
                name="nom"
                placeholder="Votre nom"
                value={form.nom}
                onChange={handleChange}
                className="auth-input"
                required
              />
            </div>

            {/* Téléphone */}
            <div className="auth-field">
              <label className="auth-label">Téléphone</label>
              <input
                type="text"
                name="num_telephone"
                placeholder="8 chiffres"
                value={form.num_telephone}
                onChange={handleChange}
                className={`auth-input${phoneError ? " auth-input-error" : ""}`}
              />
              {phoneError && (
                <span className="auth-field-error">{phoneError}</span>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="auth-field">
            <label className="auth-label">Adresse Email</label>
            <input
              type="email"
              name="email"
              placeholder="nom@domaine.com"
              value={form.email}
              onChange={handleChange}
              className={`auth-input${emailError ? " auth-input-error" : ""}`}
              required
            />
            {emailError && (
              <span className="auth-field-error">{emailError}</span>
            )}
          </div>

          {/* Mot de passe */}
          <div className="auth-field">
            <label className="auth-label">Mot de passe</label>
            <div className="auth-pw-wrap">
              <input
                type={showPw ? "text" : "password"}
                name="mot_de_passe"
                placeholder="••••••••"
                value={form.mot_de_passe}
                onChange={handleChange}
                className="auth-input auth-input-pw"
                required
              />
              <button
                type="button"
                className="auth-eye-btn"
                onClick={() => setShowPw((v) => !v)}
                aria-label="Afficher/Masquer le mot de passe"
              >
                {showPw ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {/* Rôle */}
          <div className="auth-field">
            <label className="auth-label">Rôle</label>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="auth-input auth-select"
              required
            >
              <option value="" disabled>
                — Sélectionner un rôle —
              </option>
              <option value="CHERCHEUR">Chercheur</option>
              <option value="INVITE">Invité</option>
              <option value="ADMIN">Admin</option>
              <option value="CADRE_TECHNIQUE">Cadre Technique</option>
            </select>
          </div>

          <button
            type="submit"
            className="auth-btn-primary"
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            {loading ? "Inscription…" : "S'inscrire"}
          </button>

          {message && <p className="auth-msg auth-msg-success">{message}</p>}
          {error && <p className="auth-msg auth-msg-error">{error}</p>}
        </form>

        {/* Divider */}
        <div className="auth-divider">
          <span />
          ou
          <span />
        </div>

        <button
          type="button"
          className="auth-btn-secondary"
          onClick={() => navigate("/Connexion")}
        >
          🔑&nbsp;&nbsp;Se connecter
        </button>

        <p className="auth-footer-text">
          Déjà un compte ?{" "}
          <a
            href="#"
            className="auth-footer-link"
            onClick={(e) => {
              e.preventDefault();
              navigate("/Connexion");
            }}
          >
            Se connecter
          </a>
        </p>
      </div>
    </div>
  );
}

export default Inscription;