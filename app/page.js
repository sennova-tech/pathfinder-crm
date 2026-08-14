'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profileError || !profile) {
      setError('Could not find your role. Contact admin.')
      setLoading(false)
      return
    }

    if (profile.role === 'ceo') router.push('/ceo')
    else if (profile.role === 'coo') router.push('/coo')
    else if (profile.role === 'operations') router.push('/operations')
    else setError('Unknown role assigned.')

    setLoading(false)
  }

  const inputClass =
    'w-full bg-stone-100 border-0 rounded-xl px-4 py-3 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-300 transition'
  const labelClass = 'block text-sm font-semibold text-stone-600 mb-2'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-100 to-amber-50 p-4">
      <form
        onSubmit={handleLogin}
        className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-sm border border-stone-100"
      >
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="PathFinder" className="w-16 h-16 rounded-xl object-cover mb-3" />
          <h1 className="text-2xl font-bold text-stone-800 text-center">PathFinder Admin Login</h1>
        </div>

        {error && (
          <p className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-5">{error}</p>
        )}

        <div className="space-y-5">
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-600 text-white py-3.5 rounded-xl font-semibold hover:bg-amber-700 transition disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
      </form>
    </div>
  )
}