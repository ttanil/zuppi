const mongoose = require('mongoose');

const loginHistorySchema = new mongoose.Schema({
  login_time: { type: Date, default: Date.now },
  ip_address: { type: String }
});

const deviceSchema = new mongoose.Schema({
  device_id: { type: String, required: true },
  fingerprint: { type: String },
  device_info: {
    os: { type: String },                // 'Windows', 'iOS', 'Android'
    browser: { type: String },           // 'Chrome', 'Firefox', 'Safari'
    browser_version: { type: String },
    device_type: { type: String },       // 'mobile', 'desktop', 'tablet'
    model: { type: String },             // Özellikle mobilde
    user_agent: { type: String },
    ip_address: { type: String },
    city_by_ip: { type: String },
    country_by_ip: { type: String },
    region_by_ip: { type: String },
    timezone: { type: String },
    language: { type: String },
    screen_resolution: { type: String }, // '1920x1080'
    color_depth: { type: String },
    touch_support: { type: Boolean },
    is_incognito: { type: Boolean },
    plugins: [{ type: String }],
    canvas_fingerprint: { type: String },
    webgl_fingerprint: { type: String },
    deviceName: { type: String },
    loginHistory: { type: [loginHistorySchema], default: [] }
  },
  A_token: { type: String, required: true },
  last_login: { type: Date, default: Date.now },
  // SİLME BİLGİLERİ
  deleted_at: { type: Date },
  deleted_reason: { type: String },
  deleted_by_system: { type: Boolean },
  deleted_by_user: { type: Boolean },
  deleted_by_admin: { type: Boolean }
}, { _id: false });

const instructorSchema = new mongoose.Schema({
  bio: { type: String },
  social_links: [{ type: String }], // IG, Twitter, VB.
  application_status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  }
}, { _id: false });

const subscriptionSchema = new mongoose.Schema({
  active: { type: Boolean, default: false },
  plan: { type: String },
  expire_at: { type: Date },
  subscription_id: { type: String }
}, { _id: false });

const privacyPrefsSchema = new mongoose.Schema({
  email_notif:   { type: Boolean, default: true  }, // E-posta bildirimi
  sms_notif:     { type: Boolean, default: false }, // SMS bildirimi
  show_profile:  { type: Boolean, default: false }  // Toplulukta profil görünürlüğü
}, { _id: false });

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password_hash: { type: String },
  privacy_prefs: { type: privacyPrefsSchema, default: () => ({}) },
  role: { 
    type: String, 
    enum: ['user', 'admin', 'instructor'],
    default: 'user'
  },
  fullname: { type: String, required: true },
  verified: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  birth_year: { type: Number },
  city: { type: String },
  tel: { type: String, default: "" },
  bio: { type: String, default: "" },
  devices: { type: [deviceSchema], default: [] },
  deletedDevices: { type: [deviceSchema], default: [] },
  wallet_balance: { type: Number, default: 0 },
  subscription: { type: subscriptionSchema, default: () => ({}) },
  instructor: { type: instructorSchema, default: undefined },
  provider: { type: String, enum: ['local', 'google'], default: 'local' }, // <==
  google_id: { type: String },
  theme : { type: String, default: 'pink' }
}, { collection: 'users', versionKey: false });
 
const Users = mongoose.model('Users', userSchema);
module.exports = Users;