


// const speakeasy = require("speakeasy");
// const qrcode = require("qrcode");


// const { admin, db } = require("../config/firebaseConfig")

// exports.sendOTP = async (req, res) => {
//     try {
//         const { mobileNumber } = req.body;
//         if (!mobileNumber) return res.status(400).json({ message: "Mobile number is required" });

//         const employeesRef = db.collection("employees");
//         const snapshot = await employeesRef.where("primary_number", "==", mobileNumber).get();

//         if (snapshot.empty) {
//             return res.status(404).json({ message: "No user found with this mobile number" });
//         }

//         const employeeDoc = snapshot.docs[0];
//         const employeeData = employeeDoc.data();

//         if (!employeeData.secret) {
//             return res.status(400).json({ message: "Google Authenticator is not set up for this user" });
//         }

        
//         const otp = speakeasy.totp({
//             secret: employeeData.secret,
//             encoding: "base32",
//         });

//         res.json({ message: "OTP sent successfully", otp });

//     } catch (error) {
        
//         res.status(500).json({ message: "Internal server error" });
//     }
// };


// exports.verifyOTP = async (req, res) => {
//     try {
//         const { mobileNumber, otp } = req.body;
//         console.log("mobile ", mobileNumber)
//         console.log("opt", otp)
//         if (!mobileNumber || !otp) return res.status(400).json({ message: "Mobile number and OTP are required" });

//         const employeesRef = db.collection("employees");
//         const querySnapshot = await employeesRef.where("primary_number", "==", mobileNumber).get();

//         if (querySnapshot.empty) {
//             return res.status(404).json({ message: "Employee not found" });
//         }

//         const employeeData = querySnapshot.docs[0].data();
//         if (!employeeData.secret) {
//             return res.status(400).json({ message: "Employee has not enabled 2FA" });
//         }


//         const verified = speakeasy.totp.verify({
//             secret: employeeData.secret,
//             encoding: "base32",
//             token: otp,
//             window: 2,
//         });

//         if (verified) {
//             const firebaseCustomToken = await admin.auth().createCustomToken(employeeData.authId);
//             res.json({
//                 success: true,
//                 message: "OTP verified successfully",
//                 firebaseCustomToken,
//                 employeeData
//             });
//         } else {
//             res.status(400).json({ message: "Invalid OTP" });
//         }

//     } catch (error) {
       
//         res.status(500).json({ message: "Internal server error" });
//     }
// };

// exports.generateSecret = async (req, res) => {
//     try {
//         const { uid, mobileNumber } = req.body;
//         if (!uid || !mobileNumber) return res.status(400).json({ message: "UID and mobile number required" });

//         const employeeRef = db.collection("employees").doc(uid);
//         const employeeDoc = await employeeRef.get();

//         if (!employeeDoc.exists) return res.status(404).json({ message: "Employee not found" });

//         const employeeData = employeeDoc.data();
//         if (employeeData.secret) {
//             return res.json({ secret: employeeData.secret, qrCode: employeeData.qrCode, message: "Secret key already exists." });
//         }

//         // ✅ Generate new secret
//         const secret = speakeasy.generateSecret({
//             length: 20,
//             name: `${employeeData.companyName} (${mobileNumber})`,
//             issuer: "MyCompany"
//         });

//         const otpAuthUrl = secret.otpauth_url;
//         const qrCodeImage = await qrcode.toDataURL(otpAuthUrl);

//         // ✅ Save to Firestore
//         await employeeRef.update({ secret: secret.base32, qrCode: qrCodeImage });

//         res.json({ secret: secret.base32, qrCode: qrCodeImage, message: "New secret key generated." });
//     } catch (error) {
//         console.error("❌ Error generating secret:", error);
//         res.status(500).json({ message: "Internal server error" });
//     }
// };

const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { admin, db } = require("../config/firebaseConfig");
const { sendPushNotification } = require("./notificationController");

exports.sendOTP = async (req, res) => {
    try {
        const { mobileNumber } = req.body;
        if (!mobileNumber) return res.status(400).json({ message: "Mobile number is required" });

        const employeesRef = db.collection("employees");
        const snapshot = await employeesRef.where("primary_number", "==", mobileNumber).get();

        if (snapshot.empty) {
            return res.status(404).json({ message: "No user found with this mobile number" });
        }

        const employeeDoc = snapshot.docs[0];
        const employeeData = employeeDoc.data();

        if (!employeeData.secret) {
            return res.status(400).json({ message: "Google Authenticator is not set up for this user" });
        }

        
        const otp = speakeasy.totp({
            secret: employeeData.secret,
            encoding: "base32",
        });

        res.json({ message: "OTP sent successfully", otp });

    } catch (error) {
        
        res.status(500).json({ message: "Internal server error" });
    }
};


exports.verifyOTP = async (req, res) => {
    
    try {
        const { mobileNumber, otp } = req.body;
        
        if (!mobileNumber || !otp) return res.status(400).json({ message: "Mobile number and OTP are required" });

        const employeesRef = db.collection("employees");
        const querySnapshot = await employeesRef.where("primary_number", "==", mobileNumber).get();
       
        if (querySnapshot.empty) {
            return res.status(404).json({ message: "Employee not found" });
        }

        const employeeData = querySnapshot.docs[0].data();
      
        if (!employeeData.secret) {
            return res.status(400).json({ message: "Employee has not enabled 2FA" });
        }

       
        
        const verified = speakeasy.totp.verify({
            secret: employeeData.secret,
            encoding: "base32",
            token: otp,
            window: 2,
            step: 30
        });

       

        if (verified) {
            const firebaseCustomToken = await admin.auth().createCustomToken(employeeData.authId);
            res.json({
                success: true,
                message: "OTP verified successfully",
                firebaseCustomToken,
                employeeData
            });
        } else {
            res.status(400).json({ message: "Invalid OTP" });
        }

    } catch (error) {
       
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.generateSecret = async (req, res) => {
    try {
        const { uid, mobileNumber } = req.body;
        if (!uid || !mobileNumber) return res.status(400).json({ message: "UID and mobile number required" });

        const employeeRef = db.collection("employees").doc(uid);
        const employeeDoc = await employeeRef.get();

        if (!employeeDoc.exists) return res.status(404).json({ message: "Employee not found" });

        const employeeData = employeeDoc.data();
        if (employeeData.secret) {
            return res.json({ secret: employeeData.secret, qrCode: employeeData.qrCode, message: "Secret key already exists." });
        }

        // ✅ Generate new secret
        const secret = speakeasy.generateSecret({
            length: 20,
            name: `${employeeData.companyName} (${mobileNumber})`,
            issuer: "MyCompany"
        });

        const otpAuthUrl = secret.otpauth_url;
        const qrCodeImage = await qrcode.toDataURL(otpAuthUrl);

        // ✅ Save to Firestore
        await employeeRef.update({ secret: secret.base32, qrCode: qrCodeImage });

        res.json({ secret: secret.base32, qrCode: qrCodeImage, message: "New secret key generated." });
    } catch (error) {
        console.error("❌ Error generating secret:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get employee data by auth ID
exports.getEmployeeByAuthId = async (req, res) => {
    console.log("getEmployeeByAuthId called");
    try {
        const { authId } = req.params;
        
        if (!authId) {
            return res.status(400).json({ 
                success: false,
                message: "Auth ID is required" 
            });
        }

        // Get employee data from Firestore
        const employeesRef = db.collection("employees");
        const querySnapshot = await employeesRef.where("authId", "==", authId).get();
        
        if (querySnapshot.empty) {
            return res.status(404).json({ 
                success: false,
                message: "Employee not found with this auth ID" 
            });
        }

        const employeeDoc = querySnapshot.docs[0];
        const employeeData = employeeDoc.data();

        res.json({
            success: true,
            message: "Employee data retrieved successfully",
            employee: {
                id: employeeDoc.id,
                authId: employeeData.authId,
                nickname: employeeData.nickname,
                firstName: employeeData.firstName,
                lastName: employeeData.lastName,
                email: employeeData.email,
                primaryNumber: employeeData.primary_number,
                companyName: employeeData.companyName,
                locationName: employeeData.locationName,
                branchName: employeeData.branchName,
                positionName: employeeData.positionName,
                status: employeeData.status,
                role: employeeData.role,
                profileImage: employeeData.profileImage,
                has2FA: !!employeeData.secret,
                joinDate: employeeData.joinDate,
                maritalStatus: employeeData.maritalStatus,
                dateOfBirth: employeeData.dateOfBirth,
                gender: employeeData.gender,
                salary: employeeData.salary,
                department: employeeData.department,
                createdAt: employeeData.createdAt,
                updatedAt: employeeData.updatedAt
            }
        });

    } catch (error) {
        console.error("❌ Error in getEmployeeByAuthId:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// OLD LOGIN - Login with Firebase ID Token (after client-side authentication) - BACKUP
exports.loginWithIdToken_OLD = async (req, res) => {
    console.log("loginWithIdToken called");
    try {
        const { idToken } = req.body;
        
        if (!idToken) {
            return res.status(400).json({ 
                success: false,
                message: "ID token is required" 
            });
        }

        // Verify the ID token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        
        // Get employee data from Firestore
        const employeesRef = db.collection("employees");
        const querySnapshot = await employeesRef.where("authId", "==", decodedToken.uid).get();
        
        if (querySnapshot.empty) {
            return res.status(404).json({ 
                success: false,
                message: "Employee record not found" 
            });
        }

        const employeeDoc = querySnapshot.docs[0];
        const employeeData = employeeDoc.data();

        res.json({
            success: true,
            message: "Login successful",
            user: {
                uid: decodedToken.uid,
                email: decodedToken.email,
                displayName: decodedToken.name || employeeData.nickname,
                emailVerified: decodedToken.email_verified,
                customMetadata: decodedToken
            },
            employee: {
                id: employeeDoc.id,
                authId: employeeData.authId,
                nickname: employeeData.nickname,
                firstName: employeeData.firstName,
                lastName: employeeData.lastName,
                email: employeeData.email,
                primaryNumber: employeeData.primary_number,
                companyName: employeeData.companyName,
                locationName: employeeData.locationName,
                branchName: employeeData.branchName,
                positionName: employeeData.positionName,
                status: employeeData.status,
                role: employeeData.role,
                profileImage: employeeData.profileImage,
                has2FA: !!employeeData.secret
            }
        });

    } catch (error) {
        console.error("❌ Error in loginWithIdToken:", error);
        
        if (error.code === 'auth/invalid-token') {
            return res.status(401).json({ 
                success: false,
                message: "Invalid token" 
            });
        }

        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// NEW LOGIN/REGISTER - Email and Password Login/Registration System
exports.loginWithEmailPassword = async (req, res) => {
    console.log("loginWithEmailPassword called");
    try {
        const { email, password, confirmPassword } = req.body;
        
        // Validation
        if (!email || !password || !confirmPassword) {
            return res.status(400).json({ 
                success: false,
                message: "Email, password, and confirm password are required" 
            });
        }

        // Check if passwords match
        if (password !== confirmPassword) {
            return res.status(400).json({ 
                success: false,
                message: "Password and confirm password do not match" 
            });
        }

        // Check if employee exists with this email
        const employeesRef = db.collection("employees");
        const querySnapshot = await employeesRef.where("email", "==", email).get();
        
        if (querySnapshot.empty) {
            // Employee doesn't exist - Show HR contact message
            console.log(`Employee not found with email: ${email} - Contact HR required`);
            return res.status(404).json({ 
                success: false,
                message: "Your email address was not found in system, please contact to your HR" 
            });

        } else {
            // Employee exists - LOGIN FLOW
            const employeeDoc = querySnapshot.docs[0];
            const employeeData = employeeDoc.data();

            // Check if employee has a password set
            if (!employeeData.password) {
                // Employee exists but no password - need to register
                console.log(`Employee ${email} exists but no password set - need to register`);
                return res.status(400).json({ 
                    success: false,
                    message: "You need to register first" 
                });

            } else {
                // Employee has password - verify it
                if (employeeData.password !== password) {
                    return res.status(401).json({ 
                        success: false,
                        message: "Invalid password" 
                    });
                }

                // Password matches - successful login
                console.log(`Successful login for employee: ${email}`);

                res.json({
                    success: true,
                    message: "Login successful",
                    isRegistration: false,
                    employee: {
                        id: employeeDoc.id,
                        authId: employeeData.authId,
                        nickname: employeeData.nickname,
                        firstName: employeeData.firstName,
                        lastName: employeeData.lastName,
                        email: employeeData.email,
                        primaryNumber: employeeData.primary_number,
                        companyName: employeeData.companyName,
                        locationName: employeeData.locationName,
                        branchName: employeeData.branchName,
                        positionName: employeeData.positionName,
                        status: employeeData.status,
                        role: employeeData.role,
                        profileImage: employeeData.profileImage,
                        has2FA: !!employeeData.secret,
                        joinDate: employeeData.joinDate,
                        maritalStatus: employeeData.maritalStatus,
                        dateOfBirth: employeeData.dateOfBirth,
                        gender: employeeData.gender,
                        salary: employeeData.salary,
                        department: employeeData.department,
                        createdAt: employeeData.createdAt,
                        updatedAt: employeeData.updatedAt
                    }
                });
            }
        }

    } catch (error) {
        console.error("❌ Error in loginWithEmailPassword:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// LOGIN ENDPOINT - Email and Password Login (Firebase Auth only)
exports.loginUser = async (req, res) => {
    console.log("loginUser called");
    try {
        const { email, password } = req.body;
        
        // Validation
        if (!email || !password) {
            return res.status(400).json({ 
                success: false,
                message: "Email and password are required" 
            });
        }

        // ✅ STEP 1: Check Firebase Authentication first
        let firebaseUser = null;
        try {
            firebaseUser = await admin.auth().getUserByEmail(email);
            console.log(`✅ User found in Firebase Auth: ${email}`);
        } catch (firebaseError) {
            // User not found in Firebase Auth
            if (firebaseError.code === 'auth/user-not-found') {
                console.log(`ℹ️ User not found in Firebase Auth: ${email}`);
                return res.status(404).json({ 
                    success: false,
                    message: "You need to register first",
                    messageTh: "กรุณาลงทะเบียนก่อน"
                });
            } else {
                console.error(`⚠️ Firebase Auth error: ${firebaseError.message}`);
                return res.status(500).json({ 
                    success: false,
                    message: "Error checking authentication",
                    error: firebaseError.message 
                });
            }
        }

        // ✅ STEP 2: User exists in Firebase Auth - Get employee data from Firestore
        const employeeDoc = await findEmployeeByEmail(email);
        
        if (!employeeDoc) {
            return res.status(404).json({ 
                success: false,
                message: "Employee not found in system" 
            });
        }

        const employeeData = employeeDoc.data();

        // Update employee document with authId if not set
        if (!employeeData.authId) {
            await employeeDoc.ref.update({
                authId: firebaseUser.uid,
                updatedAt: new Date().toISOString()
            });
            employeeData.authId = firebaseUser.uid;
        }

        // Create custom token for Firebase Auth login
        // Note: Password verification happens on client-side with Firebase Auth SDK
        const customToken = await admin.auth().createCustomToken(firebaseUser.uid);
        
        console.log(`✅ Login successful: ${email}`);

        res.json({
            success: true,
            message: "Login successful",
            messageTh: "เข้าสู่ระบบสำเร็จ",
            firebaseAuth: true,
            customToken: customToken,
            employee: {
                id: employeeDoc.id,
                authId: firebaseUser.uid,
                nickname: employeeData.nickname,
                firstName: employeeData.firstName,
                lastName: employeeData.lastName,
                email: getEmployeeEmail(employeeData),
                primaryNumber: employeeData.primary_number,
                companyName: employeeData.companyName,
                locationName: employeeData.locationName,
                branchName: employeeData.branchName,
                positionName: employeeData.positionName,
                status: employeeData.status,
                role: employeeData.role,
                profileImage: employeeData.profileImage,
                has2FA: !!employeeData.secret,
                joinDate: employeeData.joinDate,
                maritalStatus: employeeData.maritalStatus,
                dateOfBirth: employeeData.dateOfBirth,
                gender: employeeData.gender,
                salary: employeeData.salary,
                department: employeeData.department,
                createdAt: employeeData.createdAt,
                updatedAt: employeeData.updatedAt
            }
        });

    } catch (error) {
        console.error("❌ Error in loginUser:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// REGISTER ENDPOINT - Email and Password Registration (for existing employees only)
exports.registerUser = async (req, res) => {
    console.log("registerUser called");
    try {
        const { email, password, confirmPassword } = req.body;
        
        // Validation
        if (!email || !password || !confirmPassword) {
            return res.status(400).json({ 
                success: false,
                message: "Email, password, and confirm password are required",
                messageTh: "กรุณากรอกอีเมล รหัสผ่าน และยืนยันรหัสผ่าน"
            });
        }

        // Check if passwords match
        if (password !== confirmPassword) {
            return res.status(400).json({ 
                success: false,
                message: "Password and confirm password do not match",
                messageTh: "รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน"
            });
        }

        // Check if password meets minimum requirements
        if (password.length < 6) {
            return res.status(400).json({ 
                success: false,
                message: "Password must be at least 6 characters long",
                messageTh: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"
            });
        }

        // ✅ STEP 1: Check if employee exists with this email in employee table
        const employeeDoc = await findEmployeeByEmail(email);
        
        if (!employeeDoc) {
            // Email not found in employee table - Show HR contact message
            return res.status(404).json({ 
                success: false,
                message: "Your email address was not found in system, please contact to your HR",
                messageTh: "ไม่พบอีเมลของคุณในระบบ กรุณาติดต่อ HR"
            });
        }

        // ✅ STEP 2: Email exists in employee table - Check if already registered in Firebase Auth
        const employeeData = employeeDoc.data();

        // Check if user already exists in Firebase Auth
        try {
            const existingFirebaseUser = await admin.auth().getUserByEmail(email);
            // User already exists in Firebase Auth
            return res.status(409).json({ 
                success: false,
                message: "Account already registered. Please use login instead.",
                messageTh: "บัญชีนี้ลงทะเบียนแล้ว กรุณาใช้การเข้าสู่ระบบ"
            });
        } catch (firebaseError) {
            if (firebaseError.code !== 'auth/user-not-found') {
                // Some other Firebase Auth error
                console.error(`⚠️ Firebase Auth error during registration: ${firebaseError.message}`);
                return res.status(500).json({ 
                    success: false,
                    message: "Error checking authentication",
                    error: firebaseError.message 
                });
            }
            // User doesn't exist in Firebase Auth - proceed with registration
        }

        // ✅ STEP 3: Register user in Firebase Authentication
        try {
            const newFirebaseUser = await admin.auth().createUser({
                email: email,
                password: password,
                displayName: `${employeeData.firstName || ''} ${employeeData.lastName || ''}`.trim(),
                emailVerified: false
            });
            
            console.log(`✅ User created in Firebase Auth: ${newFirebaseUser.uid}`);
            
            // Update employee document with authId
            await employeeDoc.ref.update({ 
                authId: newFirebaseUser.uid,
                password: password, // Also save password in Firestore for backward compatibility
                updatedAt: new Date().toISOString()
            });
            
            // Create custom token for immediate login after registration
            const customToken = await admin.auth().createCustomToken(newFirebaseUser.uid);
            
            console.log(`✅ Registration successful: ${email}`);

            // Return success response for registration
            res.json({
                success: true,
                message: "Registration successful",
                messageTh: "ลงทะเบียนสำเร็จ",
                firebaseAuth: true,
                customToken: customToken,
                employee: {
                    id: employeeDoc.id,
                    authId: newFirebaseUser.uid,
                    nickname: employeeData.nickname,
                    firstName: employeeData.firstName,
                    lastName: employeeData.lastName,
                    email: getEmployeeEmail(employeeData),
                    primaryNumber: employeeData.primary_number,
                    companyName: employeeData.companyName,
                    locationName: employeeData.locationName,
                    branchName: employeeData.branchName,
                    positionName: employeeData.positionName,
                    status: employeeData.status,
                    role: employeeData.role,
                    profileImage: employeeData.profileImage,
                    has2FA: !!employeeData.secret,
                    joinDate: employeeData.joinDate,
                    maritalStatus: employeeData.maritalStatus,
                    dateOfBirth: employeeData.dateOfBirth,
                    gender: employeeData.gender,
                    salary: employeeData.salary,
                    department: employeeData.department,
                    createdAt: employeeData.createdAt,
                    updatedAt: new Date().toISOString()
                }
            });

        } catch (createError) {
            console.error(`❌ Failed to create Firebase Auth user: ${createError.message}`);
            return res.status(500).json({ 
                success: false,
                message: "Failed to create account. Please try again.",
                messageTh: "ไม่สามารถสร้างบัญชีได้ กรุณาลองอีกครั้ง",
                error: createError.message 
            });
        }

    } catch (error) {
        console.error("❌ Error in registerUser:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            messageTh: "เกิดข้อผิดพลาดในระบบ",
            error: error.message 
        });
    }
};

// Check if email exists in employee table
exports.checkEmail = async (req, res) => {
    console.log("checkEmail called");
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ 
                success: false,
                message: "Email is required" 
            });
        }

        // Check if employee exists with this email
        const employeesRef = db.collection("employees");
        const querySnapshot = await employeesRef.where("email", "==", email).get();
        
        if (querySnapshot.empty) {
            return res.json({
                success: true,
                message: "Email not found in employee table",
                emailExists: false,
                email: email
            });
        } else {
            const employeeDoc = querySnapshot.docs[0];
            const employeeData = employeeDoc.data();
            
            return res.json({
                success: true,
                message: "Email found in employee table",
                emailExists: true,
                email: email,
                employee: {
                    id: employeeDoc.id,
                    email: employeeData.email,
                    nickname: employeeData.nickname,
                    firstName: employeeData.firstName,
                    lastName: employeeData.lastName,
                    hasPassword: !!employeeData.password,
                    status: employeeData.status,
                    role: employeeData.role
                }
            });
        }

    } catch (error) {
        console.error("❌ Error in checkEmail:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Verify custom token and get user info
exports.verifyToken = async (req, res) => {
    console.log("verifyToken called");
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false,
                message: "No token provided" 
            });
        }

        const token = authHeader.split(' ')[1];
        
        // Verify the custom token
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        // Get employee data
        const employeesRef = db.collection("employees");
        const querySnapshot = await employeesRef.where("authId", "==", decodedToken.uid).get();
        
        if (querySnapshot.empty) {
            return res.status(404).json({ 
                success: false,
                message: "Employee record not found" 
            });
        }

        const employeeDoc = querySnapshot.docs[0];
        const employeeData = employeeDoc.data();

        res.json({
            success: true,
            message: "Token verified successfully",
            user: {
                uid: decodedToken.uid,
                email: decodedToken.email,
                emailVerified: decodedToken.email_verified
            },
            employee: {
                id: employeeDoc.id,
                authId: employeeData.authId,
                nickname: employeeData.nickname,
                firstName: employeeData.firstName,
                lastName: employeeData.lastName,
                email: employeeData.email,
                companyName: employeeData.companyName,
                locationName: employeeData.locationName,
                role: employeeData.role,
                profileImage: employeeData.profileImage
            }
        });

    } catch (error) {
        console.error("❌ Error verifying token:", error);
        
        if (error.code === 'auth/invalid-token') {
            return res.status(401).json({ 
                success: false,
                message: "Invalid token" 
            });
        }

        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Mobile login with JWT token generation
// ✅ UPDATED: Password is already verified by Firebase Auth on client-side
// This endpoint only verifies user exists in Firebase Auth and employee table
exports.mobileLogin = async (req, res) => {
    console.log("Mobile login called");
    try {
        const { email, password } = req.body; // Password is optional (already verified by Firebase Auth)
        
        // Validation - only email is required
        if (!email) {
            return res.status(400).json({ 
                success: false,
                message: "Email is required",
                messageTh: "กรุณากรอกอีเมล"
            });
        }

        // ✅ STEP 1: Verify user exists in Firebase Authentication
        // (Password was already verified by Firebase Auth SDK on client-side)
        let firebaseUser = null;
        try {
            firebaseUser = await admin.auth().getUserByEmail(email);
            console.log(`✅ User found in Firebase Auth: ${email}`);
        } catch (firebaseError) {
            // User not found in Firebase Auth
            if (firebaseError.code === 'auth/user-not-found') {
                console.log(`ℹ️ User not found in Firebase Auth: ${email}`);
                return res.status(404).json({ 
                    success: false,
                    message: "You need to register first",
                    messageTh: "กรุณาลงทะเบียนก่อน"
                });
            } else {
                console.error(`⚠️ Firebase Auth error: ${firebaseError.message}`);
                return res.status(500).json({ 
                    success: false,
                    message: "Error checking authentication",
                    messageTh: "เกิดข้อผิดพลาดในการตรวจสอบการยืนยันตัวตน",
                    error: firebaseError.message 
                });
            }
        }

        // ✅ STEP 2: Verify email exists in employee table
        const employeeDoc = await findEmployeeByEmail(email);
        
        if (!employeeDoc) {
            return res.status(404).json({ 
                success: false,
                message: "Employee not found in system. Please contact HR.",
                messageTh: "ไม่พบข้อมูลพนักงานในระบบ กรุณาติดต่อ HR"
            });
        }

        const employeeData = employeeDoc.data();

        // ✅ STEP 3: Update employee document with authId if not set
        if (!employeeData.authId) {
            await employeeDoc.ref.update({
                authId: firebaseUser.uid,
                updatedAt: new Date().toISOString()
            });
            employeeData.authId = firebaseUser.uid;
        }

        // ✅ STEP 4: Generate JWT token and return employee data
        console.log(`✅ Mobile login successful for: ${employeeData.firstName || ''} ${employeeData.lastName || ''}`);
        
        const jwtSecret = 'nano-hr-mobile-secret-key-2024';
        const jwtPayload = {
            employeeId: employeeDoc.id,
            email: getEmployeeEmail(employeeData),
            role: employeeData.role,
            firstName: employeeData.firstName,
            lastName: employeeData.lastName,
            companyName: employeeData.companyName,
            positionName: employeeData.positionName
        };
        
        const jwtToken = jwt.sign(jwtPayload, jwtSecret, { expiresIn: '360d' });

        res.json({
            success: true,
            message: "Mobile login successful",
            messageTh: "เข้าสู่ระบบสำเร็จ",
            token: jwtToken, // JWT token for mobile app
            employee: {
                id: employeeDoc.id,
                authId: employeeData.authId || firebaseUser.uid,
                nickname: employeeData.nickname,
                firstName: employeeData.firstName,
                lastName: employeeData.lastName,
                email: getEmployeeEmail(employeeData),
                primaryNumber: employeeData.primary_number,
                companyName: employeeData.companyName,
                locationName: employeeData.locationName,
                branchName: employeeData.branchName,
                positionName: employeeData.positionName,
                status: employeeData.status,
                role: employeeData.role,
                profileImage: employeeData.profileImage,
                has2FA: !!employeeData.secret,
                joinDate: employeeData.joinDate,
                maritalStatus: employeeData.maritalStatus,
                dateOfBirth: employeeData.dateOfBirth,
                gender: employeeData.gender,
                salary: employeeData.salary,
                department: employeeData.department,
                createdAt: employeeData.createdAt,
                updatedAt: employeeData.updatedAt
            }
        });

    } catch (error) {
        console.error("❌ Error in mobile login:", error);
        res.status(500).json({ 
            success: false,
            message: "Mobile login failed",
            messageTh: "การเข้าสู่ระบบล้มเหลว",
            error: error.message 
        });
    }
};

// Change password endpoint
exports.changePassword = async (req, res) => {
    console.log("changePassword called");
    try {
        const { email, employeeId, currentPassword, newPassword, confirmNewPassword } = req.body;
        
        // Validation - require either email or employeeId
        if (!email && !employeeId) {
            return res.status(400).json({ 
                success: false,
                message: "Email or employeeId is required" 
            });
        }

        if (!currentPassword || !newPassword || !confirmNewPassword) {
            return res.status(400).json({ 
                success: false,
                message: "Current password, new password, and confirm password are required" 
            });
        }

        // Validate new password matches confirm password
        if (newPassword !== confirmNewPassword) {
            return res.status(400).json({ 
                success: false,
                message: "New password and confirm password do not match" 
            });
        }

        // Validate new password is different from current password
        if (currentPassword === newPassword) {
            return res.status(400).json({ 
                success: false,
                message: "New password must be different from current password" 
            });
        }

        // Optional: Validate password strength (minimum length)
        if (newPassword.length < 6) {
            return res.status(400).json({ 
                success: false,
                message: "New password must be at least 6 characters long" 
            });
        }

        // Find employee by email or employeeId
        let employeeDoc;
        let employeeData;
        
        if (email) {
            const employeesRef = db.collection("employees");
            // Try root level email first
            let querySnapshot = await employeesRef.where("email", "==", email).get();
            
            // If not found, try nested documents.email
            if (querySnapshot.empty) {
                // Get all employees and filter by nested email (less efficient but handles nested structure)
                const allEmployees = await employeesRef.get();
                const matchingDocs = [];
                allEmployees.forEach(doc => {
                    const data = doc.data();
                    // Check root level email
                    if (data.email === email) {
                        matchingDocs.push(doc);
                    }
                    // Check nested documents.email
                    else if (data.documents && data.documents.email === email) {
                        matchingDocs.push(doc);
                    }
                });
                
                if (matchingDocs.length === 0) {
                    return res.status(404).json({ 
                        success: false,
                        message: "Employee not found with this email address" 
                    });
                }
                
                employeeDoc = matchingDocs[0];
            } else {
                employeeDoc = querySnapshot.docs[0];
            }
            
            employeeData = employeeDoc.data();
        } else {
            // Find by employeeId (document ID or uid field)
            const employeeRef = db.collection("employees").doc(employeeId);
            employeeDoc = await employeeRef.get();
            
            if (!employeeDoc.exists) {
                // Try finding by uid field
                const employeesRef = db.collection("employees");
                const querySnapshot = await employeesRef.where("uid", "==", employeeId).limit(1).get();
                
                if (querySnapshot.empty) {
                    return res.status(404).json({ 
                        success: false,
                        message: "Employee not found" 
                    });
                }
                
                employeeDoc = querySnapshot.docs[0];
            }
            
            employeeData = employeeDoc.data();
        }

        // Check if employee has a password set
        if (!employeeData.password) {
            return res.status(400).json({ 
                success: false,
                message: "No password set for this account. Please register first." 
            });
        }

        // Verify current password
        if (employeeData.password !== currentPassword) {
            return res.status(401).json({ 
                success: false,
                message: "Current password is incorrect" 
            });
        }

        // Update password in Firestore
        const employeeRef = db.collection("employees").doc(employeeDoc.id);
        await employeeRef.update({
            password: newPassword,
            updatedAt: new Date().toISOString()
        });

        console.log(`✅ Password changed successfully for employee: ${employeeData.email || employeeId}`);

        res.json({
            success: true,
            message: "Password changed successfully",
            messageTh: "เปลี่ยนรหัสผ่านสำเร็จ"
        });

    } catch (error) {
        console.error("❌ Error in changePassword:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to change password",
            messageTh: "ไม่สามารถเปลี่ยนรหัสผ่านได้",
            error: error.message 
        });
    }
};

// Helper function to find employee by email (handles nested documents.email)
const findEmployeeByEmail = async (email) => {
    const employeesRef = db.collection("employees");
    
    // Try root level email first
    let querySnapshot = await employeesRef.where("email", "==", email).get();
    
    if (!querySnapshot.empty) {
        return querySnapshot.docs[0];
    }
    
    // If not found, try nested documents.email
    const allEmployees = await employeesRef.get();
    for (const doc of allEmployees.docs) {
        const data = doc.data();
        if (data.documents && data.documents.email === email) {
            return doc;
        }
    }
    
    return null;
};

// Helper function to get employee email (handles nested structure)
const getEmployeeEmail = (employeeData) => {
    return employeeData.email || (employeeData.documents && employeeData.documents.email) || null;
};

// Forgot password - Generate OTP and send via FCM push notification
exports.forgotPassword = async (req, res) => {
    console.log("forgotPassword called");
    try {
        const { email, employeeId } = req.body;
        
        // Accept either email or employeeId
        if (!email && !employeeId) {
            return res.status(400).json({ 
                success: false,
                message: "Email or employeeId is required" 
            });
        }

        // Find employee by email or employeeId
        let employeeDoc;
        if (email) {
            employeeDoc = await findEmployeeByEmail(email);
        } else {
            // Find by employeeId
            const employeeRef = db.collection("employees").doc(employeeId);
            employeeDoc = await employeeRef.get();
            if (!employeeDoc.exists) {
                const employeesRef = db.collection("employees");
                const querySnapshot = await employeesRef.where("uid", "==", employeeId).limit(1).get();
                if (!querySnapshot.empty) {
                    employeeDoc = querySnapshot.docs[0];
                } else {
                    employeeDoc = null;
                }
            } else {
                employeeDoc = { id: employeeRef.id, data: () => employeeDoc.data(), exists: true };
            }
        }
        
        // ✅ Security: Don't reveal if email/employeeId exists or not
        // Always return success message to prevent enumeration
        if (!employeeDoc || (employeeDoc.exists !== undefined && !employeeDoc.exists)) {
            console.log(`⚠️ Password reset requested for non-existent: ${email || employeeId}`);
            return res.json({
                success: true,
                message: "If the account exists, a password reset OTP has been sent to your device",
                messageTh: "หากบัญชีนี้มีอยู่ในระบบ จะส่งรหัส OTP ไปยังอุปกรณ์ของคุณ"
            });
        }

        const employeeData = employeeDoc.data ? employeeDoc.data() : employeeDoc;
        const employeeEmail = getEmployeeEmail(employeeData);

        // Check if employee has a password set
        if (!employeeData.password) {
            console.log(`⚠️ Password reset requested for account without password: ${email || employeeId}`);
            return res.json({
                success: true,
                message: "If the account exists, a password reset OTP has been sent to your device",
                messageTh: "หากบัญชีนี้มีอยู่ในระบบ จะส่งรหัส OTP ไปยังอุปกรณ์ของคุณ"
            });
        }

        // Check if employee has FCM device tokens
        const deviceTokens = employeeData.deviceTokens || [];
        if (!deviceTokens || deviceTokens.length === 0) {
            console.log(`⚠️ No device tokens found for password reset: ${email || employeeId}`);
            // Still return success to prevent information disclosure
            return res.json({
                success: true,
                message: "If the account exists, a password reset OTP has been sent to your device",
                messageTh: "หากบัญชีนี้มีอยู่ในระบบ จะส่งรหัส OTP ไปยังอุปกรณ์ของคุณ",
                // In debug mode, inform about missing tokens
                ...(process.env.NODE_ENV !== 'production' && {
                    debug: "No device tokens found - user needs to have app installed and logged in"
                })
            });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10); // OTP expires in 10 minutes

        // Store OTP in Firestore
        const passwordResetRef = db.collection('password_resets').doc();
        await passwordResetRef.set({
            email: employeeEmail,
            employeeId: employeeDoc.id || employeeId,
            otp: otp,
            expiresAt: expiresAt.toISOString(),
            used: false,
            createdAt: new Date().toISOString(),
            method: 'fcm' // Mark as FCM method
        });

        // Send FCM push notification with OTP
        const notificationTitle = "Password Reset Code";
        const notificationBody = `Your password reset OTP is: ${otp}`;
        
        try {
            const pushResult = await sendPushNotification(
                deviceTokens,
                notificationTitle,
                notificationBody,
                {
                    type: 'password_reset',
                    otp: otp,
                    email: employeeEmail,
                    employeeId: employeeDoc.id || employeeId,
                    expiresAt: expiresAt.toISOString()
                },
                employeeDoc.id || employeeId
            );

            if (pushResult.success) {
                console.log(`✅ Password reset OTP sent via FCM to ${employeeEmail}`);
                console.log(`   OTP: ${otp}`);
                console.log(`   Expires at: ${expiresAt.toISOString()}`);
            } else {
                console.error(`❌ Failed to send FCM notification:`, pushResult.message);
                // Don't fail the request - OTP is still generated
            }
        } catch (fcmError) {
            console.error(`❌ Error sending FCM notification:`, fcmError);
            // Don't fail the request - OTP is still generated and stored
        }

        // Return response
        const response = {
            success: true,
            message: "If the account exists, a password reset OTP has been sent to your device",
            messageTh: "หากบัญชีนี้มีอยู่ในระบบ จะส่งรหัส OTP ไปยังอุปกรณ์ของคุณ"
        };
        
        // In development mode, return OTP for testing (remove in production!)
        if (process.env.NODE_ENV !== 'production' || process.env.EMAIL_DEBUG === 'true') {
            response.otp = otp; // ⚠️ Only for testing - remove in production!
            response.expiresAt = expiresAt.toISOString();
            response.debug = true;
            console.log(`🔧 DEBUG MODE: Returning OTP in response for testing`);
        }
        
        res.json(response);

    } catch (error) {
        console.error("❌ Error in forgotPassword:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to process password reset request",
            messageTh: "ไม่สามารถดำเนินการรีเซ็ตรหัสผ่านได้",
            error: error.message 
        });
    }
};

// Verify reset OTP - Validate OTP before allowing password reset
exports.verifyResetOTP = async (req, res) => {
    console.log("verifyResetOTP called");
    try {
        const { email, employeeId, otp } = req.body;
        
        if (!otp || (!email && !employeeId)) {
            return res.status(400).json({ 
                success: false,
                message: "OTP and email or employeeId are required" 
            });
        }

        // Find reset OTP in Firestore (without orderBy to avoid index requirement)
        const passwordResetsRef = db.collection('password_resets');
        let querySnapshot;
        
        if (email) {
            querySnapshot = await passwordResetsRef
                .where('email', '==', email)
                .where('otp', '==', otp)
                .where('used', '==', false)
                .get();
        } else {
            querySnapshot = await passwordResetsRef
                .where('employeeId', '==', employeeId)
                .where('otp', '==', otp)
                .where('used', '==', false)
                .get();
        }
        
        // Get the most recent one (if multiple exist)
        let resetDoc = null;
        if (!querySnapshot.empty) {
            // Sort by createdAt descending and get the first one
            const docs = querySnapshot.docs.sort((a, b) => {
                const aTime = new Date(a.data().createdAt).getTime();
                const bTime = new Date(b.data().createdAt).getTime();
                return bTime - aTime;
            });
            resetDoc = docs[0];
        }

        if (!resetDoc) {
            return res.status(400).json({ 
                success: false,
                message: "Invalid or expired OTP",
                messageTh: "รหัส OTP ไม่ถูกต้องหรือหมดอายุแล้ว"
            });
        }

        const resetData = resetDoc.data();

        // Check if OTP is expired
        const expiresAt = new Date(resetData.expiresAt);
        const now = new Date();
        if (now > expiresAt) {
            // Mark as used even though expired
            await resetDoc.ref.update({ used: true });
            return res.status(400).json({ 
                success: false,
                message: "OTP has expired. Please request a new one.",
                messageTh: "รหัส OTP หมดอายุแล้ว กรุณาขอรหัสใหม่"
            });
        }

        // OTP is valid
        console.log(`✅ OTP verified for: ${resetData.email || resetData.employeeId}`);

        res.json({
            success: true,
            message: "OTP verified successfully",
            messageTh: "ยืนยันรหัส OTP สำเร็จ",
            verified: true
        });

    } catch (error) {
        console.error("❌ Error in verifyResetOTP:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to verify OTP",
            messageTh: "ไม่สามารถยืนยันรหัส OTP ได้",
            error: error.message 
        });
    }
};

// Reset password - Validate OTP and update password
exports.resetPassword = async (req, res) => {
    console.log("resetPassword called");
    try {
        const { email, employeeId, otp, newPassword, confirmPassword } = req.body;
        
        if (!otp || (!email && !employeeId) || !newPassword || !confirmPassword) {
            return res.status(400).json({ 
                success: false,
                message: "OTP, email or employeeId, new password, and confirm password are required" 
            });
        }

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ 
                success: false,
                message: "New password and confirm password do not match",
                messageTh: "รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน"
            });
        }

        // Validate password strength
        if (newPassword.length < 6) {
            return res.status(400).json({ 
                success: false,
                message: "New password must be at least 6 characters long",
                messageTh: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"
            });
        }

        // Find reset OTP in Firestore (without orderBy to avoid index requirement)
        const passwordResetsRef = db.collection('password_resets');
        let querySnapshot;
        
        if (email) {
            querySnapshot = await passwordResetsRef
                .where('email', '==', email)
                .where('otp', '==', otp)
                .where('used', '==', false)
                .get();
        } else {
            querySnapshot = await passwordResetsRef
                .where('employeeId', '==', employeeId)
                .where('otp', '==', otp)
                .where('used', '==', false)
                .get();
        }
        
        // Get the most recent one (if multiple exist)
        let resetDoc = null;
        if (!querySnapshot.empty) {
            // Sort by createdAt descending and get the first one
            const docs = querySnapshot.docs.sort((a, b) => {
                const aTime = new Date(a.data().createdAt).getTime();
                const bTime = new Date(b.data().createdAt).getTime();
                return bTime - aTime;
            });
            resetDoc = docs[0];
        }

        if (!resetDoc) {
            return res.status(400).json({ 
                success: false,
                message: "Invalid or expired OTP",
                messageTh: "รหัส OTP ไม่ถูกต้องหรือหมดอายุแล้ว"
            });
        }

        const resetData = resetDoc.data();

        // Check if OTP is expired
        const expiresAt = new Date(resetData.expiresAt);
        const now = new Date();
        if (now > expiresAt) {
            // Mark as used even though expired
            await resetDoc.ref.update({ used: true });
            return res.status(400).json({ 
                success: false,
                message: "OTP has expired. Please request a new one.",
                messageTh: "รหัส OTP หมดอายุแล้ว กรุณาขอรหัสใหม่"
            });
        }

        // Find employee
        let employeeDoc;
        if (email) {
            employeeDoc = await findEmployeeByEmail(email);
        } else {
            const employeeRef = db.collection("employees").doc(employeeId);
            const doc = await employeeRef.get();
            if (doc.exists) {
                employeeDoc = { id: employeeRef.id, data: () => doc.data() };
            } else {
                const employeesRef = db.collection("employees");
                const querySnapshot = await employeesRef.where("uid", "==", employeeId).limit(1).get();
                if (!querySnapshot.empty) {
                    employeeDoc = querySnapshot.docs[0];
                }
            }
        }

        if (!employeeDoc) {
            return res.status(404).json({ 
                success: false,
                message: "Employee not found",
                messageTh: "ไม่พบข้อมูลพนักงาน"
            });
        }

        const employeeData = employeeDoc.data ? employeeDoc.data() : employeeDoc;
        const employeeIdToUpdate = employeeDoc.id || employeeId;

        // Update password
        const employeeRef = db.collection("employees").doc(employeeIdToUpdate);
        await employeeRef.update({
            password: newPassword,
            updatedAt: new Date().toISOString()
        });

        // Mark OTP as used
        await resetDoc.ref.update({ 
            used: true,
            usedAt: new Date().toISOString()
        });

        console.log(`✅ Password reset successfully for: ${resetData.email || employeeId}`);

        res.json({
            success: true,
            message: "Password reset successfully",
            messageTh: "รีเซ็ตรหัสผ่านสำเร็จ"
        });

    } catch (error) {
        console.error("❌ Error in resetPassword:", error);
        res.status(500).json({ 
            success: false,
            message: "Failed to reset password",
            messageTh: "ไม่สามารถรีเซ็ตรหัสผ่านได้",
            error: error.message 
        });
    }
};



