import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import unusedImports from 'eslint-plugin-unused-imports'

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'scripts/**', 'emitia/**'],
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
