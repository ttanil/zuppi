const nodemailer = require('nodemailer');
require('dotenv').config();

console.log('📧 Mail service yükleniyor...');

const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

const sendTestEmail = async () => {
  try {
    const transporter = createTransporter();
    
    console.log('🔄 SMTP bağlantısı test ediliyor...');
    await transporter.verify();
    console.log('✅ SMTP bağlantısı başarılı!');
    
    const result = await transporter.sendMail({
      from: `"Zuppi Test" <${process.env.SMTP_USER}>`,
      to: "tahsintanil@gmail.com",
      subject: '🎉 Zuppi SMTP Test - Başarılı!',
      html: `
        <h1 style="color: #ff6b9d;">SMTP Çalışıyor! 🚀</h1>
        <p>Mail service başarıyla çalışıyor.</p>
        <p><strong>Tarih:</strong> ${new Date().toLocaleString('tr-TR')}</p>
      `
    });
    
    console.log('🎉 Test e-maili gönderildi:', result.messageId);
    return result;
  } catch (error) {
    console.error('❌ Mail gönderme hatası:', error);
    throw error;
  }
};

module.exports = {
  createTransporter,
  sendTestEmail
};