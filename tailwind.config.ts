import type { Config } from 'tailwindcss';
const config: Config = { content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'], theme: { extend: { colors: { ink: '#15221e', moss: '#49634f', lime: '#d8ed72', paper: '#f4f3ed' }, fontFamily: { sans: ['Arial', 'sans-serif'] } } }, plugins: [] };
export default config;