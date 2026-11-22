// import { Seo } from "../components/Seo";
// import { DISCLOSURES, NOT_CLAIMED } from "../constants/copy";

// /**
//  * Single, canonical home for every standing disclosure. Marketing sections link
//  * here instead of repeating the same caveats inline, so the wording stays in one
//  * place and never drifts between surfaces.
//  */
// export function DisclosuresPage() {
//   return (
//     <div className="page-responsive borderless-ui auth-background flex min-h-screen w-full items-start justify-center py-8 sm:py-10">
//       <Seo
//         title="Risk and disclosures"
//         description="How NexaCrypto classifies balances, what its projected figures are and are not, and the claims it does not make."
//         path="/disclosures"
//       />
//       <div className="w-full max-w-4xl px-4 sm:px-6 lg:px-8">
//         <div className="auth-card mx-auto w-full rounded-3xl bg-[#333333]/90 shadow-elevated-card px-6 py-7 sm:px-10 sm:py-10 lg:px-12">
//           <h1 className="text-2xl font-semibold text-white tracking-tight mb-4">
//             Risk and disclosures
//           </h1>
//           <p className="text-sm text-slate-200/80 mb-6">
//             This page collects the disclosures that apply across NexaCrypto. It
//             describes how balances are classified, what projected figures mean,
//             and the claims the platform does not make.
//           </p>
//           <div className="space-y-5 text-sm text-slate-200/70">
//             <section>
//               <h2 className="mb-1 text-sm font-semibold text-slate-100">
//                 1. How balances are classified
//               </h2>
//               <p>{DISCLOSURES.platformWallets}</p>
//             </section>
//             <section>
//               <h2 className="mb-1 text-sm font-semibold text-slate-100">
//                 2. Deposits and on-chain verification
//               </h2>
//               <p>{DISCLOSURES.depositsNotCredited}</p>
//               <p className="mt-2">{DISCLOSURES.onChainVerification}</p>
//             </section>
//             <section>
//               <h2 className="mb-1 text-sm font-semibold text-slate-100">
//                 3. Projected figures
//               </h2>
//               <p>{DISCLOSURES.illustrativeProjectionOnly}</p>
//               <p className="mt-2">{DISCLOSURES.noGuarantee}</p>
//             </section>
//             <section>
//               <h2 className="mb-1 text-sm font-semibold text-slate-100">
//                 4. What we do not claim
//               </h2>
//               <ul className="mt-2 space-y-2">
//                 {NOT_CLAIMED.map((item) => (
//                   <li key={item} className="flex gap-3">
//                     <span
//                       aria-hidden="true"
//                       className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#C6A15B]"
//                     />
//                     <span>{item}</span>
//                   </li>
//                 ))}
//               </ul>
//               <p className="mt-3">
//                 Investment value can rise or fall. Digital assets are volatile and
//                 you should only deposit funds you can afford to lose.
//               </p>
//             </section>
//             <section>
//               <h2 className="mb-1 text-sm font-semibold text-slate-100">
//                 5. Rates and pricing
//               </h2>
//               <p>{DISCLOSURES.rateSource}</p>
//               <p className="mt-2">
//                 Market data is informational and is not investment advice.
//               </p>
//             </section>
//             <section>
//               <h2 className="mb-1 text-sm font-semibold text-slate-100">
//                 6. Deposits and networks
//               </h2>
//               <p>{DISCLOSURES.wrongNetworkRisk}</p>
//             </section>
//           </div>
//           <p className="mt-6 text-[0.75rem] text-slate-400/80">
//             If you have questions about these disclosures or require a copy for your
//             records, please contact support through the in-app help channel.
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// }
