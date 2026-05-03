'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function getField(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

function authOrigin() {
  return headers().then((h) => h.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://127.0.0.1:3000')
}

function redirectWithError(path: string, message: string): never {
  const separator = path.includes('?') ? '&' : '?'
  redirect(`${path}${separator}error=${encodeURIComponent(message)}`)
}

export async function loginAction(formData: FormData) {
  const email = getField(formData, 'email')
  const password = getField(formData, 'password')

  if (!email || !password) {
    redirectWithError('/login', 'Enter your email and password.')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirectWithError('/login', error.message)
  }

  redirect('/dashboard')
}

export async function signupAction(formData: FormData) {
  const email = getField(formData, 'email')
  const password = getField(formData, 'password')

  if (!email || !password) {
    redirectWithError('/signup', 'Enter your email and password.')
  }

  const origin = await authOrigin()
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  })

  if (error) {
    redirectWithError('/signup', error.message)
  }

  redirect('/signup?sent=1')
}

export async function passwordResetAction(formData: FormData) {
  const email = getField(formData, 'email')

  if (!email) {
    redirectWithError('/login?mode=reset', 'Enter your email first.')
  }

  const origin = await authOrigin()
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  })

  if (error) {
    redirectWithError('/login?mode=reset', error.message)
  }

  redirect('/login?mode=reset&sent=1')
}

export async function googleLoginAction() {
  const origin = await authOrigin()
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  })

  const redirectUrl = data.url
  if (error || !redirectUrl) {
    redirectWithError('/login', error?.message ?? 'Could not start Google sign-in.')
  }

  redirect(redirectUrl)
}
