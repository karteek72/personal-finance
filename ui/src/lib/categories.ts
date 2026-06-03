/** Category labels — keep aligned with backend/src/config/categories.ts and docs/design/design-tokens.json */
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

export const SUBCATEGORY_MAP: Record<SpendCategory, readonly string[]> = {
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
  "Personal Care": ["Hair & Grooming", "Beauty & Cosmetics", "Spa & Wellness"],
  "Family & Kids": ["Childcare & Daycare", "Kids Activities", "Baby Supplies"],
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
  Travel: ["Flights", "Hotels & Lodging", "Car Rental", "Travel Activities"],
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
};

export function getSubCategories(category: SpendCategory): readonly string[] {
  return SUBCATEGORY_MAP[category];
}

export function isSpendCategory(value: string): value is SpendCategory {
  return (SPEND_CATEGORIES as readonly string[]).includes(value);
}

export function resolveSubCategories(category: string): readonly string[] {
  return isSpendCategory(category) ? SUBCATEGORY_MAP[category] : [];
}

/** Categories excluded from expense analytics (income + system) */
export const NON_EXPENSE_CATEGORIES = new Set<string>([
  "Income",
  "Transfers (internal)",
]);
