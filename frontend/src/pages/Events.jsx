import { useState, useEffect } from 'react'
import { api } from '../api'
import dayjs from 'dayjs'

function TargetRow({ index, target, departments, subDepts, onChange, onRemove }) {
  const filteredSubs = subDepts.filter(s => s.department_id === target.department_id)
  const deptName = departments.find(d => d.id === target.department_id)?.name || ''
  const isPastoral = deptName === 'Pastorals'
  const positions = isPastoral
    ? ['Pastoral Lead', 'Campus Pastor']
    : ['Coordinator', 'Assistant Coordinator', 'Member']

  function set(k, v) {
    onChange(index, {
      ...target, [k]: v,
      ...(k === 'department_id' ? { sub_department_id: null, position: null } : {}),
    })
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto',
      gap: 10, alignItems: 'end',
      padding: '12px 14px',
      background: 'var(--bg)',
      borderRadius: 8,
      marginBottom: 8,
    }}>
      <div className="field">
        <label>Department</label>
        <select value={target.department_id || ''} onChange={e => set('department_id', e.target.value)}>
          <option value="">All</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Sub-dept</label>
        <select value={target.sub_department_id || ''} onChange={e => set('sub_department_id', e.target.value || null)}
          disabled={filteredSubs.length === 0}>
          <option value="">All</option>
          {filteredSubs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Position</label>
        <select value={target.position || ''} onChange={e => set('position', e.target.value || null)}>
          <option value="">All</option>
          {positions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <button type="button" onClick={() => onRemove(index)}
        style={{ padding: '9px 10px', background: 'var(--red-lt)', color: 'var(--red)',
                 border: 'none', borderRadius: 8, cursor: 'pointer', marginBottom: 1 }}>
        ✕
      </button>
    </div>
  )
}

function EventModal({ event, departments, subDepts, onClose, onSave }) {
  const [form, setForm] = useState({
    title:       event?.title || '',
    description: event?.description || '',
    venue:       event?.venue || '',
    event_time:  event?.event_time
      ? dayjs(event.event_time).format('YYYY-MM-DDTHH:mm')
      : '',
  })
  const [reminderOffsets, setReminderOffsets] = useState(
    event?.reminder_offsets
      ? event.reminder_offsets.join(', ')
      : '1440, 360, 15'
  )
  const [targets, setTargets] = useState(event?.targets || [])
  const [saving, setSaving]   = useState(false)

  function addTarget() {
    setTargets(t => [...t, { department_id: null, sub_department_id: null, position: null, small_group_only: false }])
  }

  function updateTarget(i, val) {
    setTargets(t => t.map((x, idx) => idx === i ? val : x))
  }

  function removeTarget(i) {
    setTargets(t => t.filter((_, idx) => idx !== i))
  }

  async function submit(e) {
    e.preventDefault()
    if (targets.length === 0) {
      alert('Add at least one notification target.')
      return
    }
    const offsets = reminderOffsets
      .split(',')
      .map(s => parseInt(s.trim()))
      .filter(n => !isNaN(n) && n > 0)
    if (offsets.length === 0) {
      alert('Enter at least one valid reminder time (in minutes).')
      return
    }
    setSaving(true)
    try {
      await onSave({ ...form, reminder_offsets: offsets }, targets)
      onClose()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 620, maxHeight: '90vh', overflow: 'auto' }}>
        <h3>{event ? 'Edit Event' : 'New Event'}</h3>
        <form onSubmit={submit}>
          <div className="form-grid" style={{ marginBottom: 20 }}>
            <div className="field span2">
              <label>Event Title</label>
              <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} required />
            </div>
            <div className="field">
              <label>Date & Time</label>
              <input type="datetime-local" value={form.event_time}
                onChange={e => setForm(f => ({...f, event_time: e.target.value}))} required />
            </div>
            <div className="field">
              <label>Venue</label>
              <input value={form.venue} onChange={e => setForm(f => ({...f, venue: e.target.value}))} required />
            </div>
            <div className="field span2">
              <label>Description</label>
              <textarea rows={2} value={form.description || ''}
                onChange={e => setForm(f => ({...f, description: e.target.value}))}
                style={{ resize: 'vertical' }} />
            </div>
            <div className="field span2">
              <label>Reminder Times (minutes before event)</label>
              <input
                value={reminderOffsets}
                onChange={e => setReminderOffsets(e.target.value)}
                placeholder="e.g. 1440, 360, 15"
              />
              <span style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 3 }}>
                Comma-separated. 1440 = 24hrs, 360 = 6hrs, 60 = 1hr, 15 = 15min.
              </span>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18, marginBottom: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13 }}>Who should be notified?</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink2)', marginTop: 2 }}>
                  Leave a field blank to mean "all". Workers matching any row will be notified.
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={addTarget}>+ Add rule</button>
            </div>
            {targets.map((t, i) => (
              <TargetRow key={i} index={i} target={t}
                departments={departments} subDepts={subDepts}
                onChange={updateTarget} onRemove={removeTarget} />
            ))}
            {targets.length === 0 && (
              <div style={{ textAlign: 'center', padding: '16px', color: 'var(--ink3)', fontSize: 12 }}>
                No rules yet — click "+ Add rule"
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save & Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Events() {
  const [events, setEvents]     = useState([])
  const [departments, setDepts] = useState([])
  const [subDepts, setSubs]     = useState([])
  const [modal, setModal]       = useState(null)
  const [loading, setLoading]   = useState(true)

  async function load() {
    setLoading(true)
    const [ev, d, s] = await Promise.all([
      api.getEvents(),
      api.getDepartments(),
      api.getSubDepartments(),
    ])
    setEvents(ev); setDepts(d); setSubs(s)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function openEdit(event) {
    const full = await api.getEvent(event.id)
    setModal(full)
  }

  async function save(form, targets) {
    let eventId
    if (modal && modal.id) {
      await api.updateEvent(modal.id, form)
      eventId = modal.id
    } else {
      const created = await api.createEvent(form)
      eventId = created.id
    }
    await api.setTargets(eventId, targets)
    load()
  }

  async function sendNow(id, title) {
    if (!confirm(`Send instant notifications for "${title}" now?`)) return
    try {
      const res = await api.sendNow(id)
      alert(res.message)
    } catch (err) {
      alert(err.message)
    }
  }

  async function remove(id) {
    if (!confirm('Delete this event and all its notifications?')) return
    await api.deleteEvent(id)
    load()
  }

  const now      = dayjs()
  const upcoming = events.filter(e => dayjs(e.event_time).isAfter(now))
  const past     = events.filter(e => !dayjs(e.event_time).isAfter(now))

  function EventTable({ items }) {
    if (items.length === 0) return <div className="empty">None</div>
    return (
      <table>
        <thead>
          <tr><th>Title</th><th>Date & Time</th><th>Venue</th><th></th></tr>
        </thead>
        <tbody>
          {items.map(e => (
            <tr key={e.id}>
              <td style={{ fontWeight: 500 }}>{e.title}</td>
              <td style={{ color: 'var(--ink2)' }}>{dayjs(e.event_time).format('D MMM YYYY, h:mm A')}</td>
              <td style={{ color: 'var(--ink2)' }}>{e.venue}</td>
              <td>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(e)}>Edit</button>
                  <button className="btn btn-primary btn-sm" onClick={() => sendNow(e.id, e.title)}>Send Now</button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(e.id)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1>Events</h1>
        <button className="btn btn-primary" onClick={() => setModal('new')}>+ New Event</button>
      </div>

      {loading ? <div className="empty">Loading…</div> : (
        <>
          <div style={{ marginBottom: 8, fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 12,
                        textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink2)', marginTop: 4 }}>
            Upcoming
          </div>
          <div className="card table-wrap" style={{ marginBottom: 28 }}>
            <EventTable items={upcoming} />
          </div>

          <div style={{ marginBottom: 8, fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 12,
                        textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink3)' }}>
            Past
          </div>
          <div className="card table-wrap">
            <EventTable items={past} />
          </div>
        </>
      )}

      {modal && (
        <EventModal
          event={modal === 'new' ? null : modal}
          departments={departments}
          subDepts={subDepts}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </div>
  )
}
