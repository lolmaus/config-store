import {createFileRoute} from '@tanstack/react-router';
import {ConfigProvider} from '@config-store/react';
import {configManager} from './-local-storage-custom-key/settings/manager';
import {Foo} from './-local-storage-custom-key/components/Foo';
import {Toaster} from 'react-hot-toast';

export const Route = createFileRoute('/local-storage-custom-key')({
  component: OOC_Page,
  loader: () => configManager.load(),
});

function OOC_Page() {
  return (
    <ConfigProvider value={configManager}>
      <div>
        <h1>Local Storage, Custom Key</h1>

        <Foo />
      </div>
      <Toaster />
    </ConfigProvider>
  );
}
