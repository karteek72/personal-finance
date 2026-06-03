/** Spend categories — keep aligned with docs/design/design-tokens.json */
export const SPEND_CATEGORIES = [
  "Food & Groceries",
  "Dining & Restaurants",
  "Housing & Home",
  "Utilities & Bills",
  "Transportation",
  "Subscriptions & Software",
  "Financial & Insurance",
  "Health & Medical",
  "Education",
  "Shopping & Retail",
  "Entertainment",
  "Personal Care",
  "Family & Kids",
  "Pet",
  "Gifts & Donations",
  "Business & Professional",
  "Travel",
  "Income",
  "Transfers (internal)",
  "Uncategorized",
] as const;

export type SpendCategory = (typeof SPEND_CATEGORIES)[number];

/** Subcategories keyed by parent. All subcategory strings are valid only under their parent. */
export const SUBCATEGORY_MAP = {
  "Food & Groceries": [
    "Grocery Stores",
    "Wholesale Clubs",
    "Specialty & Ethnic",
    "Alcohol & Wine",
    "Convenience Stores",
  ],
  "Dining & Restaurants": [
    "Sit-down Restaurants",
    "Fast Food & Takeout",
    "Cafes & Coffee",
    "Desserts & Ice Cream",
    "Food Delivery",
    "Bars & Nightlife",
  ],
  "Housing & Home": [
    "Mortgage / Rent",
    "HOA Fees",
    "Home Maintenance",
    "Furniture & Appliances",
    "Home Improvement",
  ],
  "Utilities & Bills": [
    "Gas & Electric",
    "Water & Sewer",
    "Internet & Cable",
    "Phone & Mobile",
    "Trash & Recycling",
    "Natural Gas",
  ],
  Transportation: [
    "Gas & Fuel",
    "Tolls & Parking",
    "Car Payment / Lease",
    "Car Insurance",
    "Car Maintenance",
    "Rideshare & Taxi",
    "Public Transit",
  ],
  "Subscriptions & Software": [
    "Streaming Video",
    "Music & Podcasts",
    "AI Tools",
    "Cloud & Storage",
    "Software & Productivity",
    "Hosting & Domains",
    "News & Publications",
  ],
  "Financial & Insurance": [
    "Taxes",
    "Home & Auto Insurance",
    "Loan Payments",
    "Bank Fees & Interest",
    "Investments",
  ],
  "Health & Medical": [
    "Doctor & Hospital",
    "Pharmacy",
    "Dental & Vision",
    "Mental Health",
    "Health Insurance",
    "Fitness & Gym",
  ],
  Education: [
    "School Fees & Supplies",
    "Tutoring & Classes",
    "Online Courses",
    "Books & Supplies",
  ],
  "Shopping & Retail": [
    "Clothing & Apparel",
    "Electronics & Tech",
    "Home Goods",
    "Online Shopping",
    "Department Stores",
  ],
  Entertainment: [
    "Movies & Events",
    "Sports & Recreation",
    "Gaming",
    "Arts & Hobbies",
  ],
  "Personal Care": [
    "Hair & Grooming",
    "Beauty & Cosmetics",
    "Spa & Wellness",
  ],
  "Family & Kids": [
    "Childcare & Daycare",
    "Kids Activities",
    "Baby Supplies",
  ],
  Pet: [
    "Food & Treats",
    "Veterinary & Medical",
    "Supplies & Toys",
    "Grooming & Boarding",
    "Pet Insurance",
  ],
  "Gifts & Donations": [
    "Charitable Donations",
    "Gifts",
    "Religious / Temple",
  ],
  "Business & Professional": [
    "Shipping & Postage",
    "Office Supplies",
    "Professional Services",
  ],
  Travel: [
    "Flights",
    "Hotels & Lodging",
    "Car Rental",
    "Travel Activities",
  ],
  Income: [
    "Salary & Wages",
    "Freelance & Contract",
    "Investment Returns",
    "Refunds & Rebates",
  ],
  "Transfers (internal)": [
    "Bank Transfers",
    "Investment Transfers",
    "Credit Card Payments",
  ],
  Uncategorized: [],
} as const satisfies Record<SpendCategory, readonly string[]>;

export type SubCategory<C extends SpendCategory> =
  (typeof SUBCATEGORY_MAP)[C][number];

const CATEGORY_SET = new Set<string>(SPEND_CATEGORIES);

const SUBCATEGORY_SET: Map<string, Set<string>> = new Map(
  Object.entries(SUBCATEGORY_MAP).map(([cat, subs]) => [
    cat,
    new Set(subs as readonly string[]),
  ]),
);

export function isValidCategory(value: string): value is SpendCategory {
  return CATEGORY_SET.has(value);
}

export function isValidSubCategory(
  category: string,
  subCategory: string,
): boolean {
  return SUBCATEGORY_SET.get(category)?.has(subCategory) ?? false;
}

export function getSubCategories(category: SpendCategory): readonly string[] {
  return SUBCATEGORY_MAP[category];
}
