import {
  BarChart3,
  BellRing,
  Building2,
  ClipboardCheck,
  FilePlus,
  FileSearch,
  FolderOpen,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  ScrollText,
  UserCog,
  UserRound,
} from 'lucide-react';

const ITEMS = {
  dashboard: { to: '/dashboard', label: 'Dashboard', short: 'Home', icon: LayoutDashboard },
  reportFound: { to: '/report-found', label: 'Register found document', short: 'Found', icon: FilePlus },
  documents: { to: '/documents', label: 'Documents', short: 'Documents', icon: FolderOpen },
  reportLost: { to: '/report-lost', label: 'Report a lost document', short: 'Report', icon: FilePlus },
  search: { to: '/search', label: 'Search found documents', short: 'Search', icon: FileSearch },
  alerts: { to: '/alerts', label: 'Alerts', short: 'Alerts', icon: BellRing },
  matches: { to: '/matches', label: 'Match review', short: 'Matches', icon: ClipboardCheck },
  handover: { to: '/handover', label: 'Handover', short: 'Handover', icon: KeyRound },
  pickupPoints: { to: '/pickup-points', label: 'Pickup points', short: 'Points', icon: Building2 },
  statistics: { to: '/statistics', label: 'Statistics', short: 'Stats', icon: BarChart3 },
  audit: { to: '/audit', label: 'Audit trail', short: 'Audit', icon: ScrollText },
  users: { to: '/users', label: 'Users and roles', short: 'Users', icon: UserCog },
  system: { to: '/system', label: 'Backups and data protection', short: 'System', icon: HardDrive },
  myData: { to: '/my-data', label: 'My data and privacy', short: 'My data', icon: UserRound },
};

const BY_ROLE = {
  Owner: ['dashboard', 'reportLost', 'search', 'alerts', 'pickupPoints', 'myData'],
  Finder: ['dashboard', 'reportFound', 'documents', 'pickupPoints', 'myData'],
  Officer: ['dashboard', 'documents', 'matches', 'handover', 'reportFound', 'statistics', 'pickupPoints'],
  Admin: ['dashboard', 'documents', 'matches', 'handover', 'statistics', 'audit', 'users', 'pickupPoints', 'system'],
};

export function navForRole(role) {
  return (BY_ROLE[role] || ['dashboard']).map(function (key) {
    return ITEMS[key];
  });
}
