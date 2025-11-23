
// const { db, admin } = require("./config/firebaseConfig");

// const express = require("express");
// const cors = require("cors");

// const authRoutes = require("./routes/authRoutes");
// const employeeRoutes = require("./routes/employeeRoutes");
// const lineRoutes = require("./routes/lineRoutes");

// const app = express();


// const allowedOrigin = process.env.NODE_ENV === 'production'
//     ? process.env.PRODUCTION_FRONTEND_URL // e.g., "https://your-production-domain.com"
//      : "http://localhost:4200";



// const productionUrl = process.env.PRODUCTION_FRONTEND_URL || "https://nanostores.co.th/dashboard/admin";
// const allowedOrigins = [productionUrl, "https://nanostores.co.th/dashboard/admin"];


// app.use(cors({
//     origin: function (origin, callback) {

//         if (!origin) return callback(null, true);
//         if (allowedOrigins.indexOf(origin) !== -1) {
//             return callback(null, true);
//         } else {
//             return callback(new Error("Not allowed by CORS"));
//         }
//     },
//     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
// }));

// app.options('*', cors());



// app.use(express.json());


// app.use("/auth", authRoutes);
// app.use("/employee", employeeRoutes);
// app.use("/line", lineRoutes);


// module.exports = app;

// Load environment variables from .env file
require('dotenv').config();

const { db, admin } = require("./config/firebaseConfig");

const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const leaveRoutes = require("./routes/leaveRoutes");
const lineRoutes = require("./routes/lineRoutes");
const resignationRoutes = require("./routes/resignationRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const supportRoutes = require("./routes/supportRoutes");


const app = express();

// Updated: Leave controller with 3-month eligibility and gender filtering


// const allowedOrigin = process.env.NODE_ENV === 'production'
//     ? process.env.PRODUCTION_FRONTEND_URL // e.g., "https://your-production-domain.com"
//      : "http://localhost:4200";
const allowedOrigin = process.env.NODE_ENV === 'production'
    ? process.env.PRODUCTION_FRONTEND_URL // e.g., "https://your-production-domain.com"
     : "http://localhost:4200";


// app.use(cors({
//   origin: allowedOrigin,
//   methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"],
// }));

// const productionUrl = process.env.PRODUCTION_FRONTEND_URL || "https://nano-hr.web.app";
// console.log("production url", productionUrl)
// const allowedOrigins = [productionUrl, "https://nano-hr.web.app"];

// const productionUrl = process.env.PRODUCTION_FRONTEND_URL || "https://nano-hr.web.app";
// const allowedOrigins = [
//     productionUrl, 
//     "https://nano-hr.web.app", 
//     "http://localhost:4200",
   
// ];
// const productionUrl = process.env.PRODUCTION_FRONTEND_URL || "https://nanostores.co.th/dashboard/admin";
// const allowedOrigins = [productionUrl, "https://nanostores.co.th/dashboard/admin"];
const productionUrl = process.env.PRODUCTION_FRONTEND_URL || "https://nanostores.co.th/dashboard/admin";
const allowedOrigins = [productionUrl, "https://nanostores.co.th/dashboard/admin"];


app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, Flutter web, or curl requests)
        if (!origin) return callback(null, true);
        
        // Check if origin is in allowed list
        if (allowedOrigins.indexOf(origin) !== -1) {
            return callback(null, true);
        }
        
        // For development, allow localhost with any port
        if (process.env.NODE_ENV !== 'production') {
            if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
                return callback(null, true);
            }
        }
        
        console.log('CORS blocked origin:', origin);
        return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
        "Content-Type", 
        "Authorization", 
        "X-Requested-With",
        "Accept",
        "Origin",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers"
    ],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

app.options('*', cors());

// Additional CORS headers for Flutter web compatibility
app.use((req, res, next) => {
    // Set CORS headers for all responses
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    next();
});

app.use(express.json());

// Public pages for App Store and Play Store submission
app.get("/privacy-policy", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "privacy-policy.html"));
});

app.get("/terms-of-service", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "terms-of-service.html"));
});

app.use("/auth", authRoutes);
app.use("/employee", employeeRoutes);
app.use("/attendance", attendanceRoutes);
app.use("/leave", leaveRoutes);
app.use("/line", lineRoutes);
app.use("/resignation", resignationRoutes);
app.use("/notifications", notificationRoutes);
app.use("/support", supportRoutes);



module.exports = app;
