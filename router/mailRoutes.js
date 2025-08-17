const express = require('express');
const router = express.Router();
const { sendMail, sendContactEmail, sendWelcomeEmail, sendLoginNotification, testConnection } = require('../services/mailService');

// ✅ GELİŞTİRİLMİŞ GENEL MAİL ENDPOINT'İ
router.post('/send', async (req, res) => {
  try {
    const { to, subject, message, html, senderName } = req.body;
    
    // ✅ GÜNCEL VALİDATİON - message VEYA html olabilir
    if (!to || !subject || (!message && !html)) {
      return res.status(400).json({
        success: false,
        error: 'E-mail adresi, konu ve mesaj/html içeriği gereklidir'
      });
    }

    // E-mail format kontrolü
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        success: false,
        error: 'Geçersiz e-mail formatı'
      });
    }

    // ✅ CLIENT INFO EKLE (IP adresi için)
    const clientInfo = {
      ip: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent']
    };

    const result = await sendMail({
      to,
      subject,
      text: message,
      html,
      from: senderName ? `"${senderName}" <${process.env.SMTP_USER}>` : null,
      clientInfo // ✅ IP bilgisini ekle
    });

    res.json(result);
  } catch (error) {
    console.error('❌ Mail send error:', error);
    res.status(500).json({
      success: false,
      error: error.error || error.message || 'Mail gönderilemedi'
    });
  }
});

// ✅ LOGIN NOTIFICATION ENDPOINT'İ EKLE
router.post('/login-notification', async (req, res) => {
  try {
    const { userEmail, deviceInfo, userInfo } = req.body;
    
    if (!userEmail || !deviceInfo) {
      return res.status(400).json({
        success: false,
        error: 'User email ve device info gereklidir'
      });
    }

    const clientInfo = {
      ip: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent']
    };

    const result = await sendLoginNotification(userEmail, deviceInfo, userInfo, clientInfo);
    
    res.json({
      success: true,
      message: 'Login bildirim maili gönderildi',
      result
    });
  } catch (error) {
    console.error('❌ Login notification error:', error);
    res.status(500).json({
      success: false,
      error: error.error || error.message || 'Login bildirim maili gönderilemedi'
    });
  }
});

// İletişim formu endpoint'i
router.post('/contact', async (req, res) => {
  try {
    const { name, email, message, subject } = req.body;
    
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error: 'Tüm alanlar gereklidir'
      });
    }

    const result = await sendContactEmail({ name, email, message, subject });
    
    res.json({
      success: true,
      message: 'İletişim mesajınız başarıyla gönderildi!'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Mesaj gönderilemedi: ' + (error.error || error.message)
    });
  }
});

// Hoş geldin e-maili endpoint'i
router.post('/welcome', async (req, res) => {
  try {
    const { email, name } = req.body;
    
    if (!email || !name) {
      return res.status(400).json({
        success: false,
        error: 'E-mail ve isim gereklidir'
      });
    }

    const result = await sendWelcomeEmail(email, name);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.error || error.message || 'Welcome mail gönderilemedi'
    });
  }
});

// SMTP test endpoint'i
router.get('/test', async (req, res) => {
  try {
    const isConnected = await testConnection();
    
    if (isConnected) {
      const result = await sendMail({
        to: 'tahsintanil@gmail.com',
        subject: '🎉 Zuppi SMTP Test',
        html: `
          <h1 style="color: #ff6b9d;">SMTP Çalışıyor! 🚀</h1>
          <p>Mail sistemi hazır.</p>
          <p><strong>Test Zamanı:</strong> ${new Date().toLocaleString('tr-TR')}</p>
        `
      });
      
      res.json({
        success: true,
        message: 'SMTP test başarılı!',
        result
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'SMTP bağlantısı başarısız'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;