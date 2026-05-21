// Sert la clé VAPID publique au front (config notifs push).
// La clé VAPID PUBLIQUE n'est pas un secret en soi, mais on l'expose via cette
// function pour pouvoir la changer côté Netlify env sans toucher au code client.

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
      // Cache court : si la clé est corrigée côté Netlify, elle se propage vite.
      'Cache-Control': 'public, max-age=300',
    },
    body: JSON.stringify({
      // .trim() : une variable d'env collée avec un retour-ligne ou des
      // espaces produit une applicationServerKey rejetée par le navigateur.
      vapidKey: (process.env.FIREBASE_VAPID_KEY || '').trim()
    }),
  };
};
