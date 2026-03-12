import { Seo } from "../components/Seo";

export function PrivacyPage() {
  return (
    <div className="auth-background flex items-center justify-center py-10">
      <Seo
        title="Privacy policy"
        description="Learn how Crypto Levels collects, uses, stores and protects your information, including cookies and local storage used for session security."
        path="/privacy"
      />
      <div className="w-full max-w-3xl px-4">
        <div className="auth-card w-full rounded-3xl bg-[#333333]/90 border border-slate-800/80 shadow-elevated-card px-6 py-7 sm:px-10 sm:py-10">
          <h1 className="text-2xl font-semibold text-white tracking-tight mb-4">
            Privacy Policy
          </h1>
          <p className="text-sm text-slate-200/80 mb-6">
            This Privacy Policy explains how we collect, use, store, and protect your
            information when you use the Crypto Levels platform.
          </p>
          <div className="space-y-5 text-sm text-slate-200/70">
            <section>
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                1. Information we collect
              </h2>
              <p>
                We collect information you provide directly, such as your name, email
                address, wallet addresses, and account preferences. We also collect usage
                data, device information, and log data related to security events,
                deposits, withdrawals, and login activity.
              </p>
            </section>
            <section>
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                2. How we use your information
              </h2>
              <p>
                We use your information to operate and secure the platform, process
                deposits and withdrawals, calculate rewards and levels, detect fraud and
                abuse, comply with legal obligations, and improve user experience through
                analytics and personalization.
              </p>
            </section>
            <section>
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                3. Legal bases for processing
              </h2>
              <p>
                Depending on your jurisdiction, we may process your data based on your
                consent, our contractual obligations to you, compliance with applicable
                laws and regulations, and our legitimate interests in operating a secure
                custodial platform.
              </p>
            </section>
            <section>
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                4. Data sharing and third parties
              </h2>
              <p>
                We may share limited information with service providers that support
                operations such as cloud hosting, analytics, customer support, and
                compliance tools. These providers are bound by contractual obligations to
                protect your data and may only process it in accordance with our
                instructions.
              </p>
            </section>
            <section>
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                5. Data retention
              </h2>
              <p>
                We retain your information for as long as necessary to provide the
                service, meet our legal and regulatory obligations, resolve disputes, and
                enforce our agreements. Retention periods vary by data category and
                applicable law.
              </p>
            </section>
            <section>
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                6. Security
              </h2>
              <p>
                We apply layered security controls to protect your data, including
                encryption in transit, hardened infrastructure, strict access controls,
                monitoring for suspicious activity, and regular security reviews. No
                system is perfectly secure, but we design our controls to reduce the risk
                of unauthorized access or misuse.
              </p>
            </section>
            <section>
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                7. Your rights
              </h2>
              <p>
                Subject to local law, you may have rights to access, correct, or delete
                certain personal data we hold about you, or to restrict or object to its
                processing. You can exercise these rights by contacting support through
                the platform. We may need to verify your identity before fulfilling your
                request.
              </p>
            </section>
            <section>
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                8. International transfers
              </h2>
              <p>
                Where data is transferred across borders, we use appropriate safeguards
                such as contractual clauses or equivalent mechanisms to protect your
                information in accordance with applicable regulations.
              </p>
            </section>
            <section>
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                9. Changes to this policy
              </h2>
              <p>
                We may update this Privacy Policy periodically. We will notify you of
                material changes through the platform or other appropriate channels. Your
                continued use of the service after changes take effect constitutes
                acceptance of the updated policy.
              </p>
            </section>
            <section id="cookies">
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                10. Cookies and local storage
              </h2>
              <p>
                We use cookies and local storage to support core platform functionality,
                maintain session security, and improve performance. This includes storing
                authentication tokens, UI preferences, and consent flags. You can clear
                stored data from your browser at any time; doing so may sign you out or
                reset preferences.
              </p>
            </section>
          </div>
          <p className="mt-6 text-[0.75rem] text-slate-400/80">
            If you have privacy questions or requests, please contact support through the
            in-app help channel. We aim to respond to verified requests within a
            reasonable timeframe.
          </p>
        </div>
      </div>
    </div>
  );
}

