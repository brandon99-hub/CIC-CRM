import { defineConfig } from 'i18next-cli';

export default defineConfig({
  locales: ["en", "fr", "sw"],
  extract: {
    input: "client/src/**/*.{js,jsx,ts,tsx}",
    output: "client/public/locales/{{lng}}/translation.json",
    keySeparator: false,
    nsSeparator: false
  }
});