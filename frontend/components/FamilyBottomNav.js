import BottomNav from './BottomNav';

export default function FamilyBottomNav() {
  const navItems = [
    { name: 'Home', icon: 'home', route: '/family/dashboard' },
    { name: 'Alerts', icon: 'notifications', route: '/family/alerts' },
    { name: 'Services', icon: 'inbox', route: '/family/services' },
    { name: 'Routines', icon: 'checklist', route: '/family/routines' },
    { name: 'Settings', icon: 'settings', route: '/family/settings' },
  ];

  return <BottomNav navItems={navItems} />;
}
