import { Router, Response } from 'express';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../db';
import { CompanyDoc, VerificationStatus } from '../types';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { importLimiter } from '../middleware/rateLimit';
import {
  normalizeCompanyName,
  researchCompanies,
  verifyCareersUrl,
} from '../gemini';

const router = Router();

// All company routes require authentication
router.use(requireAuth);

/**
 * GET /api/companies
 * Fetch user's company directory with search, category filtering, favorites, and pagination
 */
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = new ObjectId(req.user!.userId);
    const { search, category, favoritesOnly, page = '1', limit = '100' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string, 10) || 100));
    const skip = (pageNum - 1) * limitNum;

    const { db } = await connectToDatabase();

    // Base query scoped strictly to authenticated user's private data
    const query: any = { userId };

    if (favoritesOnly === 'true' || favoritesOnly === '1') {
      query.isFavorite = true;
    }

    if (category && typeof category === 'string' && category !== 'All') {
      query.categories = category;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = search.trim();
      query.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { categories: { $regex: searchTerm, $options: 'i' } },
      ];
    }

    // Parallel fetch: matching companies, total matching count, total user count, and category facets
    const [companies, totalFilteredCount, userTotalCount, categoryAgg] = await Promise.all([
      db
        .collection<CompanyDoc>('companies')
        .find(query)
        .sort({ isPinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .toArray(),
      db.collection<CompanyDoc>('companies').countDocuments(query),
      db.collection<CompanyDoc>('companies').countDocuments({ userId }),
      db
        .collection<CompanyDoc>('companies')
        .aggregate([
          { $match: { userId } },
          { $unwind: '$categories' },
          { $group: { _id: '$categories', count: { $sum: 1 } } },
          { $sort: { count: -1, _id: 1 } },
        ])
        .toArray(),
    ]);

    const categoriesList = categoryAgg.map((item) => ({
      name: item._id as string,
      count: item.count as number,
    }));

    res.json({
      companies,
      totalCount: totalFilteredCount,
      userTotalCount,
      categories: categoriesList,
      page: pageNum,
      totalPages: Math.ceil(totalFilteredCount / limitNum) || 1,
    });
  } catch (err: any) {
    console.error('Error fetching companies:', err);
    res.status(500).json({ error: 'Failed to retrieve companies' });
  }
});

/**
 * POST /api/companies/batch
 * Add multiple companies using comma or newline separated names
 */
router.post(
  '/batch',
  importLimiter,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { rawInput } = req.body;
      const userId = new ObjectId(req.user!.userId);

      if (!rawInput || typeof rawInput !== 'string') {
        res.status(400).json({ error: 'Please provide comma or newline separated company names' });
        return;
      }

      // Step 1: Parse input
      // Split by commas, newlines, and semicolons
      const rawNames = rawInput
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const submittedCount = rawNames.length;
      if (submittedCount === 0) {
        res.status(400).json({ error: 'No valid company names found in input' });
        return;
      }

      // Deduplicate within the submitted batch
      const uniqueInBatch = new Map<string, string>(); // normalized -> clean original
      for (const raw of rawNames) {
        const normalized = normalizeCompanyName(raw);
        if (normalized && !uniqueInBatch.has(normalized)) {
          uniqueInBatch.set(normalized, raw);
        }
      }

      const duplicateInSubmission = submittedCount - uniqueInBatch.size;

      const { db } = await connectToDatabase();

      // Step 2: Check duplicates against user's existing directory
      const normalizedNamesArray = Array.from(uniqueInBatch.keys());
      const existingUserCompanies = await db
        .collection<CompanyDoc>('companies')
        .find({
          userId,
          normalizedName: { $in: normalizedNamesArray },
        })
        .toArray();

      const existingNormalizedSet = new Set(
        existingUserCompanies.map((c) => c.normalizedName)
      );

      const namesToResearch: string[] = [];
      for (const [norm, orig] of uniqueInBatch.entries()) {
        if (!existingNormalizedSet.has(norm)) {
          namesToResearch.push(orig);
        }
      }

      const skippedDuplicatesCount = duplicateInSubmission + existingUserCompanies.length;

      if (namesToResearch.length === 0) {
        res.json({
          message: 'All submitted companies already exist in your directory.',
          submittedCount,
          addedCount: 0,
          skippedDuplicatesCount,
          needsReviewCount: 0,
          addedCompanies: [],
        });
        return;
      }

      // Step 3 & 4: Research companies via Gemini + server-side URL verification + categorization
      const researched = await researchCompanies(namesToResearch, db);

      // Step 5: Save new company records for the user
      const companiesToInsert: CompanyDoc[] = [];
      let needsReviewCount = 0;

      for (const item of researched) {
        if (!item.isVerified) {
          needsReviewCount++;
        }

        companiesToInsert.push({
          userId,
          name: item.displayName,
          normalizedName: item.normalizedName,
          careersUrl: item.careersUrl,
          isVerified: item.isVerified,
          verificationStatus: item.verificationStatus,
          categories: item.categories,
          isFavorite: false,
          isPinned: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      let insertedDocs: CompanyDoc[] = [];
      if (companiesToInsert.length > 0) {
        // Prevent race condition duplicates with try/catch on unique index
        try {
          const insertRes = await db.collection<CompanyDoc>('companies').insertMany(companiesToInsert, {
            ordered: false,
          });
          insertedDocs = companiesToInsert.map((doc, idx) => ({
            ...doc,
            _id: insertRes.insertedIds[idx],
          }));
        } catch (insertErr: any) {
          // If partial duplicates occurred, fetch newly added
          console.warn('Some duplicates caught during insertMany:', insertErr.message);
          insertedDocs = await db
            .collection<CompanyDoc>('companies')
            .find({
              userId,
              normalizedName: { $in: companiesToInsert.map((c) => c.normalizedName) },
            })
            .toArray();
        }
      }

      res.status(201).json({
        message: `Successfully processed ${submittedCount} names.`,
        submittedCount,
        addedCount: insertedDocs.length,
        skippedDuplicatesCount: submittedCount - insertedDocs.length,
        needsReviewCount,
        addedCompanies: insertedDocs,
      });
    } catch (err: any) {
      console.error('Error during batch add:', err);
      res.status(500).json({ error: 'Failed to process company batch' });
    }
  }
);

/**
 * PATCH /api/companies/:id/favorite
 * Toggle favorite status
 */
router.patch('/:id/favorite', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = new ObjectId(req.user!.userId);

    if (!id || !ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid company ID' });
      return;
    }

    const { db } = await connectToDatabase();
    const company = await db.collection<CompanyDoc>('companies').findOne({
      _id: new ObjectId(id),
      userId,
    });

    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const newFavoriteState = !company.isFavorite;
    await db.collection<CompanyDoc>('companies').updateOne(
      { _id: new ObjectId(id), userId },
      { $set: { isFavorite: newFavoriteState, updatedAt: new Date() } }
    );

    res.json({
      message: newFavoriteState ? 'Added to favorites' : 'Removed from favorites',
      isFavorite: newFavoriteState,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update favorite status' });
  }
});

/**
 * PATCH /api/companies/:id/pin
 * Toggle pin status
 */
router.patch('/:id/pin', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = new ObjectId(req.user!.userId);

    if (!id || !ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid company ID' });
      return;
    }

    const { db } = await connectToDatabase();
    const company = await db.collection<CompanyDoc>('companies').findOne({
      _id: new ObjectId(id),
      userId,
    });

    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const newPinState = !company.isPinned;
    await db.collection<CompanyDoc>('companies').updateOne(
      { _id: new ObjectId(id), userId },
      { $set: { isPinned: newPinState, updatedAt: new Date() } }
    );

    res.json({
      message: newPinState ? 'Pinned to top' : 'Unpinned',
      isPinned: newPinState,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update pin status' });
  }
});

/**
 * PUT /api/companies/:id
 * Edit company details (careers URL, categories, name)
 */
router.put('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { name, careersUrl, categories } = req.body;
    const userId = new ObjectId(req.user!.userId);

    if (!id || !ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid company ID' });
      return;
    }

    const { db } = await connectToDatabase();
    const company = await db.collection<CompanyDoc>('companies').findOne({
      _id: new ObjectId(id),
      userId,
    });

    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const updateFields: Partial<CompanyDoc> = {
      updatedAt: new Date(),
    };

    if (name && typeof name === 'string' && name.trim()) {
      updateFields.name = name.trim();
      updateFields.normalizedName = normalizeCompanyName(name.trim());
    }

    if (Array.isArray(categories)) {
      updateFields.categories = categories
        .map((c: any) => String(c).trim())
        .filter((c: string) => c.length > 0);
    }

    if (careersUrl !== undefined && typeof careersUrl === 'string') {
      const { cleanedUrl, isVerified } = await verifyCareersUrl(
        careersUrl,
        updateFields.name || company.name
      );
      updateFields.careersUrl = cleanedUrl;
      updateFields.isVerified = isVerified;
      updateFields.verificationStatus = isVerified ? 'verified' : 'manual';
    }

    await db.collection<CompanyDoc>('companies').updateOne(
      { _id: new ObjectId(id), userId },
      { $set: updateFields }
    );

    const updated = await db.collection<CompanyDoc>('companies').findOne({
      _id: new ObjectId(id),
      userId,
    });

    res.json({ message: 'Company updated successfully', company: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update company' });
  }
});

/**
 * DELETE /api/companies/:id
 * Delete company from user's directory
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = new ObjectId(req.user!.userId);

    if (!id || !ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid company ID' });
      return;
    }

    const { db } = await connectToDatabase();
    const result = await db.collection<CompanyDoc>('companies').deleteOne({
      _id: new ObjectId(id),
      userId,
    });

    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    res.json({ message: 'Company removed from directory' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete company' });
  }
});

export default router;
