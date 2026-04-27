import { Seo } from "../components/Seo";

export function TermsPage() {
  return (
    <div className="page-responsive borderless-ui auth-background flex min-h-screen w-full items-start justify-center py-8 sm:py-10">
      <Seo
        title="Terms of use"
        description="Review the terms of use governing access to the NexaCrypto custodial crypto deposit and reward platform."
        path="/terms"
      />
      <div className="w-full max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="auth-card mx-auto w-full rounded-3xl bg-[#333333]/90 shadow-elevated-card px-6 py-7 sm:px-10 sm:py-10 lg:px-12">
          <h1 className="text-2xl font-semibold text-white tracking-tight mb-4">
            Terms of Use
          </h1>
          <p className="text-sm text-slate-200/80 mb-6">
            These Terms of Use govern your access to and use of the NexaCrypto
            platform. By creating an account or using the service, you agree to be bound
            by these terms.
          </p>
          <div className="space-y-5 text-sm text-slate-200/70">
            <section>
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                1. Custodial service
              </h2>
              <p>
                NexaCrypto is a centralized, custodial platform. When you deposit
                digital assets, you authorize us and our regulated partners to hold those
                assets on your behalf in pooled or omnibus wallets. You retain beneficial
                ownership of your assets, but you do not have a claim to any specific
                blockchain address.
              </p>
            </section>
            <section>
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                2. Eligibility and registration
              </h2>
              <p>
                You must be at least 18 years old, have the legal capacity to enter into
                these terms, and not be subject to any trade or economic sanctions. You
                agree that the information you provide during registration is accurate,
                complete, and kept up to date.
              </p>
            </section>
            <section>
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                3. Account security
              </h2>
              <p>
                You are responsible for maintaining the confidentiality of your login
                credentials and for all activity occurring under your account. You must
                use a strong password, enable all available security controls, and notify
                us immediately if you suspect unauthorized access or compromise of your
                account.
              </p>
            </section>
            <section>
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                4. Deposits, rewards, and withdrawals
              </h2>
              <p>
                Deposits, rewards, and withdrawals are subject to internal risk checks,
                AML screening, and manual or automated review. We may delay, reverse, or
                reject transactions where required by law, by our risk policies, or to
                protect the platform and its users. Reward rates, level multipliers, and
                bonus structures are variable and may change at any time.
              </p>
            </section>
            <section>
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                5.Financial Responsibility
              </h2>
              <p>
                All content on NexaCrypto, including dashboards, analytics, performance indicators, and leaderboard
                data, is provided to enhance user experience and support engagement with digital asset markets.
                Users acknowledge that all financial decisions are made independently and at their own discretion.
                NexaCrypto does not provide personalized financial advice, and all platform tools are designed to
                assist user participation rather than guarantee financial outcomes or returns.
              </p>
            </section>
            <section>
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                6. Risk disclosure
              </h2>
              <p>
                Digital assets are highly volatile and may lose significant value in a
                short period of time. Regulatory changes, protocol failures,
                counterparty risk, or operational incidents may impact your ability to
                access or withdraw assets. You should only deposit funds you can afford
                to lose and understand that past performance is not indicative of future
                results.
              </p>
            </section>
            <section>
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                7. Prohibited conduct
              </h2>
              <p>
                You agree not to use the platform for any unlawful activity, including
                money laundering, terrorist financing, fraud, market manipulation, or
                other abusive behaviors. We may suspend or terminate accounts, freeze
                balances, and report suspicious activity to relevant authorities where
                required by law.
              </p>
            </section>
            <section>
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                8. Limitation of liability
              </h2>
              <p>
                To the maximum extent permitted by law, the platform and its affiliates
                are not liable for any indirect, incidental, special, or consequential
                damages, loss of profits, or loss of data arising out of or related to
                your use of the service. Our aggregate liability is limited to the fees
                you have paid to us over the preceding twelve months, if any.
              </p>
            </section>
            <section>
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                9. Changes to these terms
              </h2>
              <p>
                We may update these Terms of Use from time to time. When we make
                material changes, we will provide notice through the platform or by other
                appropriate means. Your continued use of the service after such changes
                constitutes acceptance of the updated terms.
              </p>
            </section>
          </div>
          <p className="mt-6 text-[0.75rem] text-slate-400/80">
            If you have questions about these terms or require a copy for your records,
            please contact support through the in-app help channel.
          </p>
        </div>
      </div>
    </div>
  );
}

