// @ts-check
import {defineConfig} from 'astro/config';
import starlight from '@astrojs/starlight';

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
        {
          label: 'Reference',
          autogenerate: {directory: 'reference'},
        },
      ],
      customCss: ['./src/styles.css'],
    }),
  ],
});
