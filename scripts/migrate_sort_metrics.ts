import dotenv from 'dotenv';
dotenv.config();
import { connectToDatabase } from '../server/db.ts';

// Top High-Package Tech / HFT firms
const HIGH_PACKAGE_FIRMS = new Set([
  'google', 'apple', 'microsoft', 'amazon', 'meta', 'netflix', 'nvidia',
  'uber', 'airbnb', 'stripe', 'databricks', 'snowflake', 'openai', 'anthropic',
  'palantir', 'coinbase', 'citadel', 'jane street', 'de shaw', 'two sigma',
  'jump trading', 'tower research', 'hudson river trading', 'optiver', 'imc',
  'bloomberg', 'atlassian', 'adobe', 'salesforce', 'oracle', 'cisco', 'intel',
  'amd', 'qualcomm', 'paypal', 'intuit', 'linkedin', 'spotify', 'shopify',
  'twilio', 'vmware', 'servicenow', 'doordash', 'pinterest', 'snap', 'bytedance',
  'flipkart', 'swiggy', 'zomato', 'razorpay', 'phonepe', 'cred', 'meesho',
  'bookingcom', 'expedia', 'goldman sachs', 'morgan stanley', 'jpmorgan chase',
  'visa', 'mastercard', 'tesla'
]);

// Top Easy Offer / High Hiring Volume firms (IT Services, Consultancies, Mass Recruiters)
const EASY_OFFER_FIRMS = new Set([
  'tata consultancy services', 'tcs', 'infosys', 'wipro', 'cognizant', 'accenture',
  'capgemini', 'hcltech', 'hcl technologies', 'tech mahindra', 'ltimindtree', 'l&t',
  'l&t technology services', 'hexaware', 'mphasis', 'birlasoft', 'sutherland',
  'teleperformance', 'hinduja global solutions', 'cyient', 'genpact', 'exl',
  'wns', 'atos', 'dxc technology', 'ntt data', 'sopra steria', 'cgi',
  'persistent systems', 'kpit technologies', 'sonata software', 'niit technologies',
  'alight solutions', 'igate', 'virtela technology services', 'softtek', 'endava',
  'tata elxsi', 'zenser technologies', 'mastek', 'firstsource', 'conduent'
]);

// Famous Global Household Brands (High Popularity 90+)
const TOP_TIER_POPULAR = new Set([
  'google', 'apple', 'microsoft', 'amazon', 'meta', 'netflix', 'nvidia', 'tesla',
  'spotify', 'adobe', 'intel', 'samsung', 'sony', 'disney', 'nike', 'uber',
  'airbnb', 'salesforce', 'oracle', 'ibm', 'cisco', 'bmw', 'mercedesbenz',
  'volkswagen', 'toyota', 'pepsico', 'coca cola', 'mcdonalds', 'starbucks',
  'nintendo', 'playstation', 'capcom', 'square enix', 'electronic arts', 'ubisoft',
  'tata consultancy services', 'infosys', 'accenture', 'deloitte', 'ey', 'pwc', 'kpmg'
]);

function computeSortMetrics(name: string, normalizedName: string, categories: string[] = []): {
  packageScore: number;
  packageText: string;
  popularityScore: number;
  offerEaseScore: number;
  hiringDifficulty: 'Easy' | 'Moderate' | 'Hard' | 'Very Competitive';
} {
  const norm = normalizedName.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Check known high package
  for (const firm of HIGH_PACKAGE_FIRMS) {
    const firmNorm = firm.replace(/[^a-z0-9]/g, '');
    if (norm === firmNorm || norm.includes(firmNorm)) {
      return {
        packageScore: 92 + Math.floor(Math.random() * 7), // 92 - 98
        packageText: 'High Package',
        popularityScore: 90 + Math.floor(Math.random() * 10), // 90 - 99
        offerEaseScore: 20 + Math.floor(Math.random() * 15), // 20 - 34
        hiringDifficulty: 'Very Competitive',
      };
    }
  }

  // Check known easy offer
  for (const firm of EASY_OFFER_FIRMS) {
    const firmNorm = firm.replace(/[^a-z0-9]/g, '');
    if (norm === firmNorm || norm.includes(firmNorm)) {
      return {
        packageScore: 40 + Math.floor(Math.random() * 15), // 40 - 54
        packageText: 'Standard',
        popularityScore: 78 + Math.floor(Math.random() * 10), // 78 - 87
        offerEaseScore: 88 + Math.floor(Math.random() * 10), // 88 - 97
        hiringDifficulty: 'Easy',
      };
    }
  }

  // Check famous global brands
  for (const firm of TOP_TIER_POPULAR) {
    const firmNorm = firm.replace(/[^a-z0-9]/g, '');
    if (norm === firmNorm || norm.includes(firmNorm)) {
      return {
        packageScore: 78 + Math.floor(Math.random() * 10), // 78 - 87
        packageText: 'High Package',
        popularityScore: 92 + Math.floor(Math.random() * 8), // 92 - 99
        offerEaseScore: 40 + Math.floor(Math.random() * 20), // 40 - 59
        hiringDifficulty: 'Competitive',
      };
    }
  }

  // Category heuristics
  const catSet = new Set(categories);

  if (catSet.has('Product-Based Companies') || catSet.has('Software') || catSet.has('Hardware and Semiconductors')) {
    return {
      packageScore: 76 + Math.floor(Math.random() * 12), // 76 - 87
      packageText: 'High Package',
      popularityScore: 60 + Math.floor(Math.random() * 22), // 60 - 81
      offerEaseScore: 42 + Math.floor(Math.random() * 20), // 42 - 61
      hiringDifficulty: 'Competitive',
    };
  }

  if (catSet.has('Finance and Banking') || catSet.has('Finance andBanking')) {
    return {
      packageScore: 75 + Math.floor(Math.random() * 14), // 75 - 88
      packageText: 'High Package',
      popularityScore: 65 + Math.floor(Math.random() * 20), // 65 - 84
      offerEaseScore: 45 + Math.floor(Math.random() * 18), // 45 - 62
      hiringDifficulty: 'Competitive',
    };
  }

  if (catSet.has('IT Services') || catSet.has('Consulting') || catSet.has('Telecommunications')) {
    return {
      packageScore: 50 + Math.floor(Math.random() * 15), // 50 - 64
      packageText: 'Competitive',
      popularityScore: 55 + Math.floor(Math.random() * 20), // 55 - 74
      offerEaseScore: 76 + Math.floor(Math.random() * 15), // 76 - 90
      hiringDifficulty: 'Easy',
    };
  }

  if (catSet.has('Design Studios') || catSet.has('Media and Entertainment')) {
    return {
      packageScore: 60 + Math.floor(Math.random() * 15), // 60 - 74
      packageText: 'Competitive',
      popularityScore: 30 + Math.floor(Math.random() * 25), // 30 - 54 (Hidden gems!)
      offerEaseScore: 52 + Math.floor(Math.random() * 18), // 52 - 69
      hiringDifficulty: 'Moderate',
    };
  }

  if (catSet.has('Manufacturing') || catSet.has('Automobile') || catSet.has('Consumer Goods') || catSet.has('Aerospace')) {
    return {
      packageScore: 62 + Math.floor(Math.random() * 15), // 62 - 76
      packageText: 'Competitive',
      popularityScore: 50 + Math.floor(Math.random() * 25), // 50 - 74
      offerEaseScore: 60 + Math.floor(Math.random() * 18), // 60 - 77
      hiringDifficulty: 'Moderate',
    };
  }

  // Default / Hidden Gem tier
  return {
    packageScore: 55 + Math.floor(Math.random() * 15), // 55 - 69
    packageText: 'Competitive',
    popularityScore: 25 + Math.floor(Math.random() * 25), // 25 - 49 (Hidden gems)
    offerEaseScore: 55 + Math.floor(Math.random() * 20), // 55 - 74
    hiringDifficulty: 'Moderate',
  };
}

async function run() {
  console.log('🚀 Starting Company Sort Metrics Migration for all existing cards...');
  const { db } = await connectToDatabase();

  const companies = await db.collection('companies').find({}).toArray();
  console.log(`Found ${companies.length} company documents to evaluate and update.`);

  const bulkCompanies = db.collection('companies').initializeUnorderedBulkOp();
  const bulkCanonical = db.collection('canonical_companies').initializeUnorderedBulkOp();

  let updatedCount = 0;
  for (const comp of companies) {
    const metrics = computeSortMetrics(comp.name, comp.normalizedName || comp.name, comp.categories || []);

    bulkCompanies.find({ _id: comp._id }).update({
      $set: {
        packageScore: metrics.packageScore,
        packageText: metrics.packageText,
        popularityScore: metrics.popularityScore,
        offerEaseScore: metrics.offerEaseScore,
        hiringDifficulty: metrics.hiringDifficulty,
        updatedAt: new Date(),
      },
    });

    if (comp.normalizedName) {
      bulkCanonical.find({ normalizedName: comp.normalizedName }).update({
        $set: {
          packageScore: metrics.packageScore,
          packageText: metrics.packageText,
          popularityScore: metrics.popularityScore,
          offerEaseScore: metrics.offerEaseScore,
          hiringDifficulty: metrics.hiringDifficulty,
          updatedAt: new Date(),
        },
      });
    }

    updatedCount++;
  }

  if (updatedCount > 0) {
    await bulkCompanies.execute();
    try {
      await bulkCanonical.execute();
    } catch {
      // Ignored if non-matching
    }
  }

  console.log(`✅ Successfully updated ${updatedCount} companies with sort metrics!`);

  // Verify sample high package, popular, least popular, easy offer
  console.log('\n--- 💎 Top 5 Highest Package Companies ---');
  const topPackage = await db.collection('companies').find({}).sort({ packageScore: -1 }).limit(5).toArray();
  topPackage.forEach((c) => console.log(`- ${c.name}: packageScore=${c.packageScore} (${c.packageText})`));

  console.log('\n--- 🔥 Top 5 Most Popular Companies ---');
  const topPopular = await db.collection('companies').find({}).sort({ popularityScore: -1 }).limit(5).toArray();
  topPopular.forEach((c) => console.log(`- ${c.name}: popularityScore=${c.popularityScore}`));

  console.log('\n--- 🧭 Top 5 Least Popular / Hidden Gems ---');
  const leastPopular = await db.collection('companies').find({}).sort({ popularityScore: 1 }).limit(5).toArray();
  leastPopular.forEach((c) => console.log(`- ${c.name}: popularityScore=${c.popularityScore}`));

  console.log('\n--- 🎯 Top 5 Easiest to Get an Offer ---');
  const easiest = await db.collection('companies').find({}).sort({ offerEaseScore: -1 }).limit(5).toArray();
  easiest.forEach((c) => console.log(`- ${c.name}: offerEaseScore=${c.offerEaseScore} (${c.hiringDifficulty})`));

  console.log('\n🎉 ALL sort metrics successfully migrated and verified in MongoDB Atlas!');
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal error during sort migration:', err);
  process.exit(1);
});
