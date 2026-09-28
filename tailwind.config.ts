import type { Config } from 'tailwindcss';
const config: Config = {
    content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
    theme: {
        extend: {
            colors: {
                ink: '#15221e',
                moss: '#49634f',
                lime: '#d8ed72',
                paper: '#f4f3ed',
                surface: '#fbfbf7',
                line: '#d7d8cf',
                muted: '#59615b',
                success: '#236448',
                warning: '#8a5412',
                danger: '#a23832',
                focus: '#245f9e'
            },
            spacing: {
                page: 'clamp(1rem, 4vw, 3rem)',
                section: 'clamp(1.5rem, 4vw, 3rem)'
            },
            borderRadius: {
                control: '3px',
                panel: '6px'
            },
            fontFamily: {
                sans: ['Aptos', 'Segoe UI', 'sans-serif'],
                display: ['Georgia', 'Times New Roman', 'serif']
            }
        }
    },
    plugins: []
};
export default config;