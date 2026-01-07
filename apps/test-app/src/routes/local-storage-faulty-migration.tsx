import {createFileRoute} from '@tanstack/react-router';
import {ConfigProvider} from '@config-store/react';
import {configManager} from './-local-storage-faulty-migration/settings/manager';
import {Foo} from './-local-storage-faulty-migration/components/Foo';
import {Toaster} from 'react-hot-toast';

export const Route = createFileRoute('/local-storage-faulty-migration')({
  component: OOC_Page,
  loader: () => configManager.load(),
});

function OOC_Page() {
  return (
    <ConfigProvider value={configManager}>
      <div>
        <h1>Local Storage, Faulty Migration</h1>

        <Foo />
      </div>
      <Toaster />
    </ConfigProvider>
  );
}
