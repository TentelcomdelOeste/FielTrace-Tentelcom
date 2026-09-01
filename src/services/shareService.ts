/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

export const shareService = {
  async shareText(title: string, text: string) {
    if (!Capacitor.isNativePlatform()) {
      console.log('Share Text (Web Fallback):', { title, text });
      return;
    }
    await Share.share({
      title,
      text,
      dialogTitle: title
    });
  },

  async sharePhoto(title: string, text: string, url: string) {
    if (!Capacitor.isNativePlatform()) {
       // On web, we might just log or simulate
       console.log('Share Photo (Web Fallback):', { title, text, url: url.substring(0, 50) + '...' });
       return;
    }

    try {
      await Share.share({
        title,
        text,
        url,
        dialogTitle: 'Compartir Evidencia'
      });
    } catch (e) {
      console.error('Share Error', e);
    }
  }
};
