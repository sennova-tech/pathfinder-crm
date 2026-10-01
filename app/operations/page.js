'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuthGuard } from '../../lib/useAuthGuard'
import * as XLSX from 'xlsx'

const emptyNewStudent = {
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
  exp_documents_available: 'Yes',
  exp_documents_missing_reason: '',
  notice_period: '',
  pf_issues: '',
  reference_name: '',
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const COMPANIES = ['Concentrix', 'Accenture', 'Cognizant', 'Wipro', 'Others']

function parseAmount(val) {
  if (!val) return 0
  const num = parseFloat(String(val).replace(/[^0-9.]/g, ''))
  return isNaN(num) ? 0 : num
}

function formatCurrency(val) {
  const num = parseAmount(val)
  return `₹${num.toLocaleString('en-IN')}`
}

export default function OperationsDashboard() {
  useAuthGuard('operations')

  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [newStudent, setNewStudent] = useState(emptyNewStudent)
  const [resumeFile, setResumeFile] = useState(null)
  const [aadharFile, setAadharFile] = useState(null)
  const [pfFile, setPfFile] = useState(null)

  const [editData, setEditData] = useState({})
  const [viewFilter, setViewFilter] = useState('active')
  const [downloadMonth, setDownloadMonth] = useState('')
  const [companyFilter, setCompanyFilter] = useState(null)
  const [companyTab, setCompanyTab] = useState('Active')
  const [seenIds, setSeenIds] = useState([])
  const [viewingProfile, setViewingProfile] = useState(null)
  const [viewingFile, setViewingFile] = useState(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    fetchStudents()
    try {
      const stored = JSON.parse(localStorage.getItem('operations_seen_ids') || '[]')
      setSeenIds(stored)
    } catch {
      setSeenIds([])
    }
  }, [])

  function markCompanySeen(company) {
    const idsForCompany = activeStudents
      .filter((s) => companyOf(s) === company)
      .map((s) => s.id)
    setSeenIds((prev) => {
      const next = Array.from(new Set([...prev, ...idsForCompany]))
      try {
        localStorage.setItem('operations_seen_ids', JSON.stringify(next))
      } catch {}
      return next
    })
  }

  async function fetchStudents() {
    setLoading(true)
    const { data, error } = await supabase
      .from('students')
      .select(`
        id,
        student_code,
        full_name,
        college,
        email,
        phone,
        submitted_at,
        contact_number,
        qualification,
        specialization,
        year_of_passing,
        applying_for_company,
        has_career_gap,
        career_gap_reason,
        experience_category,
        designation,
        total_experience,
        exp_documents_available,
        exp_documents_missing_reason,
        notice_period,
        pf_issues,
        reference_name,
        resume_url,
        pan_url,
        pf_history_url,
        applications (
          id,
          call_followup,
          mock_interview,
          company,
          role,
          exam,
          final_selection,
          ref_contact_number,
          ref_contact_name,
          payment_commitment,
          amount_spent,
          document_status,
          mock_interview_informed,
          questions_shared,
          interview_attended,
          interview_selected,
          offer_letter_released,
          payment_received,
          documents_submitted_to_student
        )
      `)
      .order('submitted_at', { ascending: false })

    if (!error) setStudents(data)
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  function updateNew(field, value) {
    setNewStudent({ ...newStudent, [field]: value })
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

  async function handleAddStudent(e) {
    e.preventDefault()
    setSaving(true)

    try {
      const resume_url = await uploadFile(resumeFile, 'resume')
      const aadhar_url = await uploadFile(aadharFile, 'aadhar')
      const pf_history_url = await uploadFile(pfFile, 'pf-history')

      const payload = { ...newStudent, resume_url, aadhar_url, pf_history_url }

      if (newStudent.experience_category === 'Fresher') {
        payload.designation = null
        payload.total_experience = null
        payload.exp_documents_available = null
        payload.exp_documents_missing_reason = null
        payload.notice_period = null
        payload.pf_issues = null
        payload.pf_history_url = null
        payload.reference_name = null
      }

      const { error } = await supabase.from('students').insert([payload])
      if (error) throw new Error(error.message)

      setNewStudent(emptyNewStudent)
      setResumeFile(null)
      setAadharFile(null)
      setPfFile(null)
      setShowAddForm(false)
      fetchStudents()
    } catch (err) {
      alert('Error adding student: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  function openTrack(student) {
    setSelected(student)
    setEditData(student.applications?.[0] || {})
  }

  function handleResetChecklist() {
    setEditData({
      ...editData,
      call_followup: 'No',
      document_status: 'Not Collected',
      mock_interview_informed: 'Not Informed',
      questions_shared: 'No',
      mock_interview: 'Not Eligible',
      exam: 'Not Done',
      interview_attended: 'No',
      interview_selected: 'Not Selected',
      offer_letter_released: 'No',
      payment_received: 'No',
      documents_submitted_to_student: 'No',
      company: '',
      role: '',
      final_selection: 'Pending',
    })
  }

  async function handleSaveApplication() {
    setSaving(true)
    const appId = selected.applications?.[0]?.id
    const { error } = await supabase
      .from('applications')
      .update({
        call_followup: editData.call_followup,
        document_status: editData.document_status,
        mock_interview_informed: editData.mock_interview_informed,
        questions_shared: editData.questions_shared,
        mock_interview: editData.mock_interview,
        company: editData.company,
        role: editData.role,
        exam: editData.exam,
        interview_attended: editData.interview_attended,
        interview_selected: editData.interview_selected,
        offer_letter_released: editData.offer_letter_released,
        payment_received: editData.payment_received,
        documents_submitted_to_student: editData.documents_submitted_to_student,
        ref_contact_name: editData.ref_contact_name,
        ref_contact_number: editData.ref_contact_number,
        payment_commitment: editData.payment_commitment,
        amount_spent: editData.amount_spent,
        final_selection: editData.final_selection || 'Pending',
      })
      .eq('id', appId)

    if (!error) {
      setSelected(null)
      fetchStudents()
    } else {
      alert('Error saving: ' + error.message)
    }
    setSaving(false)
  }

  async function handleDrop(student) {
    if (!confirm(`Mark ${student.full_name} as Dropped? Committed revenue and spending will be reset to ₹0, and they'll move to the Dropped list.`)) return
    const appId = student.applications?.[0]?.id
    const { error } = await supabase
      .from('applications')
      .update({
        final_selection: 'Dropped',
        payment_commitment: 0,
        amount_spent: 0,
      })
      .eq('id', appId)

    if (error) {
      alert('Error dropping student: ' + error.message)
    } else {
      fetchStudents()
    }
  }

  async function handleDelete(student) {
    if (!confirm(`Permanently delete ${student.full_name}? This cannot be undone.`)) return
    const appId = student.applications?.[0]?.id
    if (appId) {
      await supabase.from('applications').delete().eq('id', appId)
    }
    const { error } = await supabase.from('students').delete().eq('id', student.id)

    if (error) {
      alert('Error deleting student: ' + error.message)
    } else {
      fetchStudents()
    }
  }

  const activeStudents = useMemo(
    () => students.filter((s) => s.applications?.[0]?.final_selection !== 'Dropped'),
    [students]
  )
  const droppedStudents = useMemo(
    () => students.filter((s) => s.applications?.[0]?.final_selection === 'Dropped'),
    [students]
  )
  function matchesMonth(student) {
    return downloadMonth === '' || new Date(student.submitted_at).getMonth() === Number(downloadMonth)
  }

  const monthFilteredActive = useMemo(
    () => activeStudents.filter(matchesMonth),
    [activeStudents, downloadMonth]
  )
  const monthFilteredDropped = useMemo(
    () => droppedStudents.filter(matchesMonth),
    [droppedStudents, downloadMonth]
  )

  const baseStudents = viewFilter === 'dropped' ? monthFilteredDropped : monthFilteredActive

  const monthFilteredAll = useMemo(
    () => students.filter(matchesMonth),
    [students, downloadMonth]
  )

  function statusTabOf(student) {
    const app = student.applications?.[0] || {}
    if (app.final_selection === 'Dropped') return 'Dropped'
    if (app.final_selection === 'Not Selected') return 'Rejected'
    if (app.final_selection === 'Selected') {
      return app.payment_received === 'Yes' ? 'Closed' : 'Selected'
    }
    return 'Active'
  }

  function companyOf(student) {
    const raw = (student.applying_for_company || '').trim().toLowerCase()
    const known = ['concentrix', 'accenture', 'cognizant', 'wipro']
    const match = known.find((k) => raw === k)
    return match ? match.charAt(0).toUpperCase() + match.slice(1) : 'Others'
  }

  const companyCounts = useMemo(() => {
    const counts = { Concentrix: 0, Accenture: 0, Cognizant: 0, Wipro: 0, Others: 0 }
    baseStudents.forEach((s) => {
      counts[companyOf(s)]++
    })
    return counts
  }, [baseStudents])

  const newCompanyCounts = useMemo(() => {
    const counts = { Concentrix: 0, Accenture: 0, Cognizant: 0, Wipro: 0, Others: 0 }
    activeStudents.forEach((s) => {
      if (!seenIds.includes(s.id)) counts[companyOf(s)]++
    })
    return counts
  }, [activeStudents, seenIds])

  const displayedStudents = companyFilter
    ? monthFilteredAll.filter((s) => companyOf(s) === companyFilter && statusTabOf(s) === companyTab)
    : baseStudents

  function handleDownloadExcel() {
    const rows = displayedStudents.map((s) => {
      const app = s.applications?.[0] || {}
      return {
        'Student ID': s.student_code,
        'Name': s.full_name,
        'College': s.college || '',
        'Email': s.email,
        'Phone': s.phone || s.contact_number,
        'Qualification': s.qualification || '',
        'Applying For': s.applying_for_company || '',
        'Experience': s.experience_category || '',
        'Company': app.company || '',
        'Role': app.role || '',
        'Reference Name': app.ref_contact_name || '',
        'Reference Contact': app.ref_contact_number || '',
        'Payment Commitment': app.payment_commitment || '',
        'Amount Spent': app.amount_spent || '',
        'Call Follow-up': app.call_followup || '',
        'Document': app.document_status || '',
        'Mock Informed': app.mock_interview_informed || '',
        'Questions Shared': app.questions_shared || '',
        'Mock Interview': app.mock_interview || '',
        'Entrance Exam': app.exam || '',
        'Interview Attended': app.interview_attended || '',
        'Interview Result': app.interview_selected || '',
        'Offer Letter': app.offer_letter_released || '',
        'Payment Received': app.payment_received || '',
        'Docs to Student': app.documents_submitted_to_student || '',
        'Final Selection': app.final_selection || 'Pending',
        'Submitted': new Date(s.submitted_at).toLocaleDateString(),
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Applications')

    const dateStr = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(workbook, `operations-students-${dateStr}.xlsx`)
  }

  const stats = useMemo(() => {
    let selectedCount = 0
    let notSelectedCount = 0
    let pendingCount = 0
    let committedRevenue = 0
    let receivedRevenue = 0
    let totalSpent = 0

    monthFilteredActive.forEach((s) => {
      const app = s.applications?.[0] || {}
      if (app.final_selection === 'Selected') selectedCount++
      else if (app.final_selection === 'Not Selected') notSelectedCount++
      else pendingCount++

      const amount = parseAmount(app.payment_commitment)
      committedRevenue += amount
      if (app.payment_received === 'Yes') receivedRevenue += amount
      totalSpent += parseAmount(app.amount_spent)
    })

    return {
      total: monthFilteredActive.length,
      selectedCount,
      notSelectedCount,
      pendingCount,
      committedRevenue,
      receivedRevenue,
      pendingRevenue: committedRevenue - receivedRevenue,
      profitMargin: committedRevenue - totalSpent,
    }
  }, [monthFilteredActive])

  const callOk = editData.call_followup === 'Yes'
  const docOk = callOk && editData.document_status === 'Collected'
  const informedOk = docOk && editData.mock_interview_informed === 'Informed'
  const questionsOk = informedOk && editData.questions_shared === 'Yes'
  const mockOk = questionsOk && editData.mock_interview === 'Eligible'
  const examOk = mockOk && editData.exam === 'Done'
  const attendedOk = examOk && editData.interview_attended === 'Yes'
  const selectedOk = attendedOk && editData.interview_selected === 'Selected'
  const offerOk = selectedOk && editData.offer_letter_released === 'Yes'
  const paymentOk = offerOk && editData.payment_received === 'Yes'
  const docsSubmittedOk = paymentOk && editData.documents_submitted_to_student === 'Yes'
  const applicationClosed = docsSubmittedOk

  const profitMargin = parseAmount(editData.payment_commitment) - parseAmount(editData.amount_spent)

  const fieldClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  // Track/Edit popup styling (matches the apply form's cream/stone/amber look)
  const trackFieldClass = 'w-full bg-stone-100 border-0 rounded-xl px-3 py-2.5 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:bg-stone-50 disabled:text-stone-400 transition'
  const trackLabelClass = 'block text-sm font-semibold text-stone-600 mb-1.5'

  const StatCard = ({ label, value, accent }) => (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex-1 min-w-[160px]">
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent || 'text-slate-900'}`}>{value}</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* MOBILE TOP BAR */}
      <div className="sm:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-30">
        <span className="font-bold text-slate-900">PathStudentCRM</span>
        <button
          onClick={() => setMobileNavOpen(true)}
          className="text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
        >
          Menu
        </button>
      </div>

      {/* MOBILE OVERLAY */}
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="sm:hidden fixed inset-0 bg-black/40 z-40"
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`w-56 bg-white border-r border-slate-200 flex flex-col shrink-0 fixed sm:static inset-y-0 left-0 z-50 transform transition-transform duration-200 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        } sm:translate-x-0`}
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <span className="font-bold text-lg text-slate-900 block leading-tight">PathStudentCRM</span>
            <p className="text-xs text-slate-400">Operations Panel</p>
          </div>
          <button onClick={() => setMobileNavOpen(false)} className="sm:hidden text-slate-400 text-xl leading-none">
            &times;
          </button>
        </div>
        <nav className="flex-1 p-3">
          <div
            onClick={() => {
              setCompanyFilter(null)
              setMobileNavOpen(false)
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm cursor-pointer ${
              !companyFilter ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Dashboard
          </div>

          <p className="px-3 pt-4 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">Companies</p>
          {COMPANIES.map((c) => (
            <div
              key={c}
              onClick={() => {
                setCompanyFilter(companyFilter === c ? null : c)
                setCompanyTab('Active')
                markCompanySeen(c)
                setMobileNavOpen(false)
              }}
              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg font-medium text-sm cursor-pointer ${
                companyFilter === c ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>{c}</span>
              {newCompanyCounts[c] > 0 && (
                <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-rose-100 text-rose-700">
                  {newCompanyCounts[c]}
                </span>
              )}
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="w-full text-sm bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg font-medium hover:bg-slate-100"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 p-4 sm:p-8 pt-20 sm:pt-8 overflow-x-hidden w-full min-w-0">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{companyFilter || 'Operations Portal'}</h1>
            <p className="text-sm text-slate-500">{companyFilter ? `Applicants for ${companyFilter}` : 'Manage student applications'}</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={downloadMonth}
              onChange={(e) => setDownloadMonth(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All months</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
            <button
              onClick={handleDownloadExcel}
              className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition"
            >
              Download Excel
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              + Add Student
            </button>
          </div>
        </div>

        {!companyFilter && (
          <>
            {/* STAT CARDS */}
            <div className="flex flex-wrap gap-4 mb-6">
              <StatCard label="Total Applications" value={stats.total} />
              <StatCard label="Selected" value={stats.selectedCount} accent="text-emerald-600" />
              <StatCard label="Not Selected" value={stats.notSelectedCount} accent="text-rose-600" />
              <StatCard label="Pending" value={stats.pendingCount} accent="text-amber-600" />
              <StatCard label="Committed Revenue" value={`₹${stats.committedRevenue.toLocaleString('en-IN')}`} accent="text-indigo-600" />
              <StatCard label="Received Revenue" value={`₹${stats.receivedRevenue.toLocaleString('en-IN')}`} accent="text-emerald-600" />
              <StatCard label="Pending Revenue" value={`₹${stats.pendingRevenue.toLocaleString('en-IN')}`} accent="text-amber-600" />
              <StatCard label="Profit Margin" value={`₹${stats.profitMargin.toLocaleString('en-IN')}`} accent="text-indigo-600" />
            </div>
          </>
        )}

        {companyFilter && (
        <>
          {/* COMPANY TABS */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {['Active', 'Selected', 'Rejected', 'Dropped', 'Closed'].map((t) => (
              <button
                key={t}
                onClick={() => setCompanyTab(t)}
                className={`text-sm px-4 py-2 rounded-lg font-medium transition ${
                  companyTab === t
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

        {loading ? (
          <p className="text-slate-400">Loading...</p>
        ) : (
          <div className="space-y-3">
            {displayedStudents.map((s) => {
              const status = s.applications?.[0]?.final_selection || 'Pending'
              const isDropped = status === 'Dropped'
              const initials = (s.full_name || '?')
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0].toUpperCase())
                .join('')
              const statusClass = isDropped
                ? 'bg-rose-50 text-rose-700'
                : status === 'Selected'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-blue-50 text-blue-700'
              return (
                <div key={s.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4">
                  <button
                    onClick={() => setViewingProfile(s)}
                    className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0 hover:ring-2 hover:ring-blue-300 transition"
                  >
                    {initials}
                  </button>
                  <div className="flex-1 min-w-[140px]">
                    <p className="font-semibold text-slate-900 text-sm">
                      {s.full_name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {s.college || '-'} · {s.phone || s.contact_number} · {s.experience_category || '-'}
                    </p>
                  </div>
                  <div className="flex gap-3 items-center text-sm shrink-0 w-full sm:w-auto justify-end sm:justify-start">
                    <button onClick={() => openTrack(s)} className="text-blue-600 font-medium hover:underline">
                      Track
                    </button>
                    {!isDropped && (
                      <button onClick={() => handleDrop(s)} className="text-rose-600 font-medium hover:underline">
                        Drop
                      </button>
                    )}
                    <button onClick={() => handleDelete(s)} className="text-slate-400 font-medium hover:underline hover:text-slate-600">
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
            {displayedStudents.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-slate-400">
                No students in this view.
              </div>
            )}
          </div>
        )}
        </>
        )}

        {/* ADD STUDENT MODAL */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Add New Student</h2>
              <form onSubmit={handleAddStudent} className="space-y-4">
                <div>
                  <label className={labelClass}>Full Name *</label>
                  <input required value={newStudent.full_name} onChange={(e) => updateNew('full_name', e.target.value)} className={fieldClass} />
                </div>

                <div>
                  <label className={labelClass}>College Name *</label>
                  <input required value={newStudent.college} onChange={(e) => updateNew('college', e.target.value)} className={fieldClass} />
                </div>

                <div>
                  <label className={labelClass}>Contact Number *</label>
                  <input required value={newStudent.contact_number} onChange={(e) => updateNew('contact_number', e.target.value)} className={fieldClass} />
                </div>

                <div>
                  <label className={labelClass}>Email *</label>
                  <input required type="email" value={newStudent.email} onChange={(e) => updateNew('email', e.target.value)} className={fieldClass} />
                </div>

                <div>
                  <label className={labelClass}>Qualification *</label>
                  <select required value={newStudent.qualification} onChange={(e) => updateNew('qualification', e.target.value)} className={fieldClass}>
                    <option value="" disabled>Select degree</option>
                    <option>B-Tech</option>
                    <option>B.E</option>
                    <option>B.Sc</option>
                    <option>B.Com</option>
                    <option>BBA</option>
                    <option>BCA</option>
                    <option>B.A</option>
                    <option>M-Tech</option>
                    <option>MBA</option>
                    <option>MCA</option>
                    <option>M.Sc</option>
                    <option>Diploma</option>
                    <option>Others</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Stream / Branch</label>
                  <select value={newStudent.specialization} onChange={(e) => updateNew('specialization', e.target.value)} className={fieldClass}>
                    <option value="" disabled>Select stream/branch</option>
                    <option>CSE</option>
                    <option>ECE</option>
                    <option>EEE</option>
                    <option>Mechanical</option>
                    <option>Civil</option>
                    <option>IT</option>
                    <option>BBA</option>
                    <option>BCA</option>
                    <option>Commerce</option>
                    <option>Others</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Year of Passing *</label>
                  <input required value={newStudent.year_of_passing} onChange={(e) => updateNew('year_of_passing', e.target.value)} className={fieldClass} />
                </div>

                <div>
                  <label className={labelClass}>Applying for which company? *</label>
                  <select required value={newStudent.applying_for_company} onChange={(e) => updateNew('applying_for_company', e.target.value)} className={fieldClass}>
                    <option value="" disabled>Select a company</option>
                    <option>Concentrix</option>
                    <option>Accenture</option>
                    <option>Cognizant</option>
                    <option>Wipro</option>
                    <option>Others</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Educational or Career Gap?</label>
                  <select value={newStudent.has_career_gap} onChange={(e) => updateNew('has_career_gap', e.target.value)} className={fieldClass}>
                    <option>No</option>
                    <option>Yes</option>
                  </select>
                </div>

                {newStudent.has_career_gap === 'Yes' && (
                  <div>
                    <label className={labelClass}>Please specify the reason</label>
                    <textarea value={newStudent.career_gap_reason} onChange={(e) => updateNew('career_gap_reason', e.target.value)} className={fieldClass} rows={3} />
                  </div>
                )}

                <div>
                  <label className={labelClass}>Updated Resume</label>
                  <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setResumeFile(e.target.files[0])} className={fieldClass} />
                </div>

                <div>
                  <label className={labelClass}>Aadhar Card</label>
                  <input type="file" accept="image/*,.pdf" onChange={(e) => setAadharFile(e.target.files[0])} className={fieldClass} />
                </div>

                <div>
                  <label className={labelClass}>Experience Category *</label>
                  <select value={newStudent.experience_category} onChange={(e) => updateNew('experience_category', e.target.value)} className={fieldClass}>
                    <option>Fresher</option>
                    <option>Experienced</option>
                  </select>
                </div>

                {newStudent.experience_category === 'Experienced' && (
                  <div className="space-y-4 pt-3 border-t border-gray-200">
                    <h3 className="font-semibold text-sm text-gray-800">Experience Details</h3>

                    <div>
                      <label className={labelClass}>Designation</label>
                      <input value={newStudent.designation} onChange={(e) => updateNew('designation', e.target.value)} className={fieldClass} />
                    </div>

                    <div>
                      <label className={labelClass}>Total Years of Experience</label>
                      <input value={newStudent.total_experience} onChange={(e) => updateNew('total_experience', e.target.value)} className={fieldClass} />
                    </div>

                    <div>
                      <label className={labelClass}>Are all required experience documents available?</label>
                      <select value={newStudent.exp_documents_available} onChange={(e) => updateNew('exp_documents_available', e.target.value)} className={fieldClass}>
                        <option>Yes</option>
                        <option>No</option>
                      </select>
                    </div>

                    {newStudent.exp_documents_available === 'No' && (
                      <div>
                        <label className={labelClass}>If not, please specify</label>
                        <textarea value={newStudent.exp_documents_missing_reason} onChange={(e) => updateNew('exp_documents_missing_reason', e.target.value)} className={fieldClass} rows={3} />
                      </div>
                    )}

                    <div>
                      <label className={labelClass}>Notice Period</label>
                      <input value={newStudent.notice_period} onChange={(e) => updateNew('notice_period', e.target.value)} className={fieldClass} />
                    </div>

                    <div>
                      <label className={labelClass}>PF History (file upload)</label>
                      <input type="file" onChange={(e) => setPfFile(e.target.files[0])} className={fieldClass} />
                    </div>

                    <div>
                      <label className={labelClass}>Any PF-related issues?</label>
                      <textarea value={newStudent.pf_issues} onChange={(e) => updateNew('pf_issues', e.target.value)} className={fieldClass} rows={3} />
                    </div>

                    <div>
                      <label className={labelClass}>Reference Name</label>
                      <input value={newStudent.reference_name} onChange={(e) => updateNew('reference_name', e.target.value)} className={fieldClass} />
                    </div>
                  </div>
                )}

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
                  >
                    {saving ? 'Saving...' : 'Add Student'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* STUDENT PROFILE (APPLICATION FORM DETAILS) MODAL */}
        {viewingProfile && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-xl p-7 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-stone-100">
              <h2 className="text-xl font-bold text-stone-800 mb-1">{viewingProfile.full_name}</h2>
              <p className="text-sm text-stone-500 mb-4">
                {viewingProfile.college}
              </p>

              <div className="text-sm space-y-1.5 bg-stone-50 border border-stone-100 p-4 rounded-2xl">
                <p><strong className="text-stone-700">Email:</strong> <span className="text-stone-600">{viewingProfile.email}</span></p>
                <p><strong className="text-stone-700">Phone:</strong> <span className="text-stone-600">{viewingProfile.contact_number}</span></p>
                <p><strong className="text-stone-700">Qualification:</strong> <span className="text-stone-600">{viewingProfile.qualification}</span></p>
                <p><strong className="text-stone-700">Applying for:</strong> <span className="text-stone-600">{viewingProfile.applying_for_company}</span></p>
                <p><strong className="text-stone-700">Experience Category:</strong> <span className="text-stone-600">{viewingProfile.experience_category}</span></p>
                <p><strong className="text-stone-700">Reference Name:</strong> <span className="text-stone-600">{viewingProfile.reference_name || '-'}</span></p>

                <div className="flex gap-3 pt-2">
                  {viewingProfile.resume_url && (
                    <button onClick={() => setViewingFile({ url: viewingProfile.resume_url, label: 'Resume' })} className="text-amber-600 font-medium hover:underline">Resume</button>
                  )}
                  {viewingProfile.pan_url && (
                    <button onClick={() => setViewingFile({ url: viewingProfile.pan_url, label: 'PAN Card' })} className="text-amber-600 font-medium hover:underline">PAN Card</button>
                  )}
                  {viewingProfile.pf_history_url && (
                    <button onClick={() => setViewingFile({ url: viewingProfile.pf_history_url, label: 'PF History' })} className="text-amber-600 font-medium hover:underline">PF History</button>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-5">
                <button
                  onClick={() => setViewingProfile(null)}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FILE VIEWER MODAL */}
        {viewingFile && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="flex justify-between items-center p-4 border-b border-stone-100">
                <h3 className="font-bold text-stone-800">{viewingFile.label}</h3>
                <button
                  onClick={() => setViewingFile(null)}
                  className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-100 text-sm"
                >
                  Close
                </button>
              </div>
              <iframe src={viewingFile.url} className="flex-1 w-full" style={{ minHeight: '70vh' }} />
            </div>
          </div>
        )}

        {/* TRACK / EDIT APPLICATION MODAL */}
        {selected && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-gradient-to-br from-stone-50 to-amber-50 rounded-3xl shadow-xl p-7 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-stone-100">
              <h2 className="text-xl font-bold text-stone-800 mb-1">{selected.full_name}</h2>
              <p className="text-sm text-stone-500 mb-4">
                {selected.student_code} · {selected.college}
              </p>

              <h3 className="font-bold text-stone-800 mb-2">Application Checklist</h3>

              <div className="bg-white border border-stone-100 rounded-2xl shadow-sm p-5 space-y-4">
                <div>
                  <label className={trackLabelClass}>1. Reference Name</label>
                  <input
                    value={editData.ref_contact_name || ''}
                    onChange={(e) => setEditData({ ...editData, ref_contact_name: e.target.value })}
                    className={trackFieldClass}
                  />
                </div>

                <div>
                  <label className={trackLabelClass}>2. Payment Commitment</label>
                  <input
                    value={editData.payment_commitment || ''}
                    onChange={(e) => setEditData({ ...editData, payment_commitment: e.target.value })}
                    className={trackFieldClass}
                  />
                  {editData.payment_commitment && (
                    <p className="text-xs text-stone-400 mt-1">{formatCurrency(editData.payment_commitment)}</p>
                  )}
                </div>

                <div>
                  <label className={trackLabelClass}>How much I am spending</label>
                  <input
                    value={editData.amount_spent || ''}
                    onChange={(e) => setEditData({ ...editData, amount_spent: e.target.value })}
                    className={trackFieldClass}
                    placeholder="Enter amount"
                  />
                  {editData.amount_spent && (
                    <p className="text-xs text-stone-400 mt-1">{formatCurrency(editData.amount_spent)}</p>
                  )}
                </div>

                <div>
                  <label className={trackLabelClass}>Profit Margin (auto-calculated)</label>
                  <input
                    disabled
                    value={formatCurrency(profitMargin)}
                    className={trackFieldClass}
                  />
                </div>

                <div>
                  <label className={trackLabelClass}>3. Call Follow-up</label>
                  <select
                    value={editData.call_followup || 'No'}
                    onChange={(e) => setEditData({ ...editData, call_followup: e.target.value })}
                    className={trackFieldClass}
                  >
                    <option>No</option>
                    <option>Yes</option>
                  </select>
                </div>

                <div>
                  <label className={trackLabelClass}>4. Document</label>
                  <select
                    value={editData.document_status || 'Not Collected'}
                    onChange={(e) => setEditData({ ...editData, document_status: e.target.value })}
                    className={trackFieldClass}
                  >
                    <option>Not Collected</option>
                    <option>Collected</option>
                  </select>
                </div>

                <div>
                  <label className={trackLabelClass}>5. Mock Interview Informed</label>
                  <select
                    value={editData.mock_interview_informed || 'Not Informed'}
                    onChange={(e) => setEditData({ ...editData, mock_interview_informed: e.target.value })}
                    className={trackFieldClass}
                  >
                    <option>Not Informed</option>
                    <option>Informed</option>
                  </select>
                </div>

                <div>
                  <label className={trackLabelClass}>6. Questions Shared</label>
                  <select
                    value={editData.questions_shared || 'No'}
                    onChange={(e) => setEditData({ ...editData, questions_shared: e.target.value })}
                    className={trackFieldClass}
                  >
                    <option>No</option>
                    <option>Yes</option>
                  </select>
                </div>

                <div>
                  <label className={trackLabelClass}>7. Mock Interview</label>
                  <select
                    value={editData.mock_interview || 'Not Eligible'}
                    onChange={(e) => setEditData({ ...editData, mock_interview: e.target.value })}
                    className={trackFieldClass}
                  >
                    <option>Not Eligible</option>
                    <option>Eligible</option>
                  </select>
                </div>

                <div>
                  <label className={trackLabelClass}>8. Entrance Exam</label>
                  <select
                    value={editData.exam || 'Not Done'}
                    onChange={(e) => setEditData({ ...editData, exam: e.target.value })}
                    className={trackFieldClass}
                  >
                    <option>Not Done</option>
                    <option>Done</option>
                  </select>
                </div>

                <div>
                  <label className={trackLabelClass}>9. Interview Attended</label>
                  <select
                    value={editData.interview_attended || 'No'}
                    onChange={(e) => setEditData({ ...editData, interview_attended: e.target.value })}
                    className={trackFieldClass}
                  >
                    <option>No</option>
                    <option>Yes</option>
                  </select>
                </div>

                <div>
                  <label className={trackLabelClass}>10. Interview Result</label>
                  <select
                    value={editData.interview_selected || 'Not Selected'}
                    onChange={(e) => setEditData({ ...editData, interview_selected: e.target.value })}
                    className={trackFieldClass}
                  >
                    <option>Not Selected</option>
                    <option>Selected</option>
                  </select>
                </div>

                <div>
                  <label className={trackLabelClass}>11. Offer Letter Released</label>
                  <select
                    value={editData.offer_letter_released || 'No'}
                    onChange={(e) => setEditData({ ...editData, offer_letter_released: e.target.value })}
                    className={trackFieldClass}
                  >
                    <option>No</option>
                    <option>Yes</option>
                  </select>
                </div>

                <div>
                  <label className={trackLabelClass}>12. Payment Received</label>
                  <select
                    value={editData.payment_received || 'No'}
                    onChange={(e) => setEditData({ ...editData, payment_received: e.target.value })}
                    className={trackFieldClass}
                  >
                    <option>No</option>
                    <option>Yes</option>
                  </select>
                </div>

                <div>
                  <label className={trackLabelClass}>13. Documents Submitted to Student</label>
                  <select
                    value={editData.documents_submitted_to_student || 'No'}
                    onChange={(e) => setEditData({ ...editData, documents_submitted_to_student: e.target.value })}
                    className={trackFieldClass}
                  >
                    <option>No</option>
                    <option>Yes</option>
                  </select>
                </div>

                <div>
                  <label className={trackLabelClass}>14. Current Status</label>
                  <select
                    value={editData.final_selection || 'Pending'}
                    onChange={(e) => setEditData({ ...editData, final_selection: e.target.value })}
                    className={trackFieldClass}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Selected">Selected</option>
                    <option value="Not Selected">Rejected</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-5">
                <button
                  onClick={handleResetChecklist}
                  className="px-4 py-2 rounded-xl border border-red-300 text-red-600 hover:bg-red-50 mr-auto"
                >
                  Reset Checklist
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveApplication}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-amber-600 text-white font-medium hover:bg-amber-700"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}