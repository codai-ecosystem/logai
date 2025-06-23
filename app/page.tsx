'use client'

import { useSession, signIn } from 'next-auth/react'
import Link from 'next/link'

export default function Home() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Welcome back!
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You are already signed in to LogAI
            </p>
            <Link
              href="/dashboard"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md transition-colors inline-block"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-4xl font-bold text-center">
            Welcome to LogAI
          </h1>
          <p className="text-xl text-center text-gray-600 max-w-2xl">
            Identity & Authentication Hub for the Codai Ecosystem
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <p className="text-blue-800 text-center">
              � Authentication System Ready
            </p>
            <p className="text-blue-600 text-sm text-center mt-2">
              Domain: <strong>logai.ro</strong> | Priority: <strong>1</strong>
            </p>
          </div>
        </div>
        
        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <Link
            href="/auth/signin"
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-indigo-600 text-white gap-2 hover:bg-indigo-700 text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
          >
            Sign In
          </Link>
          <button
            onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
            className="rounded-full border border-solid border-gray-300 dark:border-gray-600 transition-colors flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
          >
            Sign in with Google
          </button>
        </div>
      </main>
    </div>
  )
}
