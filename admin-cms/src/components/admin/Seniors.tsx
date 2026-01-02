import React, { useEffect, useState } from 'react';
import {
    Dialog,
    TextField,
    InputAdornment,
    IconButton,
    Button,
    RadioGroup,
    FormControlLabel,
    Radio,
    Snackbar,
    Alert,
    Chip,
    Avatar,
    DialogContent,
    Switch
} from '@mui/material';
import ConfirmationDialog from '../common/ConfirmationDialog';
import {
    Search as SearchIcon,
    Elderly as ElderlyIcon,
    AssignmentInd as AssignmentIndIcon,
    ArrowBack as ArrowBackIcon,
    ArrowForward as ArrowForwardIcon,
    OpenInNew as OpenInNewIcon,
    Phone as PhoneIcon,
    PersonOff as UnassignedIcon,
    CheckCircle as AssignedIcon,
    Close as CloseIcon,
    Visibility as VisibilityIcon
} from '@mui/icons-material';
import { collection, query, where, onSnapshot, getFirestore, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useFireCMSContext } from "@firecms/core";
import { useNavigate } from "react-router-dom";
import logger from "../../utils/logger";
import { useFilter } from "../../contexts/FilterContext";

export function Seniors() {
    const navigate = useNavigate();
    const context = useFireCMSContext();
    const firestore = getFirestore((context.dataSource as any).firebaseApp);
    const { selectedCareManager: globalCareManagerFilter, selectedCareManagerName, setSelectedCareManager, setSelectedCareManagerName } = useFilter();

    // --- DATA STATE ---
    const [seniors, setSeniors] = useState<any[]>([]);
    const [careManagers, setCareManagers] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [assignmentFilter, setAssignmentFilter] = useState('all');
    const [selectedSenior, setSelectedSenior] = useState<any>(null);
    const [assignedCareManager, setAssignedCareManager] = useState('');
    const [assignDialogVisible, setAssignDialogVisible] = useState(false);
    const [viewDialogVisible, setViewDialogVisible] = useState(false);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

    // Confirmation Dialog State
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmTitle, setConfirmTitle] = useState('');
    const [confirmContent, setConfirmContent] = useState('');
    const [confirmAction, setConfirmAction] = useState<() => void>(() => { });
    const [confirmColor, setConfirmColor] = useState<'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'>('primary');
    const [confirmText, setConfirmText] = useState('Confirm');

    useEffect(() => {
        // Apply global care manager filter if set
        // Apply global care manager filter if set
        let seniorsQuery;
        if (globalCareManagerFilter === 'unassigned') {
            // Fetch ALL seniors for client-side filtering of missing field
            seniorsQuery = query(collection(firestore, 'users'), where('role', '==', 'senior'));
        } else if (globalCareManagerFilter !== 'all') {
            seniorsQuery = query(
                collection(firestore, 'users'),
                where('role', '==', 'senior'),
                where('careManagerId', '==', globalCareManagerFilter)
            );
        } else {
            seniorsQuery = query(collection(firestore, 'users'), where('role', '==', 'senior'));
        }

        const seniorsUnsub = onSnapshot(
            seniorsQuery,
            (snapshot) => {
                let seniorsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Client-side filter for unassigned (missing careManagerId)
                if (globalCareManagerFilter === 'unassigned') {
                    seniorsData = seniorsData.filter((s: any) => !s.careManagerId);
                }

                setSeniors(seniorsData);
            }
        );

        const cmUnsub = onSnapshot(
            query(collection(firestore, 'users'), where('role', '==', 'caremanager')),
            (snapshot) => {
                const cmData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setCareManagers(cmData);
            }
        );

        return () => {
            seniorsUnsub();
            cmUnsub();
        };
    }, [firestore, globalCareManagerFilter]);

    const getCareManagerName = (careManagerId: string) => {
        const cm = careManagers.find(cm => cm.id === careManagerId);
        return cm ? cm.fullName || cm.name : null;
    };

    const handleAssignCareManager = (senior: any) => {
        setSelectedSenior(senior);
        setAssignedCareManager(senior.careManagerId || '');
        setAssignDialogVisible(true);
    };

    const handleViewDetails = (senior: any) => {
        setSelectedSenior(senior);
        setViewDialogVisible(true);
    };

    const handleViewFullProfile = (senior: any) => {
        navigate(`/seniors/${senior.id}`);
    };

    const confirmAssignment = async () => {
        if (!assignedCareManager || !selectedSenior) return;

        try {
            const newCareManagerId = assignedCareManager;

            // Update Senior with new care manager
            await updateDoc(doc(firestore, 'users', selectedSenior.id), {
                careManagerId: newCareManagerId,
                updatedAt: new Date()
            });

            // Note: We don't update assignedSeniorIds array on care manager documents
            // The mobile app uses query-based approach (where careManagerId == X)


            setSnackbarMessage(`Care manager assigned to ${selectedSenior.fullName || selectedSenior.name} successfully!`);
            setSnackbarSeverity('success');
            setSnackbarOpen(true);
            setAssignDialogVisible(false);
        } catch (error) {
            logger.error("Error assigning care manager: " + error);
            setSnackbarMessage('Failed to assign care manager');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        }
    };

    const handleToggleStatus = (senior: any) => {
        const newStatus = senior.status === 'active' ? 'inactive' : 'active';
        const action = newStatus === 'active' ? 'activate' : 'deactivate';
        const color = newStatus === 'active' ? 'success' : 'error';

        setConfirmTitle(`${newStatus === 'active' ? 'Activate' : 'Deactivate'} Senior Account`);
        setConfirmContent(`Are you sure you want to ${action} ${senior.fullName || senior.name}? ${newStatus === 'inactive' ? 'They will not be able to access the application.' : 'They will regain access to the application.'}`);
        setConfirmColor(color);
        setConfirmText(newStatus === 'active' ? 'Activate' : 'Deactivate');
        setConfirmAction(() => async () => {
            try {
                await updateDoc(doc(firestore, 'users', senior.id), {
                    status: newStatus,
                    updatedAt: new Date()
                });
                setSnackbarMessage(`Senior account ${action}d successfully`);
                setSnackbarSeverity('success');
                setSnackbarOpen(true);
                setConfirmOpen(false);
            } catch (error) {
                logger.error("Error updating status: " + error);
                setSnackbarMessage('Failed to update status');
                setSnackbarSeverity('error');
                setSnackbarOpen(true);
            }
        });
        setConfirmOpen(true);
    };

    const filteredSeniors = seniors.filter(senior => {
        const matchesSearch = (senior.fullName || senior.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (senior.phoneNumber || senior.phone || '').includes(searchQuery);
        const matchesStatus = statusFilter === 'all' || (senior.status || 'active') === statusFilter;
        const matchesAssignment = assignmentFilter === 'all' ||
            (assignmentFilter === 'assigned' && senior.careManagerId) ||
            (assignmentFilter === 'unassigned' && !senior.careManagerId);

        return matchesSearch && matchesStatus && matchesAssignment;
    });

    return (
        <div className="min-h-full bg-[#F8FAFC] p-6 lg:p-8 font-sans text-slate-800 pb-20">

            {/* HERO HEADER */}
            <div className="relative mb-10 bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-60 pointer-events-none"></div>

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
                                Senior Members
                                <span className="bg-blue-100 text-blue-700 text-sm font-bold px-3 py-1 rounded-full">
                                    {filteredSeniors.length} Total
                                </span>
                                {globalCareManagerFilter !== 'all' && (
                                    <Chip
                                        label={`Filtered: ${selectedCareManagerName}`}
                                        onDelete={() => {
                                            setSelectedCareManager('all');
                                            setSelectedCareManagerName('All Care Managers');
                                        }}
                                        size="small"
                                        sx={{
                                            bgcolor: '#dbeafe',
                                            color: '#1e40af',
                                            fontWeight: 'bold',
                                            '& .MuiChip-deleteIcon': {
                                                color: '#1e40af'
                                            }
                                        }}
                                    />
                                )}
                            </h1>
                            <p className="text-slate-500 font-medium mt-1">
                                Manage member profiles and care assignments
                            </p>
                        </div>
                    </div>

                    <div className="w-full md:w-96 shadow-sm rounded-full">
                        <TextField
                            fullWidth
                            placeholder="Search seniors..."
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
                                    borderRadius: '9999px',
                                    backgroundColor: 'white',
                                    '& fieldset': { borderColor: '#E2E8F0' },
                                    '&:hover fieldset': { borderColor: '#CBD5E1' },
                                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                                }
                            }}
                        />
                    </div>

                    {/* Filters */}
                    <div className="flex gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-700 text-sm rounded-full focus:ring-blue-500 focus:border-blue-500 block px-4 py-2.5 outline-none hover:border-blue-300 transition-colors cursor-pointer"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>

                        <select
                            value={assignmentFilter}
                            onChange={(e) => setAssignmentFilter(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-700 text-sm rounded-full focus:ring-blue-500 focus:border-blue-500 block px-4 py-2.5 outline-none hover:border-blue-300 transition-colors cursor-pointer"
                        >
                            <option value="all">All Assignments</option>
                            <option value="assigned">Assigned</option>
                            <option value="unassigned">Unassigned</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* GRID LIST */}
            {filteredSeniors.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-96 bg-white rounded-[2rem] border border-dashed border-slate-200">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                        <ElderlyIcon sx={{ fontSize: 40, color: '#93c5fd' }} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-400">No seniors found</h3>
                    <p className="text-slate-400 mt-2">Try adjusting your search criteria.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                    {filteredSeniors.map((senior) => {
                        const cmName = getCareManagerName(senior.careManagerId);

                        return (
                            <div
                                key={senior.id}
                                // Added generic click handler if you ever want the whole card to navigate
                                // onClick={() => navigate(`/seniors/${senior.id}`)} 
                                className="group relative bg-white rounded-[2rem] shadow-sm hover:shadow-xl hover:shadow-blue-900/5 border border-slate-100 transition-all duration-300 overflow-hidden hover:-translate-y-1 cursor-default"
                            >
                                {/* Gradient Header */}
                                <div className="h-24 bg-gradient-to-r from-blue-400 to-cyan-500 relative">
                                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-20 transition-opacity"></div>
                                </div>

                                {/* Content */}
                                <div className="px-6 pb-6 relative">
                                    {/* Avatar */}
                                    <div className="absolute -top-10 left-6">
                                        <div className="w-20 h-20 rounded-2xl bg-white p-1 shadow-lg">
                                            <div className="w-full h-full rounded-xl bg-blue-50 flex items-center justify-center text-2xl font-bold text-blue-600 border border-blue-100">
                                                {(senior.fullName || senior.name || 'S').charAt(0).toUpperCase()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status Badge & Toggle */}
                                    <div className="flex justify-end pt-3 mb-2 items-center gap-2">
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    size="small"
                                                    checked={senior.status !== 'inactive'}
                                                    onChange={() => handleToggleStatus(senior)}
                                                    color="success"
                                                />
                                            }
                                            label={
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${senior.status === 'inactive'
                                                    ? 'bg-slate-50 text-slate-400 border-slate-200'
                                                    : 'bg-blue-50 text-blue-600 border-blue-100'
                                                    }`}>
                                                    {senior.status === 'inactive' ? 'Inactive' : 'Active'}
                                                </span>
                                            }
                                            labelPlacement="start"
                                            sx={{ mr: 0, '& .MuiTypography-root': { mr: 1 } }}
                                        />
                                    </div>

                                    {/* Info */}
                                    <div className="mt-4 mb-6">
                                        <h3 className="text-xl font-bold text-slate-900 truncate pr-2">
                                            {senior.fullName || senior.name}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1 text-slate-500 text-sm">
                                            <PhoneIcon sx={{ fontSize: 14 }} className="text-blue-400" />
                                            <span className="font-medium">{senior.phoneNumber || senior.phone || 'N/A'}</span>
                                        </div>
                                    </div>

                                    {/* Care Manager Assignment Section */}
                                    <div className="pt-4 border-t border-dashed border-slate-200">
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assigned Care Manager</p>
                                        </div>

                                        {cmName ? (
                                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 group-hover:border-blue-100 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">
                                                        {cmName.charAt(0)}
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-700">{cmName}</span>
                                                </div>
                                                <div className="flex gap-1">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleViewDetails(senior);
                                                        }}
                                                        className="text-slate-400 hover:text-blue-600"
                                                        title="View Details"
                                                    >
                                                        <VisibilityIcon fontSize="small" />
                                                    </IconButton>
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleAssignCareManager(senior);
                                                        }}
                                                        className="text-slate-400 hover:text-blue-600"
                                                        title="Assign Care Manager"
                                                    >
                                                        <AssignmentIndIcon fontSize="small" />
                                                    </IconButton>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2">
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleAssignCareManager(senior);
                                                    }}
                                                    className="cursor-pointer flex-1 flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3 text-amber-700">
                                                        <UnassignedIcon fontSize="small" />
                                                        <span className="text-sm font-bold">Unassigned</span>
                                                    </div>
                                                    <span className="text-xs font-bold text-amber-600 bg-white/50 px-2 py-1 rounded-md">
                                                        Assign
                                                    </span>
                                                </div>
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleViewDetails(senior);
                                                    }}
                                                    className="cursor-pointer w-12 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-sm transition-all text-slate-400 hover:text-blue-600"
                                                >
                                                    <VisibilityIcon fontSize="small" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* --- VIEW DETAILS DIALOG --- */}
            <Dialog
                open={viewDialogVisible}
                onClose={() => setViewDialogVisible(false)}
                fullWidth
                maxWidth="md"
                PaperProps={{
                    sx: {
                        borderRadius: '2rem',
                        maxHeight: '90vh',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column'
                    }
                }}
            >
                {selectedSenior && (
                    <div className="p-0 flex flex-col flex-1 overflow-hidden">
                        {/* Header */}
                        <div className="bg-slate-900 text-white p-8 relative overflow-hidden shrink-0">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-20 -mr-20 -mt-20"></div>

                            <div className="relative z-10 flex justify-between items-start">
                                <div className="flex items-center gap-6">
                                    <div className="w-24 h-24 rounded-2xl bg-white p-1 shadow-xl">
                                        <div className="w-full h-full rounded-xl bg-blue-50 flex items-center justify-center text-3xl font-bold text-blue-600 border border-blue-100">
                                            {(selectedSenior.fullName || selectedSenior.name || 'S').charAt(0).toUpperCase()}
                                        </div>
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-bold">{selectedSenior.fullName || selectedSenior.name}</h2>
                                        <div className="flex items-center gap-3 mt-2 text-slate-300">
                                            <span className="bg-blue-500/20 text-blue-200 px-3 py-1 rounded-full text-sm font-medium border border-blue-500/30">
                                                Senior Member
                                            </span>
                                            <span className="flex items-center gap-1 text-sm">
                                                <PhoneIcon fontSize="small" /> {selectedSenior.phoneNumber || selectedSenior.phone || 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <IconButton onClick={() => setViewDialogVisible(false)} sx={{ color: 'rgba(255,255,255,0.5)', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>
                                    <CloseIcon />
                                </IconButton>
                            </div>
                        </div>

                        <DialogContent className="p-8 bg-slate-50 flex-1" sx={{ overflowY: 'auto' }}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Personal Information */}
                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                        <ElderlyIcon className="text-blue-500" /> Personal Information
                                    </h3>
                                    <div className="space-y-4">
                                        <InfoRow label="Age" value={selectedSenior.age} />
                                        <InfoRow label="Gender" value={selectedSenior.gender} capitalize />
                                        <InfoRow label="Language" value={selectedSenior.preferredLanguage} capitalize />
                                        <InfoRow label="Linking Code" value={selectedSenior.linkingCode} isCode />
                                        <InfoRow label="Joined" value={selectedSenior.createdAt ? new Date(selectedSenior.createdAt).toLocaleDateString() : 'N/A'} />
                                    </div>
                                </div>

                                {/* Status & Preferences */}
                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                        <AssignmentIndIcon className="text-purple-500" /> Status & Care
                                    </h3>
                                    <div className="space-y-4">
                                        <InfoRow label="Employment" value={selectedSenior.employmentStatus} capitalize />
                                        <InfoRow label="Living Status" value={selectedSenior.livingStatus} capitalize />
                                        <InfoRow
                                            label="Care Manager"
                                            value={getCareManagerName(selectedSenior.careManagerId) || 'Unassigned'}
                                            highlight={!!selectedSenior.careManagerId}
                                        />
                                        <InfoRow label="Status" value={selectedSenior.status || 'Active'} status />
                                    </div>
                                </div>

                                {/* Address Details */}
                                <div className="md:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                        <SearchIcon className="text-green-500" /> Location Details
                                    </h3>
                                    {selectedSenior.address ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-4">
                                                <InfoRow label="Full Address" value={selectedSenior.address.fullAddress} />
                                                <InfoRow label="City" value={selectedSenior.address.city} />
                                            </div>
                                            <div className="space-y-4">
                                                <InfoRow label="State" value={selectedSenior.address.state} />
                                                <InfoRow label="Country" value={selectedSenior.address.country} />
                                                <InfoRow label="Pincode" value={selectedSenior.address.pinCode} />
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-slate-400 italic">No address information available</p>
                                    )}
                                </div>
                            </div>
                        </DialogContent>

                        <div className="p-6 bg-white border-t border-slate-100 flex justify-end gap-3">
                            <Button
                                onClick={() => setViewDialogVisible(false)}
                                variant="outlined"
                                sx={{ borderRadius: '12px', textTransform: 'none', borderColor: '#e2e8f0', color: '#64748b' }}
                            >
                                Close
                            </Button>
                            <Button
                                onClick={() => {
                                    setViewDialogVisible(false);
                                    handleViewFullProfile(selectedSenior);
                                }}
                                variant="outlined"
                                startIcon={<OpenInNewIcon />}
                                sx={{
                                    borderRadius: '12px',
                                    textTransform: 'none',
                                    borderColor: '#e2e8f0',
                                    color: '#64748b',
                                    fontWeight: 'bold',
                                    px: 4
                                }}
                            >
                                View Full Profile
                            </Button>
                            <Button
                                onClick={() => {
                                    setViewDialogVisible(false);
                                    handleAssignCareManager(selectedSenior);
                                }}
                                variant="contained"
                                startIcon={<AssignmentIndIcon />}
                                sx={{
                                    bgcolor: '#3b82f6',
                                    '&:hover': { bgcolor: '#2563eb' },
                                    borderRadius: '12px',
                                    textTransform: 'none',
                                    fontWeight: 'bold',
                                    px: 4
                                }}
                            >
                                Manage Assignment
                            </Button>
                        </div>
                    </div>
                )}
            </Dialog>

            {/* --- ASSIGN DIALOG --- */}
            <Dialog
                open={assignDialogVisible}
                onClose={() => setAssignDialogVisible(false)}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: { borderRadius: '2rem' } }}
            >
                {selectedSenior && (
                    <div className="p-2">
                        <div className="bg-slate-900 text-white p-6 rounded-t-[2rem] -m-2 mb-2 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
                            <div className="relative z-10 flex justify-between items-start">
                                <div>
                                    <h2 className="text-xl font-bold">Assign Care Manager</h2>
                                    <p className="text-slate-400 text-sm mt-1">
                                        For <span className="text-white font-bold">{selectedSenior.fullName || selectedSenior.name}</span>
                                    </p>
                                </div>
                                <IconButton onClick={() => setAssignDialogVisible(false)} sx={{ color: 'rgba(255,255,255,0.5)' }}>
                                    <CloseIcon />
                                </IconButton>
                            </div>
                        </div>

                        <DialogContent className="p-4 mt-4">
                            <RadioGroup
                                value={assignedCareManager}
                                onChange={(e) => setAssignedCareManager(e.target.value)}
                                className="gap-3"
                            >
                                {careManagers.map((cm) => (
                                    <div
                                        key={cm.id}
                                        className={`relative flex items-center p-3 rounded-2xl border transition-all cursor-pointer hover:shadow-md ${assignedCareManager === cm.id
                                            ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500'
                                            : 'bg-white border-slate-200 hover:border-blue-200'
                                            }`}
                                        onClick={() => setAssignedCareManager(cm.id)}
                                    >
                                        <Radio
                                            value={cm.id}
                                            sx={{
                                                color: '#cbd5e1',
                                                '&.Mui-checked': { color: '#3b82f6' }
                                            }}
                                        />
                                        <div className="flex items-center gap-3 ml-2 flex-1">
                                            <Avatar sx={{ bgcolor: assignedCareManager === cm.id ? '#3b82f6' : '#e2e8f0', width: 40, height: 40 }}>
                                                {(cm.fullName || cm.name || 'C').charAt(0)}
                                            </Avatar>
                                            <div>
                                                <p className={`font-bold text-sm ${assignedCareManager === cm.id ? 'text-blue-900' : 'text-slate-700'}`}>
                                                    {cm.fullName || cm.name}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {cm.phone || cm.phoneNumber}
                                                </p>
                                            </div>
                                        </div>
                                        {assignedCareManager === cm.id && (
                                            <div className="bg-blue-100 text-blue-600 p-1 rounded-full">
                                                <AssignedIcon fontSize="small" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </RadioGroup>
                        </DialogContent>

                        <div className="p-4 flex justify-end gap-3 border-t border-slate-100 mt-2">
                            <Button
                                onClick={() => setAssignDialogVisible(false)}
                                sx={{ color: '#64748b', textTransform: 'none', borderRadius: '12px' }}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={confirmAssignment}
                                variant="contained"
                                sx={{
                                    bgcolor: '#3b82f6',
                                    '&:hover': { bgcolor: '#2563eb' },
                                    borderRadius: '12px',
                                    textTransform: 'none',
                                    fontWeight: 'bold',
                                    px: 4
                                }}
                            >
                                Confirm Assignment
                            </Button>
                        </div>
                    </div>
                )}
            </Dialog>

            <Snackbar
                open={snackbarOpen}
                autoHideDuration={3000}
                onClose={() => setSnackbarOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%', borderRadius: '12px' }}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
            {/* Confirmation Dialog */}
            <ConfirmationDialog
                open={confirmOpen}
                title={confirmTitle}
                content={confirmContent}
                onConfirm={confirmAction}
                onCancel={() => setConfirmOpen(false)}
                confirmColor={confirmColor}
                confirmText={confirmText}
            />
        </div>
    );
}

// Helper Component for Info Rows
const InfoRow = ({ label, value, capitalize, isCode, highlight, status }: any) => (
    <div className="flex justify-between items-center border-b border-slate-50 pb-2 last:border-0">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <span className={`text-sm font-bold ${highlight ? 'text-blue-600' :
            status ? (value === 'Active' ? 'text-emerald-600' : 'text-slate-600') :
                'text-slate-900'
            } ${capitalize ? 'capitalize' : ''}`}>
            {isCode ? (
                <span className="font-mono bg-slate-100 px-2 py-1 rounded text-slate-600 tracking-widest">{value || 'N/A'}</span>
            ) : (
                value || 'N/A'
            )}
        </span>
    </div>
);