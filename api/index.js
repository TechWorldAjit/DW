// server/app.ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

// server/routes/auth.ts
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt2 from "jsonwebtoken";

// server/db.ts
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();
var uri = process.env.MONGO_URI || "";
if (!uri) {
  console.warn("\u26A0\uFE0F Warning: MONGO_URI is not set in environment variables");
}
var cachedClient = null;
var cachedDb = null;
async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }
  if (!uri) {
    throw new Error("MONGO_URI is missing from environment variables");
  }
  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 8e3
  });
  await client.connect();
  const db = client.db("company_career_directory");
  cachedClient = client;
  cachedDb = db;
  initIndexes(db).catch((err) => console.error("Error creating indexes:", err));
  return { client, db };
}
var indexesCreated = false;
async function initIndexes(db) {
  if (indexesCreated) return;
  try {
    await db.collection("users").createIndex(
      { normalizedUsername: 1 },
      { unique: true, background: true }
    );
    await db.collection("companies").createIndex(
      { userId: 1, normalizedName: 1 },
      { unique: true, background: true }
    );
    await db.collection("companies").createIndex(
      { userId: 1, isPinned: -1, createdAt: -1 },
      { background: true }
    );
    await db.collection("companies").createIndex(
      { userId: 1, isFavorite: 1 },
      { background: true }
    );
    await db.collection("companies").createIndex(
      { userId: 1, categories: 1 },
      { background: true }
    );
    await db.collection("canonical_companies").createIndex(
      { normalizedName: 1 },
      { unique: true, background: true }
    );
    await db.collection("settings").createIndex(
      { key: 1 },
      { unique: true, background: true }
    );
    indexesCreated = true;
    console.log("\u2705 MongoDB indexes ensured successfully");
  } catch (err) {
    console.error("Failed to create indexes:", err.message);
  }
}

// server/middleware/auth.ts
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
var JWT_SECRET = process.env.JWT_SECRET || "mySuperSecretKey123";
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const payload = jwt.verify(token, JWT_SECRET);
    const { db } = await connectToDatabase();
    const user = await db.collection("users").findOne({
      _id: new ObjectId(payload.userId)
    });
    if (!user) {
      res.status(401).json({ error: "User no longer exists" });
      return;
    }
    if (user.isActive === false) {
      res.status(403).json({ error: "Account has been disabled. Please contact the administrator." });
      return;
    }
    req.user = {
      userId: user._id.toString(),
      username: user.username,
      role: user.role
    };
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired session token" });
  }
}
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Administrator access required" });
    return;
  }
  next();
}

// server/middleware/rateLimit.ts
import rateLimit from "express-rate-limit";
var loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 30,
  // 30 login attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again after 15 minutes." }
});
var importLimiter = rateLimit({
  windowMs: 5 * 60 * 1e3,
  // 5 minutes
  max: 50,
  // 50 import requests per 5 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many company import requests. Please slow down and try again shortly." }
});

// server/routes/auth.ts
var router = Router();
var JWT_SECRET2 = process.env.JWT_SECRET || "mySuperSecretKey123";
function generateToken(payload) {
  return jwt2.sign(payload, JWT_SECRET2, { expiresIn: "7d" });
}
function setAuthCookie(res, token) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("token", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1e3,
    // 7 days
    path: "/"
  });
}
router.get("/registration-status", async (_req, res) => {
  try {
    const { db } = await connectToDatabase();
    const count = await db.collection("users").countDocuments();
    if (count === 0) {
      res.json({ registrationEnabled: true, isInitialSetup: true });
      return;
    }
    const setting = await db.collection("settings").findOne({ key: "registration_enabled" });
    const enabled = setting ? Boolean(setting.value) : true;
    res.json({ registrationEnabled: enabled, isInitialSetup: false });
  } catch (err) {
    res.status(500).json({ error: "Failed to check registration status" });
  }
});
router.post("/register", async (req, res) => {
  try {
    const { username, password, confirmPassword } = req.body;
    if (!username || typeof username !== "string" || !username.trim()) {
      res.status(400).json({ error: "Username is required" });
      return;
    }
    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3) {
      res.status(400).json({ error: "Username must be at least 3 characters long" });
      return;
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters long" });
      return;
    }
    if (password !== confirmPassword) {
      res.status(400).json({ error: "Passwords do not match" });
      return;
    }
    const { db } = await connectToDatabase();
    const normalizedUsername = trimmedUsername.toLowerCase();
    const totalUsers = await db.collection("users").countDocuments();
    if (totalUsers > 0) {
      const setting = await db.collection("settings").findOne({ key: "registration_enabled" });
      const enabled = setting ? Boolean(setting.value) : true;
      if (!enabled) {
        res.status(403).json({
          error: "Public registration is currently disabled by the administrator."
        });
        return;
      }
    }
    const existing = await db.collection("users").findOne({ normalizedUsername });
    if (existing) {
      res.status(400).json({ error: "Username is already taken" });
      return;
    }
    const role = totalUsers === 0 ? "admin" : "user";
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    const newUser = {
      username: trimmedUsername,
      normalizedUsername,
      passwordHash,
      role,
      isActive: true,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    const insertResult = await db.collection("users").insertOne(newUser);
    const userId = insertResult.insertedId.toString();
    if (totalUsers === 0) {
      await db.collection("settings").updateOne(
        { key: "registration_enabled" },
        { $set: { value: true, updatedAt: /* @__PURE__ */ new Date() } },
        { upsert: true }
      );
    }
    const token = generateToken({
      userId,
      username: trimmedUsername,
      role
    });
    setAuthCookie(res, token);
    res.status(201).json({
      message: "Account created successfully",
      user: {
        id: userId,
        username: trimmedUsername,
        role
      }
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Server error during registration" });
  }
});
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }
    const { db } = await connectToDatabase();
    const normalizedUsername = username.trim().toLowerCase();
    const user = await db.collection("users").findOne({ normalizedUsername });
    if (!user) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }
    if (user.isActive === false) {
      res.status(403).json({ error: "Account has been disabled. Please contact the administrator." });
      return;
    }
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }
    const token = generateToken({
      userId: user._id.toString(),
      username: user.username,
      role: user.role
    });
    setAuthCookie(res, token);
    res.json({
      message: "Login successful",
      user: {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
        isTempPassword: Boolean(user.isTempPassword)
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});
router.post("/logout", (_req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    path: "/"
  });
  res.json({ message: "Logged out successfully" });
});
router.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});
var auth_default = router;

// server/routes/companies.ts
import { Router as Router2 } from "express";
import { ObjectId as ObjectId2 } from "mongodb";

// server/gemini.ts
import dotenv2 from "dotenv";
dotenv2.config();
var GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
var REJECTED_DOMAINS = [
  "indeed.com",
  "linkedin.com",
  "glassdoor.com",
  "monster.com",
  "naukri.com",
  "ziprecruiter.com",
  "simplyhired.com",
  "careerbuilder.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "wikipedia.org"
];
var STANDARD_CATEGORIES = [
  "Technology",
  "Product-Based Companies",
  "Software",
  "IT Services",
  "Hardware and Semiconductors",
  "Electronics",
  "Design Studios",
  "Automobile",
  "Food and Beverages",
  "Fashion",
  "E-commerce",
  "Finance and Banking",
  "Healthcare",
  "Consulting",
  "Education",
  "Media and Entertainment",
  "Telecommunications",
  "Aerospace",
  "Manufacturing",
  "Consumer Goods"
];
function normalizeCompanyName(name) {
  return name.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}
async function verifyCareersUrl(rawUrl, companyName) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { cleanedUrl: "", isVerified: false, verificationStatus: "needs_verification" };
  }
  let parsed;
  try {
    let toParse = rawUrl.trim();
    if (!toParse.startsWith("http://") && !toParse.startsWith("https://")) {
      toParse = "https://" + toParse;
    }
    parsed = new URL(toParse);
  } catch {
    return { cleanedUrl: rawUrl, isVerified: false, verificationStatus: "needs_verification" };
  }
  const hostname = parsed.hostname.toLowerCase();
  for (const rejected of REJECTED_DOMAINS) {
    if (hostname.includes(rejected)) {
      return {
        cleanedUrl: parsed.toString(),
        isVerified: false,
        verificationStatus: "needs_verification"
      };
    }
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(parsed.toString(), {
      method: "HEAD",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      redirect: "follow",
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok || res.status >= 300 && res.status < 400 || res.status === 403 || res.status === 401) {
      return {
        cleanedUrl: parsed.toString(),
        isVerified: true,
        verificationStatus: "verified"
      };
    }
    if (res.status === 404) {
      return {
        cleanedUrl: parsed.toString(),
        isVerified: false,
        verificationStatus: "needs_verification"
      };
    }
    return {
      cleanedUrl: parsed.toString(),
      isVerified: true,
      verificationStatus: "verified"
    };
  } catch (err) {
    return {
      cleanedUrl: parsed.toString(),
      isVerified: false,
      verificationStatus: "needs_verification"
    };
  }
}
async function callGeminiForCompanies(companyNames) {
  if (!GEMINI_API_KEY) {
    console.warn("\u26A0\uFE0F Gemini API key is missing. Using fallback discovery.");
    return companyNames.map((name) => ({
      company: name,
      careersUrl: `https://${name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com/careers`,
      categories: ["Technology"]
    }));
  }
  const prompt = `You are an expert career research AI. For each of the following company names, determine:
1. The company's canonical official display name.
2. The company's official, direct working careers or job portal page URL (intended for job seekers, prefer official company domains like https://careers.google.com/ or https://www.apple.com/jobs/us/, NOT general homepages if a careers page exists, NEVER invent URLs, NEVER provide third-party job boards like LinkedIn, Indeed, Glassdoor). If unsure, provide the best known official domain careers page.
3. 1 to 3 relevant industry categories from this standard list or closely related:
${STANDARD_CATEGORIES.map((c) => `- ${c}`).join("\n")}

Companies to research:
${companyNames.join(", ")}

Return a strict JSON array of objects with the exact format:
[
  {
    "company": "Canonical Name",
    "careersUrl": "https://...",
    "categories": ["Category 1", "Category 2"]
  }
]`;
  const models = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-flash-latest", "gemini-3.8-flash"];
  let lastError = null;
  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }]
              }
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2
            }
          })
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
        throw new Error("No text candidate in Gemini response");
      }
      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (err) {
      console.warn(`Attempt with ${model} failed:`, err.message);
      lastError = err;
    }
  }
  console.error("All Gemini models failed. Using intelligent fallback.", lastError?.message);
  return companyNames.map((name) => ({
    company: name,
    careersUrl: `https://${name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com/careers`,
    categories: ["Technology"]
  }));
}
async function researchCompanies(names, db) {
  const results = [];
  const uncachedNames = [];
  const nameMap = /* @__PURE__ */ new Map();
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const normalized = normalizeCompanyName(trimmed);
    if (!nameMap.has(normalized)) {
      nameMap.set(normalized, trimmed);
    }
  }
  const normalizedList = Array.from(nameMap.keys());
  const canonicalMatches = await db.collection("canonical_companies").find({ normalizedName: { $in: normalizedList } }).toArray();
  const cachedMap = /* @__PURE__ */ new Map();
  for (const doc of canonicalMatches) {
    cachedMap.set(doc.normalizedName, doc);
  }
  for (const normalized of normalizedList) {
    const original = nameMap.get(normalized);
    if (cachedMap.has(normalized)) {
      const cached = cachedMap.get(normalized);
      results.push({
        originalName: original,
        normalizedName: normalized,
        displayName: cached.name,
        careersUrl: cached.careersUrl,
        isVerified: cached.isVerified,
        verificationStatus: cached.isVerified ? "verified" : "needs_verification",
        categories: cached.categories || ["Technology"]
      });
    } else {
      uncachedNames.push(original);
    }
  }
  if (uncachedNames.length > 0) {
    const batchSize = 10;
    for (let i = 0; i < uncachedNames.length; i += batchSize) {
      const batch = uncachedNames.slice(i, i + batchSize);
      try {
        const geminiResults = await callGeminiForCompanies(batch);
        for (const item of geminiResults) {
          const original = item.company || "Unknown";
          const normalized = normalizeCompanyName(original);
          const rawUrl = item.careersUrl || "";
          const { cleanedUrl, isVerified, verificationStatus } = await verifyCareersUrl(
            rawUrl,
            original
          );
          const categories = (item.categories || []).map((c) => c.trim()).filter((c) => c.length > 0);
          if (categories.length === 0) {
            categories.push("Technology");
          }
          const researched = {
            originalName: original,
            normalizedName: normalized,
            displayName: item.company || original,
            careersUrl: cleanedUrl,
            isVerified,
            verificationStatus,
            categories
          };
          results.push(researched);
          await db.collection("canonical_companies").updateOne(
            { normalizedName: normalized },
            {
              $set: {
                name: researched.displayName,
                normalizedName: normalized,
                careersUrl: researched.careersUrl,
                isVerified: researched.isVerified,
                categories: researched.categories,
                updatedAt: /* @__PURE__ */ new Date()
              },
              $setOnInsert: {
                createdAt: /* @__PURE__ */ new Date()
              }
            },
            { upsert: true }
          );
        }
      } catch (err) {
        console.error("Error processing batch with Gemini:", err.message);
        for (const name of batch) {
          const normalized = normalizeCompanyName(name);
          results.push({
            originalName: name,
            normalizedName: normalized,
            displayName: name,
            careersUrl: `https://${name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com/careers`,
            isVerified: false,
            verificationStatus: "needs_verification",
            categories: ["Technology"]
          });
        }
      }
    }
  }
  return results;
}

// server/routes/companies.ts
var router2 = Router2();
router2.use(requireAuth);
router2.get("/", async (req, res) => {
  try {
    const userId = new ObjectId2(req.user.userId);
    const { search, category, favoritesOnly, page = "1", limit = "100" } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 100));
    const skip = (pageNum - 1) * limitNum;
    const { db } = await connectToDatabase();
    const query = { userId };
    if (favoritesOnly === "true" || favoritesOnly === "1") {
      query.isFavorite = true;
    }
    if (category && typeof category === "string" && category !== "All") {
      query.categories = category;
    }
    if (search && typeof search === "string" && search.trim()) {
      const searchTerm = search.trim();
      query.$or = [
        { name: { $regex: searchTerm, $options: "i" } },
        { categories: { $regex: searchTerm, $options: "i" } }
      ];
    }
    const [companies, totalFilteredCount, userTotalCount, categoryAgg] = await Promise.all([
      db.collection("companies").find(query).sort({ isPinned: -1, createdAt: -1 }).skip(skip).limit(limitNum).toArray(),
      db.collection("companies").countDocuments(query),
      db.collection("companies").countDocuments({ userId }),
      db.collection("companies").aggregate([
        { $match: { userId } },
        { $unwind: "$categories" },
        { $group: { _id: "$categories", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } }
      ]).toArray()
    ]);
    const categoriesList = categoryAgg.map((item) => ({
      name: item._id,
      count: item.count
    }));
    res.json({
      companies,
      totalCount: totalFilteredCount,
      userTotalCount,
      categories: categoriesList,
      page: pageNum,
      totalPages: Math.ceil(totalFilteredCount / limitNum) || 1
    });
  } catch (err) {
    console.error("Error fetching companies:", err);
    res.status(500).json({ error: "Failed to retrieve companies" });
  }
});
router2.post(
  "/batch",
  importLimiter,
  async (req, res) => {
    try {
      const { rawInput } = req.body;
      const userId = new ObjectId2(req.user.userId);
      if (!rawInput || typeof rawInput !== "string") {
        res.status(400).json({ error: "Please provide comma or newline separated company names" });
        return;
      }
      const rawNames = rawInput.split(/[\n,;]+/).map((s) => s.trim()).filter((s) => s.length > 0);
      const submittedCount = rawNames.length;
      if (submittedCount === 0) {
        res.status(400).json({ error: "No valid company names found in input" });
        return;
      }
      const uniqueInBatch = /* @__PURE__ */ new Map();
      for (const raw of rawNames) {
        const normalized = normalizeCompanyName(raw);
        if (normalized && !uniqueInBatch.has(normalized)) {
          uniqueInBatch.set(normalized, raw);
        }
      }
      const duplicateInSubmission = submittedCount - uniqueInBatch.size;
      const { db } = await connectToDatabase();
      const normalizedNamesArray = Array.from(uniqueInBatch.keys());
      const existingUserCompanies = await db.collection("companies").find({
        userId,
        normalizedName: { $in: normalizedNamesArray }
      }).toArray();
      const existingNormalizedSet = new Set(
        existingUserCompanies.map((c) => c.normalizedName)
      );
      const namesToResearch = [];
      for (const [norm, orig] of uniqueInBatch.entries()) {
        if (!existingNormalizedSet.has(norm)) {
          namesToResearch.push(orig);
        }
      }
      const skippedDuplicatesCount = duplicateInSubmission + existingUserCompanies.length;
      if (namesToResearch.length === 0) {
        res.json({
          message: "All submitted companies already exist in your directory.",
          submittedCount,
          addedCount: 0,
          skippedDuplicatesCount,
          needsReviewCount: 0,
          addedCompanies: []
        });
        return;
      }
      const researched = await researchCompanies(namesToResearch, db);
      const companiesToInsert = [];
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
          createdAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        });
      }
      let insertedDocs = [];
      if (companiesToInsert.length > 0) {
        try {
          const insertRes = await db.collection("companies").insertMany(companiesToInsert, {
            ordered: false
          });
          insertedDocs = companiesToInsert.map((doc, idx) => ({
            ...doc,
            _id: insertRes.insertedIds[idx]
          }));
        } catch (insertErr) {
          console.warn("Some duplicates caught during insertMany:", insertErr.message);
          insertedDocs = await db.collection("companies").find({
            userId,
            normalizedName: { $in: companiesToInsert.map((c) => c.normalizedName) }
          }).toArray();
        }
      }
      res.status(201).json({
        message: `Successfully processed ${submittedCount} names.`,
        submittedCount,
        addedCount: insertedDocs.length,
        skippedDuplicatesCount: submittedCount - insertedDocs.length,
        needsReviewCount,
        addedCompanies: insertedDocs
      });
    } catch (err) {
      console.error("Error during batch add:", err);
      res.status(500).json({ error: "Failed to process company batch" });
    }
  }
);
router2.patch("/:id/favorite", async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = new ObjectId2(req.user.userId);
    if (!id || !ObjectId2.isValid(id)) {
      res.status(400).json({ error: "Invalid company ID" });
      return;
    }
    const { db } = await connectToDatabase();
    const company = await db.collection("companies").findOne({
      _id: new ObjectId2(id),
      userId
    });
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    const newFavoriteState = !company.isFavorite;
    await db.collection("companies").updateOne(
      { _id: new ObjectId2(id), userId },
      { $set: { isFavorite: newFavoriteState, updatedAt: /* @__PURE__ */ new Date() } }
    );
    res.json({
      message: newFavoriteState ? "Added to favorites" : "Removed from favorites",
      isFavorite: newFavoriteState
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to update favorite status" });
  }
});
router2.patch("/:id/pin", async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = new ObjectId2(req.user.userId);
    if (!id || !ObjectId2.isValid(id)) {
      res.status(400).json({ error: "Invalid company ID" });
      return;
    }
    const { db } = await connectToDatabase();
    const company = await db.collection("companies").findOne({
      _id: new ObjectId2(id),
      userId
    });
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    const newPinState = !company.isPinned;
    await db.collection("companies").updateOne(
      { _id: new ObjectId2(id), userId },
      { $set: { isPinned: newPinState, updatedAt: /* @__PURE__ */ new Date() } }
    );
    res.json({
      message: newPinState ? "Pinned to top" : "Unpinned",
      isPinned: newPinState
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to update pin status" });
  }
});
router2.put("/:id", async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { name, careersUrl, categories } = req.body;
    const userId = new ObjectId2(req.user.userId);
    if (!id || !ObjectId2.isValid(id)) {
      res.status(400).json({ error: "Invalid company ID" });
      return;
    }
    const { db } = await connectToDatabase();
    const company = await db.collection("companies").findOne({
      _id: new ObjectId2(id),
      userId
    });
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    const updateFields = {
      updatedAt: /* @__PURE__ */ new Date()
    };
    if (name && typeof name === "string" && name.trim()) {
      updateFields.name = name.trim();
      updateFields.normalizedName = normalizeCompanyName(name.trim());
    }
    if (Array.isArray(categories)) {
      updateFields.categories = categories.map((c) => String(c).trim()).filter((c) => c.length > 0);
    }
    if (careersUrl !== void 0 && typeof careersUrl === "string") {
      const { cleanedUrl, isVerified } = await verifyCareersUrl(
        careersUrl,
        updateFields.name || company.name
      );
      updateFields.careersUrl = cleanedUrl;
      updateFields.isVerified = isVerified;
      updateFields.verificationStatus = isVerified ? "verified" : "manual";
    }
    await db.collection("companies").updateOne(
      { _id: new ObjectId2(id), userId },
      { $set: updateFields }
    );
    const updated = await db.collection("companies").findOne({
      _id: new ObjectId2(id),
      userId
    });
    res.json({ message: "Company updated successfully", company: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to update company" });
  }
});
router2.delete("/:id", async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = new ObjectId2(req.user.userId);
    if (!id || !ObjectId2.isValid(id)) {
      res.status(400).json({ error: "Invalid company ID" });
      return;
    }
    const { db } = await connectToDatabase();
    const result = await db.collection("companies").deleteOne({
      _id: new ObjectId2(id),
      userId
    });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    res.json({ message: "Company removed from directory" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete company" });
  }
});
var companies_default = router2;

// server/routes/admin.ts
import { Router as Router3 } from "express";
import bcrypt2 from "bcryptjs";
import { ObjectId as ObjectId3 } from "mongodb";
var router3 = Router3();
router3.use(requireAuth, requireAdmin);
router3.get("/settings", async (_req, res) => {
  try {
    const { db } = await connectToDatabase();
    const setting = await db.collection("settings").findOne({ key: "registration_enabled" });
    const registrationEnabled = setting !== null ? Boolean(setting.value) : true;
    res.json({ registrationEnabled });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});
router3.post("/settings", async (req, res) => {
  try {
    const { registrationEnabled } = req.body;
    if (typeof registrationEnabled !== "boolean") {
      res.status(400).json({ error: "registrationEnabled must be a boolean" });
      return;
    }
    const { db } = await connectToDatabase();
    await db.collection("settings").updateOne(
      { key: "registration_enabled" },
      { $set: { value: registrationEnabled, updatedAt: /* @__PURE__ */ new Date() } },
      { upsert: true }
    );
    res.json({
      message: `Public registration has been ${registrationEnabled ? "enabled" : "disabled"}`,
      registrationEnabled
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});
router3.get("/users", async (_req, res) => {
  try {
    const { db } = await connectToDatabase();
    const users = await db.collection("users").find({}).sort({ createdAt: -1 }).project({ passwordHash: 0 }).toArray();
    const companyCounts = await db.collection("companies").aggregate([
      { $group: { _id: "$userId", count: { $sum: 1 } } }
    ]).toArray();
    const countMap = /* @__PURE__ */ new Map();
    for (const item of companyCounts) {
      if (item._id) {
        countMap.set(item._id.toString(), item.count);
      }
    }
    const enrichedUsers = users.map((u) => ({
      id: u._id.toString(),
      username: u.username,
      role: u.role,
      isActive: u.isActive !== false,
      isTempPassword: Boolean(u.isTempPassword),
      companyCount: countMap.get(u._id.toString()) || 0,
      createdAt: u.createdAt
    }));
    res.json({ users: enrichedUsers });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});
router3.post("/users", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || typeof username !== "string" || !username.trim()) {
      res.status(400).json({ error: "Username is required" });
      return;
    }
    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3) {
      res.status(400).json({ error: "Username must be at least 3 characters long" });
      return;
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters long" });
      return;
    }
    const normalizedUsername = trimmedUsername.toLowerCase();
    const { db } = await connectToDatabase();
    const existing = await db.collection("users").findOne({ normalizedUsername });
    if (existing) {
      res.status(400).json({ error: "Username is already taken" });
      return;
    }
    const salt = await bcrypt2.genSalt(12);
    const passwordHash = await bcrypt2.hash(password, salt);
    const newUser = {
      username: trimmedUsername,
      normalizedUsername,
      passwordHash,
      role: "student",
      isActive: true,
      isTempPassword: true,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    const result = await db.collection("users").insertOne(newUser);
    res.status(201).json({
      message: "Student account created successfully",
      user: {
        id: result.insertedId.toString(),
        username: trimmedUsername,
        role: "student",
        tempPassword: password
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create student account" });
  }
});
router3.patch("/users/:id/status", async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { isActive } = req.body;
    if (!id || !ObjectId3.isValid(id)) {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }
    if (typeof isActive !== "boolean") {
      res.status(400).json({ error: "isActive boolean is required" });
      return;
    }
    if (id === req.user.userId) {
      res.status(400).json({ error: "You cannot disable your own administrator account" });
      return;
    }
    const { db } = await connectToDatabase();
    const result = await db.collection("users").updateOne(
      { _id: new ObjectId3(id) },
      { $set: { isActive, updatedAt: /* @__PURE__ */ new Date() } }
    );
    if (result.matchedCount === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({
      message: `User account has been ${isActive ? "enabled" : "disabled"}`,
      isActive
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to update account status" });
  }
});
router3.patch("/users/:id/reset-password", async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { newPassword } = req.body;
    if (!id || !ObjectId3.isValid(id)) {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters long" });
      return;
    }
    const salt = await bcrypt2.genSalt(12);
    const passwordHash = await bcrypt2.hash(newPassword, salt);
    const { db } = await connectToDatabase();
    const result = await db.collection("users").updateOne(
      { _id: new ObjectId3(id) },
      { $set: { passwordHash, isTempPassword: true, updatedAt: /* @__PURE__ */ new Date() } }
    );
    if (result.matchedCount === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ message: "Temporary password set successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to reset password" });
  }
});
var admin_default = router3;

// server/app.ts
var app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin.startsWith("http://localhost") || origin.endsWith(".vercel.app")) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true
  })
);
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "Company Career Directory API",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.use("/api/auth", auth_default);
app.use("/api/companies", companies_default);
app.use("/api/admin", admin_default);
app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    res.status(404).json({ error: "API route not found" });
  } else {
    res.status(404).send("Not Found");
  }
});
var app_default = app;

// server/api.ts
async function handler(req, res) {
  try {
    await connectToDatabase();
  } catch (err) {
    console.error("Database connection error in Vercel serverless handler:", err);
  }
  return app_default(req, res);
}
export {
  handler as default
};
