import React, { useEffect, useState, useMemo } from 'react';
import {
    Dialog,
    TextField,
    InputAdornment,
    IconButton,
    Chip,
    Button,
    DialogContent,
    Switch,
    FormControlLabel,
    Snackbar,
    Alert
} from '@mui/material';
import ConfirmationDialog from '../common/ConfirmationDialog';
import {
    Search as SearchIcon,
    ArrowBack as ArrowBackIcon,
    Phone as PhoneIcon,
    Close as CloseIcon,
    ArrowForward as ArrowRightIcon,
    SentimentSatisfiedAlt as HappyIcon,
    Diversity1 as FamilyIcon,
    SupervisedUserCircle as UserIcon,
    Visibility as VisibilityIcon,
    OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import { collection, query, where, onSnapshot, getFirestore, doc, updateDoc } from 'firebase/firestore';
import { useFireCMSContext } from "@firecms/core";
import { useNavigate } from "react-router-dom";
import logger from "../../utils/logger";

export function Family() {
    const navigate = useNavigate();
    const context = useFireCMSContext();
    const firestore = getFirestore((context.dataSource as any).firebaseApp);

    // --- DATA STATE (EXACTLY SAME AS BEFORE) ---
    const [families, setFamilies] = useState<any[]>([]);
    const [seniors, setSeniors] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [viewSeniorsDialogVisible, setViewSeniorsDialogVisible] = useState(false);
    const [viewDialogVisible, setViewDialogVisible] = useState(false);
    const [selectedFamily, setSelectedFamily] = useState<any>(null);
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
        const familiesUnsub = onSnapshot(
            query(collection(firestore, 'users'), where('role', '==', 'family')),
            (snapshot) => {
                const familyData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setFamilies(familyData);
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
            familiesUnsub();
            seniorsUnsub();
        };
    }, [firestore]);

    // Memoize the mapping of family IDs to their linked seniors for better performance
    // This prevents recalculating linked seniors on every render
    const familyToSeniorsMap = useMemo(() => {
        const map = new Map<string, any[]>();

        // Build the map: family ID -> array of linked seniors
        families.forEach(family => {
            const linkedSeniors = seniors.filter(senior =>
                senior.linkedFamily &&
                Array.isArray(senior.linkedFamily) &&
                senior.linkedFamily.includes(family.id)
            );
            map.set(family.id, linkedSeniors);
        });

        return map;
    }, [families, seniors]);

    const getLinkedSeniors = (family: any) => {
        // Use the pre-computed map for O(1) lookup instead of O(n) filtering
        return familyToSeniorsMap.get(family.id) || [];
    };

    const handleViewSeniors = (family: any) => {
        setSelectedFamily(family);
        setViewSeniorsDialogVisible(true);
    };

    const handleViewDetails = (family: any) => {
        setSelectedFamily(family);
        setViewDialogVisible(true);
    };

    const handleViewFullProfile = (family: any) => {
        navigate(`/families/${family.id}`);
    };

    const handleToggleStatus = (family: any) => {
        const newStatus = family.status === 'active' ? 'inactive' : 'active';
        const action = newStatus === 'active' ? 'activate' : 'deactivate';
        const color = newStatus === 'active' ? 'success' : 'error';

        setConfirmTitle(`${newStatus === 'active' ? 'Activate' : 'Deactivate'} Family Account`);
        setConfirmContent(`Are you sure you want to ${action} ${family.fullName || family.name}? ${newStatus === 'inactive' ? 'They will not be able to access the application.' : 'They will regain access to the application.'}`);
        setConfirmColor(color);
        setConfirmText(newStatus === 'active' ? 'Activate' : 'Deactivate');
        setConfirmAction(() => async () => {
            try {
                await updateDoc(doc(firestore, 'users', family.id), {
                    status: newStatus,
                    updatedAt: new Date()
                });
                setSnackbarMessage(`Family account ${action}d successfully`);
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

    const filteredFamilies = families.filter(family => {
        const matchesSearch = (family.fullName || family.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (family.phoneNumber || family.phone || '').includes(searchQuery);
        const matchesStatus = statusFilter === 'all' || (family.status || 'active') === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // --- ENHANCED COMPONENT ---

    return (
        <div className="min-h-full w-full bg-slate-50/50 p-6 lg:p-8 font-sans text-slate-800 pb-20">

            {/* 1. HERO HEADER */}
            <div className="relative mb-10 bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 overflow-hidden">
                {/* Decorative Background Blob */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-60 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-6 w-full md:w-auto">
                        <div
                            onClick={() => navigate("/")}
                            className="w-12 h-12 rounded-2xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-all border border-slate-200 group"
                        >
                            <ArrowBackIcon className="text-slate-400 group-hover:text-slate-700" />
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
                                Family Directory
                            </h1>
                            <p className="text-slate-500 font-medium mt-1">
                                Managing <span className="text-emerald-600 font-bold">{filteredFamilies.length}</span> registered guardians
                            </p>
                        </div>
                    </div>

                    {/* Modern Search Pill */}
                    <div className="w-full md:w-96 shadow-lg shadow-slate-100 rounded-full">
                        <TextField
                            fullWidth
                            placeholder="Search families..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            variant="standard"
                            InputProps={{
                                disableUnderline: true,
                                startAdornment: (
                                    <InputAdornment position="start" sx={{ pl: 2 }}>
                                        <SearchIcon sx={{ color: '#94a3b8' }} />
                                    </InputAdornment>
                                ),
                                sx: {
                                    backgroundColor: 'rgba(255,255,255,0.9)',
                                    borderRadius: '9999px',
                                    padding: '12px 16px',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.95rem',
                                    transition: 'all 0.2s',
                                    '&:hover': {
                                        borderColor: '#cbd5e1',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                                    },
                                    '&.Mui-focused': {
                                        borderColor: '#10b981', // Emerald 500
                                        boxShadow: '0 0 0 4px rgba(16, 185, 129, 0.1)'
                                    }
                                }
                            }}
                        />
                    </div>

                    {/* Filters */}
                    <div className="flex gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-700 text-sm rounded-full focus:ring-emerald-500 focus:border-emerald-500 block px-4 py-2.5 outline-none hover:border-emerald-300 transition-colors cursor-pointer"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* 2. GRID LAYOUT */}
            {filteredFamilies.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[50vh] text-center opacity-0 animate-fadeIn" style={{ animation: 'fadeIn 0.5s forwards' }}>
                    <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <SearchIcon sx={{ fontSize: 40, color: '#94a3b8' }} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-400">No families found</h2>
                    <p className="text-slate-400 mt-2">Try searching for a different name or phone number.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
                    {filteredFamilies.map((family) => {
                        // Calculate linked count dynamically
                        const realLinkedSeniors = getLinkedSeniors(family);
                        const linkedCount = realLinkedSeniors.length;
                        return (
                            <div
                                key={family.id}
                                className="group relative bg-white rounded-[2rem] shadow-sm hover:shadow-2xl hover:shadow-emerald-900/5 border border-slate-100 overflow-hidden transition-all duration-300 hover:-translate-y-1"
                            >
                                {/* Card Header Banner */}
                                <div className="h-24 bg-gradient-to-r from-emerald-400 to-teal-500 relative overflow-hidden">
                                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-20 transition-opacity"></div>
                                    <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-white/20 rounded-full blur-xl"></div>
                                </div>

                                {/* Avatar & Content Wrapper */}
                                <div className="px-6 pb-6 relative">

                                    {/* Floating Avatar */}
                                    <div className="absolute -top-10 left-6">
                                        <div className="w-20 h-20 rounded-2xl bg-white p-1 shadow-md">
                                            <div className="w-full h-full rounded-xl bg-slate-50 flex items-center justify-center text-2xl font-bold text-emerald-700 border border-slate-100">
                                                {(family.fullName || family.name || 'F').charAt(0).toUpperCase()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Top Right Actions */}
                                    <div className="flex justify-end pt-3 mb-2 items-center gap-2">
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    size="small"
                                                    checked={family.status !== 'inactive'}
                                                    onChange={() => handleToggleStatus(family)}
                                                    color="success"
                                                />
                                            }
                                            label={
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${family.status === 'inactive'
                                                    ? 'bg-slate-50 text-slate-400 border-slate-200'
                                                    : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                    }`}>
                                                    {family.status === 'inactive' ? 'Inactive' : 'Active'}
                                                </span>
                                            }
                                            labelPlacement="start"
                                            sx={{ mr: 0, '& .MuiTypography-root': { mr: 1 } }}
                                        />
                                    </div>

                                    {/* Info Block */}
                                    <div className="mt-4">
                                        <h3 className="text-xl font-bold text-slate-900 truncate pr-2">
                                            {family.fullName || family.name || 'Unknown Name'}
                                        </h3>

                                        <div className="flex items-center gap-2 mt-2 text-slate-500 text-sm">
                                            <div className="p-1.5 bg-slate-50 rounded-lg">
                                                <PhoneIcon sx={{ fontSize: 14 }} />
                                            </div>
                                            <span className="font-medium tracking-wide">{family.phoneNumber || family.phone || 'No Phone'}</span>
                                        </div>
                                    </div>

                                    {/* Divider */}
                                    <div className="my-5 border-t border-dashed border-slate-100"></div>

                                    {/* Footer: Linked Seniors */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex -space-x-3">
                                                {linkedCount > 0 ? (
                                                    [...Array(Math.min(3, linkedCount))].map((_, i) => (
                                                        <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-indigo-50 flex items-center justify-center text-indigo-400">
                                                            <UserIcon sx={{ fontSize: 16 }} />
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-50 flex items-center justify-center text-slate-300">
                                                        <CloseIcon sx={{ fontSize: 12 }} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-xs">
                                                <p className="text-slate-400 font-medium">Monitoring</p>
                                                <p className="text-slate-700 font-bold">{linkedCount} Senior{linkedCount !== 1 && 's'}</p>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleViewDetails(family)}
                                                className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-all duration-300 shadow-sm"
                                                title="View Details"
                                            >
                                                <VisibilityIcon fontSize="small" />
                                            </button>
                                            <button
                                                onClick={() => handleViewSeniors(family)}
                                                className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-all duration-300 shadow-sm"
                                                title="View Linked Seniors"
                                            >
                                                <ArrowRightIcon fontSize="small" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 3. VIEW SENIORS DIALOG */}
            <Dialog
                open={viewSeniorsDialogVisible}
                onClose={() => setViewSeniorsDialogVisible(false)}
                fullWidth
                maxWidth="sm"
                PaperProps={{
                    sx: { borderRadius: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }
                }}
            >
                {selectedFamily && (
                    <div className="relative overflow-hidden">
                        {/* Modal Header */}
                        <div className="bg-slate-900 p-6 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>

                            <div className="relative z-10 flex justify-between items-start">
                                <div>
                                    <h2 className="text-2xl font-bold">{selectedFamily.fullName || selectedFamily.name}</h2>
                                    <p className="text-slate-400 text-sm mt-1">Monitoring List</p>
                                </div>
                                <IconButton
                                    onClick={() => setViewSeniorsDialogVisible(false)}
                                    sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}
                                >
                                    <CloseIcon />
                                </IconButton>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 bg-white min-h-[300px]">
                            {getLinkedSeniors(selectedFamily).length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                                    <FamilyIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 2 }} />
                                    <p className="text-slate-500 font-medium">No seniors connected yet</p>
                                    <Button sx={{ mt: 2, textTransform: 'none' }} variant="text">
                                        Assign a senior
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Linked Profiles</p>
                                    {getLinkedSeniors(selectedFamily).map((senior) => (
                                        <div key={senior.id} className="group flex items-center p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-md transition-all">
                                            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mr-4 font-bold shadow-sm">
                                                {(senior.fullName || senior.name || 'S').charAt(0)}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                                    {senior.fullName || senior.name}
                                                </h4>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                                        ID: {senior.id.substring(0, 6)}...
                                                    </span>
                                                    {senior.phoneNumber && (
                                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                                            <PhoneIcon sx={{ fontSize: 10 }} /> {senior.phoneNumber}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <Button
                                onClick={() => setViewSeniorsDialogVisible(false)}
                                sx={{
                                    color: '#64748b',
                                    textTransform: 'none',
                                    fontWeight: 'bold',
                                    borderRadius: '12px',
                                    px: 3
                                }}
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                )}
            </Dialog>

            {/* 4. VIEW DETAILS DIALOG */}
            <Dialog
                open={viewDialogVisible}
                onClose={() => setViewDialogVisible(false)}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: { borderRadius: '2rem', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' } }}
            >
                {selectedFamily && (
                    <div className="p-0 flex flex-col flex-1 overflow-hidden">
                        {/* Header */}
                        <div className="bg-slate-900 text-white p-8 relative overflow-hidden shrink-0">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 rounded-full blur-3xl opacity-20 -mr-20 -mt-20"></div>

                            <div className="relative z-10 flex justify-between items-start">
                                <div className="flex items-center gap-6">
                                    <div className="w-24 h-24 rounded-2xl bg-white p-1 shadow-xl">
                                        <div className="w-full h-full rounded-xl bg-emerald-50 flex items-center justify-center text-3xl font-bold text-emerald-600 border border-emerald-100">
                                            {(selectedFamily.fullName || selectedFamily.name || 'F').charAt(0).toUpperCase()}
                                        </div>
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-bold">{selectedFamily.fullName || selectedFamily.name}</h2>
                                        <div className="flex items-center gap-3 mt-2 text-slate-300">
                                            <span className="bg-emerald-500/20 text-emerald-200 px-3 py-1 rounded-full text-sm font-medium border border-emerald-500/30">
                                                Family Member
                                            </span>
                                            <span className="flex items-center gap-1 text-sm">
                                                <PhoneIcon fontSize="small" /> {selectedFamily.phoneNumber || selectedFamily.phone || 'N/A'}
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
                                    <FamilyIcon className="text-emerald-500" /> Profile Details
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                                        <span className="text-sm font-medium text-slate-500">Role</span>
                                        <span className="text-sm font-bold text-slate-900 capitalize">{selectedFamily.role}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                                        <span className="text-sm font-medium text-slate-500">Status</span>
                                        <span className="text-sm font-bold text-emerald-600 capitalize">{selectedFamily.status || 'Active'}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                                        <span className="text-sm font-medium text-slate-500">Joined</span>
                                        <span className="text-sm font-bold text-slate-900">
                                            {selectedFamily.createdAt ? new Date(selectedFamily.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                                        <span className="text-sm font-medium text-slate-500">Linked Seniors</span>
                                        <span className="text-sm font-bold text-blue-600">
                                            {getLinkedSeniors(selectedFamily).length}
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
                                    handleViewFullProfile(selectedFamily);
                                }}
                                variant="outlined"
                                startIcon={<OpenInNewIcon />}
                                sx={{
                                    borderRadius: '12px',
                                    textTransform: 'none',
                                    borderColor: '#10b981',
                                    color: '#10b981',
                                    fontWeight: 'bold',
                                    px: 4
                                }}
                            >
                                View Full Profile
                            </Button>
                            <Button
                                onClick={() => {
                                    setViewDialogVisible(false);
                                    handleViewSeniors(selectedFamily);
                                }}
                                variant="contained"
                                startIcon={<ArrowRightIcon />}
                                sx={{
                                    bgcolor: '#10b981',
                                    '&:hover': { bgcolor: '#059669' },
                                    borderRadius: '12px',
                                    textTransform: 'none',
                                    fontWeight: 'bold',
                                    px: 4
                                }}
                            >
                                View Linked Seniors
                            </Button>
                        </div>
                    </div>
                )}
            </Dialog>
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
                onConfirm={confirmAction}
                onCancel={() => setConfirmOpen(false)}
                confirmColor={confirmColor}
                confirmText={confirmText}
            />
        </div>
    );
}