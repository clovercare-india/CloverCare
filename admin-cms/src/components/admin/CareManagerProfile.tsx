import React, { useEffect, useState, useRef } from 'react';
import {
    Button,
    Chip,
    Card,
    CardContent,
    Avatar,
    Tabs,
    Tab,
    Box,
    ToggleButtonGroup,
    ToggleButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Snackbar,
    Alert
} from '@mui/material';
import ConfirmationDialog from '../common/ConfirmationDialog';
import {
    ArrowBack as ArrowBackIcon,
    Phone as PhoneIcon,
    MedicalServices as MedicalServicesIcon,
    Notifications as NotificationsIcon,
    Assignment as AssignmentIcon,
    People as PeopleIcon,
    Language as LanguageIcon,
    CalendarMonth as CalendarIcon,
    Elderly as ElderlyIcon,
    CheckCircle as CheckCircleIcon,
    AccessTime as AccessTimeIcon,
    LocalHospital as HealthIcon,
    Schedule as ScheduleIcon,
    Warning as WarningIcon,
    Medication as MedicationIcon,
    TrendingUp as TrendingUpIcon,
    PersonAdd as PersonAddIcon,
    PersonRemove as PersonRemoveIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, getDocs, collection, query, where, onSnapshot, getFirestore, updateDoc } from 'firebase/firestore';
import { useFireCMSContext } from "@firecms/core";
import logger from "../../utils/logger";

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`cm-tabpanel-${index}`}
            aria-labelledby={`cm-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
        </div>
    );
}

export function CareManagerProfile() {
    const { careManagerId } = useParams<{ careManagerId: string }>();
    const navigate = useNavigate();
    const context = useFireCMSContext();
    const firestore = getFirestore((context.dataSource as any).firebaseApp);

    const [careManager, setCareManager] = useState<any>(null);
    const [assignedSeniors, setAssignedSeniors] = useState<any[]>([]);
    const [assignedSeniorIds, setAssignedSeniorIds] = useState<string[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [healthLogs, setHealthLogs] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [routines, setRoutines] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [tabValue, setTabValue] = useState(0);
    const [taskFilter, setTaskFilter] = useState<string>('all');
    const [alertFilter, setAlertFilter] = useState<string>('all');
    const listenersRef = useRef<(() => void)[]>([]);

    // Assignment dialog state
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [unassignedSeniors, setUnassignedSeniors] = useState<any[]>([]);
    const [selectedSeniorToAssign, setSelectedSeniorToAssign] = useState<string>('');
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

    // Confirmation Dialog State
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmData, setConfirmData] = useState<{ type: string, data: any } | null>(null);
    const [confirmTitle, setConfirmTitle] = useState('');
    const [confirmContent, setConfirmContent] = useState('');
    const [confirmColor, setConfirmColor] = useState<'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'>('primary');
    const [confirmText, setConfirmText] = useState('Confirm');

    // Effect 1: Fetch care manager profile and assigned seniors
    useEffect(() => {
        if (!careManagerId) return;

        const loadCareManagerData = async () => {
            try {
                const cmDoc = await getDoc(doc(firestore, 'users', careManagerId));
                if (cmDoc.exists()) {
                    const cmData: any = { id: cmDoc.id, ...cmDoc.data() };
                    setCareManager(cmData);

                    const seniorsQuery = query(
                        collection(firestore, 'users'),
                        where('role', '==', 'senior'),
                        where('careManagerId', '==', careManagerId)
                    );

                    const seniorsSnapshot = await getDocs(seniorsQuery);
                    const seniorsData = seniorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setAssignedSeniors(seniorsData);
                    setAssignedSeniorIds(seniorsData.map(s => s.id));
                }
                setLoading(false);
            } catch (error) {
                logger.error("Error loading care manager data: " + error);
                setLoading(false);
            }
        };

        loadCareManagerData();
    }, [careManagerId, firestore]);

    // Effect 2: Set up listeners when senior IDs change
    useEffect(() => {
        if (assignedSeniorIds.length === 0) {
            setTasks([]);
            setHealthLogs([]);
            setAlerts([]);
            setRoutines([]);
            return;
        }

        // Clean up old listeners
        listenersRef.current.forEach(unsub => unsub());
        listenersRef.current = [];

        // Split senior IDs into batches of 10 (Firestore limit)
        const batches: string[][] = [];
        for (let i = 0; i < assignedSeniorIds.length; i += 10) {
            batches.push(assignedSeniorIds.slice(i, i + 10));
        }

        // Set up listeners for each batch
        batches.forEach(seniorIds => {
            // Tasks
            listenersRef.current.push(
                onSnapshot(
                    query(collection(firestore, 'carerTasks'), where('userId', 'in', seniorIds)),
                    (snapshot) => {
                        const tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        setTasks(prev => {
                            const filtered = prev.filter(task => !seniorIds.includes(task.userId));
                            return Array.from(new Map([...filtered, ...tasksData].map(item => [item.id, item])).values());
                        });
                    }
                )
            );

            // Health Logs
            listenersRef.current.push(
                onSnapshot(
                    query(collection(firestore, 'healthLogs'), where('seniorId', 'in', seniorIds)),
                    (snapshot) => {
                        const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        setHealthLogs(prev => {
                            const filtered = prev.filter(log => !seniorIds.includes(log.seniorId));
                            return Array.from(new Map([...filtered, ...logsData].map(item => [item.id, item])).values());
                        });
                    }
                )
            );

            // Alerts
            listenersRef.current.push(
                onSnapshot(
                    query(collection(firestore, 'alerts'), where('userId', 'in', seniorIds)),
                    (snapshot) => {
                        const alertsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        setAlerts(prev => {
                            const filtered = prev.filter(alert => !seniorIds.includes(alert.userId));
                            return Array.from(new Map([...filtered, ...alertsData].map(item => [item.id, item])).values());
                        });
                    }
                )
            );

            // Routines
            listenersRef.current.push(
                onSnapshot(
                    query(collection(firestore, 'routines'), where('userId', 'in', seniorIds)),
                    (snapshot) => {
                        const routinesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        setRoutines(prev => {
                            const filtered = prev.filter(routine => !seniorIds.includes(routine.userId));
                            return Array.from(new Map([...filtered, ...routinesData].map(item => [item.id, item])).values());
                        });
                    }
                )
            );
        });

        // Cleanup listeners on unmount or when seniors change
        return () => {
            listenersRef.current.forEach(unsub => unsub());
            listenersRef.current = [];
        };
    }, [assignedSeniorIds, firestore]);

    const handleOpenAssignDialog = async () => {
        try {
            // Fetch unassigned seniors (seniors without a careManagerId)
            const seniorsQuery = query(
                collection(firestore, 'users'),
                where('role', '==', 'senior')
            );
            const seniorsSnapshot = await getDocs(seniorsQuery);
            const allSeniors = seniorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
            const unassigned = allSeniors.filter(senior => !senior.careManagerId || senior.careManagerId === '');
            setUnassignedSeniors(unassigned);
            setAssignDialogOpen(true);
        } catch (error) {
            logger.error('Error fetching unassigned seniors: ' + error);
        }
    };

    const handleAssignSenior = async () => {
        if (!selectedSeniorToAssign || !careManagerId) return;

        try {
            await updateDoc(doc(firestore, 'users', selectedSeniorToAssign), {
                careManagerId: careManagerId,
                updatedAt: new Date()
            });

            setSnackbarMessage('Senior assigned successfully!');
            setSnackbarSeverity('success');
            setSnackbarOpen(true);
            setAssignDialogOpen(false);
            setSelectedSeniorToAssign('');

            // Refresh assigned seniors list
            const seniorsQuery = query(
                collection(firestore, 'users'),
                where('role', '==', 'senior'),
                where('careManagerId', '==', careManagerId)
            );
            const seniorsSnapshot = await getDocs(seniorsQuery);
            const seniorsData = seniorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAssignedSeniors(seniorsData);
        } catch (error) {
            logger.error('Error assigning senior: ' + error);
            setSnackbarMessage('Failed to assign senior. Please try again.');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        }
    };

    const handleConfirmAction = async () => {
        if (!confirmData) return;

        if (confirmData.type === 'unassign_senior') {
            const { seniorId } = confirmData.data;
            try {
                await updateDoc(doc(firestore, 'users', seniorId), {
                    careManagerId: null,
                    updatedAt: new Date()
                });

                // Update local state
                setAssignedSeniors(prev => prev.filter(s => s.id !== seniorId));

                setSnackbarMessage('Senior unassigned successfully');
                setSnackbarSeverity('success');
                setSnackbarOpen(true);
            } catch (error) {
                logger.error("Error unassigning senior: " + error);
                setSnackbarMessage('Failed to unassign senior');
                setSnackbarSeverity('error');
                setSnackbarOpen(true);
            }
        }
        setConfirmOpen(false);
    };

    const handleUnassignSenior = (seniorId: string, seniorName: string, e: React.MouseEvent) => {
        e.stopPropagation();

        setConfirmTitle('Unassign Senior');
        setConfirmContent(`Are you sure you want to unassign ${seniorName} from this care manager?`);
        setConfirmColor('error');
        setConfirmText('Unassign');
        setConfirmData({ type: 'unassign_senior', data: { seniorId } });
        setConfirmOpen(true);
    };

    if (loading) {
        return (
            <div className="min-h-screen w-full bg-[#F8FAFC] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 font-medium">Loading care manager profile...</p>
                </div>
            </div>
        );
    }

    if (!careManager) {
        return (
            <div className="min-h-screen w-full bg-[#F8FAFC] flex items-center justify-center">
                <div className="text-center">
                    <MedicalServicesIcon sx={{ fontSize: 80, color: '#cbd5e1', mb: 3 }} />
                    <h2 className="text-2xl font-bold text-slate-700 mb-2">Care Manager Not Found</h2>
                    <p className="text-slate-500 mb-6">The requested care manager profile could not be found.</p>
                    <Button variant="contained" onClick={() => navigate('/care-managers')} sx={{ borderRadius: '12px' }}>
                        Back to Care Managers
                    </Button>
                </div>
            </div>
        );
    }

    const getAlertIcon = (type: string) => {
        switch (type) {
            case 'panic': return <WarningIcon fontSize="small" />;
            case 'missed_checkin': return <AccessTimeIcon fontSize="small" />;
            case 'medication': return <MedicationIcon fontSize="small" />;
            default: return <NotificationsIcon fontSize="small" />;
        }
    };

    const getAlertColor = (type: string, status: string) => {
        if (status === 'resolved') return 'default';
        switch (type) {
            case 'panic': return 'error';
            case 'missed_checkin': return 'warning';
            case 'medication': return 'secondary';
            default: return 'info';
        }
    };

    const filteredTasks = taskFilter === 'all' ? tasks : tasks.filter(t => t.status === taskFilter);
    const filteredAlerts = alertFilter === 'all' ? alerts : alerts.filter(a => a.status === alertFilter);

    // Calculate this month's stats
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const completedTasksThisMonth = tasks.filter(t =>
        t.status === 'completed' &&
        t.completedAt?.toDate &&
        t.completedAt.toDate() >= thisMonthStart
    ).length;
    const healthLogsThisMonth = healthLogs.filter(log =>
        log.createdAt?.toDate &&
        log.createdAt.toDate() >= thisMonthStart
    ).length;

    return (
        <div className="min-h-full w-full bg-[#F8FAFC] p-6 lg:p-8 pb-20">
            {/* Header */}
            <div className="mb-8">
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate('/care-managers')}
                    sx={{ mb: 2, color: '#64748b', textTransform: 'none' }}
                >
                    Back to Care Managers
                </Button>

                <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 overflow-hidden relative">
                    {/* Decorative blob */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-purple-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-60 pointer-events-none"></div>

                    <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start md:items-center">
                        {/* Avatar */}
                        <Avatar
                            sx={{
                                width: 120,
                                height: 120,
                                bgcolor: '#f3e8ff',
                                color: '#7c3aed',
                                fontSize: '3rem',
                                fontWeight: 'bold',
                                border: '4px solid white',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                            }}
                        >
                            {(careManager.fullName || careManager.name || 'C').charAt(0).toUpperCase()}
                        </Avatar>

                        {/* Basic Info */}
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-4xl font-extrabold text-slate-900">
                                    {careManager.fullName || careManager.name || 'Unknown'}
                                </h1>
                                <Chip
                                    label="Care Manager"
                                    size="small"
                                    sx={{
                                        bgcolor: '#f3e8ff',
                                        color: '#7c3aed',
                                        fontWeight: 'bold'
                                    }}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                                {(careManager.phone || careManager.phoneNumber) && (
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <PhoneIcon fontSize="small" className="text-purple-500" />
                                        <span className="font-medium">{careManager.phone || careManager.phoneNumber}</span>
                                    </div>
                                )}
                                {(careManager.language || careManager.preferredLanguage) && (
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <LanguageIcon fontSize="small" className="text-purple-500" />
                                        <span className="font-medium">{careManager.language || careManager.preferredLanguage}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <Card sx={{ minWidth: 90, textAlign: 'center', borderRadius: '16px' }}>
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <ElderlyIcon sx={{ color: '#8b5cf6', mb: 1, fontSize: 20 }} />
                                    <div className="text-xl font-bold text-slate-900">{assignedSeniors.length}</div>
                                    <div className="text-xs text-slate-500 font-medium">Seniors</div>
                                </CardContent>
                            </Card>
                            <Card sx={{ minWidth: 90, textAlign: 'center', borderRadius: '16px' }}>
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <NotificationsIcon sx={{ color: '#ef4444', mb: 1, fontSize: 20 }} />
                                    <div className="text-xl font-bold text-slate-900">{alerts.filter(a => a.status === 'active').length}</div>
                                    <div className="text-xs text-slate-500 font-medium">Alerts</div>
                                </CardContent>
                            </Card>
                            <Card sx={{ minWidth: 90, textAlign: 'center', borderRadius: '16px' }}>
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <AssignmentIcon sx={{ color: '#f59e0b', mb: 1, fontSize: 20 }} />
                                    <div className="text-xl font-bold text-slate-900">{tasks.filter(t => t.status === 'pending').length}</div>
                                    <div className="text-xs text-slate-500 font-medium">Pending</div>
                                </CardContent>
                            </Card>
                            <Card sx={{ minWidth: 90, textAlign: 'center', borderRadius: '16px' }}>
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <CheckCircleIcon sx={{ color: '#10b981', mb: 1, fontSize: 20 }} />
                                    <div className="text-xl font-bold text-slate-900">{completedTasksThisMonth}</div>
                                    <div className="text-xs text-slate-500 font-medium">Done/Mo</div>
                                </CardContent>
                            </Card>
                            <Card sx={{ minWidth: 90, textAlign: 'center', borderRadius: '16px' }}>
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <HealthIcon sx={{ color: '#06b6d4', mb: 1, fontSize: 20 }} />
                                    <div className="text-xl font-bold text-slate-900">{healthLogsThisMonth}</div>
                                    <div className="text-xs text-slate-500 font-medium">Logs/Mo</div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs Section */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3, bgcolor: 'white', borderRadius: '16px 16px 0 0', px: 2 }}>
                <Tabs
                    value={tabValue}
                    onChange={(e, newValue) => setTabValue(newValue)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                        '& .MuiTab-root': {
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.9rem'
                        }
                    }}
                >
                    <Tab icon={<MedicalServicesIcon />} iconPosition="start" label="Profile" />
                    <Tab icon={<PeopleIcon />} iconPosition="start" label={`Seniors (${assignedSeniors.length})`} />
                    <Tab icon={<AssignmentIcon />} iconPosition="start" label={`Tasks (${tasks.length})`} />
                    <Tab icon={<HealthIcon />} iconPosition="start" label={`Health Logs (${healthLogs.length})`} />
                    <Tab icon={<NotificationsIcon />} iconPosition="start" label={`Alerts (${alerts.length})`} />
                    <Tab icon={<ScheduleIcon />} iconPosition="start" label={`Routines (${routines.length})`} />
                </Tabs>
            </Box>

            {/* Tab Panels */}
            <div className="bg-white rounded-[0_0_2rem_2rem] p-6 shadow-sm border border-slate-100">
                {/* Profile Details Tab */}
                <TabPanel value={tabValue} index={0}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Personal Information Card */}
                        <Card sx={{ borderRadius: '1.5rem', border: '1px solid #e2e8f0' }}>
                            <CardContent sx={{ p: 4 }}>
                                <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                                    <MedicalServicesIcon className="text-purple-500" /> Personal Information
                                </h3>
                                <div className="space-y-3">
                                    <InfoRow label="Full Name" value={careManager.fullName || careManager.name || 'N/A'} />
                                    <InfoRow label="Phone" value={careManager.phone || careManager.phoneNumber || 'N/A'} />
                                    <InfoRow label="Role" value={careManager.role || 'care_manager'} capitalize />
                                    <InfoRow label="Preferred Language" value={careManager.language || careManager.preferredLanguage || 'N/A'} />
                                    <InfoRow label="Account Created" value={careManager.createdAt?.toDate ? careManager.createdAt.toDate().toLocaleDateString() : 'N/A'} />
                                    <InfoRow label="Status" value={careManager.status || 'active'} capitalize highlight />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Work Summary Card */}
                        <Card sx={{ borderRadius: '1.5rem', border: '1px solid #e2e8f0' }}>
                            <CardContent sx={{ p: 4 }}>
                                <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                                    <TrendingUpIcon className="text-purple-500" /> Work Summary
                                </h3>
                                <div className="space-y-3">
                                    <InfoRow label="Assigned Seniors" value={assignedSeniors.length.toString()} highlight />
                                    <InfoRow label="Active Alerts" value={alerts.filter(a => a.status === 'active').length.toString()} highlight />
                                    <InfoRow label="Pending Tasks" value={tasks.filter(t => t.status === 'pending').length.toString()} highlight />
                                    <InfoRow label="Completed (This Month)" value={completedTasksThisMonth.toString()} highlight />
                                    <InfoRow label="Health Logs (This Month)" value={healthLogsThisMonth.toString()} highlight />
                                    <InfoRow label="Total Routines" value={routines.length.toString()} highlight />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabPanel>

                {/* Assigned Seniors Tab */}
                <TabPanel value={tabValue} index={1}>
                    <div className="mb-4 flex justify-end">
                        <Button
                            variant="contained"
                            startIcon={<PersonAddIcon />}
                            onClick={handleOpenAssignDialog}
                            sx={{
                                bgcolor: '#8b5cf6',
                                '&:hover': { bgcolor: '#7c3aed' },
                                borderRadius: '12px',
                                textTransform: 'none',
                                fontWeight: 600
                            }}
                        >
                            Assign Senior
                        </Button>
                    </div>
                    {assignedSeniors.length === 0 ? (
                        <EmptyState icon={<ElderlyIcon sx={{ fontSize: 64, color: '#cbd5e1' }} />} message="No seniors assigned" />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {assignedSeniors.map((senior) => {
                                const seniorAlerts = alerts.filter(a => a.seniorId === senior.id && a.status === 'active');
                                return (
                                    <Card
                                        key={senior.id}
                                        sx={{
                                            borderRadius: '1.5rem',
                                            border: '1px solid #e2e8f0',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            '&:hover': {
                                                boxShadow: '0 44px 12px rgba(0,0,0,0.1)',
                                                transform: 'translateY(-2px)'
                                            }
                                        }}
                                        onClick={() => navigate(`/seniors/${senior.id}`)}
                                    >
                                        <CardContent sx={{ p: 3 }}>
                                            <div className="flex items-start gap-3 mb-3">
                                                <Avatar sx={{ width: 56, height: 56, bgcolor: '#dbeafe', color: '#1e40af', fontWeight: 'bold' }}>
                                                    {(senior.fullName || senior.name || 'S').charAt(0).toUpperCase()}
                                                </Avatar>
                                                <div className="flex-1">
                                                    <h4 className="font-bold text-slate-900 mb-1">{senior.fullName || senior.name}</h4>
                                                    {senior.age && (
                                                        <p className="text-sm text-slate-600">{senior.age} years old</p>
                                                    )}
                                                </div>
                                                {seniorAlerts.length > 0 && (
                                                    <Chip
                                                        label={seniorAlerts.length}
                                                        size="small"
                                                        color="error"
                                                        sx={{ fontWeight: 'bold' }}
                                                    />
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <PhoneIcon sx={{ fontSize: 14 }} />
                                                    <span>{senior.phone || senior.phoneNumber || 'No phone'}</span>
                                                </div>
                                                <Button
                                                    size="small"
                                                    startIcon={<PersonRemoveIcon />}
                                                    onClick={(e) => {
                                                        handleUnassignSenior(senior.id, senior.fullName || senior.name, e);
                                                    }}
                                                    sx={{
                                                        color: '#ef4444',
                                                        textTransform: 'none',
                                                        fontSize: '0.75rem',
                                                        '&:hover': {
                                                            bgcolor: '#fee2e2'
                                                        }
                                                    }}
                                                >
                                                    Unassign
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabPanel>

                {/* Tasks Tab */}
                <TabPanel value={tabValue} index={2}>
                    <div className="mb-4">
                        <ToggleButtonGroup
                            value={taskFilter}
                            exclusive
                            onChange={(e, newFilter) => newFilter && setTaskFilter(newFilter)}
                            size="small"
                        >
                            <ToggleButton value="all">All ({tasks.length})</ToggleButton>
                            <ToggleButton value="pending">Pending ({tasks.filter(t => t.status === 'pending').length})</ToggleButton>
                            <ToggleButton value="in_progress">In Progress ({tasks.filter(t => t.status === 'in_progress').length})</ToggleButton>
                            <ToggleButton value="completed">Completed ({tasks.filter(t => t.status === 'completed').length})</ToggleButton>
                        </ToggleButtonGroup>
                    </div>

                    {filteredTasks.length === 0 ? (
                        <EmptyState icon={<CheckCircleIcon sx={{ fontSize: 64, color: '#22c55e' }} />} message={`No ${taskFilter === 'all' ? '' : taskFilter} tasks`} />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredTasks.map((task) => {
                                const senior = assignedSeniors.find(s => s.id === task.userId || s.id === task.seniorId);
                                return (
                                    <Card key={task.id} sx={{ borderRadius: '1.5rem', border: '1px solid #e2e8f0' }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                                                    <AssignmentIcon />
                                                </div>
                                                <Chip
                                                    label={task.status || 'pending'}
                                                    size="small"
                                                    sx={{
                                                        bgcolor: task.status === 'completed' ? '#dcfce7' : task.status === 'in_progress' ? '#dbeafe' : '#fef3c7',
                                                        color: task.status === 'completed' ? '#15803d' : task.status === 'in_progress' ? '#1e40af' : '#d97706',
                                                        fontWeight: 'bold',
                                                        fontSize: '0.7rem',
                                                        textTransform: 'capitalize'
                                                    }}
                                                />
                                            </div>
                                            <h4 className="font-bold text-slate-900 mb-2">{task.taskType || task.type || 'General Task'}</h4>
                                            <p className="text-sm text-slate-600 mb-2">{task.description || task.taskDescription || 'No description'}</p>
                                            {senior && (
                                                <p className="text-xs text-purple-600 font-medium mb-2">For: {senior.fullName || senior.name}</p>
                                            )}
                                            {task.scheduledDate && (
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <CalendarIcon sx={{ fontSize: 14 }} />
                                                    <span>{task.scheduledDate.toDate ? task.scheduledDate.toDate().toLocaleDateString() : 'No date'}</span>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabPanel>

                {/* Health Logs Tab */}
                <TabPanel value={tabValue} index={3}>
                    {healthLogs.length === 0 ? (
                        <EmptyState icon={<HealthIcon sx={{ fontSize: 64, color: '#cbd5e1' }} />} message="No health logs recorded" />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {healthLogs.map((log) => {
                                const senior = assignedSeniors.find(s => s.id === log.seniorId || s.id === log.userId);
                                return (
                                    <Card key={log.id} sx={{ borderRadius: '1.5rem', border: '1px solid #e2e8f0' }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <div className="flex items-start gap-3 mb-3">
                                                <div className="w-12 h-12 rounded-xl bg-cyan-100 text-cyan-600 flex items-center justify-center">
                                                    <HealthIcon />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-bold text-slate-900 mb-1">Health Check</h4>
                                                    <p className="text-sm text-purple-600 font-medium">{senior?.fullName || senior?.name || log.seniorName || 'Unknown Senior'}</p>
                                                </div>
                                            </div>
                                            <div className="space-y-2 mb-3">
                                                {log.vitals?.bloodPressure && (
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-600">Blood Pressure:</span>
                                                        <span className="font-bold text-slate-900">{log.vitals.bloodPressure}</span>
                                                    </div>
                                                )}
                                                {log.vitals?.bloodSugar && (
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-600">Blood Sugar:</span>
                                                        <span className="font-bold text-slate-900">{log.vitals.bloodSugar} mg/dL</span>
                                                    </div>
                                                )}
                                                {log.vitals?.temperature && (
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-600">Temperature:</span>
                                                        <span className="font-bold text-slate-900">{log.vitals.temperature}°F</span>
                                                    </div>
                                                )}
                                            </div>
                                            {log.notes && (
                                                <p className="text-sm text-slate-600 mb-2 italic">"{log.notes}"</p>
                                            )}
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <CalendarIcon sx={{ fontSize: 14 }} />
                                                <span>{log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : 'Recently'}</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabPanel>

                {/* Alerts Tab */}
                <TabPanel value={tabValue} index={4}>
                    <div className="mb-4">
                        <ToggleButtonGroup
                            value={alertFilter}
                            exclusive
                            onChange={(e, newFilter) => newFilter && setAlertFilter(newFilter)}
                            size="small"
                        >
                            <ToggleButton value="all">All ({alerts.length})</ToggleButton>
                            <ToggleButton value="active">Active ({alerts.filter(a => a.status === 'active').length})</ToggleButton>
                            <ToggleButton value="resolved">Resolved ({alerts.filter(a => a.status === 'resolved').length})</ToggleButton>
                        </ToggleButtonGroup>
                    </div>

                    {filteredAlerts.length === 0 ? (
                        <EmptyState icon={<CheckCircleIcon sx={{ fontSize: 64, color: '#22c55e' }} />} message={`No ${alertFilter === 'all' ? '' : alertFilter} alerts`} />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredAlerts.map((alert) => {
                                const senior = assignedSeniors.find(s => s.id === alert.seniorId || s.id === alert.userId);
                                return (
                                    <Card key={alert.id} sx={{ borderRadius: '1.5rem', border: '1px solid #e2e8f0' }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <div className="flex items-start justify-between mb-3">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${alert.type === 'panic' ? 'bg-red-100 text-red-600' :
                                                    alert.type === 'missed_checkin' ? 'bg-amber-100 text-amber-600' :
                                                        alert.type === 'medication' ? 'bg-violet-100 text-violet-600' :
                                                            'bg-blue-100 text-blue-600'
                                                    }`}>
                                                    {getAlertIcon(alert.type)}
                                                </div>
                                                <Chip
                                                    label={alert.status || 'active'}
                                                    size="small"
                                                    color={getAlertColor(alert.type, alert.status)}
                                                    sx={{ fontWeight: 'bold', fontSize: '0.7rem', textTransform: 'capitalize' }}
                                                />
                                            </div>
                                            <h4 className="font-bold text-slate-900 mb-2 capitalize">{alert.type?.replace('_', ' ') || 'System Alert'}</h4>
                                            <p className="text-sm text-purple-600 font-medium mb-2">{senior?.fullName || senior?.name || 'Unknown Senior'}</p>
                                            <p className="text-sm text-slate-600 mb-3">{alert.message || 'No additional details'}</p>
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <AccessTimeIcon sx={{ fontSize: 14 }} />
                                                <span>{alert.createdAt?.toDate ? alert.createdAt.toDate().toLocaleString() : 'Recently'}</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabPanel>

                {/* Routines Tab */}
                <TabPanel value={tabValue} index={5}>
                    {routines.length === 0 ? (
                        <EmptyState icon={<ScheduleIcon sx={{ fontSize: 64, color: '#cbd5e1' }} />} message="No routines scheduled" />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {routines.map((routine) => {
                                const senior = assignedSeniors.find(s => s.id === routine.userId || s.id === routine.seniorId);
                                return (
                                    <Card key={routine.id} sx={{ borderRadius: '1.5rem', border: '1px solid #e2e8f0' }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                                                    <ScheduleIcon />
                                                </div>
                                                <Chip
                                                    label={routine.frequency || 'Once'}
                                                    size="small"
                                                    sx={{ bgcolor: '#f3e8ff', color: '#7c3aed', fontWeight: 'bold', fontSize: '0.7rem' }}
                                                />
                                            </div>
                                            <h4 className="font-bold text-slate-900 mb-2">{routine.title || 'Unnamed Routine'}</h4>
                                            <p className="text-sm text-purple-600 font-medium mb-2">{senior?.fullName || senior?.name || 'Unknown Senior'}</p>
                                            <p className="text-sm text-slate-600 mb-3">{routine.description || 'No description'}</p>
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <AccessTimeIcon sx={{ fontSize: 14 }} />
                                                <span>{routine.scheduledTime?.toDate ? routine.scheduledTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No time set'}</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabPanel>
            </div>

            {/* Assignment Dialog */}
            <Dialog
                open={assignDialogOpen}
                onClose={() => setAssignDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { borderRadius: '20px' } }}
            >
                <DialogTitle sx={{ pb: 1 }}>
                    <div className="flex items-center gap-2">
                        <PersonAddIcon className="text-purple-600" />
                        <span className="text-xl font-bold">Assign Senior</span>
                    </div>
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <FormControl fullWidth>
                        <InputLabel>Select Senior</InputLabel>
                        <Select
                            value={selectedSeniorToAssign}
                            onChange={(e) => setSelectedSeniorToAssign(e.target.value)}
                            label="Select Senior"
                        >
                            {unassignedSeniors.map((senior) => (
                                <MenuItem key={senior.id} value={senior.id}>
                                    {senior.fullName || senior.name} {senior.age && `(${senior.age} years)`}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    {unassignedSeniors.length === 0 && (
                        <p className="text-sm text-slate-500 mt-2">No unassigned seniors available</p>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button
                        onClick={() => setAssignDialogOpen(false)}
                        sx={{ textTransform: 'none', borderRadius: '10px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleAssignSenior}
                        variant="contained"
                        disabled={!selectedSeniorToAssign}
                        sx={{
                            bgcolor: '#8b5cf6',
                            '&:hover': { bgcolor: '#7c3aed' },
                            textTransform: 'none',
                            borderRadius: '10px'
                        }}
                    >
                        Assign
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Confirmation Dialog */}
            <ConfirmationDialog
                open={confirmOpen}
                title={confirmTitle}
                content={confirmContent}
                onConfirm={handleConfirmAction}
                onCancel={() => setConfirmOpen(false)}
                confirmColor={confirmColor}
                confirmText={confirmText}
            />

            {/* Snackbar */}
            <Snackbar
                open={snackbarOpen}
                autoHideDuration={4000}
                onClose={() => setSnackbarOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbarOpen(false)}
                    severity={snackbarSeverity}
                    sx={{ borderRadius: '12px' }}
                >
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </div>
    );
}

// Helper Components
function InfoRow({ label, value, capitalize = false, highlight = false }: any) {
    return (
        <div className="flex justify-between items-center border-b border-slate-50 pb-2">
            <span className="text-sm font-medium text-slate-500">{label}</span>
            <span className={`text-sm font-bold ${highlight ? 'text-purple-600' : 'text-slate-900'
                } ${capitalize ? 'capitalize' : ''}`}>
                {value}
            </span>
        </div>
    );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-12">
            {icon}
            <p className="text-slate-500 font-medium mt-4">{message}</p>
        </div>
    );
}
