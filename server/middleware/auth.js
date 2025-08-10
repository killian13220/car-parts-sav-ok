// Middleware d'authentification simple pour l'interface admin
// MODIFIÉ POUR ACCEPTER LES IDENTIFIANTS SPÉCIFIQUES
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentification requise'
    });
  }
  
  // Décodage de l'authentification Basic
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');
  
  // Vérification des identifiants spécifiques
  if (username === 'Directeur' && password === 'CarParts2025') {
    console.log('✅ Authentification réussie avec les identifiants spécifiques');
    next();
  } else {
    console.log('❌ Échec d\'authentification pour:', username);
    res.status(401).json({
      success: false,
      message: 'Identifiants incorrects'
    });
  }
  
  /*
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentification requise'
    });
  }
  
  // Décodage de l'authentification Basic
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');
  
  // Vérification des identifiants (à remplacer par une vérification en base de données)
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({
      success: false,
      message: 'Identifiants incorrects'
    });
  }
  */
};

module.exports = { authenticateAdmin };
