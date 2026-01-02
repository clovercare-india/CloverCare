import React, { useEffect, useState } from 'react';
import {
    TextField,
    InputAdornment,
    Chip,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Tooltip,
    IconButton
} from '@mui/material';
import {
    Search as SearchIcon,
    NotificationsActive as NotificationsActiveIcon,
    Warning as WarningIcon,
    AccessTime as AccessTimeIcon,
    Medication as MedicationIcon,
    CheckCircle as CheckCircleIcon,
    ArrowBack as ArrowBackIcon,
    FilterList as FilterListIcon,
    DoneAll as DoneAllIcon,
    Description as DescriptionIcon
} from '@mui/icons-material';
import { collection, query, orderBy, onSnapshot, getFirestore, doc, updateDoc, Timestamp, getDocs, where, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useFireCMSContext } from "@firecms/core";
import { useNavigate } from "react-router-dom";
import logger from "../../utils/logger";
import { useFilter } from "../../contexts/FilterContext";

// TypeScript interfaces for type safety
interface Alert {
    id: string;
    type: 'panic' | 'missed_checkin' | 'medication' | string;
    status: 'active' | 'resolved' | 'closed';
    seniorName?: string;
    message?: string;
    createdAt?: Timestamp | { toDate: () => Date };
    resolvedAt?: Timestamp | Date;
    userId?: string;
    seniorId?: string;
    resolvedBy?: string; // email of resolver
    resolverName?: string; // display name
    resolverRole?: 'admin' | 'caremanager' | 'family'; // who resolved it
    actionTaken?: 'resolved' | 'closed_false_alert' | 'forwarded'; // what action was taken
    forwardedTo?: string; // if forwarded, care manager email
    forwardedToName?: string; // if forwarded, care manager name
    adminResolutionNotes?: string; // Notes added by admin when resolving
}

export function Alerts() {
    const navigate = useNavigate();
    const context = useFireCMSContext();
    const firestore = getFirestore((context.dataSource as any).firebaseApp);
    const auth = getAuth();
    const currentUser = auth.currentUser;
    const { selectedCareManager, selectedCareManagerName } = useFilter();

    // --- LOGIC with proper typing ---
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [actionDialogOpen, setActionDialogOpen] = useState(false);
    const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
    const [actionType, setActionType] = useState<'resolve' | 'close' | 'forward'>('resolve');
    const [currentAdminInfo, setCurrentAdminInfo] = useState<any>(null);
    const [careManagers, setCareManagers] = useState<any[]>([]);
    // const [selectedCareManager, setSelectedCareManager] = useState(''); // REMOVED: Using context now for filtering, local state for forwarding is confusing if named same. Renaming local state for forwarding.
    const [forwardToCareManager, setForwardToCareManager] = useState(''); // Renamed for clarity in Forward Action
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [assignedSeniorIds, setAssignedSeniorIds] = useState<string[]>([]);


    // Effect to fetch assigned seniors for filtering
    useEffect(() => {
        const fetchAssignedSeniors = async () => {
            if (selectedCareManager === 'all') {
                setAssignedSeniorIds([]);
                return;
            }
            try {
                let q;
                if (selectedCareManager === 'unassigned') {
                    // Fetch ALL seniors and filter manually because Firestore can't query for missing fields
                    const allSeniorsQuery = query(
                        collection(firestore, 'users'),
                        where('role', '==', 'senior')
                    );
                    const allSnap = await getDocs(allSeniorsQuery);
                    // Filter for missing careManagerId
                    const unassignedDocs = allSnap.docs.filter(doc => !doc.data().careManagerId);
                    setAssignedSeniorIds(unassignedDocs.map(doc => doc.id));
                    return; // Early return as we handled it
                } else {
                    q = query(
                        collection(firestore, 'users'),
                        where('role', '==', 'senior'),
                        where('careManagerId', '==', selectedCareManager)
                    );
                }
                const snapshot = await getDocs(q);
                setAssignedSeniorIds(snapshot.docs.map(doc => doc.id));
            } catch (error) {
                logger.error("Error fetching assigned seniors for filter: " + error);
            }
        };
        fetchAssignedSeniors();
    }, [selectedCareManager, firestore]);

    useEffect(() => {
        const alertsUnsub = onSnapshot(
            query(collection(firestore, 'alerts'), orderBy('createdAt', 'desc')),
            (snapshot) => {
                const alertsData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Alert));
                setAlerts(alertsData);
            }
        );

        // Load current admin info
        if (currentUser?.email) {
            const loadAdminInfo = async () => {
                const usersQuery = query(
                    collection(firestore, 'users'),
                    where('email', '==', currentUser.email!.toLowerCase())
                );
                const snapshot = await getDocs(usersQuery);
                if (!snapshot.empty) {
                    setCurrentAdminInfo({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
                }
            };
            loadAdminInfo();
        }

        // Load care managers for forwarding
        const loadCareManagers = async () => {
            const cmQuery = query(
                collection(firestore, 'users'),
                where('role', '==', 'caremanager')
            );
            const snapshot = await getDocs(cmQuery);
            const cmList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCareManagers(cmList);
        };
        loadCareManagers();

        return () => { alertsUnsub(); };
    }, [firestore, currentUser]);

    const handleOpenActionDialog = (alert: Alert, action: 'resolve' | 'close' | 'forward') => {
        setSelectedAlert(alert);
        setActionType(action);
        setResolutionNotes(''); // Reset notes
        setActionDialogOpen(true);
    };

    const handleConfirmAction = async () => {
        if (!selectedAlert || !currentAdminInfo) return;

        try {
            if (actionType === 'forward') {
                logger.info("📤 Forwarding alert: " + selectedAlert.id);

                await updateDoc(doc(firestore, 'alerts', selectedAlert.id), {
                    forwardedAt: new Date(),
                    forwardedBy: currentUser?.email || '',
                    forwardedTo: forwardToCareManager,
                    forwardCount: ((selectedAlert as any).forwardCount || 0) + 1
                });

                logger.info("✅ Alert forwarded");
            } else {
                // For resolve and close, update the document
                const updateData: any = {
                    status: actionType === 'close' ? 'closed' : 'resolved',
                    resolvedAt: new Date(),
                    resolvedBy: currentUser?.email || '',
                    resolverName: currentAdminInfo.name || 'Admin',
                    resolverRole: currentAdminInfo.role || 'admin',
                    actionTaken: actionType === 'close' ? 'closed_false_alert' : 'resolved',
                    adminResolutionNotes: actionType === 'resolve' ? resolutionNotes : null
                };

                logger.info("📤 Updating alert status: " + selectedAlert.id);
                await updateDoc(doc(firestore, 'alerts', selectedAlert.id), updateData);
                logger.info("✅ Alert updated successfully");
            }

            setActionDialogOpen(false);
            setSelectedAlert(null);
            setForwardToCareManager('');
        } catch (error) {
            logger.error("❌ Error updating alert: " + error);
        }
    };

    const filteredAlerts = alerts.filter(alert => {
        const seniorName = (alert.seniorName || '').toLowerCase();
        const type = (alert.type || '').toLowerCase();
        const query = searchQuery.toLowerCase();

        const matchesSearch = seniorName.includes(query) || type.includes(query);
        const matchesStatus = statusFilter === 'all' || (alert.status || 'active') === statusFilter;

        // Filter by Care Manager
        const matchesCareManager = selectedCareManager === 'all' || (alert.seniorId && assignedSeniorIds.includes(alert.seniorId));

        return matchesSearch && matchesStatus && matchesCareManager;
    });

    // Helper to format timestamp
    const formatTimestamp = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${timeStr}, ${dateStr}`;
    };

    // Helper to get resolver profile path
    const getResolverProfilePath = (role: string, email: string) => {
        switch (role) {
            case 'admin': return `/admins/${email}`;
            case 'caremanager': return `/care_managers/${email}`;
            case 'family': return `/families/${email}`;
            default: return '#';
        }
    };

    // --- UI HELPERS ---

    // Returns style config based on alert type and status
    const getAlertStyle = (type: string, status: string) => {
        const isResolved = status === 'resolved' || status === 'closed';

        if (isResolved) return {
            bg: 'bg-slate-50',
            border: 'border-slate-200',
            iconBg: 'bg-slate-200',
            iconColor: 'text-slate-400',
            textColor: 'text-slate-500',
            accentColor: 'slate'
        };

        switch (type) {
            case 'panic':
            case 'panic_button':
                return {
                    bg: 'bg-gradient-to-br from-white to-red-50',
                    border: 'border-red-100',
                    iconBg: 'bg-red-100',
                    iconColor: 'text-red-600',
                    textColor: 'text-gray-900',
                    accentColor: 'red',
                    animate: true
                };
            case 'missed_checkin':
                return {
                    bg: 'bg-white',
                    border: 'border-amber-200',
                    iconBg: 'bg-amber-100',
                    iconColor: 'text-amber-600',
                    textColor: 'text-gray-900',
                    accentColor: 'amber',
                    animate: false
                };
            case 'medication':
                return {
                    bg: 'bg-white',
                    border: 'border-violet-200',
                    iconBg: 'bg-violet-100',
                    iconColor: 'text-violet-600',
                    textColor: 'text-gray-900',
                    accentColor: 'violet',
                    animate: false
                };
            default:
                return {
                    bg: 'bg-white',
                    border: 'border-blue-200',
                    iconBg: 'bg-blue-100',
                    iconColor: 'text-blue-600',
                    textColor: 'text-gray-900',
                    accentColor: 'blue',
                    animate: false
                };
        }
    };

    const getIconComponent = (type: string) => {
        switch (type) {
            case 'panic':
            case 'panic_button': return <WarningIcon fontSize="small" />;
            case 'missed_checkin': return <AccessTimeIcon fontSize="small" />;
            case 'medication': return <MedicationIcon fontSize="small" />;
            default: return <NotificationsActiveIcon fontSize="small" />;
        }
    };

    const isPanicAlert = (type: string) => type === 'panic' || type === 'panic_button';

    // Color mappings for Tailwind JIT compiler
    // Dynamic class names don't work with Tailwind's purge/JIT mode
    const pulseColorMap: Record<string, string> = {
        red: 'bg-red-400',
        amber: 'bg-amber-400',
        violet: 'bg-violet-400',
        blue: 'bg-blue-400',
        slate: 'bg-slate-400'
    };

    const dotColorMap: Record<string, string> = {
        red: 'bg-red-500',
        amber: 'bg-amber-500',
        violet: 'bg-violet-500',
        blue: 'bg-blue-500',
        slate: 'bg-slate-500'
    };

    // --- RENDER ---
    return (
        <div className="min-h-screen w-full bg-[#F8FAFC] p-6 lg:p-8 font-sans text-slate-800 pb-20">

            {/* 1. HEADER SECTION */}
            <div className="relative mb-10 bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 overflow-hidden">
                {/* Background decorative elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-red-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-50 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-6 w-full md:w-auto">
                        <button
                            onClick={() => navigate("/")}
                            className="w-12 h-12 rounded-2xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-all border border-slate-200 group"
                        >
                            <ArrowBackIcon className="text-slate-400 group-hover:text-slate-700" />
                        </button>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                                Alert Monitor
                                {filteredAlerts.filter(a => a.status === 'active').length > 0 && (
                                    <span className="relative flex h-4 w-4">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                                    </span>
                                )}
                            </h1>
                            <p className="text-slate-500 font-medium mt-1">
                                Real-time emergency & health notifications
                            </p>
                        </div>
                    </div>

                    <div className="w-full md:w-96">
                        <TextField
                            fullWidth
                            placeholder="Search alerts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            variant="outlined"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ color: '#94a3b8' }} />
                                    </InputAdornment>
                                ),
                                sx: {
                                    borderRadius: '1rem',
                                    backgroundColor: 'white',
                                    '& fieldset': { borderColor: '#E2E8F0' },
                                    '&:hover fieldset': { borderColor: '#CBD5E1' },
                                    '&.Mui-focused fieldset': { borderColor: '#ef4444' },
                                }
                            }}
                        />
                    </div>

                    {/* Filters */}
                    <div className="flex gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-700 text-sm rounded-full focus:ring-red-500 focus:border-red-500 block px-4 py-2.5 outline-none hover:border-red-300 transition-colors cursor-pointer"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* 2. ALERTS GRID */}
            <div className="flex justify-between items-center mb-6 px-2">
                <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                    <FilterListIcon fontSize="small" />
                    Recent Activity
                    <span className="bg-slate-200 text-slate-600 text-xs py-0.5 px-2 rounded-full ml-1">{filteredAlerts.length}</span>
                </h2>
            </div>

            {filteredAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-96 bg-white rounded-[2rem] border border-dashed border-slate-200">
                    <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-4">
                        <CheckCircleIcon sx={{ fontSize: 40, color: '#22c55e' }} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">All Clear</h3>
                    <p className="text-slate-500 mt-1">No alerts found matching your criteria.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredAlerts.map((alert) => {
                        const styles = getAlertStyle(alert.type, alert.status);

                        return (
                            <div
                                key={alert.id}
                                className={`relative rounded-[2rem] p-6 border transition-all duration-300 ${styles.bg} ${styles.border} ${styles.animate && alert.status !== 'resolved' ? 'animate-glow' : 'shadow-sm hover:shadow-md'}`}
                            >


                                <div className="flex justify-between items-start mb-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${styles.iconBg} ${styles.iconColor}`}>
                                        {getIconComponent(alert.type)}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            {alert.createdAt ? formatTimestamp(alert.createdAt) : 'Now'}
                                        </p>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className={`font-bold text-lg ${styles.textColor}`}>
                                            {alert.seniorName || 'Unknown Senior'}
                                        </h3>
                                    </div>
                                    <p className={`text-sm font-medium uppercase tracking-wide opacity-80 ${styles.iconColor}`}>
                                        {alert.type?.replace('_', ' ') || 'System Alert'}
                                    </p>
                                    <p className="text-slate-500 text-sm mt-3 leading-relaxed line-clamp-2 min-h-[40px]">
                                        {isPanicAlert(alert.type) ? `Panic button pressed by ${alert.seniorName || 'user'}` : (alert.message || 'No additional details provided.')}
                                    </p>
                                </div>

                                <div className="flex flex-col gap-3 mt-6 pt-4 border-t border-slate-100/50">
                                    <div className="flex items-center justify-between">
                                        <Chip
                                            label={alert.status || 'active'}
                                            size="small"
                                            className="capitalize font-bold"
                                            sx={{
                                                bgcolor: alert.status === 'resolved' || alert.status === 'closed' ? '#f1f5f9' : (isPanicAlert(alert.type) ? '#fecaca' : '#fff7ed'),
                                                color: alert.status === 'resolved' || alert.status === 'closed' ? '#64748b' : (isPanicAlert(alert.type) ? '#dc2626' : '#c2410c'),
                                                fontWeight: 700
                                            }}
                                        />
                                    </div>

                                    {/* Action Buttons for Active Alerts */}
                                    {alert.status === 'active' && (
                                        <div className="flex flex-col gap-2">
                                            <Button
                                                size="small"
                                                variant="contained"
                                                onClick={() => handleOpenActionDialog(alert, 'resolve')}
                                                sx={{
                                                    bgcolor: '#22c55e',
                                                    '&:hover': { bgcolor: '#16a34a' },
                                                    textTransform: 'none',
                                                    fontSize: '11px',
                                                    borderRadius: '8px'
                                                }}
                                            >
                                                Resolve
                                            </Button>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                onClick={() => handleOpenActionDialog(alert, 'close')}
                                                sx={{
                                                    borderColor: '#64748b',
                                                    color: '#64748b',
                                                    '&:hover': { borderColor: '#475569', bgcolor: '#f8fafc' },
                                                    textTransform: 'none',
                                                    fontSize: '11px',
                                                    borderRadius: '8px'
                                                }}
                                            >
                                                Close
                                            </Button>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                onClick={() => handleOpenActionDialog(alert, 'forward')}
                                                sx={{
                                                    borderColor: '#3b82f6',
                                                    color: '#3b82f6',
                                                    '&:hover': { borderColor: '#2563eb', bgcolor: '#eff6ff' },
                                                    textTransform: 'none',
                                                    fontSize: '11px',
                                                    borderRadius: '8px'
                                                }}
                                            >
                                                Forward
                                            </Button>
                                        </div>
                                    )}

                                    {/* Resolved/Closed Info */}
                                    {(alert.status === 'resolved' || alert.status === 'closed') && alert.resolverName && (
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center text-green-600 text-xs font-bold">
                                                <DoneAllIcon fontSize="small" className="mr-1" />
                                                {alert.actionTaken === 'closed_false_alert' ? 'Closed as False Alert' : 'Resolved'}
                                                {alert.adminResolutionNotes && (
                                                    <Tooltip title={alert.adminResolutionNotes} arrow placement="top">
                                                        <IconButton size="small" sx={{ ml: 0.5, padding: 0.5 }}>
                                                            <DescriptionIcon sx={{ fontSize: 16, color: '#64748b' }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                by{' '}
                                                <a
                                                    href={getResolverProfilePath(alert.resolverRole || 'admin', alert.resolvedBy || '')}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                                                >
                                                    {alert.resolverName}
                                                </a>
                                                {' '}({alert.resolverRole})
                                                {alert.forwardedToName && (
                                                    <span className="block mt-1">
                                                        Forwarded to: <span className="font-semibold">{alert.forwardedToName}</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Action Confirmation Dialog */}
            <Dialog
                open={actionDialogOpen}
                onClose={() => setActionDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { borderRadius: '1.5rem' } }}
            >
                <DialogTitle sx={{ pb: 1 }}>
                    <span className="text-xl font-bold">
                        {actionType === 'resolve' && 'Resolve Alert'}
                        {actionType === 'close' && 'Close False Alert'}
                        {actionType === 'forward' && 'Forward to Care Manager'}
                    </span>
                </DialogTitle>
                <DialogContent>
                    <div className="space-y-3">
                        <p className="text-gray-600">
                            {actionType === 'resolve' && 'Are you sure you want to mark this alert as resolved?'}
                            {actionType === 'close' && 'Are you sure this is a false alert and should be closed?'}
                            {actionType === 'forward' && 'This will re-send the alert notification to the care manager assigned to this senior.'}
                        </p>

                        {selectedAlert && (
                            <div className="bg-slate-50 p-4 rounded-xl">
                                <p className="text-sm font-semibold text-slate-700">Alert Details:</p>
                                <p className="text-sm text-slate-600 mt-1">
                                    <strong>Senior:</strong> {selectedAlert.seniorName || 'Unknown'}
                                </p>
                                <p className="text-sm text-slate-600">
                                    <strong>Type:</strong> {selectedAlert.type?.replace('_', ' ')}
                                </p>
                            </div>
                        )}

                        {actionType === 'forward' && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <p className="text-sm text-blue-800">
                                    This will re-send the alert notification to the care manager assigned to this senior.
                                    (Care Manager selection temporarily disabled for debugging)
                                </p>
                            </div>
                        )}
                        {actionType === 'resolve' && (
                            <div className="mt-4">
                                <TextField
                                    fullWidth
                                    label="Resolution Notes"
                                    placeholder="Explain how this alert was resolved..."
                                    multiline
                                    rows={3}
                                    value={resolutionNotes}
                                    onChange={(e) => setResolutionNotes(e.target.value)}
                                    variant="outlined"
                                    sx={{
                                        borderRadius: '12px',
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '12px'
                                        }
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button
                        onClick={() => setActionDialogOpen(false)}
                        variant="outlined"
                        sx={{ textTransform: 'none', borderRadius: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirmAction}
                        variant="contained"
                        sx={{
                            bgcolor: actionType === 'resolve' ? '#22c55e' : (actionType === 'close' ? '#64748b' : '#3b82f6'),
                            '&:hover': {
                                bgcolor: actionType === 'resolve' ? '#16a34a' : (actionType === 'close' ? '#475569' : '#2563eb')
                            },
                            textTransform: 'none',
                            borderRadius: '12px'
                        }}
                    >
                        {actionType === 'resolve' && 'Confirm Resolve'}
                        {actionType === 'close' && 'Confirm Close'}
                        {actionType === 'forward' && 'Forward Alert'}
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default Alerts;