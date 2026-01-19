const { admin, db } = require("../config/firebaseConfig");
const { v4: uuidv4 } = require('uuid');
const { sendLeaveRequestNotification, sendLeaveRequestNotificationToApprover, sendLeaveStatusNotification, createInAppNotification, findEmployeeDocRef } = require('./notificationController');

const getEmployeeNotificationChannels = (status) => {
    // ✅ Include in_app notification for all approval/rejection statuses
    // This includes: 'approved', 'approved_team_lead', 'approved_manager', 'approved_hr', 'rejected', 'cancelled'
    if (status && (status.includes('approved') || status.includes('rejected') || status === 'cancelled')) {
        return ['in_app', 'push'];
    }
    return ['push'];
};

// Initialize Firebase Storage with better error handling
let bucket;
const initializeFirebaseStorage = async () => {
    try {
        if (admin.apps.length === 0) {
           
            return null;
        }
        
    bucket = admin.storage().bucket();
        
        // Test if bucket exists
        try {
            const [exists] = await bucket.exists();
            if (!exists) {
               
                return null;
            }
        } catch (bucketError) {
            
            return null;
        }
        
        return bucket;
} catch (error) {
    console.error("❌ Firebase Storage initialization error:", error);
        return null;
    }
};

// Initialize on module load
initializeFirebaseStorage().then(result => {
    bucket = result;
}).catch(error => {
    console.error("Failed to initialize Firebase Storage:", error);
    bucket = null;
});

// Upload file to Firebase Storage
const uploadFileToStorage = async (file, leaveRequestId, employeeId) => {
    try {
        // Retry initialization if bucket is null
        if (!bucket) {
            bucket = await initializeFirebaseStorage();
            if (!bucket) {
                throw new Error("Firebase Storage bucket not initialized after retry");
            }
        }
        
        // Generate unique filename with timestamp to avoid conflicts
        const timestamp = Date.now();
        const fileExtension = file.originalname.split('.').pop() || '';
        const baseName = file.originalname.replace(/\.[^/.]+$/, '') || 'file';
        const uniqueFileName = `${baseName}_${timestamp}.${fileExtension}`;
        const fileName = `leave-attachments/${employeeId}/${leaveRequestId}/${uniqueFileName}`;
        const fileUpload = bucket.file(fileName);
        
        const stream = fileUpload.createWriteStream({
            metadata: {
                contentType: file.mimetype,
                metadata: {
                    originalName: file.originalname, // Save original name in metadata
                    uploadedBy: employeeId,
                    leaveRequestId: leaveRequestId,
                    uploadedAt: new Date().toISOString()
                }
            }
        });
        
        return new Promise((resolve, reject) => {
            stream.on('error', (error) => {
                console.error('❌ File upload error:', error);
                reject(error);
            });
            
            stream.on('finish', async () => {
                try {
                    // Make the file publicly accessible
                    await fileUpload.makePublic();
                    
                    // Get the public URL
                    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
                    
                    resolve({
                        fileName: fileName, // Storage path with timestamp name
                        storageName: uniqueFileName, // Timestamp name used in storage
                        originalName: file.originalname, // Original filename for database
                        publicUrl: publicUrl,
                        size: file.size,
                        contentType: file.mimetype,
                        uploadedAt: new Date().toISOString()
                    });
                } catch (error) {
                    console.error('❌ Error making file public:', error);
                    reject(error);
                }
            });
            
            stream.end(file.buffer);
        });
    } catch (error) {
        console.error('❌ Upload file to storage error:', error);
        throw error;
    }
};

const formatLeaveDateRange = (fromDate, toDate) => {
    if (fromDate && toDate) {
        if (fromDate === toDate) {
            return fromDate;
        }
        return `${fromDate} - ${toDate}`;
    }
    return fromDate || toDate || '';
};

const buildApproverNotificationContent = (level, { employeeName, leaveTypeName, leaveTypeNameEng, fromDate, toDate }) => {
    const safeEmployeeName = employeeName || 'An employee';
    const safeLeaveType = leaveTypeName || 'leave';
    const leaveLabel = leaveTypeNameEng ? `${leaveTypeNameEng} (${safeLeaveType})` : safeLeaveType;
    const dateRange = formatLeaveDateRange(fromDate, toDate);
    const rangeText = dateRange ? ` (${dateRange})` : '';

    switch ((level || '').toLowerCase()) {
        case 'team-lead':
            return {
                title: `Leave Request Notification`,
                titleTh: `การแจ้งเตือนการขอลา`,
                message: `${safeEmployeeName} requested ${leaveLabel}${rangeText}. Please check it out.`,
                messageTh: `${safeEmployeeName} ส่งคำขอ ${leaveLabel} ${rangeText}. กรุณาตรวจสอบ.`
            };
        case 'manager':
            return {
                title: `Leave Request Notification`,
                titleTh: `การแจ้งเตือนการขอลา`,
                message: `${safeEmployeeName} submitted a ${leaveLabel} request ${rangeText}. Please check it out.`,
                messageTh: `${safeEmployeeName} ส่งคำขอ ${leaveLabel} ${rangeText}. กรุณาตรวจสอบ.`
            };
        case 'hr':
            return {
                    title: `Leave Request Notification`,
                    titleTh: `การแจ้งเตือนการขอลา`,
                message: `${safeEmployeeName} submitted a ${leaveLabel} request ${rangeText} . Please check it out.`,
                messageTh: `${safeEmployeeName} ส่งคำขอ ${leaveLabel} ${rangeText}. กรุณาตรวจสอบ.`
            };
        case 'approver':
            return {
                title: `Leave Request Notification`,
                titleTh: `การแจ้งเตือนการขอลา`,
                message: `${safeEmployeeName} submitted a ${leaveLabel} request ${rangeText} . Please check it out.`,
                messageTh: `${safeEmployeeName} ส่งคำขอ ${leaveLabel} ${rangeText}. กรุณาตรวจสอบ.`
            };
        case 'warehouse-manager':
            return {
                title: `Leave Request Notification`,
                titleTh: `การแจ้งเตือนการขอลา`,
                message: `${safeEmployeeName} submitted a ${leaveLabel} request ${rangeText}. Please check it out.`,
                messageTh: `${safeEmployeeName} ส่งคำขอ ${leaveLabel} ${rangeText}. กรุณาตรวจสอบ.`
            };
        default:
            return {
                title: `Leave Request Notification`,
                titleTh: `การแจ้งเตือนการขอลา`,
                message: `${safeEmployeeName} submitted a ${leaveLabel} request ${rangeText} . Please check it out.`,
                messageTh: `${safeEmployeeName} ส่งคำขอ ${leaveLabel} ${rangeText}. กรุณาตรวจสอบ.`
            };
    }
};

// Helper function to check if a leave type is annual leave
const isAnnualLeave = (leaveTypeName, leaveTypeNameEng) => {
    if (!leaveTypeName && !leaveTypeNameEng) return false;
    
    const name = (leaveTypeName || '').toLowerCase().trim();
    const nameEng = (leaveTypeNameEng || '').toLowerCase().trim();
    
    // Check for specific annual leave identifiers only
    // Note: 'ลา' alone is too generic (matches all Thai leave types like ลาป่วย, ลากิจ, etc.)
    // Match specific annual leave keywords:
    // - Thai: 'ลาปี' (annual leave), 'ลาพักร้อน' (vacation/annual leave)
    // - English: 'annual', 'yearly', 'vacation'
    const annualKeywords = ['annual', 'ลาปี', 'ลาพักร้อน', 'yearly', 'vacation'];
    
    // Check if any annual keyword appears in the leave type name
    return annualKeywords.some(keyword => {
        // For Thai keywords, check if they appear in the name
        if (keyword === 'ลาปี' || keyword === 'ลาพักร้อน') {
            return name.includes(keyword) || nameEng.includes(keyword);
        }
        // For English keywords, check if they appear in either name
        return name.includes(keyword) || nameEng.includes(keyword);
    });
};

// Helper function to normalize branch codes/names for comparison
const normalizeBranchCode = (code) => {
    if (!code) return null;
    // Convert to string, trim whitespace, lowercase for case-insensitive comparison
    const normalized = String(code).trim().toLowerCase();
    return normalized || null;
};

// Helper function to extract branch name from branchName field
// "005 Srinagarindra" → "srinagarindra"
// "002 Thepharak" → "thepharak"
// "srinagarindra" → "srinagarindra" (already just the name)
const extractBranchName = (branchName) => {
    if (!branchName) return null;
    const str = String(branchName).trim();
    // If it contains spaces, take everything after the first part (branch code)
    const parts = str.split(/\s+/);
    if (parts.length > 1) {
        // Take everything after the first part (branch code)
        return parts.slice(1).join(' ').toLowerCase();
    }
    // If no spaces, assume it's already just the branch name
    return str.toLowerCase();
};

const findApproverIdsByLevel = async (level, employeeId, branchCode = null, branchName = null) => {
    console.log('📨 findApproverIdsByLevel:', level, employeeId, branchCode ? `branch: ${branchCode}` : '', branchName ? `branchName: ${branchName}` : '');
    const employeesRef = db.collection("employees");
    const ids = [];
    
    // Keep original values for Firestore queries (case-sensitive)
    let originalBranchCode = branchCode;
    let originalBranchName = branchName;
    
    // Normalized values for comparison with managedBranches (case-insensitive)
    let finalBranchCode = normalizeBranchCode(branchCode);
    let finalBranchName = normalizeBranchCode(branchName);
    
    if (!branchCode || !branchName) {
        try {
            const employeeQuery = await employeesRef.where("uid", "==", employeeId).limit(1).get();
            if (!employeeQuery.empty) {
                const employeeData = employeeQuery.docs[0].data();
                if (!originalBranchCode) {
                    originalBranchCode = employeeData.branch;
                    finalBranchCode = normalizeBranchCode(employeeData.branch);
                }
                if (!originalBranchName) {
                    originalBranchName = employeeData.branchName;
                    finalBranchName = normalizeBranchCode(employeeData.branchName);
                }
            }
        } catch (error) {
            console.error("❌ Error loading employee for approver lookup:", error);
        }
    }
    
    // Fallback if still no branch code
    if (!originalBranchCode) {
        originalBranchCode = "001";
        finalBranchCode = "001";
    }

    switch ((level || '').toLowerCase()) {
        case 'manager': {
            console.log(`📨 findApproverIdsByLevel: Looking for managers for branch code: "${branchCode || 'N/A'}" / branch name: "${branchName || 'N/A'}"`);
            console.log(`📨 Normalized: code="${finalBranchCode}", name="${finalBranchName || 'N/A'}"`);
            
            // Step 1: Find managers who manage this branch (via managedBranches)
            // managedBranches contains branch NAMES (e.g., "thepharak", "srinagarindra")
            // We need to compare both branch code AND branch name
            const managersWithManagedBranchesQuery = await employeesRef
                .where("positionName", "==", "Manager")
                .get();
            
            let foundViaManagedBranches = 0;
            managersWithManagedBranchesQuery.forEach(doc => {
                const managerData = doc.data();
                const managedBranches = Array.isArray(managerData.managedBranches) ? managerData.managedBranches : [];
                
                // Normalize all managed branches for comparison (they are branch names)
                const normalizedManagedBranches = managedBranches.map(b => normalizeBranchCode(b)).filter(Boolean);
                
                // Check if this manager manages the employee's branch
                // Use "contains" matching: check if branch/branchName contains any managed branch, or vice versa
                const extractedBranchName = extractBranchName(originalBranchName) || finalBranchName;
                const fullBranchName = normalizeBranchCode(originalBranchName) || finalBranchName;
                
                // Check if any managed branch matches (contains or is contained in) the employee's branch
                let matchesBranchCode = false;
                let matchesBranchName = false;
                
                if (finalBranchCode) {
                    // Check if branch code matches any managed branch (exact or contains)
                    matchesBranchCode = normalizedManagedBranches.some(managedBranch => 
                        managedBranch === finalBranchCode || 
                        managedBranch.includes(finalBranchCode) || 
                        finalBranchCode.includes(managedBranch)
                    );
                }
                
                if (extractedBranchName || fullBranchName) {
                    // Check if branch name matches any managed branch (exact or contains)
                    const nameToCheck = extractedBranchName || fullBranchName;
                    matchesBranchName = normalizedManagedBranches.some(managedBranch => 
                        managedBranch === nameToCheck || 
                        managedBranch.includes(nameToCheck) || 
                        nameToCheck.includes(managedBranch)
                    );
                }
                
                const isMatch = matchesBranchCode || matchesBranchName;
                
                console.log(`🔍 Checking manager ${managerData.uid} (branch: ${managerData.branch}):`);
                console.log(`   managedBranches = [${managedBranches.join(', ')}]`);
                console.log(`   normalized = [${normalizedManagedBranches.join(', ')}]`);
                console.log(`   employee branch code: "${finalBranchCode}" → matches: ${matchesBranchCode}`);
                console.log(`   employee branch name: "${extractedBranchName || 'N/A'}" (extracted from "${originalBranchName || 'N/A'}") → matches: ${matchesBranchName}`);
                
                if (isMatch) {
                    console.log(`✅ Found manager ${managerData.uid} (branch: ${managerData.branch}) who manages this branch`);
                    ids.push(managerData.uid);
                    foundViaManagedBranches++;
                } else {
                    console.log(`❌ Manager ${managerData.uid} does NOT manage this branch`);
                }
            });

            // Step 2: Find managers in the same branch as the employee
            // This handles cases where the branch has its own manager
            // Use original branch code for Firestore query (case-sensitive)
            const sameBranchManagerQuery = await employeesRef
                .where("branch", "==", originalBranchCode)
                .where("positionName", "==", "Manager")
                .get();
            
            let foundInSameBranch = 0;
            sameBranchManagerQuery.forEach(doc => {
                const managerData = doc.data();
                // Avoid duplicates if manager was already found via managedBranches
                if (!ids.includes(managerData.uid)) {
                    console.log(`✅ Found manager ${managerData.uid} in same branch ${finalBranchCode}`);
                    ids.push(managerData.uid);
                    foundInSameBranch++;
                }
            });
            
            console.log(`📊 Manager lookup result: ${ids.length} manager(s) found (${foundViaManagedBranches} via managed branches, ${foundInSameBranch} in same branch)`);
            break;
        }
        case 'team-lead': {
            console.log('📨 findApproverIdsByLevel: 3', level, employeeId);
            const teamLeadQuery = await employeesRef
                .where("positionName", "==", "Programmer (Team Lead)")
                .get();
            teamLeadQuery.forEach(doc => {
                const teamLeadData = doc.data();
                ids.push(teamLeadData.uid);
            });
            break;
        }
        case 'hr': {
            console.log('📨 findApproverIdsByLevel: 4', level, employeeId);
            const hrQuery = await employeesRef.where("positionName", "==", "HR").get();
            hrQuery.forEach(doc => {
                const hrData = doc.data();
                ids.push(hrData.uid);
            });
            break;
        }
        case 'approver': {
            console.log('📨 findApproverIdsByLevel: 5', level, employeeId);
            const approverQuery = await employeesRef.where("role", "in", ["approver", "approver-three"]).get();
            approverQuery.forEach(doc => {
                const approverData = doc.data();
                ids.push(approverData.uid);
            });
            break;
        }
        case 'warehouse-manager': {
            console.log('📨 findApproverIdsByLevel: 6', level, employeeId);
            const warehouseManagerQuery = await employeesRef
                .where("positionName", "==", "Warehouse Manager")
                .get();
            warehouseManagerQuery.forEach(doc => {
                const warehouseManagerData = doc.data();
                ids.push(warehouseManagerData.uid);
            });
            break;
        }
        default:
            break;
    }

    return Array.from(new Set(ids)).filter(Boolean);
};

// Get leave settings list
const getLeaveSettings = async (req, res) => {
    try {
        const { gender, employeeId } = req.query;
        
        // Step 1: If employeeId is provided, check months with company (for annual leave filtering)
        let employeeEligibleForAnnualLeave = true;
        let monthsWithCompany = 0;
        let employeeGender = null;
        
        if (employeeId) {
            try {
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
                const joinDate = new Date(employeeData.joinDate);
                const today = new Date();
                
                // Calculate months difference, accounting for day of month
                monthsWithCompany = (today.getFullYear() - joinDate.getFullYear()) * 12 + 
                                  (today.getMonth() - joinDate.getMonth());
                
                // If current day is before join day, subtract 1 month (not a full month yet)
                if (today.getDate() < joinDate.getDate()) {
                    monthsWithCompany -= 1;
                }
                
                // Employee is eligible for annual leave only if 3+ months
                employeeEligibleForAnnualLeave = monthsWithCompany >= 3;
                employeeGender = employeeData.gender;
            } catch (error) {
                console.error("Error checking employee eligibility:", error);
                return res.status(500).json({
                    success: false,
                    message: "Error checking employee eligibility",
                    error: error.message
                });
            }
        }
        
        // Step 2: If eligible (or no employeeId), retrieve ALL leave settings from database
        const leaveSettingsRef = db.collection("leave-settings");
        const snapshot = await leaveSettingsRef.get();

        if (snapshot.empty) {
            return res.json({
                success: true,
                message: "No leave settings found",
                data: [],
                count: 0,
                employeeEligibleForAnnualLeave: employeeEligibleForAnnualLeave,
                monthsWithCompany: monthsWithCompany,
                requiredMonths: 3,
                employeeGender: employeeGender
            });
        }

        // Step 3: Get all leave settings
        const leaveSettings = [];
        snapshot.forEach(doc => {
            const leaveSettingData = doc.data();
            const leaveTypeName = leaveSettingData.leaveTypeName || leaveSettingData.leave || leaveSettingData.title;
            const leaveTypeNameEng = leaveSettingData.leaveTypeNameEng || leaveSettingData.titleEng;
            
            leaveSettings.push({
                id: doc.id,
                uid: leaveSettingData.uid,
                leaveType: leaveTypeName,
                leaveTypeEng: leaveTypeNameEng,
                maxDays: leaveSettingData.leaveDay,
                isPaid: leaveSettingData.type === 'Paid' || leaveSettingData.isPaid === true,
                gender: leaveSettingData.gender,
               
                description: leaveSettingData.description,
                isActive: leaveSettingData.isActive !== false,
                createdAt: leaveSettingData.createdDate,
                updatedAt: leaveSettingData.updatedDate
            });
        });

        // Step 4: Filter by gender (employee's gender or provided gender filter)
        let filteredLeaveSettings = leaveSettings;
        let filterGender = null;
        
        if (employeeId && employeeGender) {
            // Use employee's gender for filtering
            filterGender = employeeGender;
        } else if (gender && ['male', 'female', 'all'].includes(gender.toLowerCase())) {
            // Use provided gender filter
            filterGender = gender.toLowerCase();
        }
        
        if (filterGender && filterGender !== 'all') {
            filteredLeaveSettings = leaveSettings.filter(setting => 
                setting.gender.toLowerCase() === filterGender.toLowerCase() || 
                setting.gender.toLowerCase() === 'all'
            );
        }
        
        // Step 5: Filter out annual leave if employee is not eligible (< 3 months)
        if (employeeId && !employeeEligibleForAnnualLeave) {
            filteredLeaveSettings = filteredLeaveSettings.filter(setting => 
                !isAnnualLeave(setting.leaveType, setting.leaveTypeEng)
            );
        }

        let message = "Leave settings retrieved successfully";
        if (employeeId) {
            if (employeeEligibleForAnnualLeave) {
                message = `Leave settings for ${employeeGender} employee (${monthsWithCompany} months with company) - All leave types available`;
            } else {
                message = `Leave settings for ${employeeGender} employee (${monthsWithCompany} months with company) - Annual leave available after 3 months`;
            }
        }

        res.json({
            success: true,
            message: message,
            count: filteredLeaveSettings.length,
            data: filteredLeaveSettings,
            employeeEligibleForAnnualLeave: employeeEligibleForAnnualLeave,
            monthsWithCompany: monthsWithCompany,
            requiredMonths: 3,
            employeeGender: employeeGender
        });

    } catch (error) {
        console.error("❌ Error getting leave settings:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Get employee leave list filtered by UID
const getEmployeeLeaveList = async (req, res) => {
    try {
        const { uid } = req.params;
        
        if (!uid) {
            return res.status(400).json({ 
                success: false,
                message: "UID is required" 
            });
        }

        // First, get employee data to check join date
        const employeesRef = db.collection("employees");
        const employeeQuery = await employeesRef.where("uid", "==", uid).get();
        
        if (employeeQuery.empty) {
            return res.status(404).json({ 
                success: false,
                message: "Employee not found" 
            });
        }

        const employeeDoc = employeeQuery.docs[0];
        const employeeData = employeeDoc.data();
        const joinDate = new Date(employeeData.joinDate);
        const today = new Date();
        
        // Calculate months difference, accounting for day of month
        let monthsDiff = (today.getFullYear() - joinDate.getFullYear()) * 12 + 
                          (today.getMonth() - joinDate.getMonth());
        
        // If current day is before join day, subtract 1 month (not a full month yet)
        if (today.getDate() < joinDate.getDate()) {
            monthsDiff -= 1;
        }

        // Check if employee is eligible for annual leave (3+ months)
        const eligibleForAnnualLeave = monthsDiff >= 3;

        // Get employee leave records filtered by employeeId (login user UID)
        const employeeLeaveRef = db.collection("employee-leave");
        
        // First, let's check if there are any records in the employee-leave table at all
        const allRecordsSnapshot = await employeeLeaveRef.limit(5).get();
        
        const querySnapshot = await employeeLeaveRef.where("employeeId", "==", employeeData.uid).get();

        if (querySnapshot.empty) {
            return res.json({
                success: true,
                message: "No leave records found for this employee",
                data: [],
                count: 0,
                eligibleForAnnualLeave: eligibleForAnnualLeave,
                monthsWithCompany: monthsDiff,
                requiredMonths: 3
            });
        }

        const leaveRecords = [];
        querySnapshot.forEach(doc => {
            const leaveData = doc.data();
            const leaveTypeName = leaveData.leaveTypeName;
            const leaveTypeNameEng = leaveData.leaveTypeNameEng;
            
            // Filter out annual leave if employee is not eligible (< 3 months)
            if (!eligibleForAnnualLeave && isAnnualLeave(leaveTypeName, leaveTypeNameEng)) {
                return; // Skip this record
            }
            
            leaveRecords.push({
                id: doc.id,
                uid: leaveData.uid || doc.id,
                employeeId: leaveData.employeeId,
                leaveType: leaveData.leaveType,
                leaveTypeName: leaveTypeName,
                leaveTypeNameEng: leaveTypeNameEng,
               
                requestType: leaveData.requestType || 'daily',
                isHalfDay: leaveData.isHalfDay || false,
                halfDayType: leaveData.halfDayType || null,
                // Daily leave fields
                startDate: leaveData.startDate || leaveData.fromDate || null,
                endDate: leaveData.endDate || leaveData.toDate || null,
                fromDate: leaveData.fromDate || leaveData.startDate || null,
                toDate: leaveData.toDate || leaveData.endDate || null,
                // Hourly leave fields
                date: leaveData.date || null,
                workingShift: leaveData.workingShift || leaveData.shiftName || null,
                shiftId: leaveData.shiftId || null,
                shiftName: leaveData.shiftName || null,
                startTime: leaveData.startTime || null,
                endTime: leaveData.endTime || null,
                // Common fields
                totalHours: leaveData.totalHours || 0,
                totalDays: leaveData.totalDays || 0,
                reason: leaveData.reason,
                status: leaveData.status || 'pending',
                statusName: leaveData.statusName || 'Pending',
                approvedBy: leaveData.approvedBy || null,
                approvedDate: leaveData.approvedDate || null,
                rejectedReason: leaveData.rejectedReason || null,
                createdAt: leaveData.createdAt,
                updatedAt: leaveData.updatedAt,
                attachment: leaveData.attachment || null
            });
        });

        // Sort by created date (newest first)
        leaveRecords.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({
            success: true,
            message: "Employee leave records retrieved successfully",
            count: leaveRecords.length,
            data: leaveRecords,
            eligibleForAnnualLeave: eligibleForAnnualLeave,
            monthsWithCompany: monthsDiff,
            requiredMonths: 3
        });

    } catch (error) {
        console.error("❌ Error getting employee leave list:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Create leave request with file upload support
const createLeaveRequest = async (req, res) => {
    console.log('📨 createLeaveRequest: 1', req.body);
   
    try {
        let { 
            employeeId, 
            employeeName,
            firstName,
            lastName,
            positionName,
            company,        // Add company code
            companyName,    // Add company name
            location,       // Add location code
            locationName,   // Add location name
            branch,         // Add branch code
            branchName,     // Add branch name
            requestDate,    // Add request date
            leaveType, 
            leaveTypeName, 
            leaveTypeNameEng,
            requestType, // 'daily' or 'hourly'
            fromDate, 
            toDate, 
            date, // for hourly leave
            workingShift, // for hourly leave
            startTime, // for hourly leave
            endTime, // for hourly leave
            reason, 
            attachment,
            attachments,
            isHalfDay = false,
            halfDayType,
            shiftId,
            shiftName
        } = req.body;
        console.log('📨 createLeaveRequest: 2', req.body);
        
        
        if (!employeeId || !leaveType || !leaveTypeName || !requestType || !reason) {
            const missingFields = [];
            if (!employeeId) missingFields.push("employeeId");
            if (!leaveType) missingFields.push("leaveType");
            if (!leaveTypeName) missingFields.push("leaveTypeName");
            if (!requestType) missingFields.push("requestType");
            if (!reason) missingFields.push("reason");
            
            return res.status(400).json({ 
                success: false,
                message: `Missing required fields: ${missingFields.join(", ")}`,
                missingFields: missingFields
            });
        }
       let employerDoc = null;
        const loadEmployeeDoc = async () => {
            if (employerDoc) return employerDoc;
            const snap = await db.collection('employees')
                .where('uid', '==', employeeId)
                .limit(1)
                .get();
            if (!snap.empty) {
                employerDoc = snap.docs[0].data();
            }
            return employerDoc;
        };
        console.log('📨 createLeaveRequest: 3', employeeName, firstName, lastName, positionName);
        if (!employeeName || !firstName || !lastName || !positionName) {
            console.log('📨 createLeaveRequest: 4', employeeName, firstName, lastName, positionName);
            const doc = await loadEmployeeDoc();
            if (doc) {
                employeeName = employeeName || `${doc.firstName || ''} ${doc.lastName || ''}`.trim();
                firstName = firstName || doc.firstName || '';
                lastName = lastName || doc.lastName || '';
                positionName = positionName || doc.positionName || '';
            }
        }
        
        // Check if employee is eligible for annual leave (3+ months)
        const employeeDocForEligibility = await loadEmployeeDoc();
        if (employeeDocForEligibility && employeeDocForEligibility.joinDate) {
            const joinDate = new Date(employeeDocForEligibility.joinDate);
            const today = new Date();
            let monthsWithCompany = (today.getFullYear() - joinDate.getFullYear()) * 12 + 
                                      (today.getMonth() - joinDate.getMonth());
            
            // If current day is before join day, subtract 1 month (not a full month yet)
            if (today.getDate() < joinDate.getDate()) {
                monthsWithCompany -= 1;
            }
            
            // Check if this is an annual leave request and employee is not eligible
            if (isAnnualLeave(leaveTypeName, leaveTypeNameEng) && monthsWithCompany < 3) {
                return res.status(400).json({
                    success: false,
                    message: `Employee must be with company for 3+ months to request annual leave. Current: ${monthsWithCompany} months`,
                    messageTh: `พนักงานต้องทำงานกับบริษัทอย่างน้อย 3 เดือนเพื่อขอลาปี ปัจจุบัน: ${monthsWithCompany} เดือน`,
                    eligibleForAnnualLeave: false,
                    monthsWithCompany: monthsWithCompany,
                    requiredMonths: 3
                });
            }
        }
       


        // Support legacy / snake_case payload keys from the client
        if (!workingShift) workingShift = req.body.working_shift || req.body.shiftName || req.body.shift_name || workingShift;
        if (!startTime) startTime = req.body.start_time || startTime;
        if (!endTime) endTime = req.body.end_time || endTime;
        if (!shiftId) shiftId = req.body.shift_id || shiftId;
        if (!shiftName) shiftName = req.body.shift_name || shiftName;
        if (!date) date = req.body.date || req.body.fromDate || date;

        // Normalize attachments array into legacy attachment field
        // Handle both single attachment (string) and multiple attachments (array)
        if (!attachment && attachments) {
            if (Array.isArray(attachments) && attachments.length > 0) {
                attachment = attachments;
            } else if (typeof attachments === 'string' && attachments.length > 0) {
                attachment = [attachments];
            }
        }
        
        // Log attachment info for debugging
        if (attachment || attachments) {
            console.log('📎 Attachments received:', {
                hasAttachment: !!attachment,
                hasAttachments: !!attachments,
                attachmentType: attachment ? (Array.isArray(attachment) ? 'array' : typeof attachment) : 'none',
                attachmentsType: attachments ? (Array.isArray(attachments) ? 'array' : typeof attachments) : 'none',
                isMultipart: !!(req.files && req.files.length > 0),
                contentType: req.headers['content-type']
            });
        }

        if (!['daily', 'hourly'].includes(requestType)) {
            return res.status(400).json({ 
                success: false,
                message: "Request type must be 'daily' or 'hourly'" 
            });
        }

        // Validate daily leave
        if (requestType === 'daily') {
            if (!fromDate || !toDate) {
                return res.status(400).json({ 
                    success: false,
                    message: "From date and to date are required for daily leave" ,
                    messageTh: "วันที่เริ่มต้นและวันที่สิ้นสุดของการลาจำเป็น"
                });
            }
        }

        // Validate hourly leave
        if (requestType === 'hourly') {
            if (!date || !workingShift || !startTime || !endTime) {
                return res.status(400).json({ 
                    success: false,
                    message: "Date, working shift, start time, and end time are required for hourly leave" 
                });
            }
        }

        // Calculate total days for daily leave
        let totalDays = 0;
        if (requestType === 'daily') {
            const start = new Date(fromDate);
            const end = new Date(toDate);
            const timeDiff = end.getTime() - start.getTime();
            totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end dates
        }
        
        // Calculate total hours and days for hourly leave
        let totalHours = 0;
        if (requestType === 'hourly') {
            if (startTime && endTime) {
                // Helper function to convert time string to minutes
                const timeToMinutes = (timeString) => {
                    const parts = timeString.split(':');
                    const hours = parseInt(parts[0], 10);
                    const minutes = parseInt(parts[1], 10);
                    return hours * 60 + minutes;
                };
                
                const startMinutes = timeToMinutes(startTime);
                const endMinutes = timeToMinutes(endTime);
                totalHours = (endMinutes - startMinutes) / 60; // Total hours
                
                // Determine hours per day based on position
                let hoursPerDay = 9; // Default: 9 hours = 1 day for others
                
                if (positionName === "Programmer") {
                    hoursPerDay = 10; // Programmer: 10 hours = 1 day
                } else if (positionName === "Salesman" || positionName === "Manager") {
                    hoursPerDay = 8; // Salesman and Manager: 8 hours = 1 day
                } else {
                    hoursPerDay = 9; // Others: 9 hours = 1 day
                }
                
                // Calculate days based on position-specific hours
                // Round to 2 decimal places
                totalDays = Math.round((totalHours / hoursPerDay) * 100) / 100;
                
                console.log(`Hourly leave calculation for ${positionName}: ${startTime} to ${endTime} = ${totalHours} hours = ${totalDays} days (${hoursPerDay} hours/day)`);
            }
        }

        // Log basic incoming request summary
        console.log(`📝 Create leave request: employeeId=${employeeId}, name=${employeeName}, type=${requestType}, leaveType=${leaveTypeName} (${leaveType}), position=${positionName}, dates=${fromDate || date || ''}~${toDate || ''}, times=${startTime || ''}-${endTime || ''}`);

       
        try {
            
            let hoursPerDayForValidation = 9;
            if (positionName === "Programmer") {
                hoursPerDayForValidation = 10;
            } else if (positionName === "Salesman" || positionName === "Manager") {
                hoursPerDayForValidation = 8;
            }

            // Figure out request year for balance scope
            const requestYear = (requestType === 'hourly'
                ? (date || requestDate || new Date().toISOString().slice(0, 10))
                : (fromDate || requestDate || new Date().toISOString().slice(0, 10))
            ).slice(0, 4);

            // Load leave type quota
            const leaveSettingSnap = await db.collection("leave-settings").doc(leaveType).get();
            let leaveSettingData = null;
            if (leaveSettingSnap.exists) {
                leaveSettingData = leaveSettingSnap.data();
                if (!leaveTypeName) {
                    leaveTypeName = leaveSettingData.leaveTypeName || leaveSettingData.leave || leaveSettingData.title || leaveTypeName;
                }
                if (!leaveTypeNameEng) {
                    leaveTypeNameEng = leaveSettingData.leaveTypeNameEng || leaveSettingData.titleEng || leaveTypeNameEng;
                }
            }
            const maxDays = leaveSettingData ? (leaveSettingData.leaveDay || 0) : 0;
            
            // ✅ Check warningDays validation - must request at least warningDays before start date
            const warningDays = leaveSettingData ? (leaveSettingData.warningDays || 0) : 0;
            if (warningDays > 0) {
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
                
                let startDate = null;
                if (requestType === 'daily') {
                    if (!fromDate) {
                        return res.status(400).json({
                            success: false,
                            message: "From date is required for daily leave"
                        });
                    }
                    startDate = new Date(fromDate);
                } else if (requestType === 'hourly') {
                    if (!date) {
                        return res.status(400).json({
                            success: false,
                            message: "Date is required for hourly leave"
                        });
                    }
                    startDate = new Date(date);
                }
                
                if (startDate) {
                    startDate.setHours(0, 0, 0, 0); // Set to start of day
                    const daysDifference = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    
                    if (daysDifference < warningDays) {
                        console.warn(`⚠️ WARNING_DAYS_VALIDATION: Request submitted ${daysDifference} day(s) before start date, but warningDays is ${warningDays}`);
                        return res.status(400).json({
                            success: false,
                            code: "WARNING_DAYS_VALIDATION",
                            message: `Leave request must be submitted at least ${warningDays} day(s) before the start date. You are submitting ${daysDifference} day(s) before.`,
                            messageTh: `คำขอลาต้องส่งก่อนวันเริ่มต้นอย่างน้อย ${warningDays} วัน คุณกำลังส่งก่อน ${daysDifference} วัน`,
                            warningDays: warningDays,
                            daysBeforeStart: daysDifference,
                            requiredDaysBefore: warningDays,
                            startDate: requestType === 'daily' ? fromDate : date
                        });
                    }
                }
            }

            // Sum approved used days for this employee, leaveType, and year
            const approvedSnap = await db.collection("employee-leave")
                .where("employeeId", "==", employeeId)
                .where("leaveType", "==", leaveType)
                .where("status", "==", "approved")
                .get();

            let usedDays = 0;
            approvedSnap.forEach(doc => {
                const r = doc.data();
                const rDate = r.fromDate || r.date || r.requestDate || '';
                if (typeof rDate === 'string' && rDate.startsWith(requestYear)) {
                    usedDays += (r.totalDays || 0);
                }
            });

            const remainingDays = Math.max(0, (parseFloat(maxDays) || 0) - usedDays);
            const remainingHours = Math.round(remainingDays * hoursPerDayForValidation * 100) / 100;

            if (requestType === 'daily') {
                const requestedDays = totalDays;
                if (requestedDays > remainingDays) {
                    console.warn(`⚠️ INSUFFICIENT_BALANCE (daily): requestedDays=${requestedDays}, remainingDays=${remainingDays}, hoursPerDay=${hoursPerDayForValidation}, employeeId=${employeeId}, leaveType=${leaveType}`);
                    return res.status(400).json({
                        success: false,
                        code: "INSUFFICIENT_BALANCE",
                        message: `Requested ${requestedDays} days exceeds remaining ${remainingDays} days`,
                        messageTh: `คำขอ ${requestedDays} วันเกินจาก ${remainingDays} วันที่เหลือ`,
                        positionName,
                        hoursPerDay: hoursPerDayForValidation,
                        requestedDays,
                        remainingDays,
                        remainingHours,
                        canSplit: remainingDays > 0,
                        suggestedDays: remainingDays
                    });
                }
            } else if (requestType === 'hourly') {
                const requestedHours = Math.round(totalHours * 100) / 100;
                if (requestedHours > remainingHours) {
                    console.warn(`⚠️ INSUFFICIENT_BALANCE (hourly): requestedHours=${requestedHours}, remainingHours=${remainingHours}, requestedDays=${totalDays}, hoursPerDay=${hoursPerDayForValidation}, employeeId=${employeeId}, leaveType=${leaveType}`);
                    return res.status(400).json({
                        success: false,
                        code: "INSUFFICIENT_BALANCE",
                        message: `Requested ${requestedHours} hours exceeds remaining ${remainingHours} hours`,
                        messageTh: `คำขอ ${requestedHours} ชั่วโมงเกินจาก ${remainingHours} ชั่วโมงที่เหลือ`,
                        positionName,
                        hoursPerDay: hoursPerDayForValidation,
                        requestedHours,
                        requestedDays: totalDays,
                        remainingDays,
                        remainingHours,
                        canSplit: remainingHours > 0,
                        suggestedHours: remainingHours,
                        suggestedDays: remainingDays
                    });
                }
            }
        } catch (balanceErr) {
            console.error("⚠️ Balance validation failed (continuing as safe default):", balanceErr);
            // If balance check fails, continue to create request to avoid blocking usage,
            // approvers can still reject. Optionally, you can return 500 here instead.
        }

        // Generate unique leave request ID and UUID v4
        const leaveRequestId = uuidv4();

        // Handle file uploads and attachments
        let attachmentData = null;
        if (req.files && req.files.length > 0) {
            // Handle multipart file uploads (files sent as form data)
            try {
                const uploadedFiles = [];
                for (const file of req.files) {
                    const uploadResult = await uploadFileToStorage(file, leaveRequestId, employeeId);
                    uploadedFiles.push(uploadResult);
                }
                attachmentData = {
                    files: uploadedFiles,
                    count: uploadedFiles.length,
                    uploadedAt: new Date().toISOString()
                };
            } catch (uploadError) {
                console.error("❌ File upload failed:", uploadError);
                return res.status(500).json({
                    success: false,
                    message: "File upload failed",
                    error: uploadError.message
                });
            }
        } else if (attachment) {
            // Handle attachments as Firebase Storage URLs (from JSON body)
            if (Array.isArray(attachment)) {
                // Array of URLs
                attachmentData = {
                    files: attachment.map(url => ({
                        url: url,
                        name: url.split('/').pop() || 'attachment',
                        uploadedAt: new Date().toISOString()
                    })),
                    count: attachment.length,
                    uploadedAt: new Date().toISOString()
                };
            } else if (typeof attachment === 'string') {
                // Single URL string
                attachmentData = {
                    files: [{
                        url: attachment,
                        name: attachment.split('/').pop() || 'attachment',
                        uploadedAt: new Date().toISOString()
                    }],
                    count: 1,
                    uploadedAt: new Date().toISOString()
                };
            } else {
                // Legacy format (object or other)
                attachmentData = attachment;
            }
        }

        // Get employee data ONCE (reuse for company/location/branch AND role)
        const employeeDoc = await loadEmployeeDoc();
        
        // Use provided company/location/branch data, with fallback to employee data
        let finalCompany = company;
        let finalCompanyName = companyName;
        let finalLocation = location;
        let finalLocationName = locationName;
        let finalBranch = branch;
        let finalBranchName = branchName;
        
        // Fallback: Use employee data if company/location/branch not provided
        if (employeeDoc) {
            finalCompany = finalCompany || employeeDoc.company || "NANO";
            finalCompanyName = finalCompanyName || employeeDoc.companyName || "NANO Company";
            finalLocation = finalLocation || employeeDoc.location || "BKK";
            finalLocationName = finalLocationName || employeeDoc.locationName || "Bangkok";
            finalBranch = finalBranch || employeeDoc.branch || "001";
            finalBranchName = finalBranchName || employeeDoc.branchName || "Main Branch";
        } else {
            // Ultimate fallback
            finalCompany = finalCompany || "NANO";
            finalCompanyName = finalCompanyName || "NANO Company";
            finalLocation = finalLocation || "BKK";
            finalLocationName = finalLocationName || "Bangkok";
            finalBranch = finalBranch || "001";
            finalBranchName = finalBranchName || "Main Branch";
        }

        // Get employee role from the same document we already fetched
        const employeeRole = employeeDoc?.role || null;
        
        // Determine first approver based on requester's position/role
        // This prevents people from approving their own leave requests
        let firstApprover = "manager";  // Default for regular employees
        let initialStatus = "pending";
        let initialStatusName = "Pending";
        
        console.log(`🔍 Leave routing for positionName: "${positionName}", role: "${employeeRole}", company: "${finalCompany}"`);
        
        // Check if company is nano-vip - all requests go directly to HR, HR is final approver
        const isNanoVip = (finalCompany && (finalCompany.toLowerCase() === "nano-vip" || finalCompany.toLowerCase().includes("nano-vip"))) ||
                         (finalCompanyName && finalCompanyName.toLowerCase().includes("nano-vip"));
        
        if (isNanoVip) {
            // nano-vip employees: Employee → HR (directly) → Fully Approved (HR is final)
            firstApprover = "hr";
            console.log(`✅ nano-vip company detected → Direct to HR (HR is final approver)`);
        } else if (employeeRole === "approver" || employeeRole === "approver-three") {
            // Check if requester is a final approver (highest level)
            // Approver requests leave → Auto-approve (no one above them)
            firstApprover = null;
            initialStatus = "approved";
            initialStatusName = "Approved";
            console.log(`✅ Auto-approved (Approver role)`);
        } else if (positionName === "Manager") {
            
            firstApprover = "hr";
            console.log(`✅ Manager → HR`);
        } else if (positionName === "Warehouse Manager") {
            // Warehouse Manager requests leave → Go to HR directly (similar to Manager)
            firstApprover = "hr";
            console.log(`✅ Warehouse Manager → HR`);
        } else if (positionName === "HR") {
            // HR requests leave → Skip both manager and HR, go to final approver
            firstApprover = "approver";
            console.log(`✅ HR → Approver`);
        } else if (positionName === "Programmer (Team Lead)") {
            // Team Lead requests leave → Skip team-lead level, go to HR directly
            firstApprover = "hr";
            console.log(`✅ Team Lead → HR`);
        } else if (positionName === "Programmer") {
            // Programmer → Go to Team Lead first
            firstApprover = "team-lead";
            console.log(`✅ Programmer → Team Lead`);
        } else if (positionName === "Salesman") {
            // Salesman → Go through manager approval
            firstApprover = "manager";
            console.log(`✅ Salesman → Manager`);
        } else if (positionName === "Warehouse Worker" || positionName === "Warehouse Administrator") {
            // Warehouse Worker/Administrator → Go to Warehouse Manager first
            firstApprover = "warehouse-manager";
            console.log(`✅ ${positionName} → Warehouse Manager`);
        } else {
            // Other positions → Skip manager, go to HR directly
            firstApprover = "hr";
            console.log(`✅ Other position (${positionName}) → HR`);
        }
        
        console.log(`📤 firstApprover set to: "${firstApprover}"`);


        // Create leave request data
        const currentDateTime = new Date().toISOString();
        const leaveRequestData = {
            id: leaveRequestId,
            uid: leaveRequestId,
            employeeId: employeeId,
            employeeName: employeeName,
            firstName: firstName,
            lastName: lastName,
            positionName: positionName,
            company: finalCompany,           // Store company code
            companyName: finalCompanyName,   // Store company name
            location: finalLocation,         // Store location code
            locationName: finalLocationName, // Store location name
            branch: finalBranch,             // Store branch code
            branchName: finalBranchName,     // Store branch name
            branchCode: finalBranch,         // Legacy compatibility
            requestDate: requestDate || currentDateTime.split('T')[0], // Use provided date or current date (YYYY-MM-DD)
            leaveType: leaveType,
            leaveTypeName: leaveTypeName,
            leaveTypeNameEng: leaveTypeNameEng,
            requestType: requestType,
            reason: reason,
            attachment: attachmentData,
            isHalfDay: Boolean(isHalfDay),
            halfDayType: Boolean(isHalfDay) ? (halfDayType || 'morning') : null,
            status: initialStatus,
            statusName: initialStatusName,
            // Approval workflow fields
            approvalLevel: "employee",
            currentApprover: firstApprover,  // Smart routing based on position
            createdAt: currentDateTime,
            updatedAt: currentDateTime
        };

        // Add daily leave specific fields
        if (requestType === 'daily') {
            leaveRequestData.fromDate = fromDate;
            leaveRequestData.toDate = toDate;
            leaveRequestData.totalDays = totalDays;
        }

        // Add hourly leave specific fields
        if (requestType === 'hourly') {
            leaveRequestData.date = date;
            leaveRequestData.workingShift = workingShift;
            leaveRequestData.startTime = startTime;
            leaveRequestData.endTime = endTime;
            if (shiftId) leaveRequestData.shiftId = shiftId;
            if (shiftName) leaveRequestData.shiftName = shiftName;
            leaveRequestData.totalHours = totalHours; // Total hours taken
            leaveRequestData.totalDays = totalDays; // Hours converted to days (8 hours = 1 day)
        }

        // Save to Firestore using custom document ID
        const leaveRequestRef = db.collection("employee-leave").doc(leaveRequestId);
        await leaveRequestRef.set(leaveRequestData);
        const leaveRequestDoc = await leaveRequestRef.get();
        const savedLeaveRequest = leaveRequestDoc.data();


        console.log(`✅ Leave request created: id=${savedLeaveRequest.id}, employeeId=${savedLeaveRequest.employeeId}, type=${savedLeaveRequest.requestType}, totalDays=${savedLeaveRequest.totalDays}, totalHours=${savedLeaveRequest.totalHours || 0}`);

        // ✅ CRITICAL FIX: Send notifications BEFORE response
        // On Vercel serverless, functions terminate after response, killing background work
        // Sending notifications first ensures they complete before function ends
        // Skip notification if auto-approved (firstApprover is null)
        if (firstApprover !== null) {
            try {
                console.log(`📨 [NOTIFICATION] Starting notification process for ${firstApprover}...`);
                const employeeDisplayName = employeeName || [firstName, lastName].filter(Boolean).join(' ').trim() || employeeId;
                const notificationFromDate = requestType === 'hourly' ? (date || fromDate) : fromDate;
                const notificationToDate = requestType === 'hourly' ? (date || toDate) : toDate;
                const { title: approverTitle, message: approverMessage } = buildApproverNotificationContent(firstApprover, {
                    employeeName: employeeDisplayName,
                    leaveTypeName,
                    leaveTypeNameEng,
                    fromDate: notificationFromDate,
                    toDate: notificationToDate
                });
                
                const approverIds = await findApproverIdsByLevel(firstApprover, employeeId, finalBranch, finalBranchName);
                console.log(`📨 [NOTIFICATION] Found ${approverIds.length} approver(s) for level "${firstApprover}"`);
                
                if (approverIds.length > 0) {
                    // Fetch all approver data once to get device tokens
                    const approverDocs = await Promise.all(
                        approverIds.map(async (approverId) => {
                            const approverRef = await findEmployeeDocRef(approverId);
                            if (approverRef) {
                                const doc = await approverRef.get();
                                if (doc.exists) {
                                    return { id: approverId, data: doc.data() };
                                }
                            }
                            return { id: approverId, data: null };
                        })
                    );
                    
                    // Send notifications to all approvers (await to ensure they're sent)
                    const notificationPromises = approverDocs
                        .filter(({ data }) => data !== null)
                        .map(({ id: approverId, data: approverData }) => {
                            console.log(`📨 [NOTIFICATION] Sending notification to ${approverId}...`);
                            return sendLeaveRequestNotificationToApprover(approverId, {
                                title: approverTitle,
                                message: approverMessage,
                                employeeId: employeeId,
                                employeeName: employeeDisplayName,
                                leaveRequestId: leaveRequestId,
                                leaveType: leaveTypeName || leaveType,
                                leaveTypeNameEng: leaveTypeNameEng,
                                fromDate: notificationFromDate || notificationToDate,
                                toDate: notificationToDate || notificationFromDate,
                                reason: reason
                            }, approverData.deviceTokens || []).then(result => {
                                console.log(`✅ [NOTIFICATION] Notification sent to ${approverId}:`, result.success ? 'SUCCESS' : 'FAILED');
                                return result;
                            }).catch(notifError => {
                                console.error(`❌ [NOTIFICATION] Failed to send to ${approverId}:`, notifError.message);
                                return { success: false, error: notifError.message };
                            });
                        });
                    
                    // Wait for all notifications to be sent (with timeout to prevent hanging)
                    await Promise.allSettled(notificationPromises);
                    console.log(`✅ [NOTIFICATION] All notifications processed`);
                } else {
                    console.warn(`⚠️ No approvers found for level ${firstApprover} when creating leave request ${leaveRequestId}`);
                }
            } catch (notifError) {
                console.error("❌ [NOTIFICATION] Error sending notification:", notifError);
                // Don't fail the request if notifications fail
            }
        } else {
            console.log(`✅ [NOTIFICATION] Leave request auto-approved, no notification needed`);
        }

        // Send response AFTER notifications are sent
        // This ensures notifications complete before Vercel function terminates
        res.json({
            success: true,
            message: "Leave request created successfully",
            messageTh: "คำขอลาสำเร็จสร้างแล้ว",
            leaveRequest: {
                id: savedLeaveRequest.id,
                uid: savedLeaveRequest.uid,
                employeeId: savedLeaveRequest.employeeId,
                leaveType: savedLeaveRequest.leaveType,
                leaveTypeName: savedLeaveRequest.leaveTypeName,
                leaveTypeNameEng: savedLeaveRequest.leaveTypeNameEng,
                requestType: savedLeaveRequest.requestType,
                isHalfDay: savedLeaveRequest.isHalfDay || false,
                halfDayType: savedLeaveRequest.halfDayType || null,
                reason: savedLeaveRequest.reason,
                attachment: savedLeaveRequest.attachment,
                status: savedLeaveRequest.status,
                statusName: savedLeaveRequest.statusName,
                totalDays: savedLeaveRequest.totalDays,
                createdAt: savedLeaveRequest.createdAt,
                updatedAt: savedLeaveRequest.updatedAt,
                // Daily leave fields
                ...(requestType === 'daily' && {
                    fromDate: savedLeaveRequest.fromDate,
                    toDate: savedLeaveRequest.toDate
                }),
                // Hourly leave fields
                ...(requestType === 'hourly' && {
                    date: savedLeaveRequest.date,
                    workingShift: savedLeaveRequest.workingShift || savedLeaveRequest.shiftName || null,
                    shiftId: savedLeaveRequest.shiftId || null,
                    shiftName: savedLeaveRequest.shiftName || null,
                    startTime: savedLeaveRequest.startTime,
                    endTime: savedLeaveRequest.endTime,
                    totalHours: savedLeaveRequest.totalHours || 0
                })
            }
        });

    } catch (error) {
        console.error("❌ Error creating leave request:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Get all leave requests (for admin/HR)
const getAllLeaveRequests = async (req, res) => {
    try {
        const { status, employeeId, page = 1, limit = 10 } = req.query;
        
        let query = db.collection("employee-leave");
        
        // Apply filters
        if (status) {
            query = query.where("status", "==", status);
        }
        
        if (employeeId) {
            query = query.where("employeeId", "==", employeeId);
        }
        
        // Order by created date (newest first)
        query = query.orderBy("createdAt", "desc");
        
        const snapshot = await query.get();
        
        if (snapshot.empty) {
            return res.json({
                success: true,
                message: "No leave requests found",
                messageTh: "ไม่พบคำขอลา",
                data: [],
                count: 0,
                totalPages: 0,
                currentPage: parseInt(page)
            });
        }

        const leaveRequests = [];
        snapshot.forEach(doc => {
            const leaveData = doc.data();
            leaveRequests.push({
                id: doc.id,
                uid: leaveData.uid,
                employeeId: leaveData.employeeId,
                leaveType: leaveData.leaveType,
                leaveTypeName: leaveData.leaveTypeName,
                leaveTypeNameEng: leaveData.leaveTypeNameEng,
                requestType: leaveData.requestType,
                isHalfDay: leaveData.isHalfDay || false,
                halfDayType: leaveData.halfDayType || null,
                reason: leaveData.reason,
                status: leaveData.status,
                statusName: leaveData.statusName,
                totalHours: leaveData.totalHours || 0,
                totalDays: leaveData.totalDays,
                createdAt: leaveData.createdAt,
                updatedAt: leaveData.updatedAt,
                // Daily leave fields
                ...(leaveData.requestType === 'daily' && {
                    fromDate: leaveData.fromDate,
                    toDate: leaveData.toDate
                }),
                // Hourly leave fields
                ...(leaveData.requestType === 'hourly' && {
                    date: leaveData.date,
                    workingShift: leaveData.workingShift || leaveData.shiftName || null,
                    shiftId: leaveData.shiftId || null,
                    shiftName: leaveData.shiftName || null,
                    startTime: leaveData.startTime,
                    endTime: leaveData.endTime
                })
            });
        });

        // Pagination
        const totalRecords = leaveRequests.length;
        const totalPages = Math.ceil(totalRecords / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedData = leaveRequests.slice(startIndex, endIndex);

        res.json({
            success: true,
            message: "Leave requests retrieved successfully",
            messageTh: "คำขอลาของพนักงานของคุณ",
            count: paginatedData.length,
            totalRecords: totalRecords,
            totalPages: totalPages,
            currentPage: parseInt(page),
            data: paginatedData
        });

    } catch (error) {
        console.error("❌ Error getting all leave requests:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};


// Update leave request status (approve/reject)
const updateLeaveRequestStatus = async (req, res) => {
    try {
        const { leaveId } = req.params;
        const { status, approvedBy, rejectedReason } = req.body;
        
        if (!leaveId || !status) {
            return res.status(400).json({ 
                success: false,
                message: "Leave ID and status are required" 
            });
        }

        if (!['approved', 'rejected', 'pending'].includes(status)) {
            return res.status(400).json({ 
                success: false,
                message: "Status must be 'approved', 'rejected', or 'pending'" 
            });
        }

        if (status === 'approved' && !approvedBy) {
            return res.status(400).json({ 
                success: false,
                message: "Approver employee ID is required for approval" 
            });
        }

        // Get the leave request
        const leaveRequestRef = db.collection("employee-leave").doc(leaveId);
        const leaveRequestDoc = await leaveRequestRef.get();
        
        if (!leaveRequestDoc.exists) {
            return res.status(404).json({ 
                success: false,
                message: "Leave request not found" 
            });
        }

        const leaveData = leaveRequestDoc.data();
        
        // Update the leave request
        const updateData = {
            status: status,
            statusName: status.charAt(0).toUpperCase() + status.slice(1),
            updatedAt: new Date().toISOString()
        };

        if (status === 'approved') {
            updateData.approvedBy = approvedBy; // Store employee ID of approver
            updateData.approvedDate = new Date().toISOString();
            
            // Determine specific approval status based on approver role
            const employeesRef = db.collection("employees");
            const approverQuery = await employeesRef.where("uid", "==", approvedBy).get();
            
            if (!approverQuery.empty) {
                const approverData = approverQuery.docs[0].data();
                const approverPosition = approverData.positionName;
                
                // Set specific status based on approver role
                if (approverPosition === 'Manager') {
                    updateData.status = 'approved_manager';
                    updateData.statusName = 'Approved by Manager';
                } else if (approverPosition === 'HR') {
                    updateData.status = 'approved_hr';
                    updateData.statusName = 'Approved by HR';
                } else {
                    // Final approver or other roles
                    updateData.status = 'approved';
                    updateData.statusName = 'Approved';
                }
                
            } else {
                // Fallback if approver not found
                updateData.status = 'approved';
                updateData.statusName = 'Approved';
            }
        }

        if (status === 'rejected') {
            updateData.rejectedBy = approvedBy; // Store employee ID of rejecter
            updateData.rejectedDate = new Date().toISOString();
            updateData.rejectedReason = rejectedReason || null; // Store rejection reason
            
            // Determine rejecter's role/position
            const employeesRef = db.collection("employees");
            const rejecterQuery = await employeesRef.where("uid", "==", approvedBy).get();
            
            if (!rejecterQuery.empty) {
                const rejecterData = rejecterQuery.docs[0].data();
                const rejecterPosition = rejecterData.positionName;
                const rejecterRole = rejecterData.role;
                
                // Determine rejection role based on position or role
                if (rejecterPosition === 'Manager') {
                    updateData.rejectedByRole = 'manager';
                } else if (rejecterPosition === 'HR') {
                    updateData.rejectedByRole = 'hr';
                } else if (rejecterPosition === 'Warehouse Manager') {
                    updateData.rejectedByRole = 'warehouse-manager';
                } else if (rejecterPosition === 'Programmer (Team Lead)') {
                    updateData.rejectedByRole = 'team-lead';
                } else if (rejecterRole === 'approver' || rejecterRole === 'approver-three') {
                    updateData.rejectedByRole = 'approver';
                } else {
                    updateData.rejectedByRole = rejecterPosition || rejecterRole || 'unknown';
                }
            } else {
                updateData.rejectedByRole = 'unknown';
            }
        }

        await leaveRequestRef.update(updateData);


        // ✅ CRITICAL FIX: Send notification to employee BEFORE response
        // On Vercel serverless, functions terminate after response, killing background work
        // Sending notifications first ensures they complete before function ends
        try {
            const employeeStatusForChannel = updateData.status || status;
            console.log(`📨 [UPDATE STATUS] Starting notification to requester ${leaveData.employeeId}...`);
            
            await sendLeaveStatusNotification({
                body: {
                    employeeId: leaveData.employeeId,
                    leaveRequestId: leaveId,
                    status: status,
                    approvedBy: approvedBy,
                    rejectReason: status === 'rejected' ? (rejectedReason || '') : undefined,
                    reason: status === 'rejected' ? (rejectedReason || '') : '',
                    leaveType: leaveData.leaveTypeName,
                    fromDate: leaveData.fromDate,
                    toDate: leaveData.toDate,
                    employeeName: leaveData.employeeName, // From stored data
                    firstName: leaveData.firstName,       // From stored data
                    lastName: leaveData.lastName,         // From stored data
                    positionName: leaveData.positionName, // From stored data
                    channels: getEmployeeNotificationChannels(employeeStatusForChannel) // Only FREE channels
                }
            }, {
                json: () => {}
            });
            
            console.log(`✅ [UPDATE STATUS] Notification sent to requester ${leaveData.employeeId}`);
        } catch (notifError) {
            console.error(`❌ Failed to send ${status} notification to employee:`, notifError);
            // Don't fail the request if notifications fail
        }

        // If approved by manager, also notify HR
        if (updateData.status === 'approved_manager') {
            try {
                // Get approver data to check if they are a manager
                const employeesRef = db.collection("employees");
                const approverQuery = await employeesRef.where("uid", "==", approvedBy).get();
                
                if (!approverQuery.empty) {
                    const approverData = approverQuery.docs[0].data();
                    
                    if (approverData.positionName === 'Manager') {
                        
                        // Find HR personnel
                        const hrQuery = await employeesRef.where("positionName", "==", "HR").get();
                        
                        if (!hrQuery.empty) {
                            hrQuery.forEach(hrDoc => {
                                const hrData = hrDoc.data();
                                // Ensure recipientId is correct
                                
                                // Create HR notification
                                const titleTh = `การแจ้งเตือนการขอลา`;
                                const messageTh = `${safeEmployeeName} ส่งคำขอ ${leaveLabel} ${rangeText}. กรุณาตรวจสอบ.`;
                                createInAppNotification(
                                    hrData.uid,
                                    'Leave Request Notification',
                                    `${safeEmployeeName} submitted a ${leaveLabel} request ${rangeText}. Please check it out.`,
                                    'leave_approved_by_manager',
                                    {
                                        leaveRequestId: leaveId, // Include leave request ID for navigation
                                        employeeId: leaveData.employeeId,
                                        managerId: approvedBy,
                                        managerName: `${approverData.firstName} ${approverData.lastName}`,
                                        leaveType: leaveData.leaveTypeName,
                                        fromDate: leaveData.fromDate,
                                        toDate: leaveData.toDate
                                    },
                                    titleTh,
                                    messageTh
                                ).catch(hrNotifError => {
                                    console.error(`❌ Failed to send HR notification:`, hrNotifError);
                                });
                            });
                        }
                    }
                }
            } catch (hrNotifError) {
                console.error("❌ Error sending HR notifications:", hrNotifError);
            }
        }

        res.json({
            success: true,
            message: `Leave request ${status} successfully`,
            leaveRequest: {
                id: leaveId,
                status: status,
                statusName: updateData.statusName,
                approvedBy: updateData.approvedBy,
                approvedDate: updateData.approvedDate,
                rejectedBy: updateData.rejectedBy,
                rejectedDate: updateData.rejectedDate,
                rejectedReason: updateData.rejectedReason,
                updatedAt: updateData.updatedAt
            }
        });

    } catch (error) {
        console.error("❌ Error updating leave request status:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Get leave request by ID
const getLeaveRequestById = async (req, res) => {
    try {
        const { leaveId } = req.params;
        
        if (!leaveId) {
            return res.status(400).json({ 
                success: false,
                message: "Leave ID is required" 
            });
        }

        const leaveRequestRef = db.collection("employee-leave").doc(leaveId);
        const leaveRequestDoc = await leaveRequestRef.get();
        
        if (!leaveRequestDoc.exists) {
            return res.status(404).json({ 
                success: false,
                message: "Leave request not found" 
            });
        }

        const leaveData = leaveRequestDoc.data();

        // Handle rejectedBy fields with multiple field name variations
        // Check for: rejectedBy, rejected_by, rejectedById, rejected_by_id, rejecterId, rejecter_id
        const rejectedById = leaveData.rejectedBy || 
                            leaveData.rejected_by || 
                            leaveData.rejectedById || 
                            leaveData.rejected_by_id || 
                            leaveData.rejecterId || 
                            leaveData.rejecter_id || 
                            null;

        // Check for existing name fields: rejectedByName, rejected_by_name, rejecterName, rejecter_name
        let rejectedByName = leaveData.rejectedByName || 
                            leaveData.rejected_by_name || 
                            leaveData.rejecterName || 
                            leaveData.rejecter_name || 
                            null;

        // If we have an ID but no name, fetch the rejecter's information
        if (rejectedById && !rejectedByName && typeof rejectedById === 'string' && rejectedById.trim() !== '') {
            try {
                const employeesRef = db.collection("employees");
                // Try querying by uid first (most common case)
                let rejecterQuery = await employeesRef.where("uid", "==", rejectedById).get();
                
                // If not found by uid, try querying by employeeId as fallback
                if (rejecterQuery.empty) {
                    rejecterQuery = await employeesRef.where("employeeId", "==", rejectedById).get();
                }
                
                if (!rejecterQuery.empty) {
                    const rejecterData = rejecterQuery.docs[0].data();
                    // Try to get full name, or construct from firstName/lastName
                    rejectedByName = rejecterData.employeeName || 
                                    rejecterData.employee_name ||
                                    rejecterData.name ||
                                    (rejecterData.firstName && rejecterData.lastName 
                                        ? `${rejecterData.firstName} ${rejecterData.lastName}`.trim()
                                        : rejecterData.firstName || rejecterData.lastName || null);
                }
            } catch (fetchError) {
                console.error("❌ Error fetching rejecter information:", fetchError);
                // Continue without name if fetch fails
            }
        }

        res.json({
            success: true,
            message: "Leave request retrieved successfully",
            leaveRequest: {
                id: leaveRequestDoc.id,
                uid: leaveData.uid,
                employeeId: leaveData.employeeId,
                positionName: leaveData.positionName || null,
                leaveType: leaveData.leaveType,
                leaveTypeName: leaveData.leaveTypeName,
                leaveTypeNameEng: leaveData.leaveTypeNameEng,
                requestType: leaveData.requestType,
                isHalfDay: leaveData.isHalfDay || false,
                halfDayType: leaveData.halfDayType || null,
                reason: leaveData.reason,
                attachment: leaveData.attachment,
                status: leaveData.status,
                statusName: leaveData.statusName,
                totalHours: leaveData.totalHours || 0,
                totalDays: leaveData.totalDays,
                approvedBy: leaveData.approvedBy,
                approvedDate: leaveData.approvedDate,
                rejectedBy: rejectedById,
                rejectedByName: rejectedByName,
                rejectedByRole: leaveData.rejectedByRole || null,
                rejectedDate: leaveData.rejectedDate || null,
                rejectedReason: leaveData.rejectedReason,
                approvalHistory: leaveData.approvalHistory || [],
                createdAt: leaveData.createdAt,
                updatedAt: leaveData.updatedAt,
                // Daily leave fields
                ...(leaveData.requestType === 'daily' && {
                    fromDate: leaveData.fromDate,
                    toDate: leaveData.toDate
                }),
                // Hourly leave fields
                ...(leaveData.requestType === 'hourly' && {
                    date: leaveData.date,
                    workingShift: leaveData.workingShift || leaveData.shiftName || null,
                    shiftId: leaveData.shiftId || null,
                    shiftName: leaveData.shiftName || null,
                    startTime: leaveData.startTime,
                    endTime: leaveData.endTime
                })
            }
        });

    } catch (error) {
        console.error("❌ Error getting leave request by ID:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Get leave requests by approval level and branch
const getLeaveRequestsByApprovalLevel = async (req, res) => {
    try {
        const { level, branchCode, userId } = req.query;
        
        
        // For managers, automatically get their managed branches
        let managedBranches = [];
        if (level === "manager" && userId) {
            try {
                const employeesRef = db.collection("employees");
                const managerQuery = await employeesRef.where("uid", "==", userId).get();
                
                if (!managerQuery.empty) {
                    const managerData = managerQuery.docs[0].data();
                    managedBranches = Array.isArray(managerData.managedBranches) ? managerData.managedBranches : [];
                    
                    console.log(`🔍 Manager ${userId} data:`);
                    console.log(`   branch: ${managerData.branch}`);
                    console.log(`   branchName: ${managerData.branchName || 'N/A'}`);
                    console.log(`   managedBranches (raw): [${managedBranches.join(', ')}]`);
                    
                    // Fallback: if no managedBranches, extract branch name from branchName
                    // Example: "002 Thepharak" → "thepharak"
                    if (managedBranches.length === 0) {
                        if (managerData.branchName) {
                            // Extract the branch name part (after the code)
                            // "002 Thepharak" → "thepharak"
                            // "005 Srinagarindra" → "srinagarindra"
                            const branchNameParts = String(managerData.branchName).trim().split(/\s+/);
                            if (branchNameParts.length > 1) {
                                // Take everything after the first part (branch code)
                                const extractedBranchName = branchNameParts.slice(1).join(' ').toLowerCase();
                                managedBranches = [extractedBranchName];
                            } else {
                                // If no space, use the whole branchName
                                managedBranches = [managerData.branchName.toLowerCase()];
                            }
                        } else if (managerData.branch) {
                            managedBranches = [managerData.branch];
                        }
                        console.log(`   Using fallback managedBranches: [${managedBranches.join(', ')}]`);
                    }
                    
                } else {
                    console.log(`❌ Manager ${userId} not found in database`);
                }
            } catch (error) {
                console.error("❌ Error fetching manager data:", error);
            }
        }
        
        let query = db.collection("employee-leave");
        
        // Filter by approval level
        if (level) {
            query = query.where("currentApprover", "==", level);
        }
        
        // Filter by status (only pending for approval)
        if(level === "team-lead"){
            // Team Lead sees: "pending" (Programmer requests)
            query = query.where("status", "==", "pending");
        }
        if(level === "manager"){
            query = query.where("status", "==", "pending");
        }
        if(level === "hr"){
            // HR sees: "pending" (manager/other position requests) OR "approved_manager" (salesman) OR "approved_team_lead" (programmer) OR "approved_warehouse_manager" (warehouse worker/administrator)
            query = query.where("status", "in", ["pending", "approved_manager", "approved_team_lead", "approved_warehouse_manager"]);
        }
        if(level === "approver"){
            // Approver sees: "pending" (HR requests) OR "approved_hr" (regular flow)
            query = query.where("status", "in", ["pending", "approved_hr"]);
        }
        
        const snapshot = await query.get();
        
        if (snapshot.empty) {
            return res.json({
                success: true,
                message: `No pending leave requests found for ${level} approval`,
                data: [],
                count: 0,
                managedBranches: managedBranches
            });
        }
        
        const allLeaveRequests = [];
        snapshot.forEach(doc => {
            const leaveData = doc.data();
            allLeaveRequests.push({
                id: doc.id,
                uid: leaveData.uid || doc.id,
                employeeId: leaveData.employeeId,
                employeeName: leaveData.employeeName,
                firstName: leaveData.firstName,
                lastName: leaveData.lastName,
                positionName: leaveData.positionName,
                company: leaveData.company,
                companyName: leaveData.companyName,
                location: leaveData.location,
                locationName: leaveData.locationName,
                branch: leaveData.branch,
                branchName: leaveData.branchName,
                branchCode: leaveData.branchCode || leaveData.branch, // Legacy compatibility
                requestDate: leaveData.requestDate,
                leaveType: leaveData.leaveType,
                leaveTypeName: leaveData.leaveTypeName,
                leaveTypeNameEng: leaveData.leaveTypeNameEng,
                requestType: leaveData.requestType || 'daily',
                isHalfDay: leaveData.isHalfDay || false,
                halfDayType: leaveData.halfDayType || null,
                startDate: leaveData.startDate || leaveData.fromDate || null,
                endDate: leaveData.endDate || leaveData.toDate || null,
                totalHours: leaveData.totalHours || 0,
                totalDays: leaveData.totalDays || 0,
                reason: leaveData.reason,
                attachment: leaveData.attachment || null,
                status: leaveData.status,
                statusName: leaveData.statusName,
                currentApprover: leaveData.currentApprover,
                approvalLevel: leaveData.approvalLevel,
                approvalHistory: leaveData.approvalHistory || [],
                createdAt: leaveData.createdAt,
                updatedAt: leaveData.updatedAt,
                ...(leaveData.requestType === 'hourly' && {
                    date: leaveData.date || null,
                    workingShift: leaveData.workingShift || leaveData.shiftName || null,
                    shiftId: leaveData.shiftId || null,
                    shiftName: leaveData.shiftName || null,
                    startTime: leaveData.startTime || null,
                    endTime: leaveData.endTime || null
                })
            });
        });
        
        // Filter by manager's managed branches and employee position (if manager level)
        let leaveRequests = allLeaveRequests;
        if (level === "manager") {
            console.log(`🔍 Manager filtering: Total requests before filtering: ${allLeaveRequests.length}`);
            console.log(`🔍 Manager managedBranches (raw): [${managedBranches.join(', ')}]`);
            
            if (managedBranches.length > 0) {
                // Normalize managed branches for comparison
                const normalizedManagedBranches = managedBranches.map(b => normalizeBranchCode(b)).filter(Boolean);
                console.log(`🔍 Manager filtering: normalized managedBranches = [${normalizedManagedBranches.join(', ')}]`);
                
                leaveRequests = allLeaveRequests.filter(request => {
                    // Normalize request branch code and branch name for comparison
                    const normalizedRequestBranchCode = normalizeBranchCode(request.branchCode);
                    const extractedRequestBranchName = extractBranchName(request.branchName);
                    const normalizedRequestBranchName = normalizeBranchCode(request.branchName);
                    
                    // Use "contains" matching: check if branch/branchName contains any managed branch, or vice versa
                    let matchesBranchCode = false;
                    let matchesBranchName = false;
                    
                    if (normalizedRequestBranchCode) {
                        // Check if branch code matches any managed branch (exact or contains)
                        matchesBranchCode = normalizedManagedBranches.some(managedBranch => 
                            managedBranch === normalizedRequestBranchCode || 
                            managedBranch.includes(normalizedRequestBranchCode) || 
                            normalizedRequestBranchCode.includes(managedBranch)
                        );
                    }
                    
                    // Check branch name (extracted or full) against managed branches
                    const nameToCheck = extractedRequestBranchName || normalizedRequestBranchName;
                    if (nameToCheck) {
                        // Check if branch name matches any managed branch (exact or contains)
                        matchesBranchName = normalizedManagedBranches.some(managedBranch => 
                            managedBranch === nameToCheck || 
                            managedBranch.includes(nameToCheck) || 
                            nameToCheck.includes(managedBranch)
                        );
                    }
                    
                    const fromManagedBranch = matchesBranchCode || matchesBranchName;
                    
                    // Managers can approve requests from Salesman and Programmer (positions that require manager approval)
                    const requiresManagerApproval = request.positionName === "Salesman" || request.positionName === "Programmer";
                    
                    console.log(`🔍 Request ID ${request.id}:`);
                    console.log(`   Employee: ${request.employeeName} (${request.positionName})`);
                    console.log(`   Branch code: "${request.branchCode}" (normalized: "${normalizedRequestBranchCode}")`);
                    console.log(`   Branch name: "${request.branchName || 'N/A'}" → extracted: "${extractedRequestBranchName || 'N/A'}"`);
                    console.log(`   → matchesBranchCode: ${matchesBranchCode}, matchesBranchName: ${matchesBranchName}`);
                    console.log(`   → fromManagedBranch: ${fromManagedBranch}, requiresManagerApproval: ${requiresManagerApproval}`);
                    console.log(`   → INCLUDED: ${fromManagedBranch && requiresManagerApproval}`);
                    
                    // Manager can see requests from their managed branches AND from positions that require manager approval
                    return fromManagedBranch && requiresManagerApproval;
                });
                
                console.log(`📊 Filtered to ${leaveRequests.length} leave request(s) from managed branches`);
            } else {
                console.log(`⚠️ Manager has no managedBranches configured - showing no requests`);
                leaveRequests = [];
            }
        }
        
        // Also support manual branch filtering (optional) - ONLY for managers
        if (branchCode && level === "manager") {
            leaveRequests = leaveRequests.filter(request => 
                request.branchCode === branchCode
            );
        }
        
        // HR and approver see ALL requests (no branch filtering)
        
        // Sort by created date (oldest first for approval queue)
        leaveRequests.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        res.json({
            success: true,
            message: leaveRequests.length === 0 
                ? `No pending leave requests found for ${level} approval`
                : `Leave requests for ${level} approval retrieved successfully`,
            count: leaveRequests.length,
            data: leaveRequests,
            ...(level === "manager" && { managedBranches: managedBranches }) // Include managedBranches in response for debugging
        });
        
    } catch (error) {
        console.error("❌ Error getting leave requests by approval level:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};


// Approve leave request (multi-level)
const approveLeaveRequest = async (req, res) => {
    
    try {
        const { leaveId } = req.params;
        const { userId, comment, action, rejectedReason } = req.body; // action: approve/reject, rejectedReason for rejection reason
        
        if (!leaveId || !userId || !action) {
            return res.status(400).json({ 
                success: false,
                message: "Leave ID, user ID, and action are required" 
            });
        }
        
        // Get the leave request
        const leaveRequestRef = db.collection("employee-leave").doc(leaveId);
        const leaveRequestDoc = await leaveRequestRef.get();
        
        if (!leaveRequestDoc.exists) {
            return res.status(404).json({ 
                success: false,
                message: "Leave request not found" 
            });
        }
        
        const leaveData = leaveRequestDoc.data();
        
        // Verify user's actual role from database
        const employeesRef = db.collection("employees");
        const userQuery = await employeesRef.where("uid", "==", userId).get();
        
        if (userQuery.empty) {
            return res.status(404).json({ 
                success: false,
                message: "User not found" 
            });
        }
        
        const userData = userQuery.docs[0].data();
        const actualUserRole = userData.role; // For approvers
        const actualPositionName = userData.positionName; // For manager, HR, and team lead
        
        // Debug logging
        console.log(`🔍 [APPROVAL CHECK] Leave ID: ${leaveId}`);
        console.log(`🔍 [APPROVAL CHECK] Leave currentApprover: "${leaveData.currentApprover}"`);
        console.log(`🔍 [APPROVAL CHECK] Leave status: "${leaveData.status}"`);
        console.log(`🔍 [APPROVAL CHECK] User positionName: "${actualPositionName}"`);
        console.log(`🔍 [APPROVAL CHECK] User role: "${actualUserRole}"`);
        
        // Check permission based on approval level
        // Team Lead, Manager, HR: Check positionName
        // Approver: Check role
        let canApprove = false;
        let userApprovalLevel = null;
        
        // Normalize position names for comparison (trim whitespace)
        const normalizedPositionName = (actualPositionName || "").trim();
        const normalizedCurrentApprover = (leaveData.currentApprover || "").trim();
        
        if (normalizedCurrentApprover === "team-lead" && normalizedPositionName === "Programmer (Team Lead)") {
            canApprove = true;
            userApprovalLevel = "team-lead";
            console.log(`✅ [APPROVAL CHECK] Team Lead permission granted`);
        } else if (normalizedCurrentApprover === "manager" && normalizedPositionName === "Manager") {
            canApprove = true;
            userApprovalLevel = "manager";
            console.log(`✅ [APPROVAL CHECK] Manager permission granted`);
        } else if (normalizedCurrentApprover === "warehouse-manager" && normalizedPositionName === "Warehouse Manager") {
            canApprove = true;
            userApprovalLevel = "warehouse-manager";
            console.log(`✅ [APPROVAL CHECK] Warehouse Manager permission granted`);
        } else if (normalizedCurrentApprover === "hr" && normalizedPositionName === "HR") {
            canApprove = true;
            userApprovalLevel = "hr";
            console.log(`✅ [APPROVAL CHECK] HR permission granted`);
        } else if (normalizedCurrentApprover === "approver" && (actualUserRole === "approver" || actualUserRole === "approver-three")) {
            canApprove = true;
            userApprovalLevel = "approver";
            console.log(`✅ [APPROVAL CHECK] Approver permission granted`);
        } else {
            console.log(`❌ [APPROVAL CHECK] Permission denied - currentApprover: "${normalizedCurrentApprover}", positionName: "${normalizedPositionName}", role: "${actualUserRole}"`);
        }
        
        if (!canApprove) {
            return res.status(403).json({ 
                success: false,
                message: `You don't have permission to approve at ${leaveData.currentApprover} level. Your position: ${actualPositionName}, role: ${actualUserRole}`,
                debug: {
                    leaveCurrentApprover: leaveData.currentApprover,
                    leaveStatus: leaveData.status,
                    userPositionName: actualPositionName,
                    userRole: actualUserRole
                }
            });
        }
        
        // Check if this is a nano-vip company leave request
        const isNanoVip = (leaveData.company && (leaveData.company.toLowerCase() === "nano-vip" || leaveData.company.toLowerCase().includes("nano-vip"))) ||
                         (leaveData.companyName && leaveData.companyName.toLowerCase().includes("nano-vip"));
        
        // Determine next approval level based on current approval level
        let nextApprover = null;
        let newStatus = "pending";
        
        if (action === "approve") {
            switch (userApprovalLevel) {
                case "team-lead":
                    nextApprover = "hr";
                    newStatus = "approved_team_lead";
                    break;
                case "manager":
                    nextApprover = "hr";
                    newStatus = "approved_manager";
                    break;
                case "warehouse-manager":
                    // Warehouse Manager approval → Go to HR next
                    nextApprover = "hr";
                    newStatus = "approved_warehouse_manager";
                    break;
                case "hr":
                    // For nano-vip: HR is final approver, no need to go to approver
                    if (isNanoVip) {
                        nextApprover = null;
                        newStatus = "approved";
                        console.log(`✅ nano-vip company: HR approval is final`);
                    } else {
                        nextApprover = "approver";
                        newStatus = "approved_hr";
                    }
                    break;
                case "approver":
                    nextApprover = null;
                    newStatus = "approved";
                    break;
                default:
                    return res.status(400).json({ 
                        success: false,
                        message: "Invalid user level for approval" 
                    });
            }
        } else if (action === "reject") {
            nextApprover = null;
            newStatus = "rejected";
        }
        
        // Update leave request
        const updateData = {
            status: newStatus,
            statusName: getStatusDisplayName(newStatus),
            currentApprover: nextApprover,
            updatedAt: new Date().toISOString()
        };
        
        // Add rejection fields if rejecting
        if (action === "reject") {
            updateData.rejectedBy = userId; // Store employee ID of rejecter
            updateData.rejectedDate = new Date().toISOString();
            updateData.rejectedReason = rejectedReason || comment || null; // Store rejection reason (prefer rejectedReason, fallback to comment)
            updateData.rejectedByRole = userApprovalLevel; // Store the role/level of rejecter (team-lead, manager, warehouse-manager, hr, or approver)
        }
        
        // Helper function to get proper status display names
        function getStatusDisplayName(status) {
            switch (status) {
                case 'approved_team_lead':
                    return 'Approved by Team Lead';
                case 'approved_manager':
                    return 'Approved by Manager';
                case 'approved_warehouse_manager':
                    return 'Approved by Warehouse Manager';
                case 'approved_hr':
                    return 'Approved by HR';
                case 'approved':
                    return 'Approved';
                case 'rejected':
                    return 'Rejected';
                case 'pending':
                    return 'Pending';
                default:
                    return status.charAt(0).toUpperCase() + status.slice(1);
            }
        }
        
        // Add approval history
        const approvalEntry = {
            level: userApprovalLevel,
            action: action,
            userId: userId,
            timestamp: new Date().toISOString(),
            comment: comment || `${action} by ${userApprovalLevel}`
        };
        
        const currentHistory = leaveData.approvalHistory || [];
        currentHistory.push(approvalEntry);
        updateData.approvalHistory = currentHistory;
        
        await leaveRequestRef.update(updateData);
        
        const notificationBase = {
            employeeName: leaveData.employeeName
                || [leaveData.firstName, leaveData.lastName].filter(Boolean).join(" ")
                || leaveData.employeeId
                || "Employee",
            leaveTypeName: leaveData.leaveTypeName
                || leaveData.leaveType
                || leaveData.leaveTypeNameEng
                || "leave",
            leaveTypeNameEng: leaveData.leaveTypeNameEng || "",
            fromDate: leaveData.fromDate || leaveData.date || "",
            toDate: leaveData.toDate || leaveData.date || ""
        };


        // ✅ CRITICAL FIX: Send notification to employee BEFORE response
        // On Vercel serverless, functions terminate after response, killing background work
        // Sending notifications first ensures they complete before function ends
        try {
            console.log(`📨 [APPROVAL/REJECTION] Starting notification to requester ${leaveData.employeeId}...`);
            
            await sendLeaveStatusNotification({
                body: {
                    employeeId: leaveData.employeeId,
                    leaveRequestId: leaveId,
                    status: newStatus,
                    approvedBy: userId,
                    rejectReason: action === 'reject' ? (rejectedReason || comment || '') : undefined,
                    reason: action === 'reject' ? (rejectedReason || comment || leaveData.reason || '') : (comment || ''),
                    leaveType: leaveData.leaveTypeName,
                    leaveTypeNameEng: leaveData.leaveTypeNameEng,
                    fromDate: leaveData.fromDate || leaveData.date,
                    toDate: leaveData.toDate || leaveData.date,
                    employeeName: leaveData.employeeName, // From stored data
                    firstName: leaveData.firstName,       // From stored data
                    lastName: leaveData.lastName,         // From stored data
                    positionName: leaveData.positionName, // From stored data
                    channels: getEmployeeNotificationChannels(newStatus) // Only FREE channels
                }
            }, {
                json: () => {}
            });
            
            console.log(`✅ [APPROVAL/REJECTION] Notification sent to requester ${leaveData.employeeId}`);
        } catch (notifError) {
            console.error(`❌ Failed to send ${action} notification to employee:`, notifError);
            // Don't fail the request if notifications fail
        }

        // If approved by team lead, also notify HR
        if (action === 'approve' && userApprovalLevel === 'team-lead') {
            try {
                
                // Get approver data for notification
                const employeesRef = db.collection("employees");
                const approverQuery = await employeesRef.where("uid", "==", userId).get();
                
                let approverName = userId;
                if (!approverQuery.empty) {
                    const approverData = approverQuery.docs[0].data();
                    approverName = `${approverData.firstName} ${approverData.lastName}`;
                }
                
                // Find HR personnel
                const hrQuery = await employeesRef.where("positionName", "==", "HR").get();
                
                if (!hrQuery.empty) {
                    const hrNotification = buildApproverNotificationContent('hr', notificationBase);
                    hrQuery.forEach(hrDoc => {
                        const hrData = hrDoc.data();
                        
                        // Create HR notification
                        createInAppNotification(
                            hrData.uid,
                            hrNotification.title,
                            hrNotification.message,
                            'approved_by_team_lead',
                            {
                                leaveRequestId: leaveId,
                                employeeId: leaveData.employeeId,
                                teamLeadId: userId,
                                teamLeadName: approverName,
                                leaveType: leaveData.leaveTypeName,
                                fromDate: leaveData.fromDate || leaveData.date,
                                toDate: leaveData.toDate || leaveData.date,
                                comment: comment
                            },
                            hrNotification.titleTh,
                            hrNotification.messageTh
                        ).catch(hrNotifError => {
                            console.error(`❌ Failed to send HR notification:`, hrNotifError);
                        });

                        sendLeaveRequestNotification({
                            body: {
                                employeeId: leaveData.employeeId,
                                leaveRequestId: leaveId,
                                leaveType: leaveData.leaveTypeName,
                                leaveTypeNameEng: leaveData.leaveTypeNameEng,
                                fromDate: notificationBase.fromDate,
                                toDate: notificationBase.toDate,
                                managerId: hrData.uid,
                                approverLevel: 'hr',
                                channels: ['push'],
                                titleOverride: hrNotification.title,
                                messageOverride: hrNotification.message
                            }
                        }, {
                            json: () => {}
                        }).catch(notifError => {
                            console.error(`❌ Failed to send HR push notification:`, notifError);
                        });
                    });
                }
            } catch (hrNotifError) {
                console.error("❌ Error sending HR notifications (team lead):", hrNotifError);
            }
        }

        // If approved by manager, also notify HR
        if (action === 'approve' && userApprovalLevel === 'manager') {
            try {
                
                // Get approver data for notification
                const employeesRef = db.collection("employees");
                const approverQuery = await employeesRef.where("uid", "==", userId).get();
                
                let approverName = userId;
                if (!approverQuery.empty) {
                    const approverData = approverQuery.docs[0].data();
                    approverName = `${approverData.firstName} ${approverData.lastName}`;
                }
                
                // Find HR personnel
                const hrQuery = await employeesRef.where("positionName", "==", "HR").get();
                
                if (!hrQuery.empty) {
                        const hrNotification = buildApproverNotificationContent('hr', notificationBase);
                    hrQuery.forEach(hrDoc => {
                        const hrData = hrDoc.data();
                    
                        const messageTh = `${approverName} อนุมัติคำขอ ${leaveData.leaveTypeName} จากพนักงาน ${leaveData.employeeId}`;
                        const titleTh = hrNotification.titleTh || `การแจ้งเตือนการขอลา`;

                        // Create HR notification
                        createInAppNotification(
                            hrData.uid,
                            hrNotification.title,
                            hrNotification.message,
                            'leave_approved_by_manager',
                            {
                                leaveRequestId: leaveId, // Include leave request ID for navigation
                                employeeId: leaveData.employeeId,
                                managerId: userId,
                                managerName: approverName,
                                leaveType: leaveData.leaveTypeName,
                                fromDate: leaveData.fromDate || leaveData.date,
                                toDate: leaveData.toDate || leaveData.date,
                                comment: comment
                            },
                            titleTh,
                            messageTh
                        ).catch(hrNotifError => {
                            console.error(`❌ Failed to send HR notification:`, hrNotifError);
                        });

                        sendLeaveRequestNotification({
                            body: {
                                employeeId: leaveData.employeeId,
                                leaveRequestId: leaveId,
                                leaveType: leaveData.leaveTypeName,
                                leaveTypeNameEng: leaveData.leaveTypeNameEng,
                                fromDate: notificationBase.fromDate,
                                toDate: notificationBase.toDate,
                                managerId: hrData.uid,
                                approverLevel: 'hr',
                                channels: ['push'],
                                titleOverride: hrNotification.title,
                                messageOverride: hrNotification.message
                            }
                        }, {
                            json: () => {}
                        }).catch(notifError => {
                            console.error(`❌ Failed to send HR push notification:`, notifError);
                        });
                    });
                }
            } catch (hrNotifError) {
                console.error("❌ Error sending HR notifications (manager):", hrNotifError);
            }
        }

        // If approved by warehouse-manager, notify HR (HR will then forward to approver)
        if (action === 'approve' && userApprovalLevel === 'warehouse-manager') {
            try {
                // Get warehouse manager data for notification
                const employeesRef = db.collection("employees");
                const warehouseManagerQuery = await employeesRef.where("uid", "==", userId).get();
                
                let warehouseManagerName = userId;
                if (!warehouseManagerQuery.empty) {
                    const warehouseManagerData = warehouseManagerQuery.docs[0].data();
                    warehouseManagerName = `${warehouseManagerData.firstName} ${warehouseManagerData.lastName}`;
                }
                
                // Notify HR personnel
                const hrQuery = await employeesRef.where("positionName", "==", "HR").get();
                
                if (!hrQuery.empty) {
                    const hrNotification = buildApproverNotificationContent('hr', notificationBase);
                    hrQuery.forEach(hrDoc => {
                        const hrData = hrDoc.data();
                    
                        const messageTh = `${warehouseManagerName} อนุมัติคำขอ ${leaveData.leaveTypeName} จากพนักงาน ${leaveData.employeeId}`;
                        const titleTh = hrNotification.titleTh || `การแจ้งเตือนการขอลา`;

                        // Create HR notification
                        createInAppNotification(
                            hrData.uid,
                            hrNotification.title,
                            hrNotification.message,
                            'leave_approved_by_warehouse_manager',
                            {
                                leaveRequestId: leaveId,
                                employeeId: leaveData.employeeId,
                                warehouseManagerId: userId,
                                warehouseManagerName: warehouseManagerName,
                                leaveType: leaveData.leaveTypeName,
                                fromDate: leaveData.fromDate || leaveData.date,
                                toDate: leaveData.toDate || leaveData.date,
                                comment: comment
                            },
                            titleTh,
                            messageTh
                        ).catch(hrNotifError => {
                            console.error(`❌ Failed to send HR notification:`, hrNotifError);
                        });

                        sendLeaveRequestNotification({
                            body: {
                                employeeId: leaveData.employeeId,
                                leaveRequestId: leaveId,
                                leaveType: leaveData.leaveTypeName,
                                leaveTypeNameEng: leaveData.leaveTypeNameEng,
                                fromDate: notificationBase.fromDate,
                                toDate: notificationBase.toDate,
                                managerId: hrData.uid,
                                approverLevel: 'hr',
                                channels: ['push'],
                                titleOverride: hrNotification.title,
                                messageOverride: hrNotification.message
                            }
                        }, {
                            json: () => {}
                        }).catch(notifError => {
                            console.error(`❌ Failed to send HR push notification:`, notifError);
                        });
                    });
                }
            } catch (warehouseManagerNotifError) {
                console.error("❌ Error sending HR notifications (warehouse-manager):", warehouseManagerNotifError);
            }
        }

        // NEW: Send notification to specific next approver(s) based on nextApprover level
        // Uses simplified function that takes approver employee ID directly
        if (action === 'approve' && nextApprover) {
            try {
                console.log(`📨 NEW CODE PATH: Finding approvers for level "${nextApprover}" for employee ${leaveData.employeeId}`);
                const approverIds = await findApproverIdsByLevel(nextApprover, leaveData.employeeId, leaveData.branch, leaveData.branchName);
                console.log(`📨 Found ${approverIds.length} approver(s):`, approverIds);
                
                if (approverIds && approverIds.length > 0) {
                    const approverNotification = buildApproverNotificationContent(nextApprover, notificationBase);
                    console.log(`📨 Notification content:`, approverNotification);
                    
                    // Fetch all approver data once to get device tokens (avoid re-fetching in notification function)
                    const approverDocs = await Promise.all(
                        approverIds.map(async (approverId) => {
                            const approverRef = await findEmployeeDocRef(approverId);
                            if (approverRef) {
                                const doc = await approverRef.get();
                                if (doc.exists) {
                                    return { id: approverId, data: doc.data() };
                                }
                            }
                            return { id: approverId, data: null };
                        })
                    );
                    
                    for (const { id: approverId, data: approverData } of approverDocs) {
                        if (!approverData) {
                            console.warn(`⚠️ Approver data not found for ${approverId}, skipping notification`);
                            continue;
                        }
                        
                        console.log(`📨 About to call sendLeaveRequestNotificationToApprover for ${approverId}...`);
                        // Use simplified function - pass device tokens to avoid re-fetching approver document
                        sendLeaveRequestNotificationToApprover(approverId, {
                            title: approverNotification.title,
                            message: approverNotification.message,
                            employeeId: leaveData.employeeId,
                            employeeName: notificationBase.employeeName,
                            leaveRequestId: leaveId,
                            leaveType: leaveData.leaveTypeName || leaveData.leaveType,
                            leaveTypeNameEng: leaveData.leaveTypeNameEng,
                            fromDate: leaveData.fromDate || leaveData.date,
                            toDate: leaveData.toDate || leaveData.date,
                            reason: comment || leaveData.reason
                        }, approverData.deviceTokens || []).then(result => {
                            console.log(`✅ Notification result for ${approverId}:`, result);
                        }).catch(err => {
                            console.error(`❌ Failed to send notification to ${nextApprover} ${approverId}:`, err);
                        });
                    }
                } else {
                    console.warn(`⚠️ No approvers found for level "${nextApprover}"`);
                }
            } catch (nextApproverError) {
                console.error("❌ Error sending notification to next approver:", nextApproverError);
            }
        } else {
            console.log(`📨 NEW CODE PATH SKIPPED: action=${action}, nextApprover=${nextApprover}`);
        }
        
        res.json({
            success: true,
            message: `Leave request ${action} successfully`,
            leaveRequest: {
                id: leaveId,
                status: newStatus,
                statusName: updateData.statusName,
                currentApprover: nextApprover,
                approvalHistory: currentHistory,
                ...(action === "reject" && {
                    rejectedBy: updateData.rejectedBy,
                    rejectedDate: updateData.rejectedDate,
                    rejectedReason: updateData.rejectedReason
                })
            }
        });
        
    } catch (error) {
        console.error("❌ Error approving leave request:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Get employee leave balance (quota vs used)
const getEmployeeLeaveBalance = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { year } = req.query; // Optional: filter by year (default: current year)
        
        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: "Employee ID is required"
            });
        }

        // Get employee data
        const employeesRef = db.collection("employees");
        const employeeQuery = await employeesRef.where("uid", "==", employeeId).get();
        
        if (employeeQuery.empty) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        const employeeData = employeeQuery.docs[0].data();
        const employeeGender = employeeData.gender;
        const positionName = employeeData.positionName || "";
        
        // Determine hours per day based on position (same logic as in createLeaveRequest)
        let hoursPerDay = 9; // Default: 9 hours = 1 day for others
        
        if (positionName === "Programmer") {
            hoursPerDay = 10; // Programmer: 10 hours = 1 day
        } else if (positionName === "Salesman" || positionName === "Manager") {
            hoursPerDay = 8; // Salesman and Manager: 8 hours = 1 day
        } else {
            hoursPerDay = 9; // Others: 9 hours = 1 day
        }
        
        // Check eligibility for annual leave (3+ months with company)
        const joinDate = new Date(employeeData.joinDate);
        const today = new Date();
        let monthsWithCompany = (today.getFullYear() - joinDate.getFullYear()) * 12 + 
                                  (today.getMonth() - joinDate.getMonth());
        
        // If current day is before join day, subtract 1 month (not a full month yet)
        if (today.getDate() < joinDate.getDate()) {
            monthsWithCompany -= 1;
        }
        
        const eligibleForAnnualLeave = monthsWithCompany >= 3;

        // Determine year to filter (default: current year)
        const filterYear = year ? parseInt(year) : new Date().getFullYear();
        const yearStart = `${filterYear}-01-01`;
        const yearEnd = `${filterYear}-12-31`;

        // Step 1: Get all leave types (quotas) for this employee
        const leaveSettingsRef = db.collection("leave-settings");
        const settingsSnapshot = await leaveSettingsRef.get();
        
        if (settingsSnapshot.empty) {
            return res.json({
                success: true,
                message: "No leave types configured",
                eligibleForAnnualLeave: eligibleForAnnualLeave,
                monthsWithCompany: monthsWithCompany,
                requiredMonths: 3,
                balances: []
            });
        }

        // Get all leave types with their quotas
        const leaveTypes = [];
        let totalLeaveTypes = 0;
        let filteredByGender = 0;
        let filteredByAnnualLeave = 0;
        
        settingsSnapshot.forEach(doc => {
            totalLeaveTypes++;
            const setting = doc.data();
            const leaveTypeName = setting.leaveTypeName;
            const leaveTypeNameEng = setting.leaveTypeNameEng;
            const settingGender = setting.gender || "All";
            
            // Filter by gender if applicable
            if (!setting.gender || setting.gender === "All" || setting.gender === employeeGender) {
                // Filter out annual leave if employee is not eligible (< 3 months)
                if (!eligibleForAnnualLeave && isAnnualLeave(leaveTypeName, leaveTypeNameEng)) {
                    filteredByAnnualLeave++;
                    return; // Skip this leave type
                }
                
                leaveTypes.push({
                    leaveTypeId: doc.id,
                    leaveTypeName: leaveTypeName,
                    leaveTypeEng: leaveTypeNameEng,
                    maxDays: setting.leaveDay || 0,
                    isPaid: setting.type === 'Paid' || setting.isPaid === true,
                    isActive: setting.isActive !== false,
                    description: setting.description || '-'
                });
            } else {
                filteredByGender++;
            }
        });
        
        // Debug logging
        console.log(`📊 Leave Balance Debug for ${employeeId}:`, {
            totalLeaveTypes,
            employeeGender,
            filteredByGender,
            filteredByAnnualLeave,
            eligibleForAnnualLeave,
            monthsWithCompany,
            finalLeaveTypesCount: leaveTypes.length
        });

        // Step 2: Get all APPROVED leave requests for this employee in the year
        const leaveRequestsRef = db.collection("employee-leave");
        const requestsSnapshot = await leaveRequestsRef
            .where("employeeId", "==", employeeId)
            .where("status", "==", "approved")
            .get();

        // Calculate used days per leave type
        const usedDaysMap = {};
        
        requestsSnapshot.forEach(doc => {
            const request = doc.data();
            const leaveTypeId = request.leaveType;
            const requestDate = request.fromDate || request.date || request.requestDate;
            
            // Filter by year if date is available
            if (requestDate && requestDate.startsWith(filterYear.toString())) {
                // Use the actual totalDays value (calculated properly for both daily and hourly)
                const daysUsed = request.totalDays || 0;
                
                if (!usedDaysMap[leaveTypeId]) {
                    usedDaysMap[leaveTypeId] = 0;
                }
                usedDaysMap[leaveTypeId] += daysUsed;
            }
        });

        // Step 3: Calculate balance for each leave type
        const balances = leaveTypes.map(leaveType => {
            const used = usedDaysMap[leaveType.leaveTypeId] || 0;
            const remaining = leaveType.maxDays - used;
            const remainingDays = remaining > 0 ? remaining : 0;
            
            // Calculate remaining hours based on position
            const remainingHours = Math.round(remainingDays * hoursPerDay * 100) / 100; // Round to 2 decimal places
            
            // Format as "X days Y hours" (e.g., "3 days 8 hours")
            let remainingDaysHours = "";
            if (remainingDays >= 1) {
                const fullDays = Math.floor(remainingDays);
                const hoursInPartialDay = (remainingDays - fullDays) * hoursPerDay;
                
                if (hoursInPartialDay >= 1) {
                    const fullHours = Math.floor(hoursInPartialDay);
                    remainingDaysHours = `${fullDays} days ${fullHours} hours`;
                } else {
                    remainingDaysHours = `${fullDays} days`;
                }
            } else if (remainingDays > 0) {
                const hoursOnly = Math.floor(remainingHours);
                if (hoursOnly > 0) {
                    remainingDaysHours = `${hoursOnly} hours`;
                } else {
                    remainingDaysHours = "0 hours";
                }
            } else {
                remainingDaysHours = "0 days";
            }
            
            return {
                leaveTypeId: leaveType.leaveTypeId,
                leaveTypeName: leaveType.leaveTypeName,
                leaveTypeEng: leaveType.leaveTypeEng || leaveType.leaveTypeName,
                totalAllocated: leaveType.maxDays,
                used: used,
                remaining: remainingDays,
                remainingHours: remainingHours,
                remainingDaysHours: remainingDaysHours,
                description: leaveType.description,
                isPaid: leaveType.isPaid,
                isActive: leaveType.isActive,
                percentageUsed: leaveType.maxDays > 0 ? Math.round((used / leaveType.maxDays) * 100) : 0
            };
        });

        res.json({
            success: true,
            message: "Leave balance retrieved successfully",
            employeeId: employeeId,
            employeeName: `${employeeData.firstName} ${employeeData.lastName}`,
            year: filterYear,
            eligibleForAnnualLeave: eligibleForAnnualLeave,
            monthsWithCompany: monthsWithCompany,
            requiredMonths: 3,
            hoursPerDay: hoursPerDay, // For reference: hours = 1 day for this position
            balances: balances,
            summary: {
                totalLeaveTypes: balances.length,
                totalDaysAllocated: balances.reduce((sum, b) => sum + (parseFloat(b.totalAllocated) || 0), 0),
                totalDaysUsed: balances.reduce((sum, b) => sum + b.used, 0),
                totalDaysRemaining: balances.reduce((sum, b) => sum + b.remaining, 0),
                totalRemainingHours: Math.round(balances.reduce((sum, b) => sum + b.remainingHours, 0) * 100) / 100
            },
            debug: {
                totalLeaveTypesInDB: totalLeaveTypes,
                filteredByGender: filteredByGender,
                filteredByAnnualLeave: filteredByAnnualLeave,
                employeeGender: employeeGender,
                finalLeaveTypesCount: leaveTypes.length
            }
        });

    } catch (error) {
        console.error("❌ Error getting employee leave balance:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Get comprehensive leave list with role-based filtering
const getLeaveListByRole = async (req, res) => {
    try {
        const { userId, status, startDate, endDate, limit = 100, page = 1 } = req.query;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required"
            });
        }

        // Step 1: Get user data to determine their role and position
        const employeesRef = db.collection("employees");
        const userQuery = await employeesRef.where("uid", "==", userId).get();
        
        if (userQuery.empty) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const userData = userQuery.docs[0].data();
        const userPosition = userData.positionName;
        const userRole = userData.role;
        const managedBranches = userData.managedBranches || [];
        const userBranch = userData.branch;

        // Step 2: Build query based on role/position
        let query = db.collection("employee-leave");
        let canSeeAllBranches = false;
        let canSeeAllEmployees = false;

        // Determine permissions
        if (userPosition === "HR" || userRole === "approver" || userRole === "approver-three") {
            // HR and Approvers see everything
            canSeeAllBranches = true;
            canSeeAllEmployees = true;
        } else if (userPosition === "Programmer (Team Lead)") {
            // Team Lead sees only Programmer data (all branches)
            query = query.where("positionName", "==", "Programmer");
            canSeeAllBranches = true;
            canSeeAllEmployees = false;
        } else if (userPosition === "Manager") {
            // Manager sees only their managed branches
            const branches = managedBranches.length > 0 ? managedBranches : [userBranch];
            
            if (branches.length > 0) {
                // Firestore 'in' query supports up to 10 values
                const branchBatch = branches.slice(0, 10);
                query = query.where("branchCode", "in", branchBatch);
            }
            canSeeAllBranches = false;
            canSeeAllEmployees = false;
        } else if (userPosition === "Warehouse Manager") {
            // Warehouse Manager sees only Warehouse Worker and Warehouse Administrator data (all branches)
            query = query.where("positionName", "in", ["Warehouse Worker", "Warehouse Administrator"]);
            canSeeAllBranches = true;
            canSeeAllEmployees = false;
        } else {
            // Regular employees see only their own data
            query = query.where("employeeId", "==", userId);
        }

        // Step 3: Apply optional filters
        if (status) {
            // Support multiple statuses: "pending,approved,rejected"
            const statusList = status.split(',').map(s => s.trim());
            if (statusList.length === 1) {
                query = query.where("status", "==", statusList[0]);
            } else if (statusList.length > 1 && statusList.length <= 10) {
                query = query.where("status", "in", statusList);
            }
        }

        if (startDate) {
            query = query.where("requestDate", ">=", startDate);
        }
        
        if (endDate) {
            query = query.where("requestDate", "<=", endDate);
        }

        // Step 4: Execute query
        const snapshot = await query.get();

        if (snapshot.empty) {
            return res.json({
                success: true,
                message: "No leave requests found",
                data: [],
                count: 0,
                permissions: {
                    canSeeAllBranches,
                    canSeeAllEmployees,
                    userPosition,
                    userRole
                }
            });
        }

        // Step 5: Format results
        const leaveRequests = [];
        snapshot.forEach(doc => {
            const leaveData = doc.data();
            leaveRequests.push({
                id: doc.id,
                uid: leaveData.uid || doc.id,
                employeeId: leaveData.employeeId,
                employeeName: leaveData.employeeName,
                firstName: leaveData.firstName,
                lastName: leaveData.lastName,
                positionName: leaveData.positionName,
                company: leaveData.company,
                companyName: leaveData.companyName,
                location: leaveData.location,
                locationName: leaveData.locationName,
                branch: leaveData.branch,
                branchName: leaveData.branchName,
                branchCode: leaveData.branchCode,
                leaveType: leaveData.leaveType,
                leaveTypeName: leaveData.leaveTypeName,
                requestType: leaveData.requestType,
                fromDate: leaveData.fromDate,
                toDate: leaveData.toDate,
                date: leaveData.date,
                totalHours: leaveData.totalHours || 0,
                totalDays: leaveData.totalDays,
                reason: leaveData.reason,
                status: leaveData.status,
                statusName: leaveData.statusName,
                currentApprover: leaveData.currentApprover,
                approvalLevel: leaveData.approvalLevel,
                approvalHistory: leaveData.approvalHistory || [],
                requestDate: leaveData.requestDate,
                createdAt: leaveData.createdAt,
                updatedAt: leaveData.updatedAt,
                attachment: leaveData.attachment
            });
        });

        // Sort by created date (newest first)
        leaveRequests.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA;
        });

        // Apply pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedResults = leaveRequests.slice(startIndex, endIndex);

        res.json({
            success: true,
            message: "Leave requests retrieved successfully",
            data: paginatedResults,
            count: paginatedResults.length,
            total: leaveRequests.length,
            permissions: {
                canSeeAllBranches,
                canSeeAllEmployees,
                userPosition,
                userRole,
                managedBranches: userPosition === "Manager" ? managedBranches : null
            },
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(leaveRequests.length / limit),
                itemsPerPage: parseInt(limit)
            }
        });

    } catch (error) {
        console.error("❌ Error getting leave list by role:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

// Get leave history with role-specific status filtering
const getLeaveHistory = async (req, res) => {
    try {
        const { userId, startDate, endDate, limit = 100, page = 1 } = req.query;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required"
            });
        }

        // Step 1: Get user data to determine their role and position
        const employeesRef = db.collection("employees");
        const userQuery = await employeesRef.where("uid", "==", userId).get();
        
        if (userQuery.empty) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const userData = userQuery.docs[0].data();
        const userPosition = userData.positionName;
        const userRole = userData.role;
        const managedBranches = userData.managedBranches || [];
        const userBranch = userData.branch;

        // Step 2: Build query based on role/position
        let query = db.collection("employee-leave");
        let allowedStatuses = [];
        let filterDescription = "";

        // Determine permissions and status filters
        if (userPosition === "HR") {
            // HR sees: ALL employees, ALL branches, ALL statuses
            filterDescription = "HR - All employees, all branches, all statuses";
            // No branch filter - sees ALL branches
            // No status filter - sees ALL statuses
            
        } else if (userRole === "approver" || userRole === "approver-three") {
            // Approver sees: ALL employees, ALL branches, ALL statuses
            filterDescription = "Approver - All employees, all branches, all statuses";
            // No branch filter - sees ALL branches
            // No status filter - sees ALL statuses
            
        } else if (userPosition === "Programmer (Team Lead)") {
            // Team Lead sees only Programmer data (all statuses, all branches)
            query = query.where("positionName", "==", "Programmer");
            filterDescription = "Team Lead - All Programmer leaves";
            
        } else if (userPosition === "Manager") {
            // Manager sees only their managed branches (all statuses)
            const branches = managedBranches.length > 0 ? managedBranches : [userBranch];
            
            if (branches.length > 0) {
                // Firestore 'in' query supports up to 10 values
                const branchBatch = branches.slice(0, 10);
                query = query.where("branchCode", "in", branchBatch);
                filterDescription = `Manager - Branches: ${branches.join(', ')}`;
            }
            
        } else if (userPosition === "Warehouse Manager") {
            // Warehouse Manager sees only Warehouse Worker and Warehouse Administrator data (all statuses, all branches)
            query = query.where("positionName", "in", ["Warehouse Worker", "Warehouse Administrator"]);
            filterDescription = "Warehouse Manager - All Warehouse Worker and Warehouse Administrator leaves";
            
        } else {
            // Regular employees see only their own data
            query = query.where("employeeId", "==", userId);
            filterDescription = "Employee - Own leaves only";
        }

        // Apply status filter for HR and Approver
        if (allowedStatuses.length > 0) {
            query = query.where("status", "in", allowedStatuses);
        }

        // Apply date filters if provided
        if (startDate) {
            query = query.where("requestDate", ">=", startDate);
        }
        
        if (endDate) {
            query = query.where("requestDate", "<=", endDate);
        }

        // Step 3: Execute query
        const snapshot = await query.get();

        if (snapshot.empty) {
            return res.json({
                success: true,
                message: "No leave requests found",
                data: [],
                count: 0,
                filter: {
                    description: filterDescription,
                    userPosition,
                    userRole,
                    allowedStatuses: allowedStatuses.length > 0 ? allowedStatuses : "all",
                    managedBranches: userPosition === "Manager" ? managedBranches : null
                }
            });
        }

        // Step 4: Format results and filter by action taken
        const leaveRequests = [];
        snapshot.forEach(doc => {
            const leaveData = doc.data();
            const approvalHistory = leaveData.approvalHistory || [];
            
            // Check if current user has taken action on this leave
            const userHasActed = approvalHistory.some(history => 
                history.userId === userId && (history.action === "approve" || history.action === "reject")
            );
            
            // For Team Lead, Manager, HR, Approver: only show if they've taken action
            // For regular employees: show their own leaves regardless
            const shouldInclude = 
                leaveData.employeeId === userId || // Own leaves
                userHasActed; // Or has taken action on this leave
            
            if (shouldInclude) {
                leaveRequests.push({
                    id: doc.id,
                    uid: leaveData.uid || doc.id,
                    employeeId: leaveData.employeeId,
                    employeeName: leaveData.employeeName,
                    firstName: leaveData.firstName,
                    lastName: leaveData.lastName,
                    positionName: leaveData.positionName,
                    company: leaveData.company,
                    companyName: leaveData.companyName,
                    location: leaveData.location,
                    locationName: leaveData.locationName,
                    branch: leaveData.branch,
                    branchName: leaveData.branchName,
                    branchCode: leaveData.branchCode,
                    leaveType: leaveData.leaveType,
                    leaveTypeName: leaveData.leaveTypeName,
                    requestType: leaveData.requestType,
                    fromDate: leaveData.fromDate,
                    toDate: leaveData.toDate,
                    date: leaveData.date,
                    totalHours: leaveData.totalHours || 0,
                    totalDays: leaveData.totalDays,
                    reason: leaveData.reason,
                    status: leaveData.status,
                    statusName: leaveData.statusName,
                    currentApprover: leaveData.currentApprover,
                    approvalLevel: leaveData.approvalLevel,
                    approvalHistory: approvalHistory,
                    requestDate: leaveData.requestDate,
                    createdAt: leaveData.createdAt,
                    updatedAt: leaveData.updatedAt,
                    attachment: leaveData.attachment,
                    userAction: userHasActed ? approvalHistory.find(h => h.userId === userId)?.action : null
                });
            }
        });

        // Sort by created date (newest first)
        leaveRequests.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA;
        });

        // Apply pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedResults = leaveRequests.slice(startIndex, endIndex);

        res.json({
            success: true,
            message: "Leave history retrieved successfully",
            data: paginatedResults,
            count: paginatedResults.length,
            total: leaveRequests.length,
            filter: {
                description: filterDescription,
                userPosition,
                userRole,
                allowedStatuses: allowedStatuses.length > 0 ? allowedStatuses : "all",
                managedBranches: userPosition === "Manager" ? managedBranches : null
            },
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(leaveRequests.length / limit),
                itemsPerPage: parseInt(limit)
            }
        });

    } catch (error) {
        console.error("❌ Error getting leave history:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

module.exports = {
    getLeaveSettings,
    getEmployeeLeaveList,
    createLeaveRequest,
    getAllLeaveRequests,
    updateLeaveRequestStatus,
    getLeaveRequestById,
    getLeaveRequestsByApprovalLevel,
    approveLeaveRequest,
    getEmployeeLeaveBalance,
    getLeaveListByRole,
    getLeaveHistory
};
