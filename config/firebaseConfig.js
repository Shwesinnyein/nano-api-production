

// const admin = require("firebase-admin");

// console.log("admin", admin)
// const firebaseConfig = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
// console.log("firebaseconfig", firebaseConfig)

// if (!admin.apps.length) {
//   admin.initializeApp({
//     credential: admin.credential.cert(firebaseConfig),
//   });
// }
// console.log("Firebase Config:", process.env.FIREBASE_ADMIN_CREDENTIALS);



// module.exports = admin ;

const admin = require("firebase-admin");


console.log("admin", admin);

if (!process.env.FIREBASE_ADMIN_CREDENTIALS) {
  throw new Error(
    "FIREBASE_ADMIN_CREDENTIALS environment variable is not set.\n" +
    "Please create a .env file in the project root with:\n" +
    "FIREBASE_ADMIN_CREDENTIALS='{\"type\":\"service_account\",...}'\n" +
    "See .env.example for reference."
  );
}

const firebaseConfig = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);


if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(firebaseConfig),
  });
}


const db = admin.firestore();

db.settings({ experimentalForceLongPolling: true });


module.exports = { admin, db };
