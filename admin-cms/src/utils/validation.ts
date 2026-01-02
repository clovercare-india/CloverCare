/**
 * Validation utilities for admin panel
 */

/**
 * Validates Indian phone number (10 digits)
 * @param phone - Phone number string to validate
 * @returns Object with isValid boolean and formatted phone
 */
export const validatePhoneNumber = (phone: string): { 
    isValid: boolean; 
    formatted: string; 
    error?: string;
} => {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Check if it's exactly 10 digits
    if (cleaned.length === 0) {
        return { 
            isValid: false, 
            formatted: '', 
            error: 'Phone number is required' 
        };
    }
    
    if (cleaned.length !== 10) {
        return { 
            isValid: false, 
            formatted: cleaned, 
            error: `Phone number must be exactly 10 digits (got ${cleaned.length})` 
        };
    }
    
    // Format as +91XXXXXXXXXX
    const formatted = `+91${cleaned}`;
    
    return { 
        isValid: true, 
        formatted 
    };
};

/**
 * Formats phone number for display
 * @param phone - Phone number string
 * @returns Formatted phone number (+91 XXXXX XXXXX)
 */
export const formatPhoneDisplay = (phone: string): string => {
    if (!phone) return 'N/A';
    
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // If it's 10 digits, assume Indian number
    if (cleaned.length === 10) {
        return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
    }
    
    // If it's 12 digits and starts with 91, format it
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
        const number = cleaned.slice(2);
        return `+91 ${number.slice(0, 5)} ${number.slice(5)}`;
    }
    
    // Return as-is if format is unknown
    return phone;
};

/**
 * Cleans phone number input (removes non-numeric, limits to 10 digits)
 * @param input - Raw input string
 * @returns Cleaned phone number (max 10 digits)
 */
export const cleanPhoneInput = (input: string): string => {
    // Remove all non-numeric characters
    const cleaned = input.replace(/\D/g, '');
    
    // Limit to 10 digits
    return cleaned.slice(0, 10);
};
