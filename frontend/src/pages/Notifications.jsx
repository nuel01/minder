import { useState, useEffect } from 'react'
import { api } from '../api'
import dayjs from 'dayjs'

const STATUS_BADGE = {
  pending: 'badge-gold',
  sent:    'badge-green',
  failed:  'badge-red',
}

const CHANNEL_LABEL = {
  email:    '✉ Email',
  sms:      '✆ SMS',
  whatsapp: '◎ WhatsApp',
  in_app:   '⬡ In-app',
}

export default function Notifications() {
  const [notifs, setNotifs]   = useState([])
  const [status, setStatus]   = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const filters = {}
    if (status) filters.status = status
    const data = await api.getNotifications(filters)
    setNotifs(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [status])

  const counts = {
    all:     notifs.length,
    pending: notifs.filter(n => n.status === 'pending').length,
    sent:    notifs.filter(n => n.status === 'sent').length,
    failed:  notifs.filter(n => n.status === 'failed').length,
  }

  return (
    <div>
      <div className="page-header">
        <h1>Notification History</h1>
        <button className="btn btn-ghost" onClick={load}>↻ Refresh</button>
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {[
          { key: '', label: 'All',     count: counts.all,     cls: 'badge-gray' },
          { key: 'pending', label: 'Pending', count: counts.pending, cls: 'badge-gold' },
          { key: 'sent',    label: 'Sent',    count: counts.sent,    cls: 'badge-green' },
          { key: 'failed',  label: 'Failed',  count: counts.failed,  cls: 'badge-red' },
        ].map(({ key, label, count, cls }) => (
          <button key={key} onClick={() => setStatus(key)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: status === key ? '2px solid var(--ink)' : '1px solid var(--border)',
              background: 'var(--surface)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: status === key ? 500 : 400,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            {label}
            <span className={`badge ${cls}`} style={{ padding: '1px 7px' }}>{count}</span>
          </button>
        ))}
      </div>

      <div className="card table-wrap">
        {loading ? (
          <div className="empty">Loading…</div>
        ) : notifs.length === 0 ? (
          <div className="empty">No notifications found</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Worker</th><th>Event</th><th>Channel</th>
                <th>Scheduled</th><th>Sent</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {notifs.map(n => (
                <tr key={n.id}>
                  <td style={{ fontWeight: 500 }}>{n.workers?.name || '—'}</td>
                  <td style={{ color: 'var(--ink2)' }}>{n.events?.title || '—'}</td>
                  <td>
                    <span className="badge badge-blue" style={{ fontSize: 11 }}>
                      {CHANNEL_LABEL[n.channel] || n.channel}
                    </span>
                  </td>
                  <td style={{ color: 'var(--ink2)', fontSize: 12.5 }}>
                    {dayjs(n.scheduled_time).format('D MMM, h:mm A')}
                  </td>
                  <td style={{ color: 'var(--ink2)', fontSize: 12.5 }}>
                    {n.sent_at ? dayjs(n.sent_at).format('D MMM, h:mm A') : '—'}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[n.status] || 'badge-gray'}`}>
                      {n.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
