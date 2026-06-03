import { isValidCategory, isValidSubCategory } from "../config/categories.js";

interface MerchantRule {
  /** Parent categories this rule applies to; empty = any */
  categories: readonly string[];
  pattern: RegExp;
  subCategory: string;
}

/** Overrides both parent category and subcategory when matched. */
interface RecategorizeRule {
  pattern: RegExp;
  category: string;
  subCategory: string;
}

const RECATEGORIZE_RULES: RecategorizeRule[] = [
  { pattern: /cursor|claude\.ai|perplexity|openai|chatgpt/, category: "Subscriptions & Software", subCategory: "AI Tools" },
  { pattern: /cloudflare/, category: "Subscriptions & Software", subCategory: "Hosting & Domains" },
  { pattern: /bestbrains|schlpay|allen isd/, category: "Education", subCategory: "Tutoring & Classes" },
  { pattern: /fedex|ups store|usps/, category: "Business & Professional", subCategory: "Shipping & Postage" },
  { pattern: /aptive|pest control/, category: "Housing & Home", subCategory: "Home Maintenance" },
  { pattern: /irs|usataxpymt/, category: "Financial & Insurance", subCategory: "Taxes" },
  { pattern: /aaa.*insur/, category: "Transportation", subCategory: "Car Insurance" },
  { pattern: /interest charge|late fee/, category: "Financial & Insurance", subCategory: "Bank Fees & Interest" },
  { pattern: /coserv|base power/, category: "Utilities & Bills", subCategory: "Gas & Electric" },
  { pattern: /allenwater/, category: "Utilities & Bills", subCategory: "Water & Sewer" },
  { pattern: /at&t|att\*/, category: "Utilities & Bills", subCategory: "Phone & Mobile" },
  { pattern: /ntta autocharge|toll/, category: "Transportation", subCategory: "Tolls & Parking" },
  { pattern: /costco gas|racetrac|shell|chevron/, category: "Transportation", subCategory: "Gas & Fuel" },
  { pattern: /payment thank you|autopay|ach pmt|credit card payment|payment from chk|card autopay|epayment|e-payment/, category: "Transfers (internal)", subCategory: "Credit Card Payments" },
  { pattern: /chewy\.com|chewy/, category: "Pet", subCategory: "Food & Treats" },
  { pattern: /petsmart|petco|pet supplies/, category: "Pet", subCategory: "Supplies & Toys" },
  { pattern: /banfield|vca animal|vet clinic|veterinary|animal hospital/, category: "Pet", subCategory: "Veterinary & Medical" },
  { pattern: /rover\.com|wag!|dog walker|pet boarding|kennel|pet groom/, category: "Pet", subCategory: "Grooming & Boarding" },
  { pattern: /trupanion|healthy paws|pet insurance|nationwide pet/, category: "Pet", subCategory: "Pet Insurance" },
];

const MERCHANT_RULES: MerchantRule[] = [
  // Utilities & Bills
  { categories: ["Utilities & Bills"], pattern: /coserv|base power|electric|txu|reliant|oncor/, subCategory: "Gas & Electric" },
  { categories: ["Utilities & Bills"], pattern: /allenwater|water|sewer|ntmwd/, subCategory: "Water & Sewer" },
  { categories: ["Utilities & Bills"], pattern: /spectrum|xfinity|comcast|fiber|cable|internet/, subCategory: "Internet & Cable" },
  { categories: ["Utilities & Bills"], pattern: /at&t|att\*|att payment|t-mobile|verizon|wireless|phone/, subCategory: "Phone & Mobile" },
  { categories: ["Utilities & Bills"], pattern: /trash|waste|republic services|garbage/, subCategory: "Trash & Recycling" },
  { categories: ["Utilities & Bills"], pattern: /atmos|natural gas/, subCategory: "Natural Gas" },
  // Transportation
  { categories: ["Transportation", "Transport & Gas"], pattern: /costco gas|racetrac|shell|chevron|exxon|gas station|fuel/, subCategory: "Gas & Fuel" },
  { categories: ["Transportation", "Transport & Gas"], pattern: /ntta|toll|parking/, subCategory: "Tolls & Parking" },
  { categories: ["Transportation", "Transport & Gas"], pattern: /uber|lyft|taxi|waymo/, subCategory: "Rideshare & Taxi" },
  { categories: ["Transportation", "Transport & Gas"], pattern: /jiffy|firestone|oil change|auto repair|lube/, subCategory: "Car Maintenance" },
  { categories: ["Transportation", "Transport & Gas"], pattern: /geico|state farm|usaa auto|car insurance/, subCategory: "Car Insurance" },
  // Dining
  { categories: ["Dining & Restaurants"], pattern: /domino|braum|mcdonald|burger|taco bell|wendy|fast food/, subCategory: "Fast Food & Takeout" },
  { categories: ["Dining & Restaurants"], pattern: /starbucks|coffee|paris baguette|yemeni coffee|caf[eé]/, subCategory: "Cafes & Coffee" },
  { categories: ["Dining & Restaurants"], pattern: /ice cream|ked's|dessert|sweet/, subCategory: "Desserts & Ice Cream" },
  { categories: ["Dining & Restaurants"], pattern: /doordash|grubhub|uber eats|postmates/, subCategory: "Food Delivery" },
  { categories: ["Dining & Restaurants"], pattern: /total wine|liquor|bar |lounge|nightlife/, subCategory: "Bars & Nightlife" },
  { categories: ["Dining & Restaurants"], pattern: /tst\*|restaurant|ghazal|velvet taco|annapurna|desi |swadeshi|simply s|sree shank/, subCategory: "Sit-down Restaurants" },
  // Food & Groceries
  { categories: ["Food & Groceries"], pattern: /costco(?! gas)|heb|walmart|sprouts|kroger|whole foods|trader/, subCategory: "Grocery Stores" },
  { categories: ["Food & Groceries"], pattern: /swadeshi|patel|india metro|ethnic/, subCategory: "Specialty & Ethnic" },
  { categories: ["Food & Groceries"], pattern: /total wine|liquor store/, subCategory: "Alcohol & Wine" },
  { categories: ["Food & Groceries"], pattern: /7-eleven|quiktrip|convenience/, subCategory: "Convenience Stores" },
  // Financial & Insurance
  { categories: ["Financial & Insurance", "Financial"], pattern: /irs|usataxpymt|tax payment|tax pymt/, subCategory: "Taxes" },
  { categories: ["Financial & Insurance", "Financial"], pattern: /aaa.*insur|usaa.*insur|home insurance|auto insurance/, subCategory: "Home & Auto Insurance" },
  { categories: ["Financial & Insurance", "Financial"], pattern: /interest charge|late fee|overdraft|bank fee/, subCategory: "Bank Fees & Interest" },
  { categories: ["Financial & Insurance", "Financial"], pattern: /loan payment|student loan|mortgage payment/, subCategory: "Loan Payments" },
  // Subscriptions & Software
  { categories: ["Subscriptions & Software", "Financial"], pattern: /cursor|claude\.ai|perplexity|openai|chatgpt|copilot/, subCategory: "AI Tools" },
  { categories: ["Subscriptions & Software", "Financial"], pattern: /netflix|disney\+|hulu|hbo|streaming/, subCategory: "Streaming Video" },
  { categories: ["Subscriptions & Software", "Financial"], pattern: /spotify|apple music|podcast/, subCategory: "Music & Podcasts" },
  { categories: ["Subscriptions & Software", "Financial"], pattern: /cloudflare|aws|vercel|hosting|domain/, subCategory: "Hosting & Domains" },
  { categories: ["Subscriptions & Software", "Financial"], pattern: /microsoft 365|adobe|software|saas/, subCategory: "Software & Productivity" },
  // Education
  { categories: ["Education", "Financial"], pattern: /bestbrains|schlpay|allen isd|school|tuition|tutor/, subCategory: "Tutoring & Classes" },
  { categories: ["Education"], pattern: /coursera|udemy|linkedin learning/, subCategory: "Online Courses" },
  // Housing & Home
  { categories: ["Housing & Home", "Home & Rent"], pattern: /mortgage|rent payment|hoa/, subCategory: "Mortgage / Rent" },
  { categories: ["Housing & Home", "Home & Rent"], pattern: /aptive|pest|home maint|contractor|repair/, subCategory: "Home Maintenance" },
  { categories: ["Housing & Home", "Home & Rent"], pattern: /home depot|lowes|hardware|furniture|ikea/, subCategory: "Home Improvement" },
  // Business
  { categories: ["Financial & Insurance", "Business & Professional"], pattern: /fedex|ups store|usps|postage|shipping/, subCategory: "Shipping & Postage" },
  // Health
  { categories: ["Health & Medical"], pattern: /planet fitness|gym|crossfit|yoga|fitness/, subCategory: "Fitness & Gym" },
  { categories: ["Health & Medical"], pattern: /cvs|walgreens|pharmacy/, subCategory: "Pharmacy" },
  { categories: ["Health & Medical"], pattern: /dentist|dental|vision|optom/, subCategory: "Dental & Vision" },
  // Pet
  { categories: ["Pet", "Shopping & Retail", "Health & Medical"], pattern: /chewy/, subCategory: "Food & Treats" },
  { categories: ["Pet", "Shopping & Retail"], pattern: /petsmart|petco|pet supplies|pet store/, subCategory: "Supplies & Toys" },
  { categories: ["Pet", "Health & Medical"], pattern: /banfield|vca|vet |veterinary|animal hospital|animal clinic/, subCategory: "Veterinary & Medical" },
  { categories: ["Pet"], pattern: /rover|wag!|dog walk|pet board|kennel|groom|pet sit/, subCategory: "Grooming & Boarding" },
  { categories: ["Pet", "Financial & Insurance"], pattern: /trupanion|healthy paws|pet insurance|nationwide pet/, subCategory: "Pet Insurance" },
  // Transfers
  { categories: ["Transfers (internal)"], pattern: /payment thank you|autopay|ach|credit card|zelle|transfer/, subCategory: "Credit Card Payments" },
  { categories: ["Transfers (internal)"], pattern: /invest|brokerage|401k|ira/, subCategory: "Investment Transfers" },
  // Income
  { categories: ["Income"], pattern: /payroll|salary|wages|direct deposit|cisco systems/, subCategory: "Salary & Wages" },
  { categories: ["Income"], pattern: /dividend|interest earned|investment return/, subCategory: "Investment Returns" },
  { categories: ["Income"], pattern: /refund|rebate/, subCategory: "Refunds & Rebates" },
];

/** Label for transactions with no inferred subcategory. */
export const GENERAL_SUBCATEGORY = "General";

export interface InferredClassification {
  category: string;
  subCategory: string | null;
}

export function inferClassification(
  category: string,
  merchantName: string | null | undefined,
  name: string,
): InferredClassification {
  const haystack = `${merchantName ?? ""} ${name}`.toLowerCase().replace(/\s+/g, " ");

  for (const rule of RECATEGORIZE_RULES) {
    if (!rule.pattern.test(haystack)) {
      continue;
    }
    if (
      isValidCategory(rule.category) &&
      isValidSubCategory(rule.category, rule.subCategory)
    ) {
      return { category: rule.category, subCategory: rule.subCategory };
    }
  }

  const subCategory = inferSubCategory(category, merchantName, name);
  return { category, subCategory };
}

/**
 * Infer subcategory from merchant name and transaction description.
 * Returns null when no rule matches (caller may use GENERAL_SUBCATEGORY).
 */
export function inferSubCategory(
  category: string,
  merchantName: string | null | undefined,
  name: string,
): string | null {
  const haystack = `${merchantName ?? ""} ${name}`.toLowerCase().replace(/\s+/g, " ");

  for (const rule of MERCHANT_RULES) {
    if (rule.categories.length > 0 && !rule.categories.includes(category)) {
      continue;
    }
    if (!rule.pattern.test(haystack)) {
      continue;
    }
    if (isValidSubCategory(category, rule.subCategory)) {
      return rule.subCategory;
    }
  }

  return null;
}

/** DB/storage value: null means General in UI aggregations. */
export function classificationForStorage(
  category: string,
  merchantName: string | null | undefined,
  name: string,
  existingCategory: string,
  existingSubCategory: string | null | undefined,
): InferredClassification {
  if (existingSubCategory) {
    return { category: existingCategory, subCategory: existingSubCategory };
  }
  return inferClassification(existingCategory, merchantName, name);
}

/** Display label for aggregation (never null). */
export function subCategoryDisplayLabel(
  subCategory: string | null | undefined,
): string {
  return subCategory?.trim() || GENERAL_SUBCATEGORY;
}
