import React, { useEffect, useState } from 'react';
import {
    Button,
    Chip,
    Card,
    CardContent,
    Avatar,
    Tabs,
    Tab,
    Box
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    Phone as PhoneIcon,
    Home as HomeIcon,
    People as PeopleIcon,
    LocationOn as LocationOnIcon,
    Cake as CakeIcon,
    Language as LanguageIcon,
    Wc as GenderIcon,
    CalendarMonth as CalendarIcon,
    Elderly as ElderlyIcon,
    Notifications as NotificationsIcon,
    History as HistoryIcon,
    FamilyRestroom as FamilyIcon,
    PersonAdd as PersonAddIcon,
    CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, getDocs, collection, query, where, onSnapshot, getFirestore, orderBy, limit } from 'firebase/firestore';
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
            id={`family-tabpanel-${index}`}
            aria-labelledby={`family-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
        </div>
    );
}

export function FamilyProfile() {
    const { familyId } = useParams<{ familyId: string }>();
    const navigate = useNavigate();
    const context = useFireCMSContext();
    const firestore = getFirestore((context.dataSource as any).firebaseApp);

    const [family, setFamily] = useState<any>(null);
    const [linkedSeniors, setLinkedSeniors] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [activityLog, setActivityLog] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [tabValue, setTabValue] = useState(0);

    useEffect(() => {
        if (!familyId) return;

        // Store all unsubscribe functions for cleanup
        const unsubscribeFunctions: (() => void)[] = [];

        const loadFamilyData = async () => {
            try {
                // Load Family Profile
                const familyDoc = await getDoc(doc(firestore, 'users', familyId));
                if (familyDoc.exists()) {
                    const familyData: any = { id: familyDoc.id, ...familyDoc.data() };
                    setFamily(familyData);

                    // Load Linked Seniors (Query by linkedFamily array-contains familyId)
                    const seniorsQuery = query(
                        collection(firestore, 'users'),
                        where('linkedFamily', 'array-contains', familyId)
                    );

                    const seniorsSnapshot = await getDocs(seniorsQuery);
                    const seniorsData = seniorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setLinkedSeniors(seniorsData);

                    // Set up real-time alerts listener for linked seniors
                    if (seniorsData.length > 0) {
                        const allSeniorIds = seniorsData.map(s => s.id);

                        // Helper function to chunk array into batches of 10
                        const chunkArray = <T,>(array: T[], size: number): T[][] => {
                            const chunks: T[][] = [];
                            for (let i = 0; i < array.length; i += size) {
                                chunks.push(array.slice(i, i + size));
                            }
                            return chunks;
                        };

                        // Split senior IDs into batches of 10 (Firestore 'in' query limit)
                        const seniorIdBatches = chunkArray(allSeniorIds, 10);

                        // Alerts listeners - one for each batch
                        seniorIdBatches.forEach((seniorIds, batchIndex) => {
                            const alertsUnsub = onSnapshot(
                                query(
                                    collection(firestore, 'alerts'),
                                    where('userId', 'in', seniorIds)
                                ),
                                (snapshot) => {
                                    const alertsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                                    setAlerts(prev => {
                                        // Remove old data from this batch and add new data
                                        const otherBatchData = prev.filter(alert => !seniorIds.includes(alert.userId));
                                        const combined = [...otherBatchData, ...alertsData];
                                        // Remove duplicates based on ID
                                        return Array.from(new Map(combined.map(item => [item.id, item])).values());
                                    });
                                }
                            );
                            unsubscribeFunctions.push(alertsUnsub);
                        });
                    }
                }

                setLoading(false);
            } catch (error) {
                logger.error("Error loading family data: " + error);
                setLoading(false);
            }
        };

        loadFamilyData();

        // Activity log listener (recent updates to profile, linked seniors, etc.)
        const activityUnsub = onSnapshot(
            query(
                collection(firestore, 'activityLogs'),
                where('userId', '==', familyId),
                orderBy('timestamp', 'desc'),
                limit(20)
            ),
            (snapshot) => {
                const activities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setActivityLog(activities);
            },
            (error) => {
                logger.debug("Activity log not available or error: " + error);
                setActivityLog([]);
            }
        );
        unsubscribeFunctions.push(activityUnsub);

        // Cleanup function to unsubscribe from all listeners
        return () => {
            unsubscribeFunctions.forEach(unsub => unsub());
        };
    }, [familyId, firestore]);

    if (loading) {
        return (
            <div className="min-h-screen w-full bg-[#F8FAFC] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 font-medium">Loading family profile...</p>
                </div>
            </div>
        );
    }

    if (!family) {
        return (
            <div className="min-h-screen w-full bg-[#F8FAFC] flex items-center justify-center">
                <div className="text-center">
                    <FamilyIcon sx={{ fontSize: 80, color: '#cbd5e1', mb: 3 }} />
                    <h2 className="text-2xl font-bold text-slate-700 mb-2">Family Member Not Found</h2>
                    <p className="text-slate-500 mb-6">The requested family profile could not be found.</p>
                    <Button variant="contained" onClick={() => navigate('/families')} sx={{ borderRadius: '12px' }}>
                        Back to Families
                    </Button>
                </div>
            </div>
        );
    }

    const getRelationshipLabel = (relationship: string) => {
        const labels: any = {
            son: 'Son',
            daughter: 'Daughter',
            spouse: 'Spouse',
            sibling: 'Sibling',
            friend: 'Friend',
            other: 'Other'
        };
        return labels[relationship] || relationship;
    };

    return (
        <div className="min-h-full w-full bg-[#F8FAFC] p-6 lg:p-8 pb-20">
            {/* Header */}
            <div className="mb-8">
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate('/families')}
                    sx={{ mb: 2, color: '#64748b', textTransform: 'none' }}
                >
                    Back to Families
                </Button>

                <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 overflow-hidden relative">
                    {/* Decorative blob */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-60 pointer-events-none"></div>

                    <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start md:items-center">
                        {/* Avatar */}
                        <Avatar
                            sx={{
                                width: 120,
                                height: 120,
                                bgcolor: '#d1fae5',
                                color: '#047857',
                                fontSize: '3rem',
                                fontWeight: 'bold',
                                border: '4px solid white',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                            }}
                        >
                            {(family.fullName || family.name || 'F').charAt(0).toUpperCase()}
                        </Avatar>

                        {/* Basic Info */}
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-4xl font-extrabold text-slate-900">
                                    {family.fullName || family.name || 'Unknown'}
                                </h1>
                                <Chip
                                    label={family.role || 'family'}
                                    size="small"
                                    sx={{
                                        bgcolor: '#d1fae5',
                                        color: '#047857',
                                        fontWeight: 'bold',
                                        textTransform: 'capitalize'
                                    }}
                                />
                            </div>

                            {family.relationshipToSenior && (
                                <Chip
                                    icon={<FamilyIcon fontSize="small" />}
                                    label={getRelationshipLabel(family.relationshipToSenior)}
                                    size="small"
                                    sx={{
                                        bgcolor: '#fef3c7',
                                        color: '#d97706',
                                        fontWeight: 'bold',
                                        mb: 2
                                    }}
                                />
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                                {family.age && (
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <CakeIcon fontSize="small" className="text-emerald-500" />
                                        <span className="font-medium">{family.age} years old</span>
                                    </div>
                                )}
                                {family.gender && (
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <GenderIcon fontSize="small" className="text-emerald-500" />
                                        <span className="font-medium capitalize">{family.gender}</span>
                                    </div>
                                )}
                                {(family.phone || family.phoneNumber) && (
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <PhoneIcon fontSize="small" className="text-emerald-500" />
                                        <span className="font-medium">{family.phone || family.phoneNumber}</span>
                                    </div>
                                )}
                                {(family.language || family.preferredLanguage) && (
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <LanguageIcon fontSize="small" className="text-emerald-500" />
                                        <span className="font-medium">{family.language || family.preferredLanguage}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <Card sx={{ minWidth: 100, textAlign: 'center', borderRadius: '16px' }}>
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <ElderlyIcon sx={{ color: '#10b981', mb: 1 }} />
                                    <div className="text-2xl font-bold text-slate-900">{linkedSeniors.length}</div>
                                    <div className="text-xs text-slate-500 font-medium">Linked Seniors</div>
                                </CardContent>
                            </Card>
                            <Card sx={{ minWidth: 100, textAlign: 'center', borderRadius: '16px' }}>
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <NotificationsIcon sx={{ color: '#ef4444', mb: 1 }} />
                                    <div className="text-2xl font-bold text-slate-900">{alerts.filter(a => a.status === 'active').length}</div>
                                    <div className="text-xs text-slate-500 font-medium">Active Alerts</div>
                                </CardContent>
                            </Card>
                            <Card sx={{ minWidth: 100, textAlign: 'center', borderRadius: '16px' }}>
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <HistoryIcon sx={{ color: '#8b5cf6', mb: 1 }} />
                                    <div className="text-2xl font-bold text-slate-900">{activityLog.length}</div>
                                    <div className="text-xs text-slate-500 font-medium">Activities</div>
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
                    <Tab icon={<PeopleIcon />} iconPosition="start" label={`Linked Seniors (${linkedSeniors.length})`} />
                    <Tab icon={<HistoryIcon />} iconPosition="start" label={`Activity Log (${activityLog.length})`} />
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
                                    <FamilyIcon className="text-emerald-500" /> Personal Information
                                </h3>
                                <div className="space-y-3">
                                    <InfoRow label="Full Name" value={family.fullName || family.name || 'N/A'} />
                                    <InfoRow label="Age" value={family.age ? `${family.age} years` : 'N/A'} />
                                    <InfoRow label="Gender" value={family.gender || 'N/A'} capitalize />
                                    <InfoRow label="Phone" value={family.phone || family.phoneNumber || 'N/A'} />
                                    <InfoRow label="Relationship" value={family.relationshipToSenior ? getRelationshipLabel(family.relationshipToSenior) : 'N/A'} />
                                    <InfoRow label="Preferred Language" value={family.language || family.preferredLanguage || 'N/A'} />
                                    <InfoRow label="Account Created" value={family.createdAt?.toDate ? family.createdAt.toDate().toLocaleDateString() : 'N/A'} />
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
                                    {(family.addressLine1 || family.fullAddress || family.address) ? (
                                        <>
                                            <InfoRow label="Full Address" value={family.addressLine1 || family.fullAddress || family.address?.fullAddress || 'N/A'} />
                                            <InfoRow label="City" value={family.addressCity || family.address?.city || 'N/A'} />
                                            <InfoRow label="State" value={family.addressState || family.address?.state || 'N/A'} />
                                            <InfoRow label="Country" value={family.addressCountry || family.address?.country || 'N/A'} />
                                            <InfoRow label="PIN Code" value={family.addressPincode || family.address?.pinCode || 'N/A'} />
                                        </>
                                    ) : (
                                        <p className="text-slate-500 italic">No address information available</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabPanel>

                {/* Linked Seniors Tab */}
                <TabPanel value={tabValue} index={1}>
                    {linkedSeniors.length === 0 ? (
                        <EmptyState
                            icon={<PersonAddIcon sx={{ fontSize: 64, color: '#cbd5e1' }} />}
                            message="No seniors linked yet"
                        />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {linkedSeniors.map((senior) => (
                                <Card
                                    key={senior.id}
                                    sx={{
                                        borderRadius: '1.5rem',
                                        border: '1px solid #e2e8f0',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        '&:hover': {
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
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
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <PhoneIcon sx={{ fontSize: 14 }} />
                                            <span>{senior.phone || senior.phoneNumber || 'No phone'}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabPanel>

                {/* Activity Log Tab */}
                <TabPanel value={tabValue} index={2}>
                    {activityLog.length === 0 ? (
                        <EmptyState
                            icon={<CheckCircleIcon sx={{ fontSize: 64, color: '#22c55e' }} />}
                            message="No recent activity"
                        />
                    ) : (
                        <div className="space-y-3">
                            {activityLog.map((activity) => (
                                <Card key={activity.id} sx={{ borderRadius: '1rem', border: '1px solid #e2e8f0' }}>
                                    <CardContent sx={{ p: 3, display: 'flex', gap: 2 }}>
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                                            <HistoryIcon fontSize="small" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-slate-900 mb-1">{activity.action || 'Activity'}</h4>
                                            <p className="text-sm text-slate-600 mb-2">{activity.description || 'No description'}</p>
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <CalendarIcon sx={{ fontSize: 12 }} />
                                                <span>{activity.timestamp?.toDate ? activity.timestamp.toDate().toLocaleString() : 'Recently'}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabPanel>
            </div>
        </div>
    );
}

// Helper Components
function InfoRow({ label, value, capitalize = false }: any) {
    return (
        <div className="flex justify-between items-center border-b border-slate-50 pb-2">
            <span className="text-sm font-medium text-slate-500">{label}</span>
            <span className={`text-sm font-bold text-slate-900 ${capitalize ? 'capitalize' : ''}`}>
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
