import {GlobalRegistrator} from '@happy-dom/global-registrator';

GlobalRegistrator.register();

export function teardown() {
  GlobalRegistrator.unregister();
}
