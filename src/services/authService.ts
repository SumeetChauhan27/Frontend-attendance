import { getMe, login, logout, type User } from '../api'

export type LoginPayload = {
  role: 'SUPER_ADMIN' | 'TEACHER' | 'STUDENT'
  id: string
  password: string
}

const TOKEN_KEY = 'auth_token'

const clearStoredSession = () => {
  localStorage.removeItem(TOKEN_KEY)
}

export const restoreSession = async (): Promise<User | null> => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return null

  try {
    return await getMe()
  } catch {
    clearStoredSession()
    return null
  }
}

export const signIn = async (payload: LoginPayload): Promise<User> => {
  const result = await login(payload)
  localStorage.setItem(TOKEN_KEY, result.token)
  return getMe()
}

export const signOut = async () => {
  try {
    await logout()
  } finally {
    clearStoredSession()
  }
}
