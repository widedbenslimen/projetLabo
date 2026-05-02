import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import lesorBg from "../../assets/LESOR.jpg"; // ← ajustez le chemin si besoin
import logo from "../../assets/image.png";


function Connexion() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", mot_de_passe: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const res = await axios.post("http://localhost:8000/api/connexion", form);

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.utilisateur));

      setMessage("Connexion réussie ✅");

      const roleRoutes = {
        ADMIN: "/admin",
        CHERCHEUR: "/chercheur",
        INVITE: "/invite",
        CADRE_TECHNIQUE: "/CadreTechnique",
      };

      setTimeout(() => {
        navigate(roleRoutes[res.data.utilisateur.role] || "/");
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || "Identifiants incorrects");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" style={{ backgroundImage: `url(${lesorBg})` }}>
      {/* overlay sombre */}
      <div className="auth-overlay" />

      <div className="auth-card" style={{ animationName: "fadeUp" }}>
        {/* ── Logo ── */}
        <div className="auth-logo">
          <img src={logo} alt="logo" className="ad-logo" />
          <span className="auth-logo-text">LESOR</span>
        </div>

        <h1 className="auth-title">
          Bon <span className="auth-title-accent">retour !</span>
        </h1>
        <p className="auth-subtitle">
          Connectez-vous pour accéder à votre espace personnel
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          {/* Email */}
          <div className="auth-field">
            <label className="auth-label">Adresse Email</label>
            <input
              type="email"
              name="email"
              placeholder="nom@domaine.com"
              value={form.email}
              onChange={handleChange}
              className="auth-input"
              required
            />
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

          

          <button
            type="submit"
            className="auth-btn-primary"
            disabled={loading}
          >
            {loading ? "Connexion…" : "Se connecter"}
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
          onClick={() => navigate("/Inscription")}
        >
          ✍️&nbsp;&nbsp;Créer un compte
        </button>

        <p className="auth-footer-text">
          Pas encore inscrit ?{" "}
          <a
            href="#"
            className="auth-footer-link"
            onClick={(e) => {
              e.preventDefault();
              navigate("/Inscription");
            }}
          >
            S'inscrire
          </a>
        </p>
      </div>
    </div>
  );
}

export default Connexion;