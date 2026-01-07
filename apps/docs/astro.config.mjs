// @ts-check
import {defineConfig} from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightTypeDoc, {typeDocSidebarGroup} from 'starlight-typedoc';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://astro.build/config
export default defineConfig({
  site: 'https://config-store.lolma.us',
  integrations: [
    starlight({
      title: '@lolmaus/config-store',
      social: [{icon: 'github', label: 'GitHub', href: 'https://github.com/lolmaus/config-store'}],
      sidebar: [
        {
          label: 'Guides',
          items: [
            // Each item here is one entry in the navigation menu.
            {label: 'Installation', slug: 'guides/installation'},
            {label: 'Schema Definition', slug: 'guides/schema'},
            {label: 'React Quickstart', slug: 'guides/react-quickstart'},
            {
              label: 'Adapters',
              items: [
                {label: 'LocalStorageAdapter', slug: 'guides/adapters/local-storage'},
                {label: 'AsyncAdapter', slug: 'guides/adapters/async'},
                {label: 'Defining a Custom Adapter', slug: 'guides/adapters/custom'},
              ],
            },
            {label: 'Loading and Error States', slug: 'guides/loading-and-error-states'},
            {label: 'FAQ', slug: 'guides/faq'},
          ],
        },
        typeDocSidebarGroup,
      ],
      customCss: [
        './src/styles.css',
        '@fontsource/oxanium/400.css',
        '@fontsource/exo-2/400.css',
        '@fontsource/exo-2/700.css',
      ],
      plugins: [
        // Generate the documentation.
        starlightTypeDoc({
          entryPoints: ['../../packages/core/src/index.ts', '../../packages/react/src/index.ts'],
          tsconfig: './tsconfig.typedoc.json',
        }),
      ],
      editLink: {
        baseUrl: 'https://github.com/lolmaus/config-store/edit/gen0/apps/docs/',
      },
    }),
  ],
  vite: {
    resolve: {
      alias: {
        // Same alias strategy here: point to source
        '@config-store/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
        '@config-store/react': path.resolve(__dirname, '../../packages/react/src/index.ts'),
      },
    },
  },
});
