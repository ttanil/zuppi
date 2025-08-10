const express = require('express');
const router = express.Router();
const path = require('path');
const mongoose = require('mongoose');

const authenticateUser = require('../middleware/authenticateUser');

router.get('/', authenticateUser, (req, res) => {
    console.log("homePage ",res.locals.userRole);
    console.log("homePage ",res.locals.user);
    if(res.locals.userRole && res.locals.user.id){
        res.render('sites/home', {
            user: res.locals.user,          // null veya {id, email, role}
            role: res.locals.userRole,       // "user", "admin" veya "misafir"
        });
    } else {
        res.redirect('/login');
    }
});



module.exports = router;