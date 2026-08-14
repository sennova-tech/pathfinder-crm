'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuthGuard } from '../../lib/useAuthGuard'
import * as XLSX from 'xlsx'

const STAGES = [
  { key: 'call_followup', label: 'Call Follow-up', pass: 'Yes' },
  { key: 'document_status', label: 'Document Collected', pass: 'Collected' },
  { key: 'mock_interview_informed', label: 'Mock Informed', pass: 'Informed' },
  { key: 'questions_shared', label: 'Questions Shared', pass: 'Yes' },
  { key: 'mock_interview', label: 'Mock Interview', pass: 'Eligible' },
  { key: 'exam', label: 'Entrance Exam', pass: 'Done' },
  { key: 'interview_attended', label: 'Interview Attended', pass: 'Yes' },
  { key: 'interview_selected', label: 'Interview Result', pass: 'Selected' },
  { key: 'offer_letter_released', label: 'Offer Letter', pass: 'Yes' },
  { key: 'payment_received', label: 'Payment Received', pass: 'Yes' },
  { key: 'documents_submitted_to_student', label: 'Docs to Student', pass: 'Yes' },
]

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function getProgress(app) {
  let completed = 0
  let nextStage = null
  for (const stage of STAGES) {
    if (app[stage.key] === stage.pass) {
      completed++
    } else {
      if (!nextStage) nextStage = stage.label
    }
  }
  return { completed, total: STAGES.length, nextStage: nextStage || 'Application Closed' }
}

function parseAmount(val) {
  if (!val) return 0
  const num = parseFloat(String(val).replace(/[^0-9.]/g, ''))
  return isNaN(num) ? 0 : num
}

export default function CooDashboard() {
  useAuthGuard('coo')

  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [viewFilter, setViewFilter] = useState('active')

  const [search, setSearch] = useState('')
  const [monthFilter, setMonthFilter] = useState('')

  useEffect(() => {
    async function fetchStudents() {
      const { data, error } = await supabase
        .from('students')
        .select(`
          id,
          student_code,
          full_name,
          college,
          qualification,
          applying_for_company,
          experience_category,
          submitted_at,
          applications (
            company,
            role,
            final_selection,
            ref_contact_name,
            ref_contact_number,
            payment_commitment,
            call_followup,
            document_status,
            mock_interview_informed,
            questions_shared,
            mock_interview,
            exam,
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
    fetchStudents()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const searchFilteredStudents = useMemo(() => {
    return students.filter((s) => {
      const app = s.applications?.[0] || {}
      const q = search.trim().toLowerCase()
      if (q) {
        const haystack = [
          s.full_name, s.student_code, s.college, s.qualification,
          s.applying_for_company, app.company, app.role,
        ].join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }

      const submitted = new Date(s.submitted_at)

      if (monthFilter !== '') {
        if (submitted.getMonth() !== Number(monthFilter)) return false
      }

      return true
    })
  }, [students, search, monthFilter])

  const activeStudents = useMemo(
    () => searchFilteredStudents.filter((s) => s.applications?.[0]?.final_selection !== 'Dropped'),
    [searchFilteredStudents]
  )
  const droppedStudents = useMemo(
    () => searchFilteredStudents.filter((s) => s.applications?.[0]?.final_selection === 'Dropped'),
    [searchFilteredStudents]
  )
  const filteredStudents = viewFilter === 'dropped' ? droppedStudents : activeStudents

  const stats = useMemo(() => {
    let selectedCount = 0
    let notSelectedCount = 0
    let pendingCount = 0
    let committedRevenue = 0
    let receivedRevenue = 0

    activeStudents.forEach((s) => {
      const app = s.applications?.[0] || {}
      if (app.final_selection === 'Selected') selectedCount++
      else if (app.final_selection === 'Not Selected') notSelectedCount++
      else pendingCount++

      const amount = parseAmount(app.payment_commitment)
      committedRevenue += amount
      if (app.payment_received === 'Yes') receivedRevenue += amount
    })

    return {
      total: activeStudents.length,
      selectedCount,
      notSelectedCount,
      pendingCount,
      committedRevenue,
      receivedRevenue,
      pendingRevenue: committedRevenue - receivedRevenue,
      droppedCount: droppedStudents.length,
    }
  }, [activeStudents, droppedStudents])

  function handleDownloadExcel() {
    const rows = filteredStudents.map((s) => {
      const app = s.applications?.[0] || {}
      const { completed, total, nextStage } = getProgress(app)
      return {
        'Student ID': s.student_code,
        'Name': s.full_name,
        'College': s.college || '',
        'Qualification': s.qualification || '',
        'Experience': s.experience_category || '',
        'Applying For': s.applying_for_company || '',
        'Company': app.company || '',
        'Role': app.role || '',
        'Reference Name': app.ref_contact_name || '',
        'Reference Contact': app.ref_contact_number || '',
        'Payment Commitment': app.payment_commitment || '',
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
        'Progress': `${completed}/${total}`,
        'Waiting On': completed === total ? 'Closed' : nextStage,
        'Final Selection': app.final_selection || 'Pending',
        'Submitted': new Date(s.submitted_at).toLocaleDateString(),
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Applications')

    const dateStr = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(workbook, `student-applications-${dateStr}.xlsx`)
  }

  const StatCard = ({ label, value, sub, accent }) => (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex-1 min-w-[160px]">
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent || 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* SIDEBAR */}
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-100">
          <span className="font-bold text-lg text-slate-900 block leading-tight">PathStudentCRM</span>
          <p className="text-xs text-slate-400">COO Panel</p>
        </div>
        <nav className="flex-1 p-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 font-medium text-sm">
            Dashboard
          </div>
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
      <main className="flex-1 p-8 overflow-x-hidden">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">COO Dashboard</h1>
          <p className="text-sm text-slate-500">Overview of student applications</p>
        </div>

        {/* STAT CARDS */}
        <div className="flex flex-wrap gap-4 mb-6">
          <StatCard label="Total Applications" value={stats.total} />
          <StatCard label="Selected" value={stats.selectedCount} accent="text-emerald-600" />
          <StatCard label="Not Selected" value={stats.notSelectedCount} accent="text-rose-600" />
          <StatCard label="Pending" value={stats.pendingCount} accent="text-amber-600" />
          <StatCard label="Dropped" value={stats.droppedCount} accent="text-rose-600" />
          <StatCard label="Committed Revenue" value={`₹${stats.committedRevenue.toLocaleString('en-IN')}`} accent="text-indigo-600" />
          <StatCard label="Received Revenue" value={`₹${stats.receivedRevenue.toLocaleString('en-IN')}`} accent="text-emerald-600" />
          <StatCard label="Pending Revenue" value={`₹${stats.pendingRevenue.toLocaleString('en-IN')}`} accent="text-amber-600" />
        </div>

        {/* FILTER BAR */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, college, company, role..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Month</label>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All months</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
          </div>

          {(search || monthFilter !== '') && (
            <button
              onClick={() => { setSearch(''); setMonthFilter('') }}
              className="text-sm text-slate-500 hover:text-slate-700 underline"
            >
              Clear filters
            </button>
          )}

          <button
            onClick={handleDownloadExcel}
            className="ml-auto text-sm font-medium bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700"
          >
            Download Excel
          </button>
        </div>

        {/* ACTIVE / DROPPED TOGGLE */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setViewFilter('active')}
            className={`text-sm px-4 py-2 rounded-lg font-medium transition ${
              viewFilter === 'active'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Active ({activeStudents.length})
          </button>
          <button
            onClick={() => setViewFilter('dropped')}
            className={`text-sm px-4 py-2 rounded-lg font-medium transition ${
              viewFilter === 'dropped'
                ? 'bg-rose-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Dropped ({droppedStudents.length})
          </button>
        </div>

        {loading ? (
          <p className="text-slate-400">Loading...</p>
        ) : filteredStudents.length === 0 ? (
          <p className="text-slate-400">
            {viewFilter === 'dropped' ? 'No dropped students.' : 'No matching students.'}
          </p>
        ) : (
          <div className="grid gap-4">
            {filteredStudents.map((s) => {
              const app = s.applications?.[0] || {}
              const { completed, total, nextStage } = getProgress(app)
              const pct = Math.round((completed / total) * 100)
              const closed = completed === total
              const isDropped = app.final_selection === 'Dropped'

              return (
                <div
                  key={s.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-5 shadow-sm hover:shadow-md transition"
                >
                  <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg shrink-0">
                    {s.full_name?.[0]?.toUpperCase() || '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <h2 className="font-semibold text-slate-900 truncate">{s.full_name}</h2>
                      <span className="text-xs text-slate-400 shrink-0">{s.student_code}</span>
                    </div>
                    <p className="text-sm text-slate-500 truncate">
                      {s.college || '—'} · {s.qualification || '—'} · {app.company || s.applying_for_company || '—'}
                      {app.role ? ` (${app.role})` : ''}
                    </p>

                    {!isDropped && (
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-xs">
                          <div
                            className={`h-full rounded-full ${closed ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 shrink-0">
                          {completed}/{total} · {closed ? 'Closed' : `Waiting on: ${nextStage}`}
                        </span>
                      </div>
                    )}
                  </div>

                  <span
                    className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${
                      isDropped
                        ? 'bg-rose-50 text-rose-700'
                        : app.final_selection === 'Selected'
                        ? 'bg-emerald-50 text-emerald-700'
                        : app.final_selection === 'Not Selected'
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {app.final_selection || 'Pending'}
                  </span>

                  <button
                    onClick={() => setSelected({ ...s, app })}
                    className="shrink-0 text-sm font-medium text-white bg-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-700"
                  >
                    View Status
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* STATUS POPUP */}
        {selected && (
          <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="font-bold text-slate-900 text-lg">{selected.full_name}</h2>
                  <p className="text-sm text-slate-500">{selected.student_code} · {selected.college || '—'}</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-slate-400 hover:text-slate-600 text-xl leading-none"
                >
                  ×
                </button>
              </div>

              <div className="text-sm text-slate-600 mb-4 bg-slate-50 rounded-lg p-3">
                Reference: {selected.app.ref_contact_name || '—'} · {selected.app.ref_contact_number || '—'}<br />
                Payment Commitment: {selected.app.payment_commitment ? `₹${parseAmount(selected.app.payment_commitment).toLocaleString('en-IN')}` : '—'}<br />
                Company: {selected.app.company || '—'} · Role: {selected.app.role || '—'}
              </div>

              <div className="space-y-2">
                {STAGES.map((stage) => {
                  const done = selected.app[stage.key] === stage.pass
                  return (
                    <div key={stage.key} className="flex items-center justify-between text-sm py-1">
                      <span className="text-slate-600">{stage.label}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          done ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {done ? selected.app[stage.key] : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div
                className={`mt-4 p-3 rounded-lg text-center font-semibold text-sm ${
                  selected.app.final_selection === 'Dropped'
                    ? 'bg-rose-50 text-rose-700'
                    : getProgress(selected.app).completed === STAGES.length
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {selected.app.final_selection === 'Dropped'
                  ? 'Application Dropped'
                  : getProgress(selected.app).completed === STAGES.length
                  ? 'Application Successfully Closed'
                  : `Waiting on: ${getProgress(selected.app).nextStage}`}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}