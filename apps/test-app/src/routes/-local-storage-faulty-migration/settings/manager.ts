import {
  ConfigManager,
  LocalStorageAdapter,
  type InferConfig,
  type OnLoadError,
  type OnMigrationError,
  type OnSaveError,
} from '@config-store/core';
import toast from 'react-hot-toast';
import {z} from 'zod';

// Create your adapter (or import a custom one)
const adapter = new LocalStorageAdapter();

const onLoadError: OnLoadError = (error: unknown) => {
  toast.error(`Load Error: ${(error as Error).message}`, {duration: 1_000_000});
};

const onSaveError: OnSaveError = (error: unknown) => {
  toast.error(`Save Error: ${(error as Error).message}`, {duration: 1_000_000});
};

const onMigrationError: OnMigrationError = ({error}) => {
  toast.error(`Migration Error: ${(error as Error).message}`, {duration: 1_000_000});
};
// Initialize the manager with the adapter
export const configManager = ConfigManager

  // Initialize with adapter and schema version 1
  .create(
    {adapter, onLoadError, onSaveError, onMigrationError},
    {
      version: 1,
      schema: z
        .object({
          menuExpanded: z.boolean().default(true),
          darkTheme: z.boolean().default(false),
        })
        .prefault({}),
    }
  )
  .addVersion({
    version: 2,
    schema: z
      .object({
        menuExpanded: z.boolean().default(true),
        darkTheme: z.literal(['light', 'dark']).default('light'),
      })
      .prefault({}),
    migration: () => {
      throw new Error('Simulated migration failure');
    },
  });

// Export the current config type
export type MySettings = InferConfig<typeof configManager>;
