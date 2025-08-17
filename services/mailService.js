const nodemailer = require('nodemailer');
require('dotenv').config();


// ✅ ZOHO.EU İÇİN SMTP TRANSPORTER
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
    // ✅ DEBUG AYARLARI
    debug: false,
    logger: false
  });
};

// ✅ BAĞLANTI TEST FONKSİYONU - DETAYLI DEBUG
const testConnection = async () => {
  try {
    console.log('🔍 SMTP Ayarları Kontrol Ediliyor:');
    console.log('📍 Host:', process.env.SMTP_HOST);
    console.log('🔌 Port:', process.env.SMTP_PORT);
    console.log('🔐 Secure:', process.env.SMTP_SECURE);
    console.log('👤 User:', process.env.SMTP_USER);
    console.log('🔑 Pass:', process.env.SMTP_PASS ? '✅ Mevcut (' + process.env.SMTP_PASS.length + ' karakter)' : '❌ YOK');
    
    const transporter = createTransporter();
    console.log('⏳ SMTP bağlantısı test ediliyor...');
    
    await transporter.verify();
    console.log('✅ SMTP bağlantısı başarılı - Zoho.eu aktif!');
    return true;
  } catch (error) {
    console.error('❌ SMTP bağlantı hatası:');
    console.error('   Mesaj:', error.message);
    console.error('   Kod:', error.code);
    console.error('   Host:', error.hostname || 'N/A');
    console.error('   Port:', error.port || 'N/A');
    
    // ✅ YAYGIN HATALARA ÖZEL ÇÖZÜM ÖNERİLERİ
    if (error.code === 'EAUTH') {
      console.error('💡 Çözüm: Zoho Mail\'de App Password oluşturun!');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('💡 Çözüm: smtp.zoho.eu yerine smtppro.zoho.eu deneyin');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('💡 Çözüm: Port 465 (SSL) veya VPN kullanımını deneyin');
    }
    
    return false;
  }
};

// ✅ GENEL MAİL GÖNDERME FONKSİYONU
const sendMail = async ({ to, subject, text, html, from = null, clientInfo = null }) => {
  try {
    
    const transporter = createTransporter();
    
    // IP adresi varsa HTML'e ekle
    let finalHtml = html || `<p>${text || 'E-mail içeriği'}</p>`;
    if (clientInfo && clientInfo.ip && html) {
      finalHtml = html.replace('[Sunucu tarafından eklenecek]', clientInfo.ip);
    }
    
    const mailOptions = {
      from: from || `"${process.env.APP_NAME || 'Zuppi'}" <${process.env.SMTP_USER}>`,
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

// ✅ LOGIN NOTIFICATION EMAIL FONKSİYONU
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
            Zuppi hesabınıza başarılı bir giriş yapıldı. Aşağıda giriş detaylarını bulabilirsiniz:
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

    /*
    <tr>
      <td style="padding: 8px 0; color: #666; font-weight: bold;">💻 İşletim Sistemi:</td>
      <td style="padding: 8px 0; color: #333;">${deviceInfo.os}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666; font-weight: bold;">🌐 Tarayıcı:</td>
      <td style="padding: 8px 0; color: #333;">${deviceInfo.browser}</td>
    </tr>
    */

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

// ✅ İLETİŞİM FORMU E-MAİLİ
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

// ✅ HOŞ GELDİN E-MAİLİ
const sendWelcomeEmail = async (userEmail, userName) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #ff6b9d, #c44569); padding: 30px; text-align: center; color: white;">
        <h1>Hoş Geldiniz ${userName}! 🎉</h1>
      </div>
      
      <div style="padding: 30px; background: white;">
        <h2 style="color: #333;">Nail Art Dünyasına Hoş Geldiniz!</h2>
        <p style="color: #666; line-height: 1.6;">
          Artık ${process.env.APP_NAME} ailesinin bir parçasısınız! 💅<br>
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

// ✅ EXPORT KISMI
module.exports = {
  testConnection,
  sendMail,
  sendWelcomeEmail,
  sendContactEmail,
  sendLoginNotification,
  createTransporter
};