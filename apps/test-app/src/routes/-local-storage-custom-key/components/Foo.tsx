import type {ChangeEvent, ReactNode} from 'react';
import {useConfig, useUpdateConfigReducer} from '../settings/hooks';

export function Foo(): ReactNode {
  const isMenuExpanded: boolean = useConfig((c) => c.menuExpanded);

  const {update: setIsMenuExpanded} = useUpdateConfigReducer<ChangeEvent<HTMLInputElement>>(
    (config, event: ChangeEvent<HTMLInputElement>) => {
      return {
        ...config,
        menuExpanded: event.target.checked,
      };
    }
  );

  return (
    <div>
      <label>
        <input type="checkbox" checked={isMenuExpanded} onChange={setIsMenuExpanded} readOnly />
        Menu Expanded
      </label>
    </div>
  );
}
