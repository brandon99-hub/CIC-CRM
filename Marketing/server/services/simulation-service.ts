import { db } from "../db";
import { marketingUsers } from "../../shared/schema";
import { stakeholders, intakeSignals, cases, caseHistory, caseComments, caseAttachments, stakeholderInteractions, stakeholderRelationships, knowledgeBase } from "../../shared/crmSchema";
import { DiscoveryService } from "./discovery-service";
import { serviceCategories, systemRoles, slaRules, departments } from "../../shared/adminSchema";
import { cicLeads } from "../../shared/cicSchema";
import { IntakeSignal } from "./categorization-service";
import { NLPService } from "./nlp-service";
import { AssignmentService } from "./assignment-service";
import { StakeholderMatchingService } from "./stakeholder-matching-service";
import { eq, or, and, count, sql } from "drizzle-orm";

// ─── CIC Insurance Group — Realistic Data Pools ─────────────────────────────

const firstNames = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda", "David", "Barbara", "Kevin", "Amina", "Brian", "Joyce", "Samuel", "Grace", "Daniel", "Faith", "Peter", "Mercy", "Charles", "Alice", "George", "Ruth", "Anthony", "Esther", "Francis", "Beatrice", "Simon", "Caroline"];
const lastNames = ["Kamau", "Otieno", "Mwangi", "Wanjiru", "Odhiambo", "Kimani", "Wambua", "Njoroge", "Achieng", "Mutua", "Kirui", "Kiplangat", "Nyambura", "Chege", "Owino", "Nzuri", "Koech", "Mugo", "Kariuki", "Ndungu"];

// CIC product lines
const productLines = ["motor", "life", "medical", "property", "marine", "pension", "group_life", "micro_insurance"];

// SACCO names — CIC's primary distribution channel
const saccoNames = [
  "Mwalimu National SACCO", "Stima SACCO", "Kenya National Police SACCO",
  "Harambee SACCO", "Kenya Bankers SACCO", "Afya SACCO", "Tower SACCO",
  "Imarika SACCO", "Bandari SACCO", "Unaitas SACCO", "Fortune SACCO",
  "Waumini SACCO", "Cosmopolitan SACCO", "Boresha SACCO", "Nyeri Highway SACCO"
];

// Corporate clients
const corporateClients = [
  "Kenya Power & Lighting", "Safaricom PLC", "KCB Group", "Equity Bank Kenya",
  "Standard Chartered Kenya", "NCBA Bank Kenya", "Nation Media Group",
  "East African Breweries", "Bamburi Cement", "Kenya Airways", "Tusker Mattresses",
  "ARM Cement", "Naivas Supermarkets", "Carrefour Kenya", "Twiga Foods"
];

// Insurance brokerages
const brokerages = [
  "Aon Kenya", "Marsh McLennan Kenya", "Willis Towers Watson Kenya",
  "Alexander Forbes", "Jubilee Insurance Brokers", "Pan Africa Life Brokers",
  "Glendale Insurance Brokers", "AON Minet Kenya", "Heritage Insurance Brokers"
];

// CIC branches / service centers
const branches = [
  "Nairobi Upperhill Head Office", "Mombasa Branch", "Kisumu Branch", "Nakuru Branch",
  "Eldoret Branch", "Thika Branch", "Nyeri Branch", "Kisii Branch", "Kakamega Branch",
  "Machakos Branch", "Kitale Branch", "Malindi Branch"
];

const counties = ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Uasin Gishu", "Kiambu", "Nyeri", "Kisii", "Kakamega", "Machakos", "Kitale", "Kilifi"];
const industries = ["Banking & Finance", "Telecommunications", "Energy", "Manufacturing", "Media & Communications", "Education", "Healthcare", "Retail", "Logistics", "Agriculture"];

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randRef = () => `REF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

let globalPolicyCounter = 100001;
const randPolicyNum = (product: string) => `CIC/${product.toUpperCase().substring(0, 3)}/2024/${globalPolicyCounter++}`;

const randAmount = (min = 5000, max = 500000) => Math.floor(min + Math.random() * (max - min));
const randIraLicense = () => `IRA/AGT/${Math.floor(10000 + Math.random() * 89999)}`;

// ─── Stakeholder Seed Generator ─────────────────────────────────────────────

async function generateStakeholderSeeds(): Promise<any[]> {
    globalPolicyCounter = 100001; // Reset counter so reseeds generate identical policy numbers
    const seeds: any[] = [];
    const usedEmails = new Set<string>();

    const makeEmail = (first: string, last: string, domain: string): string => {
        let email = `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`;
        let counter = 1;
        while (usedEmails.has(email)) {
            email = `${first.toLowerCase()}.${last.toLowerCase()}${counter}@${domain}`;
            counter++;
        }
        usedEmails.add(email);
        return email;
    };

    const makePhone = () => `+2547${Math.floor(10000000 + Math.random() * 89999999)}`;

    const generateGroup = (
        type: string,
        domainSuffix: string,
        policyPrefix: string,
        orgFn: () => string,
        customFields: (i: number) => Record<string, any>
    ) => {
        for (let i = 0; i < 2; i++) {
            const fn = pick(firstNames);
            const ln = pick(lastNames);
            const product = pick(productLines);
            const custom = customFields(i);
            seeds.push({
                type,
                firstName: fn,
                lastName: ln,
                email: makeEmail(fn, ln, domainSuffix),
                phone: makePhone(),
                policyNumber: custom.policyNumber || randPolicyNum(product),
                organization: orgFn(),
                county: pick(counties),
                country: custom.country || "Kenya",
                region: custom.region || "East Africa",
                productLine: custom.productLine || product,
                policyRenewalDate: custom.policyRenewalDate || null,
                claimsHistory: custom.claimsHistory || [],
                policyHistory: custom.policyHistory || [],
                premiumPaymentHistory: custom.premiumPaymentHistory || [],
                parentOrganization: custom.parentOrganization || null,
                metadata: {
                    underwritingProgress: custom.underwritingProgress || pick(["Pending Medical Exam", "Reviewing Documents", "Assessment Visit Scheduled", "Approved", "Approved", "Approved"]),
                    ...(custom.metadata || {})
                }
            });
        }
    };

    // 1. Individual Policyholder — Motor
    generateGroup("individual_policyholder", "gmail.com", "CIC", () => "", (i) => {
        const product = "motor";
        const policyNum = randPolicyNum(product);
        const renewalDate = new Date();
        renewalDate.setDate(renewalDate.getDate() + Math.floor(Math.random() * 90) + 10);
        return {
            productLine: product,
            policyNumber: policyNum,
            policyRenewalDate: renewalDate.toISOString().split("T")[0],
            claimsHistory: [
                {
                    claimId: `ICN-${randRef()}`, type: "Accident", motorClaimType: "Own Damage",
                    incidentDescription: "Rear-ended at traffic lights on Mombasa Rd near Mlolongo",
                    status: "Settled", amount: randAmount(30000, 300000), approvedAmount: 250000, paidAmount: 250000, excessAmount: 10000, excessPaid: 10000,
                    assessorName: "J. Kimani", policyNumber: policyNum, date: "2024-03-15",
                    timeOfAccident: "14:30", dateIntimationAgency: "2024-03-16", dateIntimationInsurer: "2024-03-17",
                    dateSettledRejected: "2024-04-10", dateAssessorAppointed: "2024-03-18", dateRepairAuthorised: "2024-03-25",
                    placeOfOccurrence: "Mombasa Road, Mlolongo", policeStation: "Mlolongo Police Station",
                    injuries: "None reported", repairer: "CHECK-IN Motors", garage: "CHECK-IN Garage Nairobi",
                    driverName: "Daniel Oluoch", vehicleReg: `KCA ${Math.floor(100 + Math.random() * 900)}T`,
                    vehicleMake: "Toyota", vehicleModel: "Axio", yearOfManufacture: 2019, engineCC: 1500,
                    financialInterest: "", cashInLieu: false, writeOff: false,
                    remarks: "Claim settled. Police abstract obtained. No injuries.",
                    recoveringFrom: "Third Party Driver — KBZ 447A",
                    dvIssued: true, dvIssueDate: "2024-04-08", dvReturnDate: "2024-04-10",
                    fullySettled: true, rejectedByAgency: false, rejectedByInsurer: false,
                    insuranceClaimRefNo: `INS-REF-${randRef()}`
                },
                {
                    claimId: `ICN-${randRef()}`, type: "Windscreen", motorClaimType: "Windscreen",
                    incidentDescription: "Stone chip from lorry shattered windscreen on Nakuru highway",
                    status: "Paid", amount: randAmount(15000, 25000), approvedAmount: 18000, paidAmount: 18000, excessAmount: 0, excessPaid: 0,
                    assessorName: "Internal Auto-Approve", policyNumber: policyNum, date: "2023-11-10",
                    timeOfAccident: "09:15", dateIntimationAgency: "2023-11-10", dateIntimationInsurer: "2023-11-11",
                    dateSettledRejected: "2023-11-25",
                    placeOfOccurrence: "Nakuru Highway, near Gilgil", policeStation: "N/A",
                    injuries: "None", repairer: "Spedag Motors", garage: "Spedag Glass Nairobi",
                    driverName: "", vehicleReg: `KCA ${Math.floor(100 + Math.random() * 900)}T`,
                    vehicleMake: "Toyota", vehicleModel: "Axio", yearOfManufacture: 2019, engineCC: 1500,
                    cashInLieu: false, writeOff: false,
                    remarks: "Windscreen replacement authorised and completed.",
                    recoveringFrom: "", dvIssued: true, dvIssueDate: "2023-11-24", dvReturnDate: "2023-11-25",
                    fullySettled: true, rejectedByAgency: false, rejectedByInsurer: false,
                    insuranceClaimRefNo: `INS-REF-${randRef()}`
                }
            ],
            policyHistory: [
                {
                    policyNumber: policyNum, product: "Motor Comprehensive", coverType: "Comprehensive",
                    businessType: "Renewal", insurerName: "CIC Insurance Group", productName: "Motor Private Comprehensive",
                    startDate: "2024-01-01", endDate: renewalDate.toISOString().split("T")[0],
                    renewalDate: renewalDate.toISOString().split("T")[0],
                    status: "Active", annualPremiumKes: randAmount(40000, 80000), sumInsuredKes: randAmount(800000, 3000000),
                    paymentStatus: "Paid", outstandingPremium: 0, intermediaryName: "Direct", intermediaryType: "Direct",
                    modeOfPayment: "M-PESA"
                },
                {
                    policyNumber: `${policyNum}-PREV`, product: "Motor Comprehensive", coverType: "Comprehensive",
                    businessType: "New Business", insurerName: "CIC Insurance Group", productName: "Motor Private Comprehensive",
                    startDate: "2023-01-01", endDate: "2024-01-01", renewalDate: "2024-01-01",
                    status: "Expired", annualPremiumKes: 45000, sumInsuredKes: randAmount(700000, 2500000),
                    paymentStatus: "Paid", outstandingPremium: 0, intermediaryName: "Direct", intermediaryType: "Direct",
                    modeOfPayment: "M-PESA"
                }
            ],
            premiumPaymentHistory: [
                { amount: randAmount(8000, 25000), date: "2024-01-05", method: "M-PESA", reference: randRef(), receiptNumber: `RCT-${randRef()}`, policyNumber: policyNum, status: "Paid", description: "Annual Motor Comprehensive Premium", periodFrom: "2024-01-01", periodTo: "2025-01-01", isPartial: false },
                { amount: randAmount(8000, 25000), date: "2023-01-05", method: "M-PESA", reference: randRef(), receiptNumber: `RCT-${randRef()}`, policyNumber: policyNum, status: "Paid", description: "Annual Motor Comprehensive Premium", periodFrom: "2023-01-01", periodTo: "2024-01-01", isPartial: false },
                { amount: randAmount(8000, 25000), date: "2022-01-05", method: "M-PESA", reference: randRef(), receiptNumber: `RCT-${randRef()}`, policyNumber: `${policyNum}-PREV`, status: "Paid", description: "Annual Motor Comprehensive Premium", periodFrom: "2022-01-01", periodTo: "2023-01-01", isPartial: false }
            ]
        };
    });

    // 2. Individual Policyholder — Life & Medical
    generateGroup("individual_policyholder", "yahoo.com", "CIC", () => "", (i) => {
        const product = pick(["life", "medical"]);
        const policyNum = randPolicyNum(product);
        const renewalDate = new Date();
        renewalDate.setDate(renewalDate.getDate() + Math.floor(Math.random() * 180));
        return {
            productLine: product,
            policyNumber: policyNum,
            policyRenewalDate: renewalDate.toISOString().split("T")[0],
            claimsHistory: [
                {
                    claimId: `ICN-${randRef()}`, type: "Outpatient", motorClaimType: null,
                    incidentDescription: "Routine outpatient consultation and pharmacy — Aga Khan Hospital",
                    status: "Paid", amount: randAmount(2000, 8000), approvedAmount: 5000, paidAmount: 5000, excessAmount: 0, excessPaid: 0,
                    assessorName: "Auto-Approve", policyNumber: policyNum, date: "2024-02-20",
                    timeOfAccident: null, dateIntimationAgency: "2024-02-20", dateIntimationInsurer: "2024-02-21",
                    dateSettledRejected: "2024-02-25",
                    placeOfOccurrence: "Aga Khan University Hospital, Nairobi", policeStation: "N/A",
                    injuries: "N/A — Medical claim", repairer: "N/A", garage: "N/A", driverName: "N/A",
                    cashInLieu: false, writeOff: false,
                    remarks: "Approved automatically within system limits.",
                    recoveringFrom: "", dvIssued: true, dvIssueDate: "2024-02-24", dvReturnDate: "2024-02-25",
                    fullySettled: true, rejectedByAgency: false, rejectedByInsurer: false,
                    occupation: "Healthcare Worker", insuranceClaimRefNo: `INS-REF-${randRef()}`
                },
                {
                    claimId: `ICN-${randRef()}`, type: "Inpatient", motorClaimType: null,
                    incidentDescription: "Emergency surgery admission — Appendectomy at MP Shah Hospital",
                    status: "Under Assessment", amount: randAmount(50000, 150000), approvedAmount: 0, paidAmount: 0, excessAmount: 5000, excessPaid: 0,
                    assessorName: "Dr. Mwangi", policyNumber: policyNum, date: "2024-05-10",
                    timeOfAccident: null, dateIntimationAgency: "2024-05-10", dateIntimationInsurer: "2024-05-11",
                    dateSettledRejected: null,
                    placeOfOccurrence: "MP Shah Hospital, Nairobi", policeStation: "N/A",
                    injuries: "Surgical intervention required", repairer: "N/A", garage: "N/A", driverName: "N/A",
                    cashInLieu: false, writeOff: false,
                    remarks: "Awaiting final discharge summary from hospital.",
                    recoveringFrom: "", dvIssued: false, dvIssueDate: null, dvReturnDate: null,
                    fullySettled: false, rejectedByAgency: false, rejectedByInsurer: false,
                    occupation: "Healthcare Worker", insuranceClaimRefNo: `INS-REF-${randRef()}`
                }
            ],
            policyHistory: [
                {
                    policyNumber: policyNum,
                    product: product === "life" ? "Whole Life Assurance" : "Individual Medical Cover",
                    coverType: product === "life" ? "Whole Life" : "Individual Inpatient & Outpatient",
                    businessType: "New Business", insurerName: "CIC Insurance Group",
                    productName: product === "life" ? "CIC Whole Life Assurance" : "CIC Linda Jamii Medical",
                    startDate: "2023-06-01", endDate: renewalDate.toISOString().split("T")[0],
                    renewalDate: renewalDate.toISOString().split("T")[0],
                    status: "Active", annualPremiumKes: randAmount(50000, 150000), sumInsuredKes: randAmount(500000, 5000000),
                    paymentStatus: randAmount(0, 1) > 0 ? "Paid" : "Partial", outstandingPremium: randAmount(0, 15000),
                    intermediaryName: "Direct", intermediaryType: "Direct", modeOfPayment: "Standing Order"
                },
                {
                    policyNumber: randPolicyNum("life"), product: "Education Plan", coverType: "Endowment",
                    businessType: "New Business", insurerName: "CIC Insurance Group", productName: "CIC Elimu Plan",
                    startDate: "2022-01-01", endDate: "2032-01-01", renewalDate: null,
                    status: "Active", annualPremiumKes: 120000, sumInsuredKes: randAmount(1000000, 3000000),
                    paymentStatus: "Paid", outstandingPremium: 0,
                    intermediaryName: "Direct", intermediaryType: "Direct", modeOfPayment: "Standing Order"
                }
            ],
            premiumPaymentHistory: [
                { amount: randAmount(3000, 15000), date: "2024-01-01", method: "Standing Order", reference: randRef(), receiptNumber: `RCT-${randRef()}`, policyNumber: policyNum, status: "Paid", description: `Monthly ${product === 'life' ? 'Life Assurance' : 'Medical Cover'} Premium`, periodFrom: "2024-01-01", periodTo: "2024-01-31", isPartial: false },
                { amount: randAmount(3000, 15000), date: "2024-02-01", method: "Standing Order", reference: randRef(), receiptNumber: `RCT-${randRef()}`, policyNumber: policyNum, status: "Paid", description: `Monthly ${product === 'life' ? 'Life Assurance' : 'Medical Cover'} Premium`, periodFrom: "2024-02-01", periodTo: "2024-02-29", isPartial: false },
                { amount: randAmount(3000, 15000), date: "2024-03-01", method: "Standing Order", reference: randRef(), receiptNumber: `RCT-${randRef()}`, policyNumber: policyNum, status: "Paid", description: `Monthly ${product === 'life' ? 'Life Assurance' : 'Medical Cover'} Premium`, periodFrom: "2024-03-01", periodTo: "2024-03-31", isPartial: false },
                { amount: randAmount(3000, 15000), date: "2024-04-01", method: "Standing Order", reference: randRef(), receiptNumber: `RCT-${randRef()}`, policyNumber: policyNum, status: "Partial", description: `Monthly ${product === 'life' ? 'Life Assurance' : 'Medical Cover'} Premium — Partial`, periodFrom: "2024-04-01", periodTo: "2024-04-30", isPartial: true }
            ]
        };
    });

    // 3. SACCO / Cooperative — CIC's primary distribution moat
    generateGroup("sacco_cooperative", "sacco.co.ke", "CIC", () => pick(saccoNames), (i) => {
        const sacco = pick(saccoNames);
        const memberCount = 500 + Math.floor(Math.random() * 9500);
        return {
            productLine: pick(["group_life", "medical", "micro_insurance"]),
            metadata: {
                membership_count: memberCount,
                sacco_registration_number: `SASRA/${Math.floor(1000 + Math.random() * 8999)}`,
                scheme_type: pick(["Group Credit Life", "CoopCare Medical", "FOSA Insurance"]),
                scheme_renewal_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                annual_premium: randAmount(200000, 5000000)
            },
            claimsHistory: [
                {
                    claimId: `ICN-${randRef()}`, type: "Group Medical Claim", motorClaimType: null,
                    incidentDescription: "Q1 outpatient pool utilization — high claimants in Nairobi region",
                    status: "Paid", amount: randAmount(150000, 800000), approvedAmount: 400000, paidAmount: 400000, excessAmount: 0, excessPaid: 0,
                    assessorName: "Corporate Medical Desk", policyNumber: randPolicyNum("group_life"), date: "2024-04-10",
                    timeOfAccident: null, dateIntimationAgency: "2024-04-08", dateIntimationInsurer: "2024-04-09",
                    dateSettledRejected: "2024-04-20",
                    placeOfOccurrence: "Various — Nairobi County", policeStation: "N/A",
                    injuries: "N/A — Medical scheme", repairer: "N/A", garage: "N/A", driverName: "N/A",
                    cashInLieu: false, writeOff: false,
                    remarks: "Quarterly pool settled within approved limits.",
                    recoveringFrom: "", dvIssued: true, dvIssueDate: "2024-04-19", dvReturnDate: "2024-04-20",
                    fullySettled: true, rejectedByAgency: false, rejectedByInsurer: false,
                    insuranceClaimRefNo: `INS-REF-${randRef()}`
                }
            ],
            policyHistory: [
                {
                    policyNumber: randPolicyNum("group_life"), product: "Group Credit Life", coverType: "Group Credit Life",
                    businessType: "Renewal", insurerName: "CIC Insurance Group", productName: "CIC CoopCare Group Credit Life",
                    startDate: "2023-01-01", endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                    renewalDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                    status: "Active", annualPremiumKes: randAmount(1000000, 5000000), sumInsuredKes: randAmount(50000000, 200000000),
                    paymentStatus: "Paid", outstandingPremium: 0,
                    intermediaryName: "Minet Kenya", intermediaryType: "Broker", modeOfPayment: "Bank Transfer"
                }
            ],
            premiumPaymentHistory: [
                { amount: randAmount(500000, 2000000), date: "2024-01-15", method: "Bank Transfer", reference: randRef(), receiptNumber: `RCT-${randRef()}`, policyNumber: randPolicyNum("group_life"), status: "Paid", description: "Annual Group Credit Life Scheme Premium", periodFrom: "2024-01-01", periodTo: "2025-01-01", isPartial: false }
            ]
        };
    });

    // 4. Corporate Client — Group Medical & Life Schemes
    generateGroup("corporate_client", "co.ke", "CIC", () => pick(corporateClients), (i) => {
        const corporate = pick(corporateClients);
        return {
            productLine: pick(["medical", "group_life", "property"]),
            metadata: {
                industry_sector: pick(industries),
                employee_count: 100 + Math.floor(Math.random() * 4900),
                scheme_renewal_date: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                annual_premium: randAmount(500000, 10000000),
                relationship_manager: `${pick(firstNames)} ${pick(lastNames)}`
            },
            claimsHistory: [
                {
                    claimId: `ICN-${randRef()}`, type: "Employee Medical — High Utilization", motorClaimType: null,
                    incidentDescription: "Elevated claims frequency for chronic disease management among staff",
                    status: "Under Assessment", amount: randAmount(500000, 2000000), approvedAmount: 0, paidAmount: 0, excessAmount: 0, excessPaid: 0,
                    assessorName: "Dr. Omondi — Corporate Desk", policyNumber: randPolicyNum("medical"), date: "2024-05-20",
                    timeOfAccident: null, dateIntimationAgency: "2024-05-19", dateIntimationInsurer: "2024-05-20",
                    dateSettledRejected: null,
                    placeOfOccurrence: "Multiple — Corporate Scheme", policeStation: "N/A",
                    injuries: "N/A — Medical scheme", repairer: "N/A", garage: "N/A", driverName: "N/A",
                    cashInLieu: false, writeOff: false,
                    remarks: "Pending full assessment and claims audit.",
                    recoveringFrom: "", dvIssued: false, dvIssueDate: null, dvReturnDate: null,
                    fullySettled: false, rejectedByAgency: false, rejectedByInsurer: false,
                    insuranceClaimRefNo: `INS-REF-${randRef()}`
                }
            ],
            policyHistory: [
                {
                    policyNumber: randPolicyNum("medical"), product: "Corporate Group Medical", coverType: "Group Medical Inpatient & Outpatient",
                    businessType: "Renewal", insurerName: "CIC Insurance Group", productName: "CIC Corporate Medical Scheme",
                    startDate: "2022-07-01", endDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                    renewalDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                    status: "Active", annualPremiumKes: randAmount(2000000, 10000000), sumInsuredKes: randAmount(50000000, 500000000),
                    paymentStatus: randAmount(0, 1) > 0 ? "Paid" : "Partial", outstandingPremium: randAmount(0, 500000),
                    intermediaryName: "AON Kenya", intermediaryType: "Broker", modeOfPayment: "RTGS"
                }
            ],
            premiumPaymentHistory: [
                { amount: randAmount(1000000, 5000000), date: "2024-02-10", method: "RTGS", reference: randRef(), receiptNumber: `RCT-${randRef()}`, policyNumber: randPolicyNum("medical"), status: "Paid", description: "Annual Corporate Group Medical Scheme Premium", periodFrom: "2024-07-01", periodTo: "2025-07-01", isPartial: false }
            ]
        };
    });

    // 5. Insurance Agent — Licensed individual agents
    generateGroup("agent", "agent.cic.co.ke", "AGT", () => "CIC Insurance Group", (i) => {
        const policyNum = randPolicyNum("property");
        return {
            policyNumber: policyNum,
            metadata: {
                ira_license_number: randIraLicense(),
                license_expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                agency_code: `CIC-AGT-${Math.floor(1000 + Math.random() * 8999)}`,
                product_lines_authorized: pick(["Motor, Life", "Medical, Life", "Motor, Property", "All Lines"]),
                branch: pick(branches),
                commission_ytd: randAmount(50000, 500000)
            },
            claimsHistory: [],
            policyHistory: [
                {
                    policyNumber: policyNum, product: "Professional Indemnity", coverType: "Professional Indemnity",
                    businessType: "New Business", insurerName: "CIC Insurance Group", productName: "CIC Agent PI Cover",
                    startDate: "2024-01-01", endDate: "2025-01-01", renewalDate: "2025-01-01",
                    status: "Active", annualPremiumKes: randAmount(15000, 45000), sumInsuredKes: randAmount(2000000, 10000000),
                    paymentStatus: "Paid", outstandingPremium: 0,
                    intermediaryName: "Direct", intermediaryType: "Direct", modeOfPayment: "M-PESA"
                }
            ],
            premiumPaymentHistory: [
                { amount: randAmount(15000, 45000), date: "2024-01-05", method: "M-PESA", reference: randRef(), receiptNumber: `RCT-${randRef()}`, policyNumber: policyNum, status: "Paid", description: "Annual Professional Indemnity Premium", periodFrom: "2024-01-01", periodTo: "2025-01-01", isPartial: false }
            ]
        };
    });

    // 6. Insurance Broker — Independent brokerage firms
    generateGroup("broker", "broker.co.ke", "BRK", () => pick(brokerages), (i) => {
        const brokerage = pick(brokerages);
        return {
            organization: brokerage,
            parentOrganization: brokerage,
            metadata: {
                ira_license_number: `IRA/BRK/${Math.floor(10000 + Math.random() * 89999)}`,
                license_expiry_date: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                brokerage_name: brokerage,
                annual_gp: randAmount(1000000, 50000000)
            },
            claimsHistory: [],
            policyHistory: [
                {
                    policyNumber: randPolicyNum("property"), product: "Brokerage Professional Indemnity", coverType: "Professional Indemnity",
                    businessType: "Renewal", insurerName: "CIC Insurance Group", productName: "CIC Broker PI Cover",
                    startDate: "2023-05-01", endDate: "2024-05-01", renewalDate: "2024-05-01",
                    status: "Active", annualPremiumKes: randAmount(250000, 750000), sumInsuredKes: randAmount(20000000, 100000000),
                    paymentStatus: randAmount(0, 1) > 0 ? "Paid" : "Partial", outstandingPremium: randAmount(0, 50000),
                    intermediaryName: "Direct", intermediaryType: "Direct", modeOfPayment: "Bank Transfer"
                }
            ],
            premiumPaymentHistory: [
                { amount: randAmount(250000, 750000), date: "2023-05-15", method: "Bank Transfer", reference: randRef(), receiptNumber: `RCT-${randRef()}`, policyNumber: randPolicyNum("property"), status: "Paid", description: "Annual Brokerage PI Cover Premium", periodFrom: "2023-05-01", periodTo: "2024-05-01", isPartial: false }
            ]
        };
    });

    // 7. Bancassurance Partner
    generateGroup("bancassurance_partner", "bank.co.ke", "BNK", () => pick(["KCB Bank", "Equity Bank", "NCBA Bank", "Co-operative Bank", "Family Bank", "DTB Kenya"]), (i) => {
        const bank = pick(["KCB Bank", "Equity Bank", "NCBA Bank", "Co-operative Bank", "Family Bank"]);
        return {
            organization: bank,
            parentOrganization: bank,
            metadata: {
                institution_name: bank,
                partnership_tier: pick(["Platinum", "Gold", "Silver"]),
                agreement_renewal_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                branches_covered: Math.floor(5 + Math.random() * 95),
                annual_policies_issued: Math.floor(500 + Math.random() * 9500)
            },
            claimsHistory: [],
            policyHistory: [
                {
                    policyNumber: randPolicyNum("property"), product: "Bankers Blanket Bond", coverType: "Fidelity & Financial Crime",
                    businessType: "Renewal", insurerName: "CIC Insurance Group", productName: "CIC Bankers Blanket Bond",
                    startDate: "2023-11-01", endDate: "2024-11-01", renewalDate: "2024-11-01",
                    status: "Active", annualPremiumKes: randAmount(5000000, 15000000), sumInsuredKes: randAmount(500000000, 2000000000),
                    paymentStatus: "Paid", outstandingPremium: 0,
                    intermediaryName: "Direct", intermediaryType: "Bancassurance", modeOfPayment: "Internal Transfer"
                },
                {
                    policyNumber: randPolicyNum("life"), product: "Creditor Life Scheme", coverType: "Group Credit Life",
                    businessType: "Renewal", insurerName: "CIC Insurance Group", productName: "CIC Creditor Life",
                    startDate: "2023-11-01", endDate: "2024-11-01", renewalDate: "2024-11-01",
                    status: "Active", annualPremiumKes: randAmount(10000000, 30000000), sumInsuredKes: randAmount(1000000000, 5000000000),
                    paymentStatus: "Paid", outstandingPremium: 0,
                    intermediaryName: "Direct", intermediaryType: "Bancassurance", modeOfPayment: "Internal Transfer"
                }
            ],
            premiumPaymentHistory: [
                { amount: randAmount(5000000, 15000000), date: "2023-11-10", method: "Internal Transfer", reference: randRef(), receiptNumber: `RCT-${randRef()}`, policyNumber: randPolicyNum("property"), status: "Paid", description: "Annual Bankers Blanket Bond Premium", periodFrom: "2023-11-01", periodTo: "2024-11-01", isPartial: false }
            ]
        };
    });

    return seeds;
}

// ─── CIC-Specific Signal Templates ──────────────────────────────────────────

type TemplateFn = (s?: any) => { text: string; metadata: Record<string, any> };

const channelTemplates: Record<string, TemplateFn[]> = {
    email: [
        (s) => {
            const name = s ? `${s.firstName} ${s.lastName}` : "John Doe";
            const email = s?.email || `john.doe${Math.floor(Math.random()*100)}@gmail.com`;
            const policy = s?.policyNumber || randPolicyNum("motor");
            return {
                text: `Hello CIC Insurance,\n\nI am writing regarding my motor insurance policy ${policy}. I was involved in an accident last week and submitted a claim, but I have not received any updates. Could someone look into the status of my claim?\n\nThank you,\n${name}`,
                metadata: { email, firstName: s?.firstName || "John", lastName: s?.lastName || "Doe", source: "email", policyNumber: policy }
            };
        },
        (s) => {
            const sacco = pick(saccoNames);
            const email = `secretary@${sacco.replace(/\s+/g, '').toLowerCase()}.sacco.co.ke`;
            return {
                text: `Dear CIC Insurance,\n\nOn behalf of ${sacco}, I would like to inquire about enrolling our members in a group medical cover scheme. We have approximately ${500 + Math.floor(Math.random() * 4500)} active members. Please advise on the next steps and required documentation.`,
                metadata: { email, organization: sacco, request_type: "scheme_inquiry", source: "email" }
            };
        }
    ],
    call: [
        (s) => {
            const name = s ? `${s.firstName} ${s.lastName}` : pick(firstNames);
            const policy = s?.policyNumber || randPolicyNum("motor");
            return {
                text: `[VOICE TRANSCRIPT] Hi, I am calling about my motor insurance renewal. My policy number is ${policy} and I think it expires soon. Can you confirm the renewal amount and how I can pay via M-PESA?`,
                metadata: { full_name: name, policy_number: policy, source: "call", urgency: "medium" }
            };
        }
    ],
    whatsapp: [
        (s) => {
            const name = s ? `${s.firstName} ${s.lastName}` : pick(firstNames);
            return {
                text: `Hello CIC. I need help urgently. My car was broken into last night and I need to make a claim. What documents do I need? 😟`,
                metadata: { full_name: name, source: "whatsapp", platform: "whatsapp", urgency: "high" }
            };
        },
        (s) => {
            const name = s ? `${s.firstName} ${s.lastName}` : pick(firstNames);
            return {
                text: `Hi! I paid my premium via M-PESA yesterday Ref: ${randRef()} but my policy still shows as lapsed on the portal. Can you help?`,
                metadata: { full_name: name, source: "whatsapp", platform: "whatsapp" }
            };
        }
    ],
    live_chat: [
        (s) => {
            const name = s ? `${s.firstName} ${s.lastName}` : "Guest";
            return {
                text: `Hi there, I am looking to get medical insurance for my family of 5. What are the available plans and what do they cover?`,
                metadata: { full_name: name, source: "live_chat", intent: "new_policy" }
            };
        }
    ],
    chatbot: [
        (s) => {
            const policy = s?.policyNumber || randPolicyNum("life");
            return {
                text: `[BOT ESCALATION] User requested human agent. Chat log: "I want to dispute my claim settlement amount for policy ${policy}. The assessor undervalued my vehicle damage."`,
                metadata: { policy_number: policy, source: "chatbot", escalation_reason: "claims_dispute" }
            };
        }
    ],
    facebook: [
        (s) => {
            const name = s ? `${s.firstName} ${s.lastName}` : "Frustrated Client";
            return {
                text: `CIC Insurance has the worst claims process! It's been 3 weeks since my accident and my claim is still pending. No one picks up the phone! - ${name} #CICInsurance #ClaimsDelay`,
                metadata: { platform: "facebook", full_name: name, source: "facebook", sentiment: "negative" }
            };
        }
    ],
    instagram: [
        (s) => {
            const name = s ? `${s.firstName} ${s.lastName}` : "Happy Customer";
            return {
                text: `Just got my life insurance payout processed super fast by @CICInsurance Kenya! Great service, highly recommend their life products 🙌💯 #CICInsurance #InsuranceKenya`,
                metadata: { platform: "instagram", full_name: name, source: "instagram", sentiment: "positive" }
            };
        }
    ],
    linkedin: [
        (s) => {
            const company = pick(corporateClients);
            return {
                text: `${company} is looking to set up a comprehensive group medical scheme for our 500+ employees. We'd like to explore CIC Insurance's corporate solutions. Who is the right contact for this?`,
                metadata: { platform: "linkedin", company, source: "linkedin", request_type: "corporate_scheme" }
            };
        }
    ],
    tiktok: [
        (s) => {
            return {
                text: `Can someone explain what exactly is covered under CIC's motor comprehensive vs third party? The website doesn't make it super clear 🤔 #InsuranceKenya #CIC`,
                metadata: { platform: "tiktok", source: "tiktok", intent: "product_inquiry" }
            };
        }
    ],
    website: [
        (s) => {
            const company = s?.organization || pick(corporateClients);
            const contact = `${pick(firstNames)} ${pick(lastNames)}`;
            return {
                text: `[WEBSITE CONTACT FORM] ${company} is requesting a quote for property insurance covering our office premises valued at KES ${randAmount(10000000, 100000000).toLocaleString()}.`,
                metadata: { company, source: "website", request_type: "property_quote", contact_person: contact }
            };
        }
    ],
    walk_in: [
        (s) => {
            const name = s ? `${s.firstName} ${s.lastName}` : "Walk-in Client";
            return {
                text: `[BRANCH LOG - ${pick(branches)}] Client walked in to submit supporting documents for pending motor claim. Policy holder: ${name}. Documents received: Police abstract, repair estimate, ID copy. Logged for claims processing.`,
                metadata: { full_name: name, source: "walk_in", priority: "medium" }
            };
        }
    ],
    sms: [
        (s) => {
            const policy = s?.policyNumber || randPolicyNum("motor");
            return {
                text: `My M-PESA premium payment for policy ${policy} failed. Transaction ID: ${randRef()}. Please assist.`,
                metadata: { source: "sms", policy_number: policy }
            };
        }
    ]
};

const channelSourceMap: Record<string, string> = {
    call: "call",
    email: "email",
    whatsapp: "whatsapp",
    live_chat: "live_chat",
    chatbot: "chatbot",
    facebook: "facebook",
    instagram: "instagram",
    linkedin: "linkedin",
    tiktok: "tiktok",
    website: "website",
    walk_in: "walk_in",
    sms: "sms"
};

const channelStakeholderTypeMap: Record<string, string> = {
    call: "individual_policyholder",
    email: "individual_policyholder",
    whatsapp: "individual_policyholder",
    live_chat: "individual_policyholder",
    chatbot: "individual_policyholder",
    facebook: "individual_policyholder",
    instagram: "individual_policyholder",
    linkedin: "corporate_client",
    tiktok: "individual_policyholder",
    website: "corporate_client",
    walk_in: "individual_policyholder",
    sms: "individual_policyholder"
};

import { AnalyticsService } from "./analytics-service";

export const SimulationService = {
    /**
     * Seeds CIC Insurance stakeholders (35 total across 7 types, 5 per type).
     * Idempotent: skips or updates if stakeholders already exist.
     */
    async seedStakeholders() {
        const seeds = await generateStakeholderSeeds();
        let created = 0;
        let updated = 0;

        for (const seed of seeds) {
            const [existing] = await db.select({ id: stakeholders.id })
                .from(stakeholders)
                .where(eq(stakeholders.policyNumber, seed.policyNumber))
                .limit(1);

            const riskLevel = await AnalyticsService.calculateRiskLevel(existing?.id || "temp", seed.metadata);

            let lifecycleStage = "active";
            if (seed.type === "individual_policyholder") lifecycleStage = "onboarded";
            else if (seed.type === "sacco_cooperative") lifecycleStage = "scheme_active";
            else if (seed.type === "corporate_client") lifecycleStage = "scheme_active";
            else if (seed.type === "agent" || seed.type === "broker" || seed.type === "bancassurance_partner") lifecycleStage = "active";

            const stakeholderData = {
                type: seed.type,
                lifecycleStage,
                firstName: seed.firstName,
                lastName: seed.lastName,
                email: seed.email,
                phone: seed.phone,
                policyNumber: seed.policyNumber,
                organization: seed.organization,
                county: seed.county,
                country: seed.country,
                region: seed.region,
                productLine: seed.productLine,
                policyRenewalDate: seed.policyRenewalDate,
                claimsHistory: seed.claimsHistory,
                policyHistory: seed.policyHistory,
                premiumPaymentHistory: seed.premiumPaymentHistory,
                parentOrganization: seed.parentOrganization,
                engagementScore: 0,
                riskLevel,
                preferredChannel: pick(["email", "phone", "whatsapp"]),
                metadata: seed.metadata,
                updatedAt: new Date().toISOString()
            };

            if (!existing) {
                await db.insert(stakeholders).values({
                    ...stakeholderData,
                    createdAt: new Date().toISOString()
                } as any);
                created++;
            } else {
                await db.update(stakeholders)
                    .set(stakeholderData as any)
                    .where(eq(stakeholders.id, existing.id));
                updated++;
            }
        }

        return { message: `CIC stakeholder seeding complete. Created: ${created}, Updated: ${updated}`, count: created + updated };
    },

    /**
     * Simulates an inbound signal from any CIC client touchpoint.
     * Runs NLP categorisation (or uses forceCategoryId) → stakeholder matching → case creation → auto-assignment.
     */
    async simulateSignal(signal: IntakeSignal, forceCategoryId?: string) {
        console.log(`[Simulation] Processing CIC signal from ${signal.source}: "${signal.text.substring(0, 60)}..."`);

        let nlpResult = forceCategoryId 
            ? { categoryId: forceCategoryId, confidence: 99, tokensFound: ["forced_simulation"] }
            : await NLPService.matchCategory(signal.text);

        let finalStakeholderId = await StakeholderMatchingService.matchFromMetadata(signal.metadata || {});
        if (finalStakeholderId) {
            console.log(`[Simulation] Auto-matched stakeholder: ${finalStakeholderId}`);
        } else {
            console.log(`[Simulation] No stakeholder match found.`);
            if (signal.metadata?.email) {
                const [existing] = await db.select().from(stakeholders).where(eq(stakeholders.email, signal.metadata.email)).limit(1);
                if (existing) {
                    finalStakeholderId = existing.id;
                } else {
                    let type = "individual_policyholder";
                    let lifecycleStage = "prospect";
                    if (signal.metadata?.request_type === "scheme_inquiry" || signal.metadata?.request_type === "corporate_scheme") {
                        type = "corporate_client";
                        lifecycleStage = "lead";
                    }

                    const [newStakeholder] = await db.insert(stakeholders).values({
                        type,
                        lifecycleStage,
                        firstName: signal.metadata?.firstName || "Unknown",
                        lastName: signal.metadata?.lastName || "Client",
                        email: signal.metadata.email,
                        organization: signal.metadata?.organization || "",
                        policyNumber: signal.metadata?.policyNumber || null,
                        preferredChannel: "email",
                        createdAt: new Date().toISOString()
                    } as any).returning();
                    finalStakeholderId = newStakeholder.id;
                    console.log(`[Simulation] Auto-created new stakeholder: ${finalStakeholderId} (${type})`);
                }
            }
        }

        const [intakeSignal] = await db.insert(intakeSignals).values({
            source: signal.source,
            rawText: signal.text,
            metadata: signal.metadata || {},
            stakeholderId: finalStakeholderId,
            suggestedCategoryId: nlpResult.categoryId,
            confidenceScore: nlpResult.confidence,
            status: nlpResult.confidence > 70 ? "mapped" : "pending"
        } as any).returning();

        let createdCase = null;

        if (nlpResult.confidence > 70 && nlpResult.categoryId) {
            const [targetCategory] = await db.select().from(serviceCategories).where(eq(serviceCategories.id, nlpResult.categoryId)).limit(1);

            if (targetCategory) {
                // Check if target category belongs to the Marketing department
                let isMarketingDept = false;
                if (targetCategory.departmentId) {
                    const [dept] = await db.select().from(departments).where(eq(departments.id, targetCategory.departmentId)).limit(1);
                    if (dept && (dept.code === 'MRK' || dept.isMarketingDepartment || dept.name === 'Marketing')) {
                        isMarketingDept = true;
                    }
                }

                if (isMarketingDept) {
                    // Fork: Create a Pipeline Lead directly
                    const yearShort = new Date().getFullYear().toString().slice(-2);
                    const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
                    const caseNumber = `CIC-${yearShort}-${random}`; // we'll use this format for the leadRef

                    const pType = signal.metadata?.pipelineType || (signal.metadata?.organization ? 'b2b' : 'b2c');
                    
                    await db.insert(cicLeads).values({
                        leadRef: `LEAD-${caseNumber}`,
                        pipelineType: pType,
                        productLine: signal.metadata?.productLine || "motor",
                        sourceChannel: signal.source || "referral",
                        firstName: signal.metadata?.firstName || "Unknown",
                        lastName: signal.metadata?.lastName || "Client",
                        organisationName: signal.metadata?.organization || null,
                        phone: signal.metadata?.phone || "TBD",
                        email: signal.metadata?.email || "TBD",
                        stage: signal.metadata?.stage_hint || "lead",
                        referredByStakeholderId: finalStakeholderId || null,
                        country: signal.metadata?.country || "Kenya",
                        county: signal.metadata?.county || null,
                        nationalIdNumber: signal.metadata?.nationalIdNumber || null,
                        kraPin: signal.metadata?.kraPin || null,
                        occupation: signal.metadata?.occupation || null,
                        coverType: signal.metadata?.coverType || null,
                        sumInsuredConfirmedKes: signal.metadata?.sumInsuredConfirmedKes || null,
                        quotedPremiumKes: signal.metadata?.quotedPremiumKes || null,
                        underwritingDecision: signal.metadata?.underwritingDecision || null,
                        orgType: signal.metadata?.orgType || null,
                        totalMemberCount: signal.metadata?.totalMemberCount || null,
                        sectorIndustry: signal.metadata?.sectorIndustry || null,
                        estimatedAnnualPremium: signal.metadata?.estimatedAnnualPremium || null
                    } as any);

                    await db.update(intakeSignals).set({
                        status: "mapped"
                    }).where(eq(intakeSignals.id, intakeSignal.id));

                    if (finalStakeholderId) {
                        await db.insert(stakeholderInteractions).values({
                            stakeholderId: finalStakeholderId,
                            caseId: null, // No case ID because it's a lead
                            type: "portal_submission",
                            channel: signal.source as any,
                            direction: "inbound",
                            subject: "Marketing Inquiry",
                            description: signal.text,
                            metadata: signal.metadata || {},
                            date: new Date().toISOString()
                        } as any);
                        console.log(`[Simulation] Auto-created Pipeline Lead directly for stakeholder ${finalStakeholderId}`);
                    }

                    // Return early so we don't create a Case
                    return;
                }

                // Normal Case Generation Flow
                const yearShort = new Date().getFullYear().toString().slice(-2);
                const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
                const caseNumber = `CIC-${yearShort}-${random}`;

                let slaDeadline = null;
                let slaResponseDeadline = null;
                const priorityToMatch = targetCategory.defaultPriority || "medium";

                let slaRuleResult = await db.select()
                    .from(slaRules)
                    .where(and(
                        eq(slaRules.serviceCategoryId, targetCategory.id),
                        eq(slaRules.priority, priorityToMatch),
                        eq(slaRules.isActive, true)
                    ))
                    .limit(1);

                if (slaRuleResult.length === 0) {
                    slaRuleResult = await db.select()
                        .from(slaRules)
                        .where(and(eq(slaRules.serviceCategoryId, targetCategory.id), eq(slaRules.isActive, true)))
                        .limit(1);
                }

                if (slaRuleResult.length > 0) {
                    const slaRule = slaRuleResult[0];
                    const now = new Date();
                    if (slaRule.responseTimeMinutes) slaResponseDeadline = new Date(now.getTime() + slaRule.responseTimeMinutes * 60000).toISOString();
                    if (slaRule.timeline) {
                        let mins = slaRule.timeline;
                        if (slaRule.timelineUnit === "hours") mins *= 60;
                        else if (slaRule.timelineUnit === "working days") mins *= 8 * 60;
                        else if (slaRule.timelineUnit === "days") mins *= 24 * 60;
                        else if (slaRule.timelineUnit !== "minutes") mins *= 60;
                        slaDeadline = new Date(now.getTime() + mins * 60000).toISOString();
                    }
                }

                const [newCase] = await db.insert(cases).values({
                    caseNumber,
                    title: signal.text.substring(0, 80),
                    description: signal.text,
                    stakeholderId: finalStakeholderId,
                    serviceCategoryId: targetCategory.id,
                    priority: targetCategory.defaultPriority || "medium",
                    status: "open",
                    channel: signal.source as any,
                    assignedDepartment: targetCategory.departmentId,
                    slaDeadline,
                    slaResponseDeadline,
                    metadata: {
                        ...(signal.metadata as any),
                        simulated: true,
                        nlp_confidence: nlpResult.confidence,
                        nlp_tokens: nlpResult.tokensFound
                    }
                } as any).returning();

                createdCase = newCase;

                await db.update(intakeSignals).set({
                    mappedCaseId: newCase.id,
                    status: "mapped"
                }).where(eq(intakeSignals.id, intakeSignal.id));

                if (finalStakeholderId) {
                    await db.insert(stakeholderInteractions).values({
                        stakeholderId: finalStakeholderId,
                        caseId: newCase.id,
                        type: "portal_submission",
                        channel: signal.source as any,
                        direction: "inbound",
                        subject: nlpResult.categoryId ? "New CIC Case" : "Client Inquiry",
                        description: signal.text,
                        metadata: signal.metadata || {},
                        date: new Date().toISOString()
                    } as any);
                    console.log(`[Simulation] Logged interaction for stakeholder ${finalStakeholderId} on case ${caseNumber}`);
                }

                if (targetCategory.departmentId) {
                    await AssignmentService.autoAssignCase(newCase.id, null, targetCategory.departmentId);
                    console.log(`[Simulation] Auto-assigned case ${caseNumber} to optimal officer.`);
                }

                await db.insert(caseHistory).values({
                    caseId: newCase.id,
                    action: `Case created from ${signal.source} — "${signal.text.substring(0, 50)}..."`,
                    previousStatus: null,
                    newStatus: "open",
                    changedBy: null,
                } as any);
            }
        }

        return createdCase || { id: intakeSignal.id, status: "pending_triage" };
    },

    /**
     * Triggers a randomised, realistic CIC Insurance signal from a specific channel.
     */
    async triggerScenario(channelSlug: string) {
        console.log(`[Simulation] Injecting CIC scenario for channel: ${channelSlug}`);
        const type = channelStakeholderTypeMap[channelSlug] || "individual_policyholder";

        const templates = channelTemplates[channelSlug];
        if (!templates || templates.length === 0) {
            console.error(`[Simulation] No templates for ${channelSlug}`);
            return;
        }

        let [stakeholder] = await db.select()
            .from(stakeholders)
            .where(eq(stakeholders.type, type))
            .orderBy(sql`RANDOM()`)
            .limit(1);

        if (!stakeholder) {
            console.log(`[Simulation] No stakeholders of type ${type} found. Falling back.`);
            [stakeholder] = await db.select()
                .from(stakeholders)
                .orderBy(sql`RANDOM()`)
                .limit(1);
        }

        const templateFn = pick(templates);
        const generated = templateFn(stakeholder);

        return this.simulateSignal({
            source: channelSourceMap[channelSlug] || channelSlug,
            text: generated.text,
            metadata: generated.metadata
        });
    },

    /**
     * Complete system reset and reseed for CIC Insurance.
     * 1. Clears all cases/triage data
     * 2. Seeds CIC stakeholders (35 across 7 types)
     * 3. Triggers 20 random CIC insurance scenarios
     */
    async reseedSystem() {
        console.log("[Simulation] Starting CIC Insurance system reseed...");

        await db.transaction(async (tx) => {
            await tx.delete(caseHistory);
            await tx.delete(caseComments);
            await tx.delete(caseAttachments);
            await tx.delete(intakeSignals);
            await tx.delete(stakeholderInteractions);
            await tx.delete(stakeholderRelationships);
            await tx.delete(cases);
        });

        await this.seedStakeholders();

        const scenarios = Object.keys(channelTemplates);
        const results = [];
        for (let i = 0; i < 20; i++) {
            const scenario = pick(scenarios);
            results.push(await this.triggerScenario(scenario));
        }

        // Seed 3 Knowledge Base Templates
        const cats = await db.select().from(serviceCategories).limit(3);
        if (cats.length >= 3) {
            const templatesData = [
                {
                    title: "Standard Motor Claim Procedure",
                    category: "template",
                    isTemplate: true,
                    serviceCategoryId: cats[0].id,
                    rootCause: "Driver Error / Accident",
                    resolutionSummary: "Claim assessed and processed according to motor policy.",
                    sopSteps: ["Verify driver license and police abstract", "Assess vehicle damage", "Approve repair estimate", "Issue release letter"],
                    isPublished: true,
                    content: "This template covers the standard procedure for handling motor claims."
                },
                {
                    title: "General Health Pre-Auth",
                    category: "template",
                    isTemplate: true,
                    serviceCategoryId: cats[1].id,
                    rootCause: "Medical Necessity / Illness",
                    resolutionSummary: "Pre-auth approved based on inpatient policy limits.",
                    sopSteps: ["Verify member eligibility", "Review medical report and diagnosis", "Confirm hospital panel status", "Issue pre-auth letter"],
                    isPublished: true,
                    content: "Template for handling standard health pre-authorizations."
                },
                {
                    title: "Pension Payout Process",
                    category: "template",
                    isTemplate: true,
                    serviceCategoryId: cats[2].id,
                    rootCause: "Retirement / Separation",
                    resolutionSummary: "Pension funds disbursed to the verified member account.",
                    sopSteps: ["Verify member identity and separation letter", "Calculate accrued benefits", "Obtain RBA approval if necessary", "Process payment via finance"],
                    isPublished: true,
                    content: "Guidelines for processing member pension payouts."
                }
            ];

            // Check if they already exist
            for (const tmpl of templatesData) {
                const existingTmpl = await db.select().from(knowledgeBase).where(eq(knowledgeBase.title, tmpl.title)).limit(1);
                if (existingTmpl.length === 0) {
                    await db.insert(knowledgeBase).values(tmpl as any);
                }
            }
        }

        return {
            message: "CIC Insurance system reset and reseeded with 35 stakeholders, 20 cases, and 3 knowledge templates.",
            casesCreated: results.length
        };
    }
};
