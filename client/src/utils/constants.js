export const TYPE_META = {
  BORROW: { label: 'Borrow', short: 'Lend', blurb: 'Use it for a while, then return it.', cls: 'bg-sky-100 text-sky-800 ring-sky-200', color: '#0284c7', icon: 'repeat' },
  DONATE: { label: 'Donate', short: 'Give', blurb: 'A free, permanent gift.', cls: 'bg-saffron-100 text-saffron-700 ring-saffron-200', color: '#e8870d', icon: 'gift' },
  SHARE: { label: 'Share', short: 'Share', blurb: 'Shared access for the community.', cls: 'bg-brand-100 text-brand-800 ring-brand-200', color: '#2a8670', icon: 'users' },
};

export const CONDITIONS = { NEW: 'New', LIKE_NEW: 'Like new', GOOD: 'Good', FAIR: 'Fair', POOR: 'Poor' };

export const REQUEST_STATUS = {
  PENDING: { label: 'Pending', cls: 'bg-amber-100 text-amber-800 ring-amber-200' },
  APPROVED: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-800 ring-emerald-200' },
  REJECTED: { label: 'Declined', cls: 'bg-red-100 text-red-800 ring-red-200' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-stone-200 text-stone-700 ring-stone-300' },
  IN_PROGRESS: { label: 'In progress', cls: 'bg-indigo-100 text-indigo-800 ring-indigo-200' },
  COMPLETED: { label: 'Completed', cls: 'bg-brand-100 text-brand-800 ring-brand-200' },
};

export const RESOURCE_STATUS = {
  AVAILABLE: { label: 'Available', cls: 'bg-emerald-100 text-emerald-800 ring-emerald-200' },
  UNAVAILABLE: { label: 'Fully allocated', cls: 'bg-amber-100 text-amber-800 ring-amber-200' },
  HIDDEN: { label: 'Hidden by moderator', cls: 'bg-red-100 text-red-800 ring-red-200' },
};

export const EMERGENCY_STATUS = {
  OPEN: { label: 'Open', cls: 'bg-red-100 text-red-800 ring-red-200' },
  UNDER_REVIEW: { label: 'Under review', cls: 'bg-amber-100 text-amber-800 ring-amber-200' },
  MATCHED: { label: 'Matched', cls: 'bg-indigo-100 text-indigo-800 ring-indigo-200' },
  FULFILLED: { label: 'Fulfilled', cls: 'bg-emerald-100 text-emerald-800 ring-emerald-200' },
  CLOSED: { label: 'Closed', cls: 'bg-stone-200 text-stone-700 ring-stone-300' },
};

export const URGENCY = {
  CRITICAL: { label: 'Critical', cls: 'bg-red-600 text-white ring-red-700', color: '#dc2626' },
  HIGH: { label: 'High', cls: 'bg-orange-100 text-orange-800 ring-orange-200', color: '#ea580c' },
  MEDIUM: { label: 'Medium', cls: 'bg-amber-100 text-amber-800 ring-amber-200', color: '#d97706' },
  LOW: { label: 'Low', cls: 'bg-stone-100 text-stone-700 ring-stone-200', color: '#78716c' },
};

export const INTENDED_USE = {
  PERSONAL: 'Personal use', EDUCATION: 'Education', HEALTHCARE: 'Healthcare need', COMMUNITY_EVENT: 'Community event', OTHER: 'Other',
};

export const REPORT_REASONS = { SPAM: 'Spam', FRAUD: 'Fraud or scam', ABUSIVE: 'Abusive behaviour', UNSAFE: 'Unsafe item or situation', INAPPROPRIATE: 'Inappropriate content', OTHER: 'Something else' };

export const ORG_TYPES = { HOSPITAL: 'Hospital', SCHOOL: 'School', NGO: 'NGO', COMMUNITY: 'Community group', OTHER: 'Other' };

export const CATEGORY_EMOJI = {
  books: '📚', clothing: '🧥', electronics: '💻', furniture: '🛋️', 'medical-equipment': '🩺',
  food: '🍚', tools: '🔧', sports: '🏸', 'school-supplies': '✏️', other: '📦',
};

// Used only when the API's category list has not loaded yet.
export const FALLBACK_CATEGORIES = [
  { slug: 'books', name: 'Books & Educational Materials', subcategories: [] },
  { slug: 'clothing', name: 'Clothing & Footwear', subcategories: [] },
  { slug: 'electronics', name: 'Electronics', subcategories: [] },
  { slug: 'furniture', name: 'Furniture & Household Goods', subcategories: [] },
  { slug: 'medical-equipment', name: 'Medical Equipment', subcategories: [] },
  { slug: 'food', name: 'Food & Groceries', subcategories: [] },
  { slug: 'tools', name: 'Tools & Appliances', subcategories: [] },
  { slug: 'sports', name: 'Sports Equipment', subcategories: [] },
  { slug: 'school-supplies', name: 'School Supplies', subcategories: [] },
  { slug: 'other', name: 'Other Community Resources', subcategories: [] },
];

/** slug -> display name (the emergency module reuses the resource categories). */
export const CATEGORY_NAMES = Object.fromEntries(FALLBACK_CATEGORIES.map((c) => [c.slug, c.name]));

/** Emergency requests reuse the resource categories (the API validates both against the same list). */
export const EMERGENCY_CATEGORIES = CATEGORY_NAMES;

export const PRESET_LOCATIONS = [
  { label: 'Greater Noida, UP', lat: 28.4744, lng: 77.504 },
  { label: 'New Delhi', lat: 28.6139, lng: 77.209 },
  { label: 'Mumbai', lat: 19.076, lng: 72.8777 },
  { label: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
  { label: 'Hyderabad', lat: 17.385, lng: 78.4867 },
  { label: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { label: 'Kolkata', lat: 22.5726, lng: 88.3639 },
  { label: 'Pune', lat: 18.5204, lng: 73.8567 },
  { label: 'Jaipur', lat: 26.9124, lng: 75.7873 },
  { label: 'Lucknow', lat: 26.8467, lng: 80.9462 },
];

export const cn = (...a) => a.filter(Boolean).join(' ');
