import { Routes, Route, Navigate  } from "react-router-dom";
import './App.css'
import Connexion from "./pages/Connexion/Connexion";
import Inscription from "./pages/Inscription/Inscription";
import Admin from "./pages/Admin/Admin";
import Chercheur from "./pages/Chercheur/Chercheur";
import Invite from "./pages/Invite/Invite";
import CadreTechnique from "./pages/CadreTechnique/CadreTechnique";

function App() {
  return (
      <Routes>
        <Route path="/" element={<Navigate to="/Inscription" />} />
        <Route path="/Inscription" element={<Inscription />} />
        <Route path="/Connexion" element={<Connexion />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/chercheur" element={<Chercheur />} />
        <Route path="/invite" element={<Invite />} />
        <Route path="/CadreTechnique" element={<CadreTechnique />} />
      </Routes>
  );
}

export default App;