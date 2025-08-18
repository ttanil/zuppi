const express = require('express');
const router = express.Router();
const path = require('path');
const mongoose = require('mongoose');
const Users = require(path.join(__dirname, '..', 'models', 'users'));
const bcrypt = require('bcrypt');

const authenticateUser = require('../middleware/authenticateUser');


router.get('/', authenticateUser, async (req, res) => {
    //console.log("userPage ",res.locals.userRole);
    //console.log("userPage ",res.locals.user);
    try {  
        if(!(res.locals.userRole && res.locals.user && res.locals.user.id)){
            return res.redirect('/login');
        }
        const user = await Users.findById(res.locals.user.id);  
        if (!user) {  
            return res.status(404).send("Kullanıcı bulunamadı!");  
        }
        res.render('sites/user', {
            userInfos: user,  
            user: res.locals.user,         // {id, email, role} veya null
            role: res.locals.userRole,     // "user", "admin", "misafir"

            userJson: JSON.stringify({
                _id: user._id,
                fullname: user.fullname,
                privacy_prefs : user.privacy_prefs,
                email: user.email,
                role: user.role,
                verified: user.verified,
                created_at: user.created_at,
                birth_year: user.birth_year,
                city: user.city,
                wallet_balance: user.wallet_balance,
                provider: user.provider,
                google_id: user.google_id,
                theme: user.theme,
                subscription: user.subscription ? {
                    active: user.subscription.active,
                    plan: user.subscription.plan,
                    expire_at: user.subscription.expire_at,
                    subscription_id: user.subscription.subscription_id
                } : null,
                instructor: user.instructor ? {
                    bio: user.instructor.bio,
                    social_links: user.instructor.social_links,
                    application_status: user.instructor.application_status
                } : null,
                // Cihazlarda sadece özet göster
                devices: user.devices
                    ? user.devices.map(dev => ({
                        device_id: dev.device_id,
                        deviceName: dev.device_info?.deviceName,
                        last_login: dev.last_login
                    }))
                    : [],
            })
        });  
    } catch (err) {  
        console.error(err);  
        return res.status(500).send("Sunucu hatası.");  
    }  


    
});

router.post('/', async (req, res) => {
    if (req.body.status === "delete-device") {
        try {
            const { userId, selectedDeviceId } = req.body;

            if (!userId || !selectedDeviceId) {
                return res.status(400).json({ message: 'Kullanıcı ve cihaz ID zorunlu!' });
            }

            const user = await Users.findOne({ _id: userId });
            if (!user) {
                return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
            }

            const deviceToDelete = user.devices.find(dev => dev.device_id === selectedDeviceId);
            if (!deviceToDelete) {
                return res.status(404).json({ message: 'Cihaz bulunamadı veya zaten silinmiş.' });
            }

            // ARŞİVE EKLE
            user.deletedDevices = user.deletedDevices || [];

            const archivedDevice = {
                ...deviceToDelete.toObject(), // Mongoose objesini plain object'e çevir
                deleted_at: new Date(),
                deleted_reason: 'Kullanıcı tarafından manuel silme',
                deleted_by_system: false,
                deleted_by_user: true,
                deleted_by_admin: false
            };
            
            user.deletedDevices.push(archivedDevice);

            // devices'tan çıkart
            user.devices = user.devices.filter(dev => dev.device_id !== selectedDeviceId);

            await user.save();

            return res.status(200).json({ message: 'Cihaz başarıyla silindi.' });

        } catch (err) {
            console.error(err);
            return res.status(500).json({ message: 'Sunucu hatası, tekrar deneyin.' });
        }
    } else if(req.body.status === "save-theme"){
        try {
            const { userId, theme } = req.body;

            if (!userId || !theme) {
                return res.status(400).json({ message: 'Eksik veri!' });
            }

            // Sadece izin verilen temaları kaydet
            const allowedThemes = ["blue", "pink"];
            if (!allowedThemes.includes(theme)) {
                return res.status(400).json({ message: 'Geçersiz tema!' });
            }

            const user = await Users.findOne({ _id: userId });
            if (!user) {
                return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
            }

            user.theme = theme;
            await user.save();

            return res.status(200).json({ message: 'Tema kaydedildi.' });

        } catch (err) {
            console.error(err);
            return res.status(500).json({ message: 'Sunucu hatası, tekrar deneyin.' });
        }
    } else if(req.body.status === "change-password"){
        try {
            const { userId, curr, yeni } = req.body;

            if (!userId || !curr || !yeni) {
                return res.status(400).json({ message: 'Eksik veri!' });
            }

            const user = await Users.findOne({ _id: userId });
            if (!user) {
                return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
            }

            // Mevcut şifre doğru mu?
            const isMatch = await bcrypt.compare(curr, user.password_hash);
            if (!isMatch) {
                return res.status(401).json({ message: 'Mevcut şifre hatalı!' });
            }

            // 6-32 karak. kontrolü
            if (
                typeof yeni !== 'string' ||
                yeni.length < 6 ||
                yeni.length > 32
            ) {
                return res.status(400).json({ message: 'Şifre 6-32 karakter arasında olmalı.' });
            }

            // Yeni şifre eskisiyle aynı mı? (Kullanıcı aynı şifreyi set etmek istemesin diye)
            const isSame = await bcrypt.compare(yeni, user.password_hash);
            if (isSame) {
                return res.status(400).json({ message: 'Yeni şifre mevcut şifreden farklı olmalı.' });
            }

            // Şifreyi güncelle
            const saltRounds = 10;
            const password_hash = await bcrypt.hash(yeni, saltRounds);
            user.password_hash = password_hash;
            await user.save();

            return res.status(200).json({ message: 'Yeni şifre başarıyla kaydedildi.' });

        } catch (err) {
            console.error(err);
            return res.status(500).json({ message: 'Sunucu hatası, tekrar deneyin.' });
        }
    } else if(req.body.status === "save-privacy-prefs"){
        try {
            const { userId, email_notif, sms_notif, show_profile } = req.body;

            if (
                !userId ||
                ![true, false].includes(email_notif) ||
                ![true, false].includes(sms_notif) ||
                ![true, false].includes(show_profile)
            ) {
                return res.status(400).json({ message: 'Eksik veri!' });
            }

            const user = await Users.findOne({ _id: userId });
            if (!user) {
                return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
            }

            // privacy_prefs alanını güncelle
            user.privacy_prefs = {
                email_notif: !!email_notif,
                sms_notif: !!sms_notif,
                show_profile: !!show_profile
            };

            await user.save();

            return res.status(200).json({ message: 'Tercihleriniz kaydedildi!' });

        } catch (err) {
            console.error(err);
            return res.status(500).json({ message: 'Sunucu hatası, tekrar deneyin.' });
        }


    } else {
        return res.status(400).json({ message: 'Geçersiz istek.' });
    }
});



module.exports = router;