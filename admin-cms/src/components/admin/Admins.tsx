import React, { useEffect, useState } from 'react';
import {
    Dialog,
    TextField,
    InputAdornment,
    Button,
    Snackbar,
    Alert,
    DialogContent,
    Switch,
    FormControlLabel,
    IconButton
} from '@mui/material';
import ConfirmationDialog from '../common/ConfirmationDialog';
import {
    Search as SearchIcon,
    AdminPanelSettings as AdminIcon,
    Add as AddIcon,
    Visibility as VisibilityIcon,
    ArrowBack as ArrowBackIcon,
    Email as EmailIcon,
    Badge as BadgeIcon,
    Close as CloseIcon,
    OpenInNew as OpenInNewIcon,
    PersonAdd as PersonAddIcon,
    DeleteOutline as DeleteIcon
} from '@mui/icons-material';
import { collection, query, where, onSnapshot, getFirestore, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useFireCMSContext } from "@firecms/core";
import { useNavigate } from "react-router-dom";
import logger from "../../utils/logger";

export function Admins() {
    const navigate = useNavigate();
    const context = useFireCMSContext();
    const firestore = getFirestore((context.dataSource as any).firebaseApp);
    const auth = getAuth((context.dataSource as any).firebaseApp);
    const currentUserEmail = auth.currentUser?.email?.toLowerCase();

    const [admins, setAdmins] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [addDialogVisible, setAddDialogVisible] = useState(false);
    const [viewDialogVisible, setViewDialogVisible] = useState(false);
    const [selectedAdmin, setSelectedAdmin] = useState<any>(null);
    const [newAdmin, setNewAdmin] = useState({ name: '', email: '' });
    const [loading, setLoading] = useState(false);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmTitle, setConfirmTitle] = useState('');
    const [confirmContent, setConfirmContent] = useState('');
    const [confirmAction, setConfirmAction] = useState<() => void>(() => { });
    const [confirmColor, setConfirmColor] = useState<'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'>('primary');
    const [confirmText, setConfirmText] = useState('Confirm');

    useEffect(() => {
        const adminsUnsub = onSnapshot(
            query(collection(firestore, 'users'), where('role', '==', 'admin')),
            (snapshot) => {
                const adminData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAdmins(adminData);
            }
        );

        return () => {
            adminsUnsub();
        };
    }, [firestore]);

    const handleAddAdmin = async () => {
        if (!newAdmin.name || !newAdmin.email) {
            setSnackbarMessage('Please fill in all fields');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newAdmin.email)) {
            setSnackbarMessage('Please enter a valid email address');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
            return;
        }

        setLoading(true);
        try {
            const adminId = newAdmin.email.toLowerCase();
            await setDoc(doc(firestore, 'users', adminId), {
                name: newAdmin.name,
                email: newAdmin.email.toLowerCase(),
                role: 'admin',
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date()
            });

            setNewAdmin({ name: '', email: '' });
            setAddDialogVisible(false);
            setSnackbarMessage('Admin added successfully!');
            setSnackbarSeverity('success');
            setSnackbarOpen(true);
        } catch (error) {
            logger.error("Error adding admin: " + error);
            setSnackbarMessage('Failed to add admin.');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        }
        setLoading(false);
    };

    const handleViewDetails = (admin: any) => {
        setSelectedAdmin(admin);
        setViewDialogVisible(true);
    };

    const handleViewFullProfile = (admin: any) => {
        navigate(`/admins/${admin.id}`);
    };

    const handleToggleStatus = (admin: any) => {
        // Prevent deactivating yourself
        if (admin.email?.toLowerCase() === currentUserEmail) {
            setSnackbarMessage('You cannot deactivate your own account');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
            return;
        }

        const currentStatus = admin.status || 'active';
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        const action = newStatus === 'active' ? 'activate' : 'deactivate';
        const color = newStatus === 'active' ? 'success' : 'error';

        setConfirmTitle(`${newStatus === 'active' ? 'Activate' : 'Deactivate'} Admin Account`);
        setConfirmContent(`Are you sure you want to ${action} ${admin.name}? ${newStatus === 'inactive' ? 'They will not be able to access the application.' : 'They will regain access to the application.'}`);
        setConfirmColor(color);
        setConfirmText(newStatus === 'active' ? 'Activate' : 'Deactivate');
        setConfirmAction(() => async () => {
            try {
                await updateDoc(doc(firestore, 'users', admin.id), {
                    status: newStatus,
                    updatedAt: new Date()
                });
                setSnackbarMessage(`Admin account ${action}d successfully`);
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

    const handleDeleteAdmin = (admin: any) => {
        // Prevent deleting yourself
        if (admin.email?.toLowerCase() === currentUserEmail) {
            setSnackbarMessage('You cannot delete your own account');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
            return;
        }

        setConfirmTitle('Delete Admin');
        setConfirmContent(`Are you sure you want to delete ${admin.name}? This action cannot be undone.`);
        setConfirmColor('error');
        setConfirmText('Delete');
        setConfirmAction(() => async () => {
            try {
                await deleteDoc(doc(firestore, 'users', admin.id));
                setSnackbarMessage('Admin deleted successfully');
                setSnackbarSeverity('success');
                setSnackbarOpen(true);
                setConfirmOpen(false);
            } catch (error) {
                logger.error("Error deleting admin: " + error);
                setSnackbarMessage('Failed to delete admin');
                setSnackbarSeverity('error');
                setSnackbarOpen(true);
            }
        });
        setConfirmOpen(true);
    };

    const filteredAdmins = admins.filter(admin => {
        const matchesSearch = (admin.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (admin.email || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || (admin.status || 'active') === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="min-h-full w-full bg-[#F8FAFC] p-6 lg:p-8 font-sans text-slate-800 pb-20">
            <div className="relative mb-10 bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-60 pointer-events-none"></div>

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
                                Admin Management
                                <span className="bg-blue-100 text-blue-700 text-sm font-bold px-3 py-1 rounded-full">
                                    {filteredAdmins.length} Total
                                </span>
                            </h1>
                            <p className="text-slate-500 font-medium mt-1">
                                Manage admin users and access
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                        <div className="w-full md:w-80 shadow-sm rounded-full">
                            <TextField
                                fullWidth
                                placeholder="Search admins..."
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

                        <div className="w-full md:w-auto">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full bg-white border border-slate-200 text-slate-700 text-sm rounded-full focus:ring-blue-500 focus:border-blue-500 block px-4 py-3 outline-none hover:border-blue-300 transition-colors cursor-pointer appearance-none"
                                style={{ backgroundImage: 'none' }}
                            >
                                <option value="all">All Status</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>

                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => setAddDialogVisible(true)}
                            sx={{
                                bgcolor: '#3b82f6',
                                '&:hover': { bgcolor: '#2563eb' },
                                borderRadius: '9999px',
                                textTransform: 'none',
                                fontWeight: 'bold',
                                px: 4,
                                boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)'
                            }}
                        >
                            New Admin
                        </Button>
                    </div>
                </div>
            </div>

            {filteredAdmins.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-96 bg-white rounded-[2rem] border border-dashed border-slate-200">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                        <AdminIcon sx={{ fontSize: 40, color: '#93c5fd' }} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-400">No admins found</h3>
                    <p className="text-slate-400 mt-2">Add a new admin to get started.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                    {filteredAdmins.map((admin) => {
                        return (
                            <div
                                key={admin.id}
                                className="group relative bg-white rounded-[2rem] shadow-sm hover:shadow-xl hover:shadow-blue-900/5 border border-slate-100 transition-all duration-300 overflow-hidden hover:-translate-y-1"
                            >
                                <div className="h-24 bg-gradient-to-r from-blue-500 to-cyan-600 relative">
                                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-20 transition-opacity"></div>
                                </div>

                                <div className="px-6 pb-6 relative">
                                    <div className="absolute -top-10 left-6">
                                        <div className="w-20 h-20 rounded-2xl bg-white p-1 shadow-lg">
                                            <div className="w-full h-full rounded-xl bg-blue-50 flex items-center justify-center text-2xl font-bold text-blue-600 border border-blue-100">
                                                {(admin.name || 'A').charAt(0).toUpperCase()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-3 mb-2 items-center gap-2">
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    size="small"
                                                    checked={admin.status !== 'inactive'}
                                                    onChange={() => handleToggleStatus(admin)}
                                                    color="success"
                                                />
                                            }
                                            label={
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${admin.status === 'inactive'
                                                    ? 'bg-slate-50 text-slate-400 border-slate-200'
                                                    : 'bg-blue-50 text-blue-600 border-blue-100'
                                                    }`}>
                                                    {admin.status === 'inactive' ? 'Inactive' : 'Active'}
                                                </span>
                                            }
                                            labelPlacement="start"
                                            sx={{ mr: 0, '& .MuiTypography-root': { mr: 1 } }}
                                        />
                                    </div>

                                    <div className="mt-4 mb-6">
                                        <h3 className="text-xl font-bold text-slate-900 truncate pr-2">
                                            {admin.name}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1 text-slate-500 text-sm">
                                            <EmailIcon sx={{ fontSize: 14 }} className="text-blue-400" />
                                            <span className="font-medium truncate">{admin.email || 'N/A'}</span>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between border border-slate-100">
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Role</p>
                                            <p className="text-xl font-extrabold text-slate-800 flex items-center gap-1">
                                                Administrator
                                            </p>
                                        </div>

                                        <div className="flex gap-2">
                                            <IconButton
                                                onClick={() => handleViewDetails(admin)}
                                                className="bg-white border border-slate-200 hover:bg-blue-50 hover:border-blue-200 text-slate-400 hover:text-blue-600"
                                                size="small"
                                                title="View Details"
                                            >
                                                <VisibilityIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                                onClick={() => handleDeleteAdmin(admin)}
                                                className="bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-400 hover:text-red-500"
                                                size="small"
                                                title="Delete Admin"
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

            <Dialog
                open={addDialogVisible}
                onClose={() => setAddDialogVisible(false)}
                fullWidth
                maxWidth="xs"
                PaperProps={{ sx: { borderRadius: '2rem' } }}
            >
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <PersonAddIcon />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900">Add Admin</h2>
                    </div>

                    <div className="space-y-4">
                        <TextField
                            autoFocus
                            label="Full Name"
                            fullWidth
                            variant="outlined"
                            value={newAdmin.name}
                            onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                            InputProps={{ sx: { borderRadius: '1rem' } }}
                        />
                        <TextField
                            label="Email Address"
                            fullWidth
                            variant="outlined"
                            type="email"
                            value={newAdmin.email}
                            onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                            placeholder="admin@example.com"
                            InputProps={{ sx: { borderRadius: '1rem' } }}
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
                            onClick={handleAddAdmin}
                            variant="contained"
                            disabled={loading}
                            sx={{
                                bgcolor: '#3b82f6',
                                '&:hover': { bgcolor: '#2563eb' },
                                borderRadius: '12px',
                                textTransform: 'none',
                                fontWeight: 'bold',
                                px: 4
                            }}
                        >
                            {loading ? 'Adding...' : 'Add Admin'}
                        </Button>
                    </div>
                </div>
            </Dialog>

            <Dialog
                open={viewDialogVisible}
                onClose={() => setViewDialogVisible(false)}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: { borderRadius: '2rem', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' } }}
            >
                {selectedAdmin && (
                    <div className="p-0 flex flex-col flex-1 overflow-hidden">
                        <div className="bg-slate-900 text-white p-8 relative overflow-hidden shrink-0">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-20 -mr-20 -mt-20"></div>

                            <div className="relative z-10 flex justify-between items-start">
                                <div className="flex items-center gap-6">
                                    <div className="w-24 h-24 rounded-2xl bg-white p-1 shadow-xl">
                                        <div className="w-full h-full rounded-xl bg-blue-50 flex items-center justify-center text-3xl font-bold text-blue-600 border border-blue-100">
                                            {(selectedAdmin.name || 'A').charAt(0).toUpperCase()}
                                        </div>
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-bold">{selectedAdmin.name}</h2>
                                        <div className="flex items-center gap-3 mt-2 text-slate-300">
                                            <span className="bg-blue-500/20 text-blue-200 px-3 py-1 rounded-full text-sm font-medium border border-blue-500/30">
                                                Administrator
                                            </span>
                                            <span className="flex items-center gap-1 text-sm">
                                                <EmailIcon fontSize="small" /> {selectedAdmin.email || 'N/A'}
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
                                    <AdminIcon className="text-blue-500" /> Account Details
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                                        <span className="text-sm font-medium text-slate-500">Role</span>
                                        <span className="text-sm font-bold text-slate-900 capitalize">{selectedAdmin.role}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                                        <span className="text-sm font-medium text-slate-500">Status</span>
                                        <span className="text-sm font-bold text-emerald-600 capitalize">{selectedAdmin.status || 'Active'}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                                        <span className="text-sm font-medium text-slate-500">Email</span>
                                        <span className="text-sm font-bold text-slate-900">{selectedAdmin.email}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                                        <span className="text-sm font-medium text-slate-500">Created</span>
                                        <span className="text-sm font-bold text-slate-900">
                                            {selectedAdmin.createdAt ? new Date(selectedAdmin.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
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
                                    handleViewFullProfile(selectedAdmin);
                                }}
                                variant="contained"
                                startIcon={<OpenInNewIcon />}
                                sx={{
                                    bgcolor: '#3b82f6',
                                    '&:hover': { bgcolor: '#2563eb' },
                                    borderRadius: '12px',
                                    textTransform: 'none',
                                    fontWeight: 'bold',
                                    px: 4
                                }}
                            >
                                View Full Profile
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
