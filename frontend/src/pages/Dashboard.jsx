import { useState, useEffect } from 'react'
import { api } from '../api'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
dayjs.extend(relativeTime)

export default function Dashboard() {
  const [events, setEvents]   = useState([])
  const [workers, setWorkers] = useState([])
  const [notifs, setNotifs]   = useState([])

  useEffect(() => {
    api.getEvents().then(setEvents).catch(() => {})
    api.getWorkers().then(setWorkers).catch(() => {})
    api.getNotifications({ status: 'pending' }).then(setNotifs).catch(() => {})
  }, [])

  const upcoming = events
    .filter(e => dayjs(e.event_time).isAfter(dayjs()))
    .sort((a, b) => new Date(a.event_time) - new Date(b.event_time))
    .slice(0, 5)

  const stats = [
    { label: 'Active Workers',       value: workers.filter(w => w.active).length, color: 'var(--green)' },
    { label: 'Upcoming Events',      value: upcoming.length,                       color: 'var(--gold)' },
    { label: 'Pending Notifications',value: notifs.length,                         color: 'var(--blue)' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p style={{ color: 'var(--ink2)', fontSize: 13, marginTop: 2 }}>
            {dayjs().format('dddd, D MMMM YYYY')}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {stats.map(s => (
          <div key={s.label} className="card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 32, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: s.color }}>
              {s.value}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink2)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Upcoming events */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14 }}>Upcoming Events</h3>
        </div>
        {upcoming.length === 0 ? (
          <div className="empty">No upcoming events</div>
        ) : (
          <div>
            {upcoming.map(e => (
              <div key={e.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '13px 20px',
                borderBottom: '1px solid var(--border)',
              }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13.5 }}>{e.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 2 }}>
                    {e.venue}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12.5, color: 'var(--ink2)' }}>
                    {dayjs(e.event_time).format('D MMM, h:mm A')}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 2 }}>
                    {dayjs(e.event_time).fromNow()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
