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
    try {
        const { data, status } = req.body;
        
        //DURUM 1: İlk kayıt isteği - ÖNCELİKLE VALİDASYON YAP!
        if (status === "new-user") {
            
            const {  
                email,  
                password,  
                fullname,  
                birth_year,  
                city,  
                membershipType
            } = data;

            // 🔥 VALİDASYONLARI BURADA YAP!
            
            // 1. Eksik alan kontrolü  
            if (!email || !password || !fullname || !birth_year || !city || !membershipType) {  
                return res.status(400).json({ 
                    success: false,
                    message: 'Tüm zorunlu alanları doldurun.' 
                });  
            }  

            // 2. Format kontrolleri
            if (  
                typeof fullname !== 'string' ||  
                fullname.length > 40 ||  
                !/^[A-Za-zçÇğĞıİöÖşŞüÜ\s]+$/.test(fullname)  
            ) {  
                return res.status(400).json({  
                    success: false,
                    message: 'Ad soyad en fazla 40 karakter ve sadece harflerden oluşmalı.'  
                });  
            }

            if (  
                typeof email !== 'string' ||  
                email.length > 60 ||  
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)  
            ) {  
                return res.status(400).json({ 
                    success: false,
                    message: 'Geçerli ve en fazla 60 karakterlik bir e-posta giriniz.' 
                });  
            }

            if (  
                typeof password !== 'string' ||  
                password.length < 6 ||  
                password.length > 32  
            ) {  
                return res.status(400).json({ 
                    success: false,
                    message: 'Şifre 6-32 karakter arasında olmalı.' 
                });  
            }

            const by = String(birth_year);  
            if (!/^\d{4}$/.test(by) || by < 1900 || by > 2100) {  
                return res.status(400).json({ 
                    success: false,
                    message: 'Doğum yılı 1900-2100 arasında, 4 haneli olmalı.' 
                });  
            }

            if (  
                typeof city !== 'string' ||  
                city.length > 30 ||  
                !/^[A-Za-zçÇğĞıİöÖşŞüÜ\s\-]+$/.test(city)  
            ) {  
                return res.status(400).json({  
                    success: false,
                    message: 'Şehir adı en fazla 30 karakter ve sadece harf/tire içermeli.'  
                });  
            }

            if (!['aylik', 'yillik'].includes(membershipType)) {  
                return res.status(400).json({ 
                    success: false,
                    message: 'Geçersiz üyelik tipi.' 
                });  
            }

            // ÖNEMLİ: KULLANICI VAR MI KONTROL ET!
            const existingUser = await Users.findOne({ email });  
            if (existingUser) {  
                return res.status(409).json({ 
                    success: false,
                    message: 'Bu e-posta zaten kayıtlı!' 
                });  
            }

            //Tüm validasyonlar geçti, şimdi email kodu gönderebiliriz
            return res.status(200).json({
                success: true,
                message: 'Validasyonlar başarılı! Email doğrulama kodu gönderebilirsiniz.',
                email: email // Frontend için email'i döndür
            });
        }
        
        // 2: Email doğrulandı - sadece kaydet (minimal validasyon)
        else if (status === "email-verified") {
            
            const {  
                email,  
                password,  
                fullname,  
                birth_year,  
                city,  
                membershipType,  
                device_info,  
                fingerprint  
            } = data;

            // Minimal kontrol (çünkü zaten validasyon yapıldı)
            if (!email || !password || !fullname || !birth_year || !city || !membershipType) {  
                return res.status(400).json({ 
                    success: false,
                    message: 'Veri eksikliği!' 
                });  
            }

            // Email double-check (güvenlik için)
            const existingUser = await Users.findOne({ email });  
            if (existingUser) {  
                return res.status(409).json({ 
                    success: false,
                    message: 'Bu e-posta zaten kayıtlı!' 
                });  
            }

            // Şifreyi hashle  
            const saltRounds = 10;  
            const password_hash = await bcrypt.hash(password, saltRounds);  

            // Cihaz ve ID hazırla  
            const device_id = uuidv4();

            // IP adresi ve GEO bilgisi (aynı kalacak)
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

            if (!device_info.geo_location) {
                const geoInfo = await getGeoInfo(req);
                if (geoInfo) {
                    device_info.city_by_ip = geoInfo.city || null;
                    device_info.country_by_ip = geoInfo.country || null;
                    device_info.region_by_ip = geoInfo.region || null;
                }
            }

            // Kullanıcı dokümanını DB'ye kaydet (aynı kalacak)
            const userDoc = new Users({
                email,  
                password_hash,  
                fullname,  
                birth_year: String(birth_year),  
                city,  
                provider: 'local',  
                google_id: null,  
                membershipType,  
                devices: []
            });

            await userDoc.save();

            // JWT ve cihaz kayıt işlemleri (aynı kalacak)
            const payload = {  
                user_id: userDoc._id,  
                email: email,  
                device_id: device_id,  
                role: "user"  
            };  
            const A_token = jwt.sign(payload, JWT_SECRET, { expiresIn: '365d' });

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
                A_token,
                last_login: new Date()  
            };

            userDoc.devices.push(deviceObj);  
            await userDoc.save();

            res.cookie('A_token', A_token, {  
                httpOnly: true,  
                secure: process.env.NODE_ENV === 'production',  
                sameSite: 'strict',  
                maxAge: 1000 * 60 * 60 * 24 * 365
            });

            return res.status(201).json({  
                success: true,
                message: 'Kayıt başarıyla tamamlandı! Email doğrulandı.',  
                user_id: userDoc._id,  
                device_id,
                email_verified: true
            });
        }
        
        // DURUM 3: Cihaz ismi kaydet
        else if (status === "device-name") {
            const { email, deviceName, user_id, device_id } = req.body;

            // 1. Gerekli alanlar kontrolü
            if (!deviceName) {
                return res.status(400).json({ message: 'Cihaz ismi gerekli!' });
            }

            if (deviceName.length > 32) {
                return res.status(400).json({ message: 'Cihaz ismi en fazla 32 karakter olabilir!' });
            }

            // 2. user_id ve device_id ile arama (daha güvenli)
            if (user_id && device_id) {
                const updateResult = await Users.updateOne(
                    { 
                        "_id": user_id,
                        "devices.device_id": device_id 
                    },
                    { 
                        "$set": { 
                            "devices.$.device_info.deviceName": deviceName,
                            "devices.$.device_name_set_at": new Date()
                        },
                        "$push": {
                            "devices.$.device_info.loginHistory": {
                                "$each": [{
                                    login_time: new Date(),
                                    ip_address: getClientIp(req),
                                    action: 'device_name_set'
                                }],
                                "$position": 0,
                                "$slice": 300 // En fazla 300 kayıt tut
                            }
                        }
                    }
                );

                if (updateResult.matchedCount === 0) {
                    return res.status(404).json({ message: 'Kullanıcı veya cihaz bulunamadı!' });
                }

                // Hoş geldin emaili gönder
                try {
                    const user = await Users.findById(user_id);
                    if (user) {
                        const mailService = require('../services/mailService');
                        await mailService.sendWelcomeEmail(user.email, user.fullname);
                    }
                } catch (emailError) {
                    console.error('❌ Welcome email error:', emailError);
                    // Email hatası kayıt işlemini durdurmaz
                }

                return res.status(200).json({ 
                    success: true,
                    message: 'Cihaz ismi başarıyla kaydedildi ve kayıt tamamlandı!' 
                });
            }
            
            // 3. Fallback: email ile arama
            else if (email) {
                const user = await Users.findOne({ email });
                if (!user) {
                    return res.status(404).json({ message: 'Kullanıcı bulunamadı!' });
                }

                if (!user.devices || user.devices.length === 0) {
                    return res.status(400).json({ message: 'Kullanıcının kayıtlı cihazı yok!' });
                }

                // En son eklenen cihazı bul
                const lastDevice = user.devices[user.devices.length - 1];
                lastDevice.device_info.deviceName = deviceName;
                lastDevice.device_name_set_at = new Date();

                // LoginHistory kaydı ekle
                if (!Array.isArray(lastDevice.device_info.loginHistory)) {
                    lastDevice.device_info.loginHistory = [];
                }
                lastDevice.device_info.loginHistory.unshift({
                    login_time: new Date(),
                    ip_address: getClientIp(req),
                    action: 'device_name_set'
                });
                
                if (lastDevice.device_info.loginHistory.length > 300) {
                    lastDevice.device_info.loginHistory = lastDevice.device_info.loginHistory.slice(0, 300);
                }
                
                await user.save();

                // Hoş geldin emaili gönder
                try {
                    const mailService = require('../services/mailService');
                    await mailService.sendWelcomeEmail(user.email, user.fullname);
                } catch (emailError) {
                    console.error('❌ Welcome email error:', emailError);
                }

                return res.status(200).json({ 
                    success: true,
                    message: 'Cihaz ismi başarıyla kaydedildi!' 
                });
            }
            
            else {
                return res.status(400).json({ message: 'Email veya user_id/device_id gerekli!' });
            }
        }
        
        // Geçersiz status
        else {
            return res.status(400).json({
                error: 'Geçersiz status değeri!',
                received: status
            });
        }
        
    } catch (err) {  
        console.error('❌ Register route error:', err);  
        res.status(500).json({ 
            message: 'Sunucu hatası!',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });  
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