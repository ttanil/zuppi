const express = require('express');
const router = express.Router();

// ✅ LOGOUT ENDPOINT
router.post('/logout', (req, res) => {
  try {
    
    // ✅ Token cookie'sini sil
    res.clearCookie('A_token', { 
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    // ✅ Session'ı temizle (eğer kullanıyorsanız)
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

module.exports = router;