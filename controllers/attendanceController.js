const { v4: uuidV4 } = require('uuid');
const { admin, db } = require("../config/firebaseConfig");

// Helper function to convert time string to minutes
const timeToMinutes = (timeString) => {
    // Handle both HH:MM and HH:MM:SS formats
    const parts = timeString.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    return hours * 60 + minutes;
};

// Check In/Out API with proper record checking
const checkInOut = async (req, res) => {
    console.log("Check In/Out called", req.body);
    try {
        const { 
            employeeId,
            employeeName,
            location,
            branch,
            branchName,
            currentLocation, // Accept from frontend (legacy)
            checkInLocation, // Accept from frontend for check-in
            checkOutLocation, // Accept from frontend for check-out
            type
        } = req.body; // type: 'checkin' or 'checkout'
        
        // Validate required fields
        if (!employeeId || !employeeName || !type || !location) {
            return res.status(400).json({
                success: false,
                message: "Employee ID, name, type, and location are required"
            });
        }

        // Validate type
        if (type !== 'checkin' && type !== 'checkout') {
            return res.status(400).json({
                success: false,
                message: "Type must be 'checkin' or 'checkout'"
            });
        }

        // Get current date and time in Thailand timezone (UTC+7)
        const currentDate = new Date();
        
        // Convert to Thailand timezone (UTC+7)
        const thaiTime = new Date(currentDate.toLocaleString("en-US", {timeZone: "Asia/Bangkok"}));
        const dateString = thaiTime.toISOString().split('T')[0]; // YYYY-MM-DD format
        const localTimeString = thaiTime.toTimeString().split(' ')[0]; // HH:MM:SS format only
        
        console.log("Thailand time:", thaiTime.toLocaleString("en-US", {timeZone: "Asia/Bangkok"}));
        console.log("Date string:", dateString);
        console.log("Time string:", localTimeString);

        // Check if today's record already exists for this employee
        const existingRecordQuery = db.collection("employee-attendance")
            .where("employeeId", "==", employeeId)
            .where("date", "==", dateString)
            .limit(1);

        const existingSnapshot = await existingRecordQuery.get();

        if (type === 'checkin') {
            // CHECK IN LOGIC
            // First, get employee data to check if they are driver or security (overnight shift workers)
            let employeePosition = null;
            let isOvernightWorker = false;
            
            try {
                const employeeQuery = db.collection("employees")
                    .where("uid", "==", employeeId)
                    .limit(1);
                
                const employeeSnapshot = await employeeQuery.get();
                
                if (!employeeSnapshot.empty) {
                    const employeeData = employeeSnapshot.docs[0].data();
                    employeePosition = employeeData.positionName;
                    
                    // Check if position is driver or security (overnight shift workers)
                    const overnightPositions = ['Driver', 'driver', 'Security', 'security', 'Security Guard', 'security guard'];
                    isOvernightWorker = overnightPositions.some(pos => 
                        employeePosition && employeePosition.toLowerCase().includes(pos.toLowerCase())
                    );
                }
            } catch (empError) {
                console.warn("Could not fetch employee data for overnight check:", empError.message);
            }
            
            // For overnight workers: check for ANY unchecked-in record (not just today)
            if (isOvernightWorker) {
                const allRecordsQuery = db.collection("employee-attendance")
                    .where("employeeId", "==", employeeId)
                    .orderBy("date", "desc")
                    .orderBy("timestamp", "desc")
                    .limit(10);
                
                const allRecordsSnapshot = await allRecordsQuery.get();
                
                // Check if there's any unchecked-in record
                for (const doc of allRecordsSnapshot.docs) {
                    const recordData = doc.data();
                    if (recordData.type === 'checkin' && !recordData.checkOutAt) {
                        return res.status(400).json({
                            success: false,
                            message: `You have an unchecked-in record from ${recordData.checkInDate || recordData.date}. Please check out first before checking in again.`
                        });
                    }
                }
            } else {
                // Regular workers: check today's record only
                if (!existingSnapshot.empty) {
                    const existingRecord = existingSnapshot.docs[0].data();
                    
                    // Check if already checked in today
                    if (existingRecord.type === 'checkin' && !existingRecord.checkOutAt) {
                        return res.status(400).json({
                            success: false,
                            message: "You have already checked in today. Please check out first."
                        });
                    }
                    
                    // Check if already checked out today
                    if (existingRecord.type === 'checkout') {
                        return res.status(400).json({
                            success: false,
                            message: "You have already completed your attendance for today."
                        });
                    }
                }
            }

            // Calculate working hours status
            let status = 'unknown';
            let lateMinutes = 0;

            try {
                // First, get employee data to find their position
                const employeeQuery = db.collection("employees")
                    .where("uid", "==", employeeId)
                    .limit(1);
                
                const employeeSnapshot = await employeeQuery.get();
                
                if (!employeeSnapshot.empty) {
                    const employeeData = employeeSnapshot.docs[0].data();
                    const employeePosition = employeeData.positionName; // e.g., "HR", "Programmer"
                    
                    console.log(`Employee ${employeeId} position: ${employeePosition}`);
                    
                    // Now get shift data for this position and date
                    // Try multiple possible field names for date
                    let shiftQuery = db.collection("shift-data")
                        .where("employeeId", "==", employeeId)
                        .where("assignDate", "==", dateString + " ")
                        .limit(1);
                    
                    let shiftSnapshot = await shiftQuery.get();
                    
                    // If not found, try with different date field
                    if (shiftSnapshot.empty) {
                        shiftQuery = db.collection("shift-data")
                            .where("employeeId", "==", employeeId)
                            .where("createdDate", "==", dateString + " ")
                            .limit(1);
                        shiftSnapshot = await shiftQuery.get();
                    }
                    
                    // If still not found, try by position and date
                    if (shiftSnapshot.empty) {
                        shiftQuery = db.collection("shift-data")
                            .where("positionName", "==", employeePosition)
                            .where("assignDate", "==", dateString + " ")
                            .limit(1);
                        shiftSnapshot = await shiftQuery.get();
                    }
                    
                    // If still not found, try position with different date field
                    if (shiftSnapshot.empty) {
                        shiftQuery = db.collection("shift-data")
                            .where("positionName", "==", employeePosition)
                            .where("createdDate", "==", dateString + " ")
                            .limit(1);
                        shiftSnapshot = await shiftQuery.get();
                    }
                    
                    // Last resort: try without date filter (just position) - this should rarely happen
                    if (shiftSnapshot.empty) {
                        shiftQuery = db.collection("shift-data")
                            .where("positionName", "==", employeePosition)
                            .limit(1);
                        shiftSnapshot = await shiftQuery.get();
                        console.log(`Warning: Using fallback shift for position ${employeePosition} - no date-specific shift found`);
                    }
                    
                    if (!shiftSnapshot.empty) {
                        const shiftData = shiftSnapshot.docs[0].data();
                        const startTime = shiftData.startTime; // e.g., "09:00"
                        
                        console.log(`Shift found for ${employeePosition}: ${startTime} - ${shiftData.endTime}`);
                        
                        // Calculate working hours status
                        const checkInTime = localTimeString; // e.g., "09:30:18"
                        const checkInMinutes = timeToMinutes(checkInTime);
                        const startMinutes = timeToMinutes(startTime);
                        const lateMinutesCalc = checkInMinutes - startMinutes;
                        
                        console.log(`Time calculation: Check-in ${checkInTime} (${checkInMinutes} min) vs Start ${startTime} (${startMinutes} min) = ${lateMinutesCalc} min late`);
                        
                        if (lateMinutesCalc === 0) {
                            // Check in time == Start time
                            status = 'on_time';
                            lateMinutes = 0;
                        } else if (lateMinutesCalc >= 1 && lateMinutesCalc <= 15) {
                            // Check in time is 1-15 minutes after start time
                            status = 'in_time';
                            lateMinutes = lateMinutesCalc;
                        } else if (lateMinutesCalc >= 16) {
                            // Check in time is 16+ minutes after start time
                            status = 'late';
                            lateMinutes = lateMinutesCalc;
                        } else {
                            // Check in before start time (early)
                            status = 'on_time';
                            lateMinutes = 0;
                        }
                    } else {
                        // No shift data found for this position and date
                        console.log(`No shift data found for position: ${employeePosition} on date: ${dateString}`);
                        status = 'no_shift_data';
                        lateMinutes = 0;
                    }
                } else {
                    // Employee not found
                    console.log(`Employee not found: ${employeeId}`);
                    status = 'employee_not_found';
                    lateMinutes = 0;
                }
            } catch (shiftError) {
                console.log("Could not fetch shift data:", shiftError.message);
                // Set default status when shift data cannot be fetched
                status = 'no_shift_data';
                lateMinutes = 0;
            }

            // Create new check-in record
            const uid = uuidV4();
            // Use checkInLocation from frontend, fallback to currentLocation, branchName, or branch
            const finalCurrentLocation = checkInLocation || currentLocation || branchName || branch || '';
            
            console.log(`📝 Saving check-in with checkInLocation="${checkInLocation || 'null'}", currentLocation="${finalCurrentLocation}"`);
            
            const checkRecord = {
                id: uid,
                uid: uid,
                employeeId: employeeId,
                employeeName: employeeName,
                location: location,
                branch: branch, 
                branchName: branchName,
                currentLocation: finalCurrentLocation, // Use from frontend or fallback
                checkInLocation: checkInLocation || null, // Save checkInLocation as separate field
                type: 'checkin',
                date: dateString,
                time: localTimeString,
                checkInAt: localTimeString,
                checkInDate: dateString, // Date when checked in (YYYY-MM-DD)
                checkOutAt: null,
                checkOutDate: null, // Will be set on check-out
                timestamp: thaiTime.toISOString(),
                createdAt: thaiTime.toISOString(),
                updatedAt: thaiTime.toISOString(),
                status: status,
                lateMinutes: lateMinutes
            };

            // Save to Firestore
            const checkRef = db.collection("employee-attendance").doc(uid);
            await checkRef.set(checkRecord);

            res.status(200).json({
                success: true,
                message: "Check In recorded successfully",
                data: {
                    id: uid,
                    employeeId: employeeId,
                    employeeName: employeeName,
                    location: location,
                    branch: branch,
                    branchName: branchName,
                    currentLocation: finalCurrentLocation,
                    checkInLocation: checkInLocation || null,
                    type: 'checkin',
                    date: dateString,
                    checkInAt: localTimeString,
                    checkInDate: dateString,
                    checkOutAt: null,
                    checkOutDate: null,
                    timestamp: currentDate.toISOString(),
                    status: status,
                    lateMinutes: lateMinutes
                }
            });

        } else if (type === 'checkout') {
            // CHECK OUT LOGIC
            // First, get employee data to check if they are driver or security (overnight shift workers)
            let employeePosition = null;
            let isOvernightWorker = false;
            
            try {
                const employeeQuery = db.collection("employees")
                    .where("uid", "==", employeeId)
                    .limit(1);
                
                const employeeSnapshot = await employeeQuery.get();
                
                if (!employeeSnapshot.empty) {
                    const employeeData = employeeSnapshot.docs[0].data();
                    employeePosition = employeeData.positionName;
                    
                    // Check if position is driver or security (overnight shift workers)
                    const overnightPositions = ['Driver', 'driver', 'Security', 'security', 'Security Guard', 'security guard'];
                    isOvernightWorker = overnightPositions.some(pos => 
                        employeePosition && employeePosition.toLowerCase().includes(pos.toLowerCase())
                    );
                    
                    console.log(`Employee ${employeeId} position: ${employeePosition}, isOvernightWorker: ${isOvernightWorker}`);
                }
            } catch (empError) {
                console.warn("Could not fetch employee data for overnight check:", empError.message);
            }
            
            let existingRecord = null;
            let existingData = null;
            
            // For overnight workers: look for most recent unchecked-in record (not just today)
            if (isOvernightWorker && existingSnapshot.empty) {
                console.log(`🔍 Overnight worker - searching for most recent unchecked-in record...`);
                
                // Get all attendance records for this employee, ordered by date descending
                const allRecordsQuery = db.collection("employee-attendance")
                    .where("employeeId", "==", employeeId)
                    .orderBy("date", "desc")
                    .orderBy("timestamp", "desc")
                    .limit(10);
                
                const allRecordsSnapshot = await allRecordsQuery.get();
                
                // Find the most recent check-in record that hasn't been checked out
                for (const doc of allRecordsSnapshot.docs) {
                    const recordData = doc.data();
                    if (recordData.type === 'checkin' && !recordData.checkOutAt) {
                        existingRecord = doc;
                        existingData = recordData;
                        console.log(`✅ Found unchecked-in record from ${recordData.date} (check-in date)`);
                        break;
                    }
                }
            } else if (!existingSnapshot.empty) {
                // Regular worker or found today's record
                existingRecord = existingSnapshot.docs[0];
                existingData = existingRecord.data();
            }
            
            if (!existingRecord || !existingData) {
                return res.status(400).json({
                    success: false,
                    message: isOvernightWorker 
                        ? "No unchecked-in record found. Please check in first."
                        : "No check-in record found for today. Please check in first."
                });
            }

            // Check if already checked out
            if (existingData.type === 'checkout' || existingData.checkOutAt) {
                return res.status(400).json({
                    success: false,
                    message: "You have already checked out for this shift."
                });
            }

            // Check if checked in (can check out)
            if (existingData.type === 'checkin' && !existingData.checkOutAt) {
                // Use checkOutLocation from frontend, fallback to currentLocation, branchName, branch, or existing value
                const finalCurrentLocation = checkOutLocation || currentLocation || branchName || branch || existingData.currentLocation || '';
                
                console.log(`📝 Saving check-out with checkOutLocation="${checkOutLocation || 'null'}", currentLocation="${finalCurrentLocation}"`);
                
                // Update existing record with checkout
                await existingRecord.ref.update({
                    type: 'checkout',
                    time: localTimeString,
                    checkOutAt: localTimeString,
                    checkOutDate: dateString, // Date when checked out (YYYY-MM-DD)
                    currentLocation: finalCurrentLocation, // Update currentLocation on checkout
                    checkOutLocation: checkOutLocation || null, // Save checkOutLocation as separate field
                    updatedAt: thaiTime.toISOString()
                });

                res.status(200).json({
                    success: true,
                    message: "Check Out recorded successfully",
                    data: {
                        id: existingRecord.id,
                        employeeId: employeeId,
                        employeeName: employeeName,
                        location: location,
                        branch: branch,
                        branchName: branchName,
                        currentLocation: finalCurrentLocation,
                        checkOutLocation: checkOutLocation || null,
                        type: 'checkout',
                        date: dateString, // Check-out date (today)
                        checkInAt: existingData.checkInAt,
                        checkInDate: existingData.checkInDate || existingData.date, // Check-in date (may be yesterday for overnight workers)
                        checkOutAt: localTimeString,
                        checkOutDate: dateString, // Check-out date (today)
                        isOvernightShift: isOvernightWorker && (existingData.checkInDate || existingData.date) !== dateString,
                        timestamp: thaiTime.toISOString()
                    }
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: "Invalid attendance state. Please check in first."
                });
            }
        }

    } catch (error) {
        console.error("Check In/Out error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Get employee check in/out history
const getCheckInOutHistory = async (req, res) => {
    console.log("Get check in/out history called", req.params, req.query);
    try {
        const { employeeId } = req.params;
        const { startDate, endDate, limit } = req.query;
        
        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: "Employee ID is required"
            });
        }

        const limitNum = limit ? parseInt(limit) : 50;
        const validLimit = isNaN(limitNum) || limitNum <= 0 ? 50 : Math.min(limitNum, 100); // Max 100 records

        let query = db.collection("employee-attendance")
            .where("employeeId", "==", employeeId);

        const snapshot = await query.get();
        
        if (snapshot.empty) {
            return res.status(404).json({
                success: false,
                message: "No attendance records found for this employee"
            });
        }

        const records = [];
        snapshot.forEach(doc => {
            records.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Sort records by date (newest first), then by time (newest first)
        records.sort((a, b) => {
            // First sort by date (newest first)
            if (a.date !== b.date) {
                return b.date.localeCompare(a.date);
            }
            
            // If same date, sort by time (newest first)
            return b.time.localeCompare(a.time);
        });

        // Apply limit
        const limitedRecords = records.slice(0, validLimit);

        console.log("limitedRecords", limitedRecords);

        res.status(200).json({
            success: true,
            message: "Attendance history retrieved successfully",
            count: limitedRecords.length,
            totalRecords: records.length,
            data: limitedRecords
        });

    } catch (error) {
        console.error("Get check in/out history error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Get ALL attendance history (for all employees)
const getAllAttendanceHistory = async (req, res) => {
    try {
        const { startDate, endDate, limit } = req.query;
        
        const limitNum = limit ? parseInt(limit) : 100;
        const validLimit = isNaN(limitNum) || limitNum <= 0 ? 100 : Math.min(limitNum, 500); // Max 500 records for all employees

        let query = db.collection("employee-attendance");

        // Add date range filter if provided
        if (startDate && endDate) {
            query = query
                .where("date", ">=", startDate)
                .where("date", "<=", endDate);
        }

        // Order by timestamp descending (newest first)
        query = query.orderBy("timestamp", "desc");

        const snapshot = await query.get();
        
        if (snapshot.empty) {
            return res.status(404).json({
                success: false,
                message: "No attendance records found"
            });
        }

        const records = [];
        snapshot.forEach(doc => {
            records.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Apply limit
        const limitedRecords = records.slice(0, validLimit);

        res.status(200).json({
            success: true,
            message: "All attendance history retrieved successfully",
            count: limitedRecords.length,
            totalRecords: records.length,
            data: limitedRecords
        });

    } catch (error) {
        console.error("Get all attendance history error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Get attendance by employee ID and specific date
const getAttendanceByEmployeeAndDate = async (req, res) => {
    try {
        const { employeeId, date } = req.params;
        const { limit } = req.query;
        
        if (!employeeId || !date) {
            return res.status(400).json({
                success: false,
                message: "Employee ID and date are required"
            });
        }

        const limitNum = limit ? parseInt(limit) : 50;
        const validLimit = isNaN(limitNum) || limitNum <= 0 ? 50 : Math.min(limitNum, 100);

        let query = db.collection("employee-attendance")
            .where("employeeId", "==", employeeId)
            .where("date", "==", date);

        // Order by timestamp descending (newest first)
        query = query.orderBy("timestamp", "desc");

        const snapshot = await query.get();
        
        if (snapshot.empty) {
            return res.status(404).json({
                success: false,
                message: "No attendance records found for this employee on this date"
            });
        }

        const records = [];
        snapshot.forEach(doc => {
            records.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Apply limit
        const limitedRecords = records.slice(0, validLimit);

        res.status(200).json({
            success: true,
            message: "Attendance records retrieved successfully",
            count: limitedRecords.length,
            totalRecords: records.length,
            data: limitedRecords
        });

    } catch (error) {
        console.error("Get attendance by employee and date error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Check if auto check-in is needed (forgot to check out)
const checkAutoCheckInNeeded = async (req, res) => {
    try {
        const { employeeId } = req.params;
        
        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: "Employee ID is required"
            });
        }

        const today = new Date().toISOString().split('T')[0];
        
        // Get today's attendance records for this employee
        const query = db.collection("employee-attendance")
            .where("employeeId", "==", employeeId)
            .where("date", "==", today);

        const snapshot = await query.get();
        
        if (snapshot.empty) {
            // No records today - can check in normally
            return res.json({
                success: true,
                needsAutoCheckIn: false,
                message: "No attendance records today - can check in normally",
                lastRecord: null
            });
        }

        const records = [];
        snapshot.forEach(doc => {
            records.push({
                id: doc.id,
                ...doc.data()
            });
        });

        const lastRecord = records[0];
        
        // Check if last action was check-in without check-out
        if (lastRecord.type === 'checkin' && !lastRecord.checkOutAt) {
            // Check if it's after 11:59 PM
            const now = new Date();
            const currentHour = now.getHours();
            
            if (currentHour >= 23 || currentHour < 6) {
                // Automatically create a checkout record for yesterday
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayString = yesterday.toISOString().split('T')[0];
                
                // Create automatic checkout record
                const autoCheckoutRecord = {
                    id: uuidV4(),
                    uid: uuidV4(),
                    employeeId: employeeId,
                    employeeName: lastRecord.employeeName,
                    location: lastRecord.location,
                    branch: lastRecord.branch,
                    branchName: lastRecord.branchName,
                    type: 'checkout',
                    date: yesterdayString,
                    time: '23:59:00', // Auto checkout at 11:59 PM
                    checkInAt: lastRecord.checkInAt || null,
                    checkInDate: lastRecord.checkInDate || lastRecord.date || yesterdayString,
                    checkOutAt: '23:59:00',
                    checkOutDate: yesterdayString,
                    timestamp: new Date(yesterdayString + 'T23:59:00.000Z').toISOString(),
                    createdAt: now.toISOString(),
                    updatedAt: now.toISOString(),
                    isAutoCheckout: true // Flag to indicate this was automatic
                };

                // Save automatic checkout
                const autoCheckoutRef = db.collection("employee-attendance").doc(autoCheckoutRecord.id);
                await autoCheckoutRef.set(autoCheckoutRecord);

                return res.json({
                    success: true,
                    needsAutoCheckIn: false,
                    message: "Auto checkout completed for yesterday - you can check in normally now",
                    autoCheckout: autoCheckoutRecord,
                    lastRecord: lastRecord
                });
            } else {
                return res.json({
                    success: true,
                    needsAutoCheckIn: false,
                    message: "Last check-in found but it's not time for auto checkout yet",
                    lastRecord: lastRecord
                });
            }
        } else if (lastRecord.type === 'checkout') {
            return res.json({
                success: true,
                needsAutoCheckIn: false,
                message: "Already checked out today - can check in normally",
                lastRecord: lastRecord
            });
        }

        return res.json({
            success: true,
            needsAutoCheckIn: false,
            message: "Normal check-in status",
            lastRecord: lastRecord
        });

    } catch (error) {
        console.error("Check auto check-in needed error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Get current attendance status for today
const getTodayAttendanceStatus = async (req, res) => {
    try {
        const { employeeId } = req.params;
        console.log("getTodayAttendanceStatus", req.params);
        
        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: "Employee ID is required"
            });
        }

        const today = new Date().toISOString().split('T')[0];
        
        // First, check if employee is driver or security (overnight shift workers)
        let isOvernightWorker = false;
        try {
            const employeeQuery = db.collection("employees")
                .where("uid", "==", employeeId)
                .limit(1);
            
            const employeeSnapshot = await employeeQuery.get();
            
            if (!employeeSnapshot.empty) {
                const employeeData = employeeSnapshot.docs[0].data();
                const employeePosition = employeeData.positionName;
                
                // Check if position is driver or security (overnight shift workers)
                const overnightPositions = ['Driver', 'driver', 'Security', 'security', 'Security Guard', 'security guard'];
                isOvernightWorker = overnightPositions.some(pos => 
                    employeePosition && employeePosition.toLowerCase().includes(pos.toLowerCase())
                );
            }
        } catch (empError) {
            console.warn("Could not fetch employee data:", empError.message);
        }
        
        // Get today's attendance record for this employee
        const query = db.collection("employee-attendance")
            .where("employeeId", "==", employeeId)
            .where("date", "==", today)
            .limit(1);

        const snapshot = await query.get();
        
        if (snapshot.empty) {
            // No record today - for overnight workers, check for unchecked-in record from previous days
            if (isOvernightWorker) {
                const allRecordsQuery = db.collection("employee-attendance")
                    .where("employeeId", "==", employeeId)
                    .orderBy("date", "desc")
                    .orderBy("timestamp", "desc")
                    .limit(10);
                
                const allRecordsSnapshot = await allRecordsQuery.get();
                
                // Find the most recent unchecked-in record
                for (const doc of allRecordsSnapshot.docs) {
                    const recordData = doc.data();
                    if (recordData.type === 'checkin' && !recordData.checkOutAt) {
                        // Found unchecked-in record from previous day - show checkout option
                        const checkInDate = recordData.checkInDate || recordData.date;
                        return res.json({
                            success: true,
                            status: "checked_in_previous_day",
                            action: "checkout",
                            message: `You have an unchecked-in record from ${checkInDate}. Please check out first, then you can check in for today.`,
                            buttonText: "Check Out",
                            canCheckIn: false, // Must check out first
                            canCheckOut: true,
                            record: {
                                id: doc.id,
                                uid: doc.id,
                                employeeId: recordData.employeeId,
                                employeeName: recordData.employeeName,
                                location: recordData.location,
                                branch: recordData.branch,
                                branchName: recordData.branchName,
                                type: recordData.type,
                                checkInAt: recordData.checkInAt,
                                checkInDate: checkInDate,
                                checkOutAt: recordData.checkOutAt,
                                checkOutDate: recordData.checkOutDate,
                                date: recordData.date,
                                time: recordData.time,
                                timestamp: recordData.timestamp,
                                createdAt: recordData.createdAt,
                                updatedAt: recordData.updatedAt,
                                isOvernightShift: true
                            }
                        });
                    }
                }
            }
            
            // No record today and no unchecked-in record - show check in
            return res.json({
                success: true,
                status: "no_record",
                action: "checkin",
                message: "No attendance record today - can check in",
                buttonText: "Check In",
                canCheckIn: true,
                canCheckOut: false,
                record: null
            });
        }

        const record = snapshot.docs[0].data();
        
        if (record.type === 'checkin' && !record.checkOutAt) {
            // Checked in but not checked out - show check out
            return res.json({
                success: true,
                status: "checked_in",
                action: "checkout",
                message: "Checked in today - can check out",
                buttonText: "Check Out",
                canCheckIn: false,
                canCheckOut: true,
                record: {
                    id: snapshot.docs[0].id,
                    uid: snapshot.docs[0].id,
                    employeeId: record.employeeId,
                    employeeName: record.employeeName,
                    location: record.location,
                    branch: record.branch,
                    branchName: record.branchName,
                    type: record.type,
                    checkInAt: record.checkInAt,
                    checkInDate: record.checkInDate,
                    checkOutAt: record.checkOutAt,
                    checkOutDate: record.checkOutDate,
                    date: record.date,
                    time: record.time,
                    timestamp: record.timestamp,
                    createdAt: record.createdAt,
                    updatedAt: record.updatedAt,
                    isAutoCheckout: record.isAutoCheckout
                }
            });
        } else if (record.type === 'checkout') {
            // Already checked out today - for overnight workers, check if they can check in for new shift
            if (isOvernightWorker) {
                // After checkout, they can check in for today
                return res.json({
                    success: true,
                    status: "checked_out",
                    action: "checkin",
                    message: "Already checked out. You can check in for a new shift.",
                    buttonText: "Check In",
                    canCheckIn: true,
                    canCheckOut: false,
                    record: {
                        id: snapshot.docs[0].id,
                        uid: snapshot.docs[0].id,
                        employeeId: record.employeeId,
                        employeeName: record.employeeName,
                        location: record.location,
                        branch: record.branch,
                        branchName: record.branchName,
                        type: record.type,
                        checkInAt: record.checkInAt,
                        checkInDate: record.checkInDate,
                        checkOutAt: record.checkOutAt,
                        checkOutDate: record.checkOutDate,
                        date: record.date,
                        time: record.time,
                        timestamp: record.timestamp,
                        createdAt: record.createdAt,
                        updatedAt: record.updatedAt,
                        isAutoCheckout: record.isAutoCheckout
                    }
                });
            } else {
                // Regular workers - already completed for today
                return res.json({
                    success: true,
                    status: "checked_out",
                    action: "completed",
                    message: "Already completed attendance for today",
                    buttonText: "Completed",
                    canCheckIn: false,
                    canCheckOut: false,
                    record: {
                        id: snapshot.docs[0].id,
                        uid: snapshot.docs[0].id,
                        employeeId: record.employeeId,
                        employeeName: record.employeeName,
                        location: record.location,
                        branch: record.branch,
                        branchName: record.branchName,
                        type: record.type,
                        checkInAt: record.checkInAt,
                        checkInDate: record.checkInDate,
                        checkOutAt: record.checkOutAt,
                        checkOutDate: record.checkOutDate,
                        date: record.date,
                        time: record.time,
                        timestamp: record.timestamp,
                        createdAt: record.createdAt,
                        updatedAt: record.updatedAt,
                        isAutoCheckout: record.isAutoCheckout
                    }
                });
            }
        }

        // Fallback
        return res.json({
            success: true,
            status: "unknown",
            action: "checkin",
            message: "Unknown status - can check in",
            buttonText: "Check In",
            canCheckIn: true,
            canCheckOut: false,
            record: {
                id: snapshot.docs[0].id,
                uid: snapshot.docs[0].id,
                employeeId: record.employeeId,
                employeeName: record.employeeName,
                location: record.location,
                branch: record.branch,
                branchName: record.branchName,
                type: record.type,
                timestamp: record.timestamp,
                createdAt: record.createdAt,
                updatedAt: record.updatedAt,
                isAutoCheckout: record.isAutoCheckout,
                ...record
               
               
            }
        });

        console.log("getTodayAttendanceStatus responxe", res.json);
    } catch (error) {
        console.error("Get today attendance status error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

const getAttendanceByEmployeeId = async (req, res) => {
    try {
        const { employeeId } = req.params;
        console.log("getAttendanceByEmployeeId", req.params);
        const { startDate, endDate, limit } = req.query;
        
        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: "Employee ID is required"
            });
        }

        const limitNum = limit ? parseInt(limit) : 50;
        const validLimit = isNaN(limitNum) || limitNum <= 0 ? 50 : Math.min(limitNum, 100);

        let query = db.collection("employee-attendance")
            .where("employeeId", "==", employeeId);
            
        if (startDate && endDate) {
            query = query
                .where("date", ">=", startDate)
                .where("date", "<=", endDate);
        }

        const snapshot = await query.get();
        const records = [];
        
        snapshot.forEach(doc => {
            records.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Sort records by date (newest first), then by time (newest first)
        records.sort((a, b) => {
            // First sort by date (newest first)
            if (a.date !== b.date) {
                return b.date.localeCompare(a.date);
            }
            
            // If same date, sort by time (newest first)
            return b.time.localeCompare(a.time);
        });

        const limitedRecords = records.slice(0, validLimit);
        
        res.status(200).json({
            success: true,
            message: "Attendance records retrieved successfully",
            count: limitedRecords.length,
            totalRecords: records.length,
            data: limitedRecords
        });
        
        console.log("limitedRecords", limitedRecords);
        
    }
    catch (error) {
        console.error("Get attendance by employee id error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Get logged-in employee attendance history with year/month filtering
const getMyAttendanceHistory = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { year, month, limit } = req.query;
        
        console.log("getMyAttendanceHistory called", { employeeId, year, month, limit });
        
        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: "Employee ID is required"
            });
        }

        const limitNum = limit ? parseInt(limit) : 100;
        const validLimit = isNaN(limitNum) || limitNum <= 0 ? 100 : Math.min(limitNum, 200);

        // First, get all records for the employee (without date filtering to avoid index issues)
        let query = db.collection("employee-attendance")
            .where("employeeId", "==", employeeId);

        const snapshot = await query.get();
        
        if (snapshot.empty) {
            return res.status(404).json({
                success: false,
                message: "No attendance records found for this employee"
            });
        }

        const records = [];
        snapshot.forEach(doc => {
            records.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Apply year/month filtering in memory to avoid Firebase index issues
        let filteredRecords = records;
        
        if (year && month) {
            // Validate year and month
            const yearNum = parseInt(year);
            const monthNum = parseInt(month);
            
            if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2030) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid year. Must be between 2020-2030"
                });
            }
            
            if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid month. Must be between 1-12"
                });
            }

            // Filter by year and month
            const targetYear = year.toString();
            const targetMonth = month.toString().padStart(2, '0');
            
            filteredRecords = records.filter(record => {
                const recordDate = record.date; // Format: YYYY-MM-DD
                return recordDate.startsWith(`${targetYear}-${targetMonth}`);
            });
                
            console.log(`Filtering by year: ${year}, month: ${month}`);
            console.log(`Filtered records: ${filteredRecords.length} out of ${records.length}`);
        } else if (year && !month) {
            // Filter by year only
            const yearNum = parseInt(year);
            
            if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2030) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid year. Must be between 2020-2030"
                });
            }

            const targetYear = year.toString();
            filteredRecords = records.filter(record => {
                const recordDate = record.date; // Format: YYYY-MM-DD
                return recordDate.startsWith(targetYear);
            });
                
            console.log(`Filtering by year: ${year}`);
            console.log(`Filtered records: ${filteredRecords.length} out of ${records.length}`);
        }

        if (filteredRecords.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No attendance records found for the specified period"
            });
        }

        // Sort filtered records by date (newest first), then by time (newest first)
        filteredRecords.sort((a, b) => {
            // First sort by date (newest first)
            if (a.date !== b.date) {
                return b.date.localeCompare(a.date);
            }
            
            // If same date, sort by time (newest first)
            return b.time.localeCompare(a.time);
        });

        // Apply limit
        const limitedRecords = filteredRecords.slice(0, validLimit);

        // Calculate summary statistics
        const summary = {
            totalDays: new Set(filteredRecords.map(r => r.date)).size,
            totalRecords: filteredRecords.length,
            checkInCount: filteredRecords.filter(r => r.type === 'checkin').length,
            checkOutCount: filteredRecords.filter(r => r.type === 'checkout').length,
            lateCount: filteredRecords.filter(r => r.status === 'late').length,
            onTimeCount: filteredRecords.filter(r => r.status === 'on_time').length,
            earlyCount: filteredRecords.filter(r => r.status === 'early').length
        };

        res.status(200).json({
            success: true,
            message: "My attendance history retrieved successfully",
            count: limitedRecords.length,
            totalRecords: filteredRecords.length,
            summary: summary,
            filters: {
                year: year || null,
                month: month || null,
                limit: validLimit
            },
            data: limitedRecords
        });
        
        console.log("My attendance history retrieved:", {
            employeeId,
            totalRecords: filteredRecords.length,
            limitedRecords: limitedRecords.length,
            summary
        });
        
    } catch (error) {
        console.error("Get my attendance history error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Search employee attendance by name/query with date, year, or month filter
const searchEmployeeAttendance = async (req, res) => {
    try {
        const { query, startDate, endDate, year, month, limit } = req.query;
        
        console.log("searchEmployeeAttendance called", { query, startDate, endDate, year, month, limit });
        
        const limitNum = limit ? parseInt(limit) : 100;
        const validLimit = isNaN(limitNum) || limitNum <= 0 ? 100 : Math.min(limitNum, 500);

        let employeeIds = [];
        
        // Step 1: Search employees by query (name, ID, etc.)
        if (query && query.trim()) {
            const searchQuery = query.trim().toLowerCase();
            
            // Search in employees collection
            const employeesSnapshot = await db.collection("employees").get();
            
            employeesSnapshot.forEach(doc => {
                const employeeData = doc.data();
                const employeeName = (employeeData.name || '').toLowerCase();
                const employeeId = (employeeData.uid || '').toLowerCase();
                const employeeCode = (employeeData.employeeCode || '').toLowerCase();
                
                // Check if query matches name, ID, or employee code
                if (employeeName.includes(searchQuery) || 
                    employeeId.includes(searchQuery) || 
                    employeeCode.includes(searchQuery)) {
                    employeeIds.push(employeeData.uid);
                }
            });
            
            console.log(`Found ${employeeIds.length} employees matching query: "${query}"`);
            
            if (employeeIds.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: `No employees found matching "${query}"`
                });
            }
        } else {
            // If no query provided, get all employees
            const employeesSnapshot = await db.collection("employees").get();
            employeesSnapshot.forEach(doc => {
                employeeIds.push(doc.data().uid);
            });
            console.log(`No query provided, searching all ${employeeIds.length} employees`);
        }

        // Step 2: Get attendance records for found employees
        const allAttendanceRecords = [];
        
        for (const employeeId of employeeIds) {
            let attendanceQuery = db.collection("employee-attendance")
                .where("employeeId", "==", employeeId);
            
            const attendanceSnapshot = await attendanceQuery.get();
            
            attendanceSnapshot.forEach(doc => {
                allAttendanceRecords.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
        }
        
        console.log(`Retrieved ${allAttendanceRecords.length} total attendance records`);
        
        if (allAttendanceRecords.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No attendance records found"
            });
        }

        // Step 3: Apply date filtering
        let filteredRecords = allAttendanceRecords;
        
        if (startDate && endDate) {
            filteredRecords = allAttendanceRecords.filter(record => {
                const recordDate = record.date; // Format: YYYY-MM-DD
                return recordDate >= startDate && recordDate <= endDate;
            });
            console.log(`Date filtered: ${filteredRecords.length} records between ${startDate} and ${endDate}`);
        } else if (startDate) {
            filteredRecords = allAttendanceRecords.filter(record => {
                const recordDate = record.date;
                return recordDate >= startDate;
            });
            console.log(`Date filtered: ${filteredRecords.length} records from ${startDate}`);
        } else if (endDate) {
            filteredRecords = allAttendanceRecords.filter(record => {
                const recordDate = record.date;
                return recordDate <= endDate;
            });
            console.log(`Date filtered: ${filteredRecords.length} records until ${endDate}`);
        }

        // Step 4: Apply year/month filtering
        let finalRecords = filteredRecords;
        
        if (year && month) {
            // Validate year and month
            const yearNum = parseInt(year);
            const monthNum = parseInt(month);
            
            if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2030) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid year. Must be between 2020-2030"
                });
            }
            
            if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid month. Must be between 1-12"
                });
            }

            // Filter by year and month
            const targetYear = year.toString();
            const targetMonth = month.toString().padStart(2, '0');
            
            finalRecords = filteredRecords.filter(record => {
                const recordDate = record.date; // Format: YYYY-MM-DD
                return recordDate.startsWith(`${targetYear}-${targetMonth}`);
            });
                
            console.log(`Year/Month filtered: ${finalRecords.length} records for ${year}-${month}`);
        } else if (year && !month) {
            // Filter by year only
            const yearNum = parseInt(year);
            
            if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2030) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid year. Must be between 2020-2030"
                });
            }

            const targetYear = year.toString();
            finalRecords = filteredRecords.filter(record => {
                const recordDate = record.date; // Format: YYYY-MM-DD
                return recordDate.startsWith(targetYear);
            });
                
            console.log(`Year filtered: ${finalRecords.length} records for ${year}`);
        }

        if (finalRecords.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No attendance records found for the specified criteria"
            });
        }

        // Step 5: Sort by date (newest first), then by time (newest first)
        finalRecords.sort((a, b) => {
            // First sort by date (newest first)
            if (a.date !== b.date) {
                return b.date.localeCompare(a.date);
            }
            
            // If same date, sort by time (newest first)
            return b.time.localeCompare(a.time);
        });

        // Step 6: Apply limit
        const limitedRecords = finalRecords.slice(0, validLimit);

        // Step 7: Get employee details for the records
        const employeeDetails = {};
        for (const employeeId of employeeIds) {
            const employeeSnapshot = await db.collection("employees")
                .where("uid", "==", employeeId)
                .limit(1)
                .get();
            
            if (!employeeSnapshot.empty) {
                const employeeData = employeeSnapshot.docs[0].data();
                employeeDetails[employeeId] = {
                    name: employeeData.name,
                    employeeCode: employeeData.employeeCode,
                    position: employeeData.positionName
                };
            }
        }

        // Step 8: Add employee details to records
        const enrichedRecords = limitedRecords.map(record => ({
            ...record,
            employeeDetails: employeeDetails[record.employeeId] || {
                name: record.employeeName,
                employeeCode: 'N/A',
                position: 'N/A'
            }
        }));

        // Step 9: Calculate summary statistics
        const summary = {
            totalEmployees: employeeIds.length,
            totalRecords: finalRecords.length,
            checkInCount: finalRecords.filter(r => r.type === 'checkin').length,
            checkOutCount: finalRecords.filter(r => r.type === 'checkout').length,
            lateCount: finalRecords.filter(r => r.status === 'late').length,
            onTimeCount: finalRecords.filter(r => r.status === 'on_time').length,
            earlyCount: finalRecords.filter(r => r.status === 'early').length
        };

        res.status(200).json({
            success: true,
            message: "Employee attendance search completed successfully",
            count: enrichedRecords.length,
            totalRecords: finalRecords.length,
            summary: summary,
            filters: {
                query: query || null,
                startDate: startDate || null,
                endDate: endDate || null,
                year: year || null,
                month: month || null,
                limit: validLimit
            },
            data: enrichedRecords
        });
        
        console.log("Employee attendance search completed:", {
            query,
            year,
            month,
            totalEmployees: employeeIds.length,
            totalRecords: finalRecords.length,
            limitedRecords: enrichedRecords.length,
            summary
        });
        
    } catch (error) {
        console.error("Search employee attendance error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Simple search by name with optional date or year/month filter
const searchAttendanceByName = async (req, res) => {
    try {
        const { name, date, year, month, limit } = req.query;
        
        console.log("searchAttendanceByName called", { name, date, year, month, limit });

        const limitNum = limit ? parseInt(limit) : 100;
        const validLimit = isNaN(limitNum) || limitNum <= 0 ? 100 : Math.min(limitNum, 500);

        const hasNameFilter = name && name.trim();
        const searchQuery = hasNameFilter ? name.trim().toLowerCase() : '';
        
        // Step 1: Get all attendance records
        const attendanceSnapshot = await db.collection("employee-attendance").get();
        const allRecords = [];
        const uniqueEmployees = new Set();
        
        attendanceSnapshot.forEach(doc => {
            const attendanceData = doc.data();
            
            // If name filter is provided, check if employeeName includes the search query
            if (hasNameFilter) {
                const employeeName = (attendanceData.employeeName || '').toLowerCase();
                
                if (employeeName.includes(searchQuery)) {
                    allRecords.push({
                        id: doc.id,
                        ...attendanceData
                    });
                    uniqueEmployees.add(attendanceData.employeeId);
                }
            } else {
                // No name filter - include all records
                allRecords.push({
                    id: doc.id,
                    ...attendanceData
                });
                uniqueEmployees.add(attendanceData.employeeId);
            }
        });
        
        const logMessage = hasNameFilter 
            ? `Found ${allRecords.length} attendance records matching "${name}" for ${uniqueEmployees.size} employees`
            : `Found ${allRecords.length} total attendance records for ${uniqueEmployees.size} employees`;
        
        console.log(logMessage);
        
        if (allRecords.length === 0) {
            return res.status(404).json({
                success: false,
                message: hasNameFilter 
                    ? `No attendance records found matching "${name}"`
                    : "No attendance records found"
            });
        }

        // Step 3: Apply date filter if provided
        let filteredRecords = allRecords;
        
        if (date) {
            // Filter by specific date (YYYY-MM-DD format)
            filteredRecords = allRecords.filter(record => {
                return record.date === date;
            });
            console.log(`Filtered by date ${date}: ${filteredRecords.length} records`);
        }
        
        // Step 4: Apply year/month filter if provided
        else if (year && month) {
            // Validate year and month
            const yearNum = parseInt(year);
            const monthNum = parseInt(month);
            
            if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2030) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid year. Must be between 2020-2030"
                });
            }
            
            if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid month. Must be between 1-12"
                });
            }

            const targetYear = year.toString();
            const targetMonth = month.toString().padStart(2, '0');
            
            filteredRecords = allRecords.filter(record => {
                return record.date.startsWith(`${targetYear}-${targetMonth}`);
            });
                
            console.log(`Filtered by year/month ${year}-${month}: ${filteredRecords.length} records`);
        }
        
        else if (year) {
            // Validate year
            const yearNum = parseInt(year);
            
            if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2030) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid year. Must be between 2020-2030"
                });
            }

            const targetYear = year.toString();
            filteredRecords = allRecords.filter(record => {
                return record.date.startsWith(targetYear);
            });
                
            console.log(`Filtered by year ${year}: ${filteredRecords.length} records`);
        }

        if (filteredRecords.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No attendance records found for the specified criteria"
            });
        }

        // Step 5: Sort by date (newest first), then by time (newest first)
        filteredRecords.sort((a, b) => {
            if (a.date !== b.date) {
                return b.date.localeCompare(a.date);
            }
            return b.time.localeCompare(a.time);
        });

        // Step 6: Apply limit
        const limitedRecords = filteredRecords.slice(0, validLimit);

        // Step 7: Calculate summary statistics
        const summary = {
            totalEmployees: uniqueEmployees.size,
            totalRecords: filteredRecords.length,
            checkInCount: filteredRecords.filter(r => r.type === 'checkin').length,
            checkOutCount: filteredRecords.filter(r => r.type === 'checkout').length,
            lateCount: filteredRecords.filter(r => r.status === 'late').length,
            onTimeCount: filteredRecords.filter(r => r.status === 'on_time').length,
            earlyCount: filteredRecords.filter(r => r.status === 'early').length
        };

        res.status(200).json({
            success: true,
            message: "Attendance records retrieved successfully",
            count: limitedRecords.length,
            totalRecords: filteredRecords.length,
            summary: summary,
            filters: {
                name: name,
                date: date || null,
                year: year || null,
                month: month || null,
                limit: validLimit
            },
            data: limitedRecords
        });
        
        console.log("Attendance search completed:", {
            name,
            date,
            year,
            month,
            totalEmployees: uniqueEmployees.size,
            totalRecords: filteredRecords.length,
            limitedRecords: limitedRecords.length
        });
        
    } catch (error) {
        console.error("Search attendance by name error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

module.exports = {
    checkInOut,
    getCheckInOutHistory,
    getAllAttendanceHistory,
    getAttendanceByEmployeeAndDate,
    checkAutoCheckInNeeded,
    getTodayAttendanceStatus,
    getAttendanceByEmployeeId,
    getMyAttendanceHistory,
    searchEmployeeAttendance,
    searchAttendanceByName
};
