const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const DB_URL = process.env.NODE_ENV === 'production'
  ? process.env.DB_URL_PROD
  : process.env.DB_URL_LOCAL;

const conn = () => {
  mongoose.connect(DB_URL, {
    dbName: 'artnail'
})
  .then(() => {
    console.log("DB connected");
  })
  .catch((err) => {
    console.log("MongoDB bağlantı hatası:", err);
  });
};

module.exports = conn;