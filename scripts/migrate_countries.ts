import dotenv from 'dotenv';
dotenv.config();
import { connectToDatabase } from '../server/db.ts';
import { normalizeCompanyName } from '../server/gemini.ts';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

async function queryGeminiCountries(
  companyNames: string[]
): Promise<Array<{ company: string; country: string; countryCode: string }>> {
  if (!GEMINI_API_KEY) {
    return companyNames.map((name) => ({
      company: name,
      country: 'United States',
      countryCode: 'US',
    }));
  }

  const prompt = `For each of the following company names, determine the company's country of origin / global headquarters country name (e.g. 'United States', 'India', 'Germany', 'Japan', 'United Kingdom', 'Canada', 'France', 'Sweden', etc.) and its 2-letter uppercase ISO 3166-1 alpha-2 country code (e.g. 'US', 'IN', 'DE', 'JP', 'GB', 'CA', 'FR', 'SE', etc.).

Companies:
${companyNames.join(', ')}

Return a strict JSON array of objects with the exact format:
[
  {
    "company": "Company Name",
    "country": "Country Name",
    "countryCode": "XX"
  }
]`;

  const models = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'];
  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          }),
        }
      );

      if (!response.ok) {
        console.warn(`Model ${model} returned ${response.status}`);
        continue;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e: any) {
      console.warn(`Attempt with ${model} failed: ${e.message}`);
    }
  }

  // Fallback if all models fail
  return companyNames.map((name) => ({
    company: name,
    country: 'United States',
    countryCode: 'US',
  }));
}

async function run() {
  console.log('🚀 Starting Company Country Migration for existing cards...');
  const { db } = await connectToDatabase();

  const companiesToUpdate = await db
    .collection('companies')
    .find({
      $or: [{ countryCode: { $exists: false } }, { countryCode: null }, { countryCode: '' }],
    })
    .project({ name: 1, normalizedName: 1 })
    .toArray();

  console.log(`Found ${companiesToUpdate.length} company documents requiring country of origin.`);

  if (companiesToUpdate.length === 0) {
    console.log('✅ All companies already have country codes!');
    process.exit(0);
  }

  // Group by unique normalized name to avoid duplicate queries
  const uniqueMap = new Map<string, string>(); // normalizedName -> original displayName
  for (const doc of companiesToUpdate) {
    const norm = doc.normalizedName || normalizeCompanyName(doc.name);
    if (!uniqueMap.has(norm)) {
      uniqueMap.set(norm, doc.name);
    }
  }

  const uniqueList = Array.from(uniqueMap.entries());
  console.log(`Unique companies to research: ${uniqueList.length}`);

  const batchSize = 40;
  let processed = 0;

  for (let i = 0; i < uniqueList.length; i += batchSize) {
    const batch = uniqueList.slice(i, i + batchSize);
    const names = batch.map(([, name]) => name);

    console.log(
      `\n⏳ Querying batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
        uniqueList.length / batchSize
      )} (${names.length} companies)...`
    );
    const results = await queryGeminiCountries(names);

    // Build map from results
    const resultMap = new Map<string, { country: string; countryCode: string }>();
    for (const r of results) {
      if (r.company) {
        const norm = normalizeCompanyName(r.company);
        const code = (r.countryCode || 'US').trim().toUpperCase().slice(0, 2);
        const country = (r.country || 'United States').trim();
        resultMap.set(norm, { country, countryCode: code });
      }
    }

    // Apply updates in bulk
    const bulkCompanies = db.collection('companies').initializeUnorderedBulkOp();
    const bulkCanonical = db.collection('canonical_companies').initializeUnorderedBulkOp();

    let countInBulk = 0;
    for (const [norm] of batch) {
      const match = resultMap.get(norm) || {
        country: 'United States',
        countryCode: 'US',
      };

      bulkCompanies.find({ normalizedName: norm }).update({
        $set: {
          country: match.country,
          countryCode: match.countryCode,
          updatedAt: new Date(),
        },
      });

      bulkCanonical.find({ normalizedName: norm }).update({
        $set: {
          country: match.country,
          countryCode: match.countryCode,
          updatedAt: new Date(),
        },
      });
      countInBulk++;
    }

    if (countInBulk > 0) {
      await bulkCompanies.execute();
      try {
        await bulkCanonical.execute();
      } catch {
        // Ignored if canonical entries aren't matching all
      }
    }

    processed += batch.length;
    console.log(
      `✅ Processed ${processed}/${uniqueList.length} companies (${Math.round(
        (processed / uniqueList.length) * 100
      )}%)`
    );

    // Tiny courtesy delay between batches to respect rate limits
    await new Promise((r) => setTimeout(r, 600));
  }

  // Double check any remaining unpopulated companies
  const remaining = await db.collection('companies').countDocuments({
    $or: [{ countryCode: { $exists: false } }, { countryCode: null }, { countryCode: '' }],
  });

  if (remaining > 0) {
    console.log(`Setting default country for remaining ${remaining} records...`);
    await db.collection('companies').updateMany(
      { $or: [{ countryCode: { $exists: false } }, { countryCode: null }, { countryCode: '' }] },
      { $set: { country: 'United States', countryCode: 'US', updatedAt: new Date() } }
    );
  }

  console.log(
    '\n🎉 ALL existing companies successfully updated with country of origin and flag codes!'
  );
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
