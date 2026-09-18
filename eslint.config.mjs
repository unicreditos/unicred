import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import unusedImports from 'eslint-plugin-unused-imports'

const config = [
  {
    // unicreditos-admin/ es un proyecto Next.js aparte (su propio
    // package.json, node_modules y config de ESLint) que vive anidado en
    // este repo; sin excluirlo acá, `npm run lint` lo recorre como si fuera
    // parte de esta app y ahoga las 5 reglas propias con miles de avisos.
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'scripts/**', 'emitia/**', 'unicreditos-admin/**'],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    plugins: { 'unused-imports': unusedImports },
    rules: {
      // El proyecto usa `any` en los bordes con la base y con Mercado Pago;
      // marcarlos todos como error no aportaría señal útil.
      '@typescript-eslint/no-explicit-any': 'off',
      // Los imports muertos se borran solos con `eslint . --fix`; el resto de
      // variables sin usar quedan como aviso salvo que empiecen con `_`.
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        { args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
]

export default config
