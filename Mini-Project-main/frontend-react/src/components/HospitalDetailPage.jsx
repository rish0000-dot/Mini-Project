import React, { useEffect, useMemo, useRef, useState } from 'react'
import { APPOINTMENT_TIME_SLOTS, buildHospitalDetail, getDefaultAppointmentForm } from '../utils/hospitalDetails'

function HospitalDetailPage({
  hospital,
  appointmentContext,
  onBack,
  onBookAppointment,
  onViewHistory,
}) {
  const detail = useMemo(() => {
    const hasPrebuiltDetail =
      hospital &&
      Array.isArray(hospital.doctors) &&
      Array.isArray(hospital.services) &&
      Array.isArray(hospital.facilities)

    return hasPrebuiltDetail ? hospital : buildHospitalDetail(hospital)
  }, [hospital])
  const [form, setForm] = useState(() => getDefaultAppointmentForm(detail))
  const bookingPanelRef = useRef(null)

  const isQuickServiceBooking = appointmentContext?.mode === 'service-quick'
  const prefilledService = String(appointmentContext?.serviceName || '').trim()
  const prefilledEmail = String(appointmentContext?.email || '').trim()

  useEffect(() => {
    const base = getDefaultAppointmentForm(detail)
    const nextService = prefilledService || base.service || base.specialty

    setForm({
      ...base,
      email: prefilledEmail || base.email || '',
      service: nextService,
      specialty: nextService || base.specialty,
      notes: isQuickServiceBooking ? `Service request: ${nextService}` : base.notes,
    })
  }, [detail.id, prefilledEmail, prefilledService, isQuickServiceBooking])

  useEffect(() => {
    if (appointmentContext?.intent !== 'book' || !bookingPanelRef.current) return
    bookingPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [appointmentContext?.intent, detail.id])

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const normalizedService = String(form.service || form.specialty || '').trim()

    onBookAppointment({
      detail,
      form: {
        ...form,
        specialty: normalizedService || form.specialty,
        notes: form.notes || (normalizedService ? `Service request: ${normalizedService}` : ''),
      },
    })
  }

  const topDoctors = detail.doctors.slice(0, 4)

  return (
    <div className="dash-page active-page hospital-detail-page">
      <button className="back-btn-dark" onClick={onBack}>← Back to Search</button>

      <div className="hospital-detail-shell">
        <section className="hospital-card-dark hospital-detail-hero">
          <div className="h-top">
            <div className="h-icon-box">🏥</div>
            <div className="h-rating">{detail.rating}</div>
          </div>

          <div className="detail-hero-grid">
            <div>
              <h2 className="detail-title">{detail.name}</h2>
              <p className="detail-subtitle">{detail.type}</p>
              <p className="h-address detail-address">{detail.address}</p>
              <p className="detail-summary">{detail.summary}</p>

              <div className="detail-badges">
                <span className="h-tag">{detail.source}</span>
                <span className="h-tag">{detail.distanceText}</span>
                <span className="h-tag">{detail.hours}</span>
                <span className="h-tag">{detail.totalServices} services</span>
              </div>
            </div>

            <div className="detail-metrics">
              <div className="metric-card">
                <span>Services</span>
                <strong>{detail.totalServices}</strong>
              </div>
              <div className="metric-card">
                <span>Doctors</span>
                <strong>{detail.doctors.length}</strong>
              </div>
              <div className="metric-card">
                <span>Staff</span>
                <strong>{detail.staffCount}</strong>
              </div>
              <div className="metric-card">
                <span>Beds</span>
                <strong>{detail.bedCount}</strong>
              </div>
            </div>
          </div>

          <div className="detail-hero-actions">
            <button className="h-dir-btn" onClick={onViewHistory}>View Appointments</button>
            {detail.contact.phone ? (
              <a className="h-dir-btn" href={`tel:${detail.contact.phone}`}>Call Hospital</a>
            ) : (
              <span className="h-dir-btn h-dir-btn-static">Call desk available at reception</span>
            )}
          </div>
        </section>

        <div className="hospital-detail-grid">
          <section className="hospital-card-dark detail-panel">
            <div className="h-top">
              <div className="h-icon-box">🩺</div>
              <div className="h-rating">Services</div>
            </div>
            <h3>Available services</h3>
            <div className="detail-pill-grid">
              {detail.services.map((service) => (
                <div key={service.name} className="detail-pill">
                  <strong>{service.name}</strong>
                  <span>{service.note}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="hospital-card-dark detail-panel">
            <div className="h-top">
              <div className="h-icon-box">👨‍⚕️</div>
              <div className="h-rating">Doctors</div>
            </div>
            <h3>Medical team</h3>
            <div className="detail-list">
              {topDoctors.map((doctor) => (
                <div key={doctor.name} className="doctor-card">
                  <div>
                    <strong>{doctor.name}</strong>
                    <p>{doctor.specialty}</p>
                  </div>
                  <div className="doctor-meta">
                    <span>{doctor.degree}</span>
                    <span>{doctor.experience}</span>
                    <span>{doctor.shift}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="hospital-card-dark detail-panel">
            <div className="h-top">
              <div className="h-icon-box">🏢</div>
              <div className="h-rating">Facilities</div>
            </div>
            <h3>Facilities and support</h3>
            <div className="facility-grid">
              {detail.facilities.map((facility) => (
                <div key={facility} className="facility-card">
                  {facility}
                </div>
              ))}
            </div>
            <div className="detail-note-box">
              <strong>Care level</strong>
              <span>{detail.emergencyAvailable ? 'Emergency response enabled' : 'Standard care and referral support'}</span>
              <span>{detail.wheelchairAccess ? 'Wheelchair friendly access' : 'Assistive access available on request'}</span>
            </div>
          </section>

          <section ref={bookingPanelRef} className="hospital-card-dark detail-panel detail-booking-panel">
            <div className="h-top">
              <div className="h-icon-box">📅</div>
              <div className="h-rating">Book</div>
            </div>
            <h3>Book an appointment</h3>
            <p className="detail-booking-text">
              Reserve a slot with the right doctor and keep it saved in your appointment history.
            </p>

            <form className="detail-form" onSubmit={handleSubmit}>
              <label className="detail-field">
                <span>Patient name</span>
                <input
                  className="detail-input"
                  value={form.patientName}
                  onChange={(event) => updateField('patientName', event.target.value)}
                  placeholder="Enter patient name"
                />
              </label>

              <label className="detail-field">
                <span>Phone</span>
                <input
                  className="detail-input"
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                  placeholder="+91 98765 43210"
                />
              </label>

              <label className="detail-field">
                <span>Email</span>
                <input
                  className="detail-input"
                  type="email"
                  value={form.email || ''}
                  onChange={(event) => updateField('email', event.target.value)}
                  placeholder="your-email@example.com"
                />
              </label>

              <label className="detail-field">
                <span>Doctor</span>
                <select
                  className="detail-input"
                  value={form.doctor}
                  onChange={(event) => updateField('doctor', event.target.value)}
                >
                  {detail.doctors.map((doctor) => (
                    <option key={doctor.name} value={doctor.name}>
                      {doctor.name}
                    </option>
                  ))}
                </select>
              </label>

              {isQuickServiceBooking ? (
                <label className="detail-field">
                  <span>Service</span>
                  <input
                    className="detail-input"
                    value={form.service || form.specialty || ''}
                    onChange={(event) => updateField('service', event.target.value)}
                    readOnly
                  />
                </label>
              ) : (
                <label className="detail-field">
                  <span>Specialty</span>
                  <select
                    className="detail-input"
                    value={form.specialty}
                    onChange={(event) => updateField('specialty', event.target.value)}
                  >
                    {detail.specialties.map((specialty) => (
                      <option key={specialty} value={specialty}>
                        {specialty}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="detail-field">
                <span>Date</span>
                <input
                  className="detail-input"
                  type="date"
                  value={form.date}
                  onChange={(event) => updateField('date', event.target.value)}
                />
              </label>

              <label className="detail-field">
                <span>Time</span>
                <select
                  className="detail-input"
                  value={form.time}
                  onChange={(event) => updateField('time', event.target.value)}
                >
                  {APPOINTMENT_TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </label>

              {!isQuickServiceBooking && (
                <label className="detail-field detail-field-full">
                  <span>Notes</span>
                  <textarea
                    className="detail-input"
                    rows={4}
                    value={form.notes}
                    onChange={(event) => updateField('notes', event.target.value)}
                    placeholder="Tell the hospital what you need help with"
                  />
                </label>
              )}

              <div className="detail-form-actions">
                <button type="submit" className="search-btn-dark detail-submit-btn">
                  Book Appointment
                </button>
                {!isQuickServiceBooking && (
                  <button type="button" className="h-dir-btn" onClick={onViewHistory}>
                    Open History
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}

export default HospitalDetailPage
