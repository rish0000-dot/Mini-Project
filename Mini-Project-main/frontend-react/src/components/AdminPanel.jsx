import React, { useEffect, useMemo, useState } from 'react'
import { supabaseClient } from '../utils/supabase'

const LISTED_HOSPITALS_200M_TO_50KM = 134

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@500;600;700&family=DM+Sans:wght@400;500;700&display=swap');
.a-shell{min-height:100vh;background:#081424;color:#e9f4ff;font-family:'DM Sans',sans-serif;padding:22px;}
.a-card{background:rgba(16,28,46,.86);border:1px solid rgba(255,255,255,.08);border-radius:16px;}
.a-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px;}
.a-title{font-family:'Syne',sans-serif;font-size:24px;font-weight:700;}
.a-sub{font-size:13px;color:#8ca5c2;margin-top:4px;}
.a-logout{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.02);color:#cfe2ff;border-radius:10px;padding:9px 14px;cursor:pointer;}
.a-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;padding:0 20px 20px;}
.a-kpi{padding:14px;border-radius:12px;background:rgba(10,21,36,.8);border:1px solid rgba(255,255,255,.08);}
.a-kpi-lbl{font-size:11px;color:#7e98b8;text-transform:uppercase;letter-spacing:.5px;}
.a-kpi-val{font-family:'Syne',sans-serif;font-size:28px;margin-top:6px;}
.a-main{margin-top:14px;padding:16px;}
.a-filter{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;}
.a-fbtn{height:34px;padding:0 12px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.02);color:#c4d8f2;cursor:pointer;}
.a-fbtn.active{background:rgba(12,184,160,.16);border-color:rgba(12,184,160,.45);color:#30d8bd;}
.a-error{padding:10px 12px;border:1px solid rgba(240,82,82,.35);background:rgba(240,82,82,.12);color:#ffadad;border-radius:10px;margin-bottom:12px;font-size:13px;}
.a-table{width:100%;border-collapse:collapse;}
.a-table th,.a-table td{padding:12px 10px;border-bottom:1px solid rgba(255,255,255,.07);text-align:left;vertical-align:middle;}
.a-table th{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#7f9dbf;font-weight:700;}
.a-name{display:flex;align-items:center;gap:10px;min-width:180px;}
.a-avatar{width:34px;height:34px;border-radius:50%;object-fit:cover;border:1px solid rgba(12,184,160,.5);}
.a-avatar-fallback{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(12,184,160,.16);color:#27d7ba;font-size:12px;font-weight:700;}
.a-doc-name{font-size:14px;font-weight:600;color:#e9f4ff;}
.a-doc-meta{font-size:12px;color:#89a6c9;}
.a-badge{display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;border:1px solid;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;}
.a-badge.pending{background:rgba(240,165,0,.12);color:#f0a500;border-color:rgba(240,165,0,.3);}
.a-badge.verified{background:rgba(12,184,160,.12);color:#0cb8a0;border-color:rgba(12,184,160,.35);}
.a-badge.rejected{background:rgba(240,82,82,.12);color:#f05252;border-color:rgba(240,82,82,.35);}
.a-actions{display:flex;gap:8px;}
.a-btn{height:32px;padding:0 10px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.02);color:#c8def8;cursor:pointer;font-size:12px;}
.a-btn.approve{border-color:rgba(12,184,160,.45);color:#0cb8a0;background:rgba(12,184,160,.1);}
.a-btn.reject{border-color:rgba(240,82,82,.45);color:#f05252;background:rgba(240,82,82,.1);}
.a-btn:disabled{opacity:.55;cursor:not-allowed;}
.a-empty{padding:20px;text-align:center;color:#8ca5c2;}
@media(max-width:1200px){.a-metrics{grid-template-columns:repeat(3,minmax(0,1fr));}}
@media(max-width:1000px){.a-metrics{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media(max-width:700px){.a-shell{padding:14px;}.a-metrics{grid-template-columns:1fr;}.a-table{display:block;overflow:auto;}}
`

function initials(name = '') {
  return name.split(' ').slice(0, 2).map((word) => word[0]?.toUpperCase() || '').join('') || 'DR'
}

function formatStatus(status) {
  return String(status || 'pending').toLowerCase()
}

export default function AdminPanel({ currentUser, onLogout }) {
  const [filter, setFilter] = useState('pending')
  const [doctors, setDoctors] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [actioningDoctorId, setActioningDoctorId] = useState('')

  const loadDoctors = async (nextFilter = filter) => {
    setIsLoading(true)
    setError('')
    try {
      let query = supabaseClient
        .from('profiles')
        .select('id,name,avatar_url,hospital_name,specialization,qualification,experience_years,license_number,verification_status,doctor_profile_completed,updated_at')
        .eq('role', 'doctor')
        .order('updated_at', { ascending: false })

      if (nextFilter !== 'all') {
        query = query.eq('verification_status', nextFilter)
      }

      const { data, error: loadError } = await query
      if (loadError) throw loadError
      setDoctors(data || [])
    } catch (loadErr) {
      setError(loadErr?.message || 'Failed to load doctors')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDoctors(filter)
  }, [filter])

  const metrics = useMemo(() => {
    const pending = doctors.filter((item) => formatStatus(item.verification_status) === 'pending').length
    const verified = doctors.filter((item) => formatStatus(item.verification_status) === 'verified').length
    const rejected = doctors.filter((item) => formatStatus(item.verification_status) === 'rejected').length
    return {
      total: doctors.length,
      pending,
      verified,
      rejected,
    }
  }, [doctors])

  const handleUpdateStatus = async (doctorId, status) => {
    setActioningDoctorId(doctorId)
    setError('')
    try {
      const note = status === 'rejected' ? window.prompt('Reject reason (optional):', '') || null : null
      const { error: rpcError } = await supabaseClient.rpc('admin_update_doctor_verification', {
        p_doctor_id: doctorId,
        p_status: status,
        p_note: note,
      })
      if (rpcError) throw rpcError
      await loadDoctors(filter)
    } catch (updateErr) {
      setError(updateErr?.message || 'Failed to update verification status')
    } finally {
      setActioningDoctorId('')
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div className="a-shell">
        <div className="a-card">
          <div className="a-top">
            <div>
              <div className="a-title">Admin Approval Panel</div>
              <div className="a-sub">Review doctor profiles and manage verification workflow</div>
            </div>
            <button type="button" className="a-logout" onClick={onLogout}>Logout</button>
          </div>

          <div className="a-metrics">
            <div className="a-kpi"><div className="a-kpi-lbl">Hospitals (200m - 50km)</div><div className="a-kpi-val">{LISTED_HOSPITALS_200M_TO_50KM}</div></div>
            <div className="a-kpi"><div className="a-kpi-lbl">Total Listed</div><div className="a-kpi-val">{metrics.total}</div></div>
            <div className="a-kpi"><div className="a-kpi-lbl">Pending</div><div className="a-kpi-val">{metrics.pending}</div></div>
            <div className="a-kpi"><div className="a-kpi-lbl">Verified</div><div className="a-kpi-val">{metrics.verified}</div></div>
            <div className="a-kpi"><div className="a-kpi-lbl">Rejected</div><div className="a-kpi-val">{metrics.rejected}</div></div>
          </div>
        </div>

        <div className="a-card a-main">
          <div className="a-filter">
            {['pending', 'verified', 'rejected', 'all'].map((item) => (
              <button
                key={item}
                type="button"
                className={`a-fbtn ${filter === item ? 'active' : ''}`}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>

          {error && <div className="a-error">{error}</div>}

          <table className="a-table">
            <thead>
              <tr>
                <th>Doctor</th>
                <th>Hospital</th>
                <th>Specialization</th>
                <th>License</th>
                <th>Experience</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {!isLoading && doctors.length === 0 && (
                <tr>
                  <td colSpan={7}><div className="a-empty">No doctor records found for selected filter.</div></td>
                </tr>
              )}

              {doctors.map((doctor) => {
                const status = formatStatus(doctor.verification_status)
                const busy = actioningDoctorId === doctor.id

                return (
                  <tr key={doctor.id}>
                    <td>
                      <div className="a-name">
                        {doctor.avatar_url ? (
                          <img src={doctor.avatar_url} alt="Doctor avatar" className="a-avatar" />
                        ) : (
                          <div className="a-avatar-fallback">{initials(doctor.name)}</div>
                        )}
                        <div>
                          <div className="a-doc-name">{doctor.name || 'Doctor'}</div>
                          <div className="a-doc-meta">{doctor.qualification || 'Qualification not set'}</div>
                        </div>
                      </div>
                    </td>
                    <td>{doctor.hospital_name || '-'}</td>
                    <td>{doctor.specialization || '-'}</td>
                    <td>{doctor.license_number || '-'}</td>
                    <td>{doctor.experience_years != null ? `${doctor.experience_years} years` : '-'}</td>
                    <td><span className={`a-badge ${status}`}>{status}</span></td>
                    <td>
                      <div className="a-actions">
                        <button
                          type="button"
                          className="a-btn approve"
                          onClick={() => handleUpdateStatus(doctor.id, 'verified')}
                          disabled={busy || status === 'verified'}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="a-btn reject"
                          onClick={() => handleUpdateStatus(doctor.id, 'rejected')}
                          disabled={busy || status === 'rejected'}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
