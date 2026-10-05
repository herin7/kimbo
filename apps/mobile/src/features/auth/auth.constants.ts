// `daysLogged` mirrors apps/api/src/db/seed-demo-users.ts (days with data across its 365-day history).
export const demoAccounts = [
  { name: "Ananya", email: "ananya@kimbo.demo", password: "KimboDemo!", goal: "Lose weight", daysLogged: 307 },
  { name: "Rohan", email: "rohan@kimbo.demo", password: "KimboDemo!", goal: "Maintain", daysLogged: 321 },
  { name: "Mira", email: "mira@kimbo.demo", password: "KimboDemo!", goal: "Gain strength", daysLogged: 265 },
] as const;
