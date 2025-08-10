const fetch = require('node-fetch');

/**
 * Kullanıcının IP'sine göre şehir, ülke, koordinat vs bilgisini getirir.
 * @param {object} req - Express request nesnesi
 * @returns {object} Geo-IP bilgileri (veya hata olursa { city: null, ... })
 */
async function getGeoInfo(req) {
  // 1. IP adresini al
  let ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    null;

  // 2. Localhost (development) ise fallback IP kullan
  if (
    !ip ||
    ip === '::1' ||
    ip === '127.0.0.1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.endsWith('127.0.0.1')
  ) {
    ip = '8.8.8.8';
  }

  // 3. API URL hazırla
  const geoApiUrl = `http://ip-api.com/json/${ip}?fields=country,city,regionName,lat,lon,timezone,query,status,message`;

  // 4. API isteği at ve sonucu dön
  try {
    const gresp = await fetch(geoApiUrl, { timeout: 4000 });
    const data = await gresp.json();
    if (data.status === 'success') {
      return {
        ip: data.query,
        country: data.country,
        city: data.city,
        region: data.regionName,
        latitude: data.lat,
        longitude: data.lon,
        timezone: data.timezone
      };
    } else {
      return {
        ip,
        country: null,
        city: null,
        region: null,
        latitude: null,
        longitude: null,
        timezone: null,
        error: data.message || 'API erişim hatası'
      };
    }
  } catch (e) {
    return {
      ip,
      country: null,
      city: null,
      region: null,
      latitude: null,
      longitude: null,
      timezone: null,
      error: e.message || 'Bilinmeyen hata'
    };
  }
}

module.exports = { getGeoInfo };