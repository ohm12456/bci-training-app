import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// ── Supabase admin client (service role) ─────────────────────────────────────
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
);

// ── Supabase anon client (JWT validation only) ────────────────────────────────
const supabaseAuth = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
);

console.log("BCI Server v2 starting – env check:");
console.log("- SUPABASE_URL:", Deno.env.get("SUPABASE_URL") ? "Present" : "MISSING");
console.log("- SUPABASE_SERVICE_ROLE_KEY:", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ? "Present" : "MISSING");
console.log("- SUPABASE_ANON_KEY:", Deno.env.get("SUPABASE_ANON_KEY") ? "Present" : "MISSING");

// ── EEG storage bucket name ───────────────────────────────────────────────────
const EEG_BUCKET = "make-768938a0-eeg";

// Ensure EEG storage bucket exists on startup
async function ensureEEGBucket() {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b: any) => b.name === EEG_BUCKET);
    if (!exists) {
      const { error } = await supabase.storage.createBucket(EEG_BUCKET, { public: false });
      if (error) console.error("Failed to create EEG bucket:", error);
      else console.log("Created EEG storage bucket:", EEG_BUCKET);
    }
  } catch (err) {
    console.error("EEG bucket setup error:", err);
  }
}
ensureEEGBucket();

// ── Shared sample patient data (DRY) ─────────────────────────────────────────
const SAMPLE_PATIENTS = [
  {
    name: "John Anderson",
    age: 52,
    condition: "Stroke Recovery",
    doctorNotes:
      "Patient showing steady improvement in motor imagery tasks. Right-hand imagery is stronger than left.",
    lastSessionAccuracy: 78.5,
  },
  {
    name: "Maria Garcia",
    age: 45,
    condition: "Spinal Cord Injury",
    doctorNotes:
      "Excellent concentration during training sessions. Consider increasing difficulty level.",
    lastSessionAccuracy: 82.3,
  },
  {
    name: "Robert Chen",
    age: 38,
    condition: "Traumatic Brain Injury",
    doctorNotes:
      "Initial sessions showing promise. Patient requires more rest between trials.",
    lastSessionAccuracy: 65.2,
  },
  {
    name: "Emma Wilson",
    age: 61,
    condition: "Stroke Recovery",
    doctorNotes: "Good progress over past 3 weeks. Patient is motivated and engaged.",
    lastSessionAccuracy: 73.8,
  },
  {
    name: "Michael Brown",
    age: 55,
    condition: "Parkinson's Disease",
    doctorNotes: "Tremor affects signal quality. Morning sessions show better results.",
    lastSessionAccuracy: 69.4,
  },
];

async function seedPatientsForUser(userId: string): Promise<any[]> {
  const seededPatients: any[] = [];
  const now = Date.now();

  console.log(`[SEED] Starting seed for user ${userId} with ${SAMPLE_PATIENTS.length} sample patients`);

  for (let i = 0; i < SAMPLE_PATIENTS.length; i++) {
    const p = SAMPLE_PATIENTS[i];
    const patientId = `P${now}_${i}`;
    const newPatient = {
      id: patientId,
      userId,
      name: p.name,
      age: p.age,
      condition: p.condition,
      doctorNotes: p.doctorNotes,
      lastSessionAccuracy: p.lastSessionAccuracy,
      createdAt: new Date(now - (30 - i * 5) * 86400000).toISOString(),
    };

    try {
      await kv.set(`patient:${userId}:${patientId}`, newPatient);
      seededPatients.push(newPatient);
      console.log(`[SEED] Created patient ${i + 1}/${SAMPLE_PATIENTS.length}: ${p.name} (${patientId})`);
    } catch (err) {
      console.error(`[SEED] Failed to save patient ${p.name}:`, err);
      continue;
    }

    // Seed training sessions for this patient
    const numSessions = 3 + (i % 3); // deterministic so re-seeds are consistent
    for (let j = 0; j < numSessions; j++) {
      const sessionId = `S${now}_${i}_${j}`;
      const variance = ((j % 3) - 1) * 4; // deterministic variance
      const accuracy = Math.max(50, Math.min(100, p.lastSessionAccuracy + variance));

      try {
        await kv.set(`session:${userId}:${patientId}:${sessionId}`, {
          id: sessionId,
          patientId,
          userId,
          date: new Date(now - (25 - j * 7) * 86400000).toISOString(),
          totalTrials: 40,
          correctPredictions: Math.round((40 * accuracy) / 100),
          accuracy: Math.round(accuracy * 10) / 10,
          duration: 1100 + j * 50,
          createdAt: new Date(now - (25 - j * 7) * 86400000).toISOString(),
        });
      } catch (sessionErr) {
        console.error(`[SEED] Failed to save session ${sessionId}:`, sessionErr);
      }
    }
  }

  console.log(`[SEED] Done. Seeded ${seededPatients.length} patients for user ${userId}`);
  return seededPatients;
}

// ── Auth helper ───────────────────────────────────────────────────────────────
async function getAuthUser(authHeader: string | undefined) {
  console.log("[AUTH] Authorization header present:", !!authHeader);
  const token = authHeader?.split(" ")[1];
  if (!token) {
    console.error("[AUTH] No token found in Authorization header. Raw header:", authHeader?.substring(0, 30));
    return { user: null, error: "No authorization token provided" };
  }
  console.log("[AUTH] Token extracted, length:", token.length, "prefix:", token.substring(0, 20) + "...");

  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data?.user?.id) {
    console.error("[AUTH] Token validation failed:", error?.message || "no user returned", "| error code:", error?.status);
    return { user: null, error: `Unauthorized – ${error?.message || "invalid or expired token"}` };
  }
  console.log("[AUTH] Authenticated user:", data.user.id, data.user.email);
  return { user: data.user, error: null };
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use("*", logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  })
);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/make-server-768938a0/health", (c) => c.json({ status: "ok", version: "2" }));

// ═════════════════════════════════════════════════════════════════════════════
// PATIENTS
// ═════════════════════════════════════════════════════════════════════════════

// GET /patients – list all patients for the authenticated user (auto-seeds for new accounts)
app.get("/make-server-768938a0/patients", async (c) => {
  try {
    const { user, error } = await getAuthUser(c.req.header("Authorization"));
    if (error || !user) {
      console.error("[GET /patients] Auth failed:", error);
      return c.json({ error: error || "Unauthorized" }, 401);
    }

    console.log(`[GET /patients] Fetching patients for user ${user.id}`);

    let patients: any[];
    try {
      patients = await kv.getByPrefix(`patient:${user.id}:`);
    } catch (kvErr) {
      console.error(`[GET /patients] kv.getByPrefix failed for user ${user.id}:`, kvErr);
      return c.json({ error: `Database read error: ${String(kvErr)}` }, 500);
    }

    console.log(`[GET /patients] Found ${patients?.length ?? 0} patient(s) for user ${user.id}`);

    if (!patients || patients.length === 0) {
      console.log(`[GET /patients] No patients found – auto-seeding sample data for user ${user.id}`);
      try {
        patients = await seedPatientsForUser(user.id);
        console.log(`[GET /patients] Auto-seed complete: ${patients.length} patients created`);
      } catch (seedErr) {
        console.error(`[GET /patients] Auto-seed failed for user ${user.id}:`, seedErr);
        // Return empty list rather than an error – seeding failure shouldn't block the UI
        return c.json({ patients: [] });
      }
    }

    return c.json({ patients: patients || [] });
  } catch (err) {
    console.error("[GET /patients] Unexpected error:", err);
    return c.json({ error: `Failed to fetch patients: ${String(err)}` }, 500);
  }
});

// POST /patients – create a new patient
app.post("/make-server-768938a0/patients", async (c) => {
  try {
    const { user, error } = await getAuthUser(c.req.header("Authorization"));
    if (error || !user) {
      console.error("[POST /patients] Auth failed:", error);
      return c.json({ error: error || "Unauthorized" }, 401);
    }

    // Parse request body
    let body: any;
    try {
      body = await c.req.json();
    } catch (parseErr) {
      console.error("[POST /patients] Failed to parse request body:", parseErr);
      return c.json({ error: "Invalid JSON in request body" }, 400);
    }

    const { name, age, condition, doctorNotes } = body;
    console.log(`[POST /patients] Creating patient for user ${user.id}: name="${name}", age=${age}, condition="${condition}"`);

    if (!name || !name.toString().trim()) {
      return c.json({ error: "Patient name is required" }, 400);
    }
    if (!age || isNaN(parseInt(String(age)))) {
      return c.json({ error: "Valid patient age is required" }, 400);
    }
    if (!condition || !condition.toString().trim()) {
      return c.json({ error: "Medical condition is required" }, 400);
    }

    const patientId = `P${Date.now()}`;
    const patient = {
      id: patientId,
      userId: user.id,
      name: String(name).trim(),
      age: parseInt(String(age)),
      condition: String(condition).trim(),
      doctorNotes: doctorNotes ? String(doctorNotes).trim() : "",
      lastSessionAccuracy: 0,
      createdAt: new Date().toISOString(),
    };

    try {
      await kv.set(`patient:${user.id}:${patientId}`, patient);
    } catch (kvErr) {
      console.error(`[POST /patients] kv.set failed for patient ${patientId}:`, kvErr);
      return c.json({ error: `Database write error: ${String(kvErr)}` }, 500);
    }

    console.log(`[POST /patients] Successfully created patient ${patientId} ("${patient.name}") for user ${user.id}`);
    return c.json({ patient });
  } catch (err) {
    console.error("[POST /patients] Unexpected error:", err);
    return c.json({ error: `Failed to add patient: ${String(err)}` }, 500);
  }
});

// GET /patients/:id
app.get("/make-server-768938a0/patients/:id", async (c) => {
  try {
    const { user, error } = await getAuthUser(c.req.header("Authorization"));
    if (error || !user) return c.json({ error: error || "Unauthorized" }, 401);

    const patientId = c.req.param("id");
    console.log(`[GET /patients/:id] Fetching patient ${patientId} for user ${user.id}`);

    let patient: any;
    try {
      patient = await kv.get(`patient:${user.id}:${patientId}`);
    } catch (kvErr) {
      console.error(`[GET /patients/:id] kv.get failed:`, kvErr);
      return c.json({ error: `Database read error: ${String(kvErr)}` }, 500);
    }

    if (!patient) {
      console.warn(`[GET /patients/:id] Patient ${patientId} not found for user ${user.id}`);
      return c.json({ error: "Patient not found" }, 404);
    }

    return c.json({ patient });
  } catch (err) {
    console.error("[GET /patients/:id] Unexpected error:", err);
    return c.json({ error: `Failed to fetch patient: ${String(err)}` }, 500);
  }
});

// PUT /patients/:id – update patient
app.put("/make-server-768938a0/patients/:id", async (c) => {
  try {
    const { user, error } = await getAuthUser(c.req.header("Authorization"));
    if (error || !user) return c.json({ error: error || "Unauthorized" }, 401);

    const patientId = c.req.param("id");

    let updates: any;
    try {
      updates = await c.req.json();
    } catch (parseErr) {
      return c.json({ error: "Invalid JSON in request body" }, 400);
    }

    let existing: any;
    try {
      existing = await kv.get(`patient:${user.id}:${patientId}`);
    } catch (kvErr) {
      console.error(`[PUT /patients/:id] kv.get failed:`, kvErr);
      return c.json({ error: `Database read error: ${String(kvErr)}` }, 500);
    }

    if (!existing) {
      console.warn(`[PUT /patients/:id] Patient ${patientId} not found for user ${user.id}`);
      return c.json({ error: "Patient not found" }, 404);
    }

    // Sanitize updates – never overwrite id or userId
    const { id: _id, userId: _uid, ...safeUpdates } = updates;
    const updatedPatient = { ...existing, ...safeUpdates };

    try {
      await kv.set(`patient:${user.id}:${patientId}`, updatedPatient);
    } catch (kvErr) {
      console.error(`[PUT /patients/:id] kv.set failed:`, kvErr);
      return c.json({ error: `Database write error: ${String(kvErr)}` }, 500);
    }

    console.log(`[PUT /patients/:id] Updated patient ${patientId} for user ${user.id}`);
    return c.json({ patient: updatedPatient });
  } catch (err) {
    console.error("[PUT /patients/:id] Unexpected error:", err);
    return c.json({ error: `Failed to update patient: ${String(err)}` }, 500);
  }
});

// DELETE /patients/:id – works for both seeded and user-created patients
app.delete("/make-server-768938a0/patients/:id", async (c) => {
  try {
    const { user, error } = await getAuthUser(c.req.header("Authorization"));
    if (error || !user) {
      console.error("[DELETE /patients/:id] Auth failed:", error);
      return c.json({ error: error || "Unauthorized" }, 401);
    }

    const patientId = c.req.param("id");
    console.log(`[DELETE /patients/:id] Deleting patient ${patientId} for user ${user.id}`);

    // Verify patient exists before deleting
    let existingPatient: any;
    try {
      existingPatient = await kv.get(`patient:${user.id}:${patientId}`);
    } catch (kvErr) {
      console.error(`[DELETE /patients/:id] kv.get check failed:`, kvErr);
      return c.json({ error: `Database read error: ${String(kvErr)}` }, 500);
    }

    if (!existingPatient) {
      console.warn(`[DELETE /patients/:id] Patient ${patientId} not found for user ${user.id} – returning 404`);
      return c.json({ error: "Patient not found" }, 404);
    }

    // Delete the patient record
    try {
      await kv.del(`patient:${user.id}:${patientId}`);
      console.log(`[DELETE /patients/:id] Patient record ${patientId} deleted`);
    } catch (kvErr) {
      console.error(`[DELETE /patients/:id] kv.del (patient) failed:`, kvErr);
      return c.json({ error: `Failed to delete patient record: ${String(kvErr)}` }, 500);
    }

    // Delete all associated training sessions
    let sessions: any[] = [];
    try {
      sessions = await kv.getByPrefix(`session:${user.id}:${patientId}:`);
      console.log(`[DELETE /patients/:id] Found ${sessions.length} session(s) to delete for patient ${patientId}`);
    } catch (kvErr) {
      console.error(`[DELETE /patients/:id] getByPrefix (sessions) failed:`, kvErr);
      // Non-fatal – continue to EEG cleanup
    }

    if (sessions.length > 0) {
      const sessionKeys = sessions.map((s: any) => `session:${user.id}:${patientId}:${s.id}`);
      try {
        await kv.mdel(sessionKeys);
        console.log(`[DELETE /patients/:id] Deleted ${sessionKeys.length} session key(s)`);
      } catch (kvErr) {
        console.error(`[DELETE /patients/:id] mdel (sessions) failed:`, kvErr);
        // Non-fatal – try individual deletes as fallback
        for (const key of sessionKeys) {
          try { await kv.del(key); } catch (_) { /* best effort */ }
        }
      }
    }

    // Delete associated EEG file metadata + storage objects
    let eegFiles: any[] = [];
    try {
      eegFiles = await kv.getByPrefix(`eeg:${user.id}:${patientId}:`);
      console.log(`[DELETE /patients/:id] Found ${eegFiles.length} EEG file(s) to delete for patient ${patientId}`);
    } catch (kvErr) {
      console.error(`[DELETE /patients/:id] getByPrefix (eeg) failed:`, kvErr);
    }

    for (const f of eegFiles) {
      const fileRecord = f as any;
      if (fileRecord.storageKey) {
        try {
          await supabase.storage.from(EEG_BUCKET).remove([fileRecord.storageKey]);
        } catch (storageErr) {
          console.error(`[DELETE /patients/:id] Storage remove failed for ${fileRecord.storageKey}:`, storageErr);
        }
      }
      try {
        await kv.del(`eeg:${user.id}:${patientId}:${fileRecord.id}`);
      } catch (kvErr) {
        console.error(`[DELETE /patients/:id] kv.del (eeg metadata) failed:`, kvErr);
      }
    }

    console.log(`[DELETE /patients/:id] Done – deleted patient "${existingPatient.name}" (${patientId}) and all associated data for user ${user.id}`);
    return c.json({ message: "Patient deleted successfully", deletedId: patientId });
  } catch (err) {
    console.error("[DELETE /patients/:id] Unexpected error:", err);
    return c.json({ error: `Failed to delete patient: ${String(err)}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// SESSIONS
// ═════════════════════════════════════════════════════════════════════════════

// GET /patients/:id/sessions
app.get("/make-server-768938a0/patients/:id/sessions", async (c) => {
  try {
    const { user, error } = await getAuthUser(c.req.header("Authorization"));
    if (error || !user) return c.json({ error: error || "Unauthorized" }, 401);

    const patientId = c.req.param("id");
    console.log(`[GET /patients/:id/sessions] Fetching sessions for patient ${patientId}, user ${user.id}`);

    let sessions: any[];
    try {
      sessions = await kv.getByPrefix(`session:${user.id}:${patientId}:`);
    } catch (kvErr) {
      console.error(`[GET /patients/:id/sessions] kv.getByPrefix failed:`, kvErr);
      return c.json({ error: `Database read error: ${String(kvErr)}` }, 500);
    }

    console.log(`[GET /patients/:id/sessions] Found ${sessions?.length ?? 0} session(s)`);
    return c.json({ sessions: sessions || [] });
  } catch (err) {
    console.error("[GET /patients/:id/sessions] Unexpected error:", err);
    return c.json({ error: `Failed to fetch sessions: ${String(err)}` }, 500);
  }
});

// POST /patients/:id/sessions – add training session
app.post("/make-server-768938a0/patients/:id/sessions", async (c) => {
  try {
    const { user, error } = await getAuthUser(c.req.header("Authorization"));
    if (error || !user) return c.json({ error: error || "Unauthorized" }, 401);

    const patientId = c.req.param("id");

    let body: any;
    try {
      body = await c.req.json();
    } catch (parseErr) {
      return c.json({ error: "Invalid JSON in request body" }, 400);
    }

    // Validate patient ownership
    let patient: any;
    try {
      patient = await kv.get(`patient:${user.id}:${patientId}`);
    } catch (kvErr) {
      console.error(`[POST /patients/:id/sessions] kv.get (patient) failed:`, kvErr);
      return c.json({ error: `Database read error: ${String(kvErr)}` }, 500);
    }

    if (!patient) {
      console.warn(`[POST /patients/:id/sessions] Patient ${patientId} not found for user ${user.id}`);
      return c.json({ error: "Patient not found" }, 404);
    }

    const sessionId = `S${Date.now()}`;
    const session = {
      id: sessionId,
      patientId,
      userId: user.id,
      date: body.date || new Date().toISOString(),
      totalTrials: body.totalTrials || 0,
      correctPredictions: body.correctPredictions || 0,
      accuracy: body.accuracy || 0,
      duration: body.duration || 0,
      createdAt: new Date().toISOString(),
    };

    try {
      await kv.set(`session:${user.id}:${patientId}:${sessionId}`, session);
    } catch (kvErr) {
      console.error(`[POST /patients/:id/sessions] kv.set (session) failed:`, kvErr);
      return c.json({ error: `Database write error: ${String(kvErr)}` }, 500);
    }

    // Update patient's last session accuracy
    try {
      const updatedPatient = { ...(patient as object), lastSessionAccuracy: session.accuracy };
      await kv.set(`patient:${user.id}:${patientId}`, updatedPatient);
    } catch (kvErr) {
      // Non-fatal – session is saved, accuracy update failure is cosmetic
      console.error(`[POST /patients/:id/sessions] kv.set (patient accuracy update) failed:`, kvErr);
    }

    console.log(`[POST /patients/:id/sessions] Saved session ${sessionId} for patient ${patientId}, accuracy=${session.accuracy}%`);
    return c.json({ session });
  } catch (err) {
    console.error("[POST /patients/:id/sessions] Unexpected error:", err);
    return c.json({ error: `Failed to save training session: ${String(err)}` }, 500);
  }
});

// GET /sessions – all sessions for user (for reports)
app.get("/make-server-768938a0/sessions", async (c) => {
  try {
    const { user, error } = await getAuthUser(c.req.header("Authorization"));
    if (error || !user) return c.json({ error: error || "Unauthorized" }, 401);

    let sessions: any[];
    try {
      sessions = await kv.getByPrefix(`session:${user.id}:`);
    } catch (kvErr) {
      console.error(`[GET /sessions] kv.getByPrefix failed:`, kvErr);
      return c.json({ error: `Database read error: ${String(kvErr)}` }, 500);
    }

    console.log(`[GET /sessions] Found ${sessions?.length ?? 0} session(s) for user ${user.id}`);
    return c.json({ sessions: sessions || [] });
  } catch (err) {
    console.error("[GET /sessions] Unexpected error:", err);
    return c.json({ error: `Failed to fetch sessions: ${String(err)}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// EEG FILE STORAGE
// ═════════════════════════════════════════════════════════════════════════════

// POST /eeg/prepare-upload – get a signed upload URL for Supabase Storage
app.post("/make-server-768938a0/eeg/prepare-upload", async (c) => {
  try {
    const { user, error } = await getAuthUser(c.req.header("Authorization"));
    if (error || !user) return c.json({ error: error || "Unauthorized" }, 401);

    const { filename, contentType, fileSize, patientId } = await c.req.json();
    if (!filename) return c.json({ error: "filename is required" }, 400);

    // Construct unique storage key
    const fileId = `EEG${Date.now()}`;
    const ext = filename.split(".").pop() || "edf";
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileKey = `${user.id}/${patientId || "unassigned"}/${fileId}_${safeFilename}`;

    // Create signed URL for direct browser-to-storage upload (60 min expiry)
    const { data: signedData, error: signedErr } = await supabase.storage
      .from(EEG_BUCKET)
      .createSignedUploadUrl(fileKey);

    if (signedErr || !signedData?.signedUrl) {
      console.error("Failed to create signed upload URL:", signedErr);
      return c.json({ error: "Failed to prepare file upload" }, 500);
    }

    return c.json({
      signedUrl: signedData.signedUrl,
      fileKey,
      fileId,
    });
  } catch (err) {
    console.error("POST /eeg/prepare-upload error:", err);
    return c.json({ error: "Failed to prepare EEG upload" }, 500);
  }
});

// POST /eeg/complete-upload – save EEG file metadata after upload
app.post("/make-server-768938a0/eeg/complete-upload", async (c) => {
  try {
    const { user, error } = await getAuthUser(c.req.header("Authorization"));
    if (error || !user) return c.json({ error: error || "Unauthorized" }, 401);

    const { fileId, fileKey, filename, fileSize, contentType, patientId, patientName } =
      await c.req.json();

    if (!fileId || !fileKey || !filename) {
      return c.json({ error: "fileId, fileKey, and filename are required" }, 400);
    }

    const kvKey = patientId
      ? `eeg:${user.id}:${patientId}:${fileId}`
      : `eeg:${user.id}:unassigned:${fileId}`;

    const fileRecord = {
      id: fileId,
      userId: user.id,
      patientId: patientId || null,
      patientName: patientName || null,
      filename,
      fileSize: fileSize || 0,
      contentType: contentType || "application/octet-stream",
      storageKey: fileKey,
      status: "success",
      importedAt: new Date().toISOString(),
    };

    await kv.set(kvKey, fileRecord);
    console.log(`EEG file metadata saved: ${fileId} for user ${user.id}`);

    return c.json({ file: fileRecord });
  } catch (err) {
    console.error("POST /eeg/complete-upload error:", err);
    return c.json({ error: "Failed to save EEG file metadata" }, 500);
  }
});

// GET /eeg/files – list all EEG files for user
app.get("/make-server-768938a0/eeg/files", async (c) => {
  try {
    const { user, error } = await getAuthUser(c.req.header("Authorization"));
    if (error || !user) return c.json({ error: error || "Unauthorized" }, 401);

    const files = await kv.getByPrefix(`eeg:${user.id}:`);

    // Attach signed download URLs
    const filesWithUrls = await Promise.all(
      (files || []).map(async (f: any) => {
        if (f.storageKey) {
          const { data } = await supabase.storage
            .from(EEG_BUCKET)
            .createSignedUrl(f.storageKey, 3600); // 1 hour expiry
          return { ...f, downloadUrl: data?.signedUrl || null };
        }
        return f;
      })
    );

    return c.json({ files: filesWithUrls });
  } catch (err) {
    console.error("GET /eeg/files error:", err);
    return c.json({ error: "Failed to fetch EEG files" }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// AUTH – User profile management
// ═════════════════════════════════════════════════════════════════════════════

// GET /user/profile
app.get("/make-server-768938a0/user/profile", async (c) => {
  try {
    const { user, error } = await getAuthUser(c.req.header("Authorization"));
    if (error || !user) return c.json({ error: error || "Unauthorized" }, 401);

    const profile = await kv.get(`user:${user.id}`);
    return c.json({ profile: profile || null, email: user.email });
  } catch (err) {
    console.error("GET /user/profile error:", err);
    return c.json({ error: "Failed to fetch user profile" }, 500);
  }
});

// PUT /user/profile
app.put("/make-server-768938a0/user/profile", async (c) => {
  try {
    const { user, error } = await getAuthUser(c.req.header("Authorization"));
    if (error || !user) return c.json({ error: error || "Unauthorized" }, 401);

    const updates = await c.req.json();
    const existing = (await kv.get(`user:${user.id}`)) || {};
    const updatedProfile = { ...existing, ...updates, userId: user.id, email: user.email };
    await kv.set(`user:${user.id}`, updatedProfile);

    console.log(`[PUT /user/profile] Updated profile for user ${user.id}`);
    return c.json({ profile: updatedProfile });
  } catch (err) {
    console.error("PUT /user/profile error:", err);
    return c.json({ error: "Failed to update user profile" }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// DEBUG / ADMIN ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

app.get("/make-server-768938a0/debug/user-data", async (c) => {
  try {
    const { user, error } = await getAuthUser(c.req.header("Authorization"));
    if (error || !user) return c.json({ error: error || "Unauthorized" }, 401);

    const patients = await kv.getByPrefix(`patient:${user.id}:`);
    const sessions = await kv.getByPrefix(`session:${user.id}:`);
    const eegFiles = await kv.getByPrefix(`eeg:${user.id}:`);
    const userProfile = await kv.get(`user:${user.id}`);

    return c.json({
      userId: user.id,
      email: user.email,
      userProfile,
      patientsCount: patients?.length || 0,
      sessionsCount: sessions?.length || 0,
      eegFilesCount: eegFiles?.length || 0,
      patients: patients || [],
      sessionsPreview: (sessions || []).slice(0, 5),
    });
  } catch (err) {
    console.error("GET /debug/user-data error:", err);
    return c.json({ error: "Failed to get debug data" }, 500);
  }
});

app.post("/make-server-768938a0/debug/reseed", async (c) => {
  try {
    const { user, error } = await getAuthUser(c.req.header("Authorization"));
    if (error || !user) return c.json({ error: error || "Unauthorized" }, 401);

    console.log(`[debug/reseed] Force reseeding data for user ${user.id}`);
    const seededPatients = await seedPatientsForUser(user.id);

    return c.json({
      message: "Data reseeded successfully",
      patientsCreated: seededPatients.length,
      patients: seededPatients,
    });
  } catch (err) {
    console.error("POST /debug/reseed error:", err);
    return c.json({ error: "Failed to reseed data" }, 500);
  }
});

Deno.serve(app.fetch);