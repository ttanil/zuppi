const express = require('express');
const router = express.Router();
const { 
  sendMail, 
  sendContactEmail, 
  sendWelcomeEmail, 
  sendLoginNotification, 
  sendLoginVerificationEmail,
  verifyLoginToken,
  getActiveTokens,
  getVerificationTokens,
  testConnection 
} = require('../services/mailService');

// GELİŞTİRİLMİŞ GENEL MAİL ENDPOINT'İ
router.post('/send', async (req, res) => {
  try {
    const { to, subject, message, html, senderName } = req.body;
    
    // GÜNCEL VALİDATİON - message VEYA html olabilir
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

    // CLIENT INFO EKLE (IP adresi için)
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
      clientInfo // IP bilgisini ekle
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.error || error.message || 'Mail gönderilemedi'
    });
  }
});


router.get('/verify-login', async (req, res) => {
  try {
    const { token, action } = req.query;
    
    // Validation
    if (!token || !action) {
      return res.status(400).send(`
        <html>
          <head><meta charset="UTF-8"><title>Geçersiz Link</title></head>
          <body style="font-family: Arial; text-align: center; padding: 50px; background: #f8f9fa;">
            <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #dc3545;">❌ Geçersiz Onay Linki</h2>
              <p style="color: #666;">Token: ${token || 'eksik'} | Action: ${action || 'eksik'}</p>
              <a href="https://zuppi.live" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ana Sayfaya Dön</a>
            </div>
          </body>
        </html>
      `);
    }

    // Token doğrulama
    const result = await verifyLoginToken(token, action);
    
    // Hata durumu
    if (!result.success) {
      return res.send(`
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Onay Başarısız</title>
          </head>
          <body style="font-family: Arial; text-align: center; padding: 50px; background: #f8f9fa;">
            <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #dc3545;">❌ ${result.error}</h2>
              <p style="color: #666; margin: 20px 0;">
                ${result.code === 'TOKEN_EXPIRED' ? 'Onay linki süresi dolmuş. Lütfen yeni bir giriş denemesi yapın.' : ''}
                ${result.code === 'TOKEN_NOT_FOUND' ? 'Bu onay linki geçersiz veya zaten kullanılmış.' : ''}
                ${result.code === 'TOKEN_ALREADY_USED' ? 'Bu onay linki daha önce kullanılmış.' : ''}
              </p>
              <a href="https://zuppi.live" 
                 style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                Ana Sayfaya Dön
              </a>
            </div>
          </body>
        </html>
      `);
    }

    // BAŞARILI - APPROVED
    if (result.action === 'approved') {
      
      const email = result.data.userEmail;
      const time = result.data.verificationTime;
      const name = email.split('@')[0];
      
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Giriş Onaylandı</title>
          </head>
          <body style="font-family: Arial; text-align: center; padding: 50px; background: #f8f9fa;">
            
            <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #28a745;">✅ Giriş Başarıyla Onaylandı!</h2>
              <p style="color: #666; margin: 20px 0;">
                <strong>${email}</strong> hesabınıza giriş onayı verildi.
              </p>
              <div style="background: #d4edda; border-radius: 5px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #155724; font-size: 14px;">
                  ⏰ Onay Zamanı: ${time}
                </p>
              </div>
              <div id="spinner" style="border: 3px solid #f3f3f3; border-top: 3px solid #28a745; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 20px auto;"></div>
              <p style="color: #666; font-size: 14px;">Bu pencere 3 saniye sonra kapanacak</p>
            </div>

            <script>
              
              // LocalStorage'a verification data'yı kaydet
              try {
                const verificationData = {
                  verified: true,
                  action: 'approved',
                  userData: {
                    email: '${email}',
                    name: '${name}',
                    verificationTime: '${time}'
                  },
                  timestamp: Date.now()
                };
                
                localStorage.setItem('loginVerification', JSON.stringify(verificationData));
                
                // Storage event trigger
                window.dispatchEvent(new StorageEvent('storage', {
                  key: 'loginVerification',
                  newValue: JSON.stringify(verificationData)
                }));
                
              } catch(storageError) {
              }
              
              // PostMessage gönder
              try {
                const messageData = {
                  type: 'LOGIN_VERIFIED',
                  action: 'approved',
                  userData: {
                    email: '${email}',
                    name: '${name}',
                    verificationTime: '${time}'
                  }
                };
                
                // Opener'a gönder
                if (window.opener && !window.opener.closed) {
                  window.opener.postMessage(messageData, '*');
                } else {
                }
                
                // Parent'a gönder
                if (window.parent && window.parent !== window) {
                  window.parent.postMessage(messageData, '*');
                }
                
                // Broadcast
                window.postMessage(messageData, '*');
                
              } catch(postError) {
              }
              
              // 3 saniye sonra kapat veya yönlendir
              setTimeout(() => {
                try {
                  window.close();
                } catch(closeError) {
                  window.location.href = 'https://zuppi.live';
                }
              }, 3000);
              
            </script>
            
            <style>
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            </style>
          </body>
        </html>
      `);
    }
    
    // DENIED  
    else if (result.action === 'denied') {
  
      const email = result.data.userEmail;
      const time = result.data.verificationTime;
      const name = email.split('@')[0];
      
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Giriş Reddedildi</title>
          </head>
          <body style="font-family: Arial; text-align: center; padding: 50px; background: #f8f9fa;">
            <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #dc3545;">❌ Giriş Reddedildi</h2>
              <p style="color: #666; margin: 20px 0;">
                <strong>${email}</strong> hesabınıza giriş reddedildi.
              </p>
              <div style="background: #f8d7da; border-radius: 5px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #721c24; font-size: 14px;">
                  🔒 Güvenliğiniz için şifrenizi değiştirin.<br>
                  ⏰ Red Zamanı: ${time}
                </p>
              </div>
              <div id="spinner" style="border: 3px solid #f3f3f3; border-top: 3px solid #dc3545; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 20px auto;"></div>
              <p style="color: #666; font-size: 14px;">Bu pencere 3 saniye sonra kapanacak</p>
            </div>
            
            <script>
              console.log('❌ DENIED action processing...');
              
              // LocalStorage'a verification data'yı kaydet - userData ile birlikte
              try {
                const verificationData = {
                  verified: true,
                  action: 'denied',
                  userData: {
                    email: '${email}',
                    name: '${name}',
                    verificationTime: '${time}'
                  },
                  message: 'Giriş reddedildi. Güvenlik için şifrenizi değiştirin.',
                  timestamp: Date.now()
                };
                
                localStorage.setItem('loginVerification', JSON.stringify(verificationData));
                
                // Storage event trigger
                window.dispatchEvent(new StorageEvent('storage', {
                  key: 'loginVerification',
                  newValue: JSON.stringify(verificationData)
                }));
                
              } catch(storageError) {
                console.error('❌ Storage error:', storageError);
              }
              
              // PostMessage gönder - userData ile birlikte
              try {
                const messageData = {
                  type: 'LOGIN_VERIFIED',
                  action: 'denied',
                  userData: {
                    email: '${email}',
                    name: '${name}',
                    verificationTime: '${time}'
                  },
                  message: 'Giriş reddedildi. Güvenlik için şifrenizi değiştirin.'
                };
                
                
                // Opener'a gönder
                if (window.opener && !window.opener.closed) {
                  window.opener.postMessage(messageData, '*');
                }
                
                // Parent'a gönder
                if (window.parent && window.parent !== window) {
                  window.parent.postMessage(messageData, '*');
                }
                
                // Broadcast
                window.postMessage(messageData, '*');
                
              } catch(postError) {
              }
              
              // 3 saniye sonra kapat
              setTimeout(() => {
                try {
                  window.close();
                } catch(closeError) {
                  console.log('❌ Close failed, redirecting...');
                  window.location.href = 'https://zuppi.live';
                }
              }, 3000);
              
            </script>
            
            <style>
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            </style>
          </body>
        </html>
      `);
    }
    
  } catch (error) {
    res.status(500).send(`
      <html>
        <head><title>Sistem Hatası</title></head>
        <body style="text-align: center; padding: 50px;">
          <h2 style="color: #dc3545;">❌ Sistem Hatası</h2>
          <p>Doğrulama sırasında hata: ${error.message}</p>
          <a href="https://zuppi.live">Ana Sayfaya Dön</a>
        </body>
      </html>
    `);
  }
});
// LOGIN VERİFİKASYON EMAIL GÖNDER - YENİ ENDPOINT
router.post('/login-verification', async (req, res) => {
  try {
    
    const { userEmail, deviceInfo, userInfo } = req.body;
    
    // Validation
    if (!userEmail || !deviceInfo) {
      return res.status(400).json({ 
        success: false,
        error: 'userEmail ve deviceInfo zorunlu!' 
      });
    }

    // E-mail format kontrolü
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Geçersiz e-mail formatı'
      });
    }

    // Client IP bilgisini al
    const clientInfo = {
      ip: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'Unknown',
      userAgent: req.headers['user-agent']
    };

    const result = await sendLoginVerificationEmail(
      userEmail, 
      deviceInfo, 
      userInfo || { name: 'zuppi kullanıcısı' }, 
      clientInfo
    );
    
    res.json({
      success: true,
      message: 'Doğrulama e-postası gönderildi',
      verificationToken: result.verificationToken.substring(0, 8) + '...', // Güvenlik için kısalt
      expiresIn: '2 dakika',
      sentAt: result.result.sentAt
    });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'E-posta gönderilemedi',
      details: error.message 
    });
  }
});

// VERİFİKASYON DURUMU KONTROL ENDPOINT'İ
router.post('/check-verification', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token gerekli'
      });
    }

    // Token durumunu kontrol et (in-memory storage'dan)
    const verificationTokens = getVerificationTokens();
    
    // Token'ı tam haliyle bul (frontend'den sadece kısaltılmış hali gelir)
    let fullToken = null;
    let tokenData = null;
    
    for (const [key, data] of verificationTokens.entries()) {
      if (key.startsWith(token) || key.includes(token)) {
        fullToken = key;
        tokenData = data;
        break;
      }
    }
    
    if (!tokenData) {
      return res.json({
        success: true,
        verified: false,
        expired: true,
        message: 'Token bulunamadı veya süresi dolmuş'
      });
    }
    
    // Token süresi kontrol et
    if (Date.now() > tokenData.expiresAt) {
      return res.json({
        success: true,
        verified: false,
        expired: true,
        message: 'Doğrulama süresi doldu'
      });
    }
    
    // Token işaretlendi mi kontrol et
    if (tokenData.verified) {
      return res.json({
        success: true,
        verified: true,
        action: tokenData.action,
        userData: {
          email: tokenData.userEmail,
          name: tokenData.userInfo?.name || 'zuppi kullanıcısı',
          verificationTime: tokenData.verificationTime
        },
        message: tokenData.action === 'approved' ? 'Giriş onaylandı' : 'Giriş reddedildi'
      });
    }
    
    // Henüz işaretlenmemiş
    return res.json({
      success: true,
      verified: false,
      expired: false,
      remainingTime: Math.max(0, tokenData.expiresAt - Date.now()),
      message: 'E-posta onayı bekleniyor'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Doğrulama durumu kontrol edilemedi'
    });
  }
});

// AKTİF TOKEN'LARI LİSTELE (DEBUG/ADMIN) - YENİ ENDPOINT
router.get('/active-tokens', async (req, res) => {
  try {
    // Production'da bu route'u admin yetkisi ile koruyun!
    const activeTokens = getActiveTokens();
    
    res.json({
      success: true,
      activeTokensCount: activeTokens.length,
      tokens: activeTokens
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Token listesi alınamadı' 
    });
  }
});

// LOGIN NOTIFICATION ENDPOINT'İ
router.post('/login-notification', async (req, res) => {
  try {
    const { userEmail, deviceInfo, userInfo } = req.body;
    
    // Validation
    if (!userEmail || !deviceInfo) {
      return res.status(400).json({
        success: false,
        error: 'userEmail ve deviceInfo gereklidir'
      });
    }

    // E-mail format kontrolü
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Geçersiz e-mail formatı'
      });
    }

    // Client IP bilgisini al
    const clientInfo = {
      ip: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'Unknown',
      userAgent: req.headers['user-agent']
    };

    const result = await sendLoginNotification(
      userEmail, 
      deviceInfo, 
      userInfo || { name: 'zuppi kullanıcısı' }, 
      clientInfo
    );
    
    res.json({
      success: true,
      message: 'Login bildirim maili gönderildi',
      sentAt: result.sentAt
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.error || error.message || 'Login bildirim maili gönderilemedi'
    });
  }
});

// İLETİŞİM FORMU ENDPOINT'İ
router.post('/contact', async (req, res) => {
  try {
    const { name, email, message, subject } = req.body;
    
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error: 'Tüm alanlar gereklidir'
      });
    }

    // E-mail format kontrolü
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Geçersiz e-mail formatı'
      });
    }

    const result = await sendContactEmail({ name, email, message, subject });
    
    res.json({
      success: true,
      message: 'İletişim mesajınız başarıyla gönderildi!',
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Mesaj gönderilemedi: ' + (error.error || error.message)
    });
  }
});

// HOŞ GELDİN E-MAİLİ ENDPOINT'İ
router.post('/welcome', async (req, res) => {
  try {
    const { email, name } = req.body;
    
    if (!email || !name) {
      return res.status(400).json({
        success: false,
        error: 'E-mail ve isim gereklidir'
      });
    }

    // E-mail format kontrolü
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Geçersiz e-mail formatı'
      });
    }

    const result = await sendWelcomeEmail(email, name);
    res.json({
      success: true,
      message: 'Hoş geldin e-postası gönderildi',
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.error || error.message || 'Welcome mail gönderilemedi'
    });
  }
});

// SMTP TEST ENDPOINT'İ
router.get('/test', async (req, res) => {
  try {
    
    const isConnected = await testConnection();
    
    if (isConnected) {
      const result = await sendMail({
        to: 'tahsintanil@gmail.com',
        subject: '🎉 Zuppi SMTP Test',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #ff6b9d, #c44569); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">SMTP Çalışıyor! 🚀</h1>
            </div>
            <div style="padding: 30px; background: white;">
              <h2 style="color: #333;">Mail sistemi hazır! ✅</h2>
              <p style="color: #666; line-height: 1.6;">
                Tüm e-mail servisleri aktif ve çalışır durumda.
              </p>
              <div style="background: #d4edda; border-radius: 5px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #155724; font-size: 14px;">
                  <strong>Test Zamanı:</strong> ${new Date().toLocaleString('tr-TR')}<br>
                  <strong>Sunucu:</strong> ${process.env.SMTP_HOST}<br>
                  <strong>Port:</strong> ${process.env.SMTP_PORT}
                </p>
              </div>
            </div>
          </div>
        `,
        text: `SMTP Test başarılı! Tarih: ${new Date().toLocaleString('tr-TR')}`
      });
      
      res.json({
        success: true,
        message: 'SMTP test başarılı! Test e-postası gönderildi.',
        result,
        testTime: new Date().toISOString()
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
      error: error.message || 'SMTP test başarısız'
    });
  }
});

// SERVER STATUS ENDPOINT'İ - YENİ
router.get('/status', async (req, res) => {
  try {
    const activeTokens = getActiveTokens();
    
    res.json({
      success: true,
      status: 'Mail service aktif',
      activeTokens: activeTokens.length,
      smtpHost: process.env.SMTP_HOST,
      smtpPort: process.env.SMTP_PORT,
      serverTime: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Status alınamadı'
    });
  }
});

module.exports = router;