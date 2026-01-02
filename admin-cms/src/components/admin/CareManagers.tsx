import React, { useEffect, useState } from 'react';
import {
    Dialog,
    TextField,
    InputAdornment,
    IconButton,
    Button,
    Snackbar,
    Alert,
    Chip,
    DialogContent,
    Switch,
    FormControlLabel
} from '@mui/material';
import ConfirmationDialog from '../common/ConfirmationDialog';
import { PhoneInput } from '../common/PhoneInput';
import {
    Search as SearchIcon,
    MedicalServices as MedicalServicesIcon,
    Add as AddIcon,
    Visibility as VisibilityIcon,
    DeleteOutline as DeleteIcon,
    ArrowBack as ArrowBackIcon,
    Elderly as ElderlyIcon,
    Phone as PhoneIcon,
    Badge as BadgeIcon,
    Close as CloseIcon,
    OpenInNew as OpenInNewIcon,
    PersonAdd as PersonAddIcon
} from '@mui/icons-material';
import { collection, query, where, onSnapshot, getFirestore, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useFireCMSContext } from "@firecms/core";
import { useNavigate } from "react-router-dom";
import logger from "../../utils/logger";
import { validatePhoneNumber } from '../../utils/validation';

export function CareManagers() {
    const navigate = useNavigate();
    const context = useFireCMSContext();
    const firestore = getFirestore((context.dataSource as any).firebaseApp);

    // --- DATA STATE (UNCHANGED) ---
    const [careManagers, setCareManagers] = useState<any[]>([]);
    const [seniors, setSeniors] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [addDialogVisible, setAddDialogVisible] = useState(false);
    const [viewSeniorsDialogVisible, setViewSeniorsDialogVisible] = useState(false);
    const [viewDialogVisible, setViewDialogVisible] = useState(false);
    const [selectedCareManager, setSelectedCareManager] = useState<any>(null);
    const [newCM, setNewCM] = useState({ name: '', phone: '' });
    const [loading, setLoading] = useState(false);
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
        const cmUnsub = onSnapshot(
            query(collection(firestore, 'users'), where('role', '==', 'caremanager')),
            (snapshot) => {
                const cmData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setCareManagers(cmData);
            }
        );

        const seniorsUnsub = onSnapshot(
            query(collection(firestore, 'users'), where('role', '==', 'senior')),
            (snapshot) => {
                const seniorsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setSeniors(seniorsData);
            }
        );

        return () => {
            cmUnsub();
            seniorsUnsub();
        };
    }, [firestore]);

    const getAssignedSeniorsCount = (careManagerId: string) => {
        return seniors.filter(senior => senior.careManagerId === careManagerId).length;
    };

    const getAssignedSeniors = (careManagerId: string) => {
        return seniors.filter(senior => senior.careManagerId === careManagerId);
    };

    const handleAddCareManager = async () => {
        if (!newCM.name || !newCM.phone) {
            setSnackbarMessage('Please fill in all fields');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
            return;
        }

        // Validate phone number
        const phoneValidation = validatePhoneNumber(newCM.phone);
        if (!phoneValidation.isValid) {
            setSnackbarMessage(phoneValidation.error || 'Invalid phone number');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
            return;
        }

        setLoading(true);
        try {
            // Use Firestore auto-generated ID instead of phone number for security and data integrity
            const newDocRef = doc(collection(firestore, 'users'));
            await setDoc(newDocRef, {
                name: newCM.name,
                fullName: newCM.name,
                phone: phoneValidation.formatted,
                phoneNumber: phoneValidation.formatted,
                role: 'caremanager',
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date()
            });

            setNewCM({ name: '', phone: '' });
            setAddDialogVisible(false);
            setSnackbarMessage('Care manager added successfully!');
            setSnackbarSeverity('success');
            setSnackbarOpen(true);
        } catch (error) {
            logger.error("Error adding care manager: " + error);
            setSnackbarMessage('Failed to add care manager');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        }
        setLoading(false);
    };

    const handleViewSeniors = (cm: any) => {
        setSelectedCareManager(cm);
        setViewSeniorsDialogVisible(true);
    };

    const handleViewDetails = (cm: any) => {
        setSelectedCareManager(cm);
        setViewDialogVisible(true);
    };

    const handleViewFullProfile = (cm: any) => {
        navigate(`/care-managers/${cm.id}`);
    };

    const handleDeleteCareManager = async (cm: any) => {
        setConfirmTitle('Delete Care Manager');
        setConfirmContent(`Are you sure you want to delete ${cm.name}? This action cannot be undone.`);
        setConfirmColor('error');
        setConfirmText('Delete');
        setConfirmAction(() => async () => {
            try {
                await deleteDoc(doc(firestore, 'users', cm.id));
                setSnackbarMessage('Care manager deleted successfully');
                setSnackbarSeverity('success');
                setSnackbarOpen(true);
                setConfirmOpen(false);
            } catch (error) {
                logger.error("Error deleting care manager: " + error);
                setSnackbarMessage('Failed to delete care manager');
                setSnackbarSeverity('error');
                setSnackbarOpen(true);
            }
        });
        setConfirmOpen(true);
    };

    const handleToggleStatus = (cm: any) => {
        const newStatus = cm.status === 'active' ? 'inactive' : 'active';
        const action = newStatus === 'active' ? 'activate' : 'deactivate';
        const color = newStatus === 'active' ? 'success' : 'error';

        setConfirmTitle(`${newStatus === 'active' ? 'Activate' : 'Deactivate'} Care Manager Account`);
        setConfirmContent(`Are you sure you want to ${action} ${cm.fullName || cm.name}? ${newStatus === 'inactive' ? 'They will not be able to access the application.' : 'They will regain access to the application.'}`);
        setConfirmColor(color);
        setConfirmText(newStatus === 'active' ? 'Activate' : 'Deactivate');
        setConfirmAction(() => async () => {
            try {
                await updateDoc(doc(firestore, 'users', cm.id), {
                    status: newStatus,
                    updatedAt: new Date()
                });
                setSnackbarMessage(`Care manager account ${action}d successfully`);
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

    const filteredCareManagers = careManagers.filter(cm => {
        const matchesSearch = (cm.fullName || cm.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (cm.phone || cm.phoneNumber || '').includes(searchQuery);
        const matchesStatus = statusFilter === 'all' || (cm.status || 'active') === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // --- ENHANCED RENDER ---

    return (
        <div className="min-h-full w-full bg-[#F8FAFC] p-6 lg:p-8 font-sans text-slate-800 pb-20">

            {/* 1. HERO HEADER */}
            <div className="relative mb-10 bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 overflow-hidden">
                {/* Purple decorative blob */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-purple-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-60 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col xl:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-6 w-full md:w-auto">
                        <button
                            onClick={() => navigate("/")}
                            className="w-12 h-12 rounded-2xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-all border border-slate-200 group"
                        >
                            <ArrowBackIcon className="text-slate-400 group-hover:text-slate-700" />
                        </button>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                                Care Manager Roster
                                <span className="bg-purple-100 text-purple-700 text-sm font-bold px-3 py-1 rounded-full">
                                    {filteredCareManagers.length} Active
                                </span>
                            </h1>
                            <p className="text-slate-500 font-medium mt-1">
                                Manage Care Managers and case assignments
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                        {/* Search Pill */}
                        <div className="w-full md:w-80 shadow-sm rounded-full">
                            <TextField
                                fullWidth
                                placeholder="Search care managers..."
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
                                        '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
                                    }
                                }}
                            />
                        </div>

                        {/* Status Filter */}
                        <div className="w-full md:w-auto">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full bg-white border border-slate-200 text-slate-700 text-sm rounded-full focus:ring-purple-500 focus:border-purple-500 block px-4 py-3 outline-none hover:border-purple-300 transition-colors cursor-pointer appearance-none"
                                style={{ backgroundImage: 'none' }}
                            >
                                <option value="all">All Status</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>

                        {/* Add Button */}
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => setAddDialogVisible(true)}
                            sx={{
                                bgcolor: '#8b5cf6',
                                '&:hover': { bgcolor: '#7c3aed' },
                                borderRadius: '9999px',
                                textTransform: 'none',
                                fontWeight: 'bold',
                                px: 4,
                                boxShadow: '0 4px 14px 0 rgba(139, 92, 246, 0.39)'
                            }}
                        >
                            New Manager
                        </Button>
                    </div>
                </div>
            </div>

            {/* 2. GRID LIST */}
            {filteredCareManagers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-96 bg-white rounded-[2rem] border border-dashed border-slate-200">
                    <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mb-4">
                        <MedicalServicesIcon sx={{ fontSize: 40, color: '#d8b4fe' }} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-400">No care managers found</h3>
                    <p className="text-slate-400 mt-2">Add a new Care Manager to get started.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                    {filteredCareManagers.map((cm) => {
                        const assignedCount = getAssignedSeniorsCount(cm.id);
                        return (
                            <div
                                key={cm.id}
                                className="group relative bg-white rounded-[2rem] shadow-sm hover:shadow-xl hover:shadow-purple-900/5 border border-slate-100 transition-all duration-300 overflow-hidden hover:-translate-y-1"
                            >
                                {/* Gradient Header */}
                                <div className="h-24 bg-gradient-to-r from-violet-500 to-purple-600 relative">
                                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-20 transition-opacity"></div>
                                </div>

                                {/* Content */}
                                <div className="px-6 pb-6 relative">
                                    {/* Avatar */}
                                    <div className="absolute -top-10 left-6">
                                        <div className="w-20 h-20 rounded-2xl bg-white p-1 shadow-lg">
                                            <div className="w-full h-full rounded-xl bg-purple-50 flex items-center justify-center text-2xl font-bold text-purple-600 border border-purple-100">
                                                {(cm.fullName || cm.name || 'C').charAt(0).toUpperCase()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status Badge & Toggle */}
                                    <div className="flex justify-end pt-3 mb-2 items-center gap-2">
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    size="small"
                                                    checked={cm.status !== 'inactive'}
                                                    onChange={() => handleToggleStatus(cm)}
                                                    color="success"
                                                />
                                            }
                                            label={
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cm.status === 'inactive'
                                                    ? 'bg-slate-50 text-slate-400 border-slate-200'
                                                    : 'bg-purple-50 text-purple-600 border-purple-100'
                                                    }`}>
                                                    {cm.status === 'inactive' ? 'Inactive' : 'Active'}
                                                </span>
                                            }
                                            labelPlacement="start"
                                            sx={{ mr: 0, '& .MuiTypography-root': { mr: 1 } }}
                                        />
                                    </div>
                                    {/* Info */}
                                    <div className="mt-4 mb-6">
                                        <h3 className="text-xl font-bold text-slate-900 truncate pr-2">
                                            {cm.fullName || cm.name}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1 text-slate-500 text-sm">
                                            <PhoneIcon sx={{ fontSize: 14 }} className="text-purple-400" />
                                            <span className="font-medium">{cm.phone || cm.phoneNumber || 'N/A'}</span>
                                        </div>
                                    </div>

                                    {/* Stats & Actions */}
                                    <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between border border-slate-100">
                                        <div onClick={() => handleViewSeniors(cm)} className="cursor-pointer group/stats">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider group-hover/stats:text-purple-600 transition-colors">Case Load</p>
                                            <p className="text-xl font-extrabold text-slate-800 flex items-center gap-1">
                                                {assignedCount}
                                                <span className="text-xs font-medium text-slate-400">Seniors</span>
                                            </p>
                                        </div>

                                        <div className="flex gap-2">
                                            <IconButton
                                                onClick={() => handleViewDetails(cm)}
                                                className="bg-white border border-slate-200 hover:bg-purple-50 hover:border-purple-200 text-slate-400 hover:text-purple-600"
                                                size="small"
                                                title="View Details"
                                            >
                                                <VisibilityIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                                onClick={() => handleDeleteCareManager(cm)}
                                                className="bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-400 hover:text-red-500"
                                                size="small"
                                                title="Delete"
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* --- ADD MANAGER DIALOG --- */}
            <Dialog
                open={addDialogVisible}
                onClose={() => setAddDialogVisible(false)}
                fullWidth
                maxWidth="xs"
                PaperProps={{ sx: { borderRadius: '2rem' } }}
            >
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                            <PersonAddIcon />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900">Add Care Manager</h2>
                    </div>

                    <div className="space-y-4">
                        <TextField
                            autoFocus
                            label="Full Name"
                            fullWidth
                            variant="outlined"
                            value={newCM.name}
                            onChange={(e) => setNewCM({ ...newCM, name: e.target.value })}
                            InputProps={{ sx: { borderRadius: '1rem' } }}
                        />
                        <PhoneInput
                            value={newCM.phone}
                            onChange={(value) => setNewCM({ ...newCM, phone: value })}
                            label="Phone Number"
                            required
                            fullWidth
                        />
                    </div>

                    <div className="flex justify-end gap-3 mt-8">
                        <Button
                            onClick={() => setAddDialogVisible(false)}
                            sx={{ color: '#64748b', textTransform: 'none', borderRadius: '12px' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddCareManager}
                            variant="contained"
                            disabled={loading}
                            sx={{
                                bgcolor: '#8b5cf6',
                                '&:hover': { bgcolor: '#7c3aed' },
                                borderRadius: '12px',
                                textTransform: 'none',
                                fontWeight: 'bold',
                                px: 4
                            }}
                        >
                            {loading ? 'Adding...' : 'Add Manager'}
                        </Button>
                    </div>
                </div>
            </Dialog>

            {/* --- VIEW DETAILS DIALOG --- */}
            <Dialog
                open={viewDialogVisible}
                onClose={() => setViewDialogVisible(false)}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: { borderRadius: '2rem', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' } }}
            >
                {selectedCareManager && (
                    <div className="p-0 flex flex-col flex-1 overflow-hidden">
                        {/* Header */}
                        <div className="bg-slate-900 text-white p-8 relative overflow-hidden shrink-0">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500 rounded-full blur-3xl opacity-20 -mr-20 -mt-20"></div>

                            <div className="relative z-10 flex justify-between items-start">
                                <div className="flex items-center gap-6">
                                    <div className="w-24 h-24 rounded-2xl bg-white p-1 shadow-xl">
                                        <div className="w-full h-full rounded-xl bg-purple-50 flex items-center justify-center text-3xl font-bold text-purple-600 border border-purple-100">
                                            {(selectedCareManager.fullName || selectedCareManager.name || 'C').charAt(0).toUpperCase()}
                                        </div>
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-bold">{selectedCareManager.fullName || selectedCareManager.name}</h2>
                                        <div className="flex items-center gap-3 mt-2 text-slate-300">
                                            <span className="bg-purple-500/20 text-purple-200 px-3 py-1 rounded-full text-sm font-medium border border-purple-500/30">
                                                Care Manager
                                            </span>
                                            <span className="flex items-center gap-1 text-sm">
                                                <PhoneIcon fontSize="small" /> {selectedCareManager.phoneNumber || selectedCareManager.phone || 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <IconButton onClick={() => setViewDialogVisible(false)} sx={{ color: 'rgba(255,255,255,0.5)', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>
                                    <CloseIcon />
                                </IconButton>
                            </div>
                        </div>

                        <DialogContent className="p-8 bg-slate-50 flex-1">
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                    <MedicalServicesIcon className="text-purple-500" /> Professional Details
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                                        <span className="text-sm font-medium text-slate-500">Role</span>
                                        <span className="text-sm font-bold text-slate-900 capitalize">{selectedCareManager.role}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                                        <span className="text-sm font-medium text-slate-500">Status</span>
                                        <span className="text-sm font-bold text-emerald-600 capitalize">{selectedCareManager.status || 'Active'}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                                        <span className="text-sm font-medium text-slate-500">Joined</span>
                                        <span className="text-sm font-bold text-slate-900">
                                            {selectedCareManager.createdAt ? new Date(selectedCareManager.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                                        <span className="text-sm font-medium text-slate-500">Assigned Seniors</span>
                                        <span className="text-sm font-bold text-blue-600">
                                            {getAssignedSeniorsCount(selectedCareManager.id)}
                                        </span>
                                    </div>
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
                                    handleViewFullProfile(selectedCareManager);
                                }}
                                variant="outlined"
                                startIcon={<OpenInNewIcon />}
                                sx={{
                                    borderRadius: '12px',
                                    textTransform: 'none',
                                    borderColor: '#8b5cf6',
                                    color: '#8b5cf6',
                                    fontWeight: 'bold',
                                    px: 4
                                }}
                            >
                                View Full Profile
                            </Button>
                            <Button
                                onClick={() => {
                                    setViewDialogVisible(false);
                                    handleViewSeniors(selectedCareManager);
                                }}
                                variant="contained"
                                startIcon={<VisibilityIcon />}
                                sx={{
                                    bgcolor: '#8b5cf6',
                                    '&:hover': { bgcolor: '#7c3aed' },
                                    borderRadius: '12px',
                                    textTransform: 'none',
                                    fontWeight: 'bold',
                                    px: 4
                                }}
                            >
                                View Assigned Seniors
                            </Button>
                        </div>
                    </div>
                )}
            </Dialog>

            {/* --- VIEW SENIORS DIALOG --- */}
            <Dialog
                open={viewSeniorsDialogVisible}
                onClose={() => setViewSeniorsDialogVisible(false)}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: { borderRadius: '2rem' } }}
            >
                {selectedCareManager && (
                    <div>
                        <div className="bg-slate-900 p-6 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
                            <div className="relative z-10 flex justify-between items-start">
                                <div>
                                    <h2 className="text-xl font-bold">{selectedCareManager.fullName || selectedCareManager.name}</h2>
                                    <p className="text-slate-400 text-sm mt-1">Assigned Case Load</p>
                                </div>
                                <IconButton onClick={() => setViewSeniorsDialogVisible(false)} sx={{ color: 'rgba(255,255,255,0.5)' }}>
                                    <CloseIcon />
                                </IconButton>
                            </div>
                        </div>

                        <div className="p-6 bg-white min-h-[300px]">
                            {getAssignedSeniors(selectedCareManager.id).length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                                    <ElderlyIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 2 }} />
                                    <p className="text-slate-500 font-medium">No seniors currently assigned</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {getAssignedSeniors(selectedCareManager.id).map((senior) => (
                                        <div key={senior.id} className="flex items-center p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:border-purple-200 transition-colors">
                                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mr-4 font-bold">
                                                {(senior.fullName || senior.name || 'S').charAt(0)}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-bold text-slate-900">{senior.fullName || senior.name}</h4>
                                                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                    <PhoneIcon sx={{ fontSize: 10 }} /> {senior.phoneNumber || senior.phone}
                                                </p>
                                            </div>
                                            <Chip
                                                label="Active"
                                                size="small"
                                                sx={{ bgcolor: '#dbeafe', color: '#1e40af', fontWeight: 'bold', borderRadius: '6px', height: '24px' }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
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