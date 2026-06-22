export interface CountryData {
  name: string;
  code: string;
  currency: string;
  languages: string[];
  capital: string;
}

export const COUNTRIES: CountryData[] = [
  { name: "Kenya", code: "KE", currency: "KES", languages: ["English", "Swahili"], capital: "Nairobi" },
  { name: "Cameroon", code: "CM", currency: "XAF", languages: ["French", "English"], capital: "Douala" },
  { name: "Rwanda", code: "RW", currency: "RWF", languages: ["Kinyarwanda", "French", "English"], capital: "Kigali" },
  { name: "Uganda", code: "UG", currency: "UGX", languages: ["English", "Swahili"], capital: "Kampala" },
  { name: "Tanzania", code: "TZ", currency: "TZS", languages: ["Swahili", "English"], capital: "Dar es Salaam" },
  { name: "South Africa", code: "ZA", currency: "ZAR", languages: ["English", "Afrikaans", "Zulu"], capital: "Johannesburg" },
  { name: "Nigeria", code: "NG", currency: "NGN", languages: ["English"], capital: "Lagos" },
  { name: "Ghana", code: "GH", currency: "GHS", languages: ["English"], capital: "Accra" },
  { name: "Ethiopia", code: "ET", currency: "ETB", languages: ["Amharic", "Oromo"], capital: "Addis Ababa" },
  { name: "Egypt", code: "EG", currency: "EGP", languages: ["Arabic"], capital: "Cairo" },
  { name: "Morocco", code: "MA", currency: "MAD", languages: ["Arabic", "French"], capital: "Casablanca" },
  { name: "Senegal", code: "SN", currency: "XOF", languages: ["French", "Wolof"], capital: "Dakar" },
  { name: "Cote d'Ivoire", code: "CI", currency: "XOF", languages: ["French"], capital: "Abidjan" },
  { name: "Democratic Republic of the Congo", code: "CD", currency: "CDF", languages: ["French", "Lingala"], capital: "Kinshasa" },
  { name: "Zambia", code: "ZM", currency: "ZMW", languages: ["English", "Nyanja"], capital: "Lusaka" },
  { name: "Zimbabwe", code: "ZW", currency: "ZWL", languages: ["English", "Shona"], capital: "Harare" },
  { name: "United States", code: "US", currency: "USD", languages: ["English"], capital: "New_York" },
  { name: "United Kingdom", code: "GB", currency: "GBP", languages: ["English"], capital: "London" },
  { name: "United Arab Emirates", code: "AE", currency: "AED", languages: ["Arabic", "English"], capital: "Dubai" },
  { name: "France", code: "FR", currency: "EUR", languages: ["French"], capital: "Paris" },
  { name: "Germany", code: "DE", currency: "EUR", languages: ["German"], capital: "Berlin" },
  { name: "India", code: "IN", currency: "INR", languages: ["Hindi", "English"], capital: "Kolkata" },
  { name: "China", code: "CN", currency: "CNY", languages: ["Mandarin"], capital: "Shanghai" },
  { name: "Japan", code: "JP", currency: "JPY", languages: ["Japanese"], capital: "Tokyo" },
  { name: "Australia", code: "AU", currency: "AUD", languages: ["English"], capital: "Sydney" },
  { name: "Canada", code: "CA", currency: "CAD", languages: ["English", "French"], capital: "Toronto" },
  { name: "Brazil", code: "BR", currency: "BRL", languages: ["Portuguese"], capital: "Sao_Paulo" }
];
