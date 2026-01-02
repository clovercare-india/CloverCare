// Script to create an admin user in Firestore using Firebase Admin SDK
// Run this with: node create-admin.js
//
// Prerequisites:
// 1. Set up a service account key from Firebase Console:
//    - Go to Project Settings > Service Accounts
//    - Click "Generate New Private Key"
//    - Save the JSON file as 'serviceAccountKey.json' in this directory
// 2. Or set GOOGLE_APPLICATION_CREDENTIALS environment variable
//
// Usage:
//   node create-admin.js <email> [name] [phone]
//
// Examples:
//   node create-admin.js admin@example.com
//   node create-admin.js admin@example.com "John Doe" "+1234567890"

import 'dotenv/config';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin SDK
function initializeFirebaseAdmin() {
    try {
        // Try to initialize with service account file
        const serviceAccountPath = join(__dirname, 'serviceAccountKey.json');
        let credential;
        
        try {
            const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
            credential = admin.credential.cert(serviceAccount);
        } catch (fileError) {
            // Fall back to environment credentials
            if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                credential = admin.credential.applicationDefault();
            } else {
                console.error("❌ Firebase Admin SDK credentials not found!");
                console.log("\n📋 Setup Instructions:");
                console.log("1. Go to Firebase Console > Project Settings > Service Accounts");
                console.log("2. Click 'Generate New Private Key'");
                console.log("3. Save the file as 'serviceAccountKey.json' in this directory");
                console.log("   OR set GOOGLE_APPLICATION_CREDENTIALS environment variable");
                process.exit(1);
            }
        }

        admin.initializeApp({
            credential: credential,
            projectId: process.env.FIREBASE_PROJECT_ID
        });

        console.log("✅ Firebase Admin SDK initialized successfully");
        return admin.firestore();
    } catch (error) {
        console.error("❌ Error initializing Firebase Admin SDK:", error.message);
        process.exit(1);
    }
}

// Prompt user for input
function prompt(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

// Validate email format
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

async function createAdminUser() {
    try {
        console.log("\n🔧 Clover Care Admin User Creation Tool");
        console.log("=====================================\n");

        const db = initializeFirebaseAdmin();

        // Get email from command line or prompt
        let email = process.argv[2];
        if (!email) {
            email = await prompt("Enter admin email (must match Google account): ");
        }

        email = email.trim();
        if (!isValidEmail(email)) {
            console.error("❌ Invalid email format");
            process.exit(1);
        }

        // Get name from command line or prompt
        let name = process.argv[3];
        if (!name) {
            name = await prompt("Enter admin name (optional, press Enter to skip): ");
        }
        name = name.trim() || "Admin User";

        // Get phone from command line or prompt
        let phone = process.argv[4];
        if (!phone) {
            phone = await prompt("Enter phone number (optional, press Enter to skip): ");
        }
        phone = phone.trim() || "";

        console.log("\n📝 Creating admin user with:");
        console.log("   Email:", email);
        console.log("   Name:", name);
        console.log("   Phone:", phone || "(not provided)");

        // Check if user already exists
        const existingUsers = await db.collection('users')
            .where('email', '==', email)
            .limit(1)
            .get();

        let userId;
        if (!existingUsers.empty) {
            const existingUser = existingUsers.docs[0];
            userId = existingUser.id;
            const userData = existingUser.data();
            
            if (userData.role === 'admin') {
                console.log("\n⚠️  User already exists with admin role");
                const overwrite = await prompt("Do you want to update this user? (yes/no): ");
                if (overwrite.toLowerCase() !== 'yes' && overwrite.toLowerCase() !== 'y') {
                    console.log("❌ Operation cancelled");
                    process.exit(0);
                }
            } else {
                console.log(`\n⚠️  User exists with role: ${userData.role}`);
                const upgrade = await prompt("Upgrade this user to admin? (yes/no): ");
                if (upgrade.toLowerCase() !== 'yes' && upgrade.toLowerCase() !== 'y') {
                    console.log("❌ Operation cancelled");
                    process.exit(0);
                }
            }
        } else {
            // Generate a new user ID
            userId = db.collection('users').doc().id;
        }

        // Create or update admin user document
        const adminData = {
            userId: userId,
            name: name,
            email: email,
            role: "admin",
            status: "active",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (phone) {
            adminData.phone = phone;
        }

        // Add createdAt only for new users
        if (existingUsers.empty) {
            adminData.createdAt = admin.firestore.FieldValue.serverTimestamp();
        }

        await db.collection('users').doc(userId).set(adminData, { merge: true });

        console.log("\n✅ Admin user created/updated successfully!");
        console.log("=====================================");
        console.log("User ID:", userId);
        console.log("Email:", email);
        console.log("Name:", name);
        console.log("Role: admin");
        console.log("Status: active");
        console.log("\n💡 The user can now sign in to the admin panel using Google Sign-In");
        console.log("   with the email:", email);
        
        process.exit(0);
    } catch (error) {
        console.error("\n❌ Error creating admin user:", error.message);
        if (error.stack) {
            console.error("\nStack trace:", error.stack);
        }
        process.exit(1);
    }
}

createAdminUser();
