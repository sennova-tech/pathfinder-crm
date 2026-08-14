'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from './supabaseClient'

const IDLE_LIMIT_MS = 2 * 60 * 1000 // 2 minutes

export function useAuthGuard(requiredRole) {
  const router = useRouter()
  const timerRef = useRef(null)

  useEffect(() => {
    let isMounted = true

    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/')
        return
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (!isMounted) return

      if (error || !profile || profile.role !== requiredRole) {
        await supabase.auth.signOut()
        router.replace('/')
      }
    }

    checkAuth()

    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(async () => {
        await supabase.auth.signOut()
        router.replace('/')
      }, IDLE_LIMIT_MS)
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach((e) => window.addEventListener(e, resetTimer))
    resetTimer()

    return () => {
      isMounted = false
      if (timerRef.current) clearTimeout(timerRef.current)
      events.forEach((e) => window.removeEventListener(e, resetTimer))
    }
  }, [requiredRole, router])
}