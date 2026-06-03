import type { Transaction as PlaidTransaction } from "plaid";
import {
  CREDIT_CARD_PAYMENT_SUBCATEGORY,
  INTERNAL_TRANSFER_CATEGORY,
  resolveInternalTransfer,
} from "../transfer-classification.js";

interface PFCEntry {
  category: string;
  subCategory: string | null;
}

/** Full Plaid PFCv1 + PFCv2 detailed code → SpendFlow category/subcategory mapping. */
const PFC_MAP: Record<string, PFCEntry> = {
  // ── Income ────────────────────────────────────────────────────────────────
  INCOME:                                            { category: "Income",                  subCategory: null },
  INCOME_DIVIDENDS:                                  { category: "Income",                  subCategory: "Investment Returns" },
  INCOME_INTEREST_EARNED:                            { category: "Income",                  subCategory: "Investment Returns" },
  INCOME_RETIREMENT_PENSION:                         { category: "Income",                  subCategory: "Salary & Wages" },
  INCOME_TAX_REFUND:                                 { category: "Income",                  subCategory: "Refunds & Rebates" },
  INCOME_UNEMPLOYMENT:                               { category: "Income",                  subCategory: "Salary & Wages" },
  INCOME_WAGES:                                      { category: "Income",                  subCategory: "Salary & Wages" },
  INCOME_OTHER_INCOME:                               { category: "Income",                  subCategory: null },
  // ── Transfers ─────────────────────────────────────────────────────────────
  TRANSFER_IN:                                       { category: "Transfers (internal)",    subCategory: "Bank Transfers" },
  TRANSFER_OUT:                                      { category: "Transfers (internal)",    subCategory: "Bank Transfers" },
  // ── Loan payments ─────────────────────────────────────────────────────────
  LOAN_PAYMENTS:                                     { category: "Financial & Insurance",   subCategory: "Loan Payments" },
  LOAN_PAYMENTS_CAR_PAYMENT:                         { category: "Transportation",          subCategory: "Car Payment / Lease" },
  LOAN_PAYMENTS_CREDIT_CARD_PAYMENT:                 { category: "Transfers (internal)",    subCategory: "Credit Card Payments" },
  LOAN_PAYMENTS_MORTGAGE_PAYMENT:                    { category: "Housing & Home",          subCategory: "Mortgage / Rent" },
  LOAN_PAYMENTS_PERSONAL_LOAN:                       { category: "Financial & Insurance",   subCategory: "Loan Payments" },
  LOAN_PAYMENTS_STUDENT_LOAN:                        { category: "Financial & Insurance",   subCategory: "Loan Payments" },
  LOAN_PAYMENTS_OTHER_PAYMENT:                       { category: "Financial & Insurance",   subCategory: "Loan Payments" },
  // ── Food & Drink ──────────────────────────────────────────────────────────
  FOOD_AND_DRINK:                                    { category: "Dining & Restaurants",    subCategory: null },
  FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR:               { category: "Dining & Restaurants",    subCategory: "Bars & Nightlife" },
  FOOD_AND_DRINK_COFFEE:                             { category: "Dining & Restaurants",    subCategory: "Cafes & Coffee" },
  FOOD_AND_DRINK_FAST_FOOD:                          { category: "Dining & Restaurants",    subCategory: "Fast Food & Takeout" },
  FOOD_AND_DRINK_GROCERIES:                          { category: "Food & Groceries",        subCategory: "Grocery Stores" },
  FOOD_AND_DRINK_RESTAURANT:                         { category: "Dining & Restaurants",    subCategory: "Sit-down Restaurants" },
  FOOD_AND_DRINK_VENDING_MACHINES:                   { category: "Food & Groceries",        subCategory: "Convenience Stores" },
  FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK:               { category: "Dining & Restaurants",    subCategory: null },
  // ── Transportation ────────────────────────────────────────────────────────
  TRANSPORTATION:                                    { category: "Transportation",          subCategory: null },
  TRANSPORTATION_BIKES_AND_SCOOTERS:                 { category: "Transportation",          subCategory: "Public Transit" },
  TRANSPORTATION_GAS:                                { category: "Transportation",          subCategory: "Gas & Fuel" },
  TRANSPORTATION_PARKING:                            { category: "Transportation",          subCategory: "Tolls & Parking" },
  TRANSPORTATION_PUBLIC_TRANSIT:                     { category: "Transportation",          subCategory: "Public Transit" },
  TRANSPORTATION_TAXIS_AND_RIDE_SHARES:              { category: "Transportation",          subCategory: "Rideshare & Taxi" },
  TRANSPORTATION_TOLLS:                              { category: "Transportation",          subCategory: "Tolls & Parking" },
  TRANSPORTATION_VEHICLES:                           { category: "Transportation",          subCategory: "Car Maintenance" },
  TRANSPORTATION_OTHER_TRANSPORTATION:               { category: "Transportation",          subCategory: null },
  // ── Entertainment ─────────────────────────────────────────────────────────
  ENTERTAINMENT:                                     { category: "Entertainment",           subCategory: null },
  ENTERTAINMENT_CASINOS_AND_GAMBLING:                { category: "Entertainment",           subCategory: "Arts & Hobbies" },
  ENTERTAINMENT_MUSIC_AND_AUDIO:                     { category: "Entertainment",           subCategory: "Arts & Hobbies" },
  ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_ZOOS: { category: "Entertainment",     subCategory: "Sports & Recreation" },
  ENTERTAINMENT_TV_AND_MOVIES:                       { category: "Entertainment",           subCategory: "Movies & Events" },
  ENTERTAINMENT_VIDEO_GAMES:                         { category: "Entertainment",           subCategory: "Gaming" },
  ENTERTAINMENT_OTHER_ENTERTAINMENT:                 { category: "Entertainment",           subCategory: null },
  // ── General Merchandise (Shopping) ────────────────────────────────────────
  GENERAL_MERCHANDISE:                               { category: "Shopping & Retail",       subCategory: null },
  GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS:     { category: "Shopping & Retail",       subCategory: "Arts & Hobbies" },
  GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES:      { category: "Shopping & Retail",       subCategory: "Clothing & Apparel" },
  GENERAL_MERCHANDISE_CONVENIENCE_STORES:            { category: "Food & Groceries",        subCategory: "Convenience Stores" },
  GENERAL_MERCHANDISE_DISCOUNT_STORES:               { category: "Shopping & Retail",       subCategory: "Department Stores" },
  GENERAL_MERCHANDISE_ELECTRONICS:                   { category: "Shopping & Retail",       subCategory: "Electronics & Tech" },
  GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES:           { category: "Gifts & Donations",       subCategory: "Gifts" },
  GENERAL_MERCHANDISE_OFFICE_SUPPLIES:               { category: "Business & Professional", subCategory: "Office Supplies" },
  GENERAL_MERCHANDISE_ONLINE_MARKETPLACES:           { category: "Shopping & Retail",       subCategory: "Online Shopping" },
  GENERAL_MERCHANDISE_PET_SUPPLIES:                  { category: "Pet",                       subCategory: "Supplies & Toys" },
  GENERAL_MERCHANDISE_SPORTING_GOODS:                { category: "Shopping & Retail",       subCategory: "Arts & Hobbies" },
  GENERAL_MERCHANDISE_SUPERSTORES:                   { category: "Shopping & Retail",       subCategory: "Department Stores" },
  GENERAL_MERCHANDISE_TOBACCO_AND_VAPE:              { category: "Personal Care",           subCategory: null },
  GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE:     { category: "Shopping & Retail",       subCategory: null },
  // ── Rent & Utilities ──────────────────────────────────────────────────────
  RENT_AND_UTILITIES:                                { category: "Utilities & Bills",       subCategory: null },
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY:            { category: "Utilities & Bills",       subCategory: "Gas & Electric" },
  RENT_AND_UTILITIES_INTERNET_AND_CABLE:             { category: "Utilities & Bills",       subCategory: "Internet & Cable" },
  RENT_AND_UTILITIES_RENT:                           { category: "Housing & Home",          subCategory: "Mortgage / Rent" },
  RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT:    { category: "Utilities & Bills",       subCategory: "Trash & Recycling" },
  RENT_AND_UTILITIES_TELEPHONE:                      { category: "Utilities & Bills",       subCategory: "Phone & Mobile" },
  RENT_AND_UTILITIES_WATER:                          { category: "Utilities & Bills",       subCategory: "Water & Sewer" },
  RENT_AND_UTILITIES_OTHER_UTILITIES:                { category: "Utilities & Bills",       subCategory: null },
  // ── Home Improvement ──────────────────────────────────────────────────────
  HOME_IMPROVEMENT:                                  { category: "Housing & Home",          subCategory: "Home Improvement" },
  HOME_IMPROVEMENT_CONTRACTORS:                      { category: "Housing & Home",          subCategory: "Home Maintenance" },
  HOME_IMPROVEMENT_FURNITURE:                        { category: "Housing & Home",          subCategory: "Furniture & Appliances" },
  HOME_IMPROVEMENT_HARDWARE:                         { category: "Housing & Home",          subCategory: "Home Improvement" },
  HOME_IMPROVEMENT_PAINTING_AND_DECOR:               { category: "Housing & Home",          subCategory: "Home Improvement" },
  HOME_IMPROVEMENT_SECURITY:                         { category: "Housing & Home",          subCategory: "Home Maintenance" },
  HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT:           { category: "Housing & Home",          subCategory: "Home Improvement" },
  // ── Medical ───────────────────────────────────────────────────────────────
  MEDICAL:                                           { category: "Health & Medical",        subCategory: null },
  MEDICAL_DENTAL_CARE:                               { category: "Health & Medical",        subCategory: "Dental & Vision" },
  MEDICAL_EYE_CARE:                                  { category: "Health & Medical",        subCategory: "Dental & Vision" },
  MEDICAL_LABS_AND_BLOOD_WORK:                       { category: "Health & Medical",        subCategory: "Doctor & Hospital" },
  MEDICAL_MENTAL_HEALTH:                             { category: "Health & Medical",        subCategory: "Mental Health" },
  MEDICAL_PHARMACIES_AND_SUPPLEMENTS:                { category: "Health & Medical",        subCategory: "Pharmacy" },
  MEDICAL_PRIMARY_CARE:                              { category: "Health & Medical",        subCategory: "Doctor & Hospital" },
  MEDICAL_SPECIALTY_CARE:                            { category: "Health & Medical",        subCategory: "Doctor & Hospital" },
  MEDICAL_VETERINARY_SERVICES:                       { category: "Pet",                       subCategory: "Veterinary & Medical" },
  MEDICAL_OTHER_MEDICAL:                             { category: "Health & Medical",        subCategory: null },
  // ── Personal Care ─────────────────────────────────────────────────────────
  PERSONAL_CARE:                                     { category: "Personal Care",           subCategory: null },
  PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS:            { category: "Health & Medical",        subCategory: "Fitness & Gym" },
  PERSONAL_CARE_HAIR_AND_BEAUTY:                     { category: "Personal Care",           subCategory: "Hair & Grooming" },
  PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING:            { category: "Personal Care",           subCategory: "Spa & Wellness" },
  PERSONAL_CARE_SPAS_AND_MASSAGE:                    { category: "Personal Care",           subCategory: "Spa & Wellness" },
  PERSONAL_CARE_OTHER_PERSONAL_CARE:                 { category: "Personal Care",           subCategory: null },
  // ── Travel ────────────────────────────────────────────────────────────────
  TRAVEL:                                            { category: "Travel",                  subCategory: null },
  TRAVEL_FLIGHTS:                                    { category: "Travel",                  subCategory: "Flights" },
  TRAVEL_HOTEL:                                      { category: "Travel",                  subCategory: "Hotels & Lodging" },
  TRAVEL_CAR_RENTALS:                                { category: "Travel",                  subCategory: "Car Rental" },
  TRAVEL_LODGING:                                    { category: "Travel",                  subCategory: "Hotels & Lodging" },
  TRAVEL_VACATION_RENTALS:                           { category: "Travel",                  subCategory: "Hotels & Lodging" },
  TRAVEL_OTHER_TRAVEL:                               { category: "Travel",                  subCategory: null },
  // ── General Services ──────────────────────────────────────────────────────
  GENERAL_SERVICES:                                  { category: "Business & Professional", subCategory: null },
  GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING:{ category: "Financial & Insurance",  subCategory: null },
  GENERAL_SERVICES_AUTOMOTIVE:                       { category: "Transportation",          subCategory: "Car Maintenance" },
  GENERAL_SERVICES_CHILDCARE:                        { category: "Family & Kids",           subCategory: "Childcare & Daycare" },
  GENERAL_SERVICES_CONSULTING_AND_LEGAL:             { category: "Business & Professional", subCategory: "Professional Services" },
  GENERAL_SERVICES_EDUCATION:                        { category: "Education",               subCategory: null },
  GENERAL_SERVICES_FINANCIAL_PLANNING_AND_INVESTMENTS: { category: "Financial & Insurance", subCategory: "Investments" },
  GENERAL_SERVICES_FOOD_AND_BEVERAGE:                { category: "Dining & Restaurants",    subCategory: null },
  GENERAL_SERVICES_GYMS_AND_FITNESS_CENTERS:         { category: "Health & Medical",        subCategory: "Fitness & Gym" },
  GENERAL_SERVICES_HAIR_AND_BEAUTY:                  { category: "Personal Care",           subCategory: "Hair & Grooming" },
  GENERAL_SERVICES_HOME_IMPROVEMENT:                 { category: "Housing & Home",          subCategory: "Home Improvement" },
  GENERAL_SERVICES_INSURANCE:                        { category: "Financial & Insurance",   subCategory: "Home & Auto Insurance" },
  GENERAL_SERVICES_ONLINE_SERVICES:                  { category: "Subscriptions & Software", subCategory: null },
  GENERAL_SERVICES_PARKING:                          { category: "Transportation",          subCategory: "Tolls & Parking" },
  GENERAL_SERVICES_POSTAGE_AND_SHIPPING:             { category: "Business & Professional", subCategory: "Shipping & Postage" },
  GENERAL_SERVICES_RELIGIOUS:                        { category: "Gifts & Donations",       subCategory: "Religious / Temple" },
  GENERAL_SERVICES_RENT_AND_UTILITIES:               { category: "Utilities & Bills",       subCategory: null },
  GENERAL_SERVICES_SUBSCRIPTION:                     { category: "Subscriptions & Software", subCategory: null },
  GENERAL_SERVICES_TELECOMMUNICATIONS:               { category: "Utilities & Bills",       subCategory: "Phone & Mobile" },
  GENERAL_SERVICES_OTHER_GENERAL_SERVICES:           { category: "Business & Professional", subCategory: null },
  // ── Government & Non-Profit ───────────────────────────────────────────────
  GOVERNMENT_AND_NON_PROFIT:                         { category: "Financial & Insurance",   subCategory: null },
  GOVERNMENT_AND_NON_PROFIT_DONATIONS:               { category: "Gifts & Donations",       subCategory: "Charitable Donations" },
  GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS:  { category: "Financial & Insurance",   subCategory: "Taxes" },
  GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT:             { category: "Financial & Insurance",   subCategory: "Taxes" },
  GOVERNMENT_AND_NON_PROFIT_OTHER_GOVERNMENT_AND_NON_PROFIT: { category: "Financial & Insurance", subCategory: null },
  // ── Bank Fees ─────────────────────────────────────────────────────────────
  BANK_FEES:                                         { category: "Financial & Insurance",   subCategory: "Bank Fees & Interest" },
  BANK_FEES_ATM_FEES:                                { category: "Financial & Insurance",   subCategory: "Bank Fees & Interest" },
  BANK_FEES_FOREIGN_TRANSACTION_FEES:                { category: "Financial & Insurance",   subCategory: "Bank Fees & Interest" },
  BANK_FEES_INSUFFICIENT_FUNDS:                      { category: "Financial & Insurance",   subCategory: "Bank Fees & Interest" },
  BANK_FEES_INTEREST_CHARGE:                         { category: "Financial & Insurance",   subCategory: "Bank Fees & Interest" },
  BANK_FEES_OVERDRAFT_FEES:                          { category: "Financial & Insurance",   subCategory: "Bank Fees & Interest" },
  BANK_FEES_OTHER_BANK_FEES:                         { category: "Financial & Insurance",   subCategory: "Bank Fees & Interest" },
};

const TRANSFER_PATTERNS = [
  /payment thank you/i,
  /online scheduled payment/i,
  /autopay/i,
  /transfer/i,
  /zelle/i,
];

export interface MappedCategory {
  category: string;
  subCategory: string | null;
}

export function mapPlaidCategory(txn: PlaidTransaction): MappedCategory {
  const detailed = txn.personal_finance_category?.detailed;
  if (detailed && PFC_MAP[detailed]) {
    return PFC_MAP[detailed]!;
  }
  const primary = txn.personal_finance_category?.primary;
  if (primary && PFC_MAP[primary]) {
    return PFC_MAP[primary]!;
  }
  const legacy = txn.category?.[0];
  if (legacy) {
    return { category: legacy, subCategory: null };
  }
  return { category: "Uncategorized", subCategory: null };
}

export function mapPlaidTransaction(
  txn: PlaidTransaction,
  accountType: "depository" | "credit",
): {
  externalId: string;
  date: string;
  name: string;
  merchantName: string | null;
  amount: string;
  category: string;
  subCategory: string | null;
  transactionType: "expense" | "income" | "transfer";
  isTransfer: boolean;
  pending: boolean;
} {
  const name = txn.merchant_name ?? txn.name;
  const raw = txn.amount;
  const isTransferByName = TRANSFER_PATTERNS.some((pattern) =>
    pattern.test(name),
  );

  let transactionType: "expense" | "income" | "transfer";
  let isTransfer = isTransferByName;
  let amount: string;

  if (accountType === "credit") {
    if (raw < 0 || isTransferByName) {
      transactionType = "transfer";
      isTransfer = true;
      amount = Math.abs(raw).toFixed(2);
    } else {
      transactionType = "expense";
      amount = Math.abs(raw).toFixed(2);
    }
  } else if (raw < 0) {
    transactionType = isTransferByName ? "transfer" : "income";
    isTransfer = isTransferByName;
    amount = isTransfer ? Math.abs(raw).toFixed(2) : (-Math.abs(raw)).toFixed(2);
  } else {
    transactionType = isTransferByName ? "transfer" : "expense";
    isTransfer = isTransferByName;
    amount = Math.abs(raw).toFixed(2);
  }

  const mapped = isTransfer
    ? {
        category: INTERNAL_TRANSFER_CATEGORY,
        subCategory: CREDIT_CARD_PAYMENT_SUBCATEGORY,
      }
    : mapPlaidCategory(txn);

  const base = {
    externalId: `plaid-${txn.transaction_id}`,
    date: txn.date,
    name: txn.name,
    merchantName: txn.merchant_name ?? null,
    amount,
    category: mapped.category,
    subCategory: mapped.subCategory,
    transactionType,
    isTransfer,
    pending: txn.pending ?? false,
  };

  const resolved = resolveInternalTransfer({
    category: base.category,
    subCategory: base.subCategory,
    name: base.name,
    merchantName: base.merchantName,
    pfcDetailed: txn.personal_finance_category?.detailed ?? null,
  });

  if (resolved) {
    return {
      ...base,
      category: resolved.category,
      subCategory: resolved.subCategory,
      transactionType: resolved.transactionType,
      isTransfer: resolved.isTransfer,
    };
  }

  return base;
}
