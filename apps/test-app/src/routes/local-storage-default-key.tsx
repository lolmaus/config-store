import {createFileRoute} from '@tanstack/react-router';
import {ConfigProvider} from '@config-store/react';
import {configManager} from './-local-storage-default-key/settings/manager';
import {Foo} from './-local-storage-default-key/components/Foo';
import {Toaster} from 'react-hot-toast';

export const Route = createFileRoute('/local-storage-default-key')({
  component: OOC_Page,
  loader: () => configManager.load(),
});

function OOC_Page() {
  return (
    <ConfigProvider value={configManager}>
      <div>
        <h1>Local Storage, Default Key</h1>

        <Foo />
      </div>
      <Toaster />
    </ConfigProvider>
  );
}
