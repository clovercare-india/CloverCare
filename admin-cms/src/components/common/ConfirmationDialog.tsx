import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Button,
    Typography,
    Box
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';

interface ConfirmationDialogProps {
    open: boolean;
    title: string;
    content: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmColor?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
    confirmText?: string;
    cancelText?: string;
    icon?: React.ReactNode;
}

export default function ConfirmationDialog({
    open,
    title,
    content,
    onConfirm,
    onCancel,
    confirmColor = 'primary',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    icon
}: ConfirmationDialogProps) {
    return (
        <Dialog
            open={open}
            onClose={onCancel}
            PaperProps={{
                sx: {
                    borderRadius: '24px',
                    padding: '16px',
                    maxWidth: '400px',
                    width: '100%'
                }
            }}
        >
            <DialogTitle sx={{ textAlign: 'center', pt: 2 }}>
                <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2
                }}>
                    {icon || (
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center ${confirmColor === 'error' ? 'bg-red-50 text-red-500' :
                                confirmColor === 'warning' ? 'bg-amber-50 text-amber-500' :
                                    'bg-blue-50 text-blue-500'
                            }`}>
                            <WarningIcon sx={{ fontSize: 32 }} />
                        </div>
                    )}
                    <Typography variant="h6" component="span" sx={{ fontWeight: 'bold' }}>
                        {title}
                    </Typography>
                </Box>
            </DialogTitle>
            <DialogContent>
                <DialogContentText sx={{ textAlign: 'center', color: 'text.secondary' }}>
                    {content}
                </DialogContentText>
            </DialogContent>
            <DialogActions sx={{ justifyContent: 'center', gap: 2, pb: 2 }}>
                <Button
                    onClick={onCancel}
                    variant="outlined"
                    sx={{
                        borderRadius: '12px',
                        textTransform: 'none',
                        fontWeight: 600,
                        px: 3,
                        borderColor: '#e2e8f0',
                        color: '#64748b',
                        '&:hover': {
                            borderColor: '#cbd5e1',
                            bgcolor: '#f8fafc'
                        }
                    }}
                >
                    {cancelText}
                </Button>
                <Button
                    onClick={onConfirm}
                    variant="contained"
                    color={confirmColor}
                    disableElevation
                    sx={{
                        borderRadius: '12px',
                        textTransform: 'none',
                        fontWeight: 600,
                        px: 3
                    }}
                >
                    {confirmText}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
