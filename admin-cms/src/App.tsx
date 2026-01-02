import React, { useMemo } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { doc, collection, getDoc, getFirestore } from "firebase/firestore";
import {
    FireCMS,
    NavigationRoutes,
    Scaffold,
    SideDialogs,
    SnackbarProvider,
    CircularProgressCenter,
    useBuildLocalConfigurationPersistence,
    useBuildModeController,
    useBuildNavigationController,
    useValidateAuthenticator
} from "@firecms/core";
import {
    FirebaseAuthController,
    FirebaseLoginView,
    FirebaseSignInProvider,
    useFirebaseAuthController,
    useFirebaseStorageSource,
    useFirestoreDelegate,
    useInitialiseFirebase,
} from "@firecms/firebase";
import { CenteredView } from "@firecms/ui";

import { firebaseConfig } from "./firebase_config";
import { seniorsCollection } from "./collections/seniors";
import { careManagersCollection } from "./collections/careManagers";
import { familiesCollection } from "./collections/families";
import { alertsCollection } from "./collections/alerts";
import { allUsersCollection } from "./collections/allUsers";
import { carerTasksCollection } from "./collections/carerTasks";
import { remindersCollection } from "./collections/reminders";
import { routinesCollection } from "./collections/routines";

// Custom Views imports
import { Dashboard } from "./components/admin/Dashboard";
import { Alerts } from "./components/admin/Alerts";
import { Seniors } from "./components/admin/Seniors";
import { SeniorProfile } from "./components/admin/SeniorProfile";
import { CareManagers } from "./components/admin/CareManagers";
import { CareManagerProfile } from "./components/admin/CareManagerProfile";
import { Family } from "./components/admin/Family";
import { FamilyProfile } from "./components/admin/FamilyProfile";
import { Admins } from "./components/admin/Admins";
import { AdminProfile } from "./components/admin/AdminProfile";
import { CMSWelcome } from "./components/admin/CMSWelcome";

import { FilterProvider } from "./contexts/FilterContext";

function App() {
    // 1. Define Collections
    const collections = useMemo(() => [
        seniorsCollection,
        careManagersCollection,
        familiesCollection,
        alertsCollection,
        allUsersCollection,
        carerTasksCollection,
        remindersCollection,
        routinesCollection,
    ], []);

    // 2. Initialise Firebase
    const {
        firebaseApp,
        firebaseConfigLoading,
        configError
    } = useInitialiseFirebase({
        firebaseConfig
    });

    // 3. Auth Controller
    const signInOptions: FirebaseSignInProvider[] = ["google.com"];
    const authController: FirebaseAuthController = useFirebaseAuthController({
        firebaseApp,
        signInOptions
    });

    // 4. Data & Storage Delegates
    const firestoreDelegate = useFirestoreDelegate({ firebaseApp });
    const storageSource = useFirebaseStorageSource({ firebaseApp });

    // 5. User Config Persistence (Local Storage)
    const userConfigPersistence = useBuildLocalConfigurationPersistence();

    // 6. Mode Controller (Dark/Light)
    const modeController = useBuildModeController();

    // 7. Navigation Controller
    const navigationController = useBuildNavigationController({
        collections,
        authController,
        dataSourceDelegate: firestoreDelegate,
        basePath: "/" // Standard base path
    });

    // 8. Auth Validation
    const myAuthenticator: any = React.useCallback(async ({ user }: any) => {
        if (!user?.email) {
            console.warn("No user email found");
            return false;
        }
        
        console.log("Authenticating user:", user.email);
        
        try {
            // Get Firestore instance directly from Firebase app
            if (!firebaseApp) {
                console.error("Firebase app not initialized");
                return false;
            }
            const db = getFirestore(firebaseApp);
            const usersCollection = collection(db, "users");
            // Use email as document ID directly
            const userDocRef = doc(usersCollection, user.email);
            const userSnapshot = await getDoc(userDocRef);
            
            console.log("User snapshot exists:", userSnapshot.exists());
            
            if (!userSnapshot.exists()) {
                console.warn("User document not found in Firestore:", user.email);
                return false;
            }
            
            const userDoc = userSnapshot.data();
            console.log("User data:", userDoc);
            console.log("User role:", userDoc?.role);
            
            const isAdmin = userDoc?.role === "admin";
            console.log("Is admin:", isAdmin);
            
            return isAdmin;
        } catch (error) {
            console.error("Error during authentication:", error);
            return false;
        }
    }, [firebaseApp]);

    const {
        authLoading,
        canAccessMainView,
        notAllowedError
    } = useValidateAuthenticator({
        authController,
        authenticator: myAuthenticator,
        dataSourceDelegate: firestoreDelegate,
        storageSource
    });

    // --- RENDER ---

    if (firebaseConfigLoading || !firebaseApp) {
        return <CircularProgressCenter />;
    }

    if (configError) {
        return <CenteredView>{configError}</CenteredView>;
    }

    return (
        <FilterProvider>
            <SnackbarProvider>
                <FireCMS
                    navigationController={navigationController}
                    authController={authController}
                    userConfigPersistence={userConfigPersistence}
                    dataSourceDelegate={firestoreDelegate}
                    storageSource={storageSource}
                >
                    {({ loading }) => {
                        if (loading || authLoading) {
                            return <CircularProgressCenter />;
                        }

                        if (!canAccessMainView) {
                            return (
                                <FirebaseLoginView
                                    authController={authController}
                                    firebaseApp={firebaseApp}
                                    signInOptions={signInOptions}
                                    notAllowedError={notAllowedError}
                                />
                            );
                        }

                        return (
                            <Scaffold>
                                <Routes>
                                    {/* Custom Admin Routes */}
                                    <Route path="/" element={<Dashboard />} />
                                    <Route path="/alerts" element={<Alerts />} />

                                    <Route path="/seniors" element={<Seniors />} />
                                    <Route path="/seniors/:seniorId" element={<SeniorProfile />} />

                                    <Route path="/care-managers" element={<CareManagers />} />
                                    <Route path="/care-managers/:careManagerId" element={<CareManagerProfile />} />

                                    <Route path="/families" element={<Family />} />
                                    <Route path="/families/:familyId" element={<FamilyProfile />} />

                                    <Route path="/admins" element={<Admins />} />
                                    <Route path="/admins/:adminId" element={<AdminProfile />} />

                                    {/* FireCMS Collection Routes */}
                                    <Route path="/c" element={<CMSWelcome />} />
                                    <Route path="*" element={<NavigationRoutes />} />
                                </Routes>
                                <SideDialogs />
                            </Scaffold>
                        );
                    }}
                </FireCMS>
            </SnackbarProvider>
        </FilterProvider>
    );
}

export default App;
