const express = require('express');
const router = express.Router();
const path = require('path');
const mongoose = require('mongoose');
const Users = require(path.join(__dirname, '..', 'models', 'users'));
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'YOUR_SECRET';

const authenticateUser = require(path.join(__dirname, '..', 'middleware','authenticateUser'));


router.get('/', authenticateUser, (req, res) => {
    console.log("tt",res.locals.userRole);
    res.render('sites/login', {
        user: res.locals.user,          // null veya {id, email, role}
        role: res.locals.userRole,       // "misafir", "user", "admin" veya "eğitmen"
    });
});

router.post('/', async (req, res) => {
    //console.log(req.body);
    if(req.body.status === "device"){
      try {
        const { email, password } = req.body;
        // 1. Alan kontrolü
        if (!email || !password) {
          return res.status(400).json({ error: 'E-posta ve şifre zorunlu!' });
        }

        // 2. Kullanıcı var mı?
        const user = await Users.findOne({ email });
        if (!user) {
          return res.status(401).json({ error: 'E-posta veya şifre hatalı!' });
        }

        // 3. Şifre doğru mu?
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
          return res.status(401).json({ error: 'E-posta veya şifre hatalı!' });
        }

        let control = false;
        let A_token = null;
        let deviceName = null;

        if(user.devices.length == 0){
          return res.status(401).json({ error: 'Yeni cihazla giriş yapılıyor!' });
        } else if(user.devices.length == 1){
          for(let i=0; i<user.devices.length; i++){
            const isSameDevice = isDeviceMatch(user.devices[i].device_info, req.body.device_info);
            if(isSameDevice){
              control = true;
              A_token = user.devices[i].A_token;
              deviceName = user.devices[i].device_info.deviceName;
              //console.log(user.devices[i]);
              //console.log("girildi");
              break;
            }
          }
          if(control){
            // 4. (İsteğe bağlı) Session’a/cookie’ye giriş yap
            req.session.userId = user._id;
            req.session.userRole = user.role;

            //console.log(req.session.userId, " ",req.session.userRole);

            res.cookie('A_token', A_token, { httpOnly: true, sameSite: 'lax', path: '/' });

            // ============= LOGIN HISTORY GÜNCELLE ======================
            // Giriş yapan cihazı bul: user.devices[i] döngüsünde eşleştiğini bulmuştun,
            // Burada i değişkenini defor da kullanabilirsin. Eğer i yoksa tekrar bul.
            const device = user.devices.find(d =>
              isDeviceMatch(d.device_info, req.body.device_info)
            );

            // login history ekle
            if (device && device.device_info.loginHistory) {
              device.device_info.loginHistory.unshift({
                login_time: new Date(),
                ip_address: getClientIp(req) // sadece backend’den alınır
              });

              // Limitle
              const MAX_LOGINS = 300;
              if (device.device_info.loginHistory.length > MAX_LOGINS) {
                device.device_info.loginHistory = device.device_info.loginHistory.slice(0, MAX_LOGINS);
              }

              await user.save();
            }

            // 5. Yönlendirme veya başarılı mesaj
            //res.redirect('/user'); // Giriş sonrası ana sayfa
            res.status(201).json({  
              message: 'Giriş başarılı!',
              user: {
                id: user._id,
                email: user.email,
                fullname: user.fullname,
                role: user.role,
                deviceName: deviceName || 'Bilinmeyen Cihaz' // ✅ DeviceName ekle
              }
            });
          } else{
            return res.status(401).json({ error: 'Yeni cihazla giriş yapılıyor!' });
          }

        } else if(user.devices.length == 2){
          for(let i=0; i<user.devices.length; i++){
            const isSameDevice = isDeviceMatch(user.devices[i].device_info, req.body.device_info);
            if(isSameDevice){
              control = true;
              A_token = user.devices[i].A_token;
              deviceName = user.devices[i].device_info.deviceName;
              //console.log(user.devices[i]);
              //console.log("girildi");
              break;
            }
          }

          if(control){
            // 4. (İsteğe bağlı) Session’a/cookie’ye giriş yap
            req.session.userId = user._id;
            req.session.userRole = user.role;

            //console.log(req.session.userId, " ",req.session.userRole);

            res.cookie('A_token', A_token, { httpOnly: true, sameSite: 'lax', path: '/' });

            // ============= LOGIN HISTORY GÜNCELLE ======================
            const device = user.devices.find(d =>
              isDeviceMatch(d.device_info, req.body.device_info)
            );

            // login history ekle
            if (device && device.device_info.loginHistory) {
              device.device_info.loginHistory.unshift({
                login_time: new Date(),
                ip_address: getClientIp(req) // sadece backend’den alınır
              });

              // Limitle
              const MAX_LOGINS = 300;
              if (device.device_info.loginHistory.length > MAX_LOGINS) {
                device.device_info.loginHistory = device.device_info.loginHistory.slice(0, MAX_LOGINS);
              }

              await user.save();
            }

            // 5. Yönlendirme veya başarılı mesaj
            //res.redirect('/user'); // Giriş sonrası ana sayfa
            res.status(201).json({  
              message: 'Giriş başarılı!',
              user: {
                id: user._id,
                email: user.email,
                fullname: user.fullname,
                role: user.role,
                deviceName: deviceName || 'Bilinmeyen Cihaz' // ✅ DeviceName ekle
              }
            });
          } else{
            return res.status(401).json({ error: 'Tanımlı olmayan cihazla giriş yapılıyor!' });
          }

        }
        
        
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Sunucu hatası, tekrar deneyin.' });
      }

    } else if(req.body.status === "device-name"){
        try {
          const { email, device_info, fingerprint } = req.body;
          const deviceName = device_info.deviceName;

          // 1. Alan kontrolü
          if (!email || !device_info || !deviceName) {
            return res.status(400).json({ error: 'Cihaz ismi zorunlu!' });
          }

          // 2. Kullanıcı var mı?
          const user = await Users.findOne({ email });
          if (!user) {
            return res.status(401).json({ error: 'E-posta hatalı!' });
          }

          // 3. Eksik device_info alanları varsa tamamla
          // (boşsa null, yoksa gelen değer atanır)
          const newDeviceInfo = {
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
            webgl_fingerprint: device_info.webgl_fingerprint || null,
            deviceName: deviceName,
            loginHistory: []
          };

          // 4. device_id üret
          const device_id = uuidv4();

          // 5. A_token üret
          const payload = {
            user_id: user._id,
            email: user.email,
            device_id: device_id,
            role: user.role
          };
          const A_token = jwt.sign(payload, JWT_SECRET, { expiresIn: '365d' });

          // 6. Yeni device objesini hazırla
          const newDevice = {
            device_id,
            fingerprint: fingerprint || null,
            device_info: newDeviceInfo,
            A_token,
            last_login: new Date()
          };

          // --------- ILK LOGIN GEÇMİŞİ EKLE -----------
          newDevice.device_info.loginHistory.unshift({
            login_time: new Date(),
            ip_address: getClientIp(req) // sadece backend’den alınır
          });

          // 7. User’ın cihaz listesine ekle ve kaydet
          user.devices.push(newDevice);
          await user.save();

          // 8. Session ve Cookie işlemleri
          req.session.userId = user._id;
          req.session.userRole = user.role;
          res.cookie('A_token', A_token, { httpOnly: true, sameSite: 'lax', path: '/' });

          res.status(201).json({ message: "Cihaz eklendi ve giriş yapıldı!" });
        } catch (err) {
          console.error(err);
          res.status(500).json({ error: 'Sunucu hatası, tekrar deneyin.' });
        }
      } else if(req.body.status === "device-approval-request"){
        console.log(req.body);
      }
  
});


function isDeviceMatch(dbDeviceInfo, incomingDeviceInfo) {
  const keys = [
    "os",
    "browser",
    "device_type",
    "screen_resolution",
    "color_depth",
    "touch_support"
  ];

  return keys.every(key =>
    dbDeviceInfo[key] != null &&
    incomingDeviceInfo[key] != null &&
    String(dbDeviceInfo[key]).toLowerCase() === String(incomingDeviceInfo[key]).toLowerCase()
  );
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