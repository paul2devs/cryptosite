import { Helmet } from "react-helmet-async";

interface SeoProps {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
  robots?: string;
}

export function Seo({
  title,
  description,
  path,
  keywords,
  robots = "index,follow"
}: SeoProps) {
  const baseUrl =
    (typeof window !== "undefined" && window.location.origin) ||
    (import.meta.env.VITE_APP_BASE_URL as string | undefined) ||
    "https://cryptolevels.app";

  const url = path ? `${baseUrl}${path}` : baseUrl;
  const titleTemplate = `${title} | Crypto Levels – Custodial Crypto Growth Platform`;

  const keywordContent =
    keywords && keywords.length > 0
      ? keywords.join(", ")
      : "crypto rewards, crypto multipliers, bitcoin deposits, ethereum yields, custodial crypto platform, crypto levels, staking alternative, secure crypto growth";

  const imageUrl = `${baseUrl}/social-preview.svg`;

  return (
    <Helmet>
      <title>{titleTemplate}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywordContent} />
      <meta name="robots" content={robots} />
      <meta name="author" content="Crypto Levels Platform" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="canonical" href={url} />

      <meta property="og:type" content="website" />
      <meta property="og:title" content={titleTemplate} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:site_name" content="Crypto Levels" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={titleTemplate} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
    </Helmet>
  );
}

