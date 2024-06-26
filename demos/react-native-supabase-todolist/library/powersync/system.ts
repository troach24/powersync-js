import '@azure/core-asynciterator-polyfill';
import 'react-native-polyfill-globals/auto';
import React from 'react';
import { PowerSyncDatabase, SyncStreamConnectionMethod } from '@powersync/react-native';
import { SupabaseStorageAdapter } from '../storage/SupabaseStorageAdapter';

import { AppSchema } from './AppSchema';
import { SupabaseConnector } from '../supabase/SupabaseConnector';
import { KVStorage } from '../storage/KVStorage';
import { PhotoAttachmentQueue } from './PhotoAttachmentQueue';
import { type AttachmentRecord } from '@powersync/attachments';
import { AppConfig } from '../supabase/AppConfig';

import { Buffer } from '@craftzdog/react-native-buffer';

// Polyfills for WebSockets
if (typeof global.Buffer == 'undefined') {
  // @ts-expect-error If using TypeScript
  global.Buffer = Buffer;
}

if (typeof process.nextTick == 'undefined') {
  process.nextTick = setImmediate;
}

export class System {
  kvStorage: KVStorage;
  storage: SupabaseStorageAdapter;
  supabaseConnector: SupabaseConnector;
  powersync: PowerSyncDatabase;
  attachmentQueue: PhotoAttachmentQueue | undefined = undefined;

  constructor() {
    this.kvStorage = new KVStorage();
    this.supabaseConnector = new SupabaseConnector(this);
    this.storage = this.supabaseConnector.storage;
    this.powersync = new PowerSyncDatabase({
      schema: AppSchema,
      database: {
        dbFilename: 'sqlite.db'
      }
    });

    if (AppConfig.supabaseBucket) {
      this.attachmentQueue = new PhotoAttachmentQueue({
        powersync: this.powersync,
        storage: this.storage,
        // Use this to handle download errors where you can use the attachment
        // and/or the exception to decide if you want to retry the download
        onDownloadError: async (attachment: AttachmentRecord, exception: any) => {
          if (exception.toString() === 'StorageApiError: Object not found') {
            return { retry: false };
          }

          return { retry: true };
        }
      });
    }
  }

  async init() {
    await this.powersync.init();
    await this.powersync.connect(this.supabaseConnector, { connectionMethod: SyncStreamConnectionMethod.WEB_SOCKET });

    if (this.attachmentQueue) {
      await this.attachmentQueue.init();
    }
  }
}

export const system = new System();

export const SystemContext = React.createContext(system);
export const useSystem = () => React.useContext(SystemContext);
