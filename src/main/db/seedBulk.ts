import type Database from "better-sqlite3";

// ---- Item definitions: name, code, unit, reorder_level ----
const ITEM_TEMPLATES: {
  name: string;
  code: string;
  unit: string;
  reorder: number;
}[] = [
  { name: "Rice (Basmati)", code: "GRC-001", unit: "bags", reorder: 50 },
  { name: "Rice (Sona Masoori)", code: "GRC-002", unit: "bags", reorder: 80 },
  { name: "Rice (Broken)", code: "GRC-003", unit: "bags", reorder: 40 },
  { name: "Wheat", code: "GRC-004", unit: "bags", reorder: 60 },
  { name: "Atta (Premium)", code: "GRC-005", unit: "bags", reorder: 100 },
  { name: "Atta (Standard)", code: "GRC-006", unit: "bags", reorder: 120 },
  { name: "Maida", code: "GRC-007", unit: "bags", reorder: 30 },
  { name: "Sooji", code: "GRC-008", unit: "bags", reorder: 25 },
  { name: "Besan", code: "GRC-009", unit: "bags", reorder: 40 },
  { name: "Toor Dal", code: "PUL-001", unit: "bags", reorder: 50 },
  { name: "Moong Dal", code: "PUL-002", unit: "bags", reorder: 35 },
  { name: "Urad Dal", code: "PUL-003", unit: "bags", reorder: 30 },
  { name: "Chana Dal", code: "PUL-004", unit: "bags", reorder: 45 },
  { name: "Masoor Dal", code: "PUL-005", unit: "bags", reorder: 40 },
  { name: "Rajma", code: "PUL-006", unit: "bags", reorder: 20 },
  { name: "Chole", code: "PUL-007", unit: "bags", reorder: 25 },
  { name: "Sugar", code: "SWT-001", unit: "bags", reorder: 80 },
  { name: "Jaggery", code: "SWT-002", unit: "kg", reorder: 100 },
  { name: "Salt (Iodised)", code: "SPC-001", unit: "bags", reorder: 150 },
  { name: "Turmeric Powder", code: "SPC-002", unit: "kg", reorder: 50 },
  { name: "Red Chilli Powder", code: "SPC-003", unit: "kg", reorder: 40 },
  { name: "Coriander Powder", code: "SPC-004", unit: "kg", reorder: 45 },
  { name: "Cumin Powder", code: "SPC-005", unit: "kg", reorder: 30 },
  { name: "Garam Masala", code: "SPC-006", unit: "kg", reorder: 25 },
  { name: "Black Pepper", code: "SPC-007", unit: "kg", reorder: 20 },
  { name: "Cardamom", code: "SPC-008", unit: "kg", reorder: 10 },
  { name: "Cinnamon", code: "SPC-009", unit: "kg", reorder: 15 },
  { name: "Mustard Oil", code: "OIL-001", unit: "tins", reorder: 60 },
  { name: "Refined Oil", code: "OIL-002", unit: "tins", reorder: 80 },
  { name: "Groundnut Oil", code: "OIL-003", unit: "tins", reorder: 40 },
  { name: "Tea (CTC)", code: "BEV-001", unit: "kg", reorder: 50 },
  { name: "Tea (Dust)", code: "BEV-002", unit: "kg", reorder: 60 },
  { name: "Coffee Powder", code: "BEV-003", unit: "kg", reorder: 20 },
  { name: "Biscuits (Marie)", code: "SNK-001", unit: "cartons", reorder: 30 },
  { name: "Biscuits (Cream)", code: "SNK-002", unit: "cartons", reorder: 25 },
  { name: "Namkeen (Mix)", code: "SNK-003", unit: "cartons", reorder: 40 },
  { name: "Chips", code: "SNK-004", unit: "cartons", reorder: 50 },
  { name: "Soap (Bath)", code: "HHC-001", unit: "cartons", reorder: 60 },
  { name: "Detergent Powder", code: "HHC-002", unit: "cartons", reorder: 45 },
  { name: "Washing Bar", code: "HHC-003", unit: "cartons", reorder: 70 },
  { name: "Hair Oil", code: "HHC-004", unit: "cartons", reorder: 35 },
  { name: "Toothpaste", code: "HHC-005", unit: "cartons", reorder: 40 },
  { name: "Matchbox", code: "MSC-001", unit: "boxes", reorder: 100 },
  { name: "Candles", code: "MSC-002", unit: "boxes", reorder: 50 },
  { name: "Agarbatti", code: "MSC-003", unit: "boxes", reorder: 80 },
  { name: "Pooja Oil", code: "MSC-004", unit: "bottles", reorder: 40 },
  { name: "Haldiram Bhujia", code: "BRD-001", unit: "cartons", reorder: 30 },
  {
    name: "Haldiram Soan Papdi",
    code: "BRD-002",
    unit: "cartons",
    reorder: 20,
  },
  { name: "Parle-G", code: "BRD-003", unit: "cartons", reorder: 100 },
  { name: "Britannia Good Day", code: "BRD-004", unit: "cartons", reorder: 45 },
  { name: "Dabur Honey", code: "BRD-005", unit: "bottles", reorder: 25 },
  { name: "Colgate", code: "BRD-006", unit: "cartons", reorder: 50 },
  { name: "Lifebuoy Soap", code: "BRD-007", unit: "cartons", reorder: 55 },
  { name: "Surf Excel", code: "BRD-008", unit: "cartons", reorder: 35 },
  { name: "Tata Tea", code: "BRD-009", unit: "cartons", reorder: 40 },
  { name: "Fortune Oil", code: "BRD-010", unit: "cartons", reorder: 45 },
  { name: "Aashirvaad Atta", code: "BRD-011", unit: "bags", reorder: 60 },
  { name: "India Gate Rice", code: "BRD-012", unit: "bags", reorder: 40 },
  { name: "Tata Sampann Dal", code: "BRD-013", unit: "bags", reorder: 30 },
  { name: "MDH Chole Masala", code: "BRD-014", unit: "kg", reorder: 25 },
  {
    name: "Everest Pav Bhaji Masala",
    code: "BRD-015",
    unit: "kg",
    reorder: 20,
  },
  { name: "Lizol", code: "BRD-016", unit: "bottles", reorder: 30 },
  { name: "Vim Bar", code: "BRD-017", unit: "cartons", reorder: 40 },
  { name: "Patanjali Ghee", code: "BRD-018", unit: "tins", reorder: 25 },
  { name: "Amul Butter", code: "BRD-019", unit: "cartons", reorder: 35 },
  { name: "Nestle Maggi", code: "BRD-020", unit: "cartons", reorder: 80 },
  { name: "Kissan Jam", code: "BRD-021", unit: "bottles", reorder: 20 },
  { name: "Kissan Ketchup", code: "BRD-022", unit: "bottles", reorder: 30 },
  { name: "Tata Salt", code: "BRD-023", unit: "bags", reorder: 100 },
  { name: "Saffola Oil", code: "BRD-024", unit: "tins", reorder: 25 },
  { name: "Dalda Vanaspati", code: "BRD-025", unit: "tins", reorder: 40 },
  { name: "Pills (Paracetamol)", code: "MED-001", unit: "strips", reorder: 50 },
  { name: "Antacid", code: "MED-002", unit: "strips", reorder: 30 },
  { name: "Bandages", code: "MED-003", unit: "boxes", reorder: 20 },
  { name: "Cotton Wool", code: "MED-004", unit: "packs", reorder: 25 },
  { name: "Vicks VapoRub", code: "MED-005", unit: "pcs", reorder: 40 },
  { name: "Boroline", code: "MED-006", unit: "pcs", reorder: 35 },
  { name: "Moong (Green)", code: "PUL-008", unit: "bags", reorder: 30 },
  { name: "Matar", code: "PUL-009", unit: "bags", reorder: 25 },
  { name: "Kabuli Chana", code: "PUL-010", unit: "bags", reorder: 35 },
  { name: "Sabudana", code: "GRC-010", unit: "bags", reorder: 20 },
  { name: "Poha", code: "GRC-011", unit: "bags", reorder: 45 },
  { name: "Vermicelli", code: "GRC-012", unit: "bags", reorder: 30 },
  { name: "Papad (Plain)", code: "SNK-005", unit: "packets", reorder: 60 },
  { name: "Papad (Masala)", code: "SNK-006", unit: "packets", reorder: 50 },
  { name: "Pickle (Mango)", code: "SNK-007", unit: "jars", reorder: 40 },
  { name: "Pickle (Mixed)", code: "SNK-008", unit: "jars", reorder: 35 },
  { name: "Sauce (Tomato)", code: "SNK-009", unit: "bottles", reorder: 45 },
  { name: "Vinegar", code: "SNK-010", unit: "bottles", reorder: 25 },
  { name: "Dry Fruits (Kaju)", code: "DRY-001", unit: "kg", reorder: 15 },
  { name: "Dry Fruits (Badam)", code: "DRY-002", unit: "kg", reorder: 15 },
  { name: "Dry Fruits (Kishmish)", code: "DRY-003", unit: "kg", reorder: 20 },
  { name: "Dry Fruits (Anjeer)", code: "DRY-004", unit: "kg", reorder: 10 },
  { name: "Coconut (Dry)", code: "DRY-005", unit: "kg", reorder: 40 },
  { name: "Groundnut", code: "DRY-006", unit: "bags", reorder: 50 },
  { name: "Til", code: "DRY-007", unit: "kg", reorder: 25 },
  { name: "Puffed Rice", code: "SNK-011", unit: "bags", reorder: 60 },
  { name: "Murmura", code: "SNK-012", unit: "bags", reorder: 55 },
  { name: "Chira", code: "GRC-013", unit: "bags", reorder: 40 },
  { name: "Gur", code: "SWT-003", unit: "kg", reorder: 80 },
  { name: "Milk Powder", code: "DAI-001", unit: "tins", reorder: 35 },
  { name: "Horlicks", code: "DAI-002", unit: "jars", reorder: 20 },
  { name: "Bournvita", code: "DAI-003", unit: "jars", reorder: 25 },
  { name: "Complan", code: "DAI-004", unit: "jars", reorder: 15 },
  { name: "Noodles (Other)", code: "BRD-026", unit: "cartons", reorder: 40 },
  { name: "Pasta", code: "BRD-027", unit: "cartons", reorder: 25 },
  { name: "Oats", code: "BRD-028", unit: "cartons", reorder: 30 },
  { name: "Cornflakes", code: "BRD-029", unit: "cartons", reorder: 20 },
  { name: "Muesli", code: "BRD-030", unit: "cartons", reorder: 15 },
  { name: "Rava", code: "GRC-014", unit: "bags", reorder: 35 },
  { name: "Poha (Thick)", code: "GRC-015", unit: "bags", reorder: 30 },
  { name: "Suji (Fine)", code: "GRC-016", unit: "bags", reorder: 25 },
  { name: "Rice Flour", code: "GRC-017", unit: "bags", reorder: 20 },
  { name: "Bajra", code: "GRC-018", unit: "bags", reorder: 25 },
  { name: "Jowar", code: "GRC-019", unit: "bags", reorder: 20 },
  { name: "Rajgira", code: "GRC-020", unit: "kg", reorder: 15 },
  { name: "Sattu", code: "GRC-021", unit: "bags", reorder: 30 },
  { name: "Muri", code: "SNK-013", unit: "bags", reorder: 70 },
  { name: "Jhalmuri Mix", code: "SNK-014", unit: "packets", reorder: 45 },
  { name: "Chanachur", code: "SNK-015", unit: "packets", reorder: 60 },
  { name: "Ladoo", code: "SWT-004", unit: "kg", reorder: 20 },
  { name: "Rasgulla", code: "SWT-005", unit: "kg", reorder: 15 },
  { name: "Gulab Jamun Mix", code: "SWT-006", unit: "packets", reorder: 25 },
  { name: "Shrikhand", code: "DAI-005", unit: "cups", reorder: 20 },
  { name: "Paneer", code: "DAI-006", unit: "kg", reorder: 15 },
  { name: "Ghee (Pouch)", code: "DAI-007", unit: "pouches", reorder: 40 },
  { name: "Curd", code: "DAI-008", unit: "cups", reorder: 30 },
  { name: "Lassi", code: "DAI-009", unit: "bottles", reorder: 25 },
  { name: "Lemon", code: "FRS-001", unit: "kg", reorder: 20 },
  { name: "Ginger", code: "FRS-002", unit: "kg", reorder: 25 },
  { name: "Garlic", code: "FRS-003", unit: "kg", reorder: 30 },
  { name: "Onion", code: "FRS-004", unit: "bags", reorder: 50 },
  { name: "Potato", code: "FRS-005", unit: "bags", reorder: 60 },
  { name: "Tomato", code: "FRS-006", unit: "kg", reorder: 40 },
  { name: "Green Chilli", code: "FRS-007", unit: "kg", reorder: 15 },
  { name: "Coriander Leaves", code: "FRS-008", unit: "kg", reorder: 10 },
  { name: "Mint", code: "FRS-009", unit: "kg", reorder: 10 },
  { name: "Curry Leaves", code: "FRS-010", unit: "kg", reorder: 5 },
];

// ---- Mahajan names and locations (Indian) ----
const MAHAJAN_FIRST_NAMES = [
  "Amit",
  "Anil",
  "Arun",
  "Bimal",
  "Debabrata",
  "Gopal",
  "Harish",
  "Jitendra",
  "Krishna",
  "Manoj",
  "Narendra",
  "Pradeep",
  "Rajesh",
  "Suresh",
  "Vikram",
  "Subhash",
  "Ramesh",
  "Dinesh",
  "Mohan",
  "Sachin",
  "Purnima",
  "Mousumi",
  "Anita",
  "Bina",
  "Chandana",
  "Deepa",
  "Gita",
  "Indira",
  "Kavita",
  "Lata",
  "Mamata",
  "Nandini",
  "Pratima",
  "Rekha",
  "Sunita",
  "Uma",
  "Vandana",
  "Rina",
  "Smita",
  "Tulika",
  "Abhishek",
  "Aditya",
  "Akash",
  "Anand",
  "Bikash",
  "Chandan",
  "Dipankar",
  "Gautam",
  "Himanshu",
  "Joy",
  "Kunal",
  "Lalit",
  "Nitin",
  "Pranab",
  "Rahul",
  "Sanjay",
  "Tapan",
  "Uday",
  "Vivek",
  "Yogesh",
  "Aparna",
  "Bhaswati",
  "Chandrika",
  "Devika",
  "Esha",
  "Farida",
  "Gargi",
  "Hema",
  "Ishita",
  "Jyotsna",
];

const MAHAJAN_LAST_NAMES = [
  "Banerjee",
  "Chatterjee",
  "Das",
  "Dutta",
  "Ghosh",
  "Mukherjee",
  "Roy",
  "Sengupta",
  "Bose",
  "Mitra",
  "Patel",
  "Sharma",
  "Singh",
  "Kumar",
  "Gupta",
  "Jha",
  "Prasad",
  "Verma",
  "Yadav",
  "Shah",
  "Nandi",
  "Mandal",
  "Saha",
  "Kar",
  "Pal",
  "Chakraborty",
  "Sinha",
  "Lahiri",
  "Ganguly",
  "Bhattacharya",
];

const AREAS = [
  "Kolkata",
  "Howrah",
  "Hooghly",
  "North 24 Parganas",
  "South 24 Parganas",
  "Nadia",
  "Bardhaman",
  "Asansol",
  "Durgapur",
  "Siliguri",
  "Malda",
  "Murshidabad",
  "Cooch Behar",
  "Jalpaiguri",
  "Darjeeling",
  "Bally",
  "Baranagar",
  "Bidhannagar",
  "Rajarhat",
  "Salt Lake",
  "New Town",
  "Behala",
  "Jadavpur",
  "Garia",
  "Tollygunge",
  "Park Street",
  "Burrabazar",
  "Bowbazar",
  "Sealdah",
  "Howrah Station",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(from: string, to: string): string {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  const t = a + Math.random() * (b - a);
  return new Date(t).toISOString().slice(0, 10);
}

const TXN_START = "2025-01-01";
const TXN_END = "2026-03-01";

// Godown unit name → symbol (for display). Empty = use full name.
const UNIT_SYMBOLS: Record<string, string | null> = {
  bags: null,
  kg: "kg",
  tins: null,
  cartons: null,
  boxes: null,
  bottles: null,
  strips: null,
  pcs: "pcs",
  packs: null,
  packets: null,
  jars: null,
  pouches: null,
  cups: null,
};

function seedUnits(db: Database.Database): void {
  const unitNames = [...new Set(ITEM_TEMPLATES.map((i) => i.unit))].sort();
  const insertUnit = db.prepare(
    "INSERT OR IGNORE INTO units (name, symbol) VALUES (?, ?)"
  );
  for (const name of unitNames) {
    insertUnit.run(name, UNIT_SYMBOLS[name] ?? null);
  }
}

// Invoice (selling) units: small units first for dropdown.
const INVOICE_UNITS: {
  name: string;
  symbol: string | null;
  sort_order: number;
}[] = [
  { name: "gram", symbol: "g", sort_order: 0 },
  { name: "kilogram", symbol: "kg", sort_order: 2 },
  { name: "liter", symbol: "L", sort_order: 4 },
  { name: "ml", symbol: "ml", sort_order: 5 },
  { name: "pcs", symbol: "pcs", sort_order: 6 },
  { name: "box", symbol: null, sort_order: 7 },
  { name: "packet", symbol: "pack", sort_order: 8 },
  { name: "bags", symbol: null, sort_order: 9 },
  { name: "cartons", symbol: null, sort_order: 10 },
  { name: "tins", symbol: null, sort_order: 11 },
  { name: "bottles", symbol: null, sort_order: 12 },
  { name: "jars", symbol: null, sort_order: 13 },
];

function seedInvoiceUnits(db: Database.Database): void {
  try {
    const insert = db.prepare(
      "INSERT OR IGNORE INTO invoice_units (name, symbol, sort_order) VALUES (?, ?, ?)"
    );
    for (const u of INVOICE_UNITS) {
      insert.run(u.name, u.symbol, u.sort_order);
    }
  } catch {
    // Table may not exist if schema order differs
  }
}

function retailPrimaryFromGodownUnit(godownUnit: string): string | null {
  const m: Record<string, string> = {
    bags: "kg",
    kg: "kg",
    tins: "L",
    bottles: "L",
    cartons: "pcs",
    boxes: "pcs",
    pcs: "pcs",
    jars: "pcs",
    packets: "pcs",
    pouches: "pcs",
    strips: "pcs",
  };
  return m[godownUnit] ?? null;
}

function seedItems(db: Database.Database): void {
  const insertItem = db.prepare(
    "INSERT INTO items (name, code, unit, retail_primary_unit, current_stock, reorder_level) VALUES (?, ?, ?, ?, 0, ?)"
  );
  const insertOtherUnit = db.prepare(
    "INSERT INTO item_other_units (item_id, unit, sort_order) VALUES (?, ?, ?)"
  );
  for (const item of ITEM_TEMPLATES) {
    const retailPrimary = retailPrimaryFromGodownUnit(item.unit);
    const result = insertItem.run(
      item.name,
      item.code,
      item.unit,
      retailPrimary,
      item.reorder
    );
    const itemId = (result as { lastInsertRowid: number }).lastInsertRowid;
    if (retailPrimary && retailPrimary !== item.unit && itemId) {
      insertOtherUnit.run(itemId, retailPrimary, 0);
    }
  }
}

function seedSettings(db: Database.Database): void {
  try {
    const set = db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    );
    set.run("company_name", "Shree Krishna Traders");
    set.run(
      "company_address",
      "12, Netaji Subhas Road, Burrabazar, Kolkata - 700001, West Bengal"
    );
    set.run("gstin", "19AABCS1234N1ZN");
    set.run("owner_name", "Rajesh Kumar");
    set.run("owner_phone", "9830123456");
  } catch {
    // settings table may not exist
  }
}

type ItemWithUnit = { id: number; name: string; sell_unit: string };

function seedInvoices(db: Database.Database, _itemRows: ItemRow[]): void {
  try {
    const itemsWithUnit = db
      .prepare(
        "SELECT id, name, COALESCE(retail_primary_unit, unit) AS sell_unit FROM items"
      )
      .all() as ItemWithUnit[];
    if (itemsWithUnit.length === 0) return;
    const insertInv = db.prepare(
      "INSERT INTO invoices (invoice_number, customer_name, customer_address, invoice_date, notes) VALUES (?, ?, ?, ?, ?)"
    );
    const insertLine = db.prepare(
      "INSERT INTO invoice_lines (invoice_id, product_id, product_name, quantity, unit, price, amount, price_entered_as) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const customers = [
      {
        name: "Bharat General Store",
        address: "45, Gariahat Road, Kolkata - 700068",
      },
      {
        name: "Maa Kali Kirana",
        address: "Block D, Salt Lake, Kolkata - 700091",
      },
      {
        name: "New Market Provision Store",
        address: "Lindsay Street, Kolkata - 700087",
      },
      {
        name: "Subham Traders",
        address: "Howrah Station Road, Howrah - 711101",
      },
      { name: "Sagar Wholesale", address: "Burdwan Road, Durgapur - 713206" },
    ];
    const dates = [
      "2025-11-15",
      "2025-12-01",
      "2025-12-18",
      "2026-01-10",
      "2026-02-05",
    ];
    const invoiceNumbers = [
      "INV-2025-0001",
      "INV-2025-0002",
      "INV-2025-0003",
      "INV-2026-0001",
      "INV-2026-0002",
    ];
    for (let i = 0; i < 5; i++) {
      const invResult = insertInv.run(
        invoiceNumbers[i],
        customers[i].name,
        customers[i].address,
        dates[i],
        i === 2 ? "Festival order" : null
      );
      const invId = (invResult as { lastInsertRowid: number }).lastInsertRowid;
      const numLines = randomInt(2, 5);
      const used = new Set<number>();
      for (let L = 0; L < numLines; L++) {
        const item = pick(itemsWithUnit);
        if (used.has(item.id)) continue;
        used.add(item.id);
        const qty = randomInt(1, 50);
        const price = Math.round(randomInt(20, 400) * 100) / 100;
        const amount = Math.round(qty * price * 100) / 100;
        insertLine.run(
          invId,
          item.id,
          item.name,
          qty,
          item.sell_unit || "pcs",
          price,
          amount,
          "per_unit"
        );
      }
    }
  } catch {
    // invoices / invoice_lines may not exist
  }
}

function seedMahajans(db: Database.Database): number[] {
  const insertMahajan = db.prepare(
    "INSERT INTO mahajans (name, address, phone, gstin) VALUES (?, ?, ?, ?)"
  );
  for (let i = 0; i < 120; i++) {
    const name = `${pick(MAHAJAN_FIRST_NAMES)} ${pick(MAHAJAN_LAST_NAMES)}`;
    const area = pick(AREAS);
    const address = `${area}, West Bengal`;
    const phone = "9" + String(randomInt(100000000, 999999999));
    const hasGst = Math.random() > 0.5;
    const gstin = hasGst
      ? `27AABCU${randomInt(1000, 9999)}D1Z${randomInt(10, 99)}`
      : null;
    insertMahajan.run(name, address, phone, gstin);
  }
  return (db.prepare("SELECT id FROM mahajans").all() as { id: number }[]).map(
    (r) => r.id
  );
}

type ItemRow = { id: number; name: string };

function seedLends(
  db: Database.Database,
  mahajanIds: number[],
  itemRows: ItemRow[]
): Record<number, number> {
  const insertLend = db.prepare(
    `INSERT INTO transactions (type, mahajan_id, product_id, quantity, amount, transaction_date, notes)
     VALUES ('lend', ?, ?, ?, ?, ?, ?)`
  );
  const updateItemStock = db.prepare(
    "UPDATE items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ?"
  );
  const lendAmountByMahajan: Record<number, number> = {};
  for (let i = 0; i < 280; i++) {
    const mahajanId = pick(mahajanIds);
    const item = pick(itemRows);
    const quantity = randomInt(5, 120);
    const ratePerUnit = randomInt(25, 450);
    const amount = Math.round(quantity * ratePerUnit * 100) / 100;
    insertLend.run(
      mahajanId,
      item.id,
      quantity,
      amount,
      randomDate(TXN_START, TXN_END),
      Math.random() > 0.7 ? "Batch " + randomInt(1, 50) : null
    );
    updateItemStock.run(quantity, item.id);
    lendAmountByMahajan[mahajanId] =
      (lendAmountByMahajan[mahajanId] ?? 0) + amount;
  }
  return lendAmountByMahajan;
}

function seedDeposits(
  db: Database.Database,
  mahajanIds: number[],
  lendAmountByMahajan: Record<number, number>
): void {
  const insertDeposit = db.prepare(
    `INSERT INTO transactions (type, mahajan_id, amount, transaction_date, notes)
     VALUES ('deposit', ?, ?, ?, ?)`
  );
  for (const mahajanId of mahajanIds) {
    const totalLend = lendAmountByMahajan[mahajanId] ?? 0;
    if (totalLend <= 0) continue;
    // Majority: deposit 5%–95% of lend (positive balance). Minority: 100%–120% (more deposit than lend).
    const overDeposit = Math.random() < 0.25; // 25% can have more deposit than lend
    const depositRatio = overDeposit
      ? 1 + Math.random() * 0.2 // 100% to 120%
      : 0.05 + Math.random() * 0.9; // 5% to 95%
    const totalToDeposit = Math.round(totalLend * depositRatio * 100) / 100;
    if (totalToDeposit <= 0) continue;
    const numDeposits = randomInt(1, 5);
    let remaining = totalToDeposit;
    for (let d = 0; d < numDeposits && remaining > 0; d++) {
      const amount =
        d === numDeposits - 1
          ? remaining
          : Math.round(
              randomInt(500, Math.min(50000, Math.max(500, remaining))) * 100
            ) / 100;
      const actualAmount = Math.min(amount, remaining);
      if (actualAmount <= 0) break;
      insertDeposit.run(
        mahajanId,
        actualAmount,
        randomDate(TXN_START, TXN_END),
        null
      );
      remaining -= actualAmount;
    }
  }
}

function seedPurchases(db: Database.Database, itemRows: ItemRow[]): void {
  const insertPurchase = db.prepare(
    `INSERT INTO transactions (type, product_id, quantity, amount, transaction_date, notes)
     VALUES ('cash_purchase', ?, ?, ?, ?, ?)`
  );
  for (let i = 0; i < 150; i++) {
    const item = pick(itemRows);
    const quantity = randomInt(1, 500);
    insertPurchase.run(
      item.id,
      quantity,
      Math.round(randomInt(500, 75000) * 100) / 100,
      randomDate(TXN_START, TXN_END),
      Math.random() > 0.6 ? "Supplier invoice" : null
    );
  }
}

function seedDailySales(db: Database.Database): void {
  const insertDailySale = db.prepare(
    `INSERT INTO daily_sales (sale_date, sale_amount, cash_in_hand, expenditure_amount, notes)
     VALUES (?, ?, ?, ?, ?)`
  );
  let runningCash = 50000;
  const d = new Date("2025-01-01");
  const saleEnd = new Date("2026-03-01");
  while (d <= saleEnd) {
    const sale_amount = Math.round(randomInt(3000, 85000) * 100) / 100;
    const expenditure_amount = Math.round(randomInt(0, 12000) * 100) / 100;
    runningCash = runningCash + sale_amount - expenditure_amount;
    if (runningCash < 0) runningCash = 10000;
    const cash_in_hand = Math.round(runningCash * 100) / 100;
    insertDailySale.run(
      d.toISOString().slice(0, 10),
      sale_amount,
      cash_in_hand,
      expenditure_amount,
      Math.random() > 0.8 ? "Festival day" : null
    );
    d.setDate(d.getDate() + 1);
  }
}

function seedOpeningBalance(db: Database.Database): void {
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO opening_balance (year, amount, updated_at) VALUES (?, ?, datetime('now'))"
  );
  [
    [2022, 45000],
    [2023, 52000],
    [2024, 78000],
    [2025, 95000],
    [2026, 110000],
  ].forEach(([year, amount]) => stmt.run(year, amount));
}

export function seedBulk(db: Database.Database): void {
  seedUnits(db);
  seedInvoiceUnits(db);
  seedItems(db);
  seedSettings(db);
  const mahajanIds = seedMahajans(db);
  const itemRows = db.prepare("SELECT id, name FROM items").all() as ItemRow[];
  const lendAmountByMahajan = seedLends(db, mahajanIds, itemRows);
  seedDeposits(db, mahajanIds, lendAmountByMahajan);
  seedPurchases(db, itemRows);
  seedDailySales(db);
  seedOpeningBalance(db);
  seedInvoices(db, itemRows);
}
