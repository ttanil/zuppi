const express = require('express');
const router = express.Router();
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const nodemailer = require('nodemailer');

//const Users = require(path.join(__dirname, '..', 'models', 'users'));
//const bcrypt = require('bcrypt');

const authenticateUser = require('../middleware/authenticateUser');

dotenv.config();
const s3 = new S3Client({
  region: 'auto',
  endpoint: 'https://eb7b69f469c33ce6338e878ac08bcdd6.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: process.env.CF_R2_ACCESS_KEY,
    secretAccessKey: process.env.CF_R2_SECRET_KEY
  }
});


router.get('/', authenticateUser, (req, res) => {
    console.log(res.locals.userRole);
    res.clearCookie('A_token', { path: '/' });
    res.render('sites/index', {
        user: res.locals.user,          // null veya {id, email, role}
        role: res.locals.userRole,       // "user", "admin" veya "misafir"
    });
});

router.post('/video-url', async (req, res) => {
  const filename = req.body.filename;
  if (!filename) return res.status(400).send("filename zorunlu!");

  const input = {
    Bucket: "zuppi",
    Key: filename,
  };

  try {
    const command = new GetObjectCommand(input);
    const url = await getSignedUrl(s3, command, { expiresIn: 300 });
    res.json({ url });
  } catch (err) {
    console.error(err); // Detay görmek için
    res.status(404).send("Video bulunamadı!");
  }
});


const testZohoSMTP = async () => {
  console.log('🔍 Zoho SMTP test başlıyor...');
  console.log('📧 E-mail:', process.env.SMTP_USER);
  
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false // Geçici SSL sorunu çözümü
    }
  });

  try {
    // Bağlantı testi
    console.log('🔄 Bağlantı test ediliyor...');
    await transporter.verify();
    console.log('✅ SMTP bağlantısı başarılı!');
    
    // Test e-maili gönder
    console.log('📤 Test e-maili gönderiliyor...');
    const result = await transporter.sendMail({
      from: `"Zuppi Test" <${process.env.SMTP_USER}>`,
      to: "tahsintanil@gmail.com",
      subject: '🎉 Zuppi SMTP Test - Başarılı!',
      html: `
        <h1 style="color: #ff6b9d;">SMTP Çalışıyor! 🚀</h1>
        <p>Zuppi e-mail sistemi hazır.</p>
        <p><strong>Gönderen:</strong> ${process.env.SMTP_USER}</p>
        <p><strong>Tarih:</strong> ${new Date().toLocaleString('tr-TR')}</p>
      `
    });
    
    console.log('🎉 Test e-maili başarıyla gönderildi!');
    console.log('📬 Message ID:', result.messageId);
    console.log('📧 Zoho Mail kutunuzu kontrol edin!');
    
    return true;
  } catch (error) {
    console.error('❌ SMTP Hatası:', error.message);
    
    // Hata analizi
    if (error.code === 'EAUTH') {
      console.log('🔐 Çözüm: E-mail veya şifre yanlış olabilir');
      console.log('💡 Zoho hesabınıza giriş yapabildiğinizi doğrulayın');
    } else if (error.code === 'ECONNECTION') {
      console.log('🌐 Çözüm: İnternet bağlantınızı kontrol edin');
    } else {
      console.log('📝 Tam hata:', error);
    }
    
    return false;
  }
};

// Test çalıştır
testZohoSMTP();



module.exports = router;