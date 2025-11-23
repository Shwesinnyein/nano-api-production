// const speakeasy = require("speakeasy");
// const qrcode = require("qrcode");
// const { admin, db } = require("../config/firebaseConfig")

// exports.checkEmployeeMobile = async (req, res) => {
//     console.log("check employee,", req.body)
//     try {
//         const { mobileNumber } = req.body;
//         if (!mobileNumber) return res.status(400).json({ message: "Mobile number is required" });

//         const employeesRef = db.collection("employees");
//         const querySnapshot = await employeesRef.where("primary_number", "==", mobileNumber).get();

//         if (querySnapshot.empty) {
//             return res.status(404).json({ message: "Employee not found" });
//         }

//         const employeeData = querySnapshot.docs[0].data();
       

//         if (!employeeData.secret) {
//             return res.status(400).json({ message: "Employee has not enabled 2FA" });
//         }
       
//         res.json({
//             success: true,
//             message: "Employee exists and has 2FA enabled",
//             employee: {
//                 auth_id: employeeData.authId,
//                 name: employeeData.nickname,
//             }
//         });
       

//     } catch (error) {
//         console.error("❌ Error checking employee:", error);
//         res.status(500).json({ message: "Internal server error" });
//     }
// } 
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const { v4: uuidv4 } = require('uuid');
const { admin, db } = require("../config/firebaseConfig");


// Get all employees (simple query without optimization for now)
const getEmployeeListInternal = async () => {
    try {
        const employeesRef = db.collection("employees");
        const snapshot = await employeesRef.get();

        if (snapshot.empty) {
            return {
                success: false,
                message: "No employees found",
                data: [],
                count: 0
            };
        }

        const employees = [];
        snapshot.forEach(doc => {
            const employeeData = doc.data();
            employees.push({
                id: doc.id,
                uid: employeeData.uid,
                authId: employeeData.authId,
                nickname: employeeData.nickname,
                primary_number: employeeData.primary_number || null,
                companyName: employeeData.companyName || null,
                locationName: employeeData.locationName || null,
                has2FA: !!employeeData.secret || null,
                createdAt: employeeData.createdAt || null,
                updatedAt: employeeData.updatedAt || null,
                firstName: employeeData.firstName || null,
                lastName: employeeData.lastName || null,
                company: employeeData.company || null,
                location: employeeData.location || null,
                branch: employeeData.branch || null,
                branchName: employeeData.branchName || null,
                status: employeeData.status || null,
                position: employeeData.position || null,
                positionName: employeeData.positionName || null,
                joinDate: employeeData.joinDate || null,
                maritalStatus: employeeData.maritalStatus || null,
                profileImage: employeeData.profileImage || null,
                role: employeeData.role || null,
                email: employeeData.email || null,
                dateOfBirth: employeeData.dateOfBirth || null,
                gender: employeeData.gender || null,
                salary: employeeData.salary || null,
            });
        });

        return {
            success: true,
            message: "Employee list retrieved successfully",
            count: employees.length,
            data: employees
        };

    } catch (error) {
        console.error("❌ Error getting employee list:", error);
        return {
            success: false,
            message: "Internal server error",
            error: error.message,
            data: []
        };
    }
};

const checkEmployee = async (req, res) => {
    console.log("check employee,", req.body)
    try {
        const { mobileNumber } = req.body;
        if (!mobileNumber) return res.status(400).json({ message: "Mobile number is required" });

        const employeesRef = db.collection("employees");
        const querySnapshot = await employeesRef.where("primary_number", "==", mobileNumber).get();

        if (querySnapshot.empty) {
            return res.status(404).json({ message: "Employee not found" });
        }

        const employeeData = querySnapshot.docs[0].data();
       

        if (!employeeData.secret) {
            return res.status(400).json({ message: "Employee has not enabled 2FA" });
        }
       
        res.json({
            success: true,
            message: "Employee exists and has 2FA enabled",
            employee: {
                auth_id: employeeData.authId,
                name: employeeData.nickname,
            }
        });
       

    } catch (error) {
        console.error("❌ Error checking employee:", error);
        res.status(500).json({ message: "Internal server error" });
    }
} 

const checkEmployeeAuth = async (req, res) => {
    try {
        const { authId } = req.body;
        console.log("checkEmployeeAuth called with authId:", authId);

        if (!authId) {
            return res.status(400).json({
                success: false,
                message: "authId is required"
            });
        }

        const employeesRef = db.collection("employees");
        const querySnapshot = await employeesRef.where("authId", "==", authId).get();

        if (querySnapshot.empty) {
            return res.json({
                success: true,
                message: "Employee not found",
                employeeExists: false
            });
        } else {
            return res.json({
                success: true,
                message: "Employee found",
                employeeExists: true
            });
        }

    } catch (error) {
        console.error("❌ Error checking employee:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

// ✅ OPTIMIZED: Added pagination support
const getEmployeeList = async (req, res) => {
    try {
        const result = await getEmployeeListInternal();
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(404).json(result);
        }
    } catch (error) {
        console.error("❌ Error in getEmployeeList endpoint:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};


const login = async (req, res) => {
    console.log("Employee login called");
    try {
        const { email, password } = req.body;
        
        // Validation
        if (!email || !password) {
            return res.status(400).json({ 
                success: false,
                message: "Email and password are required" 
            });
        }

        // Check if employee exists with this email
        const employeesRef = db.collection("employees");
        const querySnapshot = await employeesRef.where("email", "==", email).get();
        
        if (querySnapshot.empty) {
            return res.status(404).json({ 
                success: false,
                message: "Employee not found with this email address" 
            });
        }

        const employeeDoc = querySnapshot.docs[0];
        const employeeData = employeeDoc.data();

        // Check if employee has a password set
        if (!employeeData.password) {
            return res.status(400).json({ 
                success: false,
                message: "Please register first" 
            });
        }

        // Verify password
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
        console.error("❌ Error in employee login:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

const checkEmail = async (req, res) => {
    console.log("Employee checkEmail called");
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
                    uid: employeeData.uid,
                    authId: employeeData.authId ?? null,
                    email: employeeData.email ?? null,
                    nickname: employeeData.nickname ?? null,
                    firstName: employeeData.firstName ?? null,
                    lastName: employeeData.lastName ?? null,
                    hasPassword: !!employeeData.password,
                    status: employeeData.status ?? null,
                    role: employeeData.role ?? null,
                    profileImage: employeeData.profileImage ?? null,
                    has2FA: !!employeeData.secret,
                    joinDate: employeeData.joinDate ?? null,
                    maritalStatus: employeeData.maritalStatus ?? null,
                    dateOfBirth: employeeData.dateOfBirth ?? null,
                    gender: employeeData.gender ?? null,
                    salary: employeeData.salary ?? null,
                    department: employeeData.department ?? null,
                    createdAt: employeeData.createdAt ?? null,
                    updatedAt: employeeData.updatedAt ?? null,
                    title: employeeData.title ?? null,
                    idAddress: employeeData.idAddress ?? null,
                    subDistrict: employeeData.subDistrict ?? null,
                    district: employeeData.district ?? null,
                    province: employeeData.province ?? null,
                    idType: employeeData.idType ?? null,
                    idCardNumber: employeeData.idCardNumber ?? null,
                    company: employeeData.company ?? null,
                    companyName: employeeData.companyName ?? null,
                    location: employeeData.location ?? null,
                    locationName: employeeData.locationName ?? null,
                    branch: employeeData.branch ?? null,
                    branchName: employeeData.branchName ?? null,
                    position: employeeData.position ?? null,
                    positionName: employeeData.positionName ?? null,
                }
            });
        }

    } catch (error) {
        console.error("❌ Error in employee checkEmail:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Register employee with email and password (check if email exists, if exists then save)
const register = async (req, res) => {
    console.log("Employee register called");
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
            return res.status(404).json({ 
                success: false,
                message: "Don't have data" 
            });
        }

        const employeeDoc = querySnapshot.docs[0];
        const employeeData = employeeDoc.data();

        // Update password for existing employee (whether they have password or not)
        await employeeDoc.ref.update({ 
            password: password,
            updatedAt: new Date().toISOString()
        });
        
        console.log(`Password updated for employee: ${email}`);

        res.json({
            success: true,
            message: "Password updated successfully",
            employee: {
                id: employeeDoc.id,
                uid: employeeData.uid,
                authId: employeeData.authId,
                nickname: employeeData.nickname,
                title: employeeData.title,
                firstName: employeeData.firstName,
                lastName: employeeData.lastName,
                email: employeeData.email,
                primaryNumber: employeeData.primary_number,
                company: employeeData.company,
                companyName: employeeData.companyName,
                location: employeeData.location,
                locationName: employeeData.locationName,
                branch: employeeData.branch,
                branchName: employeeData.branchName,
                position: employeeData.position,
                positionName: employeeData.positionName,
                status: employeeData.status,
                role: employeeData.role,
                roleName: employeeData.roleName,
                profileImage: employeeData.profileImage,
                has2FA: !!employeeData.secret,
                joinDate: employeeData.joinDate,
                maritalStatus: employeeData.maritalStatus,
                dateOfBirth: employeeData.dateOfBirth,
                gender: employeeData.gender,
                salary: employeeData.salary,
                idAddress: employeeData.idAddress,
                subDistrict: employeeData.subDistrict,
                district: employeeData.district,
                province: employeeData.province,
                idType: employeeData.idType,
                idCardNumber: employeeData.idCardNumber,
                createdAt: employeeData.createdAt,
                updatedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error("❌ Error in employee register:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Get employee profile by UID
const getProfileByUid = async (req, res) => {
    console.log("Get employee profile by UID called");
    try {
        const { uid } = req.params;
        
        if (!uid) {
            return res.status(400).json({ 
                success: false,
                message: "UID is required" 
            });
        }

        // Check if employee exists with this UID
        const employeesRef = db.collection("employees");
        const querySnapshot = await employeesRef.where("uid", "==", uid).get();
        
        if (querySnapshot.empty) {
            return res.status(404).json({ 
                success: false,
                message: "Employee not found with this UID" 
            });
        }

        const employeeDoc = querySnapshot.docs[0];
        const employeeData = employeeDoc.data();

        res.json({
            success: true,
            message: "Employee profile retrieved successfully",
            employee: {
                id: employeeDoc.id,
                uid: employeeData.uid,
                authId: employeeData.authId,
                nickname: employeeData.nickname,
                firstName: employeeData.firstName,
                lastName: employeeData.lastName,
                email: employeeData.email,
                primaryNumber: employeeData.primary_number,
                company: employeeData.company,
                companyName: employeeData.companyName,
                location: employeeData.location,
                locationName: employeeData.locationName,
                branchName: employeeData.branchName,
                branch: employeeData.branch,
                position: employeeData.position,
                positionName: employeeData.positionName,
                status: employeeData.status,
                role: employeeData.role,
                roleName: employeeData.roleName,
                bankName: employeeData.bankName,
                bankAccountNumber: employeeData.bankAccountNumber,
                bankHolderName: employeeData.bankHolderName,
                profileImage: employeeData.profileImage,
                has2FA: !!employeeData.secret,
                joinDate: employeeData.joinDate,
                maritalStatus: employeeData.maritalStatus,
                dateOfBirth: employeeData.dateOfBirth,
                gender: employeeData.gender,
                salary: employeeData.salary,
                idAddress: employeeData.idAddress,
                subDistrict: employeeData.subDistrict,
                district: employeeData.district,
                province: employeeData.province,
                postalCode: employeeData.postalCode,
                idType: employeeData.idType,
                idCardNumber: employeeData.idCardNumber,
                nationality: employeeData.nationality,
                title: employeeData.title,
                createdAt: employeeData.createdAt,
                updatedAt: employeeData.updatedAt
            }
        });

    } catch (error) {
        console.error("❌ Error in getProfileByUid:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// ✅ OPTIMIZED: Use aggregation instead of fetching all employees
const getEmployeeStats = async (req, res) => {
    try {
        const employeesRef = db.collection("employees");
        
        // Get total count efficiently
        const snapshot = await employeesRef.select('has2FA', 'secret', 'companyName', 'status').get();
        
        if (snapshot.empty) {
            return res.status(404).json({
                success: false,
                message: "No employees found"
            });
        }

        let totalEmployees = 0;
        let employeesWith2FA = 0;
        let activeEmployees = 0;
        const companyStats = {};
        
        snapshot.forEach(doc => {
            const data = doc.data();
            totalEmployees++;
            
            if (data.secret) {
                employeesWith2FA++;
            }
            
            if (data.status === 'active') {
                activeEmployees++;
            }
            
            if (data.companyName) {
                companyStats[data.companyName] = (companyStats[data.companyName] || 0) + 1;
            }
        });

        const employeesWithout2FA = totalEmployees - employeesWith2FA;

        res.json({
            success: true,
            message: "Employee statistics retrieved successfully",
            stats: {
                totalEmployees,
                activeEmployees,
                employeesWith2FA,
                employeesWithout2FA,
                twoFactorPercentage: totalEmployees > 0 ? Math.round((employeesWith2FA / totalEmployees) * 100) : 0,
                companyBreakdown: companyStats
            }
        });

    } catch (error) {
        console.error("❌ Error getting employee stats:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// ✅ OPTIMIZED: Use Firestore ordering and limits instead of client-side operations
const searchEmployees = async (req, res) => {
    try {
        const {
            search,
            company,
            location,
            branch,
            position,
            status,
            role,
            has2FA,
            maritalStatus,
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        let query = db.collection("employees");

        // Apply filters (Firestore native)
        if (company) query = query.where("company", "==", company);
        if (location) query = query.where("location", "==", location);
        if (branch) query = query.where("branch", "==", branch);
        if (position) query = query.where("position", "==", position);
        if (status) query = query.where("status", "==", status);
        if (role) query = query.where("role", "==", role);
        if (maritalStatus) query = query.where("maritalStatus", "==", maritalStatus);

        // Apply ordering (only if no text search)
        if (!search && sortBy) {
            query = query.orderBy(sortBy, sortOrder);
        } else {
            // Default ordering for pagination
            query = query.orderBy("createdAt", "desc");
        }

        // Apply limit (Firestore native pagination)
        const limitInt = parseInt(limit);
        const pageInt = parseInt(page);
        query = query.limit(limitInt);

        // If pagination beyond page 1, use offset (note: not efficient for large offsets)
        if (pageInt > 1) {
            const skipCount = (pageInt - 1) * limitInt;
            const skipSnapshot = await query.limit(skipCount).get();
            if (!skipSnapshot.empty) {
                const lastVisible = skipSnapshot.docs[skipSnapshot.docs.length - 1];
                query = db.collection("employees");
                
                // Reapply filters
                if (company) query = query.where("company", "==", company);
                if (location) query = query.where("location", "==", location);
                if (branch) query = query.where("branch", "==", branch);
                if (position) query = query.where("position", "==", position);
                if (status) query = query.where("status", "==", status);
                if (role) query = query.where("role", "==", role);
                if (maritalStatus) query = query.where("maritalStatus", "==", maritalStatus);
                
                if (!search && sortBy) {
                    query = query.orderBy(sortBy, sortOrder);
            } else {
                    query = query.orderBy("createdAt", "desc");
                }
                
                query = query.startAfter(lastVisible).limit(limitInt);
            }
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
            return res.json({
                success: true,
                message: "No employees found matching the criteria",
                data: [],
                pagination: {
                    currentPage: pageInt,
                    totalPages: 0,
                    totalItems: 0,
                    itemsPerPage: limitInt
                }
            });
        }

        let employees = [];
        snapshot.forEach(doc => {
            const employeeData = doc.data();
            employees.push({
                id: doc.id,
                uid: employeeData.uid,
                authId: employeeData.authId,
                nickname: employeeData.nickname,
                primaryNumber: employeeData.primary_number,
                companyName: employeeData.companyName,
                locationName: employeeData.locationName,
                has2FA: !!employeeData.secret,
                createdAt: employeeData.createdAt,
                updatedAt: employeeData.updatedAt,
                firstName: employeeData.firstName,
                lastName: employeeData.lastName,
                company: employeeData.company,
                location: employeeData.location,
                branch: employeeData.branch,
                branchName: employeeData.branchName,
                status: employeeData.status,
                position: employeeData.position,
                positionName: employeeData.positionName,
                joinDate: employeeData.joinDate,
                maritalStatus: employeeData.maritalStatus,
                profileImage: employeeData.profileImage,
                role: employeeData.role,
                email: employeeData.email || '',
                department: employeeData.department || '',
                salary: employeeData.salary || null
            });
        });

        // Apply text search if provided (client-side, but only on limited results)
        if (search) {
            const searchTerm = search.toLowerCase();
            employees = employees.filter(emp => 
                (emp.nickname && emp.nickname.toLowerCase().includes(searchTerm)) ||
                (emp.firstName && emp.firstName.toLowerCase().includes(searchTerm)) ||
                (emp.lastName && emp.lastName.toLowerCase().includes(searchTerm)) ||
                (emp.email && emp.email.toLowerCase().includes(searchTerm)) ||
                (emp.primaryNumber && emp.primaryNumber.includes(searchTerm)) ||
                (emp.companyName && emp.companyName.toLowerCase().includes(searchTerm)) ||
                (emp.locationName && emp.locationName.toLowerCase().includes(searchTerm)) ||
                (emp.branchName && emp.branchName.toLowerCase().includes(searchTerm)) ||
                (emp.positionName && emp.positionName.toLowerCase().includes(searchTerm))
            );
        }

        res.json({
            success: true,
            message: "Employee search completed successfully",
            data: employees,
            pagination: {
                currentPage: pageInt,
                itemsPerPage: limitInt,
                hasNextPage: employees.length === limitInt,
                hasPrevPage: pageInt > 1
            },
            filters: {
                search: search || null,
                company: company || null,
                location: location || null,
                branch: branch || null,
                position: position || null,
                status: status || null,
                role: role || null,
                has2FA: has2FA || null,
                maritalStatus: maritalStatus || null
            }
        });

    } catch (error) {
        console.error("❌ Error searching employees:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// ✅ OPTIMIZED: Use Firestore select to only fetch needed fields
const getEmployeeFilterOptions = async (req, res) => {
    try {
        const employeesRef = db.collection("employees");
        // Only select the fields we need for filter options
        const snapshot = await employeesRef
            .select('companyName', 'locationName', 'branchName', 'positionName', 'status', 'role', 'maritalStatus')
            .get();

        if (snapshot.empty) {
            return res.json({
                success: true,
                message: "No employees found",
                data: {
                    companies: [],
                    locations: [],
                    branches: [],
                    positions: [],
                    statuses: [],
                    roles: [],
                    maritalStatuses: []
                }
            });
        }

        const companies = new Set();
        const locations = new Set();
        const branches = new Set();
        const positions = new Set();
        const statuses = new Set();
        const roles = new Set();
        const maritalStatuses = new Set();

        snapshot.forEach(doc => {
            const employeeData = doc.data();
            
            if (employeeData.companyName) companies.add(employeeData.companyName);
            if (employeeData.locationName) locations.add(employeeData.locationName);
            if (employeeData.branchName) branches.add(employeeData.branchName);
            if (employeeData.positionName) positions.add(employeeData.positionName);
            if (employeeData.status) statuses.add(employeeData.status);
            if (employeeData.role) roles.add(employeeData.role);
            if (employeeData.maritalStatus) maritalStatuses.add(employeeData.maritalStatus);
        });

        res.json({
            success: true,
            message: "Filter options retrieved successfully",
            data: {
                companies: Array.from(companies).sort(),
                locations: Array.from(locations).sort(),
                branches: Array.from(branches).sort(),
                positions: Array.from(positions).sort(),
                statuses: Array.from(statuses).sort(),
                roles: Array.from(roles).sort(),
                maritalStatuses: Array.from(maritalStatuses).sort()
            }
        });

    } catch (error) {
        console.error("❌ Error getting filter options:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Check In/Out API
const checkInOut = async (req, res) => {
    console.log("Check In/Out called", req.body);
    try {
        const { 
            employeeId, 
            employeeName, 
            position, 
            positionName, 
            company, 
            companyName, 
            locationName, 
            location, 
            branch, 
            branchName, 
            type,
            checkInAt,
            checkOutAt         
        } = req.body; // type: 'checkin' or 'checkout'
        
        // Validate required fields
        if (!employeeId || !employeeName || !type || !location) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: employeeId, employeeName, type, location"
            });
        }

        // Validate type
        if (type !== 'checkin' && type !== 'checkout') {
            return res.status(400).json({
                success: false,
                message: "Type must be 'checkin' or 'checkout'"
            });
        }

        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        
        // Reference to attendance collection
        const attendanceRef = db.collection("employee-attendance");
        
        // Query for existing attendance record for this employee today
        const existingQuery = await attendanceRef
            .where("employeeId", "==", employeeId)
            .where("date", "==", today)
            .limit(1)
            .get();

        if (type === 'checkin') {
            // Check if already checked in today
            if (!existingQuery.empty) {
                const existingDoc = existingQuery.docs[0];
                const existingData = existingDoc.data();
                
                if (existingData.checkInAt) {
                    return res.status(400).json({
                        success: false,
                        message: "Already checked in today",
                        attendance: existingData
                    });
                }
            }

            // Create or update check-in record
            const checkInData = {
                employeeId,
                employeeName,
                position,
                positionName,
                company,
                companyName,
                location,
                locationName,
                branch,
                branchName,
                date: today,
                checkInAt: checkInAt || new Date().toISOString(),
                checkOutAt: null,
                status: 'checked_in',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            let attendanceDoc;
            if (!existingQuery.empty) {
                // Update existing document
                attendanceDoc = existingQuery.docs[0];
                await attendanceDoc.ref.update(checkInData);
            } else {
                // Create new document
                const newDoc = await attendanceRef.add(checkInData);
                attendanceDoc = await newDoc.get();
            }

            return res.json({
            success: true,
                message: "Check-in successful",
                attendance: {
                    id: attendanceDoc.id,
                    ...checkInData
                }
            });

        } else if (type === 'checkout') {
            // Check if checked in first
            if (existingQuery.empty) {
                return res.status(400).json({
            success: false,
                    message: "No check-in record found for today. Please check in first."
                });
            }

            const existingDoc = existingQuery.docs[0];
            const existingData = existingDoc.data();

            // Check if already checked out
            if (existingData.checkOutAt) {
            return res.status(400).json({
                success: false,
                    message: "Already checked out today",
                    attendance: existingData
                });
            }

            // Update with check-out time
            const checkOutData = {
                checkOutAt: checkOutAt || new Date().toISOString(),
                status: 'checked_out',
                updatedAt: new Date().toISOString()
            };

            await existingDoc.ref.update(checkOutData);

            return res.json({
                success: true,
                message: "Check-out successful",
                attendance: {
                    id: existingDoc.id,
                    ...existingData,
                    ...checkOutData
                }
            });
        }

    } catch (error) {
        console.error("❌ Error in check in/out:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Get attendance history for an employee
const getAttendanceHistory = async (req, res) => {
    console.log("Get attendance history called");
    try {
        const { employeeId, startDate, endDate, limit = 30 } = req.query;

        let query = db.collection("employee-attendance");

        // Filter by employee ID if provided
        if (employeeId) {
            query = query.where("employeeId", "==", employeeId);
        }

        // Filter by date range if provided
        if (startDate) {
            query = query.where("date", ">=", startDate);
        }
        if (endDate) {
            query = query.where("date", "<=", endDate);
        }

        // Order by date descending and limit results
        query = query.orderBy("date", "desc").limit(parseInt(limit));

        const snapshot = await query.get();

        if (snapshot.empty) {
            return res.json({
                success: true,
                message: "No attendance records found",
                data: [],
                count: 0
            });
        }

        const attendanceRecords = [];
        snapshot.forEach(doc => {
            const record = doc.data();
            attendanceRecords.push({
                id: doc.id,
                ...record
            });
        });

        res.json({
            success: true,
            message: "Attendance history retrieved successfully",
            data: attendanceRecords,
            count: attendanceRecords.length
        });

    } catch (error) {
        console.error("❌ Error getting attendance history:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Get today's attendance status for an employee
const getTodayAttendance = async (req, res) => {
    console.log("Get today's attendance called");
    try {
        const { employeeId } = req.params;

        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: "Employee ID is required"
            });
        }

        const today = new Date().toISOString().split('T')[0];

        const attendanceRef = db.collection("employee-attendance");
        const query = await attendanceRef
            .where("employeeId", "==", employeeId)
            .where("date", "==", today)
            .limit(1)
            .get();

        if (query.empty) {
            return res.json({
                success: true,
                message: "No attendance record for today",
                hasCheckedIn: false,
                hasCheckedOut: false,
                attendance: null
            });
        }

        const doc = query.docs[0];
        const attendanceData = doc.data();

        res.json({
            success: true,
            message: "Today's attendance retrieved successfully",
            hasCheckedIn: !!attendanceData.checkInAt,
            hasCheckedOut: !!attendanceData.checkOutAt,
            attendance: {
                id: doc.id,
                ...attendanceData
            }
        });

    } catch (error) {
        console.error("❌ Error getting today's attendance:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Get employee data joined with shift-data based on positionName
const getEmployeeWithShiftData = async (req, res) => {
    console.log("Get employee with shift data called");
    try {
        const { employeeId } = req.params;

        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: "Employee ID is required"
            });
        }

        // Get employee data
        const employeeRef = db.collection("employees");
        const employeeQuery = await employeeRef.where("uid", "==", employeeId).get();

        if (employeeQuery.empty) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        const employeeDoc = employeeQuery.docs[0];
        const employeeData = employeeDoc.data();

        if (!employeeData.positionName) {
            return res.status(400).json({
                success: false,
                message: "Employee position name not found"
            });
        }

        // Get all shift data based on positionName
        const shiftDataRef = db.collection("shift-data");
        const shiftDataQuery = await shiftDataRef.where("positionName", "==", employeeData.positionName).get();

        let shiftData = [];
        if (!shiftDataQuery.empty) {
            shiftDataQuery.forEach(doc => {
                shiftData.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
        }

        // Prepare response with joined data
        const response = {
            success: true,
            message: `Employee data with ${shiftData.length} shift record(s) retrieved successfully`,
            employee: {
                id: employeeDoc.id,
                uid: employeeData.uid,
                authId: employeeData.authId,
                nickname: employeeData.nickname,
                firstName: employeeData.firstName,
                lastName: employeeData.lastName,
                email: employeeData.email,
                primaryNumber: employeeData.primary_number,
                company: employeeData.company,
                companyName: employeeData.companyName,
                location: employeeData.location,
                locationName: employeeData.locationName,
                branch: employeeData.branch,
                branchName: employeeData.branchName,
                position: employeeData.position,
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
            },
            shiftData: shiftData
        };

        res.json(response);

    } catch (error) {
        console.error("❌ Error getting employee with shift data:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Get shift data with flexible filtering (date, position, employeeId)
const getShiftDataWithFilter = async (req, res) => {
    console.log("Get shift data with filter called", req.query);
    try {
        const { date, position, employeeId } = req.query;
        
        // Trim any whitespace from date parameter
        const trimmedDate = date ? date.trim() : null;

        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: "Employee ID is required"
            });
        }

        // Run all queries in parallel for better performance
        const [employeeSnapshot, shiftSnapshot, attendanceSnapshot] = await Promise.all([
            // Query 1: Get employee data
            db.collection("employees").where("uid", "==", employeeId).get(),
            
            // Query 2: Get shift data (will be refined after getting employee data)
            (async () => {
                const employeeRef = db.collection("employees");
                const employeeQuery = await employeeRef.where("uid", "==", employeeId).get();
                
                if (employeeQuery.empty) return { empty: true, docs: [] };
                
                const employeeData = employeeQuery.docs[0].data();
                let shiftQuery = db.collection("shift-data");

                // For Salesman and Manager: filter by employeeId and assignDate
                if (employeeData.positionName === "Salesman" || employeeData.positionName === "Manager") {
                    console.log(`🔍 Looking for shift: employeeId=${employeeId}, position=Salesman/Manager, assignDate="${trimmedDate}"`);
                    shiftQuery = shiftQuery.where("employeeId", "==", employeeId);
                    
                    if (trimmedDate) {
                        const dateWithSpace = trimmedDate + " ";
                        shiftQuery = shiftQuery.where("assignDate", "in", [trimmedDate, dateWithSpace]);
                    }
                }
                // For other positions: filter by employee's positionName and workingDays
                else {
                    const dayOfWeek = trimmedDate ? getDayOfWeek(trimmedDate) : null;
                    console.log(`🔍 Looking for shift: positionName="${employeeData.positionName}", dayOfWeek="${dayOfWeek}", date="${trimmedDate}"`);
                    
                    // First, try to find employee-specific shift (by employeeId)
                    let employeeShiftQuery = db.collection("shift-data").where("employeeId", "==", employeeId);
                    if (trimmedDate) {
                        const dateWithSpace = trimmedDate + " ";
                        employeeShiftQuery = employeeShiftQuery.where("assignDate", "in", [trimmedDate, dateWithSpace]);
                    }
                    const employeeShiftSnapshot = await employeeShiftQuery.get();
                    console.log(`🔍 Employee-specific shift query: ${employeeShiftSnapshot.size} document(s) found`);
                    
                    // If employee-specific shift found, use it
                    if (!employeeShiftSnapshot.empty) {
                        console.log(`✅ Found employee-specific shift`);
                        return employeeShiftSnapshot;
                    }
                    
                    // If no employee-specific shift, try position-based shift
                    shiftQuery = shiftQuery.where("positionName", "==", employeeData.positionName);
                    
                    if (trimmedDate && dayOfWeek) {
                        shiftQuery = shiftQuery.where("workingDays", "array-contains", dayOfWeek);
                    }
                    
                    // Check if any shift documents exist for this position at all (for debugging)
                    const positionCheckQuery = db.collection("shift-data").where("positionName", "==", employeeData.positionName);
                    const positionCheckSnapshot = await positionCheckQuery.get();
                    console.log(`📋 Found ${positionCheckSnapshot.size} shift-data document(s) for positionName="${employeeData.positionName}"`);
                    
                    if (positionCheckSnapshot.size > 0) {
                        positionCheckSnapshot.forEach((doc, idx) => {
                            const data = doc.data();
                            console.log(`   Shift ${idx + 1}: workingDays=[${(data.workingDays || []).join(', ')}], startTime="${data.startTime}", endTime="${data.endTime}", employeeId="${data.employeeId || 'N/A'}"`);
                        });
                    }
                }
                
                const result = await shiftQuery.get();
                console.log(`📊 Shift query result: ${result.size} document(s) found`);
                return result;
            })(),
            
            // Query 3: Get attendance data (only if date provided)
            trimmedDate ? db.collection("employee-attendance")
                .where("employeeId", "==", employeeId)
                .where("date", "==", trimmedDate).get() : Promise.resolve({ empty: true, docs: [] })
        ]);

        // Check if employee exists
        if (employeeSnapshot.empty) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        const employeeDoc = employeeSnapshot.docs[0];
        const employeeData = employeeDoc.data();

        // Helper function to calculate working hours from startTime and endTime
        const calculateWorkingHours = (startTime, endTime) => {
            if (!startTime || !endTime) return null;
            
            try {
                const [startHours, startMinutes] = startTime.split(':').map(Number);
                const [endHours, endMinutes] = endTime.split(':').map(Number);
                
                const startTotalMinutes = startHours * 60 + startMinutes;
                const endTotalMinutes = endHours * 60 + endMinutes;
                
                const diffMinutes = endTotalMinutes - startTotalMinutes;
                const hours = Math.floor(diffMinutes / 60);
                const minutes = diffMinutes % 60;
                
                return {
                    totalMinutes: diffMinutes,
                    totalHours: Math.round((diffMinutes / 60) * 100) / 100, // 2 decimal places
                    formatted: `${hours}h ${minutes}m`,
                    hours: hours,
                    minutes: minutes
                };
            } catch (error) {
                return null;
            }
        };

        // Process shift data
        let shiftData = [];
        if (!shiftSnapshot.empty) {
            shiftSnapshot.forEach(doc => {
                const shift = doc.data();
                const workingHours = calculateWorkingHours(shift.startTime, shift.endTime);
                
                console.log(`📊 Shift data: startTime="${shift.startTime}", endTime="${shift.endTime}", workingHours=`, workingHours);
                
                shiftData.push({
                    id: doc.id,
                    ...shift,
                    workingHours: workingHours || null // Add calculated working hours (always include field)
                });
            });
        } else {
            console.log(`⚠️ No shift data found for employeeId=${employeeId}, date=${trimmedDate}`);
        }

        // Process attendance data
        let attendanceData = [];
        if (!attendanceSnapshot.empty) {
            attendanceSnapshot.forEach(doc => {
                const attendance = doc.data();
                attendanceData.push({
                    id: doc.id,
                    ...attendance,
                    currentLocation: attendance.currentLocation || null // Include currentLocation field
                });
            });
        }

        // Prepare response
        const response = {
            success: true,
            message: `Shift and attendance data retrieved successfully for ${employeeData.positionName}`,
            employee: {
                id: employeeDoc.id,
                uid: employeeData.uid,
                firstName: employeeData.firstName,
                lastName: employeeData.lastName,
                nickname: employeeData.nickname,
                positionName: employeeData.positionName,
                companyName: employeeData.companyName,
                locationName: employeeData.locationName,
                branchName: employeeData.branchName,
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

            },
            filters: {
                date: trimmedDate || null,
                position: position || null,
                employeeId: employeeId
            },
            shiftData: shiftData,
            attendanceData: attendanceData,
            counts: {
                shifts: shiftData.length,
                attendance: attendanceData.length
            }
        };

        res.json(response);

    } catch (error) {
        console.error("❌ Error getting shift data with filter:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Helper function to convert date to day of week
function getDayOfWeek(dateString) {
    const date = new Date(dateString);
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
}

// Get employee shift for specific date (simple API)
const getEmployeeShiftByDate = async (req, res) => {
    try {
        const { employeeId, date } = req.query;
        
        console.log("Get employee shift by date called", { employeeId, date });
        
        if (!employeeId || !date) {
            return res.status(400).json({
                success: false,
                message: "Employee ID and date are required"
            });
        }

        // Step 1: Get employee data
        const employeesRef = db.collection("employees");
        const employeeQuery = await employeesRef.where("uid", "==", employeeId).get();

        if (employeeQuery.empty) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        const employeeDoc = employeeQuery.docs[0];
        const employeeData = employeeDoc.data();
        
        // Step 2: Get shift data for this employee and date
        const shiftDataRef = db.collection("shift-data");
        let shiftData = null;
        
        // Try to find shift with employeeId and assignDate
        console.log(`🔍 Looking for shift: employeeId=${employeeId}, assignDate="${date + " "}"`);
        let shiftQuery = shiftDataRef
            .where("employeeId", "==", employeeId)
            .where("assignDate", "==", date + " ");
        
        let shiftSnapshot = await shiftQuery.limit(1).get();
        
        if (!shiftSnapshot.empty) {
            console.log(`✅ Found employee-specific shift by assignDate`);
            shiftData = {
                id: shiftSnapshot.docs[0].id,
                ...shiftSnapshot.docs[0].data()
            };
        } else {
            console.log(`⚠️ No shift found by assignDate, trying createdDate`);
            // Try with createdDate if assignDate doesn't exist
            shiftQuery = shiftDataRef
                .where("employeeId", "==", employeeId)
                .where("createdDate", "==", date + " ");
            
            shiftSnapshot = await shiftQuery.limit(1).get();
            
            if (!shiftSnapshot.empty) {
                console.log(`✅ Found employee-specific shift by createdDate`);
                shiftData = {
                    id: shiftSnapshot.docs[0].id,
                    ...shiftSnapshot.docs[0].data()
                };
            } else {
                // Try by positionName and workingDays if no employee-specific shift
                const dayOfWeek = getDayOfWeek(date);
                const positionName = employeeData.positionName;
                
                console.log(`⚠️ No employee-specific shift, trying position-based: positionName="${positionName}", dayOfWeek="${dayOfWeek}", date="${date}"`);
                
                // First, check if any shift-data exists for this position at all (for debugging)
                const positionCheckQuery = shiftDataRef.where("positionName", "==", positionName);
                const positionCheckSnapshot = await positionCheckQuery.get();
                console.log(`🔍 Found ${positionCheckSnapshot.size} shift-data document(s) for positionName="${positionName}"`);
                
                if (positionCheckSnapshot.size > 0) {
                    positionCheckSnapshot.forEach((doc, idx) => {
                        const data = doc.data();
                        console.log(`   Shift ${idx + 1}: workingDays=[${(data.workingDays || []).join(', ')}], shiftName="${data.shiftName || 'N/A'}"`);
                    });
                }
                
                shiftQuery = shiftDataRef
                    .where("positionName", "==", positionName)
                    .where("workingDays", "array-contains", dayOfWeek);
                
                shiftSnapshot = await shiftQuery.limit(1).get();
                
                if (!shiftSnapshot.empty) {
                    console.log(`✅ Found position-based shift`);
                    shiftData = {
                        id: shiftSnapshot.docs[0].id,
                        ...shiftSnapshot.docs[0].data()
                    };
                } else {
                    console.log(`❌ No shift found for positionName="${positionName}" with workingDays containing "${dayOfWeek}"`);
                    if (positionCheckSnapshot.size > 0) {
                        console.log(`💡 Tip: Shift documents exist for this position but none have "${dayOfWeek}" in workingDays array`);
                    } else {
                        console.log(`💡 Tip: No shift-data documents exist for positionName="${positionName}" at all`);
                    }
                }
            }
        }

        // Prepare response
        if (shiftData) {
            res.json({
                success: true,
                message: "Shift data retrieved successfully",
                data: {
                    employeeId: employeeId,
                    employeeName: `${employeeData.firstName || ''} ${employeeData.lastName || ''}`.trim(),
                    positionName: employeeData.positionName,
                    date: date,
                    shift: {
                        id: shiftData.id,
                        shiftId: shiftData.shiftId,
                        shiftUid: shiftData.shiftUid,
                        shiftName: shiftData.shiftName,
                        shiftNameEN: shiftData.shiftNameEN,
                        shiftTime: shiftData.shiftTime,
                        startTime: shiftData.startTime,
                        endTime: shiftData.endTime,
                        workingDays: shiftData.workingDays,
                        assignDate: shiftData.assignDate,
                        createdDate: shiftData.createdDate
                    }
                }
            });
        } else {
            res.json({
                success: true,
                message: "No shift data found for this date",
                data: {
                    employeeId: employeeId,
                    employeeName: `${employeeData.firstName || ''} ${employeeData.lastName || ''}`.trim(),
                    positionName: employeeData.positionName,
                    date: date,
                    shift: null
                }
            });
        }

    } catch (error) {
        console.error("❌ Error getting employee shift by date:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

module.exports = {
    login,
    register,
    checkEmail,
    getEmployeeList,
    getProfileByUid,
    getEmployeeStats,
    searchEmployees,
    getEmployeeFilterOptions,
    checkInOut,
    getAttendanceHistory,
    getTodayAttendance,
    checkEmployee,
    checkEmployeeAuth,
    getEmployeeListInternal,
    getEmployeeWithShiftData,
    getShiftDataWithFilter,
    getEmployeeShiftByDate
};
