import {createHooks} from '@config-store/react';
import type {MySettings} from './manager';

export const {useConfig, useUpdateConfig, useUpdateConfigReducer} = createHooks<MySettings>();
