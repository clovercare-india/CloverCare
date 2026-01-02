import React, { useEffect, useState } from 'react';
import {
    Button,
    Chip,
    Card,
    CardContent,
    Avatar,
    IconButton,
    Tabs,
    Tab,
    Box,
    Snackbar,
    Alert
} from '@mui/material';
import ConfirmationDialog from '../common/ConfirmationDialog';
import {
    ArrowBack as ArrowBackIcon,
    Phone as PhoneIcon,
    Home as HomeIcon,
    Elderly as ElderlyIcon,
    MedicalServices as MedicalServicesIcon,
    Notifications as NotificationsIcon,
    Schedule as ScheduleIcon,
    Assignment as AssignmentIcon,
    People as PeopleIcon,
    LocationOn as LocationOnIcon,
    Cake as CakeIcon,
    Work as WorkIcon,
    Language as LanguageIcon,
    Apartment as ApartmentIcon,
    Wc as GenderIcon,
    CalendarMonth as CalendarIcon,
    Warning as WarningIcon,
    CheckCircle as CheckCircleIcon,
    AccessTime as AccessTimeIcon,
    Medication as MedicationIcon,
    LocalHospital as HealthIcon,
    PersonRemove as PersonRemoveIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, onSnapshot, getFirestore, updateDoc } from 'firebase/firestore';
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
            id={`senior-tabpanel-${index}`}
            aria-labelledby={`senior-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
        </div>
    );
}

export function SeniorProfile() {
    const { seniorId } = useParams<{ seniorId: string }>();
    const navigate = useNavigate();
    const context = useFireCMSContext();
    const firestore = getFirestore((context.dataSource as any).firebaseApp);

    const [senior, setSenior] = useState<any>(null);
    const [careManager, setCareManager] = useState<any>(null);
    const [linkedFamilies, setLinkedFamilies] = useState<any[]>([]);
    const [routines, setRoutines] = useState<any[]>([]);
    const [reminders, setReminders] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [healthLogs, setHealthLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [tabValue, setTabValue] = useState(0);

    // Snackbar state
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

    useEffect(() => {
        if (!seniorId) return;

        const loadSeniorData = async () => {
            try {
                // Load Senior Profile
                const seniorDoc = await getDoc(doc(firestore, 'users', seniorId));
                if (seniorDoc.exists()) {
                    const seniorData: any = { id: seniorDoc.id, ...seniorDoc.data() };
                    setSenior(seniorData);

                    // Load Care Manager if assigned
                    if (seniorData.careManagerId) {
                        const cmDoc = await getDoc(doc(firestore, 'users', seniorData.careManagerId));
                        if (cmDoc.exists()) {
                            setCareManager({ id: cmDoc.id, ...cmDoc.data() });
                        }
                    }

                    // Load Linked Families
                    if (seniorData.linkedFamily && Array.isArray(seniorData.linkedFamily)) {
                        const familyPromises = seniorData.linkedFamily.map((familyId: string) =>
                            getDoc(doc(firestore, 'users', familyId))
                        );
                        const familyDocs = await Promise.all(familyPromises);
                        const familiesData = familyDocs
                            .filter((doc: any) => doc.exists())
                            .map((doc: any) => ({ id: doc.id, ...doc.data() }));
                        setLinkedFamilies(familiesData);
                    }
                }

                setLoading(false);
            } catch (error) {
                logger.error("Error loading senior data: " + error);
                setLoading(false);
            }
        };

        loadSeniorData();

        // Real-time listeners for dynamic data
        const routinesUnsub = onSnapshot(
            query(collection(firestore, 'routines'), where('userId', '==', seniorId)),
            (snapshot) => {
                const routinesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setRoutines(routinesData);
            }
        );

        const remindersUnsub = onSnapshot(
            query(collection(firestore, 'reminders'), where('userId', '==', seniorId)),
            (snapshot) => {
                const remindersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setReminders(remindersData);
            }
        );

        const alertsUnsub = onSnapshot(
            query(collection(firestore, 'alerts'), where('userId', '==', seniorId)),
            (snapshot) => {
                const alertsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAlerts(alertsData);
            }
        );

        const tasksUnsub = onSnapshot(
            query(collection(firestore, 'carerTasks'), where('userId', '==', seniorId)),
            (snapshot) => {
                const tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setTasks(tasksData);
            }
        );

        const healthLogsUnsub = onSnapshot(
            query(collection(firestore, 'healthLogs'), where('seniorId', '==', seniorId)),
            (snapshot) => {
                const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setHealthLogs(logsData);
            }
        );

        return () => {
            routinesUnsub();
            remindersUnsub();
            alertsUnsub();
            alertsUnsub();
            tasksUnsub();
            healthLogsUnsub();
        };
    }, [seniorId, firestore]);

    const handleConfirmAction = async () => {
        if (!confirmData) return;

        if (confirmData.type === 'unassign_care_manager') {
            try {
                await updateDoc(doc(firestore, 'users', seniorId!), {
                    careManagerId: null,
                    updatedAt: new Date()
                });

                // Update local state
                setSenior((prev: any) => ({ ...prev, careManagerId: null }));
                setCareManager(null);

                setSnackbarMessage('Care manager unassigned successfully');
                setSnackbarSeverity('success');
                setSnackbarOpen(true);
            } catch (error) {
                logger.error("Error unassigning care manager: " + error);
                setSnackbarMessage('Failed to unassign care manager');
                setSnackbarSeverity('error');
                setSnackbarOpen(true);
            }
        }
        setConfirmOpen(false);
    };

    const handleUnassignCareManager = () => {
        if (!careManager) return;

        setConfirmTitle('Unassign Care Manager');
        setConfirmContent(`Are you sure you want to unassign ${careManager.fullName || careManager.name} from this senior?`);
        setConfirmColor('error');
        setConfirmText('Unassign');
        setConfirmData({ type: 'unassign_care_manager', data: {} });
        setConfirmOpen(true);
    };
    if (loading) {
        return (
            <div className="min-h-screen w-full bg-[#F8FAFC] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 font-medium">Loading senior profile...</p>
                </div>
            </div>
        );
    }

    if (!senior) {
        return (
            <div className="min-h-screen w-full bg-[#F8FAFC] flex items-center justify-center">
                <div className="text-center">
                    <ElderlyIcon sx={{ fontSize: 80, color: '#cbd5e1', mb: 3 }} />
                    <h2 className="text-2xl font-bold text-slate-700 mb-2">Senior Not Found</h2>
                    <p className="text-slate-500 mb-6">The requested senior profile could not be found.</p>
                    <Button variant="contained" onClick={() => navigate('/seniors')} sx={{ borderRadius: '12px' }}>
                        Back to Seniors
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

    return (
        <div className="min-h-full w-full bg-[#F8FAFC] p-6 lg:p-8 pb-20">
            {/* Header */}
            <div className="mb-8">
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate('/seniors')}
                    sx={{ mb: 2, color: '#64748b', textTransform: 'none' }}
                >
                    Back to Seniors
                </Button>

                <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 overflow-hidden relative">
                    {/* Decorative blob */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-60 pointer-events-none"></div>

                    <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start md:items-center">
                        {/* Avatar */}
                        <Avatar
                            sx={{
                                width: 120,
                                height: 120,
                                bgcolor: '#dbeafe',
                                color: '#1e40af',
                                fontSize: '3rem',
                                fontWeight: 'bold',
                                border: '4px solid white',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                            }}
                        >
                            {(senior.fullName || senior.name || 'S').charAt(0).toUpperCase()}
                        </Avatar>

                        {/* Basic Info */}
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-4xl font-extrabold text-slate-900">
                                    {senior.fullName || senior.name || 'Unknown'}
                                </h1>
                                <Chip
                                    label={senior.role || 'senior'}
                                    size="small"
                                    sx={{
                                        bgcolor: '#dbeafe',
                                        color: '#1e40af',
                                        fontWeight: 'bold',
                                        textTransform: 'capitalize'
                                    }}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                                {senior.age && (
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <CakeIcon fontSize="small" className="text-blue-500" />
                                        <span className="font-medium">{senior.age} years old</span>
                                    </div>
                                )}
                                {senior.gender && (
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <GenderIcon fontSize="small" className="text-blue-500" />
                                        <span className="font-medium capitalize">{senior.gender}</span>
                                    </div>
                                )}
                                {(senior.phone || senior.phoneNumber) && (
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <PhoneIcon fontSize="small" className="text-blue-500" />
                                        <span className="font-medium">{senior.phone || senior.phoneNumber}</span>
                                    </div>
                                )}
                                {senior.preferredLanguage && (
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <LanguageIcon fontSize="small" className="text-blue-500" />
                                        <span className="font-medium">{senior.preferredLanguage}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <Card sx={{ minWidth: 100, textAlign: 'center', borderRadius: '16px' }}>
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <NotificationsIcon sx={{ color: '#ef4444', mb: 1 }} />
                                    <div className="text-2xl font-bold text-slate-900">{alerts.filter(a => a.status === 'active').length}</div>
                                    <div className="text-xs text-slate-500 font-medium">Active Alerts</div>
                                </CardContent>
                            </Card>
                            <Card sx={{ minWidth: 100, textAlign: 'center', borderRadius: '16px' }}>
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <ScheduleIcon sx={{ color: '#8b5cf6', mb: 1 }} />
                                    <div className="text-2xl font-bold text-slate-900">{routines.length}</div>
                                    <div className="text-xs text-slate-500 font-medium">Routines</div>
                                </CardContent>
                            </Card>
                            <Card sx={{ minWidth: 100, textAlign: 'center', borderRadius: '16px' }}>
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <CalendarIcon sx={{ color: '#10b981', mb: 1 }} />
                                    <div className="text-2xl font-bold text-slate-900">{reminders.length}</div>
                                    <div className="text-xs text-slate-500 font-medium">Reminders</div>
                                </CardContent>
                            </Card>
                            <Card sx={{ minWidth: 100, textAlign: 'center', borderRadius: '16px' }}>
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <AssignmentIcon sx={{ color: '#f59e0b', mb: 1 }} />
                                    <div className="text-2xl font-bold text-slate-900">{tasks.length}</div>
                                    <div className="text-xs text-slate-500 font-medium">Tasks</div>
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
                            fontSize: '0.95rem'
                        }
                    }}
                >
                    <Tab icon={<HomeIcon />} iconPosition="start" label="Profile Details" />
                    <Tab icon={<ScheduleIcon />} iconPosition="start" label={`Routines (${routines.length})`} />
                    <Tab icon={<CalendarIcon />} iconPosition="start" label={`Reminders (${reminders.length})`} />
                    <Tab icon={<NotificationsIcon />} iconPosition="start" label={`Alerts (${alerts.length})`} />
                    <Tab icon={<AssignmentIcon />} iconPosition="start" label={`Tasks (${tasks.length})`} />
                    <Tab icon={<HealthIcon />} iconPosition="start" label={`Health Logs (${healthLogs.length})`} />
                    <Tab icon={<PeopleIcon />} iconPosition="start" label="Connections" />
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
                                    <ElderlyIcon className="text-blue-500" /> Personal Information
                                </h3>
                                <div className="space-y-3">
                                    <InfoRow label="Full Name" value={senior.fullName || senior.name || 'N/A'} />
                                    <InfoRow label="Age" value={senior.age ? `${senior.age} years` : 'N/A'} />
                                    <InfoRow label="Gender" value={senior.gender || 'N/A'} capitalize />
                                    <InfoRow label="Phone" value={senior.phone || senior.phoneNumber || 'N/A'} />
                                    <InfoRow label="Employment Status" value={senior.employmentStatus || 'N/A'} capitalize />
                                    <InfoRow label="Living Status" value={senior.livingStatus || 'N/A'} capitalize />
                                    <InfoRow label="Preferred Language" value={senior.preferredLanguage || 'N/A'} />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Address Card */}
                        <Card sx={{ borderRadius: '1.5rem', border: '1px solid #e2e8f0' }}>
                            <CardContent sx={{ p: 4 }}>
                                <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                                    <LocationOnIcon className="text-emerald-500" /> Location Details
                                </h3>
                                <div className="space-y-3">
                                    {senior.address ? (
                                        <>
                                            <InfoRow label="Full Address" value={senior.address.fullAddress || 'N/A'} />
                                            <InfoRow label="City" value={senior.address.city || 'N/A'} />
                                            <InfoRow label="State" value={senior.address.state || 'N/A'} />
                                            <InfoRow label="Country" value={senior.address.country || 'N/A'} />
                                            <InfoRow label="PIN Code" value={senior.address.pinCode || 'N/A'} />
                                        </>
                                    ) : (
                                        <p className="text-slate-500 italic">No address information available</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabPanel>

                {/* Routines Tab */}
                <TabPanel value={tabValue} index={1}>
                    {routines.length === 0 ? (
                        <EmptyState icon={<ScheduleIcon sx={{ fontSize: 64, color: '#cbd5e1' }} />} message="No routines scheduled" />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {routines.map((routine) => (
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
                                        <p className="text-sm text-slate-600 mb-3">{routine.description || 'No description'}</p>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <AccessTimeIcon sx={{ fontSize: 14 }} />
                                            <span>{routine.scheduledTime?.toDate ? routine.scheduledTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No time set'}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabPanel>

                {/* Reminders Tab */}
                <TabPanel value={tabValue} index={2}>
                    {reminders.length === 0 ? (
                        <EmptyState icon={<CalendarIcon sx={{ fontSize: 64, color: '#cbd5e1' }} />} message="No reminders set" />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {reminders.map((reminder) => (
                                <Card key={reminder.id} sx={{ borderRadius: '1.5rem', border: '1px solid #e2e8f0' }}>
                                    <CardContent sx={{ p: 3 }}>
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                                <CalendarIcon />
                                            </div>
                                            <Chip
                                                label={reminder.reminderType || 'General'}
                                                size="small"
                                                sx={{ bgcolor: '#d1fae5', color: '#047857', fontWeight: 'bold', fontSize: '0.7rem' }}
                                            />
                                        </div>
                                        <h4 className="font-bold text-slate-900 mb-2">{reminder.title || 'Unnamed Reminder'}</h4>
                                        <p className="text-sm text-slate-600 mb-3">{reminder.description || 'No description'}</p>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <AccessTimeIcon sx={{ fontSize: 14 }} />
                                            <span>{reminder.reminderTime?.toDate ? reminder.reminderTime.toDate().toLocaleString() : 'No time set'}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabPanel>

                {/* Alerts Tab */}
                <TabPanel value={tabValue} index={3}>
                    {alerts.length === 0 ? (
                        <EmptyState icon={<CheckCircleIcon sx={{ fontSize: 64, color: '#22c55e' }} />} message="No alerts found - All clear!" />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {alerts.map((alert) => (
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
                                        <p className="text-sm text-slate-600 mb-3">{alert.message || 'No additional details'}</p>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <AccessTimeIcon sx={{ fontSize: 14 }} />
                                            <span>{alert.createdAt?.toDate ? alert.createdAt.toDate().toLocaleString() : 'Recently'}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabPanel>

                {/* Tasks Tab */}
                <TabPanel value={tabValue} index={4}>
                    {tasks.length === 0 ? (
                        <EmptyState icon={<AssignmentIcon sx={{ fontSize: 64, color: '#cbd5e1' }} />} message="No tasks assigned" />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {tasks.map((task) => (
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
                                                    bgcolor: task.status === 'completed' ? '#dcfce7' : '#fef3c7',
                                                    color: task.status === 'completed' ? '#15803d' : '#d97706',
                                                    fontWeight: 'bold',
                                                    fontSize: '0.7rem',
                                                    textTransform: 'capitalize'
                                                }}
                                            />
                                        </div>
                                        <h4 className="font-bold text-slate-900 mb-2">{task.taskType || 'General Task'}</h4>
                                        <p className="text-sm text-slate-600 mb-3">{task.description || 'No description'}</p>
                                        {task.scheduledDate && (
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <CalendarIcon sx={{ fontSize: 14 }} />
                                                <span>{task.scheduledDate.toDate ? task.scheduledDate.toDate().toLocaleDateString() : 'No date'}</span>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabPanel>

                {/* Health Logs Tab */}
                <TabPanel value={tabValue} index={5}>
                    {healthLogs.length === 0 ? (
                        <EmptyState icon={<HealthIcon sx={{ fontSize: 64, color: '#cbd5e1' }} />} message="No health logs recorded" />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {healthLogs.map((log) => (
                                <Card key={log.id} sx={{ borderRadius: '1.5rem', border: '1px solid #e2e8f0' }}>
                                    <CardContent sx={{ p: 3 }}>
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className="w-12 h-12 rounded-xl bg-cyan-100 text-cyan-600 flex items-center justify-center">
                                                <HealthIcon />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-bold text-slate-900 mb-1">Health Check</h4>
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <CalendarIcon sx={{ fontSize: 14 }} />
                                                    <span>{log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : 'Recently'}</span>
                                                </div>
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
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabPanel>

                {/* Connections Tab */}
                <TabPanel value={tabValue} index={6}>
                    <div className="space-y-6">
                        {/* Care Manager */}
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <MedicalServicesIcon className="text-purple-500" /> Assigned Care Manager
                            </h3>
                            {careManager ? (
                                <Card sx={{ borderRadius: '1.5rem', border: '1px solid #e2e8f0', maxWidth: 600 }}>
                                    <CardContent sx={{ p: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
                                        <Avatar sx={{ width: 64, height: 64, bgcolor: '#f3e8ff', color: '#7c3aed', fontSize: '1.5rem', fontWeight: 'bold' }}>
                                            {(careManager.fullName || careManager.name || 'C').charAt(0).toUpperCase()}
                                        </Avatar>
                                        <div className="flex-1">
                                            <h4 className="text-xl font-bold text-slate-900">{careManager.fullName || careManager.name}</h4>
                                            <div className="flex items-center gap-2 text-slate-600 mt-1">
                                                <PhoneIcon fontSize="small" />
                                                <span>{careManager.phone || careManager.phoneNumber || 'No phone'}</span>
                                            </div>
                                            <Chip label="Care Manager" size="small" sx={{ mt: 2, bgcolor: '#f3e8ff', color: '#7c3aed', fontWeight: 'bold' }} />
                                        </div>
                                        <Button
                                            size="small"
                                            startIcon={<PersonRemoveIcon />}
                                            onClick={handleUnassignCareManager}
                                            sx={{
                                                color: '#ef4444',
                                                textTransform: 'none',
                                                '&:hover': {
                                                    bgcolor: '#fee2e2'
                                                }
                                            }}
                                        >
                                            Unassign
                                        </Button>
                                    </CardContent>
                                </Card>
                            ) : (
                                <p className="text-slate-500 italic">No care manager assigned</p>
                            )}
                        </div>

                        {/* Linked Families */}
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <PeopleIcon className="text-emerald-500" /> Linked Family Members
                            </h3>
                            {linkedFamilies.length === 0 ? (
                                <p className="text-slate-500 italic">No family members linked</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {linkedFamilies.map((family) => (
                                        <Card key={family.id} sx={{ borderRadius: '1.5rem', border: '1px solid #e2e8f0' }}>
                                            <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                                                <Avatar sx={{ width: 48, height: 48, bgcolor: '#d1fae5', color: '#047857', fontWeight: 'bold' }}>
                                                    {(family.fullName || family.name || 'F').charAt(0).toUpperCase()}
                                                </Avatar>
                                                <div className="flex-1">
                                                    <h4 className="font-bold text-slate-900">{family.fullName || family.name}</h4>
                                                    <div className="flex items-center gap-1 text-sm text-slate-600 mt-0.5">
                                                        <PhoneIcon sx={{ fontSize: 12 }} />
                                                        <span className="text-xs">{family.phone || family.phoneNumber || 'No phone'}</span>
                                                    </div>
                                                </div>
                                                <Chip label="Family" size="small" sx={{ bgcolor: '#d1fae5', color: '#047857', fontWeight: 'bold', fontSize: '0.7rem' }} />
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </TabPanel>
            </div>

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
        </div>
    );
}

// Helper Components
function InfoRow({ label, value, capitalize = false, code = false, highlight = false }: any) {
    return (
        <div className="flex justify-between items-center border-b border-slate-50 pb-2">
            <span className="text-sm font-medium text-slate-500">{label}</span>
            <span className={`text-sm font-bold ${highlight ? 'text-blue-600' : 'text-slate-900'
                } ${capitalize ? 'capitalize' : ''} ${code ? 'font-mono bg-slate-100 px-2 py-0.5 rounded' : ''}`}>
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
