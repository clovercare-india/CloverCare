import React, { useState, useEffect } from 'react';
import BottomNav from './BottomNav';
import { translations as translationData, loadLanguage, addLanguageChangeListener } from '../utils/i18n';

export default function SeniorBottomNav() {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const translations = translationData[currentLanguage] || translationData.en;

  useEffect(() => {
    const initLanguage = async () => {
      const lang = await loadLanguage();
      setCurrentLanguage(lang);
    };
    initLanguage();

    const unsubscribe = addLanguageChangeListener((lang) => {
      setCurrentLanguage(lang);
    });

    return () => unsubscribe();
  }, []);

  const navItems = [
    { name: translations.home || 'Home', icon: 'home', route: '/senior/dashboard' },
    { name: translations.routines || 'Routines', icon: 'checklist', route: '/senior/routines' },
    { name: translations.requests || 'Requests', icon: 'inbox', route: '/senior/requests' },
    { name: translations.settings || 'Settings', icon: 'settings', route: '/senior/settings' },
  ];

  return <BottomNav navItems={navItems} />;
}
