const jwt = require("jsonwebtoken");

function auth(req, res, next) {

  const header = req.headers["authorization"];

  if (!header) {
    return res.status(401).json({
      error: "Token manquant"
    });
  }

  const token = header.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      error: "Token invalide"
    });
  }

  try {

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = decoded;

    next();

  } catch (err) {

    return res.status(403).json({
      error: "Token invalide"
    });

  }

}

module.exports = auth;