import React, { useState, useEffect, useMemo } from 'react';
import { AddTheaterForm } from '../components/AddTheaterForm';
import { ScrollToTop } from '../components/ScrollToTop';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, LogOut, Shield, Plus, ArrowLeft, X, Edit2, Trash2, MapPin, Globe, Search, AlertCircle, Film, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getTheatersFromMap, deleteTheater, checkSession, loginAdmin, logoutAdmin } from '../services/theaterService';
import { Theater } from '../types';

export default function Admin() {
  const [loggedIn, setLoggedIn]           = useState(false);
  const [adminEmail, setAdminEmail]       = useState('');
  const [loading, setLoading]             = useState(true);
  const [theaters, setTheaters]           = useState<Theater[]>([]);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [editingTheater, setEditingTheater] = useState<Theater | null>(null);
  const [searchQuery, setSearchQuery]     = useState('');
  const [sortBy, setSortBy]               = useState<'name' | 'state'>('name');
  const [showNeedsAttention, setShowNeedsAttention] = useState(false);
  const [isDeleting, setIsDeleting]       = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Login form state
  const [loginEmail, setLoginEmail]       = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError]       = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn]     = useState(false);
  const [showPassword, setShowPassword]   = useState(false);

  // Check existing session on mount
  useEffect(() => {
    checkSession().then(({ loggedIn: li, email }) => {
      setLoggedIn(li);
      setAdminEmail(email);
      setLoading(false);
      if (li) loadTheaters();
    });
  }, []);

  const loadTheaters = async () => {
    const data = await getTheatersFromMap();
    setTheaters(data);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const { email } = await loginAdmin(loginEmail, loginPassword);
      setLoggedIn(true);
      setAdminEmail(email);
      setLoginPassword('');
      loadTheaters();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logoutAdmin();
    setLoggedIn(false);
    setAdminEmail('');
    setTheaters([]);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this theater? This action cannot be undone.')) return;
    setIsDeleting(id);
    try {
      await deleteTheater(id);
      setTheaters(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete theater. Check your permissions.');
    } finally {
      setIsDeleting(null);
    }
  };

  const hasMissingFields = (t: Theater) => {
    const isBlank = (val: any) => val === null || val === undefined || (typeof val === 'string' && val.trim() === '');
    return isBlank(t.name) || isBlank(t.address) || isBlank(t.city) || isBlank(t.state) ||
           isBlank(t.state_long) || t.lat === null || t.lat === undefined || isNaN(t.lat) ||
           t.lng === null || t.lng === undefined || isNaN(t.lng) || isBlank(t.description) || isBlank(t.website);
  };

  const getSortName = (name: string) => name.toLowerCase().startsWith('the ') ? name.substring(4) : name;

  const toggleSection = (id: string) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));

  const filteredAndSortedTheaters = useMemo(() => {
    let result = [...theaters];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.city.toLowerCase().includes(query) ||
        t.state.toLowerCase().includes(query)
      );
    }
    if (showNeedsAttention) result = result.filter(hasMissingFields);
    result.sort((a, b) => {
      if (sortBy === 'state') {
        const sc = (a.state_long || a.state).localeCompare(b.state_long || b.state);
        return sc !== 0 ? sc : a.name.localeCompare(b.name);
      }
      return getSortName(a.name).localeCompare(getSortName(b.name));
    });
    return result;
  }, [theaters, searchQuery, sortBy, showNeedsAttention]);

  // ── Theater card (shared between name and state views) ──────────────────
  const TheaterCard = ({ theater }: { theater: Theater }) => (
    <motion.div
      key={theater.id} layout
      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
      className="bg-retro-navy/80 border-2 border-white/10 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-retro-cyan/50 transition-colors"
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-xl text-retro-yellow uppercase tracking-wider">{theater.name}</h3>
          {hasMissingFields(theater) && (
            <span title="Missing information"><AlertCircle className="w-4 h-4 text-retro-pink animate-pulse" /></span>
          )}
        </div>
        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 font-sans">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-retro-pink" />{theater.city}, {theater.state}
          </span>
          {theater.website && (
            <span className="flex items-center gap-1">
              <Globe className="w-3 h-3 text-retro-cyan" />
              {new URL(theater.website).hostname}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 self-end md:self-center">
        <button onClick={() => { setEditingTheater(theater); setIsAddFormOpen(true); }}
          className="p-2 bg-retro-cyan/10 text-retro-cyan border border-retro-cyan/30 rounded-lg hover:bg-retro-cyan hover:text-retro-navy transition-all active:scale-90" title="Edit Theater">
          <Edit2 className="w-5 h-5" />
        </button>
        <button onClick={() => theater.id && handleDelete(theater.id)} disabled={isDeleting === theater.id}
          className="p-2 bg-retro-pink/10 text-retro-pink border border-retro-pink/30 rounded-lg hover:bg-retro-pink hover:text-white transition-all active:scale-90 disabled:opacity-50" title="Delete Theater">
          {isDeleting === theater.id
            ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            : <Trash2 className="w-5 h-5" />}
        </button>
      </div>
    </motion.div>
  );

  // ── Section heading (shared between name and state grouped views) ────────
  const SectionHeading = ({ id, icon, label, count }: { id: string; icon: React.ReactNode; label: string; count: number }) => (
    <motion.button initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
      onClick={() => toggleSection(id)}
      className="w-full font-display text-2xl text-retro-cyan border-b-2 border-retro-cyan/30 pb-2 flex items-center justify-between group cursor-pointer"
    >
      <div className="flex items-center gap-2">
        <motion.div animate={{ rotate: expandedSections[id] ? 0 : -90 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
          <ChevronDown className="w-5 h-5 text-retro-pink" />
        </motion.div>
        {icon}{label}
      </div>
      <span className="font-retro text-xs bg-retro-cyan/10 px-2 py-1 rounded-md border border-retro-cyan/30 group-hover:bg-retro-cyan/20 transition-colors">
        {count} {count === 1 ? 'THEATER' : 'THEATERS'}
      </span>
    </motion.button>
  );

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-retro-navy">
        <div className="w-12 h-12 border-4 border-retro-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-retro-navy text-white p-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <Link to="/" className="flex items-center gap-2 text-retro-cyan md:hover:text-white transition-colors font-retro uppercase text-sm">
            <ArrowLeft className="w-4 h-4" />Back to Home
          </Link>
          {loggedIn && (
            <div className="flex items-center gap-4">
              <span className="text-xs font-retro text-gray-500 hidden md:inline">{adminEmail}</span>
              <button onClick={handleLogout}
                className="flex items-center gap-2 text-retro-pink md:hover:text-white transition-colors font-retro uppercase text-sm">
                <LogOut className="w-4 h-4" />Logout
              </button>
            </div>
          )}
        </header>

        {/* ── Login form ─────────────────────────────────────────────────── */}
        {!loggedIn ? (
          <div className="text-center py-20">
            <Shield className="w-20 h-20 text-retro-pink mx-auto mb-6 animate-pulse" />
            <h1 className="font-display text-5xl mb-4 neon-text">RESTRICTED AREA</h1>
            <p className="text-gray-400 font-sans mb-10 max-w-md mx-auto">
              Administrator access only. Enter your credentials to continue.
            </p>
            <form onSubmit={handleLogin} className="max-w-sm mx-auto space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-xs font-retro text-retro-cyan uppercase">Email</label>
                <input
                  type="email" required value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full bg-retro-navy border-2 border-retro-cyan/30 focus:border-retro-cyan p-3 rounded text-white outline-none transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-retro text-retro-cyan uppercase">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'} required value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-retro-navy border-2 border-retro-cyan/30 focus:border-retro-cyan p-3 pr-10 rounded text-white outline-none transition-all"
                  />
                  <button type="button" onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {loginError && (
                <p className="text-retro-pink text-xs font-retro text-center animate-pulse">{loginError}</p>
              )}
              <button type="submit" disabled={isLoggingIn}
                className={`w-full bg-retro-pink text-white font-retro py-4 rounded-xl flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(255,0,128,0.3)] cursor-pointer active:scale-95 transition-transform uppercase tracking-widest ${isLoggingIn ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <LogIn className="w-5 h-5" />
                {isLoggingIn ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>

        ) : (
        /* ── Admin panel ────────────────────────────────────────────────── */
          <div className="space-y-12">
            <div className="text-center">
              <div className="inline-block p-3 bg-retro-cyan/20 rounded-full border-2 border-retro-cyan mb-4">
                <Shield className="w-8 h-8 text-retro-cyan" />
              </div>
              <h1 className="font-display text-6xl mb-2 text-white">ADMIN PANEL</h1>
              <p className="text-retro-yellow font-retro uppercase tracking-widest">Welcome back, {adminEmail}</p>
            </div>

            <div className="flex flex-col md:flex-row gap-6 items-center justify-between bg-retro-navy/50 p-6 rounded-2xl border-2 border-white/10">
              <div className="flex-1 w-full relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input type="text" placeholder="Search theaters..." value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-retro-navy border-2 border-white/10 focus:border-retro-cyan p-3 pl-10 rounded-xl outline-none transition-all" />
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                <button onClick={() => setShowNeedsAttention(p => !p)}
                  className={`px-4 py-2 text-xs font-retro uppercase transition-all rounded-xl border-2 flex items-center gap-2 touch-manipulation cursor-pointer active:scale-95 ${showNeedsAttention ? 'bg-retro-pink text-white border-white shadow-[0_0_10px_rgba(255,0,128,0.5)]' : 'bg-retro-navy text-retro-pink border-retro-pink/50 md:hover:border-retro-pink'}`}>
                  <AlertCircle className="w-4 h-4" />Needs Attention
                </button>
                <div className="flex bg-retro-navy border-2 border-white/10 rounded-xl overflow-hidden">
                  <button onClick={() => setSortBy('name')}
                    className={`px-4 py-2 text-xs font-retro uppercase transition-colors ${sortBy === 'name' ? 'bg-retro-cyan text-retro-navy' : 'text-gray-500 hover:text-white'}`}>Name</button>
                  <button onClick={() => setSortBy('state')}
                    className={`px-4 py-2 text-xs font-retro uppercase transition-colors ${sortBy === 'state' ? 'bg-retro-cyan text-retro-navy' : 'text-gray-500 hover:text-white'}`}>State</button>
                </div>
                <button onClick={() => { setEditingTheater(null); setIsAddFormOpen(true); }}
                  className="flex-1 md:flex-none bg-retro-pink text-white font-retro px-6 py-3 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,0,128,0.3)] active:scale-95 transition-transform">
                  <Plus className="w-5 h-5" />ADD NEW
                </button>
              </div>
            </div>

            <div className="space-y-8">
              {sortBy === 'state' ? (
                Object.entries(
                  filteredAndSortedTheaters.reduce((acc, t) => {
                    const s = t.state_long || t.state;
                    if (!acc[s]) acc[s] = [];
                    acc[s].push(t);
                    return acc;
                  }, {} as Record<string, Theater[]>)
                ).sort(([a], [b]) => a.localeCompare(b)).map(([stateName, stateTheaters]) => (
                  <div key={stateName} className="space-y-4">
                    <SectionHeading id={stateName} icon={<MapPin className="w-5 h-5" />} label={stateName} count={stateTheaters.length} />
                    <AnimatePresence initial={false}>
                      {expandedSections[stateName] && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: 'easeInOut' }} className="overflow-hidden">
                          <div className="grid grid-cols-1 gap-4 pb-4">
                            <AnimatePresence mode="popLayout">
                              {stateTheaters.map(t => <TheaterCard key={t.id} theater={t} />)}
                            </AnimatePresence>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))
              ) : (
                Object.entries(
                  filteredAndSortedTheaters.reduce((acc, t) => {
                    const ch = getSortName(t.name).charAt(0).toUpperCase();
                    const letter = /^[0-9]/.test(ch) ? '#' : ch;
                    if (!acc[letter]) acc[letter] = [];
                    acc[letter].push(t);
                    return acc;
                  }, {} as Record<string, Theater[]>)
                ).sort(([a], [b]) => a.localeCompare(b)).map(([letter, letterTheaters]) => (
                  <div key={letter} className="space-y-4">
                    <SectionHeading id={letter} icon={<Film className="w-5 h-5" />} label={letter} count={letterTheaters.length} />
                    <AnimatePresence initial={false}>
                      {expandedSections[letter] && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: 'easeInOut' }} className="overflow-hidden">
                          <div className="grid grid-cols-1 gap-4 pb-4">
                            <AnimatePresence mode="popLayout">
                              {letterTheaters.map(t => <TheaterCard key={t.id} theater={t} />)}
                            </AnimatePresence>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))
              )}

              {filteredAndSortedTheaters.length === 0 && (
                <div className="text-center py-20 border-2 border-dashed border-white/10 rounded-2xl">
                  <p className="text-gray-500 font-retro uppercase tracking-widest">No theaters found</p>
                </div>
              )}
            </div>

            <AddTheaterForm
              isOpen={isAddFormOpen}
              theater={editingTheater}
              onClose={() => { setIsAddFormOpen(false); setEditingTheater(null); }}
              onAdd={t => setTheaters(prev => [...prev, t])}
              onUpdate={t => setTheaters(prev => prev.map(item => item.id === t.id ? t : item))}
            />
          </div>
        )}
      </div>
      <ScrollToTop />
    </div>
  );
}
