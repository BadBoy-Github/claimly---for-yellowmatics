import Link from 'next/link';
import { FiArchive, FiChevronDown, FiCircle, FiFileText, FiMail, FiShield } from 'react-icons/fi';

const OWNER = 'Elayabarathi M V';

const navigation = [
  { href: '/', label: 'Monthly claim', key: 'claims', Icon: FiFileText },
  { href: '/settings', label: 'Email settings', key: 'settings', Icon: FiMail },
  { href: '/history', label: 'Previous claims', key: 'history', Icon: FiArchive },
];

export default function WorkspaceLayout({ active, title, connected, children }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand-lockup" aria-label="Claimly home">
          <div className="brand-mark">C</div>
          <span>claimly<span className="brand-dot">.</span></span>
        </Link>
        <div className="sidebar-label">WORKSPACE</div>
        {navigation.map(({ href, label, key, Icon }) => (
          <Link
            href={href}
            className={`nav-item ${active === key ? 'nav-item-active' : ''}`}
            aria-current={active === key ? 'page' : undefined}
            key={key}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <div className="privacy-icon"><FiShield aria-hidden="true" /></div>
            <p className="text-sm font-bold text-ink">Just for you</p>
            <p className="mt-1 text-xs leading-5 text-muted">Your claims stay in your private workspace.</p>
          </div>
          <div className="profile-row">
            <div className="avatar">EM</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{OWNER}</p>
              <p className="mt-0.5 truncate text-xs text-muted">Personal workspace</p>
            </div>
            <FiChevronDown className="ml-auto shrink-0 text-muted" aria-hidden="true" />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{title}</strong></div>
          <div className={`connection-pill ${connected ? 'connection-online' : 'connection-offline'}`}>
            <FiCircle className="status-dot" aria-hidden="true" />
            {connected ? 'All changes synced' : 'API connection needed'}
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
