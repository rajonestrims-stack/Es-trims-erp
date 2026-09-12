import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

mob_start_pos = text.find('{/* Mobile Menu Drawer */}')
desktop_aside_end_pos = text.find('</aside>') + len('</aside>')

print('Found range:', mob_start_pos, 'to', desktop_aside_end_pos)
sidebar_section = text[mob_start_pos:desktop_aside_end_pos]

s = sidebar_section

# 1. Desktop aside container
s = s.replace(
    'className="w-64 bg-white border-r border-neutral-100 flex flex-col hidden md:flex print:hidden sticky top-0 h-screen"',
    'className="w-64 bg-[#0f172a] border-r border-slate-800 text-slate-100 flex flex-col hidden md:flex print:hidden sticky top-0 h-screen shadow-xl select-none"'
)

# 2. Desktop top logo container
s = s.replace(
    '<div className="p-6 flex items-center gap-3">\n          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-neutral-100 p-0.5">\n            <img \n              src="https://lh3.googleusercontent.com/d/14Hu8k6jVbcjgZUGJTeCqETFfi9E_JncE" \n              className="w-full h-full object-contain" \n              alt="Logo"\n              referrerPolicy="no-referrer"\n            />\n          </div>\n          <span className="font-bold text-lg tracking-tight">ES TRIMS LIMITED</span>\n        </div>',
    '''<div className="p-4 flex items-center gap-3 border-b border-slate-800/80 bg-slate-950/40">
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center overflow-hidden border border-slate-700 p-0.5 shadow-sm">
            <img 
              src="https://lh3.googleusercontent.com/d/14Hu8k6jVbcjgZUGJTeCqETFfi9E_JncE" 
              className="w-full h-full object-contain" 
              alt="Logo"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
              <span>ES TRIMS</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">ERP</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Enterprise Suite</p>
          </div>
        </div>'''
)

# 3. Mobile drawer container
s = s.replace(
    'className="fixed inset-y-0 left-0 w-72 bg-white z-50 md:hidden flex flex-col shadow-2xl"',
    'className="fixed inset-y-0 left-0 w-72 bg-[#0f172a] text-slate-100 border-r border-slate-800 z-50 md:hidden flex flex-col shadow-2xl"'
)

# 4. Mobile drawer logo header
s = s.replace(
    '<div className="p-6 flex items-center justify-between border-b border-neutral-50">\n                <div className="flex items-center gap-2">\n                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-neutral-100 p-0.5">\n                    <img \n                      src="https://lh3.googleusercontent.com/d/14Hu8k6jVbcjgZUGJTeCqETFfi9E_JncE" \n                      className="w-full h-full object-contain" \n                      alt="Logo"\n                      referrerPolicy="no-referrer"\n                    />\n                  </div>\n                  <span className="font-bold text-lg">ES TRIMS</span>\n                </div>\n                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-neutral-400">\n                  <X className="w-6 h-6" />\n                </button>\n              </div>',
    '''<div className="p-4 flex items-center justify-between border-b border-slate-800 bg-slate-950/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-slate-700 p-0.5 shadow-sm">
                    <img 
                      src="https://lh3.googleusercontent.com/d/14Hu8k6jVbcjgZUGJTeCqETFfi9E_JncE" 
                      className="w-full h-full object-contain" 
                      alt="Logo"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <span className="font-bold text-base text-white">ES TRIMS</span>
                    <span className="ml-1.5 text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">ERP</span>
                  </div>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>'''
)

# 5. Dashboard / Top-level buttons
s = s.replace(
    "? 'bg-neutral-900 text-white shadow-lg shadow-neutral-200' \n                  : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'",
    "? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-950/60 ring-1 ring-blue-400/40 font-bold' \n                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white font-medium'"
)
s = s.replace(
    "? 'bg-neutral-900 text-white shadow-lg shadow-neutral-200'\n                  : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'",
    "? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-950/60 ring-1 ring-blue-400/40 font-bold'\n                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white font-medium'"
)
s = s.replace(
    "? 'bg-neutral-900 text-white shadow-lg shadow-neutral-200'\n                    : 'text-neutral-600 hover:bg-neutral-50'",
    "? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-950/60 ring-1 ring-blue-400/40 font-bold'\n                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white font-medium'"
)

# 6. Accordion parent button inactive / active styling
s = s.replace(
    "? 'bg-neutral-100 text-neutral-900 font-bold'\n                          : 'text-neutral-600 hover:bg-neutral-50'",
    "? 'bg-slate-800/90 text-blue-300 font-bold border border-slate-700/60 shadow-xs'\n                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium'"
)
s = s.replace(
    "? 'bg-neutral-100 text-neutral-900 font-bold'\n                        : 'text-neutral-600 hover:bg-neutral-50'",
    "? 'bg-slate-800/90 text-blue-300 font-bold border border-slate-700/60 shadow-xs'\n                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium'"
)
s = s.replace(
    "? 'bg-neutral-100 text-neutral-900 font-bold'\n                            : 'text-neutral-600 hover:bg-neutral-50'",
    "? 'bg-slate-800/90 text-blue-300 font-bold border border-slate-700/60 shadow-xs'\n                            : 'text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium'"
)

# 7. Submenu container borders
s = s.replace('border-l-2 border-indigo-100 space-y-1 py-1', 'border-l-2 border-blue-500/30 space-y-1 py-1')
s = s.replace('border-l-2 border-purple-100 space-y-1 py-1', 'border-l-2 border-blue-500/30 space-y-1 py-1')
s = s.replace('border-l-2 border-emerald-100 space-y-1 py-1', 'border-l-2 border-blue-500/30 space-y-1 py-1')
s = s.replace('border-l-2 border-blue-100 space-y-1 py-1', 'border-l-2 border-blue-500/30 space-y-1 py-1')
s = s.replace('border-l-2 border-amber-100 space-y-1 py-1', 'border-l-2 border-blue-500/30 space-y-1 py-1')
s = s.replace('border-l-2 border-neutral-100 space-y-1 py-1', 'border-l-2 border-blue-500/30 space-y-1 py-1')
s = s.replace('border-l-2 border-neutral-200 space-y-1 py-1', 'border-l-2 border-blue-500/30 space-y-1 py-1')
s = s.replace('border-l-2 border-indigo-200 space-y-1 py-1', 'border-l-2 border-blue-500/30 space-y-1 py-1')

# 8. Child item active / inactive
s = s.replace(
    "? 'bg-indigo-600 text-white shadow-sm'\n                                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'",
    "? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold'\n                                : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'"
)
s = s.replace(
    "? 'bg-indigo-600 text-white shadow-sm'\n                               : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'",
    "? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold'\n                               : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'"
)
s = s.replace(
    "? 'bg-indigo-600 text-white shadow-sm'\n                              : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'",
    "? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold'\n                              : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'"
)
s = s.replace(
    "? 'bg-indigo-600 text-white shadow-sm'\n                             : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'",
    "? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold'\n                             : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'"
)
s = s.replace(
    "? 'bg-indigo-600 text-white shadow-sm' : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'",
    "? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'"
)
s = s.replace(
    "? 'bg-indigo-600 text-white shadow-sm'\n                                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'",
    "? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold'\n                                  : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'"
)

s = s.replace(
    "? 'bg-purple-600 text-white shadow-sm'\n                                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'",
    "? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold'\n                                : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'"
)
s = s.replace(
    "? 'bg-emerald-600 text-white shadow-sm'\n                                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'",
    "? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold'\n                                : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'"
)
s = s.replace(
    "? 'bg-blue-600 text-white shadow-sm'\n                                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'",
    "? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50 font-semibold'\n                                : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'"
)

# 9. Bottom Profile User Footer
old_profile_footer = '''        {/* User Profile / Logout */}
        <div className="p-4 border-t border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center font-bold text-xs text-neutral-600">
              {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-neutral-900 truncate">{user?.displayName || 'User'}</p>
              <p className="text-[10px] text-neutral-400 truncate">{user?.email || 'admin@estrims.com'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex items-center">
              <NotificationBell onSelectNotification={() => {}} />
            </div>
            <button 
              onClick={handleOpenProfileModal} 
              className="p-1.5 text-neutral-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="Edit Profile & Password"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleLogout} className="p-1.5 text-neutral-400 hover:text-red-600 transition-colors" title="Sign Out">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>'''

new_profile_footer = '''        {/* User Profile / Logout */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-white truncate">{user?.displayName || 'User'}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email || 'admin@estrims.com'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex items-center">
              <NotificationBell onSelectNotification={() => {}} />
            </div>
            <button 
              onClick={handleOpenProfileModal} 
              className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="Edit Profile & Password"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors" title="Sign Out">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>'''

s = s.replace(old_profile_footer, new_profile_footer)

# Mobile drawer profile footer
old_mob_footer = '''              {/* Mobile User Profile Footer */}
              <div className="p-4 border-t border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center font-bold text-xs text-neutral-600">
                    {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-semibold text-neutral-900 truncate">{user?.displayName || 'User'}</p>
                    <p className="text-[10px] text-neutral-400 truncate">{user?.email || 'admin@estrims.com'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleOpenProfileModal();
                    }}
                    className="p-2 text-neutral-400 hover:text-purple-600 transition-colors"
                    title="Edit Profile & Password"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={handleLogout} className="p-2 text-neutral-400 hover:text-red-600 transition-colors" title="Sign Out">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>'''

new_mob_footer = '''              {/* Mobile User Profile Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                    {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-semibold text-white truncate">{user?.displayName || 'User'}</p>
                    <p className="text-[10px] text-slate-400 truncate">{user?.email || 'admin@estrims.com'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleOpenProfileModal();
                    }}
                    className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Edit Profile & Password"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors" title="Sign Out">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>'''

s = s.replace(old_mob_footer, new_mob_footer)

# Replace all remaining general occurrences of neutral text/hover in sidebar_section
s = s.replace("'text-neutral-600 hover:bg-neutral-50'", "'text-slate-300 hover:bg-slate-800/80 hover:text-white font-medium'")
s = s.replace("'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'", "'text-slate-300 hover:bg-slate-800/80 hover:text-white font-medium'")
s = s.replace("'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'", "'text-slate-400 hover:bg-slate-800 hover:text-slate-100'")
s = s.replace("'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'", "'text-slate-400 hover:bg-slate-800 hover:text-slate-100'")
s = s.replace("text-neutral-400 ml-2", "text-slate-400 ml-2")
s = s.replace("text-neutral-400", "text-slate-400")

# Update section headers
s = s.replace("text-indigo-600", "text-blue-400")
s = s.replace("text-indigo-500", "text-blue-400")
s = s.replace("text-purple-600", "text-blue-400")
s = s.replace("text-purple-500", "text-blue-400")
s = s.replace("text-emerald-600", "text-blue-400")
s = s.replace("text-emerald-500", "text-blue-400")
s = s.replace("text-amber-600", "text-blue-400")
s = s.replace("text-amber-500", "text-blue-400")
s = s.replace("text-blue-600", "text-blue-400")
s = s.replace("text-blue-500", "text-blue-400")

new_text = text[:mob_start_pos] + s + text[desktop_aside_end_pos:]

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(new_text)

print('Updated App.tsx successfully!')
