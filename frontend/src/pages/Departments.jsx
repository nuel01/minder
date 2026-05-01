import { useState, useEffect } from 'react'
import { api } from '../api'

export default function Departments() {
  const [depts, setDepts]   = useState([])
  const [subs, setSubs]     = useState([])
  const [newDept, setNewDept] = useState('')
  const [newSub, setNewSub]   = useState({ name: '', department_id: '' })
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [d, s] = await Promise.all([api.getDepartments(), api.getSubDepartments()])
    setDepts(d); setSubs(s)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addDept(e) {
    e.preventDefault()
    if (!newDept.trim()) return
    await api.createDepartment({ name: newDept.trim() })
    setNewDept('')
    load()
  }

  async function addSub(e) {
    e.preventDefault()
    if (!newSub.name.trim() || !newSub.department_id) return
    await api.createSubDept(newSub)
    setNewSub({ name: '', department_id: '' })
    load()
  }

  async function delDept(id) {
    if (!confirm('Delete this department? All linked workers will lose their department.')) return
    await api.deleteDepartment(id)
    load()
  }

  async function delSub(id) {
    if (!confirm('Delete this sub-department?')) return
    await api.deleteSubDept(id)
    load()
  }

  return (
    <div>
      <div className="page-header"><h1>Departments</h1></div>

      {loading ? <div className="empty">Loading…</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

          {/* Departments */}
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 14 }}>Departments</h3>
              </div>
              {depts.length === 0
                ? <div className="empty">None yet</div>
                : depts.map(d => (
                  <div key={d.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '11px 18px', borderBottom: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: 13.5 }}>{d.name}</span>
                    <button className="btn btn-danger btn-sm" onClick={() => delDept(d.id)}>Remove</button>
                  </div>
                ))
              }
            </div>

            {/* Add department */}
            <form onSubmit={addDept} style={{ display: 'flex', gap: 8 }}>
              <input value={newDept} onChange={e => setNewDept(e.target.value)}
                placeholder="New department name"
                style={{ flex: 1, padding: '9px 12px', border: '1px solid var(--border)',
                         borderRadius: 8, fontSize: 13 }} />
              <button type="submit" className="btn btn-primary">Add</button>
            </form>
          </div>

          {/* Sub-departments */}
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 14 }}>Sub-departments</h3>
              </div>
              {subs.length === 0
                ? <div className="empty">None yet</div>
                : subs.map(s => (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '11px 18px', borderBottom: '1px solid var(--border)',
                  }}>
                    <div>
                      <span style={{ fontSize: 13.5 }}>{s.name}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--ink3)', marginLeft: 8 }}>
                        {depts.find(d => d.id === s.department_id)?.name || ''}
                      </span>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={() => delSub(s.id)}>Remove</button>
                  </div>
                ))
              }
            </div>

            {/* Add sub-department */}
            <form onSubmit={addSub} style={{ display: 'flex', gap: 8 }}>
              <select value={newSub.department_id}
                onChange={e => setNewSub(f => ({...f, department_id: e.target.value}))}
                style={{ padding: '9px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                <option value="">Department…</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <input value={newSub.name} onChange={e => setNewSub(f => ({...f, name: e.target.value}))}
                placeholder="Sub-dept name" style={{ flex: 1, padding: '9px 12px',
                  border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
              <button type="submit" className="btn btn-primary">Add</button>
            </form>
          </div>

        </div>
      )}
    </div>
  )
}
