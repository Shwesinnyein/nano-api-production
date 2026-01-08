const { db } = require("../config/firebaseConfig");

/**
 * Compare two version strings (e.g., "1.2.3")
 * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 */
const compareVersions = (v1, v2) => {
    if (!v1 || !v2) return 0;
    
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    const maxLength = Math.max(parts1.length, parts2.length);
    
    for (let i = 0; i < maxLength; i++) {
        const part1 = parts1[i] || 0;
        const part2 = parts2[i] || 0;
        
        if (part1 < part2) return -1;
        if (part1 > part2) return 1;
    }
    
    return 0;
};

/**
 * Get app version information
 * GET /app/version?currentVersion=1.0.0&platform=android
 */
const getAppVersion = async (req, res) => {
    try {
        const { currentVersion, platform } = req.query; // platform: "android" or "ios"
        
        // Get app version settings from Firestore
        // You can store this in a collection like "app-settings" or "app-config"
        const appSettingsRef = db.collection("app-settings").doc("version");
        const appSettingsDoc = await appSettingsRef.get();
        
        if (!appSettingsDoc.exists) {
            // Default values if not configured in Firestore
            const defaultSettings = {
                latestVersion: "1.1.1",
                minAppVersion: "1.1.0",
                updateUrl: {
                    
                    android: "https://play.google.com/store/apps/details?id=com.nano.hr",
                    ios: "https://apps.apple.com/app/nano-work/id6754095921"
                },
                forceUpdate: false,
                updateMessage: "A new version is available. Please update to continue.",
                updateMessageTh: "มีเวอร์ชันใหม่ กรุณาอัปเดตเพื่อใช้งานต่อ"
            };
            
            // Create default document
            await appSettingsRef.set(defaultSettings);
            
            // Get platform-specific store URL
            let storeUrl = null;
            if (platform) {
                const platformLower = platform.toLowerCase();
                if (platformLower === 'android' && defaultSettings.updateUrl.android) {
                    storeUrl = defaultSettings.updateUrl.android;
                } else if (platformLower === 'ios' && defaultSettings.updateUrl.ios) {
                    storeUrl = defaultSettings.updateUrl.ios;
                }
            }
            
            return res.json({
                success: true,
                data: {
                    ...defaultSettings,
                    currentVersion: currentVersion || null,
                    storeUrl, // Platform-specific URL
                    updateAvailable: currentVersion ? compareVersions(currentVersion, defaultSettings.latestVersion) < 0 : false,
                    forceUpdate: currentVersion ? compareVersions(currentVersion, defaultSettings.minAppVersion) < 0 : false
                }
            });
        }
        
        const appSettings = appSettingsDoc.data();
        const latestVersion = appSettings.latestVersion || "1.0.0";
        const minAppVersion = appSettings.minAppVersion || "1.0.0";
        const updateUrl = appSettings.updateUrl || {
            android: "https://play.google.com/store/apps/details?id=com.nano.hr",
                    ios: "https://apps.apple.com/app/nano-work/id6754095921"
        };
        const updateMessage = appSettings.updateMessage || "A new version is available. Please update to continue.";
        const updateMessageTh = appSettings.updateMessageTh || "มีเวอร์ชันใหม่ กรุณาอัปเดตเพื่อใช้งานต่อ";
        
        // Compare versions if currentVersion is provided
        let updateAvailable = false;
        let forceUpdate = false;
        
        if (currentVersion) {
            updateAvailable = compareVersions(currentVersion, latestVersion) < 0;
            forceUpdate = compareVersions(currentVersion, minAppVersion) < 0;
        }
        
        // Get platform-specific store URL
        let storeUrl = null;
        if (platform) {
            const platformLower = platform.toLowerCase();
            if (platformLower === 'android' && updateUrl.android) {
                storeUrl = updateUrl.android;
            } else if (platformLower === 'ios' && updateUrl.ios) {
                storeUrl = updateUrl.ios;
            }
        }
        
        res.json({
            success: true,
            data: {
                latestVersion,
                minAppVersion,
                currentVersion: currentVersion || null,
                updateUrl,
                storeUrl, // Platform-specific URL (null if platform not provided or invalid)
                updateMessage,
                updateMessageTh,
                updateAvailable,
                forceUpdate
            }
        });
        
    } catch (error) {
        console.error("❌ Error getting app version:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

module.exports = {
    getAppVersion
};

