import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertHuntSchema, insertBonusSchema, payoutSchema, adminLoginSchema } from "@shared/schema";
import { requireAdmin, createAdminSession, checkAdminSession, optionalAdmin, initializeAdminKeys, type AuthenticatedRequest } from "./auth";
import { updateHuntStatus } from "./hunt-status";
import { randomUUID } from 'crypto';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize admin keys on startup
  await initializeAdminKeys();

  // Admin authentication endpoints
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { adminKey } = adminLoginSchema.parse(req.body);
      const sessionToken = await createAdminSession(adminKey);
      
      if (!sessionToken) {
        return res.status(401).json({ error: "Invalid admin key" });
      }

      res.json({ sessionToken, message: "Login successful" });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Check admin session endpoint
  app.get("/api/admin/check", async (req, res) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ isAdmin: false });
    }

    const sessionToken = authHeader.substring(7);
    const sessionCheck = await checkAdminSession(sessionToken);
    
    res.json({ 
      isAdmin: sessionCheck.valid,
      adminDisplayName: sessionCheck.adminDisplayName,
      adminKey: sessionCheck.adminKey,
      kickUsername: sessionCheck.kickUsername
    });
  });

  // Admin logout endpoint
  app.post("/api/admin/logout", requireAdmin, async (req: AuthenticatedRequest, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const sessionToken = authHeader.substring(7);
      await storage.deleteAdminSession(sessionToken);
    }
    res.json({ message: "Logged out successfully" });
  });

  // Get hunts - for authenticated admin, only their hunts; for public, all public hunts
  app.get("/api/hunts", optionalAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      let hunts;
      if (req.adminKey) {
        // Authenticated admin sees only their hunts
        hunts = await storage.getHuntsByAdminKey(req.adminKey);
      } else {
        // Public users see all public hunts
        hunts = await storage.getAllPublicHunts();
      }
      res.json(hunts);
    } catch (error) {
      console.error('Error fetching hunts:', error);
      res.status(500).json({ error: "Failed to fetch hunts" });
    }
  });

  // Live hunts (public view showing all admin hunts with admin names)
  app.get("/api/live-hunts", async (req, res) => {
    try {
      const liveHunts = await storage.getAllHuntsWithAdminNames();
      res.json(liveHunts);
    } catch (error) {
      console.error('Error fetching live hunts:', error);
      res.status(500).json({ error: "Failed to fetch live hunts" });
    }
  });

  // Admin-specific hunts (same as /api/hunts for authenticated admins)
  app.get("/api/my-hunts", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const hunts = await storage.getHuntsByAdminKey(req.adminKey!);
      res.json(hunts);
    } catch (error) {
      console.error('Error fetching admin hunts:', error);
      res.status(500).json({ error: "Failed to fetch hunts" });
    }
  });

  // Get live bonuses from all admins
  app.get("/api/live-bonuses", async (req, res) => {
    try {
      const bonuses = await storage.getAllLiveBonuses();
      res.json(bonuses);
    } catch (error) {
      console.error('Error fetching live bonuses:', error);
      res.status(500).json({ error: "Failed to fetch live bonuses" });
    }
  });

  app.get("/api/hunts/:id", optionalAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const hunt = await storage.getHunt(req.params.id);
      if (!hunt) {
        return res.status(404).json({ error: "Hunt not found" });
      }
      res.json(hunt);
    } catch (error) {
      console.error('Error fetching hunt:', error);
      res.status(500).json({ error: "Failed to fetch hunt" });
    }
  });

  app.post("/api/hunts", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const huntData = insertHuntSchema.parse(req.body);
      const hunt = await storage.createHunt(huntData, req.adminKey!);
      res.status(201).json(hunt);
    } catch (error) {
      console.error('Error creating hunt:', error);
      res.status(400).json({ error: "Invalid hunt data" });
    }
  });

  app.put("/api/hunts/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const huntData = req.body;
      const hunt = await storage.updateHunt(req.params.id, huntData);
      if (!hunt) {
        return res.status(404).json({ error: "Hunt not found" });
      }
      res.json(hunt);
    } catch (error) {
      console.error('Error updating hunt:', error);
      res.status(500).json({ error: "Failed to update hunt" });
    }
  });

  app.delete("/api/hunts/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const success = await storage.deleteHunt(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Hunt not found" });
      }
      res.json({ message: "Hunt deleted successfully" });
    } catch (error) {
      console.error('Error deleting hunt:', error);
      res.status(500).json({ error: "Failed to delete hunt" });
    }
  });

  // Bonus routes
  app.get("/api/hunts/:huntId/bonuses", async (req, res) => {
    try {
      const bonuses = await storage.getBonusesByHuntId(req.params.huntId);
      res.json(bonuses);
    } catch (error) {
      console.error('Error fetching bonuses:', error);
      res.status(500).json({ error: "Failed to fetch bonuses" });
    }
  });

  app.post("/api/hunts/:huntId/bonuses", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const bonusData = insertBonusSchema.parse({
        ...req.body,
        huntId: req.params.huntId,
      });
      const bonus = await storage.createBonus(bonusData);
      res.status(201).json(bonus);
    } catch (error) {
      console.error('Error creating bonus:', error);
      res.status(400).json({ error: "Invalid bonus data" });
    }
  });

  app.put("/api/bonuses/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const bonusData = req.body;
      const bonus = await storage.updateBonus(req.params.id, bonusData);
      if (!bonus) {
        return res.status(404).json({ error: "Bonus not found" });
      }
      res.json(bonus);
    } catch (error) {
      console.error('Error updating bonus:', error);
      res.status(500).json({ error: "Failed to update bonus" });
    }
  });

  app.delete("/api/bonuses/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const success = await storage.deleteBonus(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Bonus not found" });
      }
      res.json({ message: "Bonus deleted successfully" });
    } catch (error) {
      console.error('Error deleting bonus:', error);
      res.status(500).json({ error: "Failed to delete bonus" });
    }
  });

  // Payout recording
  app.post("/api/bonuses/:id/payout", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { winAmount } = payoutSchema.parse(req.body);
      const bonus = await storage.getBonus(req.params.id);
      
      if (!bonus) {
        return res.status(404).json({ error: "Bonus not found" });
      }

      const multiplier = winAmount / Number(bonus.betAmount);
      const updatedBonus = await storage.updateBonus(req.params.id, {
        winAmount: winAmount.toString(),
        multiplier: multiplier.toString(),
        isPlayed: true,
        status: "opened",
      });

      // Update hunt status after recording payout
      await updateHuntStatus(bonus.huntId);

      res.json(updatedBonus);
    } catch (error) {
      console.error('Error recording payout:', error);
      res.status(400).json({ error: "Invalid payout data" });
    }
  });

  // Slot routes
  app.get("/api/slots", async (req, res) => {
    try {
      const { search } = req.query;
      let slots;
      
      if (search && typeof search === 'string') {
        slots = await storage.searchSlots(search);
      } else {
        slots = await storage.getSlots();
      }
      
      res.json(slots);
    } catch (error) {
      console.error('Error fetching slots:', error);
      res.status(500).json({ error: "Failed to fetch slots" });
    }
  });

  app.get("/api/slots/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.json([]);
      }
      
      const slots = await storage.searchSlots(q);
      res.json(slots);
    } catch (error) {
      console.error('Error searching slots:', error);
      res.status(500).json({ error: "Failed to search slots" });
    }
  });

  app.get("/api/slots/:name", async (req, res) => {
    try {
      const slot = await storage.getSlotByName(decodeURIComponent(req.params.name));
      if (!slot) {
        return res.status(404).json({ error: "Slot not found" });
      }
      res.json(slot);
    } catch (error) {
      console.error('Error fetching slot:', error);
      res.status(500).json({ error: "Failed to fetch slot" });
    }
  });

  // Stats routes
  app.get("/api/stats", optionalAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      let stats;
      if (req.adminKey) {
        // Return admin-specific stats
        stats = await storage.getAdminStats(req.adminKey);
      } else {
        // Return global stats
        stats = await storage.getStats();
      }
      res.json(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Latest hunt routes
  app.get("/api/latest-hunt", optionalAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      let hunt;
      if (req.adminKey) {
        hunt = await storage.getLatestAdminHunt(req.adminKey);
      } else {
        hunt = await storage.getLatestHunt();
      }
      
      if (!hunt) {
        return res.status(404).json({ error: "No hunt found" });
      }
      
      res.json(hunt);
    } catch (error) {
      console.error('Error fetching latest hunt:', error);
      res.status(500).json({ error: "Failed to fetch latest hunt" });
    }
  });

  // OBS overlay route for latest hunt (admin-specific)
  app.get('/api/obs-overlay/latest', optionalAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      let latestHunt;
      if (req.adminKey) {
        latestHunt = await storage.getLatestAdminActiveHunt(req.adminKey);
      } else {
        latestHunt = await storage.getLatestActiveHunt();
      }
      
      if (!latestHunt) {
        return res.json({ hunt: null, bonuses: [] });
      }
      
      const bonuses = await storage.getBonusesByHuntId(latestHunt.id);
      res.json({ hunt: latestHunt, bonuses });
    } catch (error) {
      console.error('Error fetching latest hunt:', error);
      res.status(500).json({ error: 'Failed to fetch latest hunt' });
    }
  });

  // Admin-specific overlay endpoint - publicly accessible for specific admin's latest hunt
  app.get('/api/obs-overlay/admin/:adminKey', async (req, res) => {
    try {
      const { adminKey } = req.params;
      const latestHunt = await storage.getLatestAdminActiveHunt(adminKey);
      
      if (!latestHunt) {
        return res.json({ hunt: null, bonuses: [], adminKey });
      }

      const bonuses = await storage.getBonusesByHuntId(latestHunt.id);
      res.json({ hunt: latestHunt, bonuses, adminKey });
    } catch (error) {
      console.error('Error fetching admin hunt for overlay:', error);
      res.status(500).json({ error: 'Failed to fetch admin hunt' });
    }
  });

  // Public hunt view
  app.get("/api/public/:token", async (req, res) => {
    try {
      const hunt = await storage.getHuntByPublicToken(req.params.token);
      if (!hunt) {
        return res.status(404).json({ error: "Hunt not found" });
      }
      res.json(hunt);
    } catch (error) {
      console.error('Error fetching public hunt:', error);
      res.status(500).json({ error: "Failed to fetch hunt" });
    }
  });

  // Import slots from CSV
  app.post("/api/admin/import-slots", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      // Clear existing slots
      await storage.clearSlots();
      
      const csvPath = "./data/slots.csv";
      if (!fs.existsSync(csvPath)) {
        return res.status(404).json({ error: "Slots CSV file not found" });
      }

      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
      });

      const slots = records.map((record: any) => ({
        name: record.name || record.Name,
        provider: record.provider || record.Provider,
        imageUrl: record.imageUrl || record.image || record.Image,
        category: record.category || record.Category || null,
      }));

      await storage.bulkCreateSlots(slots);
      
      res.json({ 
        message: `Successfully imported ${slots.length} slots`,
        count: slots.length 
      });
    } catch (error) {
      console.error('Error importing slots:', error);
      res.status(500).json({ error: "Failed to import slots" });
    }
  });

  // Start playing functionality
  app.post("/api/hunts/:id/start-playing", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const hunt = await storage.updateHunt(req.params.id, {
        isPlaying: true,
        currentSlotIndex: 0,
        status: "opening"
      });
      
      if (!hunt) {
        return res.status(404).json({ error: "Hunt not found" });
      }
      
      res.json(hunt);
    } catch (error) {
      console.error('Error starting hunt play:', error);
      res.status(500).json({ error: "Failed to start playing" });
    }
  });

  // Stop playing functionality
  app.post("/api/hunts/:id/stop-playing", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const hunt = await storage.updateHunt(req.params.id, {
        isPlaying: false,
        status: "finished"
      });
      
      if (!hunt) {
        return res.status(404).json({ error: "Hunt not found" });
      }
      
      res.json(hunt);
    } catch (error) {
      console.error('Error stopping hunt play:', error);
      res.status(500).json({ error: "Failed to stop playing" });
    }
  });

  // Admin Key Management Routes - Only for GambiZard admin
  app.get("/api/admin/keys", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      // Only allow GambiZard admin to access admin key management
      if (req.adminKey !== "GZ-239-2932-92302") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const adminKeys = await storage.getAllAdminKeys();
      res.json(adminKeys);
    } catch (error) {
      console.error('Error fetching admin keys:', error);
      res.status(500).json({ error: "Failed to fetch admin keys" });
    }
  });

  app.post("/api/admin/keys", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      // Only allow GambiZard admin to create admin keys
      if (req.adminKey !== "GZ-239-2932-92302") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { keyValue, displayName, keyName, expiresAt } = req.body;
      
      if (!keyValue || !displayName || !keyName) {
        return res.status(400).json({ error: "Key value, display name, and key name are required" });
      }

      // Check if key already exists
      const existingKey = await storage.getAdminKeyByValue(keyValue);
      if (existingKey) {
        return res.status(400).json({ error: "Admin key already exists" });
      }

      const adminKey = await storage.createAdminKey({
        keyValue,
        displayName,
        keyName,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      res.status(201).json(adminKey);
    } catch (error) {
      console.error('Error creating admin key:', error);
      res.status(500).json({ error: "Failed to create admin key" });
    }
  });

  app.put("/api/admin/keys/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      // Only allow GambiZard admin to edit admin keys
      if (req.adminKey !== "GZ-239-2932-92302") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { displayName, keyName, expiresAt, isActive } = req.body;
      
      const adminKey = await storage.updateAdminKey(req.params.id, {
        displayName,
        keyName,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive,
      });
      
      if (!adminKey) {
        return res.status(404).json({ error: "Admin key not found" });
      }

      res.json(adminKey);
    } catch (error) {
      console.error('Error updating admin key:', error);
      res.status(500).json({ error: "Failed to update admin key" });
    }
  });

  app.delete("/api/admin/keys/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      // Only allow GambiZard admin to delete admin keys
      if (req.adminKey !== "GZ-239-2932-92302") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const adminKey = await storage.getAdminKeyById(req.params.id);
      if (!adminKey) {
        return res.status(404).json({ error: "Admin key not found" });
      }

      await storage.deleteAdminKey(req.params.id);
      res.json({ message: "Admin key deleted successfully" });
    } catch (error) {
      console.error('Error deleting admin key:', error);
      res.status(500).json({ error: "Failed to delete admin key" });
    }
  });

  // Raffle routes
  app.get("/api/raffles", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const raffles = await storage.getRafflesWithStats(req.adminKey);
      res.json(raffles);
    } catch (error) {
      console.error("Error fetching raffles:", error);
      res.status(500).json({ message: "Failed to fetch raffles" });
    }
  });

  app.post("/api/raffles", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const raffleData = req.body;
      const raffle = await storage.createRaffle(raffleData, req.adminKey);
      res.json(raffle);
    } catch (error) {
      console.error("Error creating raffle:", error);
      res.status(500).json({ message: "Failed to create raffle" });
    }
  });

  app.get("/api/raffles/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const raffle = await storage.getRaffle(req.params.id);
      if (!raffle) {
        return res.status(404).json({ message: "Raffle not found" });
      }
      res.json(raffle);
    } catch (error) {
      console.error("Error fetching raffle:", error);
      res.status(500).json({ message: "Failed to fetch raffle" });
    }
  });

  app.put("/api/raffles/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const raffle = await storage.updateRaffle(req.params.id, req.body);
      if (!raffle) {
        return res.status(404).json({ message: "Raffle not found" });
      }
      res.json(raffle);
    } catch (error) {
      console.error("Error updating raffle:", error);
      res.status(500).json({ message: "Failed to update raffle" });
    }
  });

  app.delete("/api/raffles/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const success = await storage.deleteRaffle(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Raffle not found" });
      }
      res.json({ message: "Raffle deleted successfully" });
    } catch (error) {
      console.error("Error deleting raffle:", error);
      res.status(500).json({ message: "Failed to delete raffle" });
    }
  });

  // Raffle entries routes
  app.get("/api/raffles/:id/entries", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const entries = await storage.getRaffleEntries(req.params.id);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching raffle entries:", error);
      res.status(500).json({ message: "Failed to fetch raffle entries" });
    }
  });

  app.post("/api/raffles/:id/entries", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const entryCount = await storage.getRaffleEntryCount(req.params.id);
      const entryData = {
        ...req.body,
        raffleId: req.params.id,
        entryNumber: entryCount + 1,
      };
      const entry = await storage.createRaffleEntry(entryData);
      res.json(entry);
    } catch (error) {
      console.error("Error creating raffle entry:", error);
      res.status(500).json({ message: "Failed to create raffle entry" });
    }
  });

  // Draw winners route
  app.post("/api/raffles/:id/draw-winners", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const raffle = await storage.getRaffle(req.params.id);
      if (!raffle) {
        return res.status(404).json({ message: "Raffle not found" });
      }

      const winners = await storage.drawRaffleWinners(req.params.id, raffle.winnerCount);
      res.json({ winners });
    } catch (error) {
      console.error("Error drawing raffle winners:", error);
      res.status(500).json({ message: error.message || "Failed to draw winners" });
    }
  });

  // Raffle control routes
  app.post("/api/raffles/:id/start", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const raffle = await storage.updateRaffle(req.params.id, { 
        status: "active",
        startTime: new Date()
      });
      if (!raffle) {
        return res.status(404).json({ message: "Raffle not found" });
      }
      res.json(raffle);
    } catch (error) {
      console.error("Error starting raffle:", error);
      res.status(500).json({ message: "Failed to start raffle" });
    }
  });

  app.post("/api/raffles/:id/pause", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const raffle = await storage.updateRaffle(req.params.id, { status: "paused" });
      if (!raffle) {
        return res.status(404).json({ message: "Raffle not found" });
      }
      res.json(raffle);
    } catch (error) {
      console.error("Error pausing raffle:", error);
      res.status(500).json({ message: "Failed to pause raffle" });
    }
  });

  app.post("/api/raffles/:id/end", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const raffle = await storage.updateRaffle(req.params.id, { 
        status: "ended",
        endTime: new Date()
      });
      if (!raffle) {
        return res.status(404).json({ message: "Raffle not found" });
      }
      res.json(raffle);
    } catch (error) {
      console.error("Error ending raffle:", error);
      res.status(500).json({ message: "Failed to end raffle" });
    }
  });

  app.delete("/api/raffles/:id/entries", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      await storage.clearRaffleEntries(req.params.id);
      res.json({ message: "All raffle entries cleared successfully" });
    } catch (error) {
      console.error("Error clearing raffle entries:", error);
      res.status(500).json({ message: "Failed to clear entries" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}