const navItems = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'search', label: 'Search', icon: '⌕' },
  { id: 'cards', label: 'Cards', icon: '◫' },
  { id: 'profile', label: 'Profile', icon: '◎' },
]

function BottomNav({ activeTab, onChange }) {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      {navItems.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          <span className="nav-icon" aria-hidden="true">
            {item.icon}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}

export default BottomNav
