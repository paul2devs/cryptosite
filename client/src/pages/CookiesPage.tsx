import { Seo } from "../components/Seo";

export function CookiesPage() {
  return (
    <div className="page-responsive borderless-ui auth-background flex min-h-screen w-full items-start justify-center py-8 sm:py-10">
      <Seo
        title="Cookie policy"
        description="Review how NexaCrypto uses cookies and local storage for session security, preferences, and platform reliability."
        path="/cookies"
      />
      <div className="w-full max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="auth-card mx-auto w-full rounded-3xl bg-[#333333]/90 shadow-elevated-card px-6 py-7 sm:px-10 sm:py-10 lg:px-12">
          <h1 className="mb-4 text-2xl font-semibold tracking-tight text-white">
            Cookie Policy
          </h1>
          <p className="mb-6 text-sm text-slate-200/80">
            This Cookie Policy explains how NexaCrypto uses cookies and local
            storage to provide a secure, stable, and personalized custodial
            experience.
          </p>
          <div className="space-y-5 text-sm text-slate-200/70">
            <section>
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                1. What we use
              </h2>
              <p>
                We use browser cookies and local storage keys to keep your session
                active, protect account access, remember UI preferences, and support
                core platform state between page reloads.
              </p>
            </section>
            <section>
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                2. Security and authentication
              </h2>
              <p>
                Authentication state and consent flags are stored to prevent repeated
                prompts, reduce login friction, and maintain secure continuity while
                you navigate deposits, withdrawals, and portfolio views.
              </p>
            </section>
            <section>
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                3. Functional preferences
              </h2>
              <p>
                We store non-sensitive preferences such as dismissing notices,
                interface behavior, and selected views so that your dashboard remains
                consistent and efficient across sessions.
              </p>
            </section>
            <section>
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                4. Retention and control
              </h2>
              <p>
                You can clear cookies and local storage from your browser at any
                time. Clearing this data may sign you out, reset interface settings,
                and require security confirmations again.
              </p>
            </section>
            <section>
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                5. Updates to this policy
              </h2>
              <p>
                We may revise this policy as the platform evolves. Material changes
                are communicated through the website or in-app notices.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
