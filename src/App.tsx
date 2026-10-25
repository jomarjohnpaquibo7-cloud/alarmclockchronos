import { useEffect, useMemo, useState } from 'react';
import { loadState, saveState, isFirebaseConfigured } from './data';
import { prepareAlarmNotifications, syncAlarmNotifications } from './alarms';
import {
  Bell,
  BellRing,
  CalendarDays,
  Check,
  Clock3,
  Edit3,
  FileText,
  Moon,
  Sun,
  Plus,
  Search,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';

type Schedule = {
  id: string;
  title: string;
  time: string;
  sound: string;
  days: string[];
  notes: string;
  enabled: boolean;
};
type Note = { id: string; title: string; body: string; date: string };
type State = { schedules: Schedule[]; notes: Note[] };
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const EMPTY: State = { schedules: [], notes: [] };
const getClientKey = () => {
  let key = localStorage.getItem('chronos_client_key');
  if (!key) {
    key = crypto.randomUUID().replaceAll('-', '');
    localStorage.setItem('chronos_client_key', key);
  }
  return key;
};
const clientKey = getClientKey();
const time12 = (value: string) => {
  if (!value) return '';
  const [h, m] = value.split(':').map(Number);
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const todayKey = () =>
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
function App() {
  const [state, setState] = useState<State>(EMPTY);
  const [clock, setClock] = useState(new Date());
  const [tab, setTab] = useState<'alarms' | 'notes'>('alarms');
  const [search, setSearch] = useState('');
  const [appName, setAppName] = useState(() => { try { return localStorage.getItem('chronos_app_name') || 'Nova'; } catch { return 'Nova'; } });
  const [nameDraft, setNameDraft] = useState('');
  const [editingAppName, setEditingAppName] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [errorMsg, setErrorMsg] = useState('');
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('07:00');
  const [sound, setSound] = useState('chime');
  const [days, setDays] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [editId, setEditId] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [ringing, setRinging] = useState<Schedule | null>(null);
  const [snoozeAt, setSnoozeAt] = useState<number | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return localStorage.getItem('chronos_theme') === 'light' ? 'light' : 'dark'; }
    catch { return 'dark'; }
  });

  useEffect(() => {
    try { localStorage.setItem('chronos_app_name', appName); } catch { /* Name remains available for this session. */ }
  }, [appName]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('chronos_theme', theme); } catch { /* session-only theme */ }
  }, [theme]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    prepareAlarmNotifications().catch(() => setErrorMsg('Please allow notifications so alarms can ring on this device.'));
    loadState(clientKey)
      .then(async data => {
        const next = { schedules: data.schedules || [], notes: data.notes || [] };
        setState(next);
        await syncAlarmNotifications(next.schedules).catch(() => setErrorMsg('Could not schedule native alarms. Check notification permissions in Android settings.'));
      })
      .catch(() => setErrorMsg('Could not load saved data. Check Firebase setup and internet access.'))
      .finally(() => setLoading(false));
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    const timer = window.setInterval(() => {
      const now = new Date();
      const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const match = state.schedules.find(
        s => s.enabled && s.time === hm && s.days.includes(todayKey())
      );
      if (match && now.getSeconds() === 0 && !ringing) setRinging(match);
      if (snoozeAt && Date.now() >= snoozeAt) {
        setRinging({
          id: 'snooze',
          title: 'Snoozed alarm',
          time: hm,
          sound: 'bell',
          days: [todayKey()],
          notes: '',
          enabled: true,
        });
        setSnoozeAt(null);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state.schedules, loading, ringing, snoozeAt]);

  async function persist(next: State) {
    setSaving(true);
    setErrorMsg('');
    try {
      await saveState(clientKey, next);
      setState(next);
      try {
        await syncAlarmNotifications(next.schedules);
      } catch {
        setErrorMsg('Your changes were saved, but Android notifications could not be updated. Check notification permission.');
      }
    } catch {
      setErrorMsg(
        'Save failed. Your latest changes were not confirmed in the database.'
      );
    } finally {
      setSaving(false);
    }
  }
  function resetForm() {
    setTitle('');
    setTime('07:00');
    setSound('chime');
    setDays([]);
    setNotes('');
    setEditId('');
  }
  async function submitSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!days.length) {
      setErrorMsg('Select at least one repeat day.');
      return;
    }
    const item: Schedule = {
      id: editId || crypto.randomUUID(),
      title: title.trim(),
      time,
      sound,
      days,
      notes: notes.trim(),
      enabled: true,
    };
    const schedules = editId
      ? state.schedules.map(s => (s.id === editId ? item : s))
      : [...state.schedules, item];
    await persist({ ...state, schedules });
    resetForm();
  }
  function editSchedule(s: Schedule) {
    setEditId(s.id);
    setTitle(s.title);
    setTime(s.time);
    setSound(s.sound);
    setDays(s.days);
    setNotes(s.notes);
    setTab('alarms');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function removeSchedule(id: string) {
    if (!confirm('Delete this schedule?')) return;
    await persist({
      ...state,
      schedules: state.schedules.filter(s => s.id !== id),
    });
  }
  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteTitle.trim() || !noteBody.trim()) {
      setErrorMsg('Enter both a note title and note details.');
      return;
    }
    const note: Note = {
      id: crypto.randomUUID(),
      title: noteTitle.trim(),
      body: noteBody.trim(),
      date: new Date().toLocaleString(),
    };
    await persist({ ...state, notes: [note, ...state.notes] });
    setNoteTitle('');
    setNoteBody('');
  }
  async function removeNote(id: string) {
    if (!confirm('Delete this note?')) return;
    await persist({ ...state, notes: state.notes.filter(n => n.id !== id) });
  }
  const filtered = useMemo(
    () =>
      state.schedules
        .filter(s =>
          (s.title + ' ' + s.notes).toLowerCase().includes(search.toLowerCase())
        )
        .sort((a, b) => a.time.localeCompare(b.time)),
    [state.schedules, search]
  );
  const activeCount = state.schedules.filter(s => s.enabled).length;
  function playTone() {
    try {
      const ctx = new AudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const loud = ['power-horn', 'rapid-pulse', 'triple-klaxon'].includes(sound);
      osc.type = ['digital', 'rapid-pulse'].includes(sound) ? 'square' : sound === 'triple-klaxon' ? 'sawtooth' : sound === 'power-horn' ? 'triangle' : 'sine';
      const base = sound === 'bell' ? 587 : sound === 'pulse' ? 880 : sound === 'zen' ? 432 : sound === 'power-horn' ? 360 : sound === 'rapid-pulse' ? 1180 : sound === 'triple-klaxon' ? 760 : 660;
      osc.frequency.setValueAtTime(base, now);
      if (sound === 'power-horn') {
        osc.frequency.linearRampToValueAtTime(470, now + 0.16);
        osc.frequency.linearRampToValueAtTime(340, now + 0.32);
      } else if (sound === 'rapid-pulse') {
        osc.frequency.linearRampToValueAtTime(820, now + 0.10);
        osc.frequency.linearRampToValueAtTime(1250, now + 0.20);
      } else if (sound === 'triple-klaxon') {
        osc.frequency.linearRampToValueAtTime(1120, now + 0.10);
        osc.frequency.linearRampToValueAtTime(620, now + 0.20);
        osc.frequency.linearRampToValueAtTime(1120, now + 0.30);
      }
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(loud ? 0.24 : 0.14, now + 0.025);
      gain.gain.setTargetAtTime(0.001, now + 0.32, 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.62);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); void ctx.close(); };
    } catch {
      setErrorMsg('Sound preview is unavailable in this browser.');
    }
  }
  const hour = clock.getHours() % 12 || 12;
  return (
    <div className={`app-shell ${theme}-theme`}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon brand-logo-wrap">
            <img src="/resources/gising-na-logo.jpg" alt="Gising Na! Alarm Solutions" className="brand-logo" />
          </div>
          <div>
            <div className="brand-title">
              GISING NA! <span>ALARM</span>
            </div>
            <div className="brand-subtitle">
              Alarm & Schedule Manager · Offline-ready
            </div>
          </div>
        </div>
        <div className="header-actions">
          <button className="theme-toggle" type="button"
            onClick={() => setTheme(current => current === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <div className="header-stats">
            <span className="stat">
              <i /> {activeCount} Active Alarm{activeCount !== 1 ? 's' : ''}
            </span>
            <span className="stat">
              <FileText size={14} /> {state.notes.length} Saved Notes
            </span>
          </div>
        </div>
      </header>
      <main className="layout">
        <section className="left-column">
          <div className="panel clock-panel">
            <div className="clock-brand">
              {editingAppName ? (
                <form className="app-name-editor" onSubmit={e => { e.preventDefault(); const next = nameDraft.trim().slice(0, 24); if (next) setAppName(next); setEditingAppName(false); }}>
                  <input aria-label="App name" autoFocus value={nameDraft} onChange={e => setNameDraft(e.target.value)} maxLength={24} placeholder="Enter app name" />
                  <button type="submit" aria-label="Save app name"><Check size={16} /></button>
                  <button type="button" aria-label="Cancel app name edit" onClick={() => setEditingAppName(false)}><X size={16} /></button>
                </form>
              ) : (
                <button type="button" className="app-name-button" onClick={() => { setNameDraft(appName); setEditingAppName(true); }} title="Click to change app name" aria-label={`App name: ${appName}. Click to edit`}>
                  {appName} <Edit3 size={15} />
                </button>
              )}
            </div>
            <div className="section-label">
              <Clock3 size={15} /> LIVE TIME{' '}
              <span className="timezone">
                {'ASIA/PHILIPPINES'}
              </span>
            </div>
            <div className="clock-content">
              <div className="analog">
                <div
                  className="hand hour"
                  style={{
                    transform: `translateX(-50%) rotate(${hour * 30 + clock.getMinutes() * 0.5}deg)`,
                  }}
                />
                <div
                  className="hand minute"
                  style={{
                    transform: `translateX(-50%) rotate(${clock.getMinutes() * 6}deg)`,
                  }}
                />
                <div
                  className="hand second"
                  style={{
                    transform: `translateX(-50%) rotate(${clock.getSeconds() * 6}deg)`,
                  }}
                />
                <div className="clock-dot" />
              </div>
              <div className="digital-wrap">
                <div className="digital">
                  {String(hour).padStart(2, '0')}:
                  {String(clock.getMinutes()).padStart(2, '0')}
                  <span>:{String(clock.getSeconds()).padStart(2, '0')}</span>
                  <em>{clock.getHours() >= 12 ? 'PM' : 'AM'}</em>
                </div>
                <div className="date-line">
                  {clock.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
                <div className="progress">
                  <span
                    style={{ width: `${(clock.getSeconds() / 60) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="panel form-panel">
            <div className="panel-heading">
              <h2>
                <CalendarDays size={18} />{' '}
                {editId ? 'Edit Schedule' : 'New Schedule & Alarm'}
              </h2>
              <button className="text-button" onClick={resetForm}>
                <X size={13} /> Reset
              </button>
            </div>
            <form onSubmit={submitSchedule} className="form-stack">
              <label>
                Schedule name / event
                <input
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Morning workout, study time…"
                />
              </label>
              <div className="two-col">
                <label>
                  Alarm time
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={e => setTime(e.target.value)}
                  />
                </label>
                <label>
                  Ringtone
                  <div className="sound-row">
                    <select
                      value={sound}
                      onChange={e => setSound(e.target.value)}
                    >
                      <option value="chime">Soft Poly Chime</option>
                      <option value="digital">Digital Synth Beep</option>
                      <option value="bell">Classic Bell</option>
                      <option value="pulse">Cyber Pulse</option>
                      <option value="zen">Gentle Zen Tone</option>
                      <option value="power-horn">Power Horn (Deep & Loud)</option>
                      <option value="rapid-pulse">Rapid Pulse (Fast & Loud)</option>
                      <option value="triple-klaxon">Triple Klaxon (Urgent)</option>
                    </select>
                    <button
                      type="button"
                      className="preview"
                      onClick={playTone}
                      aria-label="Preview sound"
                    >
                      <Volume2 size={16} />
                    </button>
                  </div>
                </label>
              </div>
              <div>
                <div className="field-heading">
                  <span>Repeat days</span>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setDays(days.length === 7 ? [] : [...DAYS])}
                  >
                    {days.length === 7 ? 'Clear days' : 'Select everyday'}
                  </button>
                </div>
                <div className="days-grid">
                  {DAYS.map(d => (
                    <button
                      type="button"
                      key={d}
                      className={days.includes(d) ? 'day active' : 'day'}
                      onClick={() =>
                        setDays(
                          days.includes(d)
                            ? days.filter(x => x !== d)
                            : [...days, d]
                        )
                      }
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <label>
                Notes / context (optional)
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Extra reminder or instructions…"
                />
              </label>
              <button className="primary-btn" type="submit">
                <Bell size={17} />
                {editId ? 'Update schedule' : 'Save alarm schedule'}
              </button>
            </form>
          </div>
        </section>
        <section className="right-column">          <div className="tabs">
            <button
              className={tab === 'alarms' ? 'tab active' : 'tab'}
              onClick={() => setTab('alarms')}
            >
              <Bell size={16} /> Active Schedules{' '}
              <b>{state.schedules.length}</b>
            </button>
            <button
              className={tab === 'notes' ? 'tab active purple' : 'tab'}
              onClick={() => setTab('notes')}
            >
              <FileText size={16} /> Quick Notepad
            </button>
          </div>
          {!isFirebaseConfigured && (
            <div className="error-banner" role="status">
              Firebase is not configured yet. Alarms can be saved on this device, but cloud sync needs the Firebase setup in FIREBASE_SETUP.md.
            </div>
          )}
          {errorMsg && (
            <div className="error-banner" role="alert">
              {errorMsg}
              <button onClick={() => setErrorMsg('')}>
                <X size={14} />
              </button>
            </div>
          )}
          {saving && <div className="save-status">Saving to database…</div>}
          {loading ? (
            <div className="panel empty">
              <div className="spinner" />
              <p>Loading your schedules…</p>
            </div>
          ) : tab === 'alarms' ? (
            <div className="workspace">
              <div className="toolbar">
                <div className="search-box">
                  <Search size={15} />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search schedules…"
                  />
                </div>
                <button
                  className="text-button danger"
                  onClick={async () => {
                    if (confirm('Delete all schedules?'))
                      await persist({ ...state, schedules: [] });
                  }}
                >
                  <Trash2 size={14} /> Clear all
                </button>
              </div>
              {!filtered.length ? (
                <div className="panel empty">
                  <div className="empty-icon">
                    <Bell size={24} />
                  </div>
                  <h3>No schedules configured</h3>
                  <p>Add a schedule using the form to get started.</p>
                </div>
              ) : (
                filtered.map(s => (
                  <article
                    className={
                      'schedule-card ' + (!s.enabled ? 'disabled' : '')
                    }
                    key={s.id}
                  >
                    <div className="schedule-main">
                      <div className="schedule-time">{time12(s.time)}</div>
                      <div className="schedule-title">{s.title}</div>
                      <div className="day-badges">
                        {DAYS.map(d => (
                          <span
                            key={d}
                            className={s.days.includes(d) ? 'selected' : ''}
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                      {s.notes && <p className="schedule-note">{s.notes}</p>}
                    </div>
                    <div className="card-actions">
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={s.enabled}
                          onChange={() =>
                            persist({
                              ...state,
                              schedules: state.schedules.map(x =>
                                x.id === s.id
                                  ? { ...x, enabled: !x.enabled }
                                  : x
                              ),
                            })
                          }
                        />
                        <span />
                      </label>
                      <button
                        className="icon-btn"
                        title="Edit schedule"
                        onClick={() => editSchedule(s)}
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        className="icon-btn delete"
                        title="Delete schedule"
                        onClick={() => removeSchedule(s.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          ) : (
            <div className="notes-workspace">
              <form className="panel note-form" onSubmit={addNote}>
                <h2>
                  <FileText size={18} /> Quick notes & sticky reminders
                </h2>
                <label>
                  Note title
                  <input
                    value={noteTitle}
                    onChange={e => setNoteTitle(e.target.value)}
                    placeholder="Grocery list, meeting agenda…"
                    required
                  />
                </label>
                <label>
                  Note details
                  <textarea
                    value={noteBody}
                    onChange={e => setNoteBody(e.target.value)}
                    rows={4}
                    placeholder="Write down important notes, links or ideas…"
                    required
                  />
                </label>
                <button className="primary-btn purple-btn" type="submit">
                  <Plus size={17} /> Add quick note
                </button>
              </form>
              {!state.notes.length ? (
                <div className="panel empty">
                  <div className="empty-icon purple-icon">
                    <FileText size={24} />
                  </div>
                  <h3>No saved notes yet</h3>
                  <p>Your notes will appear here and sync to the database.</p>
                </div>
              ) : (
                <div className="notes-grid">
                  {state.notes.map(n => (
                    <article className="note-card" key={n.id}>
                      <div className="note-card-top">
                        <h3>{n.title}</h3>
                        <button
                          className="icon-btn delete"
                          title="Delete note"
                          onClick={() => removeNote(n.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p>{n.body}</p>
                      <small>{n.date}</small>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </main>
      <footer>
        <span>
          <Moon size={13} /> Built for focus. Designed for time.
        </span>
        <span>{saving ? 'Saving…' : isOnline ? 'Online · cloud sync ready' : 'Offline · saved on device'}</span>
      </footer>
      {ringing && (
        <div className="modal-backdrop">
          <div className="alarm-modal">
            <div className="ring-icon">
              <BellRing size={34} />
            </div>
            <div className="eyebrow">ALARM IS RINGING</div>
            <h2>{ringing.title}</h2>
            <div className="ring-time">{time12(ringing.time)}</div>
            <p>{ringing.notes || 'Time to check your schedule.'}</p>
            <div className="modal-actions">
              <button
                className="secondary-btn"
                onClick={() => {
                  setRinging(null);                  setSnoozeAt(Date.now() + 5 * 60 * 1000);
                }}
              >
                Snooze 5m
              </button>
              <button className="primary-btn" onClick={() => setRinging(null)}>
                <Check size={16} /> Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
