const express = require('express');  
const exphbs = require('express-handlebars');  
const handlebars = require('handlebars');  
const expressSession = require('express-session');  
const dotenv = require('dotenv');  
const path = require('path');  
const dbs = require(path.join(__dirname,'dbs.js'));  
const cookieParser = require('cookie-parser');  
const jwt = require('jsonwebtoken');  
const cors = require('cors');  
const crypto = require('crypto');  

dotenv.config();  
dbs();  

const app = express();

const time = 1000*60*60;    // 60 dk oturum süresi  
const SECRET_VALUE = process.env.JWT_SECRET || 'artnail'; 

// Handlebars şablon ayarları  
const hbs = exphbs.create({  
  helpers: {  
    ifEquals: function (arg1, arg2, options) {  
      return (arg1 === arg2) ? options.fn(this) : options.inverse(this);  
    },  
    json: function (context) {  
      return JSON.stringify(context);  
    }  
  }  
});  
app.engine('handlebars', hbs.engine);  
app.set('view engine', 'handlebars');  
app.set('views', path.join(__dirname, 'views'));  

// GLOBAL middleware'ler  
app.use(express.json());                   // Sadece JSON istekler için (dosya upload hariç!)  
app.use(express.urlencoded({ extended: true }));  // Standart form istekler için (dosya upload hariç!) 

/**  
 * !! JSON Parse Error Handler Middleware !!  
 * Bu middleware, JSON parse erroru oluşursa yakalar ve düzgün bir cevap döner.  
 * Sırası önemli: express.json ve express.urlencoded'dan hemen SONRA olmalı!  
 */  
app.use((err, req, res, next) => {  
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {  
    return res.status(400).json({ error: 'Geçersiz JSON formatı!' });  
  }  
  next();  
});

app.use(cookieParser());  
app.set('trust proxy', 1);  
app.use(expressSession({  
    secret: SECRET_VALUE,  
    resave: false,  
    saveUninitialized: false,  
    cookie: {  
        path: '/',  
        httpOnly: true,  
        secure: true,  
        maxAge: time,  
        sameSite: 'lax'  
        // domain: '.yapio.net' // (isteğe bağlı, sorun olursa kaldırıp dene)  
    }  
})); 


app.use(express.static(path.join(__dirname, 'public')));  

// CORS  
app.use(cors({  
    origin: 'http://127.0.0.1:5000',  
    credentials: true  
}));  

// ROUTER'lar  
const indexPage = require(path.join(__dirname, 'router', 'indexPage.js'));
const loginPage = require(path.join(__dirname, 'router', 'loginPage.js'));
const registerPage = require(path.join(__dirname, 'router', 'registerPage.js'));
const userPage = require(path.join(__dirname, 'router', 'userPage.js'));
const homePage = require(path.join(__dirname, 'router', 'homePage.js'));
const policyPage = require(path.join(__dirname, 'router', 'policyPage.js'));


app.use('/', indexPage);  
app.use('/login', loginPage);  
app.use('/register', registerPage);  
app.use('/user', userPage);  
app.use('/home', homePage);  
app.use('/policy', policyPage);  


// Sunucuyu başlat  
app.listen(5000, () => {  
    console.log("Server is running at http://127.0.0.1:5000");  
});