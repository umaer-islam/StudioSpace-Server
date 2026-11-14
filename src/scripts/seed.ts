import { connectToDatabase, closeDatabaseConnection, getDatabase } from "../config/database.js";
import { Studio } from "../models/studio.model.js";

const seedStudios: Omit<Studio, "_id" | "createdAt" | "updatedAt">[] = [
  // Photo Studios
  {
    title: "Lumina Daylight & Cyc Wall Loft",
    category: "Photo Studio",
    hourlyRate: 95,
    securityDeposit: 150,
    maxCapacity: 25,
    location: "DUMBO, Brooklyn",
    address: "55 Washington Street, Studio 402",
    imageUrl: "https://images.unsplash.com/photo-1527011046414-4781f1f94f8c?auto=format&fit=crop&w=1200&q=80",
    amenities: ["Corner Daylight", "16ft White Cyclorama", "Profoto D2 Lighting Kit", "Hair & Makeup Vanity", "Freight Elevator", "High-Speed WiFi"],
    overview: "A bright 2,200 sq ft corner daylight studio in iconic DUMBO with sweeping Manhattan views, polished concrete floors, and full blackout capability.",
    hostName: "Maya Lin",
    hostEmail: "maya@luminastudios.com",
    rating: 4.95,
    reviewCount: 38,
    status: "active",
  },
  {
    title: "The Industrial Sunlit Warehouse",
    category: "Photo Studio",
    hourlyRate: 80,
    securityDeposit: 100,
    maxCapacity: 35,
    location: "Long Island City, Queens",
    address: "43-01 21st Street, Building B",
    imageUrl: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80",
    amenities: ["Exposed Brick", "South-Facing Factory Windows", "C-Stands & Sandbags", "Steamer & Wardrobe Racks", "Loading Dock"],
    overview: "Sprawling vintage factory turned daylight haven. Features authentic distressed brick textures, steel beams, and warm directional sunlight all afternoon.",
    hostName: "Julian Vance",
    hostEmail: "julian@licwarehouse.com",
    rating: 4.88,
    reviewCount: 29,
    status: "active",
  },
  {
    title: "Minimalist Editorial Studio Atelier",
    category: "Photo Studio",
    hourlyRate: 110,
    securityDeposit: 200,
    maxCapacity: 18,
    location: "SoHo, Manhattan",
    address: "420 Broome Street, 3rd Floor",
    imageUrl: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80",
    amenities: ["Curated Designer Props", "Paper Backdrops (12 Colors)", "BXR Continuous Lights", "Espresso Bar", "Private Dressing Room"],
    overview: "Curated fashion and editorial sanctuary in prime SoHo. Neutral palette, archival furniture pieces, and pristine hardwood flooring.",
    hostName: "Sophie Chen",
    hostEmail: "sophie@ateliercreative.com",
    rating: 5.0,
    reviewCount: 42,
    status: "active",
  },

  // Film Stages
  {
    title: "Apex Sound Stage & Virtual Production",
    category: "Film Stage",
    hourlyRate: 180,
    securityDeposit: 350,
    maxCapacity: 60,
    location: "Greenpoint, Brooklyn",
    address: "180 West Street, Stage 1",
    imageUrl: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80",
    amenities: ["Soundproofed Stage (NC-25)", "Pre-Rigged Lighting Grid", "Drive-In Loading Gate", "3-Phase 400A Power", "Production Office Suites"],
    overview: "Full-scale commercial production stage with silent air conditioning, green screen cyclorama, and dedicated production offices for feature crews.",
    hostName: "David Kross",
    hostEmail: "david@apexstages.com",
    rating: 4.92,
    reviewCount: 23,
    status: "active",
  },
  {
    title: "The Black Box Cinema Studio",
    category: "Film Stage",
    hourlyRate: 140,
    securityDeposit: 250,
    maxCapacity: 40,
    location: "Bushwick, Brooklyn",
    address: "249 Varet Street",
    imageUrl: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=1200&q=80",
    amenities: ["Full Blackout Velour Curtains", "Aputure 600d Cinema Lights", "Overhead Rigging Pipes", "Hair & Makeup Green Room", "Kitchenette"],
    overview: "Versatile modular black box studio engineered for music videos, commercial shoots, and high-contrast dramatic productions.",
    hostName: "Tariq Ramos",
    hostEmail: "tariq@blackboxcinema.com",
    rating: 4.85,
    reviewCount: 19,
    status: "active",
  },

  // Podcast Rooms
  {
    title: "Soundcheck Broadcast & Video Podcast Lounge",
    category: "Podcast Lounge",
    hourlyRate: 70,
    securityDeposit: 80,
    maxCapacity: 8,
    location: "Flatiron, Manhattan",
    address: "115 5th Avenue, Suite 600",
    imageUrl: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=1200&q=80",
    amenities: ["4x Shure SM7B Mics", "Rodecaster Pro II Console", "3x 4K Sony FX3 Cameras", "Acoustic Wood Paneling", "Live Streaming Setup"],
    overview: "Turnkey multi-camera video podcast suite in Flatiron. Premium acoustic engineering with bespoke walnut table and professional broadcast gear.",
    hostName: "Liam O'Connor",
    hostEmail: "liam@soundcheckmedia.com",
    rating: 4.97,
    reviewCount: 56,
    status: "active",
  },
  {
    title: "The Narrative Audio Booth & Roundtable",
    category: "Podcast Lounge",
    hourlyRate: 60,
    securityDeposit: 60,
    maxCapacity: 6,
    location: "Williamsburg, Brooklyn",
    address: "210 Bedford Avenue, Floor 2",
    imageUrl: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?auto=format&fit=crop&w=1200&q=80",
    amenities: ["Electro-Voice RE20 Mics", "Sound Devices MixPre-6", "Ultra-Silent Room Treatment", "Mid-Century Lounge Seating", "High-Speed Fiber"],
    overview: "Intimate and cozy podcast room tailored for conversational storytelling, journalism interviews, and voiceover recordings.",
    hostName: "Chloe Sterling",
    hostEmail: "chloe@narrativeaudio.com",
    rating: 4.9,
    reviewCount: 31,
    status: "active",
  },

  // Music Suites
  {
    title: "Resonance Analog & Dolby Atmos Suite",
    category: "Music Suite",
    hourlyRate: 125,
    securityDeposit: 200,
    maxCapacity: 12,
    location: "Chelsea, Manhattan",
    address: "520 W 27th Street, Studio 7",
    imageUrl: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80",
    amenities: ["Genelec 7.1.4 Atmos Monitoring", "Universal Audio Apollo x16", "Vintage Neve 1073 Preamps", "Moog Subsequent 37", "Vocal Isolation Booth"],
    overview: "State-of-the-art tracking, mixing, and mastering suite with floating acoustic walls, outboard analog gear, and immersive Dolby Atmos monitoring.",
    hostName: "Marcus Vance",
    hostEmail: "marcus@resonancestudios.com",
    rating: 4.98,
    reviewCount: 47,
    status: "active",
  },
  {
    title: "Echo Park Indie Tracking & Jam Room",
    category: "Music Suite",
    hourlyRate: 75,
    securityDeposit: 100,
    maxCapacity: 10,
    location: "Astoria, Queens",
    address: "31-10 Broadway, Basement Suite",
    imageUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80",
    amenities: ["Fender Twin Reverb Amp", "Yamaha Drum Kit", "Nord Stage 3 Keyboard", "16-Channel Snake & Live Monitors", "Soundproofed"],
    overview: "A vibrant full-band tracking room and rehearsal space stocked with premium amplifiers, drums, and vintage synths ready for creative sessions.",
    hostName: "Andre Diaz",
    hostEmail: "andre@echoparkmusic.com",
    rating: 4.82,
    reviewCount: 34,
    status: "active",
  },

  // Art Workshops
  {
    title: "The Ceramic & Clay Pottery Loft",
    category: "Workshop",
    hourlyRate: 65,
    securityDeposit: 50,
    maxCapacity: 20,
    location: "Gowanus, Brooklyn",
    address: "540 President Street, Studio 12",
    imageUrl: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=1200&q=80",
    amenities: ["8x Shimpo Pottery Wheels", "Electric Kiln", "Reclaim Station & Clay Sinks", "Large Glazing Workbenches", "Natural Skylights"],
    overview: "Spacious sun-drenched industrial pottery and sculpture atelier equipped with professional pottery wheels, glazes, and high-fire kilns.",
    hostName: "Isabella Rossi",
    hostEmail: "isabella@gowanusclay.com",
    rating: 4.93,
    reviewCount: 41,
    status: "active",
  },
  {
    title: "Canvas & Light Botanical Painting Studio",
    category: "Workshop",
    hourlyRate: 55,
    securityDeposit: 50,
    maxCapacity: 16,
    location: "Lower East Side, Manhattan",
    address: "168 Orchard Street, 2nd Floor",
    imageUrl: "https://images.unsplash.com/photo-1460661419200-1868a1eb65bc?auto=format&fit=crop&w=1200&q=80",
    amenities: ["16x Heavy-Duty Oak Easels", "Solvent-Safe Wash Stations", "Still-Life Props & Plants", "Drafting Tables", "Exhibition Hanging Rail"],
    overview: "A calm, plant-filled sanctuary with north-facing skylights designed for painting classes, creative workshops, figure drawing, and gallery popups.",
    hostName: "Camila Duarte",
    hostEmail: "camila@canvasandlight.com",
    rating: 4.89,
    reviewCount: 27,
    status: "active",
  },
  {
    title: "MakerLab Screenprinting & Textile Atelier",
    category: "Workshop",
    hourlyRate: 70,
    securityDeposit: 80,
    maxCapacity: 22,
    location: "Red Hook, Brooklyn",
    address: "135 Van Dyke Street, Bay 4",
    imageUrl: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80",
    amenities: ["4-Color Silk Screen Press", "Darkroom & Exposure Unit", "Large Textile Washout Booth", "Fabric Cutting Tables", "Waterfront Yard"],
    overview: "Historic Red Hook maritime warehouse outfitted for screenprinting, printmaking, and fiber arts with direct breeze from the harbor.",
    hostName: "Noah Becker",
    hostEmail: "noah@makerlabredhook.com",
    rating: 4.91,
    reviewCount: 33,
    status: "active",
  },
];

async function seed() {
  console.log("=== StudioSpace Seed Runner ===");
  await connectToDatabase();
  const db = getDatabase();
  const collection = db.collection<Studio>("studios");

  let insertedCount = 0;
  let skippedCount = 0;
  const now = new Date();

  for (const studio of seedStudios) {
    const existing = await collection.findOne({ title: studio.title });
    if (existing) {
      await collection.updateOne(
        { _id: existing._id },
        {
          $set: {
            imageUrl: studio.imageUrl,
            category: studio.category,
            overview: studio.overview,
            amenities: studio.amenities,
            hourlyRate: studio.hourlyRate,
            updatedAt: now,
          },
        }
      );
      skippedCount++;
    } else {
      await collection.insertOne({
        ...studio,
        bookingLockVersion: 0,
        createdAt: now,
        updatedAt: now,
      } as any);
      insertedCount++;
    }
  }

  // Ensure any existing studios also have bookingLockVersion initialized to 0
  const updatedExisting = await collection.updateMany(
    { bookingLockVersion: { $exists: false } },
    { $set: { bookingLockVersion: 0 } }
  );
  if (updatedExisting.modifiedCount > 0) {
    console.log(`  Initialized bookingLockVersion: 0 on ${updatedExisting.modifiedCount} existing studios`);
  }

  console.log(`\nSeed completed:`);
  console.log(`  Inserted: ${insertedCount} new studios`);
  console.log(`  Skipped (already exists): ${skippedCount} studios`);
  const totalInDb = await collection.countDocuments();
  console.log(`  Total studios in database: ${totalInDb}\n`);

  await closeDatabaseConnection();
}

seed().catch(async (err) => {
  console.error("Seed failed:", err);
  await closeDatabaseConnection();
  process.exit(1);
});

