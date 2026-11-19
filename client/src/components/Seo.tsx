import { Helmet } from "react-helmet-async";
import { BRAND, DEFAULT_KEYWORDS } from "../constants/copy";

export interface Breadcrumb {
  name: string;
  path: string;
}

interface SeoProps {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
  robots?: string;
  /** Absolute or root-relative social share image. Defaults to the brand card. */
  image?: string;
  /** Open Graph object type. Defaults to "website". */
  type?: string;
  /** Optional breadcrumb trail rendered as BreadcrumbList JSON-LD. */
  breadcrumbs?: Breadcrumb[];
}

const DEFAULT_SOCIAL_IMAGE = "/social-preview.png";

/**
 * Shared SEO head for every route.
 *
 * - Produces a unique title/description per page plus a full Open Graph and
 *   Twitter/X card set so links render correctly on X, Facebook, WhatsApp,
 *   Telegram and LinkedIn.
 * - Emits JSON-LD (Organization + WebSite) that reflects only factual project
 *   information; no ratings, reviews, addresses or financial credentials.
 * - Resolves absolute URLs against the live origin so canonical and social
 *   URLs always match the domain actually being served.
 */
export function Seo({
  title,
  description,
  path,
  keywords,
  robots = "index,follow",
  image,
  type = "website",
  breadcrumbs
}: SeoProps) {
  const baseUrl = (
    (typeof window !== "undefined" && window.location.origin) ||
    (import.meta.env.VITE_APP_BASE_URL as string | undefined) ||
    BRAND.url
  ).replace(/\/$/, "");

  const url = path ? `${baseUrl}${path}` : baseUrl;
  const titleTemplate = `${title} | ${BRAND.name}`;

  const keywordContent =
    keywords && keywords.length > 0 ? keywords.join(", ") : DEFAULT_KEYWORDS.join(", ");

  const imagePath = image ?? DEFAULT_SOCIAL_IMAGE;
  const imageUrl = imagePath.startsWith("http") ? imagePath : `${baseUrl}${imagePath}`;

  const organizationLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND.name,
    url: baseUrl,
    description: BRAND.description,
    logo: `${baseUrl}/logo.svg`,
    sameAs: [
      BRAND.x && BRAND.twitterHandle ? BRAND.x : null,
      BRAND.telegram
    ].filter(Boolean)
  };

  const websiteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND.name,
    url: baseUrl,
    description: BRAND.description,
    publisher: { "@type": "Organization", name: BRAND.name, url: baseUrl }
  };

  const breadcrumbLd =
    breadcrumbs && breadcrumbs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: breadcrumbs.map((crumb, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: crumb.name,
            item: `${baseUrl}${crumb.path}`
          }))
        }
      : null;

  return (
    <Helmet>
      <title>{titleTemplate}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywordContent} />
      <meta name="robots" content={robots} />
      <meta name="author" content={BRAND.name} />
      <link rel="canonical" href={url} />

      <meta property="og:type" content={type} />
      <meta property="og:title" content={titleTemplate} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={`${BRAND.name} — ${BRAND.positioning}`} />
      <meta property="og:site_name" content={BRAND.name} />
      <meta property="og:locale" content="en_US" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={titleTemplate} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:alt" content={`${BRAND.name} — ${BRAND.positioning}`} />
      {BRAND.twitterHandle ? (
        <meta name="twitter:site" content={BRAND.twitterHandle} />
      ) : null}

      <script type="application/ld+json">{JSON.stringify(organizationLd)}</script>
      <script type="application/ld+json">{JSON.stringify(websiteLd)}</script>
      {breadcrumbLd ? (
        <script type="application/ld+json">{JSON.stringify(breadcrumbLd)}</script>
      ) : null}
    </Helmet>
  );
}
