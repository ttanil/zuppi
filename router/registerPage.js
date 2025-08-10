const express = require('express');
const router = express.Router();
const path = require('path');
const mongoose = require('mongoose');
const Users = require(path.join(__dirname, '..', 'models', 'users'));
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { OAuth2Client } = require('google-auth-library');
const CLIENT_ID = "558871967639-4bh4ord5cphs9qhs8f8okrq9fvoh10v9.apps.googleusercontent.com";
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "artnail";

const authenticateUser = require('../middleware/authenticateUser');
const { getGeoInfo } = require(path.join(__dirname, '.', 'geoInfos'));


router.get('/', authenticateUser, (req, res) => {
    console.log(res.locals.userRole);
    res.render('sites/register', {
        user: res.locals.user,          // null veya {id, email, role}
        role: res.locals.userRole,       // "misafir", "user", "admin" veya "eğitmen"
    });
});

async function verifyGoogleToken(idToken) {
    const client = new OAuth2Client(CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken, audience: CLIENT_ID });
    return ticket.getPayload();
}

router.post('/', async (req, res) => {
    if(req.body.status === "new-user"){

        try {  
            const {  
                email,  
                password,  
                fullname,  
                birth_year,  
                city,  
                membershipType,  
                device_info,  
                fingerprint  
            } = req.body.data;  

            // 1. Eksik alan kontrolü  
            if (!email || !password || !fullname || !birth_year || !city || !membershipType) {  
                return res.status(400).json({ message: 'Tüm zorunlu alanları doldurun.' });  
            }  

            // 2. Regex ve format kontrolleri (düzeltilmiş)  
            // Ad-Soyad (sadece Türkçe, İngilizce harf ve boşluk, max 40)  
            if (  
                typeof fullname !== 'string' ||  
                fullname.length > 40 ||  
                !/^[A-Za-zçÇğĞıİöÖşŞüÜ\s]+$/.test(fullname)  
            ) {  
                return res.status(400).json({  
                    message: 'Ad soyad en fazla 40 karakter ve sadece harflerden oluşmalı.'  
                });  
            }  

            // E-posta  
            if (  
                typeof email !== 'string' ||  
                email.length > 60 ||  
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)  
            ) {  
                return res.status(400).json({ message: 'Geçerli ve en fazla 60 karakterlik bir e-posta giriniz.' });  
            }  

            // Şifre  
            if (  
                typeof password !== 'string' ||  
                password.length < 6 ||  
                password.length > 32  
            ) {  
                return res.status(400).json({ message: 'Şifre 6-32 karakter arasında olmalı.' });  
            }  

            // Doğum yılı (1900-2100 arası, 4 hane)  
            const by = String(birth_year);  
            if (!/^\d{4}$/.test(by) || by < 1900 || by > 2100) {  
                return res.status(400).json({ message: 'Doğum yılı 1900-2100 arasında, 4 haneli olmalı.' });  
            }  

            // Şehir (tire, Türkçe harf, İngilazce harf, boşluk, max 30) — TİRE DÜZELTİLDİ  
            if (  
                typeof city !== 'string' ||  
                city.length > 30 ||  
                !/^[A-Za-zçÇğĞıİöÖşŞüÜ\s\-]+$/.test(city)  
            ) {  
                return res.status(400).json({  
                    message: 'Şehir adı en fazla 30 karakter ve sadece harf/tire içermeli.'  
                });  
            }  

            // Üyelik tipi  
            if (!['aylik', 'yillik'].includes(membershipType)) {  
                return res.status(400).json({ message: 'Geçersiz üyelik tipi.' });  
            }  

            // 3. Kullanıcı var mı?  
            const existingUser = await Users.findOne({ email });  
            if (existingUser) {  
                return res.status(409).json({ message: 'Bu e-posta zaten kayıtlı!' });  
            }  

            // 4. Şifreyi hashle  
            const saltRounds = 10;  
            const password_hash = await bcrypt.hash(password, saltRounds);  

            // 5. Cihaz ve ID hazırla  
            const device_id = uuidv4();

            /*
            if(device_info.geo_location){
            const loc = await reverseGeocode(device_info.geo_location.latitude, device_info.geo_location.longitude);
            device_info.city_by_ip = loc.city || null;
            device_info.country_by_ip = loc.country || null;
            device_info.region_by_ip = loc.region || null;
            }
            */
            // 6. IP adresi belirle
            if (!device_info || typeof device_info !== 'object') {
            return res.status(400).json({ message: 'Cihaz bilgisi eksik veya hatalı.' });
            }
            if (!device_info.ip_address) {
            device_info.ip_address =
                req.headers["x-forwarded-for"]?.split(',')[0]?.trim() ||
                req.connection.remoteAddress ||
                req.socket?.remoteAddress ||
                null;
            }

            // 7. **GEOİP'ten konum set et**
            if (!device_info.geo_location) {
            // IP coğrafi bilgisini çek
            const geoInfo = await getGeoInfo(req);
            // geoInfo'dan koordinatları al
            if (geoInfo) {
                device_info.city_by_ip = geoInfo.city || null;
                device_info.country_by_ip = geoInfo.country || null;
                device_info.region_by_ip = geoInfo.region || null;
            }
            }

            // 8. Önce kullanıcı dokümanını DB'ye kaydet (henüz device eklemeden)  
            const userDoc = new Users({
                email,  
                password_hash,  
                fullname,  
                birth_year: by,  
                city,  
                provider: 'local',  
                google_id: null,  
                membershipType,  
                devices: [] // Şimdilik boş, birazdan cihaz objesini pushlayacağız  
            });  

            await userDoc.save(); // Artık userDoc._id var!  

            // 9. JWT oluştur  
            const payload = {  
                user_id: userDoc._id,  
                email: email,  
                device_id: device_id,  
                role: "user"  
            };  
            const A_token = jwt.sign(payload, JWT_SECRET, { expiresIn: '365d' });  

            // 10. Cihaz objesini oluştur  
            const deviceObj = {  
                device_id,  
                fingerprint: fingerprint || null,  
                device_info: {  
                    os: device_info.os || null,  
                    browser: device_info.browser || null,  
                    browser_version: device_info.browser_version || null,  
                    device_type: device_info.device_type || null,  
                    model: device_info.model || null,  
                    user_agent: device_info.user_agent || null,  
                    ip_address: device_info.ip_address || null,  
                    city_by_ip: device_info.city_by_ip || null,  
                    country_by_ip: device_info.country_by_ip || null,  
                    region_by_ip: device_info.region_by_ip || null,  
                    timezone: device_info.timezone || null,  
                    language: device_info.language || null,  
                    screen_resolution: device_info.screen_resolution || null,  
                    color_depth: device_info.color_depth || null,  
                    touch_support: typeof device_info.touch_support === 'boolean' ? device_info.touch_support : null,  
                    is_incognito: typeof device_info.is_incognito === 'boolean' ? device_info.is_incognito : null,  
                    plugins: Array.isArray(device_info.plugins) ? device_info.plugins : [],  
                    canvas_fingerprint: device_info.canvas_fingerprint || null,  
                    webgl_fingerprint: device_info.webgl_fingerprint || null  
                },  
                A_token, // JWT cihazda hangi token ile giriş yapmış, DB'de görünür!  
                last_login: new Date()  
            };  

            // 11. Cihazı kullanıcıya ekle, tekrar kaydet  
            userDoc.devices.push(deviceObj);  
            await userDoc.save();  

            // 12. JWT cookie olarak yaz  
            res.cookie('A_token', A_token, {  
                httpOnly: true,  
                secure: process.env.NODE_ENV === 'production',  
                sameSite: 'strict',  
                maxAge: 1000 * 60 * 60 * 24 * 365 // 1 yıl  
            });  

            // 13. Başarılı yanıt  
            res.status(201).json({  
                message: 'Kayıt başarılı!',  
                user_id: userDoc._id,  
                device_id  
            });    
        } catch (err) {  
            console.error(err);  
            res.status(500).json({ message: 'Sunucu hatası!' });  
        }

    } else if(req.body.status === "device-name"){
        try {
            const { email, deviceName } = req.body; // veya user_id ile de alabilirsin

            // 1. Gerekli alanlar kontrolü
            if (!email || !deviceName) {
            return res.status(400).json({ message: 'Eksik veri!' });
            }

            // 2. User bul
            const user = await Users.findOne({ email });
            if (!user) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı!' });
            }

            // 3. Kullanıcıda cihaz varmı kontrol
            if (!user.devices || user.devices.length === 0) {
            return res.status(400).json({ message: 'Kullanıcının kayıtlı cihazı yok!' });
            }

            // 4. En son eklenen cihazı bul
            const lastDevice = user.devices[user.devices.length - 1];
            lastDevice.device_info.deviceName = deviceName;

            // 5. LoginHistory kaydı ekle
            if (!Array.isArray(lastDevice.device_info.loginHistory)) {
                lastDevice.device_info.loginHistory = [];
            }
            lastDevice.device_info.loginHistory.unshift({
                login_time: new Date(),
                ip_address: getClientIp(req)
            });
            if (lastDevice.device_info.loginHistory.length > 300) {
                lastDevice.device_info.loginHistory = lastDevice.device_info.loginHistory.slice(0, 300);
            }
            await user.save();

            return res.status(200).json({ message: 'Cihaz ismi başarıyla kaydedildi!' });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ message: 'Sunucu hatası!' });
        }

    }
});

async function reverseGeocode(lat, lon) {
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'ArtNailRegisterBot' }
  });
  const data = await res.json();
  const address = data.address || {};
  return {
    city: address.city || address.town || address.village || null,
    country: address.country || null,
    region: address.state || null,
    raw: address
  };
}

function getClientIp(req) {
    // eğer proxy arkasındaysan, header kullan
    // X-Forwarded-For çoklu olursa ilk adres gerçek client’tır.
    const xfwd = req.headers['x-forwarded-for'];
    if (xfwd) {
        const ips = xfwd.split(',').map(ip => ip.trim());
        return ips[0];
    }
    // veya direkt req.ip (Express 4+ için güvenli)
    return req.ip;
}


module.exports = router;