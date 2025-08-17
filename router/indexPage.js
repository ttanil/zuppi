const express = require('express');
const router = express.Router();
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

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
    if(res.locals.userRole === "user"){
        res.render('sites/home', {
          user: res.locals.user,          // null veya {id, email, role}
          role: res.locals.userRole,       // "user", "admin" veya "misafir"
      });

    } else{
      res.clearCookie('A_token', { path: '/' });
      res.render('sites/index', {
          user: res.locals.user,          // null veya {id, email, role}
          role: res.locals.userRole,       // "user", "admin" veya "misafir"
      });
    }
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


module.exports = router;