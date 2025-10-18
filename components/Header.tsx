// components/Header.tsx
import React from "react";

interface HeaderProps {
  user: { id: string; email?: string } | null;
  email: string;
  setEmail: (s: string) => void;
  signOut: () => Promise<void>;
  sendMagicLink: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  streakCount?: number;
}

export default function Header({
  user,
  email,
  setEmail,
  signOut,
  sendMagicLink,
  signInWithGoogle,
  streakCount = 0,
}: HeaderProps) {
  return (
    <header className="mb-8">
      <div className="container mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Left: Brand */}
          <div>
            <h1 className="text-3xl font-semibold text-indigo-800">Mindstream</h1>
            <p className="text-sm text-gray-500 mt-1">Your thoughts. Finally understood.</p>
          </div>

          {/* Right: Capsule with privacy, streak, auth actions */}
          <div className="ms-header-capsule">
            <div className="flex items-center gap-4">
              {/* Privacy note */}
              <div className="text-xs text-gray-600 select-none">🔒 Voice stays in your browser</div>

              <div className="h-6 w-px bg-gray-200" />

              {/* Streak + email */}
              <div className="flex items-center gap-3">
                <div
                  aria-hidden
                  className="rounded-full w-10 h-10 flex items-center justify-center text-sm font-medium text-teal-700 bg-teal-50"
                  style={{ boxShadow: "0 4px 10px rgba(20,184,166,0.06)" }}
                >
                  {streakCount}
                </div>

                {/* Email or sign-in hint */}
                <div className="text-sm text-gray-700">
                  {user?.email || email || <span className="italic text-gray-500">Not signed in</span>}
                </div>
              </div>

              <div className="h-6 w-px bg-gray-100" />

              {/* Auth controls: if signed in show sign out; else show Google / Magic Link */}
              <div className="flex items-center gap-2">
                {user ? (
                  <>
                    <button
                      onClick={signOut}
                      aria-label="Sign out"
                      title="Sign out"
                      className="p-2 rounded-md hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-200"
                    >
                      {/* Sign out icon (arrow) */}
                      <svg className="w-5 h-5 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8v8" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={signInWithGoogle}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border bg-white shadow-sm hover:bg-gray-50"
                      title="Sign in with Google"
                    >
                      {/* Google glyph (simplified) */}
                      <svg className="w-4 h-4" viewBox="0 0 533.5 544.3" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden>
                        <path fill="#4285F4" d="M533.5 278.4c0-18.2-1.6-36.1-4.7-53.2H272v100.8h147.3c-6.4 34.7-25.5 63.9-54.6 83.4v69.3h88.2c51.6-47.6 81.6-117.7 81.6-200.3z"/>
                        <path fill="#34A853" d="M272 544.3c73.7 0 135.6-24.6 180.8-66.9l-88.2-69.3c-24.7 16.6-56.4 26.4-92.6 26.4-71 0-131.1-47.9-152.6-112.2H30.3v70.3C75.2 484.2 168.2 544.3 272 544.3z"/>
                        <path fill="#FBBC05" d="M119.4 322.3c-10.9-32.8-10.9-68 0-100.8V151.2H30.3c-39.3 77.9-39.3 169.7 0 247.6l89.1-76.5z"/>
                        <path fill="#EA4335" d="M272 109.1c39.4 0 74.9 13.6 102.9 40.4l77.1-77.1C404.4 24.9 344.9 0 272 0 168.2 0 75.2 60.1 30.3 151.2l89.1 70.3C140.9 156.9 200.9 109.1 272 109.1z"/>
                      </svg>
                      <span className="text-sm text-slate-700 hidden sm:inline">Google</span>
                    </button>

                    <button
                      onClick={sendMagicLink}
                      className="px-2 py-1 text-sm text-indigo-600 hover:underline hidden sm:inline"
                      title="Send magic link"
                    >
                      Email
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
