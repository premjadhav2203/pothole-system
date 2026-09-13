const axios = require('axios');
const pool = require('./db');

async function findAuthorityForLocation(lat, lng) {
  const geo = await axios.get('https://nominatim.openstreetmap.org/reverse', {
    params: { lat, lon: lng, format: 'json' },
    headers: { 'User-Agent': 'pothole-app' }
  });
  const pincode = geo.data.address.postcode;

  const result = await pool.query('SELECT * FROM authorities WHERE pincode = $1', [pincode]);
  return result.rows[0] || null;
}

module.exports = { findAuthorityForLocation };