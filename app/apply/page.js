'use client'

import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'

const STEPS = ['Personal Details', 'Academic Details', 'Documents', 'Experience']

export default function ApplyPage() {
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)
  const formRef = useRef(null)

  const [form, setForm] = useState({
    full_name: '',
    college: '',
    contact_number: '',
    email: '',
    qualification: '',
    specialization: '',
    year_of_passing: '',
    applying_for_company: '',
    has_career_gap: 'No',
    career_gap_reason: '',
    experience_category: 'Fresher',
    designation: '',
    total_experience: '',
    present_ctc: '',
    expected_ctc: '',
    exp_documents_available: 'Yes',
    exp_documents_missing_reason: '',
    notice_period: '',
    pf_issues: '',
    reference_name: '',
  })

  const [resumeFile, setResumeFile] = useState(null)
  const [panFile, setPanFile] = useState(null)
  const [pfFile, setPfFile] = useState(null)

  function update(field, value) {
    setForm({ ...form, [field]: value })
  }

  function goNext() {
    if (formRef.current && !formRef.current.reportValidity()) return
    setError('')
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function goBack() {
    setError('')
    setStep((s) => Math.max(s - 1, 0))
  }

  async function uploadFile(file, prefix) {
    if (!file) return null
    const fileName = `${prefix}-${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('student-documents')
      .upload(fileName, file)

    if (uploadError) {
      throw new Error(`Failed to upload ${prefix}: ${uploadError.message}`)
    }

    const { data } = supabase.storage
      .from('student-documents')
      .getPublicUrl(fileName)

    return data.publicUrl
  }

  async function handleSubmit(e) {
    if (e && e.preventDefault) e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const resume_url = await uploadFile(resumeFile, 'resume')
      const pan_url = await uploadFile(panFile, 'pan')
      const pf_history_url = await uploadFile(pfFile, 'pf-history')

      const payload = {
        ...form,
        resume_url,
        pan_url,
        pf_history_url,
      }

      if (form.experience_category === 'Fresher') {
        payload.designation = null
        payload.total_experience = null
        payload.present_ctc = null
        payload.expected_ctc = null
        payload.exp_documents_available = null
        payload.exp_documents_missing_reason = null
        payload.notice_period = null
        payload.pf_issues = null
        payload.pf_history_url = null
      }

      const { error: insertError } = await supabase
        .from('students')
        .insert([payload])

      if (insertError) throw new Error(insertError.message)

      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full bg-stone-100 border-0 rounded-xl px-4 py-3 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-300 transition'
  const labelClass = 'block text-sm font-semibold text-stone-600 mb-2'

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-100 to-amber-50 p-4">
        <div className="bg-white p-10 rounded-3xl shadow-xl text-center max-w-md border border-stone-100">
          <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4 text-3xl">
            ✓
          </div>
          <h1 className="text-2xl font-bold mb-2 text-stone-800">Application Submitted!</h1>
          <p className="text-stone-500">
            Thank you for applying. Our team will review your application and get in touch soon.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 to-amber-50 py-12 px-4">
      <div className="w-full max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-stone-800 mb-1">Job Application Form</h1>
          <p className="text-stone-500">Fill in your details below to apply.</p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center justify-between mb-8 px-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition ${
                    i < step
                      ? 'bg-amber-500 text-white'
                      : i === step
                      ? 'bg-stone-800 text-white'
                      : 'bg-stone-200 text-stone-400'
                  }`}
                >
                  {i < step ? '✓' : i + 1}
                </div>
                <span
                  className={`text-xs mt-2 text-center hidden sm:block ${
                    i === step ? 'text-stone-800 font-semibold' : 'text-stone-400'
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-amber-500' : 'bg-stone-200'}`}
                />
              )}
            </div>
          ))}
        </div>

        <form
          ref={formRef}
          onSubmit={(e) => e.preventDefault()}
          className="bg-white p-10 rounded-3xl shadow-xl border border-stone-100"
        >
          {error && (
            <p className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-6">{error}</p>
          )}

          {/* Step 0: Personal Details */}
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <label className={labelClass}>Full Name *</label>
                <input required value={form.full_name} onChange={(e) => update('full_name', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>College Name *</label>
                <input required value={form.college} onChange={(e) => update('college', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Contact Number *</label>
                <input required value={form.contact_number} onChange={(e) => update('contact_number', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Email *</label>
                <input required type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className={inputClass} />
              </div>
            </div>
          )}

          {/* Step 1: Academic Details */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className={labelClass}>Qualification *</label>
                <input required value={form.qualification} onChange={(e) => update('qualification', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Specialization</label>
                <input value={form.specialization} onChange={(e) => update('specialization', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Year of Passing *</label>
                <input required value={form.year_of_passing} onChange={(e) => update('year_of_passing', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Applying for which company? *</label>
                <input required value={form.applying_for_company} onChange={(e) => update('applying_for_company', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Reference Name *</label>
                <input required value={form.reference_name} onChange={(e) => update('reference_name', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Educational or Career Gap?</label>
                <select value={form.has_career_gap} onChange={(e) => update('has_career_gap', e.target.value)} className={inputClass}>
                  <option>No</option>
                  <option>Yes</option>
                </select>
              </div>
              {form.has_career_gap === 'Yes' && (
                <div>
                  <label className={labelClass}>Please specify the reason</label>
                  <textarea value={form.career_gap_reason} onChange={(e) => update('career_gap_reason', e.target.value)} className={inputClass} rows={3} />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Documents */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className={labelClass}>Updated Resume *</label>
                <input required type="file" accept=".pdf,.doc,.docx" onChange={(e) => setResumeFile(e.target.files[0])} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>PAN Card *</label>
                <input required type="file" accept="image/*,.pdf" onChange={(e) => setPanFile(e.target.files[0])} className={inputClass} />
              </div>
            </div>
          )}

          {/* Step 3: Experience */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className={labelClass}>Experience Category *</label>
                <select value={form.experience_category} onChange={(e) => update('experience_category', e.target.value)} className={inputClass}>
                  <option>Fresher</option>
                  <option>Experienced</option>
                </select>
              </div>

              {form.experience_category === 'Experienced' && (
                <div className="space-y-6 pt-4 border-t border-stone-100">
                  <h2 className="font-bold text-stone-800">Experience Details</h2>

                  <div>
                    <label className={labelClass}>Designation</label>
                    <input value={form.designation} onChange={(e) => update('designation', e.target.value)} className={inputClass} />
                  </div>

                  <div>
                    <label className={labelClass}>Total Years of Experience</label>
                    <input value={form.total_experience} onChange={(e) => update('total_experience', e.target.value)} className={inputClass} />
                  </div>

                  <div>
                    <label className={labelClass}>Present CTC</label>
                    <input value={form.present_ctc} onChange={(e) => update('present_ctc', e.target.value)} className={inputClass} />
                  </div>

                  <div>
                    <label className={labelClass}>Expected CTC</label>
                    <input value={form.expected_ctc} onChange={(e) => update('expected_ctc', e.target.value)} className={inputClass} />
                  </div>

                  <div>
                    <label className={labelClass}>Are all required experience documents available?</label>
                    <select value={form.exp_documents_available} onChange={(e) => update('exp_documents_available', e.target.value)} className={inputClass}>
                      <option>Yes</option>
                      <option>No</option>
                    </select>
                  </div>

                  {form.exp_documents_available === 'No' && (
                    <div>
                      <label className={labelClass}>If not, please specify</label>
                      <textarea value={form.exp_documents_missing_reason} onChange={(e) => update('exp_documents_missing_reason', e.target.value)} className={inputClass} rows={3} />
                    </div>
                  )}

                  <div>
                    <label className={labelClass}>Notice Period</label>
                    <input value={form.notice_period} onChange={(e) => update('notice_period', e.target.value)} className={inputClass} />
                  </div>

                  <div>
                    <label className={labelClass}>PF History (file upload)</label>
                    <input type="file" onChange={(e) => setPfFile(e.target.files[0])} className={inputClass} />
                  </div>

                  <div>
                    <label className={labelClass}>Any PF-related issues?</label>
                    <textarea value={form.pf_issues} onChange={(e) => update('pf_issues', e.target.value)} className={inputClass} rows={3} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="flex-1 bg-stone-100 text-stone-700 py-4 rounded-xl font-semibold hover:bg-stone-200 transition"
              >
                Back
              </button>
            )}

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="flex-1 bg-stone-800 text-white py-4 rounded-xl font-semibold hover:bg-stone-900 transition"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 bg-amber-600 text-white py-4 rounded-xl font-semibold hover:bg-amber-700 transition disabled:opacity-60"
              >
                {saving ? 'Submitting...' : 'Submit Application'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}