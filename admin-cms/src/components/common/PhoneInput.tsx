import React from 'react';
import { TextField, InputAdornment } from '@mui/material';
import { cleanPhoneInput } from '../../utils/validation';

interface PhoneInputProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    required?: boolean;
    error?: boolean;
    helperText?: string;
    disabled?: boolean;
    fullWidth?: boolean;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
    value,
    onChange,
    label = 'Phone Number',
    required = false,
    error,
    helperText,
    disabled = false,
    fullWidth = true
}) => {
    // Clean the display value (remove +91 if present for input)
    const displayValue = value.replace(/^\+91/, '').replace(/\D/g, '');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Only allow numeric input and limit to 10 digits
        const cleaned = cleanPhoneInput(e.target.value);
        onChange(cleaned);
    };

    return (
        <TextField
            fullWidth={fullWidth}
            required={required}
            label={label}
            type="tel"
            value={displayValue}
            onChange={handleChange}
            error={error}
            helperText={helperText}
            disabled={disabled}
            placeholder="XXXXX XXXXX"
            InputProps={{
                startAdornment: (
                    <InputAdornment position="start">
                        <span className="text-gray-600 font-medium">+91</span>
                    </InputAdornment>
                ),
                sx: { borderRadius: '1rem' }
            }}
            inputProps={{
                maxLength: 10,
                inputMode: 'numeric',
                pattern: '[0-9]*'
            }}
        />
    );
};
