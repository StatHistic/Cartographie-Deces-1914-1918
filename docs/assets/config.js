// Explorateur : https://datalab.sspcloud.fr/s3/vloonis/bundles/?profile=anonymous
// Le catalogue est à côté des lots ; ses chemins "bundles/...json"
// sont résolus depuis la racine du bucket pour éviter bundles/bundles/.
window.APP_CONFIG = {
  dataBaseUrl: 'https://minio.lab.sspcloud.fr/vloonis/',
  catalogUrl: 'https://minio.lab.sspcloud.fr/vloonis/bundles/catalog.json',
  // URL HTTPS de réception privée (POST : message, name, email, organization, cases).
  // Aucun secret ici : cette configuration est publique.
  feedbackEndpoint: '',
  // Lien public du formulaire natif Grist, contenant /forms/ ; jamais une clé API.
  // Le document et sa table de réponses doivent rester privés dans Grist.
  feedbackFormUrl: 'https://grist.numerique.gouv.fr/o/docs/forms/8AecnaXASNUQjM8Ge9XpVA/4',
  feedbackFormUrls: {
    fr: 'https://grist.numerique.gouv.fr/o/docs/forms/8AecnaXASNUQjM8Ge9XpVA/4',
    en: 'https://grist.numerique.gouv.fr/o/docs/forms/8AecnaXASNUQjM8Ge9XpVA/5',
    de: 'https://grist.numerique.gouv.fr/o/docs/forms/8AecnaXASNUQjM8Ge9XpVA/5',
    es: 'https://grist.numerique.gouv.fr/o/docs/forms/8AecnaXASNUQjM8Ge9XpVA/5'
  },
  cacheBytes: 32 * 1024 * 1024,
  tileUrl: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
  tileAttribution: 'Données © OpenStreetMap contributors — rendu OpenStreetMap France',
  initialBounds: [[47.4, -0.1], [51.2, 7.7]]
};
