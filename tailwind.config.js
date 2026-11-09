/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
    theme: {
        extend: {
            opacity: Object.fromEntries(Array.from({ length: 101 }, (_, i) => [i, `${i / 100}`])),
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)'
            },
            colors: {
                blue: {
                    50: '#e9fbfc',
                    100: '#cdf4f7',
                    200: '#a1e8ee',
                    300: '#66d5e0',
                    400: '#2fbccd',
                    500: '#169fb3',
                    600: '#0f8194',
                    700: '#10687a',
                    800: '#135664',
                    900: '#0c4453',
                    950: '#042b36'
                },
                violet: {
                    50: '#e8f8f6',
                    100: '#ccf0ea',
                    200: '#9ce0d6',
                    300: '#63c9bd',
                    400: '#33ae9f',
                    500: '#159184',
                    600: '#0c746a',
                    700: '#0d5d56',
                    800: '#0f4b46',
                    900: '#0c3e3a',
                    950: '#041f1d'
                },
                indigo: {
                    50: '#eaf7f9',
                    100: '#d0eef3',
                    200: '#a5dde7',
                    300: '#6ec5d4',
                    400: '#38a7ba',
                    500: '#158a9e',
                    600: '#0d6f81',
                    700: '#0e5a69',
                    800: '#104a56',
                    900: '#0d3d47',
                    950: '#04222a'
                },
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                    card: {
                        DEFAULT: 'hsl(var(--card))',
                        foreground: 'hsl(var(--card-foreground))'
                    },
                    popover: {
                        DEFAULT: 'hsl(var(--popover))',
                        foreground: 'hsl(var(--popover-foreground))'
                    },
                    primary: {
                        DEFAULT: 'hsl(var(--primary))',
                        foreground: 'hsl(var(--primary-foreground))'
                    },
                    secondary: {
                        DEFAULT: 'hsl(var(--secondary))',
                        foreground: 'hsl(var(--secondary-foreground))'
                    },
                    muted: {
                        DEFAULT: 'hsl(var(--muted))',
                        foreground: 'hsl(var(--muted-foreground))'
                    },
                    accent: {
                        DEFAULT: 'hsl(var(--accent))',
                        foreground: 'hsl(var(--accent-foreground))'
                    },
                    destructive: {
                        DEFAULT: 'hsl(var(--destructive))',
                        foreground: 'hsl(var(--destructive-foreground))'
                    },
                    border: 'hsl(var(--border))',
                    input: 'hsl(var(--input))',
                    ring: 'hsl(var(--ring))',
                    chart: {
                        '1': 'hsl(var(--chart-1))',
                        '2': 'hsl(var(--chart-2))',
                        '3': 'hsl(var(--chart-3))',
                        '4': 'hsl(var(--chart-4))',
                        '5': 'hsl(var(--chart-5))'
                    },
                    sidebar: {
                        DEFAULT: 'hsl(var(--sidebar-background))',
                        foreground: 'hsl(var(--sidebar-foreground))',
                            primary: 'hsl(var(--sidebar-primary))',
                            'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
                            accent: 'hsl(var(--sidebar-accent))',
                            'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
                            border: 'hsl(var(--sidebar-border))',
                            ring: 'hsl(var(--sidebar-ring))'
                    }
            },
            fontFamily: {
                heading: ['var(--font-heading)'],
                body: ['var(--font-body)'],
                display: ['var(--font-display)'],
                mono: ['var(--font-mono)']
            },
            keyframes: {
                'accordion-down': {
                    from: {
                        height: '0'
                    },
                    to: {
                        height: 'var(--radix-accordion-content-height)'
                    }
                },
                'accordion-up': {
                    from: {
                        height: 'var(--radix-accordion-content-height)'
                    },
                    to: {
                        height: '0'
                    }
                }
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out'
            }
        }
    },
    plugins: [require("tailwindcss-animate")],
}
