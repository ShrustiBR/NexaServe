// Default federation rates — used to seed Firestore the first time, and as a
// fallback if a service is ever missing from the "config/rates" document.
export const DEFAULT_RATES = {
  Plumbing: 300,
  Electrical: 350,
  Cleaning: 250,
  Carpentry: 320,
  Painting: 280,
  Caregiving: 260,
  "Pest Control": 400,
  "Appliance Repair": 350,
  "AC Repair": 450,
  Gardening: 220,
  "Home Tutoring": 300,
  "Packers & Movers": 800,
  "Salon at Home": 350,
  "Cooking & Catering": 500
};

export const SERVICES = Object.keys(DEFAULT_RATES);
