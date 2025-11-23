const { admin, db } = require("../config/firebaseConfig");
const jwt = require("jsonwebtoken");

/**
 * Universal Authentication middleware that supports multiple authentication methods:
 * 1. JWT token (for Flutter mobile app)
 * 2. authId (for web users with email/password login)
 * 3. Firebase Custom Token (for mobile users with OTP)
 * 4. Firebase ID Token (for Firebase Auth users)
 */
const authenticateToken = async (req, res, next) => {
    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false,
                message: "No token provided. Please include 'Authorization: Bearer <token>' header." 
            });
        }

        const token = authHeader.split(' ')[1];
        let employeeData = null;
        let employeeDoc = null;

        // Method 1: Try as JWT token (for Flutter mobile app)
        try {
            const jwtSecret = 'nano-hr-mobile-secret-key-2024';
            const decodedToken = jwt.verify(token, jwtSecret);
            
            if (decodedToken.employeeId) {
                const employeesRef = db.collection("employees");
                const employeeDocRef = employeesRef.doc(decodedToken.employeeId);
                const employeeDocSnapshot = await employeeDocRef.get();
                
                if (employeeDocSnapshot.exists) {
                    employeeDoc = employeeDocSnapshot;
                    employeeData = employeeDocSnapshot.data();
                    console.log("✅ Authenticated using JWT token method");
                }
            }
        } catch (error) {
            console.log("JWT token method failed, trying other methods...");
        }

        // Method 2: Try as authId (for web users)
        if (!employeeData) {
            try {
                const employeesRef = db.collection("employees");
                const querySnapshot = await employeesRef.where("authId", "==", token).get();
                
                if (!querySnapshot.empty) {
                    employeeDoc = querySnapshot.docs[0];
                    employeeData = employeeDoc.data();
                    console.log("✅ Authenticated using authId method");
                }
            } catch (error) {
                console.log("authId method failed, trying other methods...");
            }
        }

        // Method 3: Try as Firebase Custom Token (for mobile users with OTP)
        if (!employeeData) {
            try {
                const decodedToken = await admin.auth().verifyIdToken(token);
                const employeesRef = db.collection("employees");
                const querySnapshot = await employeesRef.where("authId", "==", decodedToken.uid).get();
                
                if (!querySnapshot.empty) {
                    employeeDoc = querySnapshot.docs[0];
                    employeeData = employeeDoc.data();
                    console.log("✅ Authenticated using Firebase Custom Token method");
                }
            } catch (error) {
                console.log("Firebase Custom Token method failed, trying other methods...");
            }
        }

        // Method 4: Try as Firebase ID Token (for Firebase Auth users like Angular)
        if (!employeeData) {
            try {
                const decodedToken = await admin.auth().verifyIdToken(token);
                const employeesRef = db.collection("employees");
                const querySnapshot = await employeesRef.where("authId", "==", decodedToken.uid).get();
                
                if (!querySnapshot.empty) {
                    employeeDoc = querySnapshot.docs[0];
                    employeeData = employeeDocSnapshot.data();
                    console.log("✅ Authenticated using Firebase ID Token method");
                }
            } catch (error) {
                console.log("Firebase ID Token method failed");
            }
        }

        // If no authentication method worked
        if (!employeeData) {
            return res.status(401).json({ 
                success: false,
                message: "Invalid token. Please login again." 
            });
        }

        // Add user and employee data to request object
        req.user = {
            uid: employeeData.authId || employeeDoc.id,
            email: employeeData.email,
            emailVerified: true
        };
        
        req.employee = {
            id: employeeDoc.id,
            uid: employeeData.uid,
            authId: employeeData.authId,
            nickname: employeeData.nickname,
            firstName: employeeData.firstName,
            lastName: employeeData.lastName,
            email: employeeData.email,
            companyName: employeeData.companyName,
            locationName: employeeData.locationName,
            branchName: employeeData.branchName,
            positionName: employeeData.positionName,
            role: employeeData.role,
            profileImage: employeeData.profileImage
        };

        // Continue to the next middleware/route handler
        next();

    } catch (error) {
        console.error("❌ Authentication error:", error);
        
        return res.status(500).json({ 
            success: false,
            message: "Authentication failed",
            error: error.message 
        });
    }
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // No token provided - continue without authentication
            req.user = null;
            req.employee = null;
            return next();
        }

        // Try to authenticate with the provided token
        const token = authHeader.split(' ')[1];
        let employeeData = null;
        let employeeDoc = null;

        // Try JWT token first
        try {
            const jwtSecret = 'nano-hr-mobile-secret-key-2024';
            const decodedToken = jwt.verify(token, jwtSecret);
            
            if (decodedToken.employeeId) {
                const employeesRef = db.collection("employees");
                const employeeDocRef = employeesRef.doc(decodedToken.employeeId);
                const employeeDocSnapshot = await employeeDocRef.get();
                
                if (employeeDocSnapshot.exists) {
                    employeeDoc = employeeDocSnapshot;
                    employeeData = employeeDocSnapshot.data();
                }
            }
        } catch (error) {
            // Try other methods...
        }

        // Try authId method
        if (!employeeData) {
            try {
                const employeesRef = db.collection("employees");
                const querySnapshot = await employeesRef.where("authId", "==", token).get();
                
                if (!querySnapshot.empty) {
                    employeeDoc = querySnapshot.docs[0];
                    employeeData = employeeDoc.data();
                }
            } catch (error) {
                // Continue...
            }
        }

        // Add user data if found
        if (employeeData) {
            req.user = {
                uid: employeeData.authId || employeeDoc.id,
                email: employeeData.email,
                emailVerified: true
            };
            
            req.employee = {
                id: employeeDoc.id,
                uid: employeeData.uid,
                authId: employeeData.authId,
                nickname: employeeData.nickname,
                firstName: employeeData.firstName,
                lastName: employeeData.lastName,
                email: employeeData.email,
                companyName: employeeData.companyName,
                locationName: employeeData.locationName,
                branchName: employeeData.branchName,
                positionName: employeeData.positionName,
                role: employeeData.role,
                profileImage: employeeData.profileImage
            };
        } else {
            req.user = null;
            req.employee = null;
        }

        next();

    } catch (error) {
        console.error("❌ Optional authentication error:", error);
        req.user = null;
        req.employee = null;
        next();
    }
};

/**
 * Role-based access control middleware
 */
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.employee) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const userRole = req.employee.role;
        const userPosition = req.employee.positionName;

        // Check if user has required role or position
        const hasAccess = allowedRoles.includes(userRole) || 
                         allowedRoles.includes(userPosition) ||
                         (userRole === 'HR' && allowedRoles.includes('Manager')) ||
                         (userPosition === 'Manager' && allowedRoles.includes('HR'));

        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: `Insufficient permissions. Required roles: ${allowedRoles.join(', ')}`,
                userRole: userRole,
                userPosition: userPosition
            });
        }

        next();
    };
};

/**
 * Position-based access control middleware
 */
const requirePosition = (allowedPositions) => {
    return (req, res, next) => {
        if (!req.employee) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const userPosition = req.employee.positionName;

        if (!allowedPositions.includes(userPosition)) {
            return res.status(403).json({
                success: false,
                message: `Insufficient permissions. Required positions: ${allowedPositions.join(', ')}`,
                userPosition: userPosition
            });
        }

        next();
    };
};

module.exports = {
    authenticateToken,
    optionalAuth,
    requireRole,
    requirePosition
};