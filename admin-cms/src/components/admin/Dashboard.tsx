import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
    Elderly as ElderlyIcon,
    MedicalServices as MedicalServicesIcon,
    NotificationsActive as NotificationsActiveIcon,
    People as PeopleIcon,
    Bolt as BoltIcon,
    ArrowOutward as ArrowOutwardIcon,
    AccessTime as ClockIcon,
    FilterList as FilterListIcon,
    KeyboardArrowRight as ArrowRightIcon,
    Logout as LogoutIcon,
    LocalHospital as HealthIcon,
    Assignment as AssignmentIcon,
    AccountCircle as AccountCircleIcon,
    Email as EmailIcon
} from '@mui/icons-material';
import { Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Button, Divider, Select, FormControl, InputLabel } from '@mui/material';
import { collection, query, where, onSnapshot, getFirestore, limit, orderBy } from 'firebase/firestore';
import { getAuth, signOut } from 'firebase/auth';
import { useFireCMSContext } from "@firecms/core";
import { useNavigate } from "react-router-dom";
import logger from "../../utils/logger";
import { useFilter } from "../../contexts/FilterContext";

export function Dashboard() {
    const navigate = useNavigate();
    const context = useFireCMSContext();
    const firestore = getFirestore((context.dataSource as any).firebaseApp);
    const { selectedCareManager, setSelectedCareManager, setSelectedCareManagerName } = useFilter();

    // --- DATA STATE ---
    const [stats, setStats] = useState({
        totalSeniors: 0,
        totalFamilies: 0,
        totalCareManagers: 0,
        totalAdmins: 0,
        activeAlertsCount: 0,
    });

    // State for REAL alerts data
    const [recentAlerts, setRecentAlerts] = useState<any[]>([]);

    // State for recent seniors
    const [recentSeniors, setRecentSeniors] = useState<any[]>([]);

    // State for care managers list
    const [careManagers, setCareManagers] = useState<any[]>([]);

    // State for filtering alerts based on seniors
    const [filteredSeniorIds, setFilteredSeniorIds] = useState<string[] | null>(null);

    // Real-time clock state
    const [currentTime, setCurrentTime] = useState(new Date());

    // State for user menu
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
    const menuOpen = Boolean(anchorEl);

    // State for alert summary modal
    const [selectedAlert, setSelectedAlert] = useState<any | null>(null);
    const [alertModalOpen, setAlertModalOpen] = useState(false);

    // Get user info from auth
    const auth = getAuth((context.dataSource as any).firebaseApp);
    const user = auth.currentUser;
    const userEmail = user?.email;
    const userName = user?.displayName || 'Admin User';

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleLogoutClick = () => {
        handleMenuClose();
        setLogoutDialogOpen(true);
    };

    const handleLogoutConfirm = async () => {
        try {
            const auth = getAuth((context.dataSource as any).firebaseApp);
            await signOut(auth);
            setLogoutDialogOpen(false);
            // FireCMS handles the redirect to login automatically when auth state changes
        } catch (error) {
            logger.error("Error signing out: " + error);
        }
    };

    const handleLogoutCancel = () => {
        setLogoutDialogOpen(false);
    };

    const handleAlertClick = (alert: any) => {
        setSelectedAlert(alert);
        setAlertModalOpen(true);
    };

    const handleAlertModalClose = () => {
        setAlertModalOpen(false);
        setSelectedAlert(null);
    };

    // Utility function to get initials from name (memoized for performance)
    const getInitials = useCallback((name: string) => {
        if (!name || name === 'Unknown') return '?';
        return name.split(' ')
            .filter(word => word.length > 0) // Filter empty strings
            .map(word => word.charAt(0).toUpperCase())
            .join('');
    }, []);

    useEffect(() => {
        // Fetch care managers for the filter dropdown
        const cmQuery = query(collection(firestore, 'users'), where('role', '==', 'caremanager'));
        const cmUnsub = onSnapshot(cmQuery, (snapshot) => {
            const cmList = snapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().name || doc.data().fullName || 'Unknown',
                ...doc.data()
            }));
            setCareManagers(cmList);
            setStats(prev => ({ ...prev, totalCareManagers: cmList.length }));
        });

        return () => {
            cmUnsub();
        };
    }, [firestore]);

    useEffect(() => {
        let isMounted = true;

        // Build queries based on selected care manager filter
        const isFiltered = selectedCareManager !== 'all';

        // 1. Stats Listeners (Counts)
        // 1. Stats Listeners (Counts)
        let seniorsQuery;
        if (selectedCareManager === 'unassigned') {
            // Client-side filtering for missing field
            seniorsQuery = query(collection(firestore, 'users'), where('role', '==', 'senior'));
        } else if (isFiltered) {
            seniorsQuery = query(collection(firestore, 'users'), where('role', '==', 'senior'), where('careManagerId', '==', selectedCareManager));
        } else {
            seniorsQuery = query(collection(firestore, 'users'), where('role', '==', 'senior'));
        }

        const seniorsUnsub = onSnapshot(seniorsQuery,
            (snap) => {
                let count = snap.size;
                let ids: string[] = snap.docs.map(doc => doc.id);

                if (selectedCareManager === 'unassigned') {
                    // Filter manually for missing or empty careManagerId
                    const unassignedDocs = snap.docs.filter(doc => !doc.data().careManagerId);
                    count = unassignedDocs.length;
                    ids = unassignedDocs.map(doc => doc.id);
                } else if (!isFiltered) {
                    // If filtered is false (All Managers), we pass null to indicate "fetch all alerts"
                    // passing ids would limit to seniors who are loaded (which might be consistent but expensive if we want global alerts)
                    // Logic choice: If "All", we want ALL alerts, not just alerts for currently loaded seniors query (though they overlap)
                    ids = []; // reset
                }

                setStats(prev => ({ ...prev, totalSeniors: count }));

                if (selectedCareManager === 'all') {
                    setFilteredSeniorIds(null);
                } else {
                    setFilteredSeniorIds(ids);
                }
            });

        const familiesUnsub = onSnapshot(query(collection(firestore, 'users'), where('role', '==', 'family')),
            (snap) => setStats(prev => ({ ...prev, totalFamilies: snap.size })));

        const adminsUnsub = onSnapshot(query(collection(firestore, 'users'), where('role', '==', 'admin')),
            (snap) => setStats(prev => ({ ...prev, totalAdmins: snap.size })));

        // 2. Active Alerts Listener - Dependent on filteredSeniorIds
        // No more async setup race conditions.
        // If filteredSeniorIds is null -> Fetch ALL active alerts
        // If filteredSeniorIds is [] -> Fetch NO alerts (empty filter result)
        // If filteredSeniorIds is [...] -> Fetch alerts for those IDs

        // Query 3: For seniors display - get first 3 seniors (no orderBy to avoid index issues)
        // Query 3: For seniors display - fetch logic adjusted for unassigned
        let seniorsDisplayQuery;
        if (selectedCareManager === 'unassigned') {
            // Fetch ALL (limit 20 to avoid overfetching, then filter client side)
            seniorsDisplayQuery = query(
                collection(firestore, 'users'),
                where('role', '==', 'senior'),
                limit(20)
            );
        } else if (isFiltered) {
            seniorsDisplayQuery = query(
                collection(firestore, 'users'),
                where('role', '==', 'senior'),
                where('careManagerId', '==', selectedCareManager),
                limit(3)
            );
        } else {
            seniorsDisplayQuery = query(
                collection(firestore, 'users'),
                where('role', '==', 'senior'),
                limit(3)
            );
        }

        const seniorsDisplayUnsub = onSnapshot(
            seniorsDisplayQuery,
            (snapshot) => {
                let seniorsList = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        name: data.name?.trim() || data.fullName?.trim() || 'Unknown'
                    };
                });

                // Client-side filter for unassigned
                if (selectedCareManager === 'unassigned') {
                    seniorsList = seniorsList.filter(s => !(s as any).careManagerId).slice(0, 3);
                }

                logger.info(`Loaded ${seniorsList.length} seniors for dashboard display`);
                setRecentSeniors(seniorsList);
            },
            (error) => {
                logger.error("Error loading seniors for dashboard: " + error);
                setRecentSeniors([]); // Set empty array on error
            }
        );

        return () => {
            // Mark component as unmounted to prevent state updates and listener storage
            isMounted = false;
            // Cleanup all listeners
            seniorsUnsub();
            familiesUnsub();
            adminsUnsub();
            seniorsDisplayUnsub();
        };
    }, [firestore, selectedCareManager]);


    // Separate effect for Alerts - Client Side Filtering to match Alerts.tsx and avoid 'in' limits
    useEffect(() => {
        // If filter is active but no seniors found, clearly 0 alerts
        if (filteredSeniorIds !== null && filteredSeniorIds.length === 0) {
            setStats(prev => ({ ...prev, activeAlertsCount: 0 }));
            setRecentAlerts([]);
            return;
        }

        // Query ALL active alerts (matches Alerts.tsx logic)
        const alertsQuery = query(
            collection(firestore, 'alerts'),
            where('status', '==', 'active'),
            orderBy('createdAt', 'desc')
        );

        const alertsUnsub = onSnapshot(alertsQuery, (snapshot) => {
            let docs = snapshot.docs;

            // Client-Side Filtering
            if (filteredSeniorIds !== null) {
                // Determine if we have a Set for O(1) lookup if generic, but array for small N is fine.
                // Alerts.tsx uses .includes(). We will do same.
                docs = docs.filter(doc => filteredSeniorIds.includes(doc.data().seniorId));
            }

            // Update Stats
            setStats(prev => ({ ...prev, activeAlertsCount: docs.length }));

            // Update List (Top 5)
            const alertsList = docs.slice(0, 5).map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setRecentAlerts(alertsList);
        });

        return () => {
            alertsUnsub();
        };
    }, [firestore, filteredSeniorIds]);

    // Real-time clock effect
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // --- COMPONENTS ---

    const DateWidget = () => (
        <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Clover Care Admin</h1>
            <p className="text-sm text-gray-500 font-medium mt-1">
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} • {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
        </div>
    );

    return (
        <div className="min-h-screen w-full bg-[#F8FAFC] p-6 lg:p-10 font-sans text-slate-800 pb-20">

            {/* 1. TOP BAR */}
            <div className="flex justify-between items-center mb-10">
                <DateWidget />

                <div className="flex items-center gap-4">
                    {/* Care Manager Filter */}
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel id="care-manager-filter-label">Filter by Care Manager</InputLabel>
                        <Select
                            labelId="care-manager-filter-label"
                            value={selectedCareManager}
                            label="Filter by Care Manager"
                            onChange={(e) => {
                                const value = e.target.value;
                                setSelectedCareManager(value);
                                if (value === 'all') {
                                    setSelectedCareManagerName('All Care Managers');
                                } else if (value === 'unassigned') {
                                    setSelectedCareManagerName('Unassigned Seniors');
                                } else {
                                    const cm = careManagers.find(c => c.id === value);
                                    setSelectedCareManagerName(cm?.name || 'Unknown');
                                }
                            }}
                            sx={{
                                borderRadius: 3,
                                bgcolor: 'white',
                                '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#E2E8F0'
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#CBD5E1'
                                }
                            }}
                        >
                            <MenuItem value="all">
                                <span className="font-medium">All Care Managers</span>
                            </MenuItem>
                            <MenuItem value="unassigned">
                                <span className="font-medium text-slate-600">Unassigned</span>
                            </MenuItem>
                            {careManagers.map((cm) => (
                                <MenuItem key={cm.id} value={cm.id}>
                                    {cm.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    {/* Admin Profile with Dropdown */}
                    <div
                        onClick={handleMenuOpen}
                        className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-blue-700 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-blue-200 cursor-pointer hover:scale-105 transition-transform"
                        title="User Menu"
                    >
                        {userName.charAt(0).toUpperCase()}
                    </div>

                    {/* User Menu Dropdown */}
                    <Menu
                        anchorEl={anchorEl}
                        open={menuOpen}
                        onClose={handleMenuClose}
                        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                        PaperProps={{
                            sx: {
                                mt: 1.5,
                                minWidth: 220,
                                borderRadius: 2,
                                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                            }
                        }}
                    >
                        <div className="px-4 py-3">
                            <p className="text-sm font-semibold text-gray-900">{userName}</p>
                            <p className="text-xs text-gray-500 mt-1">{userEmail}</p>
                        </div>
                        <Divider />
                        <MenuItem onClick={handleLogoutClick} sx={{ py: 1.5, px: 2 }}>
                            <LogoutIcon fontSize="small" sx={{ mr: 1.5, color: '#EF4444' }} />
                            <span className="text-red-500 font-medium">Logout</span>
                        </MenuItem>
                    </Menu>

                    {/* Logout Confirmation Dialog */}
                    <Dialog
                        open={logoutDialogOpen}
                        onClose={handleLogoutCancel}
                        PaperProps={{
                            sx: {
                                borderRadius: 3,
                                minWidth: 400
                            }
                        }}
                    >
                        <DialogTitle sx={{ pb: 1 }}>
                            <span className="text-xl font-bold">Confirm Logout</span>
                        </DialogTitle>
                        <DialogContent>
                            <p className="text-gray-600">Are you sure you want to logout from Clover Care Admin?</p>
                        </DialogContent>
                        <DialogActions sx={{ px: 3, pb: 3 }}>
                            <Button
                                onClick={handleLogoutCancel}
                                variant="outlined"
                                sx={{ textTransform: 'none', borderRadius: 2 }}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleLogoutConfirm}
                                variant="contained"
                                color="error"
                                sx={{ textTransform: 'none', borderRadius: 2 }}
                            >
                                Logout
                            </Button>
                        </DialogActions>
                    </Dialog>

                    {/* Alert Summary Dialog */}
                    <Dialog
                        open={alertModalOpen}
                        onClose={handleAlertModalClose}
                        maxWidth="md"
                        fullWidth
                        PaperProps={{
                            sx: {
                                borderRadius: 3,
                                maxWidth: 600
                            }
                        }}
                    >
                        <DialogTitle sx={{ pb: 2 }}>
                            <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center
                                    ${selectedAlert?.type === 'panic' ? 'bg-red-500 text-white' :
                                        selectedAlert?.type === 'missed_checkin' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'}`}>
                                    {selectedAlert?.type === 'panic' ? <BoltIcon /> : <ClockIcon />}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 capitalize">
                                        {selectedAlert?.type ? selectedAlert.type.replace('_', ' ') : 'Alert'} Details
                                    </h3>
                                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-bold mt-1
                                        ${selectedAlert?.type === 'panic' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                        {selectedAlert?.status || 'Active'}
                                    </span>
                                </div>
                            </div>
                        </DialogTitle>

                        <DialogContent>
                            <div className="space-y-4">
                                {/* Senior Information */}
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Senior</p>
                                    <p className="text-lg font-bold text-gray-900">{selectedAlert?.seniorName || 'Unknown'}</p>
                                    {selectedAlert?.seniorId && (
                                        <p className="text-sm text-gray-500 mt-1">ID: {selectedAlert.seniorId}</p>
                                    )}
                                </div>

                                {/* Alert Message */}
                                {selectedAlert?.message && (
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Message</p>
                                        <p className="text-sm text-gray-700">{selectedAlert.message}</p>
                                    </div>
                                )}

                                {/* Timestamp */}
                                {selectedAlert?.createdAt && (
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Time</p>
                                        <p className="text-sm text-gray-700">
                                            {selectedAlert.createdAt.toDate ?
                                                selectedAlert.createdAt.toDate().toLocaleString('en-US', {
                                                    weekday: 'long',
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric',
                                                    hour: 'numeric',
                                                    minute: '2-digit',
                                                    hour12: true
                                                }) :
                                                new Date(selectedAlert.createdAt).toLocaleString()
                                            }
                                        </p>
                                    </div>
                                )}

                                {/* Additional Details if available */}
                                {selectedAlert?.careManagerName && (
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Care Manager</p>
                                        <p className="text-sm text-gray-700">{selectedAlert.careManagerName}</p>
                                    </div>
                                )}

                                {selectedAlert?.location && (
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Location</p>
                                        <p className="text-sm text-gray-700">{selectedAlert.location}</p>
                                    </div>
                                )}
                            </div>
                        </DialogContent>

                        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
                            <Button
                                onClick={handleAlertModalClose}
                                variant="outlined"
                                sx={{ textTransform: 'none', borderRadius: 2 }}
                            >
                                Close
                            </Button>
                            <Button
                                onClick={() => {
                                    handleAlertModalClose();
                                    navigate('/alerts');
                                }}
                                variant="contained"
                                sx={{ textTransform: 'none', borderRadius: 2 }}
                            >
                                View All Alerts
                            </Button>
                        </DialogActions>
                    </Dialog>
                </div>
            </div>

            {/* 2. HERO GRID (Bento Style) */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">

                {/* CARD A: Total Seniors */}
                <div
                    onClick={() => navigate("/seniors")}
                    className="md:col-span-2 bg-white rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-shadow cursor-pointer border border-gray-100 relative overflow-hidden group"
                >
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                                    <ElderlyIcon fontSize="small" />
                                </div>
                                <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Total Seniors</span>
                            </div>
                            <h2 className="text-5xl font-extrabold text-gray-900 tracking-tight mt-2">{stats.totalSeniors}</h2>
                            <p className="text-sm text-green-500 font-medium mt-2 flex items-center bg-green-50 w-fit px-2 py-1 rounded-lg">
                                <ArrowOutwardIcon sx={{ fontSize: 14, mr: 0.5 }} /> Active & Monitored
                            </p>
                        </div>
                        {/* Decorative Visual */}
                        <div className="hidden sm:block absolute right-6 bottom-6 opacity-50 group-hover:opacity-100 transition-opacity">
                            <div className="flex -space-x-3">
                                {recentSeniors.length > 0 ? (
                                    recentSeniors.map(senior => (
                                        <div key={senior.id} className="w-10 h-10 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 bg-gradient-to-br from-gray-100 to-gray-200">
                                            {getInitials(senior.name)}
                                        </div>
                                    ))
                                ) : (
                                    // Fallback if no seniors
                                    <div className="w-10 h-10 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                                        ?
                                    </div>
                                )}
                                {recentSeniors.length < 3 && (
                                    <div className="w-10 h-10 rounded-full border-2 border-white bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold">+</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* CARD B: Active Alerts */}
                <div
                    onClick={() => navigate("/alerts")}
                    className="bg-gradient-to-br from-rose-500 to-red-600 rounded-[2rem] p-6 text-white shadow-lg shadow-red-200 hover:shadow-red-300 transition-all cursor-pointer relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl -mr-10 -mt-10"></div>

                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                            <NotificationsActiveIcon fontSize="small" />
                        </div>
                        {stats.activeAlertsCount > 0 && (
                            <span className="flex h-3 w-3 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                            </span>
                        )}
                    </div>
                    <div className="mt-4">
                        <h2 className="text-4xl font-extrabold">{stats.activeAlertsCount}</h2>
                        <p className="text-red-100 font-medium text-sm mt-1">Active Alerts</p>
                    </div>
                </div>

                {/* CARD C: Care Managers */}
                <div
                    onClick={() => navigate("/care-managers")}
                    className="bg-white rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-shadow cursor-pointer border border-gray-100 flex flex-col justify-between"
                >
                    <div className="flex justify-between items-start">
                        <div className="p-2 bg-purple-50 rounded-xl text-purple-600">
                            <MedicalServicesIcon fontSize="small" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-4xl font-extrabold text-gray-900">{stats.totalCareManagers}</h2>
                        <p className="text-gray-500 font-medium text-sm">Care Managers</p>
                    </div>
                    <div className="w-full bg-gray-100 h-1.5 rounded-full mt-4 overflow-hidden">
                        <div className="bg-purple-500 h-full rounded-full w-3/4"></div>
                    </div>
                </div>

                {/* CARD D: Admins */}
                <div
                    onClick={() => navigate("/admins")}
                    className="bg-white rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-shadow cursor-pointer border border-gray-100 flex flex-col justify-between"
                >
                    <div className="flex justify-between items-start">
                        <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                            <AccountCircleIcon fontSize="small" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-4xl font-extrabold text-gray-900">{stats.totalAdmins}</h2>
                        <p className="text-gray-500 font-medium text-sm">Administrators</p>
                    </div>
                    <div className="w-full bg-gray-100 h-1.5 rounded-full mt-4 overflow-hidden">
                        <div className="bg-blue-500 h-full rounded-full w-2/3"></div>
                    </div>
                </div>
                {/* CARD E: Family Members */}
                <div
                    onClick={() => navigate("/families")}
                    className="bg-white rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-shadow cursor-pointer border border-gray-100 flex flex-col justify-between"
                >
                    <div className="flex justify-between items-start">
                        <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                            <PeopleIcon fontSize="small" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-4xl font-extrabold text-gray-900">{stats.totalFamilies}</h2>
                        <p className="text-gray-500 font-medium text-sm">Family Members</p>
                    </div>
                    <div className="w-full bg-gray-100 h-1.5 rounded-full mt-4 overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full w-3/4"></div>
                    </div>
                </div>
            </div>



            {/* 3. MAIN CONTENT SPLIT */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

                {/* LEFT COLUMN: Live Alerts Feed (Expanded to fill space) */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 min-h-[500px]">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="font-bold text-xl text-gray-900">Live Operations Feed</h3>
                                <p className="text-sm text-gray-500 mt-1">Real-time alerts requiring attention</p>
                            </div>
                            <div onClick={() => navigate('/alerts')} className="cursor-pointer p-2 hover:bg-gray-50 rounded-full transition-colors">
                                <ArrowOutwardIcon sx={{ color: '#64748B', fontSize: 20 }} />
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Empty State Logic */}
                            {recentAlerts.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                                        <NotificationsActiveIcon sx={{ color: '#22c55e' }} />
                                    </div>
                                    <p className="font-medium text-gray-600">All Clear</p>
                                    <p className="text-xs">No active alerts at this moment.</p>
                                </div>
                            ) : (
                                recentAlerts.map((alert) => {
                                    // Format timestamp
                                    const formatTimestamp = (timestamp: any) => {
                                        if (!timestamp) return '';
                                        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
                                        const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                                        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                        return `${timeStr}, ${dateStr}`;
                                    };

                                    return (
                                        <div
                                            key={alert.id}
                                            onClick={() => handleAlertClick(alert)}
                                            className="flex items-center justify-between p-5 rounded-2xl bg-slate-50 border border-slate-100 group hover:bg-white hover:shadow-md transition-all cursor-pointer"
                                        >
                                            <div className="flex items-center gap-5">
                                                {/* Icon Logic based on alert type */}
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm
                                                    ${alert.type === 'panic' ? 'bg-red-500 text-white' :
                                                        alert.type === 'missed_checkin' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'}`}>
                                                    {alert.type === 'panic' ? <BoltIcon fontSize="small" /> : <ClockIcon fontSize="small" />}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-900 capitalize">
                                                        {alert.type ? alert.type.replace('_', ' ') : 'System Alert'}
                                                    </h4>
                                                    <p className="text-sm text-gray-500 mt-0.5">
                                                        Senior: <span className="font-medium text-gray-700">{alert.seniorName || 'Unknown'}</span>
                                                    </p>
                                                    {alert.message && (
                                                        <p className="text-xs text-gray-400 mt-1 line-clamp-1">{alert.message}</p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold
                                                    ${alert.type === 'panic' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                    {alert.status || 'Active'}
                                                </span>
                                                {alert.createdAt && (
                                                    <p className="text-xs text-gray-400 mt-2 font-medium">
                                                        {formatTimestamp(alert.createdAt)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {recentAlerts.length > 0 && (
                            <button
                                onClick={() => navigate('/alerts')}
                                className="w-full mt-6 py-3 text-sm font-semibold text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-dashed border-gray-200"
                            >
                                View Full Alert History
                            </button>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: Quick Actions */}
                <div className="flex flex-col gap-6">
                    <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 h-full">
                        <h3 className="font-bold text-xl text-gray-900 mb-6">Quick Actions</h3>

                        <div className="grid grid-cols-1 gap-4">
                            <ActionButton
                                label="Care Managers"
                                icon={<MedicalServicesIcon fontSize="small" />}
                                color="text-purple-600"
                                bg="bg-purple-50"
                                onClick={() => navigate("/care-managers")}
                            />
                            <ActionButton
                                label="Assign Senior"
                                icon={<AssignmentIcon fontSize="small" />}
                                color="text-blue-600"
                                bg="bg-blue-50"
                                onClick={() => navigate("/seniors")}
                            />
                            <ActionButton
                                label="Family Links"
                                icon={<PeopleIcon fontSize="small" />}
                                color="text-green-600"
                                bg="bg-green-50"
                                onClick={() => navigate("/families")}
                            />
                        </div>

                        {/* Database Link */}
                        <div className="mt-8 pt-8 border-t border-gray-100">
                            <div
                                onClick={() => navigate('/c')}
                                className="group relative overflow-hidden bg-slate-900 rounded-2xl p-6 text-white cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                            >
                                <div className="relative z-10 flex justify-between items-center">
                                    <div>
                                        <h4 className="font-bold text-lg">Database</h4>
                                        <p className="text-slate-400 text-xs mt-1">Full collections access</p>
                                    </div>
                                    <div className="bg-white/10 p-2 rounded-lg group-hover:bg-white/20 transition-colors">
                                        <ArrowRightIcon />
                                    </div>
                                </div>
                                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-5 rounded-full blur-2xl"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}

// Sub-components
interface ActionButtonProps {
    label: string;
    icon: React.ReactNode;
    color: string;
    bg: string;
    onClick: () => void;
}

const ActionButton = ({ label, icon, color, bg, onClick }: ActionButtonProps) => (
    <button
        onClick={onClick}
        className="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-50 hover:bg-white hover:shadow-md transition-all group border border-transparent hover:border-gray-100"
    >
        <div className={`p-3 rounded-lg ${bg} ${color} group-hover:scale-110 transition-transform`}>
            {icon || <ArrowOutwardIcon fontSize="small" />}
        </div>
        <div className="flex-1 text-left">
            <span className="font-bold text-gray-700 block">{label || "View Records"}</span>
            <span className="text-xs text-gray-400">Manage data</span>
        </div>
        <ArrowRightIcon sx={{ color: '#CBD5E1' }} />
    </button>
);
