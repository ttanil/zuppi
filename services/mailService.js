const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();

// IN-MEMORY TOKEN STORAGE (Production'da Redis/Database kullan)
const verificationTokens = new Map();

// TOKEN ve Verification codes TEMİZLEME SCHEDULER (Her 5 dakikada bir)
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of verificationTokens.entries()) {
    if (now > data.expiresAt) {
      verificationTokens.delete(token);
    }
  }

  for (const [email, data] of verificationCodes.entries()) {
    if (now > data.expiresAt) {
      verificationCodes.delete(email);
    }
  }
}, 5 * 60 * 1000); // 5 dakika

// ZOHO.EU İÇİN SMTP TRANSPORTER
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST, // smtp.zoho.eu
    port: parseInt(process.env.SMTP_PORT), // 587
    secure: process.env.SMTP_SECURE === 'true', // false
    auth: {
      user: process.env.SMTP_USER, // iletisim@zuppi.live
      pass: process.env.SMTP_PASS  // E+k241208
    },
    tls: {
      rejectUnauthorized: false,
      ciphers: 'SSLv3'
    },
    debug: false,
    logger: false
  });
};

// BAĞLANTI TEST FONKSİYONU
const testConnection = async () => {
  try {
    const transporter = createTransporter();
    
    await transporter.verify();
    return true;
  } catch (error) {
    return false;
  }
};

//GENEL MAİL GÖNDERME FONKSİYONU
const sendMail = async ({ to, subject, text, html, from = null, clientInfo = null }) => {
  try {
    const transporter = createTransporter();
    
    let finalHtml = html || `<p>${text || 'E-mail içeriği'}</p>`;
    if (clientInfo && clientInfo.ip && html) {
      finalHtml = html.replace('[Sunucu tarafından eklenecek]', clientInfo.ip);
    }
    
    const mailOptions = {
      from: from || `"${process.env.APP_NAME || 'zuppi'}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text: text || 'E-mail içeriği',
      html: finalHtml
    };

    const result = await transporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: result.messageId,
      to,
      subject,
      sentAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Mail gönderme hatası:', error.message);
    throw {
      success: false,
      error: error.message,
      code: error.code
    };
  }
};

// LOGIN VERİFİKASYON TOKEN OLUŞTUR
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// LOGIN VERİFİKASYON EMAİL GÖNDER
const sendLoginVerificationEmail = async (userEmail, deviceInfo, userInfo, clientInfo = null) => {
  try {
    const verificationToken = generateVerificationToken();
    const expiresAt = Date.now() + (2 * 60 * 1000); // 2 dakika
    
    // Token'ı memory'de sakla
    verificationTokens.set(verificationToken, {
      userEmail,
      deviceInfo,
      userInfo,
      clientInfo,
      createdAt: Date.now(),
      expiresAt,
      verified: false
    });

    const loginTime = new Date().toLocaleString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Europe/Istanbul'
    });

    const deviceName = deviceInfo.deviceName || 'Bilinmeyen Cihaz';
    const location = deviceInfo.geo_location 
      ? `${deviceInfo.geo_location.latitude.toFixed(4)}, ${deviceInfo.geo_location.longitude.toFixed(4)}`
      : 'Konum bilgisi alınamadı';
    const ipAddress = clientInfo?.ip || 'Bilinmeyen IP';

    // Verification URL'leri
    //const verifyUrl = `${process.env.APP_URL}/api/mail/verify-login?token=${verificationToken}&action=approved`;
    //const denyUrl = `${process.env.APP_URL}/api/mail/verify-login?token=${verificationToken}&action=denied`;
    const verifyUrl = `http://127.0.0.1:5000/api/mail/verify-login?token=${verificationToken}&action=approved`;
    const denyUrl = `http://127.0.0.1:5000/api/mail/verify-login?token=${verificationToken}&action=denied`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
        <div style="background: linear-gradient(135deg, #ff6b9d, #c44569); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Giriş Onay Talebi</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Bu giriş sizin tarafınızdan mı yapılıyor?</p>
        </div>
        
        <div style="padding: 30px; background: white;">
          <h2 style="color: #333; margin-top: 0;">Merhaba ${userInfo?.name || 'zuppi kullanıcısı'}! 👋</h2>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
            <h3 style="color: #856404; margin-top: 0; font-size: 18px;">⚠️ Güvenlik Onayı Gerekli</h3>
            <p style="color: #856404; margin-bottom: 0; font-size: 14px;">
              Hesabınıza giriş yapılmak isteniyor. Bu girişi onaylayın veya reddedin.
            </p>
          </div>
          
          <div style="background: #f8f9fa; border-left: 4px solid #ff6b9d; padding: 20px; margin: 25px 0;">
            <h3 style="color: #333; margin-top: 0; font-size: 18px;">📊 Giriş Detayları</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: bold; width: 140px;">⏰ Tarih & Saat:</td>
                <td style="padding: 8px 0; color: #333;">${loginTime}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: bold;">📱 Cihaz:</td>
                <td style="padding: 8px 0; color: #333;">${deviceName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: bold;">📍 Konum:</td>
                <td style="padding: 8px 0; color: #333;">${location}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: bold;">🌍 IP Adresi:</td>
                <td style="padding: 8px 0; color: #333;">${ipAddress}</td>
              </tr>
            </table>
          </div>
          
          <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 15px; margin: 25px 0; text-align: center;">
            <p style="color: #721c24; margin: 0; font-size: 14px; font-weight: bold;">
              ⏱️ Bu onay linki 2 dakika içinde geçersiz olacaktır!
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <h3 style="color: #333; margin-bottom: 20px;">Bu giriş sizin tarafınızdan mı yapılıyor?</h3>
            
            <div style="margin: 20px 0;">
              <a href="${verifyUrl}" 
                 style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 10px; font-weight: bold; font-size: 16px;">
                ✅ EVET, BENİM
              </a>
            </div>
            
            <div style="margin: 20px 0;">
              <a href="${denyUrl}" 
                 style="background: linear-gradient(135deg, #dc3545, #c82333); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 10px; font-weight: bold; font-size: 16px;">
                ❌ HAYIR, DEĞİL
              </a>
            </div>
          </div>
          
          <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 25px 0;">
            <h4 style="color: #155724; margin-top: 0; font-size: 14px;">🔒 Güvenlik Bilgilendirmesi</h4>
            <p style="color: #155724; margin-bottom: 0; font-size: 13px;">
              • Bu giriş sizinse "EVET, BENİM" butonuna tıklayın<br>
              • Sizin değilse "HAYIR, DEĞİL" butonuna tıklayın ve derhal şifrenizi değiştirin<br>
              • 2 dakika içinde onaylamazsanız giriş otomatik olarak reddedilecektir
            </p>
          </div>
        </div>
        
        <div style="background: #343a40; color: #fff; text-align: center; padding: 20px;">
          <p style="margin: 0; font-size: 14px; opacity: 0.8;">
            Bu e-posta otomatik olarak gönderilmiştir. Doğrudan yanıtlamayın.
          </p>
          <p style="margin: 10px 0 0 0; font-size: 12px; opacity: 0.6;">
            Token: ${verificationToken.substring(0, 8)}... | Süre: 2 dakika
          </p>
        </div>
      </div>
    `;

    const result = await sendMail({
      to: userEmail,
      subject: '🔐 zuppi Giriş Onayı - 2 Dakika İçinde Onaylayın!',
      html,
      text: `zuppi hesabınıza giriş yapmak için onay gerekli. Onay: ${verifyUrl} | Red: ${denyUrl} | Süre: 2 dakika`,
      from: `"zuppi Güvenlik" <${process.env.SMTP_USER}>`,
      clientInfo
    });

    return {
      success: true,
      verificationToken,
      expiresAt,
      result
    };

  } catch (error) {
    console.error('❌ Login verification email error:', error);
    throw error;
  }
};

// VERIFICATION TOKENS'LARı DIŞARI VER (DEBUG İÇİN)
const getVerificationTokens = () => {
  return verificationTokens;
};

// VERİFİKASYON İŞLEMİNİ GÜNCELLEYEN FONKSİYON
const verifyLoginToken = async (token, action = 'approved') => {
  try {
    // Token var mı kontrol et
    const tokenData = verificationTokens.get(token);
    if (!tokenData) {
      return {
        success: false,
        error: 'Onay linki geçersiz veya süresi dolmuş',
        code: 'TOKEN_NOT_FOUND'
      };
    }
    
    // Token süresi dolmuş mu kontrol et
    if (Date.now() > tokenData.expiresAt) {
      verificationTokens.delete(token);
      return {
        success: false,
        error: 'Onay linki süresi dolmuş (2 dakika)',
        code: 'TOKEN_EXPIRED'
      };
    }
    
    // Token zaten kullanılmış mı kontrol et
    if (tokenData.verified) {
      return {
        success: false,
        error: 'Bu onay linki zaten kullanılmış',
        code: 'TOKEN_ALREADY_USED'
      };
    }

    // Token'ı işaretle
    const verificationTime = new Date().toLocaleString('tr-TR', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    const deviceName = tokenData.deviceInfo.deviceName || tokenData.deviceInfo.browser || 'Bilinmeyen Cihaz';
    
    // Token data'yı güncelle
    tokenData.verified = true;
    tokenData.verificationTime = verificationTime;
    
    // ACTION FIX - approve/deny -> approved/denied
    let finalAction = action;
    if (action === 'approve') {
      finalAction = 'approved';
    } else if (action === 'deny') {
      finalAction = 'denied';
    }
    
    tokenData.action = finalAction;
    verificationTokens.set(token, tokenData);
    
    // Başarılı response döndür
    if (finalAction === 'approved') {
      return {
        success: true,
        action: 'approved',
        message: 'Giriş başarıyla onaylandı',
        data: {
          userEmail: tokenData.userEmail,
          deviceName,
          verificationTime,
          originalLoginTime: new Date(tokenData.createdAt).toLocaleString('tr-TR')
        }
      };
      
    } else if (finalAction === 'denied') {
      return {
        success: true,
        action: 'denied',
        message: 'Giriş reddedildi. Güvenliğiniz için şifrenizi değiştirmenizi öneririz.',
        data: {
          userEmail: tokenData.userEmail,
          deviceName,
          verificationTime,
          securityAlert: true
        }
      };
    }
    
  } catch (error) {
    console.error('❌ verifyLoginToken error:', error);
    return {
      success: false,
      error: 'Onay işlemi sırasında hata oluştu: ' + error.message,
      code: 'VERIFICATION_ERROR'
    };
  }
};

// AKTIF TOKEN'LARI LİSTELE (DEBUG)
const getActiveTokens = () => {
  const activeTokens = [];
  const now = Date.now();
  
  for (const [token, data] of verificationTokens.entries()) {
    if (now <= data.expiresAt) {
      activeTokens.push({
        token: token.substring(0, 8) + '...',
        userEmail: data.userEmail,
        createdAt: new Date(data.createdAt).toLocaleTimeString(),
        expiresAt: new Date(data.expiresAt).toLocaleTimeString(),
        remainingSeconds: Math.round((data.expiresAt - now) / 1000)
      });
    }
  }
  
  return activeTokens;
};

// REGULAR LOGIN NOTIFICATION (Onaysız)
const sendLoginNotification = async (userEmail, deviceInfo, userInfo, clientInfo = null) => {
  try {
    const loginTime = new Date().toLocaleString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Europe/Istanbul'
    });

    const deviceName = deviceInfo.deviceName || 'Bilinmeyen Cihaz';
    const location = deviceInfo.geo_location 
      ? `${deviceInfo.geo_location.latitude.toFixed(4)}, ${deviceInfo.geo_location.longitude.toFixed(4)}`
      : 'Konum bilgisi alınamadı';

    const ipAddress = clientInfo?.ip || 'Bilinmeyen IP';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
        <div style="background: linear-gradient(135deg, #ff6b9d, #c44569); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Güvenlik Bildirimi</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Hesabınıza giriş yapıldı</p>
        </div>
        
        <div style="padding: 30px; background: white;">
          <h2 style="color: #333; margin-top: 0;">Merhaba ${userInfo?.name || 'zuppi kullanıcısı'}! 👋</h2>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
            zuppi hesabınıza başarılı bir giriş yapıldı. Aşağıda giriş detaylarını bulabilirsiniz:
          </p>
          
          <div style="background: #f8f9fa; border-left: 4px solid #ff6b9d; padding: 20px; margin: 25px 0;">
            <h3 style="color: #333; margin-top: 0; font-size: 18px;">📊 Giriş Detayları</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: bold; width: 140px;">⏰ Tarih & Saat:</td>
                <td style="padding: 8px 0; color: #333;">${loginTime}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: bold;">📱 Cihaz:</td>
                <td style="padding: 8px 0; color: #333;">${deviceName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: bold;">📍 Konum:</td>
                <td style="padding: 8px 0; color: #333;">${location}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-weight: bold;">🌍 IP Adresi:</td>
                <td style="padding: 8px 0; color: #333;">${ipAddress}</td>
              </tr>
            </table>
          </div>
          
          <div style="background: #e8f5e8; border: 1px solid #d4edda; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #155724; margin-top: 0; font-size: 16px;">🔒 Güvenlik Uyarısı</h3>
            <p style="color: #155724; margin-bottom: 15px; font-size: 14px;">
              Bu giriş sizin tarafınızdan yapıldıysa herhangi bir işlem yapmanıza gerek yoktur.
            </p>
            <p style="color: #721c24; margin: 0; font-size: 14px; background: #f8d7da; padding: 10px; border-radius: 4px;">
              <strong>⚠️ Dikkat:</strong> Bu giriş sizin tarafınızdan yapılmadıysa, derhal şifrenizi değiştirin ve bizimle iletişime geçin.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.APP_URL}/user" 
               style="background: linear-gradient(135deg, #ff6b9d, #c44569); color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 5px;">
              Hesabıma Git 🏠
            </a>
          </div>
        </div>
        
        <div style="background: #343a40; color: #fff; text-align: center; padding: 20px;">
          <p style="margin: 0; font-size: 14px; opacity: 0.8;">
            Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.
          </p>
          <p style="margin: 10px 0 0 0; font-size: 12px; opacity: 0.6;">
            © ${new Date().getFullYear()} ${process.env.APP_NAME} - Platform
          </p>
        </div>
      </div>
    `;

    const result = await sendMail({
      to: userEmail,
      subject: '🔐 zuppi Hesabınıza Giriş Yapıldı',
      html,
      text: `zuppi hesabınıza ${loginTime} tarihinde ${deviceName} cihazından giriş yapıldı.`,
      from: `"zuppi Güvenlik" <${process.env.SMTP_USER}>`,
      clientInfo
    });

    return result;

  } catch (error) {
    console.error('❌ Login notification error:', error);
    throw error;
  }
};

// İLETİŞİM FORMU E-MAİLİ
const sendContactEmail = async ({ name, email, message, subject = 'İletişim Formu' }) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #ff6b9d; padding: 20px; color: white;">
        <h2>📧 Yeni İletişim Mesajı</h2>
      </div>
      
      <div style="padding: 20px; background: white; border: 1px solid #eee;">
        <h3>Gönderen Bilgileri:</h3>
        <p><strong>Ad:</strong> ${name}</p>
        <p><strong>E-mail:</strong> ${email}</p>
        
        <h3>Mesaj:</h3>
        <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #ff6b9d;">
          ${message.replace(/\n/g, '<br>')}
        </div>
        
        <hr style="margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          Gönderilme Zamanı: ${new Date().toLocaleString('tr-TR')}
        </p>
      </div>
    </div>
  `;

  return await sendMail({
    to: process.env.SUPPORT_EMAIL,
    subject: `${subject} - ${name}`,
    html,
    text: `${name} (${email}) tarafından gönderilen mesaj: ${message}`
  });
};

// HOŞ GELDİN E-MAİLİ
const sendWelcomeEmail = async (userEmail, userName) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #ff6b9d, #c44569); padding: 30px; text-align: center; color: white;">
        <h1>Hoş Geldiniz ${userName}! 🎉</h1>
      </div>
      
      <div style="padding: 30px; background: white;">
        <h2 style="color: #333;">Nail Art Dünyasına Hoş Geldiniz!</h2>
        <p style="color: #666; line-height: 1.6;">
          Artık zuppi ailesinin bir parçasısınız! 💅<br>
          En güzel nail art tasarımlarını keşfedin, kendi kreasyonlarınızı paylaşın.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.APP_URL}" 
             style="background: linear-gradient(135deg, #ff6b9d, #c44569); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block;">
            ${process.env.APP_NAME}'yi Keşfet 🚀
          </a>
        </div>
      </div>
    </div>
  `;

  return await sendMail({
    to: userEmail,
    subject: `${process.env.APP_NAME}'ye Hoş Geldiniz! 💅✨`,
    html,
    text: `Hoş geldiniz ${userName}! ${process.env.APP_NAME} ailesinin bir parçası oldunuz.`
  });
};


//----------------------------------
// EMAIL VERIFICATION CODES STORAGE
const verificationCodes = new Map();

// HANELİ DOĞRULAMA KODU OLUŞTUR
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 haneli sayı
};

// EMAIL DOĞRULAMA KODU GÖNDER
const sendVerificationCode = async (userEmail, type = 'login', clientInfo = null) => {
  try {
    const verificationCode = generateVerificationCode();
    const expiresAt = Date.now() + (5 * 60 * 1000); // 5 dakika
    
    // Kodu memory'de sakla
    verificationCodes.set(userEmail, {
      code: verificationCode,
      type,
      createdAt: Date.now(),
      expiresAt,
      attempts: 0,
      maxAttempts: 3,
      verified: false
    });

    const sendTime = new Date().toLocaleString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Europe/Istanbul'
    });

    const userName = userEmail.split('@')[0];
    const typeText = type === 'register' ? 'Kayıt Doğrulama' : 'Giriş Doğrulama';
    const actionText = type === 'register' ? 'kayıt işleminizi tamamlamak' : 'giriş yapabilmek';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
        <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🔐 ${typeText}</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">6 haneli doğrulama kodunuz</p>
        </div>
        
        <div style="padding: 30px; background: white;">
          <h2 style="color: #333; margin-top: 0;">Merhaba ${userName}! 👋</h2>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
            zuppi hesabınızda ${actionText} için doğrulama kodu aşağıda yer almaktadır:
          </p>
          
          <div style="background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
            <h3 style="color: white; margin: 0 0 15px 0; font-size: 18px;">🔑 Doğrulama Kodunuz</h3>
            <div style="background: white; color: #333; font-size: 36px; font-weight: bold; padding: 20px; border-radius: 8px; letter-spacing: 8px; font-family: monospace;">
              ${verificationCode}
            </div>
            <p style="color: rgba(255,255,255,0.9); margin: 15px 0 0 0; font-size: 14px;">
              Bu kodu ${type === 'register' ? 'kayıt' : 'giriş'} sayfasına giriniz
            </p>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
              <span style="font-size: 20px; margin-right: 10px;">⏱️</span>
              <h4 style="color: #856404; margin: 0; font-size: 16px;">Önemli Bilgiler</h4>
            </div>
            <ul style="color: #856404; margin: 10px 0 0 0; padding-left: 20px; font-size: 14px;">
              <li>Bu kod <strong>5 dakika</strong> içinde geçersiz olacak</li>
              <li>Maksimum <strong>3 deneme</strong> hakkınız var</li>
              <li>Kodu kimseyle paylaşmayın</li>
              <li>Gönderilme zamanı: <strong>${sendTime}</strong></li>
            </ul>
          </div>
          
          <div style="background: #e8f5e8; border: 1px solid #d4edda; border-radius: 8px; padding: 15px; margin: 25px 0;">
            <h4 style="color: #155724; margin-top: 0; font-size: 14px;">🔒 Güvenlik Uyarısı</h4>
            <p style="color: #155724; margin-bottom: 0; font-size: 13px;">
              Bu doğrulama kodunu sadece zuppi.live sitesinde kullanın. Başka hiçbir yerde girmeyin!
            </p>
          </div>
        </div>
        
        <div style="background: #343a40; color: #fff; text-align: center; padding: 20px;">
          <p style="margin: 0; font-size: 14px; opacity: 0.8;">
            Bu e-posta otomatik olarak gönderilmiştir. Doğrudan yanıtlamayın.
          </p>
          <p style="margin: 10px 0 0 0; font-size: 12px; opacity: 0.6;">
            © ${new Date().getFullYear()} ${process.env.APP_NAME || 'zuppi'} - ${typeText} Sistemi
          </p>
        </div>
      </div>
    `;

    const result = await sendMail({
      to: userEmail,
      subject: `🔐 ${process.env.APP_NAME || 'zuppi'} ${typeText} Kodu: ${verificationCode}`,
      html,
      text: `${process.env.APP_NAME || 'zuppi'} doğrulama kodunuz: ${verificationCode}. Bu kod 5 dakika içinde geçersiz olacak.`,
      from: `"zuppi Doğrulama" <iletisim@zuppi.live>`,
      clientInfo
    });


    return {
      success: true,
      code: verificationCode, // Debug için (production'da kaldır)
      expiresAt,
      result
    };

  } catch (error) {
    console.error('❌ Send verification code error:', error);
    throw error;
  }
};

// EMAIL DOĞRULAMA KODUNU KONTROL ET
const verifyEmailCode = async (userEmail, inputCode, type = 'login') => {
  try {
    // Kod var mı kontrol et
    const codeData = verificationCodes.get(userEmail);
    if (!codeData) {
      return {
        success: false,
        error: 'Doğrulama kodu bulunamadı veya süresi dolmuş',
        code: 'CODE_NOT_FOUND'
      };
    }
    
    // Kod süresi dolmuş mu kontrol et
    if (Date.now() > codeData.expiresAt) {
      verificationCodes.delete(userEmail);
      return {
        success: false,
        error: 'Doğrulama kodu süresi dolmuş (5 dakika)',
        code: 'CODE_EXPIRED'
      };
    }
    
    // Kod zaten kullanılmış mı kontrol et
    if (codeData.verified) {
      return {
        success: false,
        error: 'Bu doğrulama kodu zaten kullanılmış',
        code: 'CODE_ALREADY_USED'
      };
    }
    
    // Max deneme aşıldı mı kontrol et
    if (codeData.attempts >= codeData.maxAttempts) {
      verificationCodes.delete(userEmail);
      return {
        success: false,
        error: 'Çok fazla hatalı deneme. Yeni kod talep edin.',
        code: 'MAX_ATTEMPTS_EXCEEDED'
      };
    }
    
    // Kod doğru mu kontrol et
    if (codeData.code !== inputCode.toString()) {
      codeData.attempts++;
      verificationCodes.set(userEmail, codeData);
      
      const remainingAttempts = codeData.maxAttempts - codeData.attempts;
      
      return {
        success: false,
        error: `Doğrulama kodu hatalı! Kalan deneme: ${remainingAttempts}`,
        code: 'INVALID_CODE',
        remainingAttempts
      };
    }
    
    // Tür kontrol et
    if (codeData.type !== type) {
      return {
        success: false,
        error: 'Doğrulama kodu türü uyuşmuyor',
        code: 'TYPE_MISMATCH'
      };
    }
    
    // Kod doğru - işaretle
    const verificationTime = new Date().toLocaleString('tr-TR', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    codeData.verified = true;
    codeData.verificationTime = verificationTime;
    verificationCodes.set(userEmail, codeData);
        
    // Başarılı response döndür
    return {
      success: true,
      message: 'E-posta doğrulama başarılı!',
      data: {
        userEmail,
        type,
        verificationTime,
        originalSendTime: new Date(codeData.createdAt).toLocaleString('tr-TR')
      }
    };
    
  } catch (error) {
    console.error('❌ verifyEmailCode error:', error);
    return {
      success: false,
      error: 'Doğrulama işlemi sırasında hata oluştu: ' + error.message,
      code: 'VERIFICATION_ERROR'
    };
  }
};

// AKTIF VERIFICATION CODES LİSTELE (DEBUG)
const getActiveVerificationCodes = () => {
  const activeCodes = [];
  const now = Date.now();
  
  for (const [email, data] of verificationCodes.entries()) {
    if (now <= data.expiresAt) {
      activeCodes.push({
        email,
        code: data.code, // Production'da kaldır
        type: data.type,
        createdAt: new Date(data.createdAt).toLocaleTimeString(),
        expiresAt: new Date(data.expiresAt).toLocaleTimeString(),
        remainingSeconds: Math.round((data.expiresAt - now) / 1000),
        attempts: data.attempts,
        verified: data.verified
      });
    }
  }
  
  return activeCodes;
};
//--------------------------------



// EXPORT'A EKLE
module.exports = {
  testConnection,
  sendMail,
  sendWelcomeEmail,
  sendContactEmail,
  sendLoginNotification,
  sendLoginVerificationEmail,
  verifyLoginToken,
  getActiveTokens,
  getVerificationTokens,
  createTransporter,
  sendVerificationCode,
  verifyEmailCode,
  getActiveVerificationCodes
};
