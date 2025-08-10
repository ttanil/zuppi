const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || "artnail";

function authenticateUser(req, res, next) {
    const token = req.cookies.A_token;
    if (!token) {
        res.locals.user = { id: null, email: null, role: "misafir" };
        res.locals.userRole = "misafir";
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        // decoded: { user_id: "...", email: "...", device_id: "...", role: "user" }
        if (!err && decoded && ["user", "admin"].includes(decoded.role)) {
            console.log("authenticate");
            req.user = decoded;
            res.locals.user = {
                id: decoded.user_id,   // user.id değil! DİREKT user_id
                email: decoded.email,
                role: decoded.role
            };
            res.locals.userRole = decoded.role;
        } else {
            res.locals.user = { id: null, email: null, role: "misafir" };
            res.locals.userRole = "misafir";
        }
        next();
    });
}

module.exports = authenticateUser;

/*
res.cookie('refreshToken', token, { 
  httpOnly: true, 
  secure: true, 
  sameSite: 'strict',
  maxAge: 1000 * 60 * 60 * 24 * 7 
});
*/