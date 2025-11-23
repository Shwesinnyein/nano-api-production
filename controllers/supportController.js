const { admin, db } = require("../config/firebaseConfig");
const { v4: uuidv4 } = require('uuid');

// Initialize Firebase Storage
let bucket;
const initializeFirebaseStorage = async () => {
    try {
        if (admin.apps.length === 0) {
            await admin.initializeApp();
        }
        const storage = admin.storage();
        bucket = storage.bucket();
        return bucket;
    } catch (error) {
        console.error('❌ Firebase Storage initialization error:', error);
        return null;
    }
};

// Initialize on module load
initializeFirebaseStorage().catch((error) => {
    console.error('❌ Failed to initialize Firebase Storage:', error);
    bucket = null;
});

// Upload screenshot to Firebase Storage
const uploadScreenshotToStorage = async (file, reportId, employeeId) => {
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
        const fileExtension = file.originalname.split('.').pop() || 'png';
        const baseName = file.originalname.replace(/\.[^/.]+$/, '') || 'screenshot';
        const uniqueFileName = `${baseName}_${timestamp}.${fileExtension}`;
        const fileName = `problem-reports/${employeeId}/${reportId}/${uniqueFileName}`;
        const fileUpload = bucket.file(fileName);
        
        const stream = fileUpload.createWriteStream({
            metadata: {
                contentType: file.mimetype,
                metadata: {
                    originalName: file.originalname,
                    uploadedBy: employeeId,
                    reportId: reportId,
                    uploadedAt: new Date().toISOString()
                }
            }
        });
        
        return new Promise((resolve, reject) => {
            stream.on('error', (error) => {
                console.error('❌ Screenshot upload error:', error);
                reject(error);
            });
            
            stream.on('finish', async () => {
                try {
                    // Make the file publicly accessible
                    await fileUpload.makePublic();
                    
                    // Get the public URL
                    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
                    
                    resolve({
                        fileName: fileName,
                        storageName: uniqueFileName,
                        originalName: file.originalname,
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
        console.error('❌ Upload screenshot to storage error:', error);
        throw error;
    }
};

// Submit problem report
const submitProblemReport = async (req, res) => {
    console.log('📨 submitProblemReport called');
    
    try {
        const {
            employeeId,
            employeeName,
            firstName,
            lastName,
            email,
            category, // e.g., 'technical', 'hr', 'payroll', 'other'
            title,
            description,
            priority, // 'low', 'medium', 'high', 'urgent'
            deviceInfo, // optional: device type, OS version, app version
            browserInfo // optional: for web issues
        } = req.body;

        // Validate required fields
        if (!employeeId || !category || !title || !description) {
            const missingFields = [];
            if (!employeeId) missingFields.push('employeeId');
            if (!category) missingFields.push('category');
            if (!title) missingFields.push('title');
            if (!description) missingFields.push('description');
            
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}`,
                messageTh: `กรุณากรอกข้อมูลให้ครบถ้วน: ${missingFields.join(', ')}`,
                missingFields: missingFields
            });
        }

        // Validate category
        const validCategories = ['technical', 'hr', 'payroll', 'leave', 'attendance', 'other'];
        if (!validCategories.includes(category)) {
            return res.status(400).json({
                success: false,
                message: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
                messageTh: `หมวดหมู่ไม่ถูกต้อง ต้องเป็น: ${validCategories.join(', ')}`
            });
        }

        // Validate priority (optional, default to 'medium')
        const validPriorities = ['low', 'medium', 'high', 'urgent'];
        const reportPriority = priority && validPriorities.includes(priority) 
            ? priority 
            : 'medium';

        // Generate unique report ID
        const reportId = uuidv4();
        const currentDateTime = new Date().toISOString();

        // Handle screenshot uploads
        let screenshots = [];
        if (req.files && req.files.length > 0) {
            try {
                const uploadedFiles = [];
                for (const file of req.files) {
                    // Validate file type (images only)
                    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
                    if (!allowedMimeTypes.includes(file.mimetype)) {
                        return res.status(400).json({
                            success: false,
                            message: `Invalid file type: ${file.mimetype}. Only images are allowed.`,
                            messageTh: `ประเภทไฟล์ไม่ถูกต้อง: ${file.mimetype} อนุญาตเฉพาะไฟล์รูปภาพ`
                        });
                    }
                    
                    // Validate file size (max 10MB)
                    const maxSize = 10 * 1024 * 1024; // 10MB
                    if (file.size > maxSize) {
                        return res.status(400).json({
                            success: false,
                            message: `File too large: ${file.originalname}. Maximum size is 10MB.`,
                            messageTh: `ไฟล์ใหญ่เกินไป: ${file.originalname} ขนาดสูงสุด 10MB`
                        });
                    }
                    
                    const uploadResult = await uploadScreenshotToStorage(file, reportId, employeeId);
                    uploadedFiles.push(uploadResult);
                }
                screenshots = {
                    files: uploadedFiles,
                    count: uploadedFiles.length,
                    uploadedAt: currentDateTime
                };
            } catch (uploadError) {
                console.error('❌ Screenshot upload failed:', uploadError);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to upload screenshots',
                    messageTh: 'ไม่สามารถอัปโหลดรูปภาพได้',
                    error: uploadError.message
                });
            }
        }

        // Try to get employee details if not provided
        let finalEmployeeName = employeeName;
        let finalFirstName = firstName;
        let finalLastName = lastName;
        let finalEmail = email;

        if (!finalEmployeeName || !finalFirstName || !finalLastName) {
            try {
                const employeesRef = db.collection('employees');
                const employeeQuery = await employeesRef.where('uid', '==', employeeId).limit(1).get();
                
                if (!employeeQuery.empty) {
                    const employeeData = employeeQuery.docs[0].data();
                    finalEmployeeName = finalEmployeeName || `${employeeData.firstName || ''} ${employeeData.lastName || ''}`.trim();
                    finalFirstName = finalFirstName || employeeData.firstName || '';
                    finalLastName = finalLastName || employeeData.lastName || '';
                    finalEmail = finalEmail || employeeData.email || employeeData.documents?.email || '';
                }
            } catch (empError) {
                console.warn('⚠️ Could not fetch employee details:', empError);
            }
        }

        // Prepare report data
        const reportData = {
            id: reportId,
            uid: reportId,
            employeeId: employeeId,
            employeeName: finalEmployeeName,
            firstName: finalFirstName,
            lastName: finalLastName,
            email: finalEmail || null,
            category: category,
            title: title,
            description: description,
            priority: reportPriority,
            status: 'new', // Status: 'new', 'in-progress', 'resolved', 'closed'
            deviceInfo: deviceInfo || null,
            browserInfo: browserInfo || null,
            screenshots: screenshots.files && screenshots.files.length > 0 ? screenshots : null,
            assignedTo: null, // Will be set by admin later
            assignedAt: null,
            resolvedAt: null,
            resolution: null, // Admin's response/resolution
            followUpCount: 0, // Number of follow-up messages
            createdAt: currentDateTime,
            updatedAt: currentDateTime
        };

        // Save to Firestore
        const reportRef = db.collection('problem_reports').doc(reportId);
        await reportRef.set(reportData);

        console.log(`✅ Problem report created: id=${reportId}, employeeId=${employeeId}, category=${category}`);

        // Return success response
        res.json({
            success: true,
            message: 'Problem report submitted successfully',
            messageTh: 'ส่งรายงานปัญหาเรียบร้อยแล้ว',
            report: {
                id: reportData.id,
                employeeId: reportData.employeeId,
                category: reportData.category,
                title: reportData.title,
                priority: reportData.priority,
                status: reportData.status,
                screenshotsCount: screenshots.files ? screenshots.files.length : 0,
                createdAt: reportData.createdAt
            }
        });

    } catch (error) {
        console.error('❌ Error submitting problem report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit problem report',
            messageTh: 'ไม่สามารถส่งรายงานปัญหาได้',
            error: error.message
        });
    }
};

// Get problem reports for an employee
const getEmployeeProblemReports = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { status, category, limit = 50 } = req.query;

        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: 'Employee ID is required'
            });
        }

        let query = db.collection('problem_reports').where('employeeId', '==', employeeId);

        // Filter by status if provided
        if (status) {
            query = query.where('status', '==', status);
        }

        // Filter by category if provided
        if (category) {
            query = query.where('category', '==', category);
        }

        // Order by created date (newest first) and limit
        query = query.orderBy('createdAt', 'desc').limit(parseInt(limit));

        const snapshot = await query.get();

        const reports = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            reports.push({
                id: data.id,
                category: data.category,
                title: data.title,
                description: data.description,
                priority: data.priority,
                status: data.status,
                screenshotsCount: data.screenshots ? data.screenshots.files?.length || 0 : 0,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
                resolvedAt: data.resolvedAt,
                resolution: data.resolution
            });
        });

        res.json({
            success: true,
            message: 'Problem reports retrieved successfully',
            count: reports.length,
            reports: reports
        });

    } catch (error) {
        console.error('❌ Error getting employee problem reports:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve problem reports',
            error: error.message
        });
    }
};

// Get single problem report by ID
const getProblemReportById = async (req, res) => {
    try {
        const { reportId } = req.params;

        if (!reportId) {
            return res.status(400).json({
                success: false,
                message: 'Report ID is required'
            });
        }

        const reportDoc = await db.collection('problem_reports').doc(reportId).get();

        if (!reportDoc.exists) {
            return res.status(404).json({
                success: false,
                message: 'Problem report not found'
            });
        }

        const reportData = reportDoc.data();

        res.json({
            success: true,
            message: 'Problem report retrieved successfully',
            report: reportData
        });

    } catch (error) {
        console.error('❌ Error getting problem report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve problem report',
            error: error.message
        });
    }
};

module.exports = {
    submitProblemReport,
    getEmployeeProblemReports,
    getProblemReportById
};

