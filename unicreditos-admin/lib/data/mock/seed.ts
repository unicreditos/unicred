import type {
  AdminState,
  Approval,
  BankAccount,
  BcraVariable,
  CendeuReport,
  Client,
  CollectionCase,
  CollectionBucket,
  ContractTemplate,
  Credit,
  CreditProduct,
  Disbursement,
  Installment,
  KycCase,
  KycStatus,
  LedgerEntry,
  LoanApplication,
  Merchant,
  Operator,
  Payment,
  Receipt,
  SupportTicket,
} from "@/lib/domain/types";

const TODAY = new Date("2026-09-11T12:00:00-03:00");

function daysAgo(n: number, hour = 10): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  d.setHours(hour, (n * 7) % 60, 0, 0);
  return d.toISOString();
}

function daysFrom(n: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20260911);

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function randInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pad(n: number, len: number): string {
  return String(n).padStart(len, "0");
}

const FIRST = [
  "María", "Juan", "Lucía", "Martín", "Valentina", "Santiago", "Camila", "Diego",
  "Florencia", "Nicolás", "Sofía", "Facundo", "Julieta", "Tomás", "Paula", "Ezequiel",
  "Martina", "Lautaro", "Agustina", "Franco", "Carolina", "Gonzalo", "Micaela", "Matías",
  "Rocío", "Federico", "Belén", "Lucas", "Ailén", "Sebastián", "Melina", "Pablo",
  "Daniela", "Ignacio", "Abril", "Hernán", "Cecilia", "Ramiro", "Natalia", "Emiliano",
] as const;

const LAST = [
  "González", "Rodríguez", "Fernández", "López", "Martínez", "Pérez", "Gómez", "Díaz",
  "Álvarez", "Romero", "Torres", "Ruiz", "Ramírez", "Flores", "Acosta", "Benítez",
  "Medina", "Herrera", "Aguilar", "Castro", "Silva", "Rojas", "Molina", "Navarro",
  "Cabrera", "Vega", "Ponce", "Sosa", "Morales", "Ortiz", "Suárez", "Ríos",
] as const;

const CITIES: { city: string; province: string; cp: string }[] = [
  { city: "CABA", province: "CABA", cp: "1425" },
  { city: "CABA", province: "CABA", cp: "1414" },
  { city: "La Plata", province: "Buenos Aires", cp: "1900" },
  { city: "Quilmes", province: "Buenos Aires", cp: "1878" },
  { city: "Morón", province: "Buenos Aires", cp: "1708" },
  { city: "Córdoba", province: "Córdoba", cp: "5000" },
  { city: "Rosario", province: "Santa Fe", cp: "2000" },
  { city: "Santa Fe", province: "Santa Fe", cp: "3000" },
  { city: "Mendoza", province: "Mendoza", cp: "5500" },
  { city: "San Miguel de Tucumán", province: "Tucumán", cp: "4000" },
  { city: "Mar del Plata", province: "Buenos Aires", cp: "7600" },
  { city: "Salta", province: "Salta", cp: "4400" },
  { city: "Neuquén", province: "Neuquén", cp: "8300" },
  { city: "Bahía Blanca", province: "Buenos Aires", cp: "8000" },
];

const STREETS = [
  "Av. Corrientes", "Av. Santa Fe", "Av. Rivadavia", "Calle San Martín", "Av. Córdoba",
  "Belgrano", "Mitre", "Sarmiento", "Alsina", "Lavalle", "Independencia", "9 de Julio",
  "Av. Colón", "Pellegrini", "Moreno",
];

const OCCUPATIONS = [
  "Analista administrativo", "Comerciante", "Docente", "Enfermera", "Chofer",
  "Desarrollador", "Vendedor", "Contadora", "Electricista", "Diseñadora",
  "Técnico en refrigeración", "Cajera", "Supervisor de logística", "Abogada",
];

const EMPLOYERS = [
  "Mercado Libre", "Arcor", "YPF", "Banco Galicia", "Hospital Italiano",
  "Gobierno de la Ciudad", "Andreani", "Telecom", "Farmacity", "Autónomo",
  "Pampa Energía", "Cencosud", "Aerolíneas Argentinas", "OSDE",
];

const BANKS: { name: string; prefix: string }[] = [
  { name: "Banco Nación", prefix: "011" },
  { name: "Banco Galicia", prefix: "007" },
  { name: "Santander", prefix: "072" },
  { name: "BBVA", prefix: "017" },
  { name: "Macro", prefix: "285" },
  { name: "ICBC", prefix: "015" },
  { name: "Brubank", prefix: "143" },
  { name: "Ualá Bis", prefix: "384" },
];

const PURPOSES = [
  "Refacción del hogar",
  "Compra de electrodomésticos",
  "Gastos médicos",
  "Consolidación de deudas",
  "Compra de moto",
  "Educación",
  "Capital de trabajo personal",
  "Viaje familiar",
  "Tecnología",
  "Evento familiar",
];

function makeCbu(prefix: string, n: number): string {
  return `${prefix}${pad(n % 10000, 5)}${pad(100000 + n, 13)}`.slice(0, 22);
}

function makeDni(i: number): string {
  return String(22_000_000 + i * 137 + randInt(0, 80));
}

function makeCuit(dni: string, female: boolean): string {
  const p = female ? "27" : "20";
  const body = `${p}${dni}`;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let acc = 0;
  for (let i = 0; i < 10; i++) acc += Number(body[i]) * weights[i]!;
  const rest = acc % 11;
  let dv = 11 - rest;
  if (dv === 11) dv = 0;
  if (dv === 10) dv = 9;
  return `${p}-${dni}-${dv}`;
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

export function buildSeed(): AdminState {
  const products: CreditProduct[] = [
    {
      id: "prd-personal-12",
      name: "Personal 12",
      type: "personal",
      tna: 78,
      tea: 112.4,
      cft: 148.2,
      minAmount: 80_000,
      maxAmount: 1_500_000,
      minInstallments: 3,
      maxInstallments: 12,
      active: true,
      description: "Crédito de consumo personal en pesos, desembolso manual a CBU.",
    },
    {
      id: "prd-personal-24",
      name: "Personal 24",
      type: "personal",
      tna: 82,
      tea: 121.1,
      cft: 159.8,
      minAmount: 150_000,
      maxAmount: 3_000_000,
      minInstallments: 12,
      maxInstallments: 24,
      active: true,
      description: "Plazo extendido para montos medios. Sin interés punitivo.",
    },
    {
      id: "prd-express",
      name: "Express 6",
      type: "personal",
      tna: 74,
      tea: 104.8,
      cft: 136.0,
      minAmount: 50_000,
      maxAmount: 600_000,
      minInstallments: 3,
      maxInstallments: 6,
      active: true,
      description: "Aprobación ágil para clientes con KYC Didit verificado.",
    },
    {
      id: "prd-consumo",
      name: "Consumo comercio",
      type: "consumo",
      tna: 69,
      tea: 96.5,
      cft: 128.4,
      minAmount: 80_000,
      maxAmount: 2_500_000,
      minInstallments: 3,
      maxInstallments: 18,
      active: true,
      description: "Financiación en comercios adheridos. El desembolso se acredita al comercio.",
    },
    {
      id: "prd-refi",
      name: "Refinanciación",
      type: "refinanciacion",
      tna: 64,
      tea: 88.2,
      cft: 118.0,
      minAmount: 200_000,
      maxAmount: 4_000_000,
      minInstallments: 6,
      maxInstallments: 24,
      active: true,
      description: "Reestructuración de saldo vigente. No aplica interés punitivo.",
    },
    {
      id: "prd-promo",
      name: "Promo sueldo",
      type: "personal",
      tna: 61,
      tea: 83.4,
      cft: 109.5,
      minAmount: 100_000,
      maxAmount: 1_200_000,
      minInstallments: 6,
      maxInstallments: 12,
      active: false,
      description: "Campaña de recencia. Pausado el 01/09/2026.",
    },
  ];

  const operators: Operator[] = [
    { id: "op-au", name: "Agustina Urrutia", email: "agustina.urrutia@unicreditos.com", role: "director", initials: "AU", active: true, lastSeen: daysAgo(0, 11) },
    { id: "op-cr", name: "Carlos Ramírez", email: "carlos.ramirez@unicreditos.com", role: "director", initials: "CR", active: true, lastSeen: daysAgo(0, 9) },
    { id: "op-lm", name: "Laura Méndez", email: "laura.mendez@unicreditos.com", role: "originacion", initials: "LM", active: true, lastSeen: daysAgo(0, 10) },
    { id: "op-jp", name: "Julián Paredes", email: "julian.paredes@unicreditos.com", role: "originacion", initials: "JP", active: true, lastSeen: daysAgo(1, 18) },
    { id: "op-so", name: "Sofía Ortega", email: "sofia.ortega@unicreditos.com", role: "tesoreria", initials: "SO", active: true, lastSeen: daysAgo(0, 8) },
    { id: "op-mr", name: "Marcos Rinaldi", email: "marcos.rinaldi@unicreditos.com", role: "tesoreria", initials: "MR", active: true, lastSeen: daysAgo(0, 12) },
    { id: "op-ev", name: "Elena Vargas", email: "elena.vargas@unicreditos.com", role: "riesgo", initials: "EV", active: true, lastSeen: daysAgo(0, 7) },
    { id: "op-ds", name: "Diego Soria", email: "diego.soria@unicreditos.com", role: "soporte", initials: "DS", active: true, lastSeen: daysAgo(0, 13) },
    { id: "op-nb", name: "Nadia Blanco", email: "nadia.blanco@unicreditos.com", role: "auditor", initials: "NB", active: true, lastSeen: daysAgo(2, 16) },
    { id: "op-hf", name: "Hernán Funes", email: "hernan.funes@unicreditos.com", role: "originacion", initials: "HF", active: false, lastSeen: daysAgo(21, 15) },
  ];

  const merchants: Merchant[] = [
    { id: "m-fravega", name: "Frávega", cuit: "30-59034751-6", category: "Electro", status: "active", commissionPct: 8.5, city: "CABA", province: "CABA", contact: "Andrea López", email: "alianzas@fravega.com", phone: "011 4000-1200", originations: 86, volume: 42_800_000, onboardedAt: daysAgo(420) },
    { id: "m-garbarino", name: "Garbarino", cuit: "30-54667654-0", category: "Electro", status: "active", commissionPct: 8.0, city: "CABA", province: "CABA", contact: "Pablo Ibarra", email: "partners@garbarino.com", phone: "011 4108-8000", originations: 54, volume: 21_300_000, onboardedAt: daysAgo(380) },
    { id: "m-musimundo", name: "Musimundo", cuit: "30-50396017-5", category: "Electro / audio", status: "active", commissionPct: 7.5, city: "Córdoba", province: "Córdoba", contact: "Marina Suárez", email: "financiacion@musimundo.com", phone: "0351 421-9000", originations: 31, volume: 9_450_000, onboardedAt: daysAgo(290) },
    { id: "m-easy", name: "Easy", cuit: "30-70732112-8", category: "Hogar", status: "active", commissionPct: 6.9, city: "San Isidro", province: "Buenos Aires", contact: "Ricardo Paz", email: "unireditos@easy.com.ar", phone: "011 7078-4000", originations: 44, volume: 18_220_000, onboardedAt: daysAgo(250) },
    { id: "m-cetrogar", name: "Cetrogar", cuit: "30-65410987-1", category: "Electro", status: "active", commissionPct: 7.2, city: "Rosario", province: "Santa Fe", contact: "Luciana Díaz", email: "creditos@cetrogar.com.ar", phone: "0341 425-1100", originations: 29, volume: 8_760_000, onboardedAt: daysAgo(210) },
    { id: "m-megatone", name: "Megatone", cuit: "30-54321098-7", category: "Electro", status: "paused", commissionPct: 7.8, city: "Santa Fe", province: "Santa Fe", contact: "Omar Benítez", email: "alianzas@megatone.net", phone: "0342 455-2000", originations: 12, volume: 3_100_000, onboardedAt: daysAgo(180) },
    { id: "m-carrefour", name: "Carrefour", cuit: "30-50395513-8", category: "Supermercado", status: "active", commissionPct: 5.4, city: "CABA", province: "CABA", contact: "Gisela Romero", email: "financiacion@carrefour.com.ar", phone: "011 4000-8000", originations: 67, volume: 15_890_000, onboardedAt: daysAgo(160) },
    { id: "m-sodimac", name: "Sodimac", cuit: "30-71122334-9", category: "Hogar / construcción", status: "active", commissionPct: 6.2, city: "Pilar", province: "Buenos Aires", contact: "Esteban Quiroga", email: "partners@sodimac.com.ar", phone: "0230 444-1200", originations: 22, volume: 11_040_000, onboardedAt: daysAgo(140) },
    { id: "m-naldo", name: "Naldo", cuit: "30-60998877-2", category: "Electro", status: "onboarding", commissionPct: 7.0, city: "Tucumán", province: "Tucumán", contact: "Verónica Paz", email: "alta@naldo.com.ar", phone: "0381 422-3000", originations: 0, volume: 0, onboardedAt: daysAgo(12) },
    { id: "m-compumundo", name: "Compumundo", cuit: "30-58776655-4", category: "Tecnología", status: "rejected", commissionPct: 8.2, city: "CABA", province: "CABA", contact: "Iván Kraus", email: "comercial@compumundo.com", phone: "011 5263-0100", originations: 0, volume: 0, onboardedAt: daysAgo(40) },
  ];

  const clients: Client[] = [];
  for (let i = 0; i < 48; i++) {
    const firstName = FIRST[i % FIRST.length]!;
    const lastName = LAST[(i * 3) % LAST.length]!;
    const female = ["María", "Lucía", "Valentina", "Camila", "Florencia", "Sofía", "Julieta", "Paula", "Martina", "Agustina", "Carolina", "Micaela", "Rocío", "Belén", "Ailén", "Melina", "Daniela", "Abril", "Cecilia", "Natalia"].includes(firstName);
    const dni = makeDni(i);
    const loc = CITIES[i % CITIES.length]!;
    const bank = BANKS[i % BANKS.length]!;
    const kycCycle: KycStatus[] = ["verified", "verified", "verified", "in_review", "pending", "verified", "rejected", "verified", "expired", "verified"];
    clients.push({
      id: `cli-${pad(1001 + i, 4)}`,
      firstName,
      lastName,
      dni,
      cuit: makeCuit(dni, female),
      email: `${firstName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}.${lastName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}${i}@correo.com.ar`,
      phone: `+54 9 ${["11", "351", "341", "261", "223"][i % 5]} ${4000 + i}-${1000 + i * 17}`,
      address: {
        street: `${STREETS[i % STREETS.length]} ${400 + i * 13}`,
        city: loc.city,
        province: loc.province,
        postalCode: loc.cp,
      },
      cbu: makeCbu(bank.prefix, 8000 + i),
      bank: bank.name,
      kycStatus: kycCycle[i % kycCycle.length]!,
      score: 420 + ((i * 37) % 380),
      createdAt: daysAgo(30 + i * 8, 11),
      occupation: OCCUPATIONS[i % OCCUPATIONS.length]!,
      employer: EMPLOYERS[i % EMPLOYERS.length]!,
      declaredIncome: 650_000 + (i % 12) * 95_000,
    });
  }

  const kyc: KycCase[] = clients.map((c, i) => {
    const status = c.kycStatus;
    return {
      id: `kyc-${pad(i + 1, 4)}`,
      clientId: c.id,
      provider: "didit",
      status,
      sessionId: `didit_${c.dni}_${pad(i, 3)}`,
      documentType: i % 17 === 0 ? "pasaporte" : "dni",
      liveness: status === "verified" || status === "in_review",
      documentMatch: status === "verified",
      faceMatchScore: status === "pending" ? null : 72 + (i % 28),
      startedAt: daysAgo((i % 20) + 1, 9),
      completedAt: status === "pending" || status === "in_review" ? null : daysAgo(i % 18, 14),
      notes:
        status === "rejected"
          ? "Documento ilegible. Pedir recaptura Didit."
          : status === "expired"
            ? "Sesión Didit vencida a las 24 h."
            : status === "in_review"
              ? "Liveness OK. Validar DNI posterior."
              : "",
      operatorId: status === "pending" ? null : pick(["op-lm", "op-jp", "op-ev"]),
    };
  });

  const applications: LoanApplication[] = [];
  const credits: Credit[] = [];
  const disbursements: Disbursement[] = [];
  const payments: Payment[] = [];
  const collections: CollectionCase[] = [];
  const approvals: Approval[] = [];
  const receipts: Receipt[] = [];

  const appStatuses = [
    "pending", "pending", "pending", "pending", "pending", "pending",
    "pending", "pending", "pending", "pending", "pending", "pending",
    "approved", "approved", "approved", "approved", "approved", "approved",
    "rejected", "rejected", "rejected", "cancelled",
    "approved", "approved", "approved", "approved", "approved", "approved",
    "approved", "approved", "approved", "approved", "approved", "approved",
    "approved", "approved", "approved", "approved", "approved", "approved",
    "pending", "rejected", "approved", "approved",
  ] as const;

  function buildSchedule(
    amount: number,
    n: number,
    tna: number,
    startIso: string,
    paidCount: number,
    overdueFrom = -1,
  ): { schedule: Installment[]; installmentAmount: number } {
    const monthly = tna / 100 / 12;
    const inst = Math.round(
      (amount * monthly) / (1 - Math.pow(1 + monthly, -n)),
    );
    const schedule: Installment[] = [];
    for (let k = 1; k <= n; k++) {
      const due = addMonths(startIso, k - 1);
      const dueDate = new Date(due);
      let status: Installment["status"] = "pending";
      let paidAmount = 0;
      let paidAt: string | null = null;
      if (k <= paidCount) {
        status = "paid";
        paidAmount = inst;
        paidAt = addMonths(due, 0);
        const p = new Date(due);
        p.setDate(p.getDate() - randInt(0, 3));
        paidAt = p.toISOString();
      } else if (overdueFrom >= 0 && k <= overdueFrom && dueDate < TODAY) {
        status = "overdue";
      } else if (dueDate < TODAY && k > paidCount) {
        status = "overdue";
      }
      schedule.push({ number: k, dueDate: due, amount: inst, paidAmount, paidAt, status });
    }
    return { schedule, installmentAmount: inst };
  }

  for (let i = 0; i < 44; i++) {
    const client = clients[i]!;
    const product = products[i % 5]!;
    const isConsumo = product.type === "consumo";
    const merchant = isConsumo ? merchants[i % 8]! : null;
    const amount = [180_000, 250_000, 320_000, 450_000, 520_000, 680_000, 790_000, 950_000, 1_150_000, 1_480_000, 2_100_000][i % 11]!;
    const installments = product.type === "express" as string ? 6 : [6, 9, 12, 12, 18, 24][i % 6]!;
    const status = appStatuses[i]!;
    const createdAt = daysAgo(2 + i, 11);
    const id = `SOL-${7800 + i}`;
    const decidedAt =
      status === "pending" ? null : daysAgo(Math.max(0, i - 8), 16);

    applications.push({
      id,
      clientId: client.id,
      productId: product.id,
      merchantId: merchant?.id ?? null,
      amount,
      installments: Math.min(installments, product.maxInstallments),
      status,
      purpose: isConsumo ? `Compra en ${merchant?.name}` : PURPOSES[i % PURPOSES.length]!,
      createdAt,
      decidedAt,
      operatorId: status === "pending" ? (i % 3 === 0 ? "op-lm" : null) : pick(["op-lm", "op-jp", "op-ev"]),
      notes: status === "rejected" ? "Ingresos insuficientes vs. cuota." : "",
    });

    const flags: string[] = [];
    if (client.score < 500) flags.push("Score < 500");
    if (client.kycStatus !== "verified") flags.push("KYC incompleto");
    if (amount > client.declaredIncome * 1.2) flags.push("Monto vs. ingresos");
    if (i % 7 === 0) flags.push("CENDEU sit. 2 histórica");

    approvals.push({
      id: `apr-${pad(i + 1, 3)}`,
      applicationId: id,
      clientId: client.id,
      decision:
        status === "approved"
          ? "approved"
          : status === "rejected"
            ? "rejected"
            : status === "cancelled"
              ? "rejected"
              : flags.length > 1
                ? "observed"
                : "pending",
      policyFlags: flags,
      assignedTo: i % 2 === 0 ? "op-ev" : "op-lm",
      createdAt,
      decidedAt,
      comment: status === "approved" ? "Califica. Desembolso manual." : status === "rejected" ? "Rechazo por capacidad de pago." : "",
    });

    if (status !== "approved") continue;

    const creditId = `CR-26-${pad(100 + i, 3)}`;
    const nInst = Math.min(installments, product.maxInstallments);
    const isQueuedDisb = i < 18 && i >= 12;
    const isActive = i >= 18;
    const isPaid = i >= 40;
    const isCancelledCredit = i === 39;

    let creditStatus: Credit["status"] = "approved";
    if (isPaid) creditStatus = "paid";
    else if (isCancelledCredit) creditStatus = "cancelled";
    else if (isActive) creditStatus = "active";

    const firstDue = daysFrom(isActive ? -nInst * 8 + (i % 20) : 20);
    const paidCount = creditStatus === "paid" ? nInst : creditStatus === "active" ? Math.max(0, (i % nInst) - 1) : 0;
    const overdueFrom = i % 9 === 0 && creditStatus === "active" ? paidCount + 2 : -1;
    const { schedule, installmentAmount } = buildSchedule(
      amount,
      nInst,
      product.tna,
      firstDue,
      paidCount,
      overdueFrom,
    );
    const overdueInst = schedule.filter((s) => s.status === "overdue");
    const daysPastDue = overdueInst.length
      ? Math.max(
          0,
          Math.floor(
            (TODAY.getTime() - new Date(overdueInst[0]!.dueDate).getTime()) /
              86_400_000,
          ),
        )
      : 0;
    const bucket: CollectionBucket =
      daysPastDue === 0
        ? "al_dia"
        : daysPastDue <= 30
          ? "1_30"
          : daysPastDue <= 60
            ? "31_60"
            : daysPastDue <= 90
              ? "61_90"
              : "90_plus";
    const outstanding = schedule
      .filter((s) => s.status !== "paid")
      .reduce((a, s) => a + (s.amount - s.paidAmount), 0);

    credits.push({
      id: creditId,
      applicationId: id,
      clientId: client.id,
      productId: product.id,
      merchantId: merchant?.id ?? null,
      amount,
      principalOutstanding: creditStatus === "paid" || creditStatus === "cancelled" ? 0 : outstanding,
      installments: nInst,
      installmentAmount,
      tna: product.tna,
      tea: product.tea,
      cft: product.cft,
      status: creditStatus,
      disbursedAt: creditStatus === "approved" ? null : daysAgo(Math.max(1, 40 - i), 15),
      firstDueDate: firstDue,
      schedule,
      daysPastDue,
      bucket,
    });

    const disbStatus: Disbursement["status"] = creditStatus === "approved" ? "queued" : creditStatus === "cancelled" ? "failed" : "completed";
    disbursements.push({
      id: `db-${pad(i + 1, 3)}`,
      creditId,
      clientId: client.id,
      amount: merchant ? Math.round(amount * (1 - (merchant.commissionPct / 100))) : amount,
      status: isQueuedDisb ? "queued" : i === 17 ? "processing" : disbStatus,
      cbu: merchant ? makeCbu("007", 9000 + i) : client.cbu,
      bank: merchant ? "Banco Galicia" : client.bank,
      requestedAt: daysAgo(Math.max(0, 12 - (i % 12)), 10),
      completedAt: disbStatus === "completed" && !isQueuedDisb ? daysAgo(Math.max(1, 11 - (i % 11)), 16) : null,
      operatorId: disbStatus === "completed" ? "op-so" : null,
      reference: disbStatus === "completed" ? `TRX-UC-${7800 + i}` : null,
    });

    if (disbStatus === "completed" && !isQueuedDisb) {
      receipts.push({
        id: `rcp-d-${i}`,
        paymentId: null,
        disbursementId: `db-${pad(i + 1, 3)}`,
        clientId: client.id,
        type: "desembolso",
        number: `D-2026-${pad(200 + i, 4)}`,
        amount,
        issuedAt: daysAgo(Math.max(1, 11 - (i % 11)), 16),
        cae: null,
      });
    }

    schedule
      .filter((s) => s.status === "paid" && s.paidAt)
      .forEach((s, pi) => {
        const channel = (i + pi) % 3 === 0 ? "transferencia" : "mercadopago";
        const payId = `pay-${creditId}-${s.number}`;
        const st: Payment["status"] =
          channel === "transferencia" && pi === 0 && i % 5 === 0
            ? "pending"
            : "reconciled";
        payments.push({
          id: payId,
          creditId,
          clientId: client.id,
          channel,
          status: st,
          amount: s.amount,
          paidAt: s.paidAt!,
          mpPaymentId: channel === "mercadopago" ? `mp_${880000 + i * 10 + pi}` : null,
          transferCbu: channel === "transferencia" ? client.cbu : null,
          transferRef: channel === "transferencia" ? `VAR-${90000 + i * 3 + pi}` : null,
          matchedBy: st === "reconciled" ? "op-mr" : null,
          notes: st === "pending" ? "Transferencia a revisar — conciliación bancaria" : "",
        });
        if (st === "reconciled") {
          receipts.push({
            id: `rcp-p-${i}-${pi}`,
            paymentId: payId,
            disbursementId: null,
            clientId: client.id,
            type: "cobro",
            number: `C-2026-${pad(500 + i * 4 + pi, 4)}`,
            amount: s.amount,
            issuedAt: s.paidAt!,
            cae: `7410${pad(i * 11 + pi, 10)}`,
          });
        }
      });

    if (daysPastDue > 0) {
      collections.push({
        id: `col-${pad(i + 1, 3)}`,
        creditId,
        clientId: client.id,
        bucket,
        overdueAmount: overdueInst.reduce((a, s) => a + s.amount, 0),
        daysPastDue,
        lastContactAt: daysAgo(Math.min(daysPastDue, 6), 17),
        nextAction:
          bucket === "1_30"
            ? "WhatsApp de recordatorio"
            : bucket === "31_60"
              ? "Llamado de gestión"
              : "Propuesta de refinanciación",
        ownerId: bucket === "al_dia" ? "op-mr" : "op-so",
      });
    }
  }

  // Extra pending transfers attached to créditos vigentes (not queued/calificados)
  const extraActive = credits.filter((c) => c.status === "active").slice(0, 4);
  extraActive.forEach((credit, idx) => {
    const c = clients.find((cl) => cl.id === credit.clientId);
    if (!c) return;
    payments.push({
      id: `pay-rev-${idx}`,
      creditId: credit.id,
      clientId: c.id,
      channel: "transferencia",
      status: "pending",
      amount: credit.installmentAmount,
      paidAt: daysAgo(idx, 13),
      mpPaymentId: null,
      transferCbu: c.cbu,
      transferRef: `VAR-EXT-${1200 + idx}`,
      matchedBy: null,
      notes: "Acreditación bancaria sin matching automático.",
    });
  });

  const accounts: BankAccount[] = [
    { id: "acc-nacion-d", label: "Nación Desembolsos", bank: "Banco Nación", cbu: "0110012340000012345678", alias: "UNICRED.DESEMBOLSOS", currency: "ARS", purpose: "desembolsos", balance: 18_450_000, active: true },
    { id: "acc-galicia-c", label: "Galicia Cobranzas", bank: "Banco Galicia", cbu: "0070088840000098765432", alias: "UNICRED.COBROS", currency: "ARS", purpose: "cobranzas", balance: 9_280_400, active: true },
    { id: "acc-mp", label: "Collector MercadoPago", bank: "Mercado Pago", cbu: "0000003100000001234567", alias: "UNICRED.MP", currency: "ARS", purpose: "cobranzas", balance: 4_112_890, active: true },
    { id: "acc-bbva-op", label: "BBVA Operativa", bank: "BBVA", cbu: "0170099910000055511122", alias: "UNICRED.OPERATIVA", currency: "ARS", purpose: "operativa", balance: 2_640_000, active: true },
    { id: "acc-macro-old", label: "Macro (legado)", bank: "Macro", cbu: "2850000010000033344455", alias: "UNICRED.MACRO.OLD", currency: "ARS", purpose: "operativa", balance: 120_500, active: false },
  ];

  const ledger: LedgerEntry[] = [
    { id: "led-1", date: daysAgo(0, 9), type: "ingreso", accountId: "acc-mp", amount: 1_245_800, concept: "Cobranzas MercadoPago — lote diario", counterparty: "MercadoPago" },
    { id: "led-2", date: daysAgo(0, 10), type: "ingreso", accountId: "acc-galicia-c", amount: 860_200, concept: "Transferencias CBU identificadas", counterparty: "Varios clientes" },
    { id: "led-3", date: daysAgo(1, 15), type: "egreso", accountId: "acc-nacion-d", amount: 3_250_000, concept: "Desembolsos manuales lote PM", counterparty: "Clientes / comercios" },
    { id: "led-4", date: daysAgo(1, 11), type: "ingreso", accountId: "acc-mp", amount: 990_450, concept: "Cobranzas MercadoPago", counterparty: "MercadoPago" },
    { id: "led-5", date: daysAgo(2, 16), type: "egreso", accountId: "acc-nacion-d", amount: 2_180_000, concept: "Desembolsos Frávega + personales", counterparty: "Frávega / clientes" },
    { id: "led-6", date: daysAgo(2, 9), type: "ajuste", accountId: "acc-bbva-op", amount: -42_300, concept: "Comisiones bancarias", counterparty: "BBVA" },
    { id: "led-7", date: daysAgo(3, 14), type: "ingreso", accountId: "acc-galicia-c", amount: 1_102_000, concept: "Lote transferencias", counterparty: "Varios clientes" },
    { id: "led-8", date: daysAgo(4, 15), type: "egreso", accountId: "acc-nacion-d", amount: 4_010_000, concept: "Desembolsos semana", counterparty: "Clientes" },
    { id: "led-9", date: daysAgo(5, 10), type: "ingreso", accountId: "acc-mp", amount: 1_560_700, concept: "Cobranzas MercadoPago", counterparty: "MercadoPago" },
    { id: "led-10", date: daysAgo(6, 12), type: "egreso", accountId: "acc-bbva-op", amount: 380_000, concept: "Servicios Didit + infra", counterparty: "Didit / proveedores" },
  ];

  const cendeu: CendeuReport[] = clients.slice(0, 36).map((c, i) => {
    const result = (["ok", "ok", "ok", "novedad", "ok", "irregular", "ok", "sin_info"] as const)[i % 8]!;
    return {
      id: `cendeu-${pad(i + 1, 3)}`,
      clientId: c.id,
      consultedAt: daysAgo(i % 15, 8),
      result,
      score: c.score,
      sit1: result === "ok" ? 1 : 0,
      sit2: result === "novedad" ? 1 : 0,
      sit3: result === "irregular" ? 1 : 0,
      sit4: 0,
      sit5: 0,
      entities: result === "sin_info" ? 0 : 1 + (i % 4),
      observations:
        result === "irregular"
          ? "Sit. 3 en entidad bancaria — 2025. Capacidad acotada."
          : result === "novedad"
            ? "Cierre reciente en entidad no bancaria."
            : result === "sin_info"
              ? "Sin historia crediticia en BCRA."
              : "Sin novedades. Situación 1.",
    };
  });

  const bcra: BcraVariable[] = [
    { id: "b-tasa", code: "POLITICA", name: "Tasa de política monetaria", value: 29.0, unit: "%", asOf: daysAgo(1), previous: 32.0, source: "BCRA A 3500" },
    { id: "b-tm20", code: "TM20", name: "TM20", value: 31.2, unit: "%", asOf: daysAgo(1), previous: 33.8, source: "BCRA" },
    { id: "b-badlar", code: "BADLAR", name: "BADLAR bancos privados", value: 33.5, unit: "%", asOf: daysAgo(1), previous: 35.1, source: "BCRA" },
    { id: "b-infl", code: "IPC", name: "Inflación mensual (IPC INDEC)", value: 2.1, unit: "%", asOf: daysAgo(12), previous: 1.9, source: "INDEC" },
    { id: "b-infl12", code: "IPC12", name: "Inflación interanual", value: 33.6, unit: "%", asOf: daysAgo(12), previous: 36.0, source: "INDEC" },
    { id: "b-tc", code: "A3500", name: "Tipo de cambio A3500", value: 1480.5, unit: "index", asOf: daysAgo(0), previous: 1472.0, source: "BCRA A 3500" },
    { id: "b-uva", code: "UVA", name: "UVA", value: 1520.43, unit: "index", asOf: daysAgo(0), previous: 1518.11, source: "BCRA" },
    { id: "b-cer", code: "CER", name: "CER", value: 248.12, unit: "index", asOf: daysAgo(0), previous: 247.81, source: "BCRA" },
    { id: "b-tna-ref", code: "TNA_REF", name: "TNA referencia consumo", value: 77.0, unit: "%", asOf: daysAgo(7), previous: 81.0, source: "BCRA Com. A" },
    { id: "b-tea-max", code: "TEA_MAX", name: "TEA máxima informada", value: 125.4, unit: "%", asOf: daysAgo(7), previous: 131.0, source: "BCRA" },
  ];

  const contracts: ContractTemplate[] = [
    { id: "ct-pers", name: "Mutuo personal ARS", version: "3.4", productId: "prd-personal-12", status: "active", updatedAt: daysAgo(18), clauses: 42 },
    { id: "ct-pers24", name: "Mutuo personal 24", version: "2.1", productId: "prd-personal-24", status: "active", updatedAt: daysAgo(18), clauses: 44 },
    { id: "ct-cons", name: "Mutuo consumo comercio", version: "1.9", productId: "prd-consumo", status: "active", updatedAt: daysAgo(9), clauses: 51 },
    { id: "ct-refi", name: "Convenio de refinanciación", version: "1.3", productId: "prd-refi", status: "active", updatedAt: daysAgo(40), clauses: 28 },
    { id: "ct-express", name: "Mutuo express", version: "1.0", productId: "prd-express", status: "draft", updatedAt: daysAgo(3), clauses: 36 },
    { id: "ct-tyc", name: "Términos y condiciones app", version: "5.0", productId: null, status: "active", updatedAt: daysAgo(60), clauses: 19 },
    { id: "ct-old", name: "Mutuo 2024 (archivo)", version: "2.8", productId: "prd-personal-12", status: "archived", updatedAt: daysAgo(280), clauses: 40 },
  ];

  const tickets: SupportTicket[] = [
    { id: "tck-1042", clientId: clients[2]!.id, subject: "No llega el comprobante de cuota 3", channel: "whatsapp", status: "open", priority: "medium", assigneeId: "op-ds", createdAt: daysAgo(1, 15), updatedAt: daysAgo(0, 9), messages: 4 },
    { id: "tck-1041", clientId: clients[7]!.id, subject: "Cambio de CBU para desembolso", channel: "email", status: "pending", priority: "high", assigneeId: "op-so", createdAt: daysAgo(2, 11), updatedAt: daysAgo(1, 18), messages: 6 },
    { id: "tck-1040", clientId: clients[11]!.id, subject: "Didit pide recaptura y no puede", channel: "telefono", status: "open", priority: "urgent", assigneeId: "op-lm", createdAt: daysAgo(0, 8), updatedAt: daysAgo(0, 8), messages: 2 },
    { id: "tck-1039", clientId: null, subject: "Comercio Easy — conciliación comisión agosto", channel: "email", status: "pending", priority: "medium", assigneeId: "op-mr", createdAt: daysAgo(5, 10), updatedAt: daysAgo(2, 12), messages: 8 },
    { id: "tck-1038", clientId: clients[19]!.id, subject: "Consulta de saldo y fecha de vencimiento", channel: "whatsapp", status: "resolved", priority: "low", assigneeId: "op-ds", createdAt: daysAgo(6, 14), updatedAt: daysAgo(5, 11), messages: 3 },
    { id: "tck-1037", clientId: clients[4]!.id, subject: "Transferencia duplicada — pide reversa", channel: "email", status: "open", priority: "high", assigneeId: "op-mr", createdAt: daysAgo(1, 19), updatedAt: daysAgo(0, 10), messages: 5 },
    { id: "tck-1036", clientId: clients[22]!.id, subject: "Baja de débito automático", channel: "telefono", status: "closed", priority: "low", assigneeId: "op-ds", createdAt: daysAgo(12, 9), updatedAt: daysAgo(10, 16), messages: 4 },
    { id: "tck-1035", clientId: null, subject: "Alta Naldo — documentación societaria", channel: "interno", status: "open", priority: "medium", assigneeId: "op-jp", createdAt: daysAgo(3, 12), updatedAt: daysAgo(1, 9), messages: 7 },
    { id: "tck-1034", clientId: clients[15]!.id, subject: "Error en cuota informada vs. contrato", channel: "email", status: "pending", priority: "high", assigneeId: "op-nb", createdAt: daysAgo(4, 8), updatedAt: daysAgo(3, 17), messages: 9 },
    { id: "tck-1033", clientId: clients[28]!.id, subject: "Solicita refinanciación de mora", channel: "whatsapp", status: "open", priority: "urgent", assigneeId: "op-so", createdAt: daysAgo(0, 7), updatedAt: daysAgo(0, 11), messages: 3 },
  ];

  const audit = [
    { id: "aud-1", at: daysAgo(0, 11), actorId: "op-au", action: "login", entity: "session", entityId: "sess-au", detail: "Ingreso al backoffice desde CABA" },
    { id: "aud-2", at: daysAgo(0, 10), actorId: "op-lm", action: "view", entity: "solicitud", entityId: "SOL-7800", detail: "Abrió expediente en evaluación" },
    { id: "aud-3", at: daysAgo(0, 9), actorId: "op-ev", action: "cendeu.lookup", entity: "cliente", entityId: clients[0]!.id, detail: "Consulta CENDEU — sit. 1" },
    { id: "aud-4", at: daysAgo(1, 16), actorId: "op-so", action: "disbursement.complete", entity: "desembolso", entityId: "db-020", detail: "Marcó desembolso acreditado TRX-UC-7819" },
    { id: "aud-5", at: daysAgo(1, 15), actorId: "op-mr", action: "payment.match", entity: "pago", entityId: "pay-rev-x", detail: "Matcheó transferencia VAR-90112" },
    { id: "aud-6", at: daysAgo(1, 12), actorId: "op-jp", action: "application.approve", entity: "solicitud", entityId: "SOL-7818", detail: "Calificó solicitud — pasa a desembolso manual" },
    { id: "aud-7", at: daysAgo(2, 18), actorId: "op-lm", action: "application.reject", entity: "solicitud", entityId: "SOL-7819", detail: "Rechazo por capacidad de pago" },
    { id: "aud-8", at: daysAgo(2, 11), actorId: "op-ds", action: "ticket.create", entity: "soporte", entityId: "tck-1041", detail: "Alta de ticket cambio de CBU" },
    { id: "aud-9", at: daysAgo(3, 9), actorId: "op-nb", action: "export", entity: "cartera", entityId: "cartera-2026-09", detail: "Exportó cartera activa (auditoría)" },
    { id: "aud-10", at: daysAgo(4, 14), actorId: "op-cr", action: "config.update", entity: "config", entityId: "app", detail: "Confirmó desembolso 100% manual — sin punitivos" },
    { id: "aud-11", at: daysAgo(5, 10), actorId: "op-jp", action: "kyc.approve", entity: "kyc", entityId: kyc[0]!.id, detail: "Didit verificado — DNI y liveness OK" },
    { id: "aud-12", at: daysAgo(6, 16), actorId: "op-mr", action: "merchant.pause", entity: "comercio", entityId: "m-megatone", detail: "Pausa comercial Megatone — conciliación pendiente" },
  ];

  const series = Array.from({ length: 31 }, (_, i) => {
    const d = new Date(TODAY);
    d.setDate(d.getDate() - (30 - i));
    const iso = d.toISOString().slice(0, 10);
    const wave = 8 + Math.round(6 * Math.sin(i / 4) + (i % 5));
    return {
      date: iso,
      solicitudes: wave,
      aprobadas: Math.max(1, Math.round(wave * 0.58)),
      rechazadas: Math.max(0, Math.round(wave * 0.18)),
      cobrado: 400_000 + i * 18_000 + (i % 6) * 90_000,
      desembolsado: 280_000 + (i % 4) * 420_000,
    };
  });

  return {
    products,
    operators,
    merchants,
    clients,
    kyc,
    applications,
    credits,
    payments,
    disbursements,
    collections,
    approvals,
    receipts,
    accounts,
    ledger,
    cendeu,
    bcra,
    contracts,
    tickets,
    audit,
    config: {
      companyName: "UNICRÉDITOS S.A.",
      cuit: "30-71778899-2",
      timezone: "America/Argentina/Buenos_Aires",
      locale: "es-AR",
      currency: "ARS",
      manualDisbursement: true,
      punitiveInterest: false,
      kycProvider: "didit",
      mpCollectorId: "COL-UNICRED-20491",
      supportEmail: "soporte@unicreditos.com",
      collectionsSlaHours: 24,
    },
    series,
  };
}
