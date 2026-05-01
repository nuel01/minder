const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function token() {
  return localStorage.getItem('token')
}

async function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  if (token()) headers['Authorization'] = `Bearer ${token()}`
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const api = {
  // Auth
  login: (email, password) => {
    const form = new URLSearchParams({ username: email, password })
    return fetch(`${BASE}/auth/login`, { method: 'POST', body: form })
      .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(new Error(e.detail))))
  },

  // Departments
  getDepartments:    ()         => req('GET',    '/departments'),
  createDepartment:  (body)     => req('POST',   '/departments', body),
  deleteDepartment:  (id)       => req('DELETE', `/departments/${id}`),

  // Sub-departments
  getSubDepartments: (deptId)   => req('GET',    `/sub-departments${deptId ? `?department_id=${deptId}` : ''}`),
  createSubDept:     (body)     => req('POST',   '/sub-departments', body),
  deleteSubDept:     (id)       => req('DELETE', `/sub-departments/${id}`),

  // Workers
  getWorkers:     (deptId)      => req('GET',    `/workers${deptId ? `?department_id=${deptId}` : ''}`),
  getWorker:      (id)          => req('GET',    `/workers/${id}`),
  createWorker:   (body)        => req('POST',   '/workers', body),
  updateWorker:   (id, body)    => req('PATCH',  `/workers/${id}`, body),
  deleteWorker:   (id)          => req('DELETE', `/workers/${id}`),

  // Events
  getEvents:      ()            => req('GET',    '/events'),
  getEvent:       (id)          => req('GET',    `/events/${id}`),
  createEvent:    (body)        => req('POST',   '/events', body),
  updateEvent:    (id, body)    => req('PATCH',  `/events/${id}`, body),
  deleteEvent:    (id)          => req('DELETE', `/events/${id}`),
  setTargets:     (id, targets) => req('POST',   `/events/${id}/targets`, targets),

  // Notifications
  getNotifications: (filters = {}) => {
    const q = new URLSearchParams(filters).toString()
    return req('GET', `/notifications${q ? `?${q}` : ''}`)
  },
}
