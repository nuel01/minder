import { useState, useEffect } from 'react'
import { api } from '../api'

const POSITIONS_MAP = {
  Pastorals: ['Pastoral Lead', 'Campus Pastor'],
  default:   ['Coordinator', 'Assistant Coordinator', 'Member'],
}

function Modal({ worker, departments, subDepts, onClose, onSave }) {
  const [form, setForm] = useState(worker || {
    name: '', email: '', phone: '', department_id: '',
    sub_department_id: '', position: '', small_group: false, active: true,
  })
  const [saving, setSaving] = useState(false)

  const selectedDept = departments.find(d => d.id === form.department_id)
  const deptName     = selectedDept?.name || ''
  const positions    = POSITIONS_MAP[deptName] || POSITIONS_MAP.default
  const filteredSubs = subDepts.filter(s => s.department_id === form.department_id)

  function set(k, v) {
    setForm(f => ({
      ...f, [k]: v,
      ...(k === 'department_id' ? { sub_department_id: '', position: '' } : {}),
    }))
  }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <h3>{worker ? 'Edit Worker' : 'Add Worker'}</h3>
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field span2">
              <label>Full Name</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="field">
              <label>Phone</label>
              <input value={form.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="+234..." />
            </div>
            <div className="field">
              <label>Department</label>
              <select value={form.department_id} onChange={e => set('department_id', e.target.value)} required>
                <option value="">Select…</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Sub-department</label>
              <select value={form.sub_department_id || ''} onChange={e => set('sub_department_id', e.target.value)}
                disabled={filteredSubs.length === 0}>
                <option value="">None</option>
                {filteredSubs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Position</label>
              <select value={form.position || ''} onChange={e => set('position', e.target.value)} required>
                <option value="">Select…</option>
                {positions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 20 }}>
              <input type="checkbox" id="sg" checked={form.small_group}
                onChange={e => set('small_group', e.target.checked)} style={{ width: 16, height: 16 }} />
              <label htmlFor="sg" style={{ textTransform: 'none', fontSize: 13, letterSpacing: 0 }}>
                In a small group
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Worker'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Workers() {
  const [workers, setWorkers]       = useState([])
  const [departments, setDepts]     = useState([])
  const [subDepts, setSubDepts]     = useState([])
  const [filterDept, setFilterDept] = useState('')
  const [modal, setModal]           = useState(null) // null | 'add' | worker object
  const [loading, setLoading]       = useState(true)

  async function load() {
    setLoading(true)
    const [w, d, s] = await Promise.all([
      api.getWorkers(filterDept || undefined),
      api.getDepartments(),
      api.getSubDepartments(),
    ])
    setWorkers(w); setDepts(d); setSubDepts(s)
    setLoading(false)
  }

  useEffect(() => { load() }, [filterDept])

  async function save(form) {
    if (modal && modal.id) {
      await api.updateWorker(modal.id, form)
    } else {
      await api.createWorker(form)
    }
    load()
  }

  async function remove(id) {
    if (!confirm('Remove this worker?')) return
    await api.deleteWorker(id)
    load()
  }

  function deptName(id) {
    return departments.find(d => d.id === id)?.name || '—'
  }

  return (
    <div>
      <div className="page-header">
        <h1>Workers</h1>
        <button className="btn btn-primary" onClick={() => setModal('add')}>+ Add Worker</button>
      </div>

      {/* Filter */}
      <div style={{ marginBottom: 16 }}>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8,
                   background: 'var(--surface)', fontSize: 13 }}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      <div className="card table-wrap">
        {loading ? (
          <div className="empty">Loading…</div>
        ) : workers.length === 0 ? (
          <div className="empty">No workers found</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Department</th><th>Position</th>
                <th>Phone</th><th>Email</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {workers.map(w => (
                <tr key={w.id}>
                  <td style={{ fontWeight: 500 }}>{w.name}</td>
                  <td>{deptName(w.department_id)}</td>
                  <td>{w.position || '—'}</td>
                  <td style={{ color: 'var(--ink2)' }}>{w.phone || '—'}</td>
                  <td style={{ color: 'var(--ink2)' }}>{w.email || '—'}</td>
                  <td>
                    <span className={`badge ${w.active ? 'badge-green' : 'badge-gray'}`}>
                      {w.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setModal(w)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(w.id)}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal
          worker={modal === 'add' ? null : modal}
          departments={departments}
          subDepts={subDepts}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </div>
  )
}
