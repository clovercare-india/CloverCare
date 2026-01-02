import React, { createContext, useContext, useState, ReactNode } from 'react';

interface FilterContextType {
    selectedCareManager: string;
    setSelectedCareManager: (id: string) => void;
    selectedCareManagerName: string;
    setSelectedCareManagerName: (name: string) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [selectedCareManager, setSelectedCareManager] = useState<string>('all');
    const [selectedCareManagerName, setSelectedCareManagerName] = useState<string>('All Care Managers');

    return (
        <FilterContext.Provider
            value={{
                selectedCareManager,
                setSelectedCareManager,
                selectedCareManagerName,
                setSelectedCareManagerName
            }}
        >
            {children}
        </FilterContext.Provider>
    );
};

export const useFilter = () => {
    const context = useContext(FilterContext);
    if (context === undefined) {
        throw new Error('useFilter must be used within a FilterProvider');
    }
    return context;
};
