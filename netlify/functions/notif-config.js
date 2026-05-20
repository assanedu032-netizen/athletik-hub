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
      'Cache-Control': 'public, max-age=3600',
    },
    body: JSON.stringify({
      vapidKey: process.env.FIREBASE_VAPID_KEY || ''
    }),
  };
};
