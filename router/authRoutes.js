const express = require('express');
const router = express.Router();
const path = require('path');
const mongoose = require('mongoose');
const Users = require(path.join(__dirname, '..', 'models', 'users'));

//  LOGOUT ENDPOINT
router.post('/logout', (req, res) => {
  try {
    
    // Token cookie'sini sil
    res.clearCookie('A_token', { 
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    // Session'ı temizle (eğer kullanıyorsanız)
    if (req.session) {
      req.session.destroy();
    }
    
    res.json({ 
      success: true, 
      message: 'Başarıyla çıkış yapıldı' 
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Çıkış işlemi başarısız' 
    });
  }
});

router.post('/login-success', async (req, res) => {
  try {
    const { email, verificationTime, loginMethod } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email gerekli'
      });
    }
    
    const user = await Users.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Kullanıcı bulunamadı'
      });
    }

    // User role mevcut sistemden al
    let userRole = user.role || 'user';
/*
    // ✅ Admin kontrolü (mevcut sisteminizle uyumlu)
    if (email === 'tahsintanil@gmail.com' || email === 'admin@zuppi.live') {
      userRole = 'admin';
    } else if (email.endsWith('@zuppi.live')) {
      userRole = 'moderator';
    }
*/
    // Aktif cihazdan A_token al (mevcut sisteminizden)
    let A_token = null;
    let deviceName = 'Bilinmeyen Cihaz';
    
    if (user.devices && user.devices.length > 0) {
      // İlk aktif cihazı kullan (veya son login yapan cihazı)
      const activeDevice = user.devices[0]; // İlk cihaz
      A_token = activeDevice.A_token;
      deviceName = activeDevice.device_info?.deviceName || 'Bilinmeyen Cihaz';
    }

    // Session ayarla (mevcut sisteminizle uyumlu)
    req.session.userId = user._id;
    req.session.userRole = userRole;

    // Cookie ayarla (mevcut sisteminizle uyumlu)
    if (A_token) {
      res.cookie('A_token', A_token, { 
        httpOnly: true, 
        sameSite: 'lax', 
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      });
    }

    // Login history güncelle (email verification için)
    if (user.devices && user.devices.length > 0) {
      const device = user.devices[0]; // İlk cihaz
      
      if (device && device.device_info) {
        // Login history yoksa oluştur
        if (!device.device_info.loginHistory) {
          device.device_info.loginHistory = [];
        }
        
        // Yeni login kaydı ekle
        device.device_info.loginHistory.unshift({
          login_time: new Date(),
          ip_address: getClientIp(req), // Mevcut fonksiyonunuzu kullanın
          login_method: 'email_verification',
          verification_time: verificationTime
        });

        // Limit kontrol
        const MAX_LOGINS = 300;
        if (device.device_info.loginHistory.length > MAX_LOGINS) {
          device.device_info.loginHistory = device.device_info.loginHistory.slice(0, MAX_LOGINS);
        }

        await user.save();
      }
    }

    // Başarılı response (mevcut format ile uyumlu)
    res.status(200).json({
      success: true,
      message: 'Giriş başarılı!',
      user: {
        id: user._id,
        email: user.email,
        fullname: user.fullname,
        name: user.fullname || email.split('@')[0],
        role: userRole,
        avatar: user.avatar || null,
        createdAt: user.createdAt,
        lastLogin: new Date().toISOString(),
        deviceName: deviceName
      },
      userRole: userRole,
      sessionToken: A_token, // Mevcut A_token'ı kullan
      loginMethod: loginMethod,
      verificationTime: verificationTime,
      serverTime: new Date().toISOString()
    });
    
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Login success processing failed',
      details: error.message
    });
  }
});

//IP alma fonksiyonu (mevcut sisteminizden kopyalayın)
function getClientIp(req) {
  return req.ip || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         req.headers['x-forwarded-for']?.split(',')[0] || 
         'Unknown';
}

module.exports = router;