import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './api-client';
import i18n from './i18n';

export type Language = 'English' | 'French' | 'Swahili';
export type Currency = 'KES' | 'XAF' | 'RWF' | 'USD' | 'UGX' | 'TZS';
export type CountryCode = 'KE' | 'CM' | 'RW' | 'UG' | 'TZ';

export interface Region {
  id: string;
  code: CountryCode | string;
  name: string;
  currency: Currency | string;
  language: Language | string;
  supportedLanguages?: string[];
  timezone: string;
  isActive?: boolean;
}

export const SUPPORTED_REGIONS: Region[] = [
  { id: '1', code: 'KE', name: 'Kenya', currency: 'KES', language: 'English', supportedLanguages: ['English', 'Swahili'], timezone: 'Africa/Nairobi', isActive: true },
  { id: '2', code: 'CM', name: 'Cameroon', currency: 'XAF', language: 'French', supportedLanguages: ['French', 'English'], timezone: 'Africa/Douala', isActive: true },
  { id: '3', code: 'RW', name: 'Rwanda', currency: 'RWF', language: 'French', supportedLanguages: ['French', 'English', 'Kinyarwanda'], timezone: 'Africa/Kigali', isActive: true },
  { id: '4', code: 'UG', name: 'Uganda', currency: 'UGX', language: 'English', supportedLanguages: ['English', 'Swahili'], timezone: 'Africa/Kampala', isActive: true },
];

export const LANGUAGE_TO_I18N_CODE: Record<string, string> = {
  English: 'en',
  French: 'fr',
  Swahili: 'sw'
};

interface RegionContextType {
  activeRegion: Region;
  setActiveRegion: (region: Region) => void;
  language: Language;
  currency: Currency;
  formatCurrency: (amount: number) => string;
  formatLocalTime: (date: Date | string) => string;
  availableRegions: Region[];
  
  // Expose these specifically for Swahili toggling in Kenya
  activeLanguage: string;
  setActiveLanguage: (lang: string) => void;
}

const RegionContext = createContext<RegionContextType | undefined>(undefined);

export const RegionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRegionState, setActiveRegionState] = useState<Region>(() => {
    try {
      // First, prioritize the logged-in user's assigned region
      const userData = localStorage.getItem('marketingUser');
      if (userData) {
        const parsed = JSON.parse(userData);
        if (parsed.regionId) {
          // We don't have availableRegions fully loaded yet, but we'll try to find it in SUPPORTED_REGIONS for initial load
          const found = SUPPORTED_REGIONS.find(r => r.id === parsed.regionId);
          if (found) return found;
          // Otherwise, we'll return a temporary object to trigger the useEffect later
          return { ...SUPPORTED_REGIONS[0], id: parsed.regionId };
        }
      }
      // Then check manually saved region (though now we heavily bias towards user's region)
      const saved = localStorage.getItem('crm_active_region');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) { }
    return SUPPORTED_REGIONS[0];
  });

  const [activeLanguage, setActiveLanguage] = useState<string>(() => {
    return localStorage.getItem('crm_active_language') || activeRegionState.language;
  });

  const { data: regionsData } = useQuery({
    queryKey: ['admin', 'regions'],
    queryFn: async () => {
      const res = await apiRequest('/api/admin/regions');
      return res.json();
    },
  });

  let availableRegions = regionsData?.regions?.filter((r: any) => r.isActive);
  if (!availableRegions) {
    console.warn("RegionContext: Failed to load regions from API. Falling back to hardcoded SUPPORTED_REGIONS.");
    availableRegions = SUPPORTED_REGIONS;
  }

  useEffect(() => {
    if (availableRegions.length > 0) {
      let targetRegionId = activeRegionState.id;
      
      // Check for user's assigned region
      try {
        const userData = localStorage.getItem('marketingUser');
        if (userData) {
          const parsed = JSON.parse(userData);
          if (parsed.regionId) {
            targetRegionId = parsed.regionId;
          }
        }
      } catch (e) {}

      let targetRegion = availableRegions.find((r: Region) => r.id === targetRegionId);
      
      if (!targetRegion) {
        targetRegion = availableRegions.find((r: Region) => r.code === 'KE') || availableRegions[0];
      }

      if (activeRegionState.id !== targetRegion.id || !activeRegionState.supportedLanguages) {
        setActiveRegionState(targetRegion);
        // Ensure language is supported, otherwise fallback to region's primary language
        const currentLangSupported = targetRegion.supportedLanguages?.includes(activeLanguage);
        if (!currentLangSupported) {
           setActiveLanguage(targetRegion.language);
        }
      }
    }
  }, [availableRegions, activeRegionState.id, activeLanguage]);

  useEffect(() => {
    const i18nCode = LANGUAGE_TO_I18N_CODE[activeLanguage] || 'en';
    i18n.changeLanguage(i18nCode);
    localStorage.setItem('crm_active_language', activeLanguage);
  }, [activeLanguage]);

  const activeRegion = activeRegionState;

  const setActiveRegion = (region: Region) => {
    setActiveRegionState(region);
    localStorage.setItem('crm_active_region', JSON.stringify(region));
    // Reset language to the region's default language when switching regions
    setActiveLanguage(region.language);
  };

  const language = activeLanguage as Language;
  const currency = activeRegion.currency as Currency;

  const formatCurrency = (amount: number) => {
    try {
      let locale = 'en-KE';
      if (currency === 'XAF') locale = 'fr-CM';
      if (currency === 'RWF') locale = 'fr-RW';
      
      return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
    } catch (e) {
      return `${currency} ${amount.toLocaleString()}`;
    }
  };

  const formatLocalTime = (dateInput: Date | string) => {
    try {
      const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      
      // Determine locale dynamically from activeRegion
      let locale = 'en-US'; // default fallback
      if (activeRegion.code === 'KE') locale = 'en-KE';
      if (activeRegion.code === 'CM') locale = 'fr-CM';
      if (activeRegion.code === 'RW') locale = 'fr-RW';
      if (activeRegion.code === 'UG') locale = 'en-UG';

      return new Intl.DateTimeFormat(locale, { 
        timeZone: activeRegion.timezone, 
        hour: 'numeric', 
        minute: '2-digit', 
        timeZoneName: 'short' 
      }).format(date);
    } catch (e) {
      return '';
    }
  };

  return (
    <RegionContext.Provider value={{ 
        activeRegion, 
        setActiveRegion, 
        language, 
        currency, 
        formatCurrency, 
        formatLocalTime, 
        availableRegions,
        activeLanguage,
        setActiveLanguage 
    }}>
      {children}
    </RegionContext.Provider>
  );
};

export const useRegion = () => {
  const context = useContext(RegionContext);
  if (context === undefined) {
    throw new Error('useRegion must be used within a RegionProvider');
  }
  return context;
};
