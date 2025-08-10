const express = require('express');
const router = express.Router();
const path = require('path');
const mongoose = require('mongoose');
const Users = require(path.join(__dirname, '..', 'models', 'users'));

const authenticateUser = require('../middleware/authenticateUser');

router.get('/', authenticateUser, (req, res) => {
    console.log(res.locals.userRole);
    res.render('sites/policy', {
        user: res.locals.user,          // null veya {id, email, role}
        role: res.locals.userRole,       // "user", "admin" veya "misafir"
    });
});



module.exports = router;