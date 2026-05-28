import { createContext, useContext, useEffect, useState } from 'react'
import { sb } from '../lib/supabase'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [perfil,  setPerfil]  = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadPerfil(uid) {
    const { data } = await sb.from('perfiles').select('*').eq('id', uid).single()
    setPerfil(data)
  }

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadPerfil(session.user.id).finally(() => setLoading(false))
      else setLoading(false)
    })
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadPerfil(session.user.id)
      else setPerfil(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await sb.auth.signOut()
    setUser(null); setPerfil(null)
  }

  return (
    <AuthCtx.Provider value={{ user, perfil, loading, signIn, signOut }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
