import dotenv from 'dotenv';
import { Db } from 'mongodb';
import { CanonicalCompanyDoc, VerificationStatus } from './types';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Known third-party job aggregators to reject as "official"
const REJECTED_DOMAINS = [
  'indeed.com',
  'linkedin.com',
  'glassdoor.com',
  'monster.com',
  'naukri.com',
  'ziprecruiter.com',
  'simplyhired.com',
  'careerbuilder.com',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'wikipedia.org',
];

// Standard reference categories to encourage consistent labeling
const STANDARD_CATEGORIES = [
  'Technology',
  'Product-Based Companies',
  'Software',
  'IT Services',
  'Hardware and Semiconductors',
  'Electronics',
  'Design Studios',
  'Automobile',
  'Food and Beverages',
  'Fashion',
  'E-commerce',
  'Finance and Banking',
  'Healthcare',
  'Consulting',
  'Education',
  'Media and Entertainment',
  'Telecommunications',
  'Aerospace',
  'Manufacturing',
  'Consumer Goods',
];

export interface ResearchedCompany {
  originalName: string;
  normalizedName: string;
  displayName: string;
  careersUrl: string;
  isVerified: boolean;
  verificationStatus: VerificationStatus;
  categories: string[];
  country?: string;
  countryCode?: string;
  packageScore?: number;
  packageText?: string;
  popularityScore?: number;
  offerEaseScore?: number;
  hiringDifficulty?: 'Easy' | 'Moderate' | 'Hard' | 'Very Competitive';
}

/**
 * Normalizes company name for consistent lookup (lowercase, stripped punctuation, trimmed)
 */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Performs server-side URL sanity check and network verification
 */
export async function verifyCareersUrl(rawUrl: string, companyName: string): Promise<{
  cleanedUrl: string;
  isVerified: boolean;
  verificationStatus: VerificationStatus;
}> {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { cleanedUrl: '', isVerified: false, verificationStatus: 'needs_verification' };
  }

  let parsed: URL;
  try {
    let toParse = rawUrl.trim();
    if (!toParse.startsWith('http://') && !toParse.startsWith('https://')) {
      toParse = 'https://' + toParse;
    }
    parsed = new URL(toParse);
  } catch {
    return { cleanedUrl: rawUrl, isVerified: false, verificationStatus: 'needs_verification' };
  }

  // Reject third-party job boards / social networks
  const hostname = parsed.hostname.toLowerCase();
  for (const rejected of REJECTED_DOMAINS) {
    if (hostname.includes(rejected)) {
      return {
        cleanedUrl: parsed.toString(),
        isVerified: false,
        verificationStatus: 'needs_verification',
      };
    }
  }

  // Verify domain responds over HTTPS/HTTP
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(parsed.toString(), {
      method: 'HEAD',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // Accept 2xx, 3xx, or 403 (many career sites have Cloudflare / bot protection blocking HEAD/curl)
    if (res.ok || (res.status >= 300 && res.status < 400) || res.status === 403 || res.status === 401) {
      return {
        cleanedUrl: parsed.toString(),
        isVerified: true,
        verificationStatus: 'verified',
      };
    }

    if (res.status === 404) {
      return {
        cleanedUrl: parsed.toString(),
        isVerified: false,
        verificationStatus: 'needs_verification',
      };
    }

    // Default to verified if valid hostname reached
    return {
      cleanedUrl: parsed.toString(),
      isVerified: true,
      verificationStatus: 'verified',
    };
  } catch (err) {
    // If network timeout or DNS failure, keep URL but flag for verification
    return {
      cleanedUrl: parsed.toString(),
      isVerified: false,
      verificationStatus: 'needs_verification',
    };
  }
}

/**
 * Call Gemini to find official career URLs and 1-3 categories for a batch of companies
 */
async function callGeminiForCompanies(companyNames: string[]): Promise<
  Array<{
    company: string;
    careersUrl: string;
    categories: string[];
    country?: string;
    countryCode?: string;
    packageScore?: number;
    packageText?: string;
    popularityScore?: number;
    offerEaseScore?: number;
    hiringDifficulty?: 'Easy' | 'Moderate' | 'Hard' | 'Very Competitive';
  }>
> {
  if (!GEMINI_API_KEY) {
    console.warn('⚠️ Gemini API key is missing. Using fallback discovery.');
    return companyNames.map((name) => ({
      company: name,
      careersUrl: `https://${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com/careers`,
      categories: ['Technology'],
      country: 'United States',
      countryCode: 'US',
      packageScore: 60,
      packageText: 'Competitive',
      popularityScore: 60,
      offerEaseScore: 50,
      hiringDifficulty: 'Moderate',
    }));
  }

  const prompt = `You are an expert career research AI. For each of the following company names, determine:
1. The company's canonical official display name.
2. The company's official, direct working careers or job portal page URL (intended for job seekers, prefer official company domains like https://careers.google.com/ or https://www.apple.com/jobs/us/, NOT general homepages if a careers page exists, NEVER invent URLs, NEVER provide third-party job boards like LinkedIn, Indeed, Glassdoor). If unsure, provide the best known official domain careers page.
3. 1 to 3 relevant industry categories from this standard list or closely related:
${STANDARD_CATEGORIES.map((c) => `- ${c}`).join('\n')}
4. The company's country of origin / global headquarters country name (e.g. 'United States', 'India', 'Germany', 'Japan', 'United Kingdom', etc.) and its 2-letter uppercase ISO 3166-1 alpha-2 country code (e.g. 'US', 'IN', 'DE', 'JP', 'GB').
5. Career compensation score packageScore (integer 1-100, where 85-100 is high packages like top tech/HFT/finance, 60-84 is competitive, 25-59 is standard) and packageText (e.g. "High Package", "Competitive", "Standard").
6. Brand popularity score popularityScore (integer 1-100, where 90-100 is globally renowned giants, 50-89 is well known, 10-49 is niche/hidden gems).
7. Hiring accessibility / offer ease score offerEaseScore (integer 1-100, where 75-100 means large-scale hiring / easiest to get an offer, 40-74 is moderate, 10-39 is highly selective) and hiringDifficulty ("Easy" | "Moderate" | "Hard" | "Very Competitive").

Companies to research:
${companyNames.join(', ')}

Return a strict JSON array of objects with the exact format:
[
  {
    "company": "Canonical Name",
    "careersUrl": "https://...",
    "categories": ["Category 1", "Category 2"],
    "country": "Country Name",
    "countryCode": "XX",
    "packageScore": 85,
    "packageText": "High Package",
    "popularityScore": 90,
    "offerEaseScore": 30,
    "hiringDifficulty": "Competitive"
  }
]`;

  const models = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.8-flash'];
  let lastError: any = null;

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Gemini model ${model} returned status ${response.status}:`, errorText);
        lastError = new Error(`Gemini error: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('No text candidate in Gemini response');
      }

      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (err: any) {
      console.warn(`Attempt with ${model} failed:`, err.message);
      lastError = err;
    }
  }

  console.error('All Gemini models failed. Using intelligent fallback.', lastError?.message);
  // Fallback if API fails or quota exceeded
  return companyNames.map((name) => ({
    company: name,
    careersUrl: `https://${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com/careers`,
    categories: ['Technology'],
  }));
}

/**
 * Researches a list of company names, checking canonical cache first, then querying Gemini,
 * and performing server-side URL verification.
 */
export async function researchCompanies(
  names: string[],
  db: Db
): Promise<ResearchedCompany[]> {
  const results: ResearchedCompany[] = [];
  const uncachedNames: string[] = [];
  const nameMap = new Map<string, string>(); // normalized -> original

  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const normalized = normalizeCompanyName(trimmed);
    if (!nameMap.has(normalized)) {
      nameMap.set(normalized, trimmed);
    }
  }

  // 1. Check canonical cache collection
  const normalizedList = Array.from(nameMap.keys());
  const canonicalMatches = await db
    .collection<CanonicalCompanyDoc>('canonical_companies')
    .find({ normalizedName: { $in: normalizedList } })
    .toArray();

  const cachedMap = new Map<string, CanonicalCompanyDoc>();
  for (const doc of canonicalMatches) {
    cachedMap.set(doc.normalizedName, doc);
  }

  for (const normalized of normalizedList) {
    const original = nameMap.get(normalized)!;
    if (cachedMap.has(normalized)) {
      const cached = cachedMap.get(normalized)!;
      results.push({
        originalName: original,
        normalizedName: normalized,
        displayName: cached.name,
        careersUrl: cached.careersUrl,
        isVerified: cached.isVerified,
        verificationStatus: cached.isVerified ? 'verified' : 'needs_verification',
        categories: cached.categories || ['Technology'],
        country: cached.country || 'United States',
        countryCode: cached.countryCode || 'US',
        packageScore: cached.packageScore || 65,
        packageText: cached.packageText || 'Competitive',
        popularityScore: cached.popularityScore || 65,
        offerEaseScore: cached.offerEaseScore || 50,
        hiringDifficulty: cached.hiringDifficulty || 'Moderate',
      });
    } else {
      uncachedNames.push(original);
    }
  }

  // 2. Query Gemini for uncached companies in batches of 10
  if (uncachedNames.length > 0) {
    const batchSize = 10;
    for (let i = 0; i < uncachedNames.length; i += batchSize) {
      const batch = uncachedNames.slice(i, i + batchSize);
      try {
        const geminiResults = await callGeminiForCompanies(batch);

        // Verify and process each company
        for (const item of geminiResults) {
          const original = item.company || 'Unknown';
          const normalized = normalizeCompanyName(original);
          const rawUrl = item.careersUrl || '';

          // URL sanity & verification
          const { cleanedUrl, isVerified, verificationStatus } = await verifyCareersUrl(
            rawUrl,
            original
          );

          // Clean up categories
          const categories = (item.categories || [])
            .map((c) => c.trim())
            .filter((c) => c.length > 0);
          if (categories.length === 0) {
            categories.push('Technology');
          }

          const researched: ResearchedCompany = {
            originalName: original,
            normalizedName: normalized,
            displayName: item.company || original,
            careersUrl: cleanedUrl,
            isVerified,
            verificationStatus,
            categories,
            country: item.country || 'United States',
            countryCode: (item.countryCode || 'US').toUpperCase(),
            packageScore: typeof item.packageScore === 'number' ? item.packageScore : 65,
            packageText: item.packageText || 'Competitive',
            popularityScore: typeof item.popularityScore === 'number' ? item.popularityScore : 65,
            offerEaseScore: typeof item.offerEaseScore === 'number' ? item.offerEaseScore : 50,
            hiringDifficulty: item.hiringDifficulty || 'Moderate',
          };

          results.push(researched);

          // Store in canonical_companies cache so future imports are instant
          await db.collection<CanonicalCompanyDoc>('canonical_companies').updateOne(
            { normalizedName: normalized },
            {
              $set: {
                name: researched.displayName,
                normalizedName: normalized,
                careersUrl: researched.careersUrl,
                isVerified: researched.isVerified,
                categories: researched.categories,
                country: researched.country,
                countryCode: researched.countryCode,
                packageScore: researched.packageScore,
                packageText: researched.packageText,
                popularityScore: researched.popularityScore,
                offerEaseScore: researched.offerEaseScore,
                hiringDifficulty: researched.hiringDifficulty,
                updatedAt: new Date(),
              },
              $setOnInsert: {
                createdAt: new Date(),
              },
            },
            { upsert: true }
          );
        }
      } catch (err: any) {
        console.error('Error processing batch with Gemini:', err.message);
        // Fallback for remaining batch
        for (const name of batch) {
          const normalized = normalizeCompanyName(name);
          results.push({
            originalName: name,
            normalizedName: normalized,
            displayName: name,
            careersUrl: `https://${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com/careers`,
            isVerified: false,
            verificationStatus: 'needs_verification',
            categories: ['Technology'],
            country: 'United States',
            countryCode: 'US',
          });
        }
      }
    }
  }

  return results;
}
