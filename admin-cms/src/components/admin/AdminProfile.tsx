import React, { useEffect, useState } from 'react';
import {
    Button,
    Chip,
    Card,
    CardContent,
    Avatar,
    Box,
    TextField,
    Snackbar,
    Alert
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    Email as EmailIcon,
    AdminPanelSettings as AdminIcon,
    Edit as EditIcon,
    Save as SaveIcon,
    Cancel as CancelIcon,
    Person as PersonIcon,
    CalendarMonth as CalendarIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, getFirestore, updateDoc } from 'firebase/firestore';
import { useFireCMSContext } from "@firecms/core";
import logger from "../../utils/logger";

export function AdminProfile() {
    const { adminId } = useParams<{ adminId: string }>();
    const navigate = useNavigate();
    const context = useFireCMSContext();
    const firestore = getFirestore((context.dataSource as any).firebaseApp);

    const [admin, setAdmin] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [editedName, setEditedName] = useState('');
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

    useEffect(() => {
        if (!adminId) return;

        const loadAdminData = async () => {
            try {
                const adminDoc = await getDoc(doc(firestore, 'users', adminId));
                if (adminDoc.exists()) {
                    const adminData: any = { id: adminDoc.id, ...adminDoc.data() };
                    setAdmin(adminData);
                    setEditedName(adminData.name || '');
                }
                setLoading(false);
            } catch (error) {
                logger.error("Error loading admin data: " + error);
                setLoading(false);
            }
        };

        loadAdminData();
    }, [adminId, firestore]);

    const handleSaveChanges = async () => {
        if (!editedName.trim()) {
            setSnackbarMessage('Name cannot be empty');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
            return;
        }

        try {
            await updateDoc(doc(firestore, 'users', adminId!), {
                name: editedName,
                updatedAt: new Date()
            });

            setAdmin({ ...admin, name: editedName });
            setEditMode(false);
            setSnackbarMessage('Profile updated successfully');
            setSnackbarSeverity('success');
            setSnackbarOpen(true);
        } catch (error) {
            logger.error("Error updating admin: " + error);
            setSnackbarMessage('Failed to update profile');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        }
    };

    const handleCancelEdit = () => {
        setEditedName(admin?.name || '');
        setEditMode(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#F8FAFC]">
                <div className="text-lg text-slate-600">Loading...</div>
            </div>
        );
    }

    if (!admin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8FAFC]">
                <div className="text-lg text-slate-600 mb-4">Admin not found</div>
                <Button
                    variant="contained"
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate('/admins')}
                    sx={{ bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }}
                >
                    Back to Admins
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-full w-full bg-[#F8FAFC] p-6 lg:p-8 font-sans text-slate-800">
            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={() => navigate('/admins')}
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-4"
                >
                    <ArrowBackIcon /> Back to Admins
                </button>
            </div>

            {/* Profile Card */}
            <div className="max-w-4xl mx-auto">
                <Card sx={{ borderRadius: '2rem', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)' }}>
                    {/* Header Section */}
                    <div className="bg-gradient-to-r from-blue-500 to-cyan-600 p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl opacity-10 -mr-20 -mt-20"></div>

                        <div className="relative z-10 flex items-center gap-6">
                            <Avatar
                                sx={{
                                    width: 100,
                                    height: 100,
                                    bgcolor: 'white',
                                    color: '#3b82f6',
                                    fontSize: '2.5rem',
                                    fontWeight: 'bold',
                                    border: '4px solid rgba(255, 255, 255, 0.3)'
                                }}
                            >
                                {admin.name?.charAt(0).toUpperCase()}
                            </Avatar>
                            <div className="flex-1">
                                <h1 className="text-3xl font-bold mb-2">{admin.name}</h1>
                                <div className="flex flex-wrap gap-3 items-center">
                                    <Chip
                                        icon={<AdminIcon />}
                                        label="Administrator"
                                        sx={{
                                            bgcolor: 'rgba(255, 255, 255, 0.2)',
                                            color: 'white',
                                            fontWeight: 'bold',
                                            border: '1px solid rgba(255, 255, 255, 0.3)'
                                        }}
                                    />
                                    <Chip
                                        label={admin.status === 'active' ? 'Active' : 'Inactive'}
                                        sx={{
                                            bgcolor: admin.status === 'active' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                            color: 'white',
                                            fontWeight: 'bold',
                                            border: `1px solid ${admin.status === 'active' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                                        }}
                                    />
                                </div>
                            </div>
                            {!editMode && (
                                <Button
                                    variant="contained"
                                    startIcon={<EditIcon />}
                                    onClick={() => setEditMode(true)}
                                    sx={{
                                        bgcolor: 'rgba(255, 255, 255, 0.2)',
                                        color: 'white',
                                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.3)' },
                                        backdropFilter: 'blur(10px)',
                                        border: '1px solid rgba(255, 255, 255, 0.3)',
                                        borderRadius: '12px',
                                        textTransform: 'none',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    Edit Profile
                                </Button>
                            )}
                        </div>
                    </div>

                    <CardContent sx={{ p: 4 }}>
                        {/* Account Information */}
                        <Box sx={{ mb: 4 }}>
                            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <PersonIcon className="text-blue-500" />
                                Account Information
                            </h2>

                            <div className="space-y-4">
                                {/* Name Field */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium text-slate-500">Full Name</span>
                                    </div>
                                    {editMode ? (
                                        <TextField
                                            fullWidth
                                            value={editedName}
                                            onChange={(e) => setEditedName(e.target.value)}
                                            variant="outlined"
                                            size="small"
                                            sx={{ bgcolor: 'white', borderRadius: '8px' }}
                                        />
                                    ) : (
                                        <p className="text-lg font-bold text-slate-900">{admin.name}</p>
                                    )}
                                </div>

                                {/* Email Field (Read-only) */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <EmailIcon className="text-blue-500 text-sm" />
                                        <span className="text-sm font-medium text-slate-500">Email Address</span>
                                    </div>
                                    <p className="text-lg font-bold text-slate-900">{admin.email}</p>
                                </div>

                                {/* Role Field */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <span className="text-sm font-medium text-slate-500 block mb-2">Role</span>
                                    <p className="text-lg font-bold text-slate-900 capitalize">{admin.role}</p>
                                </div>

                                {/* Status Field */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <span className="text-sm font-medium text-slate-500 block mb-2">Account Status</span>
                                    <Chip
                                        label={admin.status === 'active' ? 'Active' : 'Inactive'}
                                        color={admin.status === 'active' ? 'success' : 'error'}
                                        sx={{ fontWeight: 'bold' }}
                                    />
                                </div>

                                {/* Created Date */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CalendarIcon className="text-blue-500 text-sm" />
                                        <span className="text-sm font-medium text-slate-500">Account Created</span>
                                    </div>
                                    <p className="text-lg font-bold text-slate-900">
                                        {admin.createdAt
                                            ? new Date(admin.createdAt.seconds * 1000).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })
                                            : 'N/A'}
                                    </p>
                                </div>

                                {/* Last Updated */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <span className="text-sm font-medium text-slate-500 block mb-2">Last Updated</span>
                                    <p className="text-lg font-bold text-slate-900">
                                        {admin.updatedAt
                                            ? new Date(admin.updatedAt.seconds * 1000).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })
                                            : 'N/A'}
                                    </p>
                                </div>
                            </div>

                            {/* Edit Mode Actions */}
                            {editMode && (
                                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 4 }}>
                                    <Button
                                        variant="outlined"
                                        startIcon={<CancelIcon />}
                                        onClick={handleCancelEdit}
                                        sx={{
                                            borderColor: '#e2e8f0',
                                            color: '#64748b',
                                            '&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc' },
                                            borderRadius: '12px',
                                            textTransform: 'none'
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="contained"
                                        startIcon={<SaveIcon />}
                                        onClick={handleSaveChanges}
                                        sx={{
                                            bgcolor: '#3b82f6',
                                            '&:hover': { bgcolor: '#2563eb' },
                                            borderRadius: '12px',
                                            textTransform: 'none',
                                            fontWeight: 'bold',
                                            px: 4
                                        }}
                                    >
                                        Save Changes
                                    </Button>
                                </Box>
                            )}
                        </Box>
                    </CardContent>
                </Card>
            </div>

            <Snackbar
                open={snackbarOpen}
                autoHideDuration={3000}
                onClose={() => setSnackbarOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbarOpen(false)}
                    severity={snackbarSeverity}
                    sx={{ width: '100%', borderRadius: '12px' }}
                >
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </div>
    );
}
