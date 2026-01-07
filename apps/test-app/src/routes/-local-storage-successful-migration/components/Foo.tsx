import type {ChangeEvent, ReactNode} from 'react';
import {useConfig, useUpdateConfigReducer} from '../settings/hooks';
import type {MySettings} from '../settings/manager';
import type {ManagerState} from '@config-store/core';

export function Foo(): ReactNode {
  const isMenuExpanded: boolean = useConfig((c) => !c.menuCollapsed);
  const state: ManagerState<MySettings> = useConfig((_c, state) => state);

  const {update: setIsMenuExpanded} = useUpdateConfigReducer<ChangeEvent<HTMLInputElement>>(
    (config, event: ChangeEvent<HTMLInputElement>) => {
      return {
        ...config,
        menuExpanded: event.target.checked,
      };
    }
  );

  function populateV1Data() {
    localStorage.setItem(
      '@lolmaus/config-store',
      JSON.stringify({
        config: {
          menuExpanded: false,
          darkTheme: true,
        }, // corrupt config
        metadata: {
          schemaVersion: 1,
          dataVersion: 5,
        },
      })
    );
    alert('Populated v1 data into localStorage. Reload the page to trigger migration.');
  }

  return (
    <div>
      <p>
        <label>
          <input type="checkbox" checked={isMenuExpanded} onChange={setIsMenuExpanded} readOnly />
          Menu Expanded
        </label>
      </p>

      <p>
        <button onClick={populateV1Data}>Populate v1 data into localStorage</button>
      </p>

      <pre>{JSON.stringify(state, null, 2)}</pre>
    </div>
  );
}
