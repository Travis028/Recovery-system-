import {
  BarChart3,
  BellRing,
  Building2,
  ClipboardCheck,
  FilePlus,
  FileSearch,
  FileWarning,
  FolderOpen,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  ScrollText,
  UserCog,
  UserRound,
} from 'lucide-react';

const EVERYONE = ['Owner', 'Finder', 'Officer', 'Admin'];
const STAFF = ['Officer', 'Admin'];

/**
 * One list of the signed-in screens: path, menu label, icon and the roles that may open it.
 * The sidebar, the page title in the top bar and the route guard all read from here, so a
 * screen cannot appear in the menu for a role that the router would refuse.
 */
export const SCREENS = {
  dashboard: { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: EVERYONE },
  reportLost: { to: '/report-lost', label: 'Report a lost document', icon: FileWarning, roles: ['Owner'] },
  search: { to: '/search', label: 'Search found documents', icon: FileSearch, roles: ['Owner'] },
  alerts: { to: '/alerts', label: 'Alerts', icon: BellRing, roles: ['Owner'] },
  reportFound: { to: '/report-found', label: 'Register found document', icon: FilePlus, roles: ['Finder', 'Officer', 'Admin'] },
  documents: { to: '/documents', label: 'Documents', icon: FolderOpen, roles: ['Finder', 'Officer', 'Admin'] },
  matches: { to: '/matches', label: 'Match review', icon: ClipboardCheck, roles: STAFF },
  handover: { to: '/handover', label: 'Handover', icon: KeyRound, roles: STAFF },
  statistics: { to: '/statistics', label: 'Statistics', icon: BarChart3, roles: STAFF },
  audit: { to: '/audit', label: 'Audit trail', icon: ScrollText, roles: ['Admin'] },
  users: { to: '/users', label: 'Users and roles', icon: UserCog, roles: ['Admin'] },
  system: { to: '/system', label: 'Backups and data protection', icon: HardDrive, roles: ['Admin'] },
  pickupPoints: { to: '/pickup-points', label: 'Pickup points', icon: Building2, roles: EVERYONE },
  myData: { to: '/my-data', label: 'My data and privacy', icon: UserRound, roles: ['Owner', 'Finder'] },
  receipt: { to: '/receipt', label: 'Handover receipt', icon: KeyRound, roles: STAFF },
};

const SECTIONS = [
  { label: 'Overview', keys: ['dashboard'] },
  { label: 'My documents', keys: ['reportLost', 'search', 'alerts'] },
  { label: 'Documents', keys: ['reportFound', 'documents'] },
  { label: 'Station', keys: ['matches', 'handover', 'statistics'] },
  { label: 'Administration', keys: ['users', 'audit', 'system'] },
  { label: 'Help', keys: ['pickupPoints', 'myData'] },
];

function allowed(screen, role) {
  return screen.roles.indexOf(role) >= 0;
}

/** Menu sections for a role, without empty sections. */
export function navSectionsForRole(role) {
  return SECTIONS.map(function (section) {
    return {
      label: section.label,
      items: section.keys
        .map(function (key) {
          return SCREENS[key];
        })
        .filter(function (screen) {
          return allowed(screen, role);
        }),
    };
  }).filter(function (section) {
    return section.items.length > 0;
  });
}

/** The screen a path belongs to, matching nested paths such as /documents/123. */
export function screenForPath(pathname) {
  const keys = Object.keys(SCREENS);
  let best = null;
  keys.forEach(function (key) {
    const screen = SCREENS[key];
    if (pathname === screen.to || pathname.indexOf(screen.to + '/') === 0) {
      if (!best || screen.to.length > best.to.length) best = screen;
    }
  });
  return best;
}
