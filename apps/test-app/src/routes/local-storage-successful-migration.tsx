import {createFileRoute} from '@tanstack/react-router';
import {ConfigProvider} from '@config-store/react';
import {configManager} from './-local-storage-successful-migration/settings/manager';
import {Foo} from './-local-storage-successful-migration/components/Foo';
import {Toaster} from 'react-hot-toast';

export const Route = createFileRoute('/local-storage-successful-migration')({
  component: OOC_Page,
  loader: () => configManager.load(),
});

function OOC_Page() {
  return (
    <ConfigProvider value={configManager}>
      <div>
        <h1>Local Storage, Successful Migration</h1>

        <Foo />
      </div>
      <Toaster />
    </ConfigProvider>
  );
}
